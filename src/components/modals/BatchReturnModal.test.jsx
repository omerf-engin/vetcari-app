import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BatchReturnModal from './BatchReturnModal';
import { makeGroup, makeDrugItem, makeServiceItem } from '../../test/renderWithCustomer';

const mixedGroup = () => makeGroup([
  makeServiceItem({ id: 'svc1', desc: 'Muayene', amount: 500 }),
  makeDrugItem({ id: 'dd1', drugName: 'Amoksisilin', qty: 2, maxPrice: 100 }),
  makeDrugItem({ id: 'dd2', drugName: 'Vitamin B12', qty: 3, maxPrice: 50 })
]);

const openModal = (group = mixedGroup(), onConfirm = vi.fn()) => {
  const onClose = vi.fn();
  render(<BatchReturnModal group={group} onConfirm={onConfirm} onClose={onClose} />);
  return { onConfirm, onClose };
};

const confirmButton = () => screen.getByRole('button', { name: /İadeyi Onayla/ });
/** 0. checkbox "Tumunu sec"; kalanlar ilac satirlari */
const rowCheckboxes = () => screen.getAllByRole('checkbox').slice(1);

describe('BatchReturnModal', () => {
  it('hizmet kalemini listelemez, yalnizca ilac kalemleri secilebilir', () => {
    openModal();

    expect(screen.getByText('Amoksisilin')).toBeInTheDocument();
    expect(screen.getByText('Vitamin B12')).toBeInTheDocument();
    // Hizmet borcu iade edilmez, iptal edilir
    expect(screen.queryByText('Muayene')).not.toBeInTheDocument();
    expect(rowCheckboxes()).toHaveLength(2);
  });

  it('secim yokken onay pasiftir', () => {
    openModal();

    expect(confirmButton()).toBeDisabled();
    expect(screen.getByText('0 kalem seçili')).toBeInTheDocument();
  });

  it('kismi secimde yalnizca secili kalem gonderilir', () => {
    const { onConfirm, onClose } = openModal();

    fireEvent.click(rowCheckboxes()[0]);
    expect(confirmButton()).toBeEnabled();

    fireEvent.click(confirmButton());

    expect(onConfirm).toHaveBeenCalledTimes(1);
    const items = onConfirm.mock.calls[0][0];
    expect(items).toHaveLength(1);
    expect(items[0].debt.id).toBe('dd1');
    expect(items[0].returnQty).toBe(2);
    expect(onClose).toHaveBeenCalled();
  });

  it('tumunu sec yalnizca ilac kalemlerini isaretler', () => {
    const { onConfirm } = openModal();

    fireEvent.click(screen.getByLabelText('Tümünü seç'));
    expect(screen.getByText('2 kalem seçili')).toBeInTheDocument();

    fireEvent.click(confirmButton());
    expect(onConfirm.mock.calls[0][0].map(i => i.debt.id)).toEqual(['dd1', 'dd2']);
  });

  it('adet sifirlanirsa onay tekrar pasiflesir', () => {
    openModal();

    const qtyInputs = screen.getAllByRole('spinbutton');
    fireEvent.change(qtyInputs[0], { target: { value: '0' } });

    // Adet girisi satiri otomatik secer; gecersiz adet gonderimi engeller
    expect(confirmButton()).toBeDisabled();
  });

  it('mevcut borctan fazla adet girilirse avans uyarisi gosterir', () => {
    openModal();

    fireEvent.change(screen.getAllByRole('spinbutton')[0], { target: { value: '5' } });

    expect(screen.getByText(/avansa yazılacak/)).toBeInTheDocument();
    expect(confirmButton()).toBeEnabled();
  });
});
