// --- YAZIM YOLU <-> RAPOR DIKISI ---
//
// `firestoreOperations` `flow` dizgilerini YAZAR, `reporting` OKUR. Iki taraf da kendi
// test dosyasinda kendi dizge kopyasiyla sinaniyor: bir tarafta yazim hatasi olsa her iki
// paket de gecmeye devam ederdi. Bu dosya gercek yazim yolunu calistirip urettigi loglari
// dogrudan `summarizePeriod`'a verir.
//
// En kritik iddia `unmeasured === 0`: yazilan her `flow` degeri rapor tarafinda taniniyor.
// Yeni bir hareket turu eklenip raporda karsiligi unutulursa burasi kirilir.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createMockBatch, mockDoc, mockCollection, mockAddDoc,
  mockDeleteDoc, mockUpdateDoc, mockGetDoc, mockRunTransaction, setTransactionSink, seedDoc, resetMocks
} from '../test/firebaseMock';
import { todayLocal } from './dates';
import { summarizePeriod } from './reporting';

const mockBatch = createMockBatch();
// Surum kontrollu islemler transaction kullaniyor; yazmalari ayni diziye dussun
setTransactionSink(mockBatch.operations);

vi.mock('firebase/firestore', () => ({
  collection: (...args) => mockCollection(...args),
  doc: (...args) => mockDoc(...args),
  addDoc: (...args) => mockAddDoc(...args),
  deleteDoc: (...args) => mockDeleteDoc(...args),
  updateDoc: (...args) => mockUpdateDoc(...args),
  getDoc: (...args) => mockGetDoc(...args),
  getDocs: vi.fn(() => Promise.resolve({ docs: [], forEach() {} })),
  query: vi.fn((...args) => args),
  where: vi.fn(() => ({})),
  writeBatch: () => mockBatch,
  runTransaction: (...args) => mockRunTransaction(...args),
}));

vi.mock('../services/firebase', () => ({ db: { type: 'mock-db' } }));

beforeEach(() => {
  resetMocks();
  mockBatch.operations.length = 0;
});

const {
  addDebtTransactionOperations,
  applyPaymentOperations,
  returnDrug,
  updateDrugPrice,
  toggleDebtLock,
  cancelDebtItemOperations,
  cancelDebtTransactionOperations,
  revertPaymentOperations,
} = await import('../services/firestoreOperations');

const TODAY = todayLocal();

/** Gercekten yazilmis log dokumanlari (borc dokumanlari haric). */
const writtenLogs = () => mockBatch.operations
  .filter(op => op.type === 'set' && op.data.title !== undefined)
  .map((op, i) => ({ id: `log${i}`, ...op.data }));

/** Tum tarihleri kapsayan aralik — hicbir log tarih filtresine takilmasin. */
const ALL_TIME = { start: '2000-01-01', end: '2099-12-31' };

const summarize = (period = ALL_TIME) => summarizePeriod(writtenLogs(), period);

const item = (drug, qty, unitPrice) => ({ drug, qty, unitPrice });

describe('yazim yolu -> rapor: hicbir hareket olculemeyen kalmaz', () => {
  it('karma giris (hizmet + ilac + gomulu tahsilat + supurucu + enflasyon)', async () => {
    await addDebtTransactionOperations('cust1', {
      date: '2026-01-20',
      service: { desc: 'Muayene', amount: 1000, paidAmount: 400, paidDate: '2026-01-21' },
      drugItems: [item({ id: 'drug1', price: 120 }, 5, 100)],
      drugPaidAmount: 200,
      drugPaidDate: '2026-01-21',
      applyInflation: true
    }, 'uid1');

    const s = summarize();
    expect(s.unmeasured).toBe(0);
    expect(s.movementCount).toBe(writtenLogs().length);
  });

  it('tahsilat + avans', async () => {
    await applyPaymentOperations(
      { id: 'cust1', balance: 0 }, 1500,
      [{ id: 's1', type: 'service', deduct: 1000 }],
      [{ id: 's1', customerId: 'cust1', amount: 2000 }], [], 'uid1'
    );
    expect(summarize().unmeasured).toBe(0);
  });

  it('iade ve fazla iade', async () => {
    await returnDrug({ id: 'dd1', customerId: 'cust1', drugId: 'drug1', qty: 10, maxPrice: 50 }, 4, 0, 'uid1');
    expect(summarize().unmeasured).toBe(0);

    mockBatch.operations.length = 0;
    await returnDrug({ id: 'dd2', customerId: 'cust1', drugId: 'drug1', qty: 5, maxPrice: 50 }, 8, 0, 'uid1');
    expect(summarize().unmeasured).toBe(0);
  });

  it('zam', async () => {
    await updateDrugPrice('drug1', 120, [
      { id: 'dd1', drugId: 'drug1', customerId: 'cust1', qty: 5, maxPrice: 100, isFixed: false }
    ], 'uid1', 100);
    expect(summarize().unmeasured).toBe(0);
  });

  it('iptaller', async () => {
    await cancelDebtItemOperations('cust1', { id: 'dd1', type: 'drug', qty: 4, maxPrice: 25, drugId: 'drug1' }, 'Hatalı', 'uid1');
    expect(summarize().unmeasured).toBe(0);

    mockBatch.operations.length = 0;
    await cancelDebtTransactionOperations('cust1', [{ id: 's1', type: 'service', amount: 500 }], 'b1', 'Hatalı', 'uid1');
    expect(summarize().unmeasured).toBe(0);
  });

  it('kilit logu ne toplanir ne olculemez sayilir', async () => {
    await toggleDebtLock({ id: 'dd1', customerId: 'cust1', drugId: 'drug1', isFixed: false }, 'uid1');
    const s = summarize();
    expect(s.unmeasured).toBe(0);
    expect(s.movementCount).toBe(0);
  });
});

describe('yazim yolu -> rapor: toplamlar', () => {
  it('gomulu tahsilatli hizmet borcu kendi icinde denklesir', async () => {
    // 1000 borc, 400 tahsilat -> kalan 600 borc olarak yasar
    await addDebtTransactionOperations('cust1', {
      date: TODAY,
      service: { desc: 'Muayene', amount: 1000, paidAmount: 400, paidDate: TODAY }
    }, 'uid1');

    const s = summarize();
    expect(s.debtOpened).toBe(1000);
    expect(s.collected).toBe(400);
    expect(s.receivableChange).toBe(600);
  });

  it('supurulen giris alacaga hic etki etmez', async () => {
    // 1000 borc, 995 tahsilat -> kalan 5 supurulur, geriye borc kalmaz
    await addDebtTransactionOperations('cust1', {
      date: TODAY,
      service: { desc: 'Muayene', amount: 1000, paidAmount: 995, paidDate: TODAY }
    }, 'uid1');

    const s = summarize();
    expect(s.debtOpened).toBe(1000);
    expect(s.collected).toBe(995);
    expect(s.writeoff).toBe(5);
    expect(s.receivableChange).toBe(0);
  });

  it('tahsilat toplami musteriden alinan nakde esittir', async () => {
    // 1500 alindi: 1000 borca, 500 avansa
    await applyPaymentOperations(
      { id: 'cust1', balance: 0 }, 1500,
      [{ id: 's1', type: 'service', deduct: 1000 }],
      [{ id: 's1', customerId: 'cust1', amount: 2000 }], [], 'uid1'
    );

    const s = summarize();
    expect(s.collected).toBe(1500);
    expect(s.advanceIn).toBe(500);
    expect(s.receivableChange).toBe(-1000);
  });

  it('avanstan odenen kisim nakde sayilmaz', async () => {
    // Musteride 400 avans var, 600 nakit veriyor, 1000 borc kapaniyor
    await applyPaymentOperations(
      { id: 'cust1', balance: 400 }, 600,
      [{ id: 's1', type: 'service', deduct: 1000 }],
      [{ id: 's1', customerId: 'cust1', amount: 1000 }], [], 'uid1'
    );

    const s = summarize();
    expect(s.collected).toBe(600);
    expect(s.advanceUsed).toBe(400);
    expect(s.receivableChange).toBe(-1000);
  });

  it('fazla iadede yalnizca borca sayilan kisim alacagi azaltir', async () => {
    // 5 adet x 50 = 250 borc, 8 adet iade -> 250 kapanir, 150 avansa
    await returnDrug({ id: 'dd1', customerId: 'cust1', drugId: 'drug1', qty: 5, maxPrice: 50 }, 8, 0, 'uid1');

    const s = summarize();
    expect(s.returned).toBe(250);
    expect(s.advanceIn).toBe(150);
    expect(s.collected).toBe(0);
    expect(s.receivableChange).toBe(-250);
  });

  it('iade + supurucu birlikte borcun tamamini kapatir', async () => {
    // 10 adet x 50 = 500 borc, 9.9 adet iade -> kalan 5 TL supurulur
    await returnDrug({ id: 'dd1', customerId: 'cust1', drugId: 'drug1', qty: 10, maxPrice: 50 }, 9.9, 0, 'uid1');

    const s = summarize();
    expect(Math.round((s.returned + s.writeoff) * 100) / 100).toBe(500);
    expect(s.receivableChange).toBe(-500);
  });

  it('zam alacagi artirir', async () => {
    await updateDrugPrice('drug1', 120, [
      { id: 'dd1', drugId: 'drug1', customerId: 'cust1', qty: 5, maxPrice: 100, isFixed: false }
    ], 'uid1', 100);

    const s = summarize();
    expect(s.priceUp).toBe(100);
    expect(s.receivableChange).toBe(100);
  });
});

describe('yazim yolu -> rapor: eleme', () => {
  it('geri alinan tahsilat toplamlardan tamamen duser', async () => {
    await applyPaymentOperations(
      { id: 'cust1', balance: 0 }, 1500,
      [{ id: 's1', type: 'service', deduct: 1000 }],
      // `desc` sart: `revertPaymentOperations` koleksiyonu `before.desc` varligindan secer
      [{ id: 's1', customerId: 'cust1', desc: 'Muayene', amount: 2000 }], [], 'uid1'
    );

    // Geri alma, odeme gruubunun kendi loglariyla beslenir (uygulamadaki akisin aynisi)
    const paymentLogs = writtenLogs();
    expect(summarize().collected).toBe(1500);

    // Surum kontrolu (TASK-033): geri alinacak borc dokumani var olmali
    seedDoc('serviceDebts/s1', { customerId: 'cust1', desc: 'Muayene', amount: 1000 });
    await revertPaymentOperations({ id: 'cust1', balance: 500 }, paymentLogs, 'Yanlış', 'uid1');

    const s = summarize();
    expect(s.collected).toBe(0);
    expect(s.advanceIn).toBe(0);
    expect(s.unmeasured).toBe(0);   // geri alma loglari olculemeyen sayilmamali
    expect(s.movementCount).toBe(0);
  });

  it('iptal edilen islemin girisi kendi doneminden silinir', async () => {
    await addDebtTransactionOperations('cust1', {
      date: TODAY,
      service: { desc: 'Muayene', amount: 1000 }
    }, 'uid1');

    const entryBatchId = writtenLogs()[0].batchId;
    expect(summarize().debtOpened).toBe(1000);

    seedDoc('serviceDebts/s1', { customerId: 'cust1', amount: 1000 });
    await cancelDebtTransactionOperations(
      'cust1', [{ id: 's1', type: 'service', amount: 1000 }], entryBatchId, 'Hatalı giriş', 'uid1'
    );

    const s = summarize();
    expect(s.debtOpened).toBe(0);
    expect(s.cancelled).toBe(0);      // iptal logu da elenir, cift dusmez
    expect(s.receivableChange).toBe(0);
    expect(s.unmeasured).toBe(0);
  });

  it('kalem iptali girisi silmez, azalis olarak sayilir', async () => {
    await addDebtTransactionOperations('cust1', {
      date: TODAY,
      service: { desc: 'Muayene', amount: 1000 }
    }, 'uid1');

    const debtId = writtenLogs()[0].debtId;

    await cancelDebtItemOperations(
      'cust1', { id: debtId, type: 'service', desc: 'Muayene', amount: 1000 }, 'Kalanı sil', 'uid1'
    );

    const s = summarize();
    expect(s.debtOpened).toBe(1000);
    expect(s.cancelled).toBe(1000);
    expect(s.receivableChange).toBe(0);
  });
});

describe('yazim yolu -> rapor: donem yerlesimi', () => {
  it('gecmis tarihli borc kendi donemine, bugun yapilan tahsilat bugune duser', async () => {
    await addDebtTransactionOperations('cust1', {
      date: '2026-01-20',
      service: { desc: 'Muayene', amount: 1000 }
    }, 'uid1');

    await applyPaymentOperations(
      { id: 'cust1', balance: 0 }, 300,
      [{ id: 's1', type: 'service', deduct: 300 }],
      [{ id: 's1', customerId: 'cust1', amount: 1000 }], [], 'uid1'
    );

    const ocak = summarize({ start: '2026-01-01', end: '2026-01-31' });
    expect(ocak.debtOpened).toBe(1000);
    expect(ocak.collected).toBe(0);

    const bugun = summarize({ start: TODAY, end: TODAY });
    expect(bugun.debtOpened).toBe(0);
    expect(bugun.collected).toBe(300);
  });

  it('enflasyon logu girisin tarihine degil bugune duser', async () => {
    await addDebtTransactionOperations('cust1', {
      date: '2026-01-20',
      drugItems: [item({ id: 'drug1', price: 120 }, 5, 100)],
      applyInflation: true
    }, 'uid1');

    expect(summarize({ start: '2026-01-01', end: '2026-01-31' }).inflation).toBe(0);
    expect(summarize({ start: TODAY, end: TODAY }).inflation).toBe(100);
  });
});
