import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockBatch, mockDoc, mockCollection, mockAddDoc, mockDeleteDoc, mockUpdateDoc, mockGetDoc, resetMocks } from '../test/firebaseMock';

// Firebase modulunu mock'la
const mockBatch = createMockBatch();

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
  toggleBatchLockOperations,
  returnBatchOperations,
  deleteServiceDebtOperations,
} = await import('./firestoreOperations');

const TODAY = new Date().toISOString().split('T')[0];

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

  it('hizmet borcu silinirken iptal logu yazar', async () => {
    await deleteServiceDebtOperations('sd1', 'uid1');
    expect(mockGetDoc).toHaveBeenCalled();
    expect(mockBatch.commit).toHaveBeenCalled();
    const sets = mockBatch.operations.filter((op) => op.type === 'set');
    const cancelLog = sets.find((op) => op.data?.title === 'Hizmet Borcu İptali');
    expect(cancelLog).toBeDefined();
    expect(cancelLog.data.userId).toBe('uid1');
    expect(mockBatch.operations.some((op) => op.type === 'delete')).toBe(true);
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
