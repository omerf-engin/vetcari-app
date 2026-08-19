import { describe, it, expect } from 'vitest';
import { groupDebtsByBatch } from './debtGrouping';

const drug = (over = {}) => ({
  id: 'debt1',
  drugId: 'drug1',
  qty: 2,
  maxPrice: 100,
  isFixed: false,
  date: '2026-08-12',
  createdAt: 1000,
  ...over
});

const service = (over = {}) => ({
  id: 'svc1',
  desc: 'Muayene',
  amount: 500,
  date: '2026-08-12',
  createdAt: 1000,
  ...over
});

describe('groupDebtsByBatch', () => {
  it('ayni batchId tasiyan ilac kayitlarini tek grupta toplar', () => {
    const groups = groupDebtsByBatch([], [
      drug({ id: 'a', batchId: 'b1' }),
      drug({ id: 'b', batchId: 'b1' }),
      drug({ id: 'c', batchId: 'b1' })
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].itemCount).toBe(3);
    expect(groups[0].items.map(i => i.id)).toEqual(['a', 'b', 'c']);
  });

  it('hizmet ve ilac ayni batchId ile tek grupta birlesir', () => {
    const groups = groupDebtsByBatch(
      [service({ id: 's1', batchId: 'b1', amount: 500 })],
      [drug({ id: 'd1', batchId: 'b1', qty: 2, maxPrice: 100 })]
    );

    expect(groups).toHaveLength(1);
    const g = groups[0];
    expect(g.itemCount).toBe(2);
    expect(g.total).toBe(700); // 500 + 2 × 100
    expect(g.hasService).toBe(true);
    expect(g.hasDrug).toBe(true);
    // Hizmet kalemi once gelir
    expect(g.items.map(i => i.type)).toEqual(['service', 'drug']);
  });

  it('her kaleme type ayirt edicisi ekler', () => {
    const [g] = groupDebtsByBatch(
      [service({ id: 's1', batchId: 'b1' })],
      [drug({ id: 'd1', batchId: 'b1' })]
    );
    expect(g.items.find(i => i.id === 's1').type).toBe('service');
    expect(g.items.find(i => i.id === 'd1').type).toBe('drug');
  });

  it('yalnizca hizmetten olusan grup dogru bayraklar tasir', () => {
    const [g] = groupDebtsByBatch([service({ id: 's1', batchId: 'b1' })], []);
    expect(g.hasService).toBe(true);
    expect(g.hasDrug).toBe(false);
    expect(g.hasFixed).toBe(false);
    expect(g.allFixed).toBe(false); // kilit yalnizca ilac icin anlamli
  });

  it('yalnizca ilactan olusan grup dogru bayraklar tasir', () => {
    const [g] = groupDebtsByBatch([], [drug({ id: 'd1', batchId: 'b1' })]);
    expect(g.hasService).toBe(false);
    expect(g.hasDrug).toBe(true);
  });

  it('batchId tasimayan ayni tarihli eski kayitlari tek grupta birlestirir', () => {
    const groups = groupDebtsByBatch(
      [service({ id: 'eskiSvc', batchId: undefined, createdAt: undefined, amount: 500 })],
      [drug({ id: 'eskiDrug', batchId: undefined, createdAt: undefined, qty: 2, maxPrice: 100 })]
    );

    expect(groups).toHaveLength(1);
    const [g] = groups;
    expect(g.itemCount).toBe(2);
    expect(g.total).toBe(700); // 500 + 2 × 100
    expect(g.hasService).toBe(true);
    expect(g.hasDrug).toBe(true);
  });

  it('farkli tarihli eski kayitlar ayri gruplarda kalir', () => {
    const groups = groupDebtsByBatch([], [
      drug({ id: 'a', batchId: undefined, date: '2024-05-14' }),
      drug({ id: 'b', batchId: undefined, date: '2024-05-15' })
    ]);

    expect(groups).toHaveLength(2);
    expect(groups.every(g => g.itemCount === 1)).toBe(true);
  });

  it('eski kayitlar ayni tarihli batchId li gruba karismaz', () => {
    const groups = groupDebtsByBatch([], [
      drug({ id: 'yeni', batchId: 'b1', date: '2024-05-14', createdAt: 500 }),
      drug({ id: 'eski1', batchId: undefined, date: '2024-05-14', createdAt: undefined }),
      drug({ id: 'eski2', batchId: undefined, date: '2024-05-14', createdAt: undefined })
    ]);

    expect(groups).toHaveLength(2);
    // createdAt yoklugu (0) birlesmis eski grubu ayni tarihli yeni islemin altina indirir
    expect(groups.map(g => g.batchId)).toEqual(['b1', 'legacy:2024-05-14']);
    expect(groups[0].itemCount).toBe(1);
    expect(groups[1].itemCount).toBe(2);
  });

  it('birlesmis eski grupta hasFixed/allFixed yalnizca ilac kalemlerine bakar', () => {
    const [g] = groupDebtsByBatch(
      [service({ id: 'eskiSvc', batchId: undefined })],
      [
        drug({ id: 'eski1', batchId: undefined, isFixed: true }),
        drug({ id: 'eski2', batchId: undefined, isFixed: true })
      ]
    );

    expect(g.itemCount).toBe(3);
    expect(g.hasFixed).toBe(true);
    expect(g.allFixed).toBe(true);
  });

  it('tarihi olmayan eski kayitlarda iki koleksiyonun ayni id si cakismaz', () => {
    // Ayni doküman id'si hem hizmet hem ilac tarafinda olsa bile ayri gruplara duser
    const groups = groupDebtsByBatch(
      [service({ id: 'ayniId', batchId: undefined, date: undefined })],
      [drug({ id: 'ayniId', batchId: undefined, date: undefined })]
    );

    expect(groups).toHaveLength(2);
    expect(groups.map(g => g.batchId).sort()).toEqual(['drug:ayniId', 'service:ayniId']);
  });

  it('gruplari tarihe gore yeniden eskiye siralar', () => {
    const groups = groupDebtsByBatch([], [
      drug({ id: 'a', batchId: 'b1', date: '2026-07-15' }),
      drug({ id: 'b', batchId: 'b2', date: '2026-08-12' }),
      drug({ id: 'c', batchId: 'b3', date: '2026-07-28' })
    ]);

    expect(groups.map(g => g.batchId)).toEqual(['b2', 'b3', 'b1']);
  });

  it('ayni tarihte createdAt yeniden eskiye siralanir', () => {
    const groups = groupDebtsByBatch([], [
      drug({ id: 'a', batchId: 'b1', date: '2026-08-12', createdAt: 100 }),
      drug({ id: 'b', batchId: 'b2', date: '2026-08-12', createdAt: 300 }),
      drug({ id: 'c', batchId: 'b3', date: '2026-08-12', createdAt: 200 })
    ]);

    expect(groups.map(g => g.batchId)).toEqual(['b2', 'b3', 'b1']);
  });

  it('createdAt alani olmayan kayitlarda hata vermez ve en sona duser', () => {
    const groups = groupDebtsByBatch([], [
      drug({ id: 'eski', batchId: 'b1', date: '2026-08-12', createdAt: undefined }),
      drug({ id: 'yeni', batchId: 'b2', date: '2026-08-12', createdAt: 500 })
    ]);

    expect(groups.map(g => g.batchId)).toEqual(['b2', 'b1']);
    expect(groups[1].createdAt).toBe(0);
  });

  it('grup toplamini 0.01 TL hassasiyetinde hesaplar', () => {
    const groups = groupDebtsByBatch([], [
      drug({ id: 'a', batchId: 'b1', qty: 3, maxPrice: 0.1 }),
      drug({ id: 'b', batchId: 'b1', qty: 3, maxPrice: 0.2 })
    ]);

    // 0.30000000000000004 + 0.6000000000000001 → 0.9
    expect(groups[0].total).toBe(0.9);
  });

  it('zenginlestirilmis satirda tlValue degerini kullanir', () => {
    const groups = groupDebtsByBatch([], [
      drug({ id: 'a', batchId: 'b1', tlValue: 250, drugName: 'Amoksisilin' }),
      drug({ id: 'b', batchId: 'b1', tlValue: 150, drugName: 'Vitamin B12' })
    ]);

    expect(groups[0].total).toBe(400);
    expect(groups[0].items[0].drugName).toBe('Amoksisilin');
  });

  it('hasFixed ve allFixed yalnizca ilac kalemlerine bakar', () => {
    // Hizmet kalemi allFixed degerini bozmamali
    const [withService] = groupDebtsByBatch(
      [service({ id: 's1', batchId: 'b1' })],
      [drug({ id: 'd1', batchId: 'b1', isFixed: true })]
    );
    expect(withService.hasFixed).toBe(true);
    expect(withService.allFixed).toBe(true);

    const [mixed] = groupDebtsByBatch([], [
      drug({ id: 'a', batchId: 'b2', isFixed: true }),
      drug({ id: 'b', batchId: 'b2', isFixed: false })
    ]);
    expect(mixed.hasFixed).toBe(true);
    expect(mixed.allFixed).toBe(false);

    const [allFree] = groupDebtsByBatch([], [
      drug({ id: 'a', batchId: 'b3', isFixed: false }),
      drug({ id: 'b', batchId: 'b3', isFixed: false })
    ]);
    expect(allFree.hasFixed).toBe(false);
    expect(allFree.allFixed).toBe(false);
  });

  it('bos veya tanimsiz girdi icin bos dizi doner', () => {
    expect(groupDebtsByBatch([], [])).toEqual([]);
    expect(groupDebtsByBatch(undefined, undefined)).toEqual([]);
  });
});
