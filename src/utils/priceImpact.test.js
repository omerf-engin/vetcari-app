import { describe, it, expect } from 'vitest';
import {
  selectAffectedDebts, computePriceImpact, needsPriceConfirm,
  latestPriceBatch, canRevertPriceUpdate, revertBlockedMessage
} from './priceImpact';

const drug = (over = {}) => ({ id: 'drug1', name: 'Amoksisilin', price: 100, ...over });

const debt = (over = {}) => ({
  id: 'dd1', drugId: 'drug1', customerId: 'c1', qty: 2, maxPrice: 100, isFixed: false, ...over
});

const customers = [
  { id: 'c1', name: 'Ahmet' },
  { id: 'c2', name: 'Ayşe' }
];

const priceLog = (over = {}) => ({
  id: 'l1', kind: 'price', drugId: 'drug1', debtId: 'dd1', batchId: 'p1',
  timestamp: 1000, maxPriceBefore: 100, maxPriceAfter: 200,
  drugPriceBefore: 100, drugPriceAfter: 200, ...over
});

describe('selectAffectedDebts', () => {
  it('yalnizca sabitlenmemis ve yeni fiyatin altinda kalan borclari secer', () => {
    const debts = [
      debt({ id: 'a', maxPrice: 100 }),
      debt({ id: 'b', maxPrice: 100, isFixed: true }),
      debt({ id: 'c', maxPrice: 300 }),
      debt({ id: 'd', drugId: 'baska', maxPrice: 100 })
    ];

    expect(selectAffectedDebts('drug1', 200, debts).map(d => d.id)).toEqual(['a']);
  });

  it('dususte hicbir borc secilmez', () => {
    expect(selectAffectedDebts('drug1', 50, [debt()]).length).toBe(0);
  });
});

describe('computePriceImpact', () => {
  it('zamda etkilenen borclari ve toplam farki hesaplar', () => {
    const debts = [
      debt({ id: 'a', customerId: 'c1', qty: 2, maxPrice: 100 }),
      debt({ id: 'b', customerId: 'c2', qty: 3, maxPrice: 100 })
    ];

    const impact = computePriceImpact(drug(), 200, debts, customers);

    expect(impact.direction).toBe('increase');
    expect(impact.debtCount).toBe(2);
    expect(impact.customerCount).toBe(2);
    expect(impact.totalDelta).toBe(500); // (2 × 100) + (3 × 100)
    expect(impact.affected[0]).toMatchObject({ customerName: 'Ahmet', oldTl: 200, newTl: 400, delta: 200 });
  });

  it('sabitlenmis borc etkilenmez, unchanged listesine duser', () => {
    const debts = [debt({ id: 'a' }), debt({ id: 'b', isFixed: true })];

    const impact = computePriceImpact(drug(), 200, debts, customers);

    expect(impact.affected.map(a => a.debt.id)).toEqual(['a']);
    expect(impact.unchanged.map(u => u.debt.id)).toEqual(['b']);
  });

  it('dususte hicbir borc etkilenmez ama hepsi unchanged olur', () => {
    const debts = [debt({ id: 'a', maxPrice: 100 }), debt({ id: 'b', maxPrice: 100 })];

    const impact = computePriceImpact(drug({ price: 100 }), 50, debts, customers);

    expect(impact.direction).toBe('decrease');
    expect(impact.affected).toEqual([]);
    expect(impact.unchanged).toHaveLength(2);
    expect(impact.totalDelta).toBe(0);
  });

  it('ayni fiyat girildiginde direction same doner', () => {
    expect(computePriceImpact(drug({ price: 100 }), 100, [debt()], customers).direction).toBe('same');
  });

  it('ayni musterinin iki borcu tek musteri sayilir', () => {
    const debts = [
      debt({ id: 'a', customerId: 'c1' }),
      debt({ id: 'b', customerId: 'c1' })
    ];

    const impact = computePriceImpact(drug(), 200, debts, customers);
    expect(impact.debtCount).toBe(2);
    expect(impact.customerCount).toBe(1);
  });

  it('tutarlari 0.01 TL hassasiyetinde hesaplar', () => {
    const debts = [debt({ qty: 3, maxPrice: 0.1 })];

    const impact = computePriceImpact(drug({ price: 0.1 }), 0.2, debts, customers);

    expect(impact.affected[0].oldTl).toBe(0.3);
    expect(impact.affected[0].newTl).toBe(0.6);
    expect(impact.totalDelta).toBe(0.3);
  });

  it('bilinmeyen musteri icin yer tutucu isim kullanir', () => {
    const impact = computePriceImpact(drug(), 200, [debt({ customerId: 'yok' })], customers);
    expect(impact.affected[0].customerName).toBe('Bilinmeyen Müşteri');
  });

  it('baska ilacin borclarini hesaba katmaz', () => {
    const impact = computePriceImpact(drug(), 200, [debt({ drugId: 'baska' })], customers);
    expect(impact.affected).toEqual([]);
    expect(impact.unchanged).toEqual([]);
  });
});

describe('needsPriceConfirm', () => {
  it('acik borc yoksa onay istemez', () => {
    const impact = computePriceImpact(drug(), 200, [], customers);
    expect(needsPriceConfirm(impact)).toBe(false);
  });

  it('etkilenen ya da etkilenmeyen acik borc varsa onay ister', () => {
    expect(needsPriceConfirm(computePriceImpact(drug(), 200, [debt()], customers))).toBe(true);
    expect(needsPriceConfirm(computePriceImpact(drug({ price: 100 }), 50, [debt()], customers))).toBe(true);
  });
});

describe('latestPriceBatch', () => {
  it('en yeni zam grubunu loglariyla birlikte doner', () => {
    const logs = [
      priceLog({ id: 'l1', batchId: 'p1', timestamp: 1000 }),
      priceLog({ id: 'l2', batchId: 'p2', timestamp: 5000, debtId: 'dd2' }),
      priceLog({ id: 'l3', batchId: 'p2', timestamp: 5001, debtId: 'dd3' })
    ];

    const batch = latestPriceBatch('drug1', logs);
    expect(batch.batchId).toBe('p2');
    expect(batch.logs).toHaveLength(2);
    expect(batch.timestamp).toBe(5001);
  });

  it('yapisal veri tasimayan eski zam loglarini yok sayar', () => {
    const logs = [priceLog({ maxPriceBefore: undefined }), priceLog({ id: 'l2', batchId: undefined })];
    expect(latestPriceBatch('drug1', logs)).toBeNull();
  });

  it('baska ilacin zamlarini almaz', () => {
    expect(latestPriceBatch('drug1', [priceLog({ drugId: 'baska' })])).toBeNull();
  });
});

describe('canRevertPriceUpdate', () => {
  const debts = [debt({ id: 'dd1' })];

  it('dokunulmamis son zam geri alinabilir', () => {
    const result = canRevertPriceUpdate('drug1', [priceLog()], debts);
    expect(result.ok).toBe(true);
    expect(result.batch.batchId).toBe('p1');
  });

  it('yapisal verisi olmayan eski zam legacy doner', () => {
    expect(canRevertPriceUpdate('drug1', [priceLog({ maxPriceBefore: undefined })], debts))
      .toEqual({ ok: false, reason: 'legacy' });
  });

  it('geri alinmis zam ikinci kez geri alinamaz', () => {
    // Geri alma logu `maxPriceBefore` tasimaz — aksi halde "geri almanin geri alinmasi"
    // zinciri acilirdi. Bu yuzden latestPriceBatch hala p1'i secer, ama daha yeni fiyat
    // logu bulundugu icin islem not-latest ile engellenir.
    const logs = [
      priceLog({ batchId: 'p1', timestamp: 1000 }),
      { id: 'l2', kind: 'price', drugId: 'drug1', debtId: 'dd1', batchId: 'rev1', timestamp: 2000 }
    ];

    expect(canRevertPriceUpdate('drug1', logs, debts))
      .toEqual({ ok: false, reason: 'not-latest' });
  });

  it('ayni ilaca ikinci bir zam yapilmissa eskisi degil yenisi hedeflenir', () => {
    const logs = [
      priceLog({ batchId: 'p1', timestamp: 1000, maxPriceBefore: 100, maxPriceAfter: 200 }),
      priceLog({ id: 'l2', batchId: 'p2', timestamp: 2000, maxPriceBefore: 200, maxPriceAfter: 300 })
    ];

    const result = canRevertPriceUpdate('drug1', logs, debts);
    expect(result.ok).toBe(true);
    expect(result.batch.batchId).toBe('p2');
  });

  it('zamdan sonra tahsilat inmisse activity doner', () => {
    const logs = [
      priceLog({ timestamp: 1000 }),
      { id: 'l2', debtId: 'dd1', kind: 'payment', timestamp: 2000 }
    ];
    expect(canRevertPriceUpdate('drug1', logs, debts))
      .toEqual({ ok: false, reason: 'activity' });
  });

  it('zamdan onceki tahsilat engellemez', () => {
    const logs = [
      priceLog({ timestamp: 5000 }),
      { id: 'l2', debtId: 'dd1', kind: 'payment', timestamp: 1000 }
    ];
    expect(canRevertPriceUpdate('drug1', logs, debts).ok).toBe(true);
  });

  it('kilit degisimi engellemez', () => {
    const logs = [priceLog({ timestamp: 1000 }), { id: 'l2', debtId: 'dd1', kind: 'lock', timestamp: 2000 }];
    expect(canRevertPriceUpdate('drug1', logs, debts).ok).toBe(true);
  });

  it('kind tasimayan yabanci log fail-closed engeller', () => {
    const logs = [priceLog({ timestamp: 1000 }), { id: 'l2', debtId: 'dd1', timestamp: 2000 }];
    expect(canRevertPriceUpdate('drug1', logs, debts).reason).toBe('activity');
  });

  it('etkilenen borc silinmisse missing doner', () => {
    expect(canRevertPriceUpdate('drug1', [priceLog()], []))
      .toEqual({ ok: false, reason: 'missing' });
  });

  it('bos girdide legacy doner', () => {
    expect(canRevertPriceUpdate('drug1', [], [])).toEqual({ ok: false, reason: 'legacy' });
    expect(canRevertPriceUpdate(undefined, undefined, undefined)).toEqual({ ok: false, reason: 'legacy' });
  });
});

describe('revertBlockedMessage', () => {
  it('her sebep icin kullaniciya donuk metin doner', () => {
    expect(revertBlockedMessage('activity')).toMatch(/tahsilat/i);
    expect(revertBlockedMessage('legacy')).toMatch(/eski kayıt/i);
    expect(revertBlockedMessage('not-latest')).toMatch(/son zam/i);
    expect(revertBlockedMessage('missing')).toMatch(/kapanmış/i);
  });
});
