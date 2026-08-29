// Firebase Firestore mock
// writeBatch islemlerini yakalayip test edebilmek icin

import { vi } from 'vitest';

// Batch islemlerini kayit altina alan mock
export function createMockBatch() {
  const operations = [];

  return {
    operations,
    set: vi.fn((ref, data) => operations.push({ type: 'set', ref, data })),
    update: vi.fn((ref, data) => operations.push({ type: 'update', ref, data })),
    delete: vi.fn((ref) => operations.push({ type: 'delete', ref })),
    commit: vi.fn(() => Promise.resolve()),
  };
}

// doc() mock — ref obje doner
let docCounter = 0;
export const mockDoc = vi.fn((...args) => {
  const path = args.filter(a => typeof a === 'string').join('/');
  return { id: `mock-doc-${++docCounter}`, path };
});

// collection() mock
export const mockCollection = vi.fn((...args) => {
  const path = args.filter(a => typeof a === 'string').join('/');
  return { path };
});

// addDoc mock
export const mockAddDoc = vi.fn(() => Promise.resolve({ id: `added-${++docCounter}` }));

// deleteDoc mock
export const mockDeleteDoc = vi.fn(() => Promise.resolve());

// updateDoc mock
export const mockUpdateDoc = vi.fn(() => Promise.resolve());

/** getDoc kullanan operasyonlar icin (su an aktif kod yolunda yok, mock hazir dursun) */
export const mockGetDoc = vi.fn(() =>
  Promise.resolve({
    exists() {
      return true;
    },
    data() {
      return { desc: 'Muayene', amount: 80, customerId: 'cust1' };
    }
  })
);

// --- TRANSACTION DESTEGI (TASK-033) ---
//
// `runTransaction` gercek veri okumak zorunda oldugu icin mock'un bir dokuman deposuna
// ihtiyaci var. Depo `path -> data` tutar; testler `seedDoc` ile doldurur.

const store = new Map();

/** Transaction'in okuyacagi bir dokuman yerlestirir. `data` null ise dokuman "yok" sayilir. */
export function seedDoc(path, data) {
  if (data === null) store.delete(path);
  else store.set(path, data);
}

export function resetStore() {
  store.clear();
}

/**
 * Transaction nesnesi. Yazmalari `createMockBatch` ile **ayni** `{type, ref, data}` semasina
 * yazar ki testlerdeki `sets()`, `updates()`, `deletes()` ve `op.ref.path` filtreleri
 * degismeden calissin.
 */
export function createMockTransaction(operations) {
  return {
    get: vi.fn(async (ref) => {
      // `doc(collection(db,'x'))` path uretmez; bos path asla mevcut sayilmamali
      const exists = Boolean(ref?.path) && store.has(ref.path);
      return {
        exists: () => exists,
        data: () => (exists ? store.get(ref.path) : undefined),
      };
    }),
    set: vi.fn((ref, data) => operations.push({ type: 'set', ref, data })),
    update: vi.fn((ref, data) => operations.push({ type: 'update', ref, data })),
    delete: vi.fn((ref) => operations.push({ type: 'delete', ref })),
  };
}

/**
 * `runTransaction(db, updateFn)` mock'u.
 *
 * Callback throw ederse yazmalar **geri alinir** — gercek Firestore'da da commit edilmez.
 * Bu olmadan "islem iptal edildi ama yazma kaydedildi" ayrimi test edilemezdi.
 */
export const mockRunTransaction = vi.fn(async (_db, updateFn) => {
  const staged = [];
  const tx = createMockTransaction(staged);
  try {
    const result = await updateFn(tx);
    // Yalnizca basarida gorunur olur — mevcut `sets()`/`updates()`/`deletes()` yardimcilari
    // `writeBatch` ile transaction'i ayirt etmek zorunda kalmasin diye ayni diziye duser
    (txSink ?? mockRunTransaction.operations).push(...staged);
    mockRunTransaction.committed = true;
    return result;
  } catch (err) {
    mockRunTransaction.committed = false;
    throw err;
  }
});
mockRunTransaction.operations = [];
mockRunTransaction.committed = false;

let txSink = null;

/** Transaction yazmalarinin dusecegi dizi; test dosyasi `createMockBatch().operations` verir. */
export function setTransactionSink(operations) {
  txSink = operations;
}

// Her test oncesi counter sifirla
export function resetMocks() {
  docCounter = 0;
  resetStore();
  mockRunTransaction.mockClear();
  mockRunTransaction.operations.length = 0;
  mockRunTransaction.committed = false;
  mockDoc.mockClear();
  mockCollection.mockClear();
  mockAddDoc.mockClear();
  mockDeleteDoc.mockClear();
  mockUpdateDoc.mockClear();
  mockGetDoc.mockClear();
  mockGetDoc.mockImplementation(() =>
    Promise.resolve({
      exists() {
        return true;
      },
      data() {
        return { desc: 'Muayene', amount: 80, customerId: 'cust1' };
      }
    })
  );
}
