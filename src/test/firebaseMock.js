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

/** deleteServiceDebtOperations vb. icin */
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

// Her test oncesi counter sifirla
export function resetMocks() {
  docCounter = 0;
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
