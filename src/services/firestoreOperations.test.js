import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockBatch, mockDoc, mockCollection, mockAddDoc, mockDeleteDoc, mockUpdateDoc, mockGetDoc, mockRunTransaction, setTransactionSink, seedDoc, resetMocks } from '../test/firebaseMock';
import { todayLocal } from '../utils/dates';
import { computePriceImpact } from '../utils/priceImpact';

// Firebase modulunu mock'la
const mockBatch = createMockBatch();
// Transaction yazmalari da ayni diziye dussun: sets()/updates()/deletes() degismeden calissin
setTransactionSink(mockBatch.operations);

/** Surum kontrollu islemler dokumani okur; var olmayan borc "bayat" sayilir. */
const seedDebts = (...paths) => paths.forEach(p => seedDoc(p, { customerId: 'cust1' }));

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

vi.mock('./firebase', () => ({
  db: { type: 'mock-db' },
}));

// Testlerden once mock'lari sifirla
beforeEach(() => {
  resetMocks();
  mockBatch.operations.length = 0;
  mockBatch.set.mockClear();
  mockBatch.update.mockClear();
  mockBatch.delete.mockClear();
  mockBatch.commit.mockClear();
});

// Simdi modulu import et (mock'lar yerlestirilmis durumda)
const {
  addCustomer,
  addDrug,
  updateDrugPrice,
  returnDrug,
  applyPaymentOperations,
  addDebtTransactionOperations,
  toggleDebtLock,
  toggleBatchLockOperations,
  returnBatchOperations,
  cancelDebtTransactionOperations,
  revertDrugPriceOperations,
  revertPaymentOperations,
  cancelDebtItemOperations,
} = await import('./firestoreOperations');

// Uygulama ile ayni yerel tarih kaynagi; UTC kullanilirsa gece 00:00-03:00
// arasinda "bugun" testleri gecmis borc dalina duserdi.
const TODAY = todayLocal();

/** Ilac kalemi kisayolu */
const item = (drug, qty, unitPrice) => ({ drug, qty, unitPrice });

/** Yalnizca hizmet borcu yazan islem */
const addService = (desc, amount, date = TODAY, extra = {}) =>
  addDebtTransactionOperations('cust1', { date, service: { desc, amount, ...extra } }, 'uid1');

/** Yalnizca ilac kalemi yazan islem */
const addDrugs = (items, date = TODAY, extra = {}) =>
  addDebtTransactionOperations('cust1', { date, drugItems: items, ...extra }, 'uid1');

/** Yazilan borc dokumanlari (log'lar haric) */
const serviceSets = () => mockBatch.operations.filter(op => op.type === 'set' && op.data.desc !== undefined);
const drugSets = () => mockBatch.operations.filter(op => op.type === 'set' && op.data.isFixed !== undefined);

// =============================================
// VALIDASYON TESTLERI
// =============================================

describe('Validasyon', () => {
  it('bos isimle musteri eklemez', async () => {
    await addCustomer('   ');
    expect(mockAddDoc).not.toHaveBeenCalled();
  });

  it('bos isimle ilac eklemez', async () => {
    await addDrug('', 100);
    expect(mockAddDoc).not.toHaveBeenCalled();
  });

  it('sifir veya negatif fiyatla ilac eklemez', async () => {
    await addDrug('TestIlac', 0);
    expect(mockAddDoc).not.toHaveBeenCalled();

    await addDrug('TestIlac', -5);
    expect(mockAddDoc).not.toHaveBeenCalled();
  });

  it('negatif miktarla hizmet borcu eklemez', async () => {
    await addService('Muayene', -100);
    expect(mockBatch.commit).not.toHaveBeenCalled();
  });

  it('bos veya sadece bosluk aciklamayla hizmet borcu eklemez', async () => {
    await addService('   ', 100);
    expect(mockBatch.commit).not.toHaveBeenCalled();
  });

  it('hizmet borcu writeBatch ile ekler ve transaction logu yazar', async () => {
    await addService('Muayene', 150);
    expect(mockBatch.commit).toHaveBeenCalled();
    const sets = mockBatch.operations.filter((op) => op.type === 'set');
    expect(sets.length).toBe(2);
    const log = sets.find((op) => op.data?.title === 'Hizmet Borcu');
    expect(log).toBeDefined();
    expect(log.data.message).toMatch(/Muayene/);
    expect(log.data.customerId).toBe('cust1');
  });

  it('bos payload ile islem yapmaz', async () => {
    await addDebtTransactionOperations('cust1', {}, 'uid1');
    expect(mockBatch.commit).not.toHaveBeenCalled();

    await addDebtTransactionOperations('cust1', { date: TODAY, service: null, drugItems: [] }, 'uid1');
    expect(mockBatch.commit).not.toHaveBeenCalled();
  });

  it('hizmet kalemi gerekceyle iptal edilir', async () => {
    const item = { id: 'sd1', type: 'service', desc: 'Muayene', amount: 500 };
    await cancelDebtItemOperations('cust1', item, 'Yanlış girildi', 'uid1');

    expect(mockBatch.commit).toHaveBeenCalled();
    const cancelLog = mockBatch.operations.find((op) => op.data?.title === 'Hizmet Borcu İptali');
    expect(cancelLog.data.userId).toBe('uid1');
    expect(cancelLog.data.message).toMatch(/Yanlış girildi/);
    expect(mockBatch.operations.some((op) => op.ref?.path === 'serviceDebts/sd1' && op.type === 'delete')).toBe(true);
  });

  it('ilac kalemi gerekceyle iptal edilir ve dogru koleksiyondan silinir', async () => {
    const item = { id: 'dd1', type: 'drug', drugId: 'drug1', drugName: 'Amoksisilin', qty: 2, maxPrice: 100 };
    await cancelDebtItemOperations('cust1', item, 'Yanlış ilaç', 'uid1');

    const cancelLog = mockBatch.operations.find((op) => op.data?.title === 'İlaç Borcu İptali');
    expect(cancelLog.data.drugId).toBe('drug1');
    expect(cancelLog.data.message).toMatch(/Amoksisilin/);
    expect(mockBatch.operations.some((op) => op.ref?.path === 'drugDebts/dd1' && op.type === 'delete')).toBe(true);
  });

  it('kalem iptal logu batchId tasimaz — ayni islemdeki diger kalemler etkilenmez', async () => {
    const item = { id: 'dd1', type: 'drug', drugId: 'drug1', qty: 1, maxPrice: 100, batchId: 'b1' };
    await cancelDebtItemOperations('cust1', item, 'Hatalı', 'uid1');

    const cancelLog = mockBatch.operations.find((op) => op.data?.kind === 'cancel');
    expect(cancelLog.data.batchId).toBeUndefined();
    expect(cancelLog.data.debtId).toBe('dd1');
  });

  it('gerekce yoksa kalem iptali islem yapmaz', async () => {
    expect(await cancelDebtItemOperations('cust1', { id: 'dd1', type: 'drug' }, '  ', 'uid1')).toBe(false);
    expect(mockBatch.commit).not.toHaveBeenCalled();
  });

  it('negatif miktarla ilac borcu eklemez', async () => {
    await addDrugs([item({ id: 'd1', price: 50 }, -2, 50)], '2026-08-12');
    expect(mockBatch.commit).not.toHaveBeenCalled();
  });

  it('bos kalem listesiyle islem yapmaz', async () => {
    await addDrugs([], '2026-08-12');
    expect(mockBatch.commit).not.toHaveBeenCalled();
  });
});

// =============================================
// FIYAT GUNCELLEME (ENFLASYON KORUMASI) TESTLERI
// =============================================

describe('Fiyat Guncelleme (Enflasyon Korumasi)', () => {
  it('fiyat artisinda sabitlenmemis borclarin maxPrice degerini gunceller', async () => {
    const debts = [
      { id: 'debt1', drugId: 'drug1', qty: 10, maxPrice: 50, isFixed: false },
    ];

    await updateDrugPrice('drug1', 75, debts);

    expect(mockBatch.commit).toHaveBeenCalled();
    // ilac fiyat update + borc maxPrice update + log = 3 islem
    const updates = mockBatch.operations.filter(op => op.type === 'update');
    expect(updates.length).toBe(2); // ilac + borc
    const logs = mockBatch.operations.filter(op => op.type === 'set');
    expect(logs.length).toBe(1); // zam logu
  });

  it('fiyat artisinda sabitlenmis borclari etkilemez', async () => {
    const debts = [
      { id: 'debt1', drugId: 'drug1', qty: 10, maxPrice: 50, isFixed: true },
    ];

    await updateDrugPrice('drug1', 75, debts);

    expect(mockBatch.commit).toHaveBeenCalled();
    // sadece ilac fiyat update — borc dokunulmaz
    const updates = mockBatch.operations.filter(op => op.type === 'update');
    expect(updates.length).toBe(1); // sadece ilac
    const logs = mockBatch.operations.filter(op => op.type === 'set');
    expect(logs.length).toBe(0); // log yok
  });

  it('fiyat dususunde mevcut borclari etkilemez', async () => {
    const debts = [
      { id: 'debt1', drugId: 'drug1', qty: 10, maxPrice: 50, isFixed: false },
    ];

    await updateDrugPrice('drug1', 30, debts);

    expect(mockBatch.commit).toHaveBeenCalled();
    // sadece ilac fiyat update — borc maxPrice degismez
    const updates = mockBatch.operations.filter(op => op.type === 'update');
    expect(updates.length).toBe(1); // sadece ilac
  });

  it('farkli ilaclarin borclarini etkilemez', async () => {
    const debts = [
      { id: 'debt1', drugId: 'drug2', qty: 5, maxPrice: 100, isFixed: false },
    ];

    await updateDrugPrice('drug1', 200, debts);

    // drug2 borcuna dokunulmamali
    const updates = mockBatch.operations.filter(op => op.type === 'update');
    expect(updates.length).toBe(1); // sadece drug1 fiyat update
  });
});

// =============================================
// IADE TESTLERI
// =============================================

describe('Ilac Iade Islemleri', () => {
  it('normal iade — borctan duser', async () => {
    const debt = { id: 'debt1', customerId: 'cust1', qty: 10, maxPrice: 50 };

    await returnDrug(debt, 3, 0);

    expect(mockBatch.commit).toHaveBeenCalled();
    const updates = mockBatch.operations.filter(op => op.type === 'update');
    expect(updates.length).toBe(1);
    expect(updates[0].data.qty).toBe(7); // 10 - 3
  });

  it('sweeper — kalan 10 TL altinda ise borcu siler', async () => {
    const debt = { id: 'debt1', customerId: 'cust1', qty: 2, maxPrice: 8 };
    // 2 adet * 8 TL = 16 TL. 1 adet iade = kalan 1 * 8 = 8 TL < 10 TL → sweep

    await returnDrug(debt, 1, 0);

    expect(mockBatch.commit).toHaveBeenCalled();
    const deletes = mockBatch.operations.filter(op => op.type === 'delete');
    expect(deletes.length).toBe(1); // borc silindi
    const logs = mockBatch.operations.filter(op => op.type === 'set');
    expect(logs.length).toBe(2); // iade logu + supurucu logu
  });

  it('fazla iade — borc kapanir, fazlasi avansa yazilir', async () => {
    const debt = { id: 'debt1', customerId: 'cust1', qty: 3, maxPrice: 100 };

    await returnDrug(debt, 5, 200); // 5 iade ama 3 borc var → 2 fazla

    expect(mockBatch.commit).toHaveBeenCalled();
    const deletes = mockBatch.operations.filter(op => op.type === 'delete');
    expect(deletes.length).toBe(1); // borc silindi

    const updates = mockBatch.operations.filter(op => op.type === 'update');
    expect(updates.length).toBe(1); // musteri balance update
    expect(updates[0].data.balance).toBe(400); // 200 mevcut + 2 * 100 = 400
  });

  it('sifir veya negatif iade miktari kabul etmez', async () => {
    const debt = { id: 'debt1', customerId: 'cust1', qty: 5, maxPrice: 50 };

    await returnDrug(debt, 0, 0);
    expect(mockBatch.commit).not.toHaveBeenCalled();

    await returnDrug(debt, -3, 0);
    expect(mockBatch.commit).not.toHaveBeenCalled();
  });
});

// =============================================
// WATERFALL TAHSILAT TESTLERI
// =============================================

describe('Waterfall Tahsilat Dagitimi', () => {
  const customer = { id: 'cust1', balance: 0 };

  it('once hizmet borclarini kapatir', async () => {
    const serviceDebts = [
      { id: 'sd1', amount: 100 },
      { id: 'sd2', amount: 200 },
    ];
    const drugDebts = [];

    const dist = [
      { type: 'service', id: 'sd1', deduct: 100 },
      { type: 'service', id: 'sd2', deduct: 200 },
    ];

    await applyPaymentOperations(customer, 300, dist, serviceDebts, drugDebts);

    expect(mockBatch.commit).toHaveBeenCalled();
    // iki hizmet borcu silinmeli (amount - deduct <= 10)
    const deletes = mockBatch.operations.filter(op => op.type === 'delete');
    expect(deletes.length).toBe(2);
  });

  it('hizmet borcundan kalan kismi gunceller', async () => {
    const serviceDebts = [{ id: 'sd1', amount: 500 }];
    const drugDebts = [];

    const dist = [{ type: 'service', id: 'sd1', deduct: 200 }];

    await applyPaymentOperations(customer, 200, dist, serviceDebts, drugDebts);

    const updates = mockBatch.operations.filter(op => op.type === 'update');
    // sd1 amount update + customer balance update = 2
    const debtUpdate = updates.find(op => op.data.amount !== undefined);
    expect(debtUpdate.data.amount).toBe(300); // 500 - 200
  });

  it('ilac borcunu oransal dagitir ve qty gunceller', async () => {
    const serviceDebts = [];
    const drugDebts = [
      { id: 'dd1', qty: 10, maxPrice: 50 },  // 500 TL
      { id: 'dd2', qty: 5, maxPrice: 100 },   // 500 TL
    ];

    // 250 TL dagitim: dd1'e 125, dd2'ye 125
    const dist = [
      { type: 'drug', id: 'dd1', deduct: 125 },
      { type: 'drug', id: 'dd2', deduct: 125 },
    ];

    await applyPaymentOperations(customer, 250, dist, serviceDebts, drugDebts);

    expect(mockBatch.commit).toHaveBeenCalled();

    const updates = mockBatch.operations.filter(op => op.type === 'update' && op.data.qty !== undefined);
    expect(updates.length).toBe(2);

    // dd1: 125 / 50 = 2.5 adet dusuldu → 10 - 2.5 = 7.5
    expect(updates[0].data.qty).toBe(7.5);
    // dd2: 125 / 100 = 1.25 adet dusuldu → 5 - 1.25 = 3.75
    expect(updates[1].data.qty).toBe(3.75);
  });

  it('sweeper — ilac borcunun kalani 10 TL altinda ise siler', async () => {
    const serviceDebts = [];
    const drugDebts = [{ id: 'dd1', qty: 2, maxPrice: 50 }]; // 100 TL

    // 95 TL odeme → kalan 5 TL < 10 TL → sweep
    const dist = [{ type: 'drug', id: 'dd1', deduct: 95 }];

    await applyPaymentOperations(customer, 95, dist, serviceDebts, drugDebts);

    const deletes = mockBatch.operations.filter(op => op.type === 'delete');
    expect(deletes.length).toBe(1); // borc silindi

    // supurucu logu yazilmali
    const logs = mockBatch.operations.filter(op => op.type === 'set' && op.data.title?.includes('Süpürücü'));
    expect(logs.length).toBe(1);
  });

  it('artan para avansa yazilir', async () => {
    const customerWithBalance = { id: 'cust1', balance: 50 };
    const serviceDebts = [];
    const drugDebts = [];

    // Borc yok, 200 TL odeme + 50 avans = 250 TL avansa yazilir
    const dist = [];

    await applyPaymentOperations(customerWithBalance, 200, dist, serviceDebts, drugDebts);

    const updates = mockBatch.operations.filter(op => op.type === 'update');
    expect(updates.length).toBe(1); // balance update
    expect(updates[0].data.balance).toBe(250); // 50 + 200
  });

  it('negatif odeme kabul etmez', async () => {
    await applyPaymentOperations(customer, -100, [], [], []);
    expect(mockBatch.commit).not.toHaveBeenCalled();
  });

  it('hizmet borcu tahsilatinda log yazar', async () => {
    const serviceDebts = [{ id: 'sd1', amount: 500 }];
    const dist = [{ type: 'service', id: 'sd1', deduct: 200 }];
    await applyPaymentOperations(customer, 200, dist, serviceDebts, []);

    const logs = mockBatch.operations.filter(op => op.type === 'set' && op.data.title === 'Tahsilat');
    expect(logs.length).toBe(1);
    expect(logs[0].data.message).toMatch(/200/);

    const sweeps = mockBatch.operations.filter(op => op.type === 'set' && op.data.title?.includes('Süpürücü'));
    expect(sweeps.length).toBe(0);
  });

  it('hizmet borcu tahsilatinda supurucu tetiklenir (kalan <= 10 TL)', async () => {
    const serviceDebts = [{ id: 'sd1', amount: 100 }];
    const dist = [{ type: 'service', id: 'sd1', deduct: 95 }];
    await applyPaymentOperations(customer, 95, dist, serviceDebts, []);

    const logs = mockBatch.operations.filter(op => op.type === 'set' && op.data.title === 'Tahsilat');
    expect(logs.length).toBe(1);
    const sweeps = mockBatch.operations.filter(op => op.type === 'set' && op.data.title?.includes('Süpürücü'));
    expect(sweeps.length).toBe(1);
  });

  it('tam hizmet tahsilatinda supurucu yazilmaz', async () => {
    const serviceDebts = [{ id: 'sd1', amount: 200 }];
    const dist = [{ type: 'service', id: 'sd1', deduct: 200 }];
    await applyPaymentOperations(customer, 200, dist, serviceDebts, []);

    const sweeps = mockBatch.operations.filter(op => op.type === 'set' && op.data.title?.includes('Süpürücü'));
    expect(sweeps.length).toBe(0);
  });

  it('floating point hassasiyeti korunur', async () => {
    const serviceDebts = [];
    const drugDebts = [{ id: 'dd1', qty: 3, maxPrice: 33.3 }]; // 99.9 TL

    // 50 TL odeme
    const dist = [{ type: 'drug', id: 'dd1', deduct: 50 }];

    await applyPaymentOperations(customer, 50, dist, serviceDebts, drugDebts);

    const updates = mockBatch.operations.filter(op => op.type === 'update' && op.data.qty !== undefined);
    expect(updates.length).toBe(1);
    // 50 / 33.3 = 1.5015... → rounded to 1.5
    // 3 - 1.5 = 1.5 (temiz)
    const newQty = updates[0].data.qty;
    // Float hassasiyeti: en fazla 2 ondalik
    expect(newQty).toBe(Math.round(newQty * 100) / 100);
  });
});

// =============================================
// ILAC BORCU EKLEME TESTLERI
// =============================================

describe('Ilac Borcu Ekleme (Toplu)', () => {
  it('ilac borcu ekler ve log yazar', async () => {
    const drug = { id: 'drug1', price: 120 };

    await addDrugs([item(drug, 5, 120)]);

    expect(mockBatch.commit).toHaveBeenCalled();
    const sets = mockBatch.operations.filter(op => op.type === 'set');
    expect(sets.length).toBe(2); // borc + log

    const debtOp = drugSets()[0];
    expect(debtOp.data.customerId).toBe('cust1');
    expect(debtOp.data.drugId).toBe('drug1');
    expect(debtOp.data.qty).toBe(5);
    expect(debtOp.data.maxPrice).toBe(120);
    expect(debtOp.data.isFixed).toBe(false);

    const log = mockBatch.operations.find(op => op.data?.title === 'Borç Açıldı');
    expect(log).toBeDefined();
  });

  it('tek cagridaki tum kalemler ayni batchId ve createdAt tasir', async () => {
    const items = [
      item({ id: 'drug1', price: 100 }, 2, 100),
      item({ id: 'drug2', price: 200 }, 1, 200),
      item({ id: 'drug3', price: 50 }, 4, 50)
    ];

    await addDrugs(items);

    const debts = drugSets();
    expect(debts.length).toBe(3);

    const batchIds = new Set(debts.map(op => op.data.batchId));
    expect(batchIds.size).toBe(1);
    expect([...batchIds][0]).toBeTruthy();

    const createdAts = new Set(debts.map(op => op.data.createdAt));
    expect(createdAts.size).toBe(1);
    expect(typeof [...createdAts][0]).toBe('number');
  });

  it('iki ayri cagri farkli batchId uretir', async () => {
    const drug = { id: 'drug1', price: 100 };

    await addDrugs([item(drug, 2, 100)]);
    const first = drugSets()[0].data.batchId;

    mockBatch.operations.length = 0;
    await addDrugs([item(drug, 3, 100)]);
    const second = drugSets()[0].data.batchId;

    expect(first).toBeTruthy();
    expect(second).toBeTruthy();
    expect(first).not.toBe(second);
  });

  it('supurulen kalem yazilmaz, kalan kalemler ayni batchId yi korur', async () => {
    // Toplam 2000 TL, 1960 TL tahsilat oransal dagitilir (kalanlar: 20 / 10 / 10 TL).
    // 10 TL ve alti supurulur → yalnizca ilk kalem yazilir.
    const items = [
      item({ id: 'drug1', price: 100 }, 10, 100), // 1000 → kalan 20 TL
      item({ id: 'drug2', price: 100 }, 5, 100),  // 500  → kalan 10 TL (supurulur)
      item({ id: 'drug3', price: 100 }, 5, 100)   // 500  → kalan 10 TL (supurulur)
    ];

    await addDrugs(items, '2026-01-20', { drugPaidAmount: 1960, drugPaidDate: '2026-01-25' });

    const debts = drugSets();
    expect(debts.length).toBe(1);
    expect(debts[0].data.drugId).toBe('drug1');
    expect(debts[0].data.qty).toBe(0.2);
    expect(debts[0].data.batchId).toBeTruthy();

    const sweepLogs = mockBatch.operations.filter(op => op.data?.title === 'Süpürücü (Silindi)');
    expect(sweepLogs.length).toBe(2);
  });

  it('bugunun tarihinde Borc Acildi, gecmis tarihte Gecmis Ilac Borcu logu yazar', async () => {
    const drug = { id: 'drug1', price: 100 };

    await addDrugs([item(drug, 2, 100)]);
    expect(mockBatch.operations.some(op => op.data?.title === 'Borç Açıldı')).toBe(true);

    mockBatch.operations.length = 0;
    await addDrugs([item(drug, 2, 100)], '2026-01-20');
    const pastLog = mockBatch.operations.find(op => op.data?.title === 'Geçmiş İlaç Borcu');
    expect(pastLog).toBeDefined();
    expect(pastLog.data.date).toBe('2026-01-20'); // dateOverride
  });
});

// =============================================
// KARMA ISLEM (HIZMET + ILAC) TESTLERI
// =============================================

describe('Karma Islem (Hizmet + Ilac)', () => {
  it('hizmet ve ilac ayni batchId ile tek commit icinde yazilir', async () => {
    await addDebtTransactionOperations('cust1', {
      date: TODAY,
      service: { desc: 'Muayene', amount: 500 },
      drugItems: [
        item({ id: 'drug1', price: 100 }, 2, 100),
        item({ id: 'drug2', price: 200 }, 1, 200)
      ]
    }, 'uid1');

    // Atomiklik: tek commit
    expect(mockBatch.commit).toHaveBeenCalledTimes(1);

    const svc = serviceSets();
    const drugsWritten = drugSets();
    expect(svc.length).toBe(1);
    expect(drugsWritten.length).toBe(2);

    const batchIds = new Set([...svc, ...drugsWritten].map(op => op.data.batchId));
    expect(batchIds.size).toBe(1);
    expect([...batchIds][0]).toBeTruthy();

    const createdAts = new Set([...svc, ...drugsWritten].map(op => op.data.createdAt));
    expect(createdAts.size).toBe(1);
  });

  it('yalnizca hizmet girilirse ilac borcu yazilmaz', async () => {
    await addDebtTransactionOperations('cust1', {
      date: TODAY,
      service: { desc: 'Muayene', amount: 500 },
      drugItems: []
    }, 'uid1');

    expect(serviceSets().length).toBe(1);
    expect(drugSets().length).toBe(0);
  });

  it('yalnizca ilac girilirse hizmet borcu yazilmaz', async () => {
    await addDebtTransactionOperations('cust1', {
      date: TODAY,
      service: null,
      drugItems: [item({ id: 'drug1', price: 100 }, 2, 100)]
    }, 'uid1');

    expect(serviceSets().length).toBe(0);
    expect(drugSets().length).toBe(1);
  });

  it('gecersiz hizmet girisi gecerli ilac kalemlerini engellemez', async () => {
    await addDebtTransactionOperations('cust1', {
      date: TODAY,
      service: { desc: '   ', amount: 0 }, // gecersiz
      drugItems: [item({ id: 'drug1', price: 100 }, 2, 100)]
    }, 'uid1');

    expect(mockBatch.commit).toHaveBeenCalledTimes(1);
    expect(serviceSets().length).toBe(0);
    expect(drugSets().length).toBe(1);
  });

  it('gecmis karma islemde her iki bolum de kendi tahsilatini uygular', async () => {
    await addDebtTransactionOperations('cust1', {
      date: '2026-02-15',
      service: { desc: 'Muayene', amount: 500, paidAmount: 200, paidDate: '2026-02-20' },
      drugItems: [item({ id: 'drug1', price: 100 }, 4, 100)],
      drugPaidAmount: 100,
      drugPaidDate: '2026-02-20'
    }, 'uid1');

    const svc = serviceSets()[0];
    expect(svc.data.amount).toBe(300); // 500 - 200
    expect(svc.data.date).toBe('2026-02-15');

    const drugDebt = drugSets()[0];
    expect(drugDebt.data.qty).toBe(3); // 4 - (100/100)

    // Gecmis mod log basliklari
    expect(mockBatch.operations.some(op => op.data?.title === 'Geçmiş Hizmet Borcu')).toBe(true);
    expect(mockBatch.operations.some(op => op.data?.title === 'Geçmiş İlaç Borcu')).toBe(true);
    expect(mockBatch.operations.filter(op => op.data?.title === 'Geçmiş Tahsilat').length).toBe(2);
  });

  it('karma islemde ilac tarafi supurulse bile hizmet borcu yazilir', async () => {
    await addDebtTransactionOperations('cust1', {
      date: '2026-03-01',
      service: { desc: 'Muayene', amount: 500 },
      drugItems: [item({ id: 'drug1', price: 50 }, 2, 50)],
      drugPaidAmount: 95,
      drugPaidDate: '2026-03-05'
    }, 'uid1');

    expect(serviceSets().length).toBe(1);
    expect(drugSets().length).toBe(0); // kalan 5 TL supuruldu
    expect(mockBatch.operations.some(op => op.data?.title === 'Süpürücü (Silindi)')).toBe(true);
  });
});

// =============================================
// GECMIS HIZMET BORCU TESTLERI
// =============================================

describe('Gecmis Hizmet Borcu', () => {
  it('gecmis tarihli hizmet borcu olusturur', async () => {
    await addService('Muayene', 500, '2026-01-15');

    expect(mockBatch.commit).toHaveBeenCalled();
    const sets = mockBatch.operations.filter(op => op.type === 'set');
    expect(sets.length).toBe(2); // borc + log

    const debtOp = serviceSets()[0];
    expect(debtOp.data.amount).toBe(500);
    expect(debtOp.data.date).toBe('2026-01-15');
    expect(debtOp.data.userId).toBe('uid1');
    expect(debtOp.data.batchId).toBeTruthy();
    expect(typeof debtOp.data.createdAt).toBe('number');
  });

  it('tahsilatli hizmet borcu: kalan dogru hesaplanir', async () => {
    await addService('Asılama', 300, '2026-02-10', { paidAmount: 100, paidDate: '2026-02-20' });

    const sets = mockBatch.operations.filter(op => op.type === 'set');
    expect(sets.length).toBe(3); // borc + 2 log (olusturma + tahsilat)

    expect(serviceSets()[0].data.amount).toBe(200); // 300 - 100
  });

  it('supurucu: kalan <= 10 TL ise borc olusturulmaz', async () => {
    await addService('Kontrol', 100, '2026-03-01', { paidAmount: 95, paidDate: '2026-03-10' });

    const sets = mockBatch.operations.filter(op => op.type === 'set');
    // kalan 5 TL <= 10 TL → borc yok, sadece loglar (olusturma + tahsilat + supurucu)
    expect(serviceSets().length).toBe(0);
    expect(sets.length).toBe(3); // 3 log
  });

  it('validasyon: paidAmount >= amount ise islem yapmaz', async () => {
    await addService('Muayene', 500, '2026-01-15', { paidAmount: 500, paidDate: '2026-01-20' });
    expect(mockBatch.commit).not.toHaveBeenCalled();
  });
});

// =============================================
// GECMIS ILAC BORCU TESTLERI
// =============================================

describe('Gecmis Ilac Borcu', () => {
  it('ozel birim fiyatla ilac borcu olusturur', async () => {
    const drug = { id: 'drug1', price: 90 };
    await addDrugs([item(drug, 4, 75)], '2026-01-20');

    expect(mockBatch.commit).toHaveBeenCalled();
    const sets = mockBatch.operations.filter(op => op.type === 'set');
    expect(sets.length).toBe(2); // borc + log

    const debtOp = drugSets()[0];
    expect(debtOp.data.qty).toBe(4);
    expect(debtOp.data.maxPrice).toBe(75);
    expect(debtOp.data.date).toBe('2026-01-20');
  });

  it('tahsilatli ilac borcu: adet kusuratli olabilir', async () => {
    const drug = { id: 'drug1', price: 90 };
    // 4 adet × 75 = 300, 100 TL tahsilat → 100/75 = 1.33 adet düşülür, kalan 2.67
    await addDrugs([item(drug, 4, 75)], '2026-02-15', { drugPaidAmount: 100, drugPaidDate: '2026-02-25' });

    const debtOp = drugSets()[0];
    expect(debtOp.data.qty).toBe(2.67); // 4 - 1.33
    expect(debtOp.data.maxPrice).toBe(75); // enflasyon yok
  });

  it('enflasyon uygulandiginda maxPrice guncellenir', async () => {
    const drug = { id: 'drug1', price: 90 };
    await addDrugs([item(drug, 4, 75)], '2026-02-15', { applyInflation: true });

    const sets = mockBatch.operations.filter(op => op.type === 'set');
    expect(sets.length).toBe(3); // borc + log + enflasyon log

    const debtOp = drugSets()[0];
    expect(debtOp.data.maxPrice).toBe(90); // guncel fiyat
    expect(debtOp.data.qty).toBe(4); // adet degismez
  });

  it('tahsilat + enflasyon kombine: once tahsilat sonra enflasyon', async () => {
    const drug = { id: 'drug1', price: 90 };
    // 4×75=300, 100 tahsilat → kalan 2.67 adet, sonra enflasyon 90 TL/adet
    await addDrugs([item(drug, 4, 75)], '2026-02-15', { drugPaidAmount: 100, drugPaidDate: '2026-02-25', applyInflation: true });

    const debtOp = drugSets()[0];
    expect(debtOp.data.qty).toBe(2.67);
    expect(debtOp.data.maxPrice).toBe(90);
  });

  it('supurucu: tahsilat sonrasi kalan <= 10 TL ise borc olusturulmaz', async () => {
    const drug = { id: 'drug1', price: 90 };
    // 2×50=100, 95 tahsilat → kalan 0.1 adet (5 TL) ≤ 10
    await addDrugs([item(drug, 2, 50)], '2026-03-01', { drugPaidAmount: 95, drugPaidDate: '2026-03-05' });

    const sets = mockBatch.operations.filter(op => op.type === 'set');
    expect(drugSets().length).toBe(0); // borc olusturulmadi
    expect(sets.length).toBe(3); // 3 log (olusturma + tahsilat + supurucu)
  });

  it('guncel fiyat <= birim fiyat ise enflasyon uygulanmaz', async () => {
    const drug = { id: 'drug1', price: 60 }; // guncel fiyat < birim fiyat
    await addDrugs([item(drug, 4, 75)], '2026-02-15', { applyInflation: true });

    const sets = mockBatch.operations.filter(op => op.type === 'set');
    expect(sets.length).toBe(2); // sadece borc + log (enflasyon logu yok)

    const debtOp = drugSets()[0];
    expect(debtOp.data.maxPrice).toBe(75); // degismedi
  });

  it('validasyon: qty <= 0 ise islem yapmaz', async () => {
    const drug = { id: 'drug1', price: 90 };
    await addDrugs([item(drug, 0, 75)], '2026-01-20');
    expect(mockBatch.commit).not.toHaveBeenCalled();
  });

  it('validasyon: paidAmount >= grandTotal ise islem yapmaz', async () => {
    const drug = { id: 'drug1', price: 90 };
    // 4 × 75 = 300, tahsilat 300 → tam odeme, borc olusturulmamali
    await addDrugs([item(drug, 4, 75)], '2026-01-20', { drugPaidAmount: 300, drugPaidDate: '2026-01-25' });
    expect(mockBatch.commit).not.toHaveBeenCalled();
  });

  it('gecersiz satirlar yok sayilir, gecerli satirlar yazilir', async () => {
    await addDrugs([
      { drug: null, qty: 2, unitPrice: 100 },              // ilac secilmemis
      item({ id: 'drug1', price: 100 }, 0, 100),           // adet yok
      item({ id: 'drug2', price: 100 }, 3, 100)            // gecerli
    ], '2026-01-20');

    const debts = drugSets();
    expect(debts.length).toBe(1);
    expect(debts[0].data.drugId).toBe('drug2');
    expect(debts[0].data.qty).toBe(3);
  });
});

// =============================================
// GRUP (BATCH) OPERASYONLARI TESTLERI
// =============================================

const batchDebt = (over = {}) => ({
  id: 'debt1', customerId: 'cust1', drugId: 'drug1',
  qty: 5, maxPrice: 100, isFixed: false, batchId: 'b1', ...over
});

describe('Grup Kilidi (toggleBatchLockOperations)', () => {
  it('karisik durumda tum kalemleri sabitler, log yalnizca degisenler icin yazilir', async () => {
    const debts = [
      batchDebt({ id: 'a', isFixed: true }),
      batchDebt({ id: 'b', isFixed: false }),
      batchDebt({ id: 'c', isFixed: false })
    ];

    await toggleBatchLockOperations(debts, 'uid1');

    const updates = mockBatch.operations.filter(op => op.type === 'update');
    expect(updates.length).toBe(2); // zaten sabit olan 'a' atlandi
    expect(updates.every(op => op.data.isFixed === true)).toBe(true);

    const logs = mockBatch.operations.filter(op => op.type === 'set');
    expect(logs.length).toBe(2);
    expect(logs.every(op => op.data.title === 'Fiyat Sabitlendi')).toBe(true);
    expect(logs[0].data.userId).toBe('uid1');
  });

  it('hepsi sabitse tum kalemleri serbest birakir', async () => {
    const debts = [
      batchDebt({ id: 'a', isFixed: true }),
      batchDebt({ id: 'b', isFixed: true })
    ];

    await toggleBatchLockOperations(debts, 'uid1');

    const updates = mockBatch.operations.filter(op => op.type === 'update');
    expect(updates.length).toBe(2);
    expect(updates.every(op => op.data.isFixed === false)).toBe(true);

    const logs = mockBatch.operations.filter(op => op.type === 'set');
    expect(logs.every(op => op.data.title === 'Sabitleme Kaldırıldı')).toBe(true);
  });

  it('bos listede islem yapmaz', async () => {
    await toggleBatchLockOperations([], 'uid1');
    expect(mockBatch.commit).not.toHaveBeenCalled();
  });
});

describe('Grup Iadesi (returnBatchOperations)', () => {
  it('yalnizca secili kalemleri iade eder, digerlerine dokunmaz', async () => {
    const a = batchDebt({ id: 'a', qty: 5, maxPrice: 100 });
    const b = batchDebt({ id: 'b', qty: 4, maxPrice: 100 });

    // 'a'dan 2 adet iade (kalan 3 adet = 300 TL), 'b' secilmedi
    await returnBatchOperations([{ debt: a, returnQty: 2 }], 0, 'uid1');

    expect(mockBatch.commit).toHaveBeenCalled();
    const updates = mockBatch.operations.filter(op => op.type === 'update');
    expect(updates.length).toBe(1);
    expect(updates[0].data.qty).toBe(3);

    expect(mockBatch.operations.filter(op => op.type === 'delete').length).toBe(0);
    expect(b.qty).toBe(4); // dokunulmadi
  });

  it('birden fazla kalemi tek batch icinde iade eder', async () => {
    const items = [
      { debt: batchDebt({ id: 'a', qty: 5, maxPrice: 100 }), returnQty: 5 }, // tam iade → delete
      { debt: batchDebt({ id: 'b', qty: 4, maxPrice: 100 }), returnQty: 1 }  // kismi → update
    ];

    await returnBatchOperations(items, 0, 'uid1');

    expect(mockBatch.commit).toHaveBeenCalledTimes(1);
    expect(mockBatch.operations.filter(op => op.type === 'delete').length).toBe(1);
    const updates = mockBatch.operations.filter(op => op.type === 'update');
    expect(updates.length).toBe(1);
    expect(updates[0].data.qty).toBe(3);

    const returnLogs = mockBatch.operations.filter(op => op.data?.title === 'İade İşlemi');
    expect(returnLogs.length).toBe(2);
  });

  it('kalan 10 TL altina duserse supurucu devreye girer', async () => {
    const a = batchDebt({ id: 'a', qty: 5, maxPrice: 100 });

    // 4.95 adet iade → kalan 0.05 adet = 5 TL ≤ 10
    await returnBatchOperations([{ debt: a, returnQty: 4.95 }], 0, 'uid1');

    expect(mockBatch.operations.filter(op => op.type === 'delete').length).toBe(1);
    expect(mockBatch.operations.some(op => op.data?.title === 'Süpürücü (Silindi)')).toBe(true);
  });

  it('fazla iadede tek customers update yazar ve avanslar birikir', async () => {
    const items = [
      { debt: batchDebt({ id: 'a', qty: 2, maxPrice: 100 }), returnQty: 3 }, // 1 fazla → 100 TL
      { debt: batchDebt({ id: 'b', qty: 1, maxPrice: 50 }), returnQty: 3 }   // 2 fazla → 100 TL
    ];

    await returnBatchOperations(items, 25, 'uid1');

    const customerUpdates = mockBatch.operations.filter(
      op => op.type === 'update' && op.data.balance !== undefined
    );
    expect(customerUpdates.length).toBe(1);
    expect(customerUpdates[0].data.balance).toBe(225); // 25 + 100 + 100

    const refundLogs = mockBatch.operations.filter(op => op.data?.title === 'Fazla İade (Avans)');
    expect(refundLogs.length).toBe(2);
  });

  it('fazla iade yoksa customers dokumanina dokunmaz', async () => {
    const a = batchDebt({ id: 'a', qty: 5, maxPrice: 100 });
    await returnBatchOperations([{ debt: a, returnQty: 2 }], 500, 'uid1');

    const customerUpdates = mockBatch.operations.filter(
      op => op.type === 'update' && op.data.balance !== undefined
    );
    expect(customerUpdates.length).toBe(0);
  });

  it('bos veya gecersiz listede islem yapmaz', async () => {
    await returnBatchOperations([], 0, 'uid1');
    expect(mockBatch.commit).not.toHaveBeenCalled();

    await returnBatchOperations([{ debt: batchDebt(), returnQty: 0 }], 0, 'uid1');
    expect(mockBatch.commit).not.toHaveBeenCalled();
  });
});

// =============================================
// LOG META ALANLARI (batchId + kind) — TASK-031
// =============================================

describe('log meta alanlari', () => {
  const logOps = () => mockBatch.operations.filter(op => op.type === 'set' && op.data.title !== undefined);

  it('giris yolundaki tum loglar islemin batchId sini ve kind entry tasir', async () => {
    // Gecmis tarihli, kismi tahsilatli, enflasyonlu karma islem: giris yolunun tum log
    // cesitlerini (borc, tahsilat, enflasyon) tek cagride uretir
    await addDebtTransactionOperations('cust1', {
      date: '2026-01-20',
      service: { desc: 'Muayene', amount: 500, paidAmount: 100, paidDate: '2026-01-21' },
      drugItems: [item({ id: 'drug1', price: 200 }, 5, 100)],
      drugPaidAmount: 200,
      drugPaidDate: '2026-01-21',
      applyInflation: true
    }, 'uid1');

    const logs = logOps();
    expect(logs.length).toBeGreaterThan(3);

    const batchIds = new Set(logs.map(op => op.data.batchId));
    expect(batchIds.size).toBe(1);
    expect([...batchIds][0]).toBeTruthy();
    expect(logs.every(op => op.data.kind === 'entry')).toBe(true);

    // Borc dokumanlari da ayni batchId yi tasir — guard ikisini eslestiriyor
    const debtBatchId = drugSets()[0].data.batchId;
    expect([...batchIds][0]).toBe(debtBatchId);
  });

  it('gecmis giriste supurucu logu tahsilat tarihini tasir', async () => {
    // Supurucu, gomulu tahsilatin sonucudur; anlattigi olay o tahsilatla ayni gun olmustur.
    // Bugunun tarihini yazmak ayni islemin satirlarini ekstrede farkli gunlere dagitirdi.
    await addDebtTransactionOperations('cust1', {
      date: '2026-01-20',
      service: { desc: 'Muayene', amount: 1000, paidAmount: 995, paidDate: '2026-01-22' }
    }, 'uid1');

    const sweep = logOps().find(op => op.data.title === 'Süpürücü (Silindi)');
    const payment = logOps().find(op => op.data.title === 'Geçmiş Tahsilat');

    expect(sweep.data.date).toBe('2026-01-22');
    expect(sweep.data.date).toBe(payment.data.date);
    expect(sweep.data.date).not.toBe(TODAY);
  });

  it('ilac dalinda da supurucu tahsilat tarihini tasir', async () => {
    await addDebtTransactionOperations('cust1', {
      date: '2026-01-20',
      drugItems: [item({ id: 'drug1', price: 100 }, 10, 100)],
      drugPaidAmount: 995,
      drugPaidDate: '2026-01-22'
    }, 'uid1');

    const sweep = logOps().find(op => op.data.title === 'Süpürücü (Silindi)');
    expect(sweep.data.date).toBe('2026-01-22');
  });

  it('tahsilat tarihi verilmemisse supurucu islem tarihine duser', async () => {
    await addDebtTransactionOperations('cust1', {
      date: '2026-01-20',
      service: { desc: 'Muayene', amount: 1000, paidAmount: 995 }
    }, 'uid1');

    const sweep = logOps().find(op => op.data.title === 'Süpürücü (Silindi)');
    expect(sweep.data.date).toBe('2026-01-20');
  });

  it('tahsilat, iade, zam ve kilit loglari kendi kind degerini tasir', async () => {
    const debt = { id: 'd1', customerId: 'cust1', drugId: 'drug1', qty: 5, maxPrice: 100, isFixed: false };

    await applyPaymentOperations(
      { id: 'cust1', balance: 0 }, 200,
      [{ id: 'd1', type: 'drug', deduct: 200 }], [], [debt], 'uid1'
    );
    expect(logOps().every(op => op.data.kind === 'payment')).toBe(true);

    mockBatch.operations.length = 0;
    await returnDrug(debt, 1, 0, 'uid1');
    expect(logOps().every(op => op.data.kind === 'return')).toBe(true);

    mockBatch.operations.length = 0;
    await updateDrugPrice('drug1', 300, [debt], 'uid1');
    expect(logOps().every(op => op.data.kind === 'price')).toBe(true);

    mockBatch.operations.length = 0;
    await toggleBatchLockOperations([debt], 'uid1');
    expect(logOps().every(op => op.data.kind === 'lock')).toBe(true);
  });
});

// =============================================
// TAHSILAT KAYDI VE GERI ALMA — TASK-034
// =============================================

describe('tahsilat loglari geri alma verisi tasir', () => {
  const customer = { id: 'cust1', balance: 0 };
  const drugDebt = { id: 'd1', customerId: 'cust1', drugId: 'drug1', qty: 5, maxPrice: 100, isFixed: false };
  const svcDebt = { id: 's1', customerId: 'cust1', desc: 'Muayene', amount: 500 };

  const payLogs = () => mockBatch.operations.filter(
    op => op.type === 'set' && op.data.title === 'Tahsilat'
  );
  const balanceUpdate = () => mockBatch.operations.find(
    op => op.type === 'update' && op.data.balance !== undefined
  );

  it('tahsilat logu batchId, deduct, before ve balanceDelta tasir', async () => {
    await applyPaymentOperations(customer, 200, [{ id: 'd1', type: 'drug', deduct: 200 }], [], [drugDebt], 'uid1');

    const log = payLogs()[0];
    expect(log.data.batchId).toBeTruthy();
    expect(log.data.kind).toBe('payment');
    expect(log.data.deduct).toBe(200);
    expect(log.data.qtyDeducted).toBe(2);
    expect(log.data.removed).toBe(false);
    // `before` borcun odeme oncesi tam hali; `id` dokuman yolunda tasindigi icin disarida
    expect(log.data.before).toEqual({
      customerId: 'cust1', drugId: 'drug1', qty: 5, maxPrice: 100, isFixed: false
    });
    expect(log.data.balanceDelta).toBe(0);
  });

  it('supurulup silinen borcta removed true olur', async () => {
    await applyPaymentOperations(customer, 500, [{ id: 'd1', type: 'drug', deduct: 500 }], [], [drugDebt], 'uid1');

    expect(payLogs()[0].data.removed).toBe(true);
    expect(payLogs()[0].data.before.qty).toBe(5);
  });

  it('bulunamayan borc bakiyeyi dusurmez', async () => {
    // Regresyon: dusum `if (debt)` kontrolunden once bakiyeden cikariliyordu, yani borca
    // yazilmayan para kayboluyordu
    await applyPaymentOperations(customer, 300, [{ id: 'yokBoyleBorc', type: 'drug', deduct: 300 }], [], [], 'uid1');

    expect(payLogs()).toHaveLength(0);
    expect(balanceUpdate().data.balance).toBe(300); // tamami avansa yazilir
  });

  it('borclara dagitilmayan para icin Avans Girisi logu yazilir', async () => {
    await applyPaymentOperations(customer, 700, [{ id: 'd1', type: 'drug', deduct: 200 }], [], [drugDebt], 'uid1');

    const avans = mockBatch.operations.find(op => op.type === 'set' && op.data.title === 'Avans Girişi');
    expect(avans).toBeTruthy();
    expect(avans.data.balanceDelta).toBe(500);
    expect(avans.data.message).toMatch(/avansa yazıldı/);
    expect(balanceUpdate().data.balance).toBe(500);
  });

  it('para tamamen dagitildiysa Avans Girisi yazilmaz', async () => {
    await applyPaymentOperations(customer, 200, [{ id: 'd1', type: 'drug', deduct: 200 }], [], [drugDebt], 'uid1');

    expect(mockBatch.operations.some(op => op.data?.title === 'Avans Girişi')).toBe(false);
  });

  it('mevcut avans kullanildiysa negatif delta ile loglanir', async () => {
    const withBalance = { id: 'cust1', balance: 1000 };
    await applyPaymentOperations(withBalance, 0, [{ id: 's1', type: 'service', deduct: 500 }], [svcDebt], [], 'uid1');

    const avans = mockBatch.operations.find(op => op.data?.title === 'Avans Girişi');
    expect(avans.data.balanceDelta).toBe(-500);
    expect(avans.data.message).toMatch(/avanstan kullanıldı/);
    expect(balanceUpdate().data.balance).toBe(500);
  });
});

describe('revertPaymentOperations', () => {
  const customer = { id: 'cust1', balance: 500 };

  const drugLog = (over = {}) => ({
    debtId: 'd1', drugId: 'drug1', deduct: 200, qtyDeducted: 2, removed: false, balanceDelta: 0,
    before: { customerId: 'cust1', drugId: 'drug1', qty: 5, maxPrice: 100, isFixed: false },
    ...over
  });

  const sets = () => mockBatch.operations.filter(op => op.type === 'set');
  const revertLogs = () => sets().filter(op => op.data.title === 'Tahsilat İptali');
  const balanceUpdate = () => mockBatch.operations.find(
    op => op.type === 'update' && op.data.balance !== undefined
  );

  it('silinen borcu ayni doküman id si ile yeniden yaratir', async () => {
    // `removed: true` -> tahsilat borcu supurmustu; dokuman YOK olmali (tohum ekilmiyor)
    const res = await revertPaymentOperations(customer, [drugLog({ removed: true })], 'Yanlış tahsilat', 'uid1');

    expect(res.ok).toBe(true);
    const restored = sets().find(op => op.ref.path === 'drugDebts/d1');
    const { rev, ...fields } = restored.data;
    expect(fields).toEqual({
      customerId: 'cust1', drugId: 'drug1', qty: 5, maxPrice: 100, isFixed: false
    });
    // Geri yuklenen borc TAZE damga alir: eski damgayi geri yazmak surumu geriye sarardi
    expect(rev).toBeGreaterThan(0);
  });

  it('geri yukleme before daki eski damgayi degil taze damga yazar', async () => {
    const stale = drugLog({ removed: true });
    stale.before = { ...stale.before, rev: 1 };   // bayat damga tasiyan eski bir log

    await revertPaymentOperations(customer, [stale], 'Yanlış tahsilat', 'uid1');

    const restored = sets().find(op => op.ref.path === 'drugDebts/d1');
    expect(restored.data.rev).not.toBe(1);
    expect(restored.data.rev).toBeGreaterThan(1);
  });

  it('yasayan borcu odeme oncesi haline geri yazar', async () => {
    seedDebts('drugDebts/d1');
    await revertPaymentOperations(customer, [drugLog()], 'Yanlış tahsilat', 'uid1');

    expect(sets().find(op => op.ref.path === 'drugDebts/d1').data.qty).toBe(5);
  });

  it('hizmet borcunu dogru koleksiyona yazar', async () => {
    seedDebts('serviceDebts/s1');
    const svcLog = drugLog({
      debtId: 's1', drugId: undefined,
      before: { customerId: 'cust1', desc: 'Muayene', amount: 500 }
    });

    await revertPaymentOperations(customer, [svcLog], 'Yanlış tahsilat', 'uid1');

    expect(sets().some(op => op.ref.path === 'serviceDebts/s1')).toBe(true);
  });

  it('bakiyeye ters delta uygular', async () => {
    seedDebts('drugDebts/d1');
    await revertPaymentOperations(customer, [drugLog({ balanceDelta: 300 })], 'Yanlış tahsilat', 'uid1');

    expect(balanceUpdate().data.balance).toBe(200); // 500 - 300
  });

  it('her borc icin gerekceli iptal logu yazar', async () => {
    seedDebts('drugDebts/d1', 'drugDebts/d2');
    await revertPaymentOperations(
      customer,
      [drugLog(), drugLog({ debtId: 'd2' })],
      'Yanlış müşteriye tahsilat',
      'uid1'
    );

    const logs = revertLogs();
    expect(logs).toHaveLength(2);
    expect(logs[0].data.message).toMatch(/Yanlış müşteriye tahsilat/);
    expect(logs.every(op => op.data.kind === 'payment')).toBe(true);
    expect(new Set(logs.map(op => op.data.batchId)).size).toBe(1);
  });

  it('iptal logu balanceDelta tasimaz — geri almanin geri alinmasi zinciri acilmaz', async () => {
    seedDebts('drugDebts/d1');
    await revertPaymentOperations(customer, [drugLog({ balanceDelta: 300 })], 'Hatalı', 'uid1');

    expect(revertLogs().every(op => op.data.balanceDelta === undefined)).toBe(true);
  });

  it('yalnizca avansa yazilmis tahsilat da geri alinabilir', async () => {
    const avansOnly = { debtId: 'p1', balanceDelta: 400 };
    const res = await revertPaymentOperations(customer, [avansOnly], 'Hatalı', 'uid1');

    expect(res.ok).toBe(true);
    expect(balanceUpdate().data.balance).toBe(100); // 500 - 400
    expect(revertLogs()).toHaveLength(1);
  });

  it('gerekce yoksa veya geri alinacak sey yoksa islem yapmaz', async () => {
    expect(await revertPaymentOperations(customer, [drugLog()], '   ', 'uid1'))
      .toEqual({ ok: false, reason: 'empty' });
    expect(await revertPaymentOperations(customer, [], 'Hatalı', 'uid1'))
      .toEqual({ ok: false, reason: 'empty' });
    expect(await revertPaymentOperations(undefined, [drugLog()], 'Hatalı', 'uid1'))
      .toEqual({ ok: false, reason: 'empty' });
    expect(mockRunTransaction).not.toHaveBeenCalled();
  });

  // --- SURUM KONTROLU (TASK-033) ---

  it('borc guard sonrasi degismisse geri alma yazilmaz', async () => {
    seedDoc('drugDebts/d1', { customerId: 'cust1', qty: 3, rev: 222 });   // baska sekme dokundu

    const res = await revertPaymentOperations(
      customer, [drugLog()], 'Hatalı', 'uid1', { d1: 111 }   // guard 111 gormustu
    );

    expect(res).toEqual({ ok: false, reason: 'stale' });
    expect(mockBatch.operations).toHaveLength(0);
    expect(mockRunTransaction.committed).toBe(false);
  });

  it('borc silinmisse geri alma yazilmaz', async () => {
    // `removed: false` -> borc yasiyor olmali; yoksa araya iptal/iade girmis demektir
    const res = await revertPaymentOperations(customer, [drugLog()], 'Hatalı', 'uid1', { d1: 111 });

    expect(res).toEqual({ ok: false, reason: 'stale' });
    expect(mockBatch.operations).toHaveLength(0);
  });

  it('supurulmus borc yeniden yaratilmissa geri alma yazilmaz', async () => {
    // `removed: true` -> dokumanin YOK olmasi beklenir; varsa biri onu geri getirmis
    seedDebts('drugDebts/d1');

    const res = await revertPaymentOperations(customer, [drugLog({ removed: true })], 'Hatalı', 'uid1');

    expect(res).toEqual({ ok: false, reason: 'stale' });
    expect(mockBatch.operations).toHaveLength(0);
  });

  it('damga eslesiyorsa geri alma yazilir', async () => {
    seedDoc('drugDebts/d1', { customerId: 'cust1', qty: 3, rev: 111 });

    const res = await revertPaymentOperations(customer, [drugLog()], 'Hatalı', 'uid1', { d1: 111 });

    expect(res.ok).toBe(true);
    expect(sets().find(op => op.ref.path === 'drugDebts/d1')).toBeTruthy();
  });

  it('eski kayitta iki taraf da damgasizsa geri alma calisir', async () => {
    seedDebts('drugDebts/d1');   // `rev` alani yok
    const res = await revertPaymentOperations(customer, [drugLog()], 'Hatalı', 'uid1', {});

    expect(res.ok).toBe(true);
  });

  it('eski kayit baska sekmede damgalanmissa yakalanir', async () => {
    seedDoc('drugDebts/d1', { customerId: 'cust1', rev: 777 });   // artik damgali
    const res = await revertPaymentOperations(customer, [drugLog()], 'Hatalı', 'uid1', {});

    expect(res).toEqual({ ok: false, reason: 'stale' });
  });
});

// =============================================
// ISLEM IPTALI (cancelDebtTransactionOperations) — TASK-031
// =============================================

// =============================================
// FIYAT GERI ALMA (TASK-032)
// =============================================

describe('zam loglari geri alma verisi tasir', () => {
  const priceLogs = () => mockBatch.operations.filter(
    op => op.type === 'set' && op.data.title === 'Fiyat Güncellemesi (Zam)'
  );

  it('her zam logu batchId, maxPriceBefore/After ve drugPriceBefore/After tasir', async () => {
    const debts = [
      { id: 'd1', drugId: 'drug1', customerId: 'c1', qty: 2, maxPrice: 100, isFixed: false },
      { id: 'd2', drugId: 'drug1', customerId: 'c2', qty: 1, maxPrice: 150, isFixed: false }
    ];

    await updateDrugPrice('drug1', 200, debts, 'uid1', 100);

    const logs = priceLogs();
    expect(logs).toHaveLength(2);

    const batchIds = new Set(logs.map(op => op.data.batchId));
    expect(batchIds.size).toBe(1);
    expect([...batchIds][0]).toBeTruthy();

    // maxPriceBefore borc bazindadir — iki borcun zam oncesi fiyati farkli
    expect(logs.map(op => op.data.maxPriceBefore).sort((a, b) => a - b)).toEqual([100, 150]);
    expect(logs.every(op => op.data.maxPriceAfter === 200)).toBe(true);
    expect(logs.every(op => op.data.drugPriceBefore === 100)).toBe(true);
    expect(logs.every(op => op.data.drugPriceAfter === 200)).toBe(true);
    expect(logs.every(op => op.data.kind === 'price')).toBe(true);
  });

  it('ilacin mevcut fiyati bilinmiyorsa drugPriceBefore yazilmaz', async () => {
    // Borc bazindaki maxPrice'ten turetmek gruptaki loglara farkli degerler yazardi ve geri
    // alma ilacin fiyatini yanlis bir degere dondururdu; alan hic yazilmamasi daha guvenli
    const debts = [
      { id: 'd1', drugId: 'drug1', customerId: 'c1', qty: 1, maxPrice: 100, isFixed: false },
      { id: 'd2', drugId: 'drug1', customerId: 'c2', qty: 1, maxPrice: 150, isFixed: false }
    ];

    await updateDrugPrice('drug1', 200, debts, 'uid1'); // currentPrice yok

    const logs = priceLogs();
    expect(logs).toHaveLength(2);
    expect(logs.every(op => op.data.drugPriceBefore === undefined)).toBe(true);
    // Borc bazindaki veri yine de yazilir; geri alma borclari onarabilir
    expect(logs.map(op => op.data.maxPriceBefore).sort((a, b) => a - b)).toEqual([100, 150]);
  });

  it('onizlemedeki etkilenen borclar ile gercekten guncellenenler ayni', async () => {
    // Drift korumasi: computePriceImpact ve updateDrugPrice ayni seciciyi kullanmali
    const debts = [
      { id: 'd1', drugId: 'drug1', customerId: 'c1', qty: 2, maxPrice: 100, isFixed: false },
      { id: 'd2', drugId: 'drug1', customerId: 'c1', qty: 1, maxPrice: 100, isFixed: true },
      { id: 'd3', drugId: 'drug1', customerId: 'c2', qty: 1, maxPrice: 300, isFixed: false },
      { id: 'd4', drugId: 'baska', customerId: 'c2', qty: 1, maxPrice: 10, isFixed: false }
    ];

    const impact = computePriceImpact({ id: 'drug1', price: 100 }, 200, debts, []);
    await updateDrugPrice('drug1', 200, debts, 'uid1', 100);

    const updatedDebtIds = mockBatch.operations
      .filter(op => op.type === 'update' && op.data.maxPrice !== undefined)
      .map(op => op.ref.path.split('/')[1]);

    expect(updatedDebtIds).toEqual(impact.affected.map(a => a.debt.id));
    expect(updatedDebtIds).toEqual(['d1']);
  });
});

describe('revertDrugPriceOperations', () => {
  const log = (over = {}) => ({
    debtId: 'd1', customerId: 'c1', maxPriceBefore: 100, maxPriceAfter: 200,
    drugPriceBefore: 100, drugPriceAfter: 200, ...over
  });

  const updates = () => mockBatch.operations.filter(op => op.type === 'update');
  const revertLogs = () => mockBatch.operations.filter(
    op => op.type === 'set' && op.data.title === 'Fiyat Güncellemesi İptali'
  );

  // Surum kontrolu dokumani okur; testlerin kullandigi borclar var olmali
  beforeEach(() => seedDebts('drugDebts/d1', 'drugDebts/d2'));

  it('drugPriceBefore yoksa ilac fiyatina dokunmaz, borclari yine onarir', async () => {
    await revertDrugPriceOperations('drug1', [log({ drugPriceBefore: undefined })], 'uid1');

    expect(updates().some(op => op.ref.path.startsWith('drugs/'))).toBe(false);
    expect(updates().filter(op => op.ref.path.startsWith('drugDebts/'))).toHaveLength(1);
  });

  it('ilac fiyatini ve her borcun maxPrice degerini geri yukler', async () => {
    const res = await revertDrugPriceOperations('drug1', [
      log({ debtId: 'd1', maxPriceBefore: 100 }),
      log({ debtId: 'd2', maxPriceBefore: 150 })
    ], 'uid1');

    expect(res.ok).toBe(true);
    expect(mockRunTransaction).toHaveBeenCalled();

    const drugUpdate = updates().find(op => op.ref.path.startsWith('drugs/'));
    expect(drugUpdate.data).toEqual({ price: 100 });

    const debtUpdates = updates().filter(op => op.ref.path.startsWith('drugDebts/'));
    expect(debtUpdates.map(op => op.data.maxPrice)).toEqual([100, 150]);
  });

  it('her borc icin bir iptal logu yazar', async () => {
    await revertDrugPriceOperations('drug1', [log({ debtId: 'd1' }), log({ debtId: 'd2' })], 'uid1');

    const logs = revertLogs();
    expect(logs).toHaveLength(2);
    expect(logs.every(op => op.data.kind === 'price')).toBe(true);
    expect(logs.every(op => op.data.drugId === 'drug1')).toBe(true);
    expect(new Set(logs.map(op => op.data.batchId)).size).toBe(1);
  });

  it('iptal logu maxPriceBefore tasimaz — geri almanin geri alinmasi zinciri acilmaz', async () => {
    await revertDrugPriceOperations('drug1', [log()], 'uid1');

    expect(revertLogs()[0].data.maxPriceBefore).toBeUndefined();
  });

  it('bos veya gecersiz log listesinde islem yapmaz', async () => {
    const legacy = { ok: false, reason: 'legacy' };
    expect(await revertDrugPriceOperations('drug1', [], 'uid1')).toEqual(legacy);
    expect(await revertDrugPriceOperations('drug1', [{ debtId: 'd1' }], 'uid1')).toEqual(legacy);
    expect(await revertDrugPriceOperations(undefined, [log()], 'uid1')).toEqual(legacy);
    expect(mockRunTransaction).not.toHaveBeenCalled();
  });

  // --- SURUM KONTROLU (TASK-033) ---

  it('borc guard sonrasi degismisse zam geri alma yazilmaz', async () => {
    seedDoc('drugDebts/d1', { customerId: 'cust1', maxPrice: 200, rev: 222 });

    const res = await revertDrugPriceOperations('drug1', [log()], 'uid1', { d1: 111 });

    expect(res).toEqual({ ok: false, reason: 'stale' });
    expect(mockBatch.operations).toHaveLength(0);
    expect(mockRunTransaction.committed).toBe(false);
  });

  it('borclardan biri silinmisse hicbiri onarilmaz', async () => {
    seedDoc('drugDebts/d2', null);   // ikinci borc kapanmis

    const res = await revertDrugPriceOperations('drug1', [
      log({ debtId: 'd1' }), log({ debtId: 'd2' })
    ], 'uid1');

    expect(res).toEqual({ ok: false, reason: 'stale' });
    expect(mockBatch.operations).toHaveLength(0);   // atomik: ilki de yazilmaz
  });

  it('damga eslesiyorsa zam geri alma yazilir', async () => {
    seedDoc('drugDebts/d1', { customerId: 'cust1', maxPrice: 200, rev: 111 });

    const res = await revertDrugPriceOperations('drug1', [log()], 'uid1', { d1: 111 });

    expect(res.ok).toBe(true);
    expect(updates().some(op => op.ref.path === 'drugDebts/d1')).toBe(true);
  });
});

describe('cancelDebtTransactionOperations', () => {
  const svcItem = (over = {}) => ({ id: 'svc1', type: 'service', desc: 'Muayene', amount: 500, ...over });
  const drugItem = (over = {}) => ({ id: 'dd1', type: 'drug', drugName: 'Amoksisilin', qty: 2, maxPrice: 100, tlValue: 200, ...over });

  const deletes = () => mockBatch.operations.filter(op => op.type === 'delete');
  const cancelLog = () => mockBatch.operations.find(op => op.type === 'set' && op.data.title === 'İşlem İptali');

  // Surum kontrolu dokumani okur; testlerin iptal ettigi borclar var olmali
  beforeEach(() => seedDebts('serviceDebts/svc1', 'drugDebts/dd1'));

  it('karma islemde her iki koleksiyondan da siler ve tek iptal logu yazar', async () => {
    const res = await cancelDebtTransactionOperations(
      'cust1', [svcItem(), drugItem()], 'b1', 'Yanlış müşteriye girildi', 'uid1'
    );

    expect(res.ok).toBe(true);
    expect(deletes().map(op => op.ref.path).sort()).toEqual(['drugDebts/dd1', 'serviceDebts/svc1']);

    const logs = mockBatch.operations.filter(op => op.type === 'set');
    expect(logs.length).toBe(1);
    expect(mockRunTransaction).toHaveBeenCalled();
  });

  it('iptal logu batchId, kind cancel ve gerekceyi tasir', async () => {
    await cancelDebtTransactionOperations('cust1', [svcItem(), drugItem()], 'b1', 'Yanlış müşteriye girildi', 'uid1');

    const log = cancelLog();
    expect(log.data.batchId).toBe('b1');
    expect(log.data.kind).toBe('cancel');
    expect(log.data.customerId).toBe('cust1');
    expect(log.data.userId).toBe('uid1');
    expect(log.data.message).toMatch(/Yanlış müşteriye girildi/);
    expect(log.data.message).toMatch(/2 kalemlik/);
    expect(log.data.message).toMatch(/700/); // 500 + 2 × 100
  });

  it('dokumani kalmamis (supurulmus) islemde yalnizca iptal logu yazar', async () => {
    const res = await cancelDebtTransactionOperations('cust1', [], 'b1', 'Hatalı giriş', 'uid1');

    expect(res.ok).toBe(true);
    expect(deletes().length).toBe(0);
    expect(cancelLog()).toBeTruthy();
    expect(cancelLog().data.message).toMatch(/Borç kaydı kalmamış/);
  });

  it('musteri bakiyesine dokunmaz', async () => {
    await cancelDebtTransactionOperations('cust1', [svcItem(), drugItem()], 'b1', 'Hatalı giriş', 'uid1');

    const customerUpdates = mockBatch.operations.filter(
      op => op.type === 'update' && op.data.balance !== undefined
    );
    expect(customerUpdates.length).toBe(0);
  });

  it('gerekce veya batchId yoksa hicbir sey yazmaz', async () => {
    const empty = { ok: false, reason: 'empty' };
    expect(await cancelDebtTransactionOperations('cust1', [drugItem()], 'b1', '   ', 'uid1')).toEqual(empty);
    expect(await cancelDebtTransactionOperations('cust1', [drugItem()], '', 'Hatalı giriş', 'uid1')).toEqual(empty);
    expect(mockRunTransaction).not.toHaveBeenCalled();
  });

  // --- SURUM KONTROLU (TASK-033) ---

  it('borc guard sonrasi degismisse iptal yazilmaz', async () => {
    // Kabul kriteri: iki sekmede ayni islem acikken birinde tahsilat yapilirsa
    // digerindeki iptal YAZILMAZ
    seedDoc('drugDebts/dd1', { customerId: 'cust1', qty: 1, rev: 222 });

    const res = await cancelDebtTransactionOperations(
      'cust1', [drugItem()], 'b1', 'Hatalı giriş', 'uid1', { dd1: 111 }
    );

    expect(res).toEqual({ ok: false, reason: 'stale' });
    expect(mockBatch.operations).toHaveLength(0);
    expect(mockRunTransaction.committed).toBe(false);
  });

  it('kalemlerden biri degismisse hicbiri silinmez', async () => {
    seedDoc('drugDebts/dd1', { customerId: 'cust1', rev: 999 });

    const res = await cancelDebtTransactionOperations(
      'cust1', [svcItem(), drugItem()], 'b1', 'Hatalı giriş', 'uid1', { svc1: undefined, dd1: 111 }
    );

    expect(res).toEqual({ ok: false, reason: 'stale' });
    expect(deletes()).toHaveLength(0);   // atomik: saglam kalem de silinmez
  });

  it('borc zaten silinmisse iptal yazilmaz', async () => {
    seedDoc('serviceDebts/svc1', null);

    const res = await cancelDebtTransactionOperations('cust1', [svcItem()], 'b1', 'Hatalı giriş', 'uid1');

    expect(res).toEqual({ ok: false, reason: 'stale' });
    expect(mockBatch.operations).toHaveLength(0);
  });

  it('damgalar eslesiyorsa iptal yazilir', async () => {
    seedDoc('serviceDebts/svc1', { customerId: 'cust1', rev: 111 });
    seedDoc('drugDebts/dd1', { customerId: 'cust1', rev: 222 });

    const res = await cancelDebtTransactionOperations(
      'cust1', [svcItem(), drugItem()], 'b1', 'Hatalı giriş', 'uid1', { svc1: 111, dd1: 222 }
    );

    expect(res.ok).toBe(true);
    expect(deletes()).toHaveLength(2);
  });
});

// =============================================
// SURUM DAMGASI (rev) — TASK-033
// =============================================

describe('surum damgasi (rev)', () => {
  const debtWrites = () => mockBatch.operations.filter(
    op => (op.type === 'set' && op.data.title === undefined) || op.type === 'update'
  );
  const revsOf = (ops) => ops.map(op => op.data.rev);

  it('yeni acilan borc dokumanlari damga tasir', async () => {
    await addService('Muayene', 500);
    const debt = serviceSets()[0];
    expect(debt.data.rev).toBeGreaterThan(0);
  });

  it('bir islemdeki tum borclar AYNI damgayi tasir', async () => {
    // `Date.now` her cagrida artsin: gercek saatle test hizli calistigi icin dokuman basina
    // damgalama da tesadufen ayni degeri uretir ve hata gizlenirdi.
    let tick = 1000;
    const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => ++tick);

    try {
      await addDebtTransactionOperations('cust1', {
        date: TODAY,
        service: { desc: 'Muayene', amount: 500 },
        drugItems: [
          item({ id: 'drug1', price: 100 }, 2, 100),
          item({ id: 'drug2', price: 50 }, 3, 50)
        ]
      }, 'uid1');

      const revs = new Set([...serviceSets(), ...drugSets()].map(op => op.data.rev));
      expect(revs.size).toBe(1);
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('tahsilat dokunulan borclarin damgasini yeniler', async () => {
    await applyPaymentOperations(
      { id: 'cust1', balance: 0 }, 300,
      [{ id: 's1', type: 'service', deduct: 300 }],
      [{ id: 's1', customerId: 'cust1', amount: 1000, rev: 111 }], [], 'uid1'
    );

    const upd = mockBatch.operations.find(op => op.type === 'update' && op.data.amount !== undefined);
    expect(upd.data.rev).toBeGreaterThan(111);
  });

  it('iade damgayi yeniler ve grup iadesinde tek damga kullanilir', async () => {
    let tick = 1000;
    const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => ++tick);

    try {
      await returnBatchOperations([
        { debt: { id: 'dd1', customerId: 'cust1', drugId: 'drug1', qty: 10, maxPrice: 50 }, returnQty: 2 },
        { debt: { id: 'dd2', customerId: 'cust1', drugId: 'drug1', qty: 10, maxPrice: 50 }, returnQty: 3 }
      ], 0, 'uid1');

      const qtyUpdates = mockBatch.operations.filter(op => op.type === 'update' && op.data.qty !== undefined);
      expect(qtyUpdates).toHaveLength(2);
      expect(new Set(revsOf(qtyUpdates)).size).toBe(1);
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('zam ve kilit degisimi damgayi yeniler', async () => {
    await updateDrugPrice('drug1', 120, [
      { id: 'dd1', drugId: 'drug1', customerId: 'cust1', qty: 5, maxPrice: 100, isFixed: false }
    ], 'uid1', 100);
    expect(mockBatch.operations.find(op => op.type === 'update' && op.data.maxPrice !== undefined).data.rev)
      .toBeGreaterThan(0);

    mockBatch.operations.length = 0;
    await toggleDebtLock({ id: 'dd1', customerId: 'cust1', drugId: 'drug1', isFixed: false }, 'uid1');
    expect(mockBatch.operations.find(op => op.type === 'update' && op.data.isFixed !== undefined).data.rev)
      .toBeGreaterThan(0);
  });

  it('borc dokumanina dokunan her yazim damga tasir', async () => {
    // Fail-closed: damgasiz bir yazim yolu kalirsa o borc surum kontrolunden kacar
    await addDebtTransactionOperations('cust1', {
      date: '2026-01-20',
      service: { desc: 'Muayene', amount: 1000, paidAmount: 400, paidDate: '2026-01-21' },
      drugItems: [item({ id: 'drug1', price: 120 }, 5, 100)],
      applyInflation: true
    }, 'uid1');

    expect(debtWrites().length).toBeGreaterThan(0);
    expect(debtWrites().every(op => op.data.rev !== undefined)).toBe(true);
  });

  it('snapshotOf damgayi eler — before icinde rev bulunmaz', async () => {
    await applyPaymentOperations(
      { id: 'cust1', balance: 0 }, 300,
      [{ id: 's1', type: 'service', deduct: 300 }],
      [{ id: 's1', customerId: 'cust1', desc: 'Muayene', amount: 1000, rev: 999 }], [], 'uid1'
    );

    const log = mockBatch.operations.find(op => op.type === 'set' && op.data.title === 'Tahsilat');
    expect(log.data.before.rev).toBeUndefined();
    expect(log.data.before).toEqual({ customerId: 'cust1', desc: 'Muayene', amount: 1000 });
  });
});

// =============================================
// PARA HAREKETI ALANLARI (flow + amount) — TASK-020
// =============================================

describe('log para hareketi alanlari (flow + amount)', () => {
  const logs = () => mockBatch.operations.filter(op => op.type === 'set' && op.data.title !== undefined);
  const byTitle = (title) => logs().find(op => op.data.title === title)?.data;
  const allByTitle = (title) => logs().filter(op => op.data.title === title).map(op => op.data);

  it('hizmet borcu acilisi brut tutari tasir', async () => {
    await addService('Muayene', 750);
    expect(byTitle('Hizmet Borcu')).toMatchObject({ flow: 'debt', amount: 750 });
  });

  it('ilac borcu acilisi kalem toplamini tasir', async () => {
    await addDrugs([item({ id: 'drug1', price: 200 }, 3, 150)]);
    expect(byTitle('Borç Açıldı')).toMatchObject({ flow: 'debt', amount: 450 });
  });

  it('gomulu gecmis tahsilat collect olarak tahsil edilen tutari tasir', async () => {
    await addService('Muayene', 1000, '2026-01-20', { paidAmount: 400, paidDate: '2026-01-21' });

    expect(byTitle('Geçmiş Hizmet Borcu')).toMatchObject({ flow: 'debt', amount: 1000 });
    expect(byTitle('Geçmiş Tahsilat')).toMatchObject({ flow: 'collect', amount: 400 });
  });

  it('supurucu silinen kalani writeoff olarak tasir', async () => {
    // 1000 borc, 995 tahsilat -> kalan 5, supurulur
    await addService('Muayene', 1000, '2026-01-20', { paidAmount: 995, paidDate: '2026-01-21' });
    expect(byTitle('Süpürücü (Silindi)')).toMatchObject({ flow: 'writeoff', amount: 5 });
  });

  it('enflasyon logu borc artisini tasir', async () => {
    // 5 adet, 100'den girilmis, guncel fiyat 120 -> kalan borc 500 -> 600
    await addDrugs([item({ id: 'drug1', price: 120 }, 5, 100)], '2026-01-20', { applyInflation: true });
    expect(byTitle('Enflasyon Güncellemesi')).toMatchObject({ flow: 'inflation', amount: 100 });
  });

  it('tahsilat logu deduct ile ayni tutari amount olarak da tasir', async () => {
    const customer = { id: 'cust1', balance: 0 };
    await applyPaymentOperations(
      customer, 300,
      [{ id: 's1', type: 'service', deduct: 300 }],
      [{ id: 's1', customerId: 'cust1', amount: 1000 }], [], 'uid1'
    );

    expect(byTitle('Tahsilat')).toMatchObject({ flow: 'collect', amount: 300, deduct: 300 });
  });

  it('avans girisi amount tasimaz, tutar isaretli balanceDelta da durur', async () => {
    const customer = { id: 'cust1', balance: 0 };
    await applyPaymentOperations(
      customer, 500,
      [{ id: 's1', type: 'service', deduct: 200 }],
      [{ id: 's1', customerId: 'cust1', amount: 1000 }], [], 'uid1'
    );

    const advance = byTitle('Avans Girişi');
    expect(advance).toMatchObject({ flow: 'advance', balanceDelta: 300 });
    // `amount` pozitif buyukluktur; avans isaretli oldugu icin ikinci kez toplanmamali
    expect(advance.amount).toBeUndefined();
  });

  it('tahsilat yolundaki supurucu de writeoff tasir', async () => {
    const customer = { id: 'cust1', balance: 0 };
    await applyPaymentOperations(
      customer, 994,
      [{ id: 's1', type: 'service', deduct: 994 }],
      [{ id: 's1', customerId: 'cust1', amount: 1000 }], [], 'uid1'
    );

    expect(byTitle('Süpürücü (Kapatıldı)')).toMatchObject({ flow: 'writeoff', amount: 6 });
  });

  it('iade logu iade edilen tutari tasir', async () => {
    await returnDrug({ id: 'dd1', customerId: 'cust1', drugId: 'drug1', qty: 10, maxPrice: 50 }, 4, 0, 'uid1');
    expect(byTitle('İade İşlemi')).toMatchObject({ flow: 'return', amount: 200 });
  });

  it('fazla iadede amount yalnizca borca sayilan kisim, fazlasi refund alaninda', async () => {
    // 5 adetlik borc, 8 adet iade -> 250 borc kapanir, 150 avansa yazilir
    await returnDrug({ id: 'dd1', customerId: 'cust1', drugId: 'drug1', qty: 5, maxPrice: 50 }, 8, 0, 'uid1');
    expect(byTitle('Fazla İade (Avans)')).toMatchObject({ flow: 'return', amount: 250, refund: 150 });
  });

  it('zam logu borc artisini tasir', async () => {
    await updateDrugPrice('drug1', 120, [
      { id: 'dd1', drugId: 'drug1', customerId: 'cust1', qty: 5, maxPrice: 100, isFixed: false }
    ], 'uid1', 100);

    expect(byTitle('Fiyat Güncellemesi (Zam)')).toMatchObject({ flow: 'priceUp', amount: 100 });
  });

  it('kalem iptali iptal edilen tutari tasir', async () => {
    await cancelDebtItemOperations('cust1', { id: 'dd1', type: 'drug', qty: 4, maxPrice: 25, drugId: 'drug1' }, 'Hatalı', 'uid1');
    expect(byTitle('İlaç Borcu İptali')).toMatchObject({ flow: 'cancel', amount: 100 });
  });

  it('islem iptali toplam tutari tasir', async () => {
    seedDebts('serviceDebts/s1', 'drugDebts/d1');
    await cancelDebtTransactionOperations('cust1', [
      { id: 's1', type: 'service', amount: 500 },
      { id: 'd1', type: 'drug', qty: 2, maxPrice: 75 }
    ], 'b1', 'Hatalı giriş', 'uid1');

    expect(byTitle('İşlem İptali')).toMatchObject({ flow: 'cancel', amount: 650, batchId: 'b1' });
  });

  it('geri alma loglari flow tasimaz — kendilerini yeni bir hareket saydirmazlar', async () => {
    seedDebts('serviceDebts/s1');
    await revertPaymentOperations(
      { id: 'cust1', balance: 500 },
      [{ debtId: 's1', batchId: 'pb1', deduct: 300, balanceDelta: 100, before: { customerId: 'cust1', desc: 'Muayene', amount: 1000 } }],
      'Yanlış tahsilat', 'uid1'
    );

    const reverts = allByTitle('Tahsilat İptali');
    expect(reverts.length).toBeGreaterThan(0);
    expect(reverts.every(l => l.flow === undefined)).toBe(true);
    expect(reverts.every(l => l.revertOf === 'pb1')).toBe(true);
  });

  it('zam geri alma logu da flow tasimaz', async () => {
    seedDebts('drugDebts/dd1');
    await revertDrugPriceOperations('drug1', [
      { debtId: 'dd1', batchId: 'zb1', customerId: 'cust1', maxPriceBefore: 100, maxPriceAfter: 120, drugPriceBefore: 100 }
    ], 'uid1');

    const revert = byTitle('Fiyat Güncellemesi İptali');
    expect(revert.flow).toBeUndefined();
    expect(revert.revertOf).toBe('zb1');
  });

  it('kilit loglari para hareketi degildir, flow tasimaz', async () => {
    await toggleBatchLockOperations([
      { id: 'dd1', customerId: 'cust1', drugId: 'drug1', isFixed: false }
    ], 'uid1');

    expect(byTitle('Fiyat Sabitlendi').flow).toBeUndefined();
  });
});

