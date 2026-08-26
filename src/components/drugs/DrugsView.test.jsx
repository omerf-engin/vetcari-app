import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DrugsView from './DrugsView';

const drug = { id: 'drug1', name: 'Amoksisilin', price: 100 };
const customers = [{ id: 'c1', name: 'Ahmet' }];

const openDebt = (over = {}) => ({
  id: 'd1', drugId: 'drug1', customerId: 'c1', qty: 2, maxPrice: 100, isFixed: false, ...over
});

const priceLog = (over = {}) => ({
  id: 'l1', kind: 'price', drugId: 'drug1', debtId: 'd1', batchId: 'p1', timestamp: 1000,
  maxPriceBefore: 100, maxPriceAfter: 200, drugPriceBefore: 100, drugPriceAfter: 200, ...over
});

const renderView = (props = {}) => {
  const handlers = {
    onUpdatePrice: vi.fn(),
    onRevertPrice: vi.fn(),
    onAddDrug: vi.fn(),
    onDeleteDrug: vi.fn()
  };
  render(
    <DrugsView
      drugs={[drug]}
      drugDebts={[]}
      customers={customers}
      transactions={[]}
      {...handlers}
      {...props}
    />
  );
  return handlers;
};

/** Fiyat duzenleme moduna gecip yeni fiyati yazar ve kaydeder. */
const editPrice = (value) => {
  fireEvent.click(screen.getByRole('button', { name: /Fiyatı Güncelle/ }));
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value } });
  fireEvent.click(screen.getByRole('button', { name: /Kaydet/ }));
};

describe('DrugsView — fiyat degisikligi', () => {
  it('acik borc yokken modal acmadan dogrudan kaydeder', () => {
    const { onUpdatePrice } = renderView({ drugDebts: [] });

    editPrice('200');

    expect(onUpdatePrice).toHaveBeenCalledWith('drug1', 200);
    expect(screen.queryByText('Fiyat Artışı')).not.toBeInTheDocument();
  });

  it('acik borc varken once onay modali acar, yazma yapmaz', () => {
    const { onUpdatePrice } = renderView({ drugDebts: [openDebt()] });

    editPrice('200');

    expect(screen.getByText('Fiyat Artışı')).toBeInTheDocument();
    expect(screen.getByText('Ahmet')).toBeInTheDocument();
    expect(onUpdatePrice).not.toHaveBeenCalled();
  });

  it('modal onaylandiginda fiyat yazilir', () => {
    const { onUpdatePrice } = renderView({ drugDebts: [openDebt()] });

    editPrice('200');
    fireEvent.click(screen.getByRole('button', { name: /Zammı Uygula/ }));

    expect(onUpdatePrice).toHaveBeenCalledWith('drug1', 200);
  });

  it('fiyat dususunde de bilgilendirme modali acilir', () => {
    const { onUpdatePrice } = renderView({ drugDebts: [openDebt()] });

    editPrice('50');

    expect(screen.getByText('Fiyat Düşüşü')).toBeInTheDocument();
    expect(onUpdatePrice).not.toHaveBeenCalled();
  });

  it('sabitlenmis borc zamdan etkilenmez ve korunanlar listesinde gosterilir', () => {
    renderView({ drugDebts: [openDebt({ isFixed: true })] });

    editPrice('200');

    expect(screen.getByText('Fiyat Artışı')).toBeInTheDocument();
    expect(screen.getByText('Etkilenen açık borç yok.')).toBeInTheDocument();
    expect(screen.getByText(/Etkilenmeyecek Borçlar \(1\)/)).toBeInTheDocument();
    expect(screen.getByText('SABİT')).toBeInTheDocument();
  });
});

describe('DrugsView — son zammi geri al', () => {
  it('geri alinabilir zam yoksa buton gorunmez', () => {
    renderView({ drugDebts: [openDebt()], transactions: [] });

    expect(screen.queryByRole('button', { name: /Son Zammı Geri Al/ })).not.toBeInTheDocument();
  });

  it('dokunulmamis son zam icin buton gorunur', () => {
    renderView({ drugDebts: [openDebt({ maxPrice: 200 })], transactions: [priceLog()] });

    expect(screen.getByRole('button', { name: /Son Zammı Geri Al/ })).toBeInTheDocument();
  });

  it('zamdan sonra tahsilat inmisse buton pasif ve sebebi yazili', () => {
    renderView({
      drugDebts: [openDebt({ maxPrice: 200 })],
      transactions: [priceLog(), { id: 'l2', debtId: 'd1', kind: 'payment', timestamp: 2000 }]
    });

    expect(screen.getByRole('button', { name: /Son Zammı Geri Al/ })).toBeDisabled();
    expect(screen.getByText(/Zamdan sonra bu borçlara tahsilat/)).toBeInTheDocument();
  });

  it('zam zaten geri alinmissa buton hic gorunmez', () => {
    // `not-latest`: kalici pasif bir buton birakmak yerine tamamen gizlenir
    renderView({
      drugDebts: [openDebt()],
      transactions: [
        priceLog(),
        { id: 'l2', kind: 'price', drugId: 'drug1', debtId: 'd1', batchId: 'rev1', timestamp: 2000 }
      ]
    });

    expect(screen.queryByRole('button', { name: /Son Zammı Geri Al/ })).not.toBeInTheDocument();
  });

  it('geri alma onaylandiginda grubun loglariyla cagrilir', () => {
    const { onRevertPrice } = renderView({
      drugDebts: [openDebt({ maxPrice: 200 })],
      transactions: [priceLog()]
    });

    fireEvent.click(screen.getByRole('button', { name: /Son Zammı Geri Al/ }));
    fireEvent.click(screen.getByRole('button', { name: /Geri Almayı Onayla/ }));

    expect(onRevertPrice).toHaveBeenCalledTimes(1);
    const [drugId, logs] = onRevertPrice.mock.calls[0];
    expect(drugId).toBe('drug1');
    expect(logs.map(l => l.debtId)).toEqual(['d1']);
  });
});
