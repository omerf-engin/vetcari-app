import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PriceImpactModal from './PriceImpactModal';
import { computePriceImpact, computeRevertImpact } from '../../utils/priceImpact';

const customers = [{ id: 'c1', name: 'Ahmet' }, { id: 'c2', name: 'Ayşe' }];
const drug = { id: 'drug1', name: 'Amoksisilin', price: 100 };

const debts = [
  { id: 'd1', drugId: 'drug1', customerId: 'c1', qty: 2, maxPrice: 100, isFixed: false },
  { id: 'd2', drugId: 'drug1', customerId: 'c2', qty: 3, maxPrice: 100, isFixed: false }
];

const openModal = (mode, impact, newPrice) => {
  const onConfirm = vi.fn();
  const onClose = vi.fn();
  render(
    <PriceImpactModal
      mode={mode}
      drugName={drug.name}
      oldPrice={drug.price}
      newPrice={newPrice}
      impact={impact}
      onConfirm={onConfirm}
      onClose={onClose}
    />
  );
  return { onConfirm, onClose };
};

describe('PriceImpactModal', () => {
  it('zam modunda etkilenen musterileri ve toplam artisi gosterir', () => {
    const impact = computePriceImpact(drug, 200, debts, customers);
    openModal('increase', impact, 200);

    expect(screen.getByText('Fiyat Artışı')).toBeInTheDocument();
    expect(screen.getByText('Ahmet')).toBeInTheDocument();
    expect(screen.getByText('Ayşe')).toBeInTheDocument();
    expect(screen.getByText('500 ₺')).toBeInTheDocument(); // toplam artis
    expect(screen.getByText(/2 müşterinin/)).toBeInTheDocument();
  });

  it('zam modunda dususun geri getirmeyecegini soyler', () => {
    openModal('increase', computePriceImpact(drug, 200, debts, customers), 200);

    expect(screen.getByText(/sonradan düşürmek bu borçları geri indirmez/)).toBeInTheDocument();
  });

  it('zamdan korunan borclari da listeler', () => {
    const withFixed = [debts[0], { ...debts[1], isFixed: true }];
    const impact = computePriceImpact(drug, 200, withFixed, customers);
    openModal('increase', impact, 200);

    expect(screen.getByText(/Etkilenmeyecek Borçlar \(1\)/)).toBeInTheDocument();
    expect(screen.getByText('SABİT')).toBeInTheDocument();
  });

  it('hicbir borcu etkilemeyen artista "0 musteri" demez', () => {
    // Borclarin baz fiyati yeni fiyatin ustunde: artis hicbir seye yansimaz
    const higher = [{ ...debts[0], maxPrice: 500 }];
    const impact = computePriceImpact({ ...drug, price: 100 }, 200, higher, customers);
    openModal('increase', impact, 200);

    expect(screen.getByText(/hiçbir açık borca yansımıyor/)).toBeInTheDocument();
    expect(screen.queryByText(/0 müşterinin/)).not.toBeInTheDocument();
  });

  it('dusus modunda borclarin eski fiyatta kalacagini gosterir', () => {
    const impact = computePriceImpact(drug, 50, debts, customers);
    openModal('decrease', impact, 50);

    expect(screen.getByText('Fiyat Düşüşü')).toBeInTheDocument();
    expect(screen.getByText(/açık borçlara/)).toBeInTheDocument();
    expect(screen.getByText('2 kayıt')).toBeInTheDocument();
    expect(screen.getByText('Ahmet')).toBeInTheDocument();
  });

  it('geri alma modunda donulecek tutarlari gosterir', () => {
    const batch = {
      logs: [{ debtId: 'd1', maxPriceBefore: 100, maxPriceAfter: 200, drugPriceBefore: 100 }]
    };
    const impact = computeRevertImpact(batch, [{ ...debts[0], maxPrice: 200 }], customers);
    openModal('revert', impact, 100);

    expect(screen.getByText('Zammı Geri Al')).toBeInTheDocument();
    expect(screen.getByText(/zam öncesi değerine dönecek/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Geri Almayı Onayla/ })).toBeInTheDocument();
  });

  it('onaylandiginda onConfirm ve onClose cagrilir', () => {
    const impact = computePriceImpact(drug, 200, debts, customers);
    const { onConfirm, onClose } = openModal('increase', impact, 200);

    fireEvent.click(screen.getByRole('button', { name: /Zammı Uygula/ }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('vazgecildiginde yazma tetiklenmez', () => {
    const impact = computePriceImpact(drug, 200, debts, customers);
    const { onConfirm, onClose } = openModal('increase', impact, 200);

    fireEvent.click(screen.getByRole('button', { name: 'Vazgeç' }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
