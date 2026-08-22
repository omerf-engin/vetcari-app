import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import DebtModal from './DebtModal';
import { renderWithCustomer, makeDrug } from '../../test/renderWithCustomer';

const openModal = (value = {}) =>
  renderWithCustomer(<DebtModal mode="today" onClose={vi.fn()} />, {
    value: { drugs: [makeDrug()], ...value }
  });

const fillService = (desc, amount) => {
  fireEvent.change(screen.getByPlaceholderText('Örn: Muayene'), { target: { value: desc } });
  fireEvent.change(screen.getByPlaceholderText('0.0'), { target: { value: amount } });
};

const goToDrugTab = () => fireEvent.click(screen.getByRole('button', { name: /İlaç \(Adet\)/ }));
const goToServiceTab = () => fireEvent.click(screen.getByRole('button', { name: /Hizmet \(TL\)/ }));
const saveButton = () => screen.getByRole('button', { name: /Kaydet/ });

describe('DebtModal', () => {
  it('ilk ilac satiri on-secili gelmez, yalnizca acilista Kaydet pasiftir', () => {
    openModal();
    goToDrugTab();

    // On-secim olsaydi yalnizca hizmet girmek isteyen kullaniciya ilac borcu yazilirdi
    expect(screen.getByRole('combobox')).toHaveValue('');
    expect(saveButton()).toBeDisabled();
    expect(screen.getByText('Hizmet veya ilaç bilgisi girin')).toBeInTheDocument();
  });

  it('yalnizca hizmet doluyken Kaydet aktiflesir ve drugItems bos gonderilir', () => {
    const onAddDebtTransaction = vi.fn();
    openModal({ onAddDebtTransaction });

    fillService('Muayene', '500');
    expect(saveButton()).toBeEnabled();

    fireEvent.click(saveButton());

    expect(onAddDebtTransaction).toHaveBeenCalledTimes(1);
    const payload = onAddDebtTransaction.mock.calls[0][0];
    expect(payload.service).toMatchObject({ desc: 'Muayene', amount: 500 });
    expect(payload.drugItems).toEqual([]);
  });

  it('yalnizca ilac doluyken hizmet null gonderilir', () => {
    const onAddDebtTransaction = vi.fn();
    openModal({ onAddDebtTransaction });

    goToDrugTab();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'drug1' } });

    fireEvent.click(saveButton());

    const payload = onAddDebtTransaction.mock.calls[0][0];
    expect(payload.service).toBeNull();
    expect(payload.drugItems).toEqual([{ drugId: 'drug1', qty: 1, unitPrice: 100 }]);
  });

  it('sekme degistirince iki bolumun ozeti de footer da kalir', () => {
    openModal();

    fillService('Muayene', '500');
    goToDrugTab();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'drug1' } });

    // Hizmet sekmesi unmount olsa da state korunur; footer ikisini birlikte sayar
    expect(screen.getByText(/1 hizmet \+ 1 ilaç kalemi/)).toBeInTheDocument();
    expect(screen.getByText('600 ₺')).toBeInTheDocument(); // 500 + 1 × 100

    // Hizmet sekmesine donuldugunde girilen veri hala orada
    goToServiceTab();
    expect(screen.getByPlaceholderText('Örn: Muayene')).toHaveValue('Muayene');
    expect(screen.getByText(/1 hizmet \+ 1 ilaç kalemi/)).toBeInTheDocument();
  });

  it('iki bolum de doluyken tek cagride birlikte gonderilir', () => {
    const onAddDebtTransaction = vi.fn();
    const onClose = vi.fn();
    renderWithCustomer(<DebtModal mode="today" onClose={onClose} />, {
      value: { drugs: [makeDrug()], onAddDebtTransaction }
    });

    fillService('Muayene', '500');
    goToDrugTab();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'drug1' } });
    fireEvent.click(saveButton());

    expect(onAddDebtTransaction).toHaveBeenCalledTimes(1);
    const payload = onAddDebtTransaction.mock.calls[0][0];
    expect(payload.service).toMatchObject({ desc: 'Muayene', amount: 500 });
    expect(payload.drugItems).toHaveLength(1);
    expect(onClose).toHaveBeenCalled();
  });

  it('ayni ilac iki satirda secilirse kaydetme engellenir', () => {
    openModal();
    goToDrugTab();

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'drug1' } });
    fireEvent.click(screen.getByRole('button', { name: /İlaç Satırı Ekle/ }));

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[1], { target: { value: 'drug1' } });

    expect(screen.getAllByText('Bu ilaç zaten listede mevcut.').length).toBeGreaterThan(0);
    expect(saveButton()).toBeDisabled();
  });
});
