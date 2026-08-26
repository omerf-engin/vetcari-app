import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CancelBatchModal from './CancelBatchModal';
import { makeGroup, makeDrugItem, makeServiceItem } from '../../test/renderWithCustomer';

const mixedGroup = () => makeGroup([
  makeServiceItem({ id: 'svc1', desc: 'Muayene', amount: 500 }),
  makeDrugItem({ id: 'dd1', drugName: 'Amoksisilin', qty: 2, maxPrice: 100 })
]);

const openModal = (group = mixedGroup()) => {
  const onConfirm = vi.fn();
  const onClose = vi.fn();
  render(<CancelBatchModal group={group} onConfirm={onConfirm} onClose={onClose} />);
  return { onConfirm, onClose };
};

const confirmButton = () => screen.getByRole('button', { name: /İptali Onayla/ });
const reasonInput = () => screen.getByLabelText(/İptal Gerekçesi/);

describe('CancelBatchModal', () => {
  it('iptal edilecek kalemleri ve toplami listeler', () => {
    openModal();

    expect(screen.getByText('HİZMET')).toBeInTheDocument();
    expect(screen.getByText('Muayene')).toBeInTheDocument();
    expect(screen.getByText('Amoksisilin')).toBeInTheDocument();
    expect(screen.getByText('700 ₺')).toBeInTheDocument(); // 500 + 2 × 100
  });

  it('gerekce bosken onay pasiftir', () => {
    openModal();

    expect(confirmButton()).toBeDisabled();
  });

  it('yalnizca bosluktan olusan gerekce kabul edilmez', () => {
    openModal();

    fireEvent.change(reasonInput(), { target: { value: '   ' } });

    expect(confirmButton()).toBeDisabled();
  });

  it('gerekce girilince onay aktiflesir ve gerekce iletilir', () => {
    const { onConfirm, onClose } = openModal();

    fireEvent.change(reasonInput(), { target: { value: '  Yanlış müşteriye girildi  ' } });
    expect(confirmButton()).toBeEnabled();

    fireEvent.click(confirmButton());

    expect(onConfirm).toHaveBeenCalledWith('Yanlış müşteriye girildi'); // trim edilmis
    expect(onClose).toHaveBeenCalled();
  });

  it('loglarin silinmeyecegini kullaniciya soyler', () => {
    openModal();

    expect(screen.getByText(/iptal edilmiş/)).toBeInTheDocument();
  });

  it('supurulmus islemde "0 ₺" yerine "Yok" gosterir', () => {
    openModal(makeGroup([], { total: 0 }));

    expect(screen.getByText('Borç Kaydı')).toBeInTheDocument();
    expect(screen.getByText('Yok')).toBeInTheDocument();
    expect(screen.queryByText('0 ₺')).not.toBeInTheDocument();
    expect(screen.getByText(/açık borç kaydı kalmamış/)).toBeInTheDocument();
  });
});
