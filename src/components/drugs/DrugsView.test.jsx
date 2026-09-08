import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

// DrugsView -> CatalogPicker -> useDrugCatalog -> services/firebase zinciri, mock'lanmazsa
// birim testinden GERCEK Firestore'a baglanti acar.
// `vi.mock` fabrikasi yukari tasinir; sabitler `vi.hoisted` ile onunla birlikte tasinmali
const { CATALOG } = vi.hoisted(() => ({
  CATALOG: [{
    catalogId: 'r-arma-biyokan#250 ML', urunId: 'r-arma-biyokan',
    name: 'Biyokan LA Enjeksiyonluk Çözelti - 250 ml',
    firma: 'Arma İlaç', form: 'Enjeksiyonluk Çözelti', unit: '250 ML',
  }],
}));
vi.mock('../../hooks/useDrugCatalog', () => ({
  useDrugCatalog: () => ({ catalog: CATALOG, loading: false, error: null }),
}));

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

// --- Ilac ekleme akisi yardimcilari ---
const openAdd = () => fireEvent.click(screen.getByRole('button', { name: /Yeni İlaç Ekle/ }));
const nameInput = () => screen.getByPlaceholderText('İlaç Adı');
const priceInput = () => screen.getByPlaceholderText('Satış Fiyatı (₺)');
const submitAdd = () => fireEvent.click(screen.getByRole('button', { name: /^Ekle$/ }));

const pickFromCatalog = () => {
  // Rol tek basina yetmez: sinif suzgecindeki `<select>` de `combobox`, `<option>`lari da
  // `option` rolu tasir. Arama kutusu ADIYLA, sonuc satiri SONUC LISTESINDEN alinir.
  fireEvent.change(screen.getByRole('combobox', { name: 'Katalogdan Ara' }), { target: { value: 'biyokan' } });
  fireEvent.click(within(screen.getByRole('listbox')).getByRole('option'));
};

/** Fiyat duzenleme moduna gecip yeni fiyati yazar ve kaydeder. */
const editPrice = (value) => {
  fireEvent.click(screen.getByRole('button', { name: /Fiyatı Güncelle/ }));
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value } });
  fireEvent.click(screen.getByRole('button', { name: /Kaydet/ }));
};

// Bu akis TASK-037'de yeniden yapilandirildi ve o zaman KAPSAMSIZ kalmisti (denetimde bulundu)
describe('DrugsView — ilac ekleme', () => {
  it('elle eklemede katalog verisi gonderilmez', () => {
    const { onAddDrug } = renderView();
    openAdd();

    fireEvent.change(nameInput(), { target: { value: 'Elle Girilen İlaç' } });
    fireEvent.change(priceInput(), { target: { value: '250' } });
    submitAdd();

    expect(onAddDrug).toHaveBeenCalledWith('Elle Girilen İlaç', 250, undefined);
  });

  it('katalogdan secim adi doldurur ve cip gosterir', () => {
    renderView();
    openAdd();
    pickFromCatalog();

    expect(nameInput()).toHaveValue('Biyokan LA Enjeksiyonluk Çözelti - 250 ml');
    expect(screen.getByRole('button', { name: 'Vazgeç' })).toBeInTheDocument();
    expect(screen.getByText(/Arma İlaç · Enjeksiyonluk Çözelti · 250 ML/)).toBeInTheDocument();
  });

  it('katalogdan eklemede catalogId ve unit birlikte gonderilir', () => {
    const { onAddDrug } = renderView();
    openAdd();
    pickFromCatalog();

    fireEvent.change(priceInput(), { target: { value: '1200' } });
    submitAdd();

    expect(onAddDrug).toHaveBeenCalledWith(
      'Biyokan LA Enjeksiyonluk Çözelti - 250 ml',
      1200,
      { catalogId: 'r-arma-biyokan#250 ML', unit: '250 ML' }
    );
  });

  it('Vazgec secimi ve adi temizler, elle yazmaya birakir', () => {
    const { onAddDrug } = renderView();
    openAdd();
    pickFromCatalog();

    fireEvent.click(screen.getByRole('button', { name: 'Vazgeç' }));
    expect(nameInput()).toHaveValue('');

    fireEvent.change(nameInput(), { target: { value: 'Baska Ilac' } });
    fireEvent.change(priceInput(), { target: { value: '99' } });
    submitAdd();

    expect(onAddDrug).toHaveBeenCalledWith('Baska Ilac', 99, undefined);
  });

  it('Iptal tum durumu sifirlar', () => {
    renderView();
    openAdd();
    pickFromCatalog();
    fireEvent.change(priceInput(), { target: { value: '500' } });

    fireEvent.click(screen.getByRole('button', { name: 'İptal' }));
    expect(screen.queryByPlaceholderText('İlaç Adı')).not.toBeInTheDocument();

    openAdd();
    expect(nameInput()).toHaveValue('');
    expect(priceInput()).toHaveValue(null);
    expect(screen.queryByRole('button', { name: 'Vazgeç' })).not.toBeInTheDocument();
  });

  it('gecersiz fiyat yazma yapmaz', () => {
    const { onAddDrug } = renderView();
    openAdd();
    fireEvent.change(nameInput(), { target: { value: 'X' } });
    fireEvent.change(priceInput(), { target: { value: '0' } });
    submitAdd();

    expect(onAddDrug).not.toHaveBeenCalled();
  });

  it('ambalaj rozeti yalnizca unit tasiyan ilacta cizilir', () => {
    renderView({
      drugs: [
        { id: 'd1', name: 'Katalogdan', price: 100, catalogId: 'c1', unit: '250 ML' },
        { id: 'd2', name: 'Elle Girilen', price: 50 },
      ],
    });

    expect(screen.getByText('250 ML')).toBeInTheDocument();
    // Elle girilen satirda BOS ROZET olmamali
    const manualRow = screen.getAllByRole('row').find(r => r.textContent.includes('Elle Girilen'));
    expect(manualRow.querySelectorAll('span.rounded-full')).toHaveLength(0);
  });
});

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

  it('geri alma onaylandiginda ilac id si ile cagrilir', () => {
    const { onRevertPrice } = renderView({
      drugDebts: [openDebt({ maxPrice: 200 })],
      transactions: [priceLog()]
    });

    fireEvent.click(screen.getByRole('button', { name: /Son Zammı Geri Al/ }));
    fireEvent.click(screen.getByRole('button', { name: /Geri Almayı Onayla/ }));

    // Loglar bilincli olarak gecilmez: App guard'i yazimdan hemen once tekrar calistirip
    // taze grubu kullanir, modal'in anlik goruntusu bayat olabilir (TASK-033)
    expect(onRevertPrice).toHaveBeenCalledTimes(1);
    expect(onRevertPrice.mock.calls[0]).toEqual(['drug1']);
  });
});
