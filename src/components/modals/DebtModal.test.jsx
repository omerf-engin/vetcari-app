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
const searchInput = () => screen.getByRole('combobox');

/** Aramadan kalem ekler — kullanicinin gercek yolu (satir ekleme dugmesi artik yok). */
const pickDrug = (name) => {
  fireEvent.change(searchInput(), { target: { value: name } });
  fireEvent.click(screen.getByRole('option', { name: new RegExp(name, 'i') }));
};

describe('DebtModal', () => {
  it('ilac sekmesi bos baslar; on-secili kalem yoktur', () => {
    openModal();
    goToDrugTab();

    // On-secim olsaydi yalnizca hizmet girmek isteyen kullaniciya ilac borcu yazilirdi
    expect(screen.getByText(/Henüz kalem eklenmedi/)).toBeInTheDocument();
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
    pickDrug('Amoksisilin');

    fireEvent.click(saveButton());

    const payload = onAddDebtTransaction.mock.calls[0][0];
    expect(payload.service).toBeNull();
    expect(payload.drugItems).toEqual([{ drugId: 'drug1', qty: 1, unitPrice: 100 }]);
  });

  it('sekme degistirince iki bolumun ozeti de footer da kalir', () => {
    openModal();

    fillService('Muayene', '500');
    goToDrugTab();
    pickDrug('Amoksisilin');

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
    pickDrug('Amoksisilin');
    fireEvent.click(saveButton());

    expect(onAddDebtTransaction).toHaveBeenCalledTimes(1);
    const payload = onAddDebtTransaction.mock.calls[0][0];
    expect(payload.service).toMatchObject({ desc: 'Muayene', amount: 500 });
    expect(payload.drugItems).toHaveLength(1);
    expect(onClose).toHaveBeenCalled();
  });

  it('ayni ilac ikinci kez secilirse adet artar, ikinci satir acilmaz', () => {
    const onAddDebtTransaction = vi.fn();
    openModal({ onAddDebtTransaction });
    goToDrugTab();

    pickDrug('Amoksisilin');
    pickDrug('Amoksisilin');

    // Duplikat satir yerine adet artisi: tek satir, adet 2
    expect(screen.getAllByLabelText('Adet')).toHaveLength(1);
    expect(screen.getByLabelText('Adet')).toHaveValue(2);

    fireEvent.click(saveButton());
    expect(onAddDebtTransaction.mock.calls[0][0].drugItems)
      .toEqual([{ drugId: 'drug1', qty: 2, unitPrice: 100 }]);
  });

  it('kalemler eklendikleri sirada kalir — yuvarlama artigi son satira gidiyor', () => {
    const onAddDebtTransaction = vi.fn();
    openModal({
      onAddDebtTransaction,
      drugs: [
        makeDrug(),
        makeDrug({ id: 'drug2', name: 'Penisilin', price: 50 }),
        makeDrug({ id: 'drug3', name: 'Vitamin', price: 25 })
      ]
    });
    goToDrugTab();

    pickDrug('Vitamin');
    pickDrug('Amoksisilin');
    pickDrug('Penisilin');

    fireEvent.click(saveButton());
    expect(onAddDebtTransaction.mock.calls[0][0].drugItems.map(i => i.drugId))
      .toEqual(['drug3', 'drug1', 'drug2']);
  });

  it('adimlayici adedi artirir ve azaltir', () => {
    openModal();
    goToDrugTab();
    pickDrug('Amoksisilin');

    fireEvent.click(screen.getByTitle('Adet artır'));
    expect(screen.getByLabelText('Adet')).toHaveValue(2);

    fireEvent.click(screen.getByTitle('Adet azalt'));
    expect(screen.getByLabelText('Adet')).toHaveValue(1);
  });

  it('kalem cikarilabilir', () => {
    openModal();
    goToDrugTab();
    pickDrug('Amoksisilin');
    expect(screen.getByLabelText('Adet')).toBeInTheDocument();

    fireEvent.click(screen.getByTitle('Kalemi Çıkar'));
    expect(screen.getByText(/Henüz kalem eklenmedi/)).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
  });

  it('Escape: sonuc listesi aciksa modal kapanmaz, kapaliyken kapanir', () => {
    const onClose = vi.fn();
    renderWithCustomer(<DebtModal mode="today" onClose={onClose} />, {
      value: { drugs: [makeDrug()] }
    });
    goToDrugTab();

    // Liste acik: Escape yalnizca listeyi kapatir, form durur
    fireEvent.change(searchInput(), { target: { value: 'amok' } });
    expect(searchInput()).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(searchInput(), { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    expect(searchInput()).toHaveAttribute('aria-expanded', 'false');

    // Liste kapali: Escape modali kapatir
    fireEvent.keyDown(searchInput(), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
