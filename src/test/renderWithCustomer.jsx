import { render } from '@testing-library/react';
import { vi } from 'vitest';
import { CustomerProvider } from '../contexts/CustomerContext';

// --- Sahte veri kurucular ---
// Hepsi override alir; testler yalnizca ilgilendikleri alani belirtir.

export const makeCustomer = (over = {}) => ({
  id: 'cust1', name: 'Test Musteri', balance: 0, userId: 'uid1', ...over
});

export const makeDrug = (over = {}) => ({
  id: 'drug1', name: 'Amoksisilin', price: 100, userId: 'uid1', ...over
});

export const makeServiceDebt = (over = {}) => ({
  id: 'svc1', customerId: 'cust1', desc: 'Muayene', amount: 500,
  date: '2026-08-12', createdAt: 1000, userId: 'uid1', ...over
});

export const makeDrugDebt = (over = {}) => ({
  id: 'dd1', customerId: 'cust1', drugId: 'drug1', qty: 2, maxPrice: 100,
  isFixed: false, date: '2026-08-12', createdAt: 1000, userId: 'uid1', ...over
});

/**
 * `groupDebtsByBatch` ciktisiyla ayni sekilde bir grup uretir — BatchReturnModal
 * gibi grubu dogrudan prop olarak alan bilesenler icin.
 */
export const makeGroup = (items, over = {}) => ({
  batchId: 'b1',
  date: '2026-08-12',
  createdAt: 1000,
  items,
  itemCount: items.length,
  total: items.reduce((s, i) => s + (i.type === 'service' ? i.amount : i.tlValue ?? i.qty * i.maxPrice), 0),
  hasService: items.some(i => i.type === 'service'),
  hasDrug: items.some(i => i.type === 'drug'),
  hasFixed: items.some(i => i.type === 'drug' && i.isFixed),
  allFixed: items.some(i => i.type === 'drug') && items.every(i => i.type !== 'drug' || i.isFixed),
  ...over
});

/** Gruptaki bir ilac kalemi — CustomerDetail'in zenginlestirdigi satirla ayni sekil. */
export const makeDrugItem = (over = {}) => {
  const debt = makeDrugDebt(over);
  return { ...debt, type: 'drug', drugName: 'Amoksisilin', tlValue: debt.qty * debt.maxPrice, ...over };
};

export const makeServiceItem = (over = {}) => ({ ...makeServiceDebt(over), type: 'service' });

/**
 * Bileseni `CustomerProvider` icinde render eder. Context degerleri ve sahte
 * handler'lar override edilebilir; kullanilan handler'lar `context` uzerinden okunur.
 */
export function renderWithCustomer(ui, { value = {} } = {}) {
  const contextValue = {
    customer: makeCustomer(),
    drugs: [],
    serviceDebts: [],
    drugDebts: [],
    transactions: [],
    onToggleLock: vi.fn(),
    onReturnDrug: vi.fn(),
    onCancelItem: vi.fn(),
    onToggleBatchLock: vi.fn(),
    onReturnBatch: vi.fn(),
    onApplyPayment: vi.fn(),
    onAddDebtTransaction: vi.fn(),
    ...value
  };

  return {
    ...render(<CustomerProvider value={contextValue}>{ui}</CustomerProvider>),
    context: contextValue
  };
}
