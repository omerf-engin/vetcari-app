import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Katalog kancasi mock'lanir: gercek Firestore baglantisi birim testinde olmaz.
const catalogState = { catalog: [], loading: false, error: null };
vi.mock('../../hooks/useDrugCatalog', () => ({
  useDrugCatalog: () => catalogState,
}));

import CatalogPicker from './CatalogPicker';

const CATALOG = [
  {
    catalogId: 'r-arma-biyokan#100 ML', urunId: 'r-arma-biyokan',
    name: 'Biyokan LA Enjeksiyonluk Çözelti - 100 ml', firma: 'Arma İlaç',
    form: 'Enjeksiyonluk Çözelti', unit: '100 ML', etkenMaddeler: ['Amoksisilin'],
  },
  {
    catalogId: 'r-arma-biyokan#250 ML', urunId: 'r-arma-biyokan',
    name: 'Biyokan LA Enjeksiyonluk Çözelti - 250 ml', firma: 'Arma İlaç',
    form: 'Enjeksiyonluk Çözelti', unit: '250 ML', etkenMaddeler: ['Amoksisilin'],
  },
  {
    catalogId: 'p-elanco-advantix', urunId: 'p-elanco-advantix',
    name: 'ADVANTİX 4×4 ML', firma: 'ELANCO', form: 'Spot-On',
    etkenMaddeler: ['İmidakloprid', 'Permetrin'],
  },
];

const setup = ({ drugs = [], catalog = CATALOG, loading = false, error = null } = {}) => {
  Object.assign(catalogState, { catalog, loading, error });
  const onSelect = vi.fn();
  render(<CatalogPicker drugs={drugs} onSelect={onSelect} />);
  return { onSelect, input: screen.getByRole('combobox') };
};

const type = (input, value) => fireEvent.change(input, { target: { value } });

beforeEach(() => {
  Object.assign(catalogState, { catalog: [], loading: false, error: null });
});

describe('CatalogPicker', () => {
  it('yazinca katalogda arar', () => {
    const { input } = setup();
    type(input, 'biyokan');
    expect(screen.getAllByRole('option')).toHaveLength(2);
  });

  it('firma ve etken madde uzerinden de bulur', () => {
    const { input } = setup();

    type(input, 'elanco');
    expect(screen.getByRole('option')).toHaveTextContent('ADVANTİX');

    type(input, 'imidakloprid');
    expect(screen.getByRole('option')).toHaveTextContent('ADVANTİX');
  });

  it('acma dugmesi yazmadan tum katalogu gosterir', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Tüm katalogu göster' }));
    expect(screen.getAllByRole('option')).toHaveLength(3);
  });

  it('secim onSelect ile katalog dokumanini gonderir', () => {
    const { onSelect, input } = setup();
    type(input, '250');
    fireEvent.click(screen.getByRole('option'));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0].catalogId).toBe('r-arma-biyokan#250 ML');
  });

  // KESIN mukerrer katmani
  it('listede olan katalog kalemi PASIF ve gerekcesi yazili', () => {
    const drugs = [{ id: 'd1', name: 'Biyokan 100', price: 1812, catalogId: 'r-arma-biyokan#100 ML' }];
    const { onSelect, input } = setup({ drugs });
    type(input, 'biyokan');

    const options = screen.getAllByRole('option');
    const disabled = options.find(o => o.getAttribute('aria-disabled') === 'true');

    expect(disabled).toBeDefined();
    expect(disabled).toBeDisabled();
    expect(disabled).toHaveTextContent('Listende zaten var');
    expect(disabled).toHaveTextContent('1.812'); // mevcut fiyat kullaniciya gosterilir

    fireEvent.click(disabled);
    expect(onSelect).not.toHaveBeenCalled();
  });

  // Bilesik kimligin varlik sebebi
  it('ayni urunun farkli ambalaji ENGELLENMEZ', () => {
    const drugs = [{ id: 'd1', name: 'Biyokan 100', price: 1812, catalogId: 'r-arma-biyokan#100 ML' }];
    const { onSelect, input } = setup({ drugs });
    type(input, '250');

    const option = screen.getByRole('option');
    expect(option).not.toBeDisabled();

    fireEvent.click(option);
    expect(onSelect.mock.calls[0][0].catalogId).toBe('r-arma-biyokan#250 ML');
  });

  // OLASI mukerrer katmani — uyarir, engellemez
  it('elle girilmis benzer ad UYARIR ama secimi engellemez', () => {
    const drugs = [{ id: 'd1', name: 'ADVANTIX 4X4 ML', price: 500 }]; // catalogId yok
    const { onSelect, input } = setup({ drugs });
    type(input, 'advantix');

    const option = screen.getByRole('option');
    // "Ayni olabilir" DEMEZ: esleme urun ailesi duzeyinde, ambalaj duzeyinde degil
    expect(option).toHaveTextContent('Listende benzer kayıt');
    expect(option).not.toBeDisabled();

    fireEvent.click(option);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  // Mutasyon denetiminde SIZAN yol: tiklama HTML `disabled` oznitelig sayesinde engelleniyor,
  // ama klavye o oznitelig baypas eder — yalnizca useCombobox'taki isDisabled guard'i durdurur.
  it('pasif satir KLAVYEYLE de secilemez', () => {
    const drugs = [{ id: 'd1', name: 'Biyokan 100', price: 1812, catalogId: 'r-arma-biyokan#100 ML' }];
    const { onSelect, input } = setup({ drugs });

    type(input, 'biyokan 100');
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveAttribute('aria-disabled', 'true');

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('pasif satiri atlayip sonraki secilebilir satir klavyeyle secilir', () => {
    const drugs = [{ id: 'd1', name: 'Biyokan 100', price: 1812, catalogId: 'r-arma-biyokan#100 ML' }];
    const { onSelect, input } = setup({ drugs });

    type(input, 'biyokan');
    fireEvent.keyDown(input, { key: 'ArrowDown' }); // pasif olandan sonrakine gec
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0].catalogId).toBe('r-arma-biyokan#250 ML');
  });

  it('eslesme yoksa elle eklemeye yonlendirir', () => {
    const { input } = setup();
    type(input, 'zzzz');
    expect(screen.getByText(/elle ekleyebilirsiniz/)).toBeInTheDocument();
  });

  // Bos liste sessiz kalmamali
  it('yuklenirken durum gorunur ve alan pasiftir', () => {
    const { input } = setup({ loading: true });
    expect(screen.getByText(/Katalog yükleniyor/)).toBeInTheDocument();
    expect(input).toBeDisabled();
  });

  it('hata durumunda cevrimdisi olabilecegini soyler ve elle eklemeye yonlendirir', () => {
    const { input } = setup({ error: new Error('offline') });
    expect(screen.getByText(/çevrimdışı olabilirsiniz/)).toBeInTheDocument();
    expect(input).toBeDisabled();
  });

  it('katalog bossa bunu soyler', () => {
    setup({ catalog: [] });
    expect(screen.getByText('Katalog boş.')).toBeInTheDocument();
  });
});
