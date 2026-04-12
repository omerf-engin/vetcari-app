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
  addServiceDebtOperations,
  addDrugDebtOperations,
  deleteServiceDebtOperations,
  addPastServiceDebtOperations,
  addPastDrugDebtOperations,
} = await import('./firestoreOperations');

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
    await addServiceDebtOperations('cust1', 'Muayene', -100);
    expect(mockBatch.commit).not.toHaveBeenCalled();
  });

  it('bos veya sadece bosluk aciklamayla hizmet borcu eklemez', async () => {
    await addServiceDebtOperations('cust1', '   ', 100);
    expect(mockBatch.commit).not.toHaveBeenCalled();
  });

  it('hizmet borcu writeBatch ile ekler ve transaction logu yazar', async () => {
    await addServiceDebtOperations('cust1', 'Muayene', 150);
    expect(mockBatch.commit).toHaveBeenCalled();
    const sets = mockBatch.operations.filter((op) => op.type === 'set');
    expect(sets.length).toBe(2);
    const log = sets.find((op) => op.data?.title === 'Hizmet Borcu');
    expect(log).toBeDefined();
    expect(log.data.message).toMatch(/Muayene/);
    expect(log.data.customerId).toBe('cust1');
  });

  it('hizmet borcu silinirken iptal logu yazar', async () => {
    await deleteServiceDebtOperations('sd1');
    expect(mockGetDoc).toHaveBeenCalled();
    expect(mockBatch.commit).toHaveBeenCalled();
    const sets = mockBatch.operations.filter((op) => op.type === 'set');
    expect(sets.some((op) => op.data?.title === 'Hizmet Borcu İptali')).toBe(true);
    expect(mockBatch.operations.some((op) => op.type === 'delete')).toBe(true);
  });

  it('negatif miktarla ilac borcu eklemez', async () => {
    await addDrugDebtOperations('cust1', { id: 'd1', price: 50 }, -2);
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

describe('Ilac Borcu Ekleme', () => {
  it('ilac borcu ekler ve log yazar', async () => {
    const drug = { id: 'drug1', price: 120 };

    await addDrugDebtOperations('cust1', drug, 5);

    expect(mockBatch.commit).toHaveBeenCalled();
    const sets = mockBatch.operations.filter(op => op.type === 'set');
    expect(sets.length).toBe(2); // borc + log

    const debtOp = sets[0];
    expect(debtOp.data.customerId).toBe('cust1');
    expect(debtOp.data.drugId).toBe('drug1');
    expect(debtOp.data.qty).toBe(5);
    expect(debtOp.data.maxPrice).toBe(120);
    expect(debtOp.data.isFixed).toBe(false);
  });
});

// =============================================
// GECMIS HIZMET BORCU TESTLERI
// =============================================

describe('Gecmis Hizmet Borcu', () => {
  it('gecmis tarihli hizmet borcu olusturur', async () => {
    await addPastServiceDebtOperations('cust1', 'Muayene', 500, '2026-01-15', 0, null, 'uid1');

    expect(mockBatch.commit).toHaveBeenCalled();
    const sets = mockBatch.operations.filter(op => op.type === 'set');
    expect(sets.length).toBe(2); // borc + log

    const debtOp = sets.find(op => op.data.customerId && op.data.desc);
    expect(debtOp.data.amount).toBe(500);
    expect(debtOp.data.date).toBe('2026-01-15');
    expect(debtOp.data.userId).toBe('uid1');
  });

  it('tahsilatli hizmet borcu: kalan dogru hesaplanir', async () => {
    await addPastServiceDebtOperations('cust1', 'Asılama', 300, '2026-02-10', 100, '2026-02-20', 'uid1');

    const sets = mockBatch.operations.filter(op => op.type === 'set');
    expect(sets.length).toBe(3); // borc + 2 log (olusturma + tahsilat)

    const debtOp = sets.find(op => op.data.desc);
    expect(debtOp.data.amount).toBe(200); // 300 - 100
  });

  it('supurucu: kalan <= 10 TL ise borc olusturulmaz', async () => {
    await addPastServiceDebtOperations('cust1', 'Kontrol', 100, '2026-03-01', 95, '2026-03-10', 'uid1');

    const sets = mockBatch.operations.filter(op => op.type === 'set');
    // kalan 5 TL <= 10 TL → borc yok, sadece loglar (olusturma + tahsilat + supurucu)
    const debtOps = sets.filter(op => op.data.desc);
    expect(debtOps.length).toBe(0);
    expect(sets.length).toBe(3); // 3 log
  });

  it('validasyon: paidAmount >= amount ise islem yapmaz', async () => {
    await addPastServiceDebtOperations('cust1', 'Muayene', 500, '2026-01-15', 500, '2026-01-20', 'uid1');
    expect(mockBatch.commit).not.toHaveBeenCalled();
  });
});

// =============================================
// GECMIS ILAC BORCU TESTLERI
// =============================================

describe('Gecmis Ilac Borcu', () => {
  it('ozel birim fiyatla ilac borcu olusturur', async () => {
    const drug = { id: 'drug1', price: 90 };
    await addPastDrugDebtOperations('cust1', drug, 4, 75, '2026-01-20', 0, null, false, 'uid1');

    expect(mockBatch.commit).toHaveBeenCalled();
    const sets = mockBatch.operations.filter(op => op.type === 'set');
    expect(sets.length).toBe(2); // borc + log

    const debtOp = sets.find(op => op.data.isFixed !== undefined);
    expect(debtOp.data.qty).toBe(4);
    expect(debtOp.data.maxPrice).toBe(75);
    expect(debtOp.data.date).toBe('2026-01-20');
  });

  it('tahsilatli ilac borcu: adet kusuratli olabilir', async () => {
    const drug = { id: 'drug1', price: 90 };
    // 4 adet × 75 = 300, 100 TL tahsilat → 100/75 = 1.33 adet düşülür, kalan 2.67
    await addPastDrugDebtOperations('cust1', drug, 4, 75, '2026-02-15', 100, '2026-02-25', false, 'uid1');

    const sets = mockBatch.operations.filter(op => op.type === 'set');
    const debtOp = sets.find(op => op.data.isFixed !== undefined);
    expect(debtOp.data.qty).toBe(2.67); // 4 - 1.33
    expect(debtOp.data.maxPrice).toBe(75); // enflasyon yok
  });

  it('enflasyon uygulandiginda maxPrice guncellenir', async () => {
    const drug = { id: 'drug1', price: 90 };
    await addPastDrugDebtOperations('cust1', drug, 4, 75, '2026-02-15', 0, null, true, 'uid1');

    const sets = mockBatch.operations.filter(op => op.type === 'set');
    expect(sets.length).toBe(3); // borc + log + enflasyon log

    const debtOp = sets.find(op => op.data.isFixed !== undefined);
    expect(debtOp.data.maxPrice).toBe(90); // guncel fiyat
    expect(debtOp.data.qty).toBe(4); // adet degismez
  });

  it('tahsilat + enflasyon kombine: once tahsilat sonra enflasyon', async () => {
    const drug = { id: 'drug1', price: 90 };
    // 4×75=300, 100 tahsilat → kalan 2.67 adet, sonra enflasyon 90 TL/adet
    await addPastDrugDebtOperations('cust1', drug, 4, 75, '2026-02-15', 100, '2026-02-25', true, 'uid1');

    const sets = mockBatch.operations.filter(op => op.type === 'set');
    const debtOp = sets.find(op => op.data.isFixed !== undefined);
    expect(debtOp.data.qty).toBe(2.67);
    expect(debtOp.data.maxPrice).toBe(90);
  });

  it('supurucu: tahsilat sonrasi kalan <= 10 TL ise borc olusturulmaz', async () => {
    const drug = { id: 'drug1', price: 90 };
    // 2×50=100, 95 tahsilat → kalan 0.1 adet (5 TL) ≤ 10
    await addPastDrugDebtOperations('cust1', drug, 2, 50, '2026-03-01', 95, '2026-03-05', false, 'uid1');

    const sets = mockBatch.operations.filter(op => op.type === 'set');
    const debtOps = sets.filter(op => op.data.isFixed !== undefined);
    expect(debtOps.length).toBe(0); // borc olusturulmadi
    expect(sets.length).toBe(3); // 3 log (olusturma + tahsilat + supurucu)
  });

  it('guncel fiyat <= birim fiyat ise enflasyon uygulanmaz', async () => {
    const drug = { id: 'drug1', price: 60 }; // guncel fiyat < birim fiyat
    await addPastDrugDebtOperations('cust1', drug, 4, 75, '2026-02-15', 0, null, true, 'uid1');

    const sets = mockBatch.operations.filter(op => op.type === 'set');
    expect(sets.length).toBe(2); // sadece borc + log (enflasyon logu yok)

    const debtOp = sets.find(op => op.data.isFixed !== undefined);
    expect(debtOp.data.maxPrice).toBe(75); // degismedi
  });

  it('validasyon: qty <= 0 ise islem yapmaz', async () => {
    const drug = { id: 'drug1', price: 90 };
    await addPastDrugDebtOperations('cust1', drug, 0, 75, '2026-01-20', 0, null, false, 'uid1');
    expect(mockBatch.commit).not.toHaveBeenCalled();
  });

  it('validasyon: paidAmount >= totalDebt ise islem yapmaz', async () => {
    const drug = { id: 'drug1', price: 90 };
    // 4 × 75 = 300, tahsilat 300 → tam odeme, borc olusturulmamali
    await addPastDrugDebtOperations('cust1', drug, 4, 75, '2026-01-20', 300, '2026-01-25', false, 'uid1');
    expect(mockBatch.commit).not.toHaveBeenCalled();
  });
});
