import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

// Katalog kancasi mock'lanir: gercek Firestore baglantisi birim testinde olmaz.
const catalogState = { catalog: [], loading: false, error: null, fromCache: false };
vi.mock('../../hooks/useDrugCatalog', () => ({
  useDrugCatalog: () => catalogState,
}));

import CatalogPicker from './CatalogPicker';

const CATALOG = [
  {
    catalogId: 'r-arma-biyokan#100 ML', urunId: 'r-arma-biyokan',
    name: 'Biyokan LA Enjeksiyonluk Çözelti - 100 ml', firma: 'Arma İlaç',
    form: 'Enjeksiyonluk Çözelti', unit: '100 ML', etkenMaddeler: ['Amoksisilin'],
    bolum: 'ruminant', sinif: 'ilac',
  },
  {
    catalogId: 'r-arma-biyokan#250 ML', urunId: 'r-arma-biyokan',
    name: 'Biyokan LA Enjeksiyonluk Çözelti - 250 ml', firma: 'Arma İlaç',
    form: 'Enjeksiyonluk Çözelti', unit: '250 ML', etkenMaddeler: ['Amoksisilin'],
    bolum: 'ruminant', sinif: 'supplement',
  },
  {
    catalogId: 'p-elanco-advantix', urunId: 'p-elanco-advantix',
    name: 'ADVANTİX 4×4 ML', firma: 'ELANCO', form: 'Spot-On',
    etkenMaddeler: ['İmidakloprid', 'Permetrin'],
    bolum: 'pet', sinif: 'antiparaziter',
  },
];

const setup = ({ drugs = [], catalog = CATALOG, loading = false, error = null, fromCache = false } = {}) => {
  Object.assign(catalogState, { catalog, loading, error, fromCache });
  const onSelect = vi.fn();
  render(<CatalogPicker drugs={drugs} onSelect={onSelect} />);
  // ADLA daraltilir: `<select>` de ARIA'da `combobox` rolu tasir, rol tek basina yetmez
  return { onSelect, input: screen.getByRole('combobox', { name: 'Katalogdan Ara' }) };
};

const type = (input, value) => fireEvent.change(input, { target: { value } });

// Sonuc satirlari SONUC LISTESINDEN okunur. Genel `getAllByRole('option')` kullanilamaz:
// sinif suzgecindeki `<option>` etiketleri de ayni rolu tasir.
const options = () => {
  const list = screen.queryByRole('listbox');
  return list ? within(list).queryAllByRole('option') : [];
};
const option = () => {
  const all = options();
  if (all.length !== 1) throw new Error(`tek sonuc satiri bekleniyordu, ${all.length} bulundu`);
  return all[0];
};

beforeEach(() => {
  Object.assign(catalogState, { catalog: [], loading: false, error: null, fromCache: false });
});

describe('CatalogPicker', () => {
  it('yazinca katalogda arar', () => {
    const { input } = setup();
    type(input, 'biyokan');
    expect(options()).toHaveLength(2);
  });

  it('firma ve etken madde uzerinden de bulur', () => {
    const { input } = setup();

    type(input, 'elanco');
    expect(option()).toHaveTextContent('ADVANTİX');

    type(input, 'imidakloprid');
    expect(option()).toHaveTextContent('ADVANTİX');
  });

  it('acma dugmesi yazmadan tum katalogu gosterir', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Tüm katalogu göster' }));
    expect(options()).toHaveLength(3);
  });

  it('secim onSelect ile katalog dokumanini gonderir', () => {
    const { onSelect, input } = setup();
    type(input, '250');
    fireEvent.click(option());

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0].catalogId).toBe('r-arma-biyokan#250 ML');
  });

  // KESIN mukerrer katmani
  it('listede olan katalog kalemi PASIF ve gerekcesi yazili', () => {
    const drugs = [{ id: 'd1', name: 'Biyokan 100', price: 1812, catalogId: 'r-arma-biyokan#100 ML' }];
    const { onSelect, input } = setup({ drugs });
    type(input, 'biyokan');

    const rows = options();
    const disabled = rows.find(o => o.getAttribute('aria-disabled') === 'true');

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

    const row = option();
    expect(row).not.toBeDisabled();

    fireEvent.click(row);
    expect(onSelect.mock.calls[0][0].catalogId).toBe('r-arma-biyokan#250 ML');
  });

  // OLASI mukerrer katmani — uyarir, engellemez
  it('elle girilmis benzer ad UYARIR ama secimi engellemez', () => {
    const drugs = [{ id: 'd1', name: 'ADVANTIX 4X4 ML', price: 500 }]; // catalogId yok
    const { onSelect, input } = setup({ drugs });
    type(input, 'advantix');

    const row = option();
    // Ambalaj imzasi da tutuyor (4x4 == 4×4), o yuzden GUCLU not
    expect(row).toHaveTextContent('Listende aynı ambalaj var');
    expect(row).not.toBeDisabled();

    fireEvent.click(row);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  // TASK-039 B1: ambalaj tutmuyorsa "ayni" DENMEZ ama uyari da KAYBOLMAZ
  it('ambalaji tutmayan benzer kayit zayif notla uyarir', () => {
    const drugs = [{ id: 'd1', name: 'Biyokan LA Enjeksiyonluk Çözelti - 100 ml', price: 900 }];
    const { input } = setup({ drugs });
    type(input, '250');

    const row = option();
    expect(row).toHaveTextContent('Listende benzer kayıt');
    expect(row).not.toHaveTextContent('aynı ambalaj');
  });

  it('ambalaji tutan benzer kayit GUCLU notla uyarir', () => {
    const drugs = [{ id: 'd1', name: 'Biyokan LA Enjeksiyonluk Çözelti - 250 ml', price: 900 }];
    const { input } = setup({ drugs });
    type(input, '250');

    expect(option()).toHaveTextContent('Listende aynı ambalaj var');
  });

  // Mutasyon denetiminde SIZAN yol: tiklama HTML `disabled` oznitelig sayesinde engelleniyor,
  // ama klavye o oznitelig baypas eder — yalnizca useCombobox'taki isDisabled guard'i durdurur.
  it('pasif satir KLAVYEYLE de secilemez', () => {
    const drugs = [{ id: 'd1', name: 'Biyokan 100', price: 1812, catalogId: 'r-arma-biyokan#100 ML' }];
    const { onSelect, input } = setup({ drugs });

    type(input, 'biyokan 100');
    const rows = options();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveAttribute('aria-disabled', 'true');

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
    setup({ catalog: [], fromCache: false }); // SUNUCU bos dedi
    expect(screen.getByText('Katalog boş.')).toBeInTheDocument();
  });

  // Cevrimdisi + soguk onbellek: Firestore HATA VERMEZ, onbellekten bos liste verir
  // (tarayicida olculdu — bkz. useDrugCatalog.js). "Katalog bos" demek kullaniciyi
  // 1.141 kaydi elle kurmaya iter; bilmedigimiz seye "yok" denmez.
  it('katalog HIC INMEMISSE bos demez, indirilmedigini soyler', () => {
    const { input } = setup({ catalog: [], fromCache: true });

    expect(screen.getByText(/henüz indirilmedi/)).toBeInTheDocument();
    expect(screen.queryByText('Katalog boş.')).not.toBeInTheDocument();
    expect(input).toBeDisabled();
    // Suzulecek bir sey yokken suzgecler de pasif olmali
    expect(screen.getByLabelText('Sınıf süzgeci')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Pet' })).toBeDisabled();
  });

  // TASK-039 B3: bolum suzgeci (gercek katalogda ruminant 720 / pet 421)
  it('bolum suzgeci listeyi daraltir', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Pet' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tüm katalogu göster' }));

    const rows = options();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent('ADVANTİX');
  });

  it('suzgec kapaliyken (Hepsi) davranis degismez', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Çiftlik' }));
    fireEvent.click(screen.getByRole('button', { name: 'Hepsi' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tüm katalogu göster' }));

    expect(options()).toHaveLength(3);
  });

  // Suzgec acikken "kayit yok" demek yaniltici olur: kayit katalogda VAR, suzgecin disinda
  it('suzgec yuzunden bos kalan sonuc suzgeci hatirlatir', () => {
    const { input } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Pet' }));
    type(input, 'biyokan');

    expect(screen.getByText(/Süzgeçleri kaldırıp/)).toBeInTheDocument();
  });

  // Yalnizca SINIF suzgeci acikken de ayni ipucu cikmali — ipucu "bolum" degil
  // "suzgec var mi" sorusuna bagli
  it('yalnizca sinif suzgeci acikken de bos sonuc suzgeci hatirlatir', () => {
    const { input } = setup();
    fireEvent.change(screen.getByLabelText('Sınıf süzgeci'), { target: { value: 'asi' } });
    type(input, 'biyokan');

    expect(options()).toHaveLength(0);
    expect(screen.getByText(/Süzgeçleri kaldırıp/)).toBeInTheDocument();
  });

  it('suzgec kapaliyken bos sonuc suzgecten bahsetmez', () => {
    const { input } = setup();
    type(input, 'zzzz');

    expect(screen.queryByText(/Süzgeçleri kaldırıp/)).not.toBeInTheDocument();
    expect(screen.getByText(/elle ekleyebilirsiniz/)).toBeInTheDocument();
  });

  // sinif suzgeci: acilir liste (olcum, degerinin GEZINMEDE oldugunu gosterdi)
  it('sinif suzgeci listeyi daraltir', () => {
    setup();
    fireEvent.change(screen.getByLabelText('Sınıf süzgeci'), { target: { value: 'antiparaziter' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tüm katalogu göster' }));

    const rows = options();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent('ADVANTİX');
  });

  it('iki suzgec VE ile birlesir', () => {
    setup();
    // Ciftlik + antiparaziter: sabit katalogda boyle bir kayit yok
    fireEvent.click(screen.getByRole('button', { name: 'Çiftlik' }));
    fireEvent.change(screen.getByLabelText('Sınıf süzgeci'), { target: { value: 'antiparaziter' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tüm katalogu göster' }));

    expect(options()).toHaveLength(0);

    // Ciftlik + ilac: yalnizca 100 ML kaydi
    fireEvent.change(screen.getByLabelText('Sınıf süzgeci'), { target: { value: 'ilac' } });
    const hits = options();
    expect(hits).toHaveLength(1);
    expect(hits[0]).toHaveTextContent('100 ml');
  });

  it('sinif suzgeci kapaliyken (Tüm sınıflar) davranis degismez', () => {
    setup();
    fireEvent.change(screen.getByLabelText('Sınıf süzgeci'), { target: { value: 'asi' } });
    fireEvent.change(screen.getByLabelText('Sınıf süzgeci'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tüm katalogu göster' }));

    expect(options()).toHaveLength(3);
  });

  // Olcumun ikinci yarisi: cevrimdisi ama onbellek SICAK ise katalog eksiksiz gelir
  // (1.141 kayit, 1 ms). O durumda uyari cikmasi yanlis alarm olurdu.
  it('cevrimdisi ama onbellek doluysa hicbir uyari cikmaz ve arama calisir', () => {
    const { input } = setup({ catalog: CATALOG, fromCache: true });

    expect(screen.queryByText(/henüz indirilmedi/)).not.toBeInTheDocument();
    expect(screen.queryByText('Katalog boş.')).not.toBeInTheDocument();
    expect(input).not.toBeDisabled();

    type(input, 'biyokan');
    expect(options()).toHaveLength(2);
  });
});
