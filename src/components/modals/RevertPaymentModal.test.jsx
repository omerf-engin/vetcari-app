import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RevertPaymentModal from './RevertPaymentModal';

const drugLog = (over = {}) => ({
  id: 'l1', debtId: 'd1', deduct: 200, qtyDeducted: 2,
  before: { customerId: 'c1', drugId: 'drug1', qty: 5, maxPrice: 100, isFixed: false },
  ...over
});

const serviceLog = (over = {}) => ({
  id: 'l2', debtId: 's1', deduct: 300,
  before: { customerId: 'c1', desc: 'Muayene', amount: 500 },
  ...over
});

const makeBatch = (over = {}) => {
  const debtLogs = over.debtLogs ?? [drugLog()];
  return {
    batchId: 'p1',
    logs: debtLogs,
    debtLogs,
    balanceDelta: 0,
    totalDeducted: debtLogs.reduce((s, l) => s + (l.deduct || 0), 0),
    ...over
  };
};

const openModal = (batch = makeBatch()) => {
  const onConfirm = vi.fn();
  const onClose = vi.fn();
  render(<RevertPaymentModal batch={batch} onConfirm={onConfirm} onClose={onClose} />);
  return { onConfirm, onClose };
};

const confirmButton = () => screen.getByRole('button', { name: /Geri Almayı Onayla/ });

describe('RevertPaymentModal', () => {
  it('geri yuklenecek borclari ve donecekleri tutari listeler', () => {
    openModal(makeBatch({ debtLogs: [drugLog(), serviceLog()] }));

    expect(screen.getByText('HİZMET')).toBeInTheDocument();
    expect(screen.getByText('Muayene')).toBeInTheDocument();
    expect(screen.getByText(/5 adet · 500 ₺/)).toBeInTheDocument();
  });

  it('gerekce bosken onay pasiftir', () => {
    openModal();

    expect(confirmButton()).toBeDisabled();
  });

  it('yalnizca bosluktan olusan gerekce kabul edilmez', () => {
    openModal();

    fireEvent.change(screen.getByLabelText(/Geri Alma Gerekçesi/), { target: { value: '   ' } });

    expect(confirmButton()).toBeDisabled();
  });

  it('gerekce girilince onay aktiflesir ve gerekce trim edilerek iletilir', () => {
    const { onConfirm, onClose } = openModal();

    fireEvent.change(screen.getByLabelText(/Geri Alma Gerekçesi/), {
      target: { value: '  Yanlış müşteriye girildi  ' }
    });
    fireEvent.click(confirmButton());

    expect(onConfirm).toHaveBeenCalledWith('Yanlış müşteriye girildi');
    expect(onClose).toHaveBeenCalled();
  });

  it('avansa yazilan tutari ayrica belirtir', () => {
    openModal(makeBatch({ balanceDelta: 400 }));

    expect(screen.getByText(/Avansa yazılan/)).toBeInTheDocument();
    expect(screen.getByText('600 ₺')).toBeInTheDocument(); // 200 dusum + 400 avans
  });

  it('kullanilan avansi iade olarak anlatir', () => {
    openModal(makeBatch({ balanceDelta: -500 }));

    expect(screen.getByText(/avans iade edilecek/)).toBeInTheDocument();
  });

  it('yalnizca avansa yazilmis tahsilatta borc listesi gosterilmez', () => {
    openModal(makeBatch({ debtLogs: [], balanceDelta: 500 }));

    expect(screen.queryByText('Geri Yüklenecek Borçlar')).not.toBeInTheDocument();
    expect(screen.getByText(/Avansa yazılan/)).toBeInTheDocument();
  });

  it('loglarin silinmeyecegini soyler', () => {
    openModal();

    expect(screen.getByText(/silinmez/)).toBeInTheDocument();
  });
});
