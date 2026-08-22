import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import CustomerDetail from './CustomerDetail';
import {
  renderWithCustomer, makeDrug, makeServiceDebt, makeDrugDebt
} from '../../test/renderWithCustomer';

const openDetail = (value) => renderWithCustomer(<CustomerDetail onBack={vi.fn()} />, { value });

/** Islem karti varsayilan kapali; ozet satirina tiklayarak acilir. */
const expandCard = () => fireEvent.click(screen.getByRole('button', { name: /kalem/ }));

describe('CustomerDetail — islem karti', () => {
  it('karma grupta hizmet ve ilac kalemleri tek kartta birlikte render edilir', () => {
    openDetail({
      drugs: [makeDrug()],
      serviceDebts: [makeServiceDebt({ batchId: 'b1', desc: 'Muayene', amount: 500 })],
      drugDebts: [makeDrugDebt({ batchId: 'b1', qty: 2, maxPrice: 100 })]
    });

    // Ozet satiri: iki kalem tek kartta
    expect(screen.getByRole('button', { name: /2 kalem/ })).toBeInTheDocument();

    expandCard();

    expect(screen.getByText('HİZMET')).toBeInTheDocument();
    expect(screen.getByText('Muayene')).toBeInTheDocument();
    expect(screen.getByText('Amoksisilin')).toBeInTheDocument();
  });

  it('karma grupta kilit ve iade eylemleri gorunur', () => {
    openDetail({
      drugs: [makeDrug()],
      serviceDebts: [makeServiceDebt({ batchId: 'b1' })],
      drugDebts: [makeDrugDebt({ batchId: 'b1' })]
    });
    expandCard();

    expect(screen.getByRole('button', { name: /Tümünü Sabitle/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Toplu İade/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Grup Ekstresi/ })).toBeInTheDocument();
  });

  it('hizmet-only grupta kilit ve iade butonlari yoktur', () => {
    openDetail({
      drugs: [makeDrug()],
      serviceDebts: [makeServiceDebt({ batchId: 'b1' })],
      drugDebts: []
    });
    expandCard();

    // Hizmet borcu iade edilmez, iptal edilir; kilit yalnizca ilac icin anlamli
    expect(screen.queryByRole('button', { name: /Tümünü Sabitle/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Toplu İade/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Grup Ekstresi/ })).toBeInTheDocument();
  });

  it('grup eylemi yalnizca ilac kalemleriyle cagrilir', () => {
    const onToggleBatchLock = vi.fn();
    openDetail({
      drugs: [makeDrug()],
      serviceDebts: [makeServiceDebt({ batchId: 'b1' })],
      drugDebts: [makeDrugDebt({ batchId: 'b1' })],
      onToggleBatchLock
    });
    expandCard();

    fireEvent.click(screen.getByRole('button', { name: /Tümünü Sabitle/ }));

    const items = onToggleBatchLock.mock.calls[0][0];
    expect(items).toHaveLength(1);
    expect(items[0].type).toBe('drug');
  });

  it('ayni tarihli eski kayitlar tek kartta, farkli tarihliler ayri kartlarda toplanir', () => {
    openDetail({
      drugs: [makeDrug()],
      serviceDebts: [makeServiceDebt({ id: 'svc1', batchId: undefined, date: '2024-05-14' })],
      drugDebts: [
        makeDrugDebt({ id: 'dd1', batchId: undefined, date: '2024-05-14' }),
        makeDrugDebt({ id: 'dd2', batchId: undefined, date: '2024-05-15' })
      ]
    });

    expect(screen.getByRole('button', { name: /2 kalem/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /1 kalem/ })).toBeInTheDocument();
  });
});
