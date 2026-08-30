import { describe, it, expect } from 'vitest';
import { buildStatementPdfModel, PDF_COLUMNS } from './statementPdfModel';
import { buildCustomerStatement } from './statementExport';

let seq = 0;
const log = (over = {}) => ({
  id: `l${++seq}`,
  date: '2026-08-10',
  timestamp: seq * 1000,
  kind: 'entry',
  title: 'Borç Açıldı',
  message: 'test',
  sourceLabel: 'Hizmet: Muayene',
  ...over
});

const debt = (amount, over = {}) => log({ flow: 'debt', amount, ...over });
const collect = (amount, over = {}) =>
  log({ kind: 'payment', flow: 'collect', amount, title: 'Tahsilat', ...over });

/** CSV yolundan gecip PDF modeline ulasan tam zincir — iki tarafin ayni veriden beslendigi bu. */
const modelFor = (logs, meta = {}) => {
  const statement = buildCustomerStatement({
    customerName: 'Ali Veli', logs, today: '2026-08-30', ...meta
  });
  return {
    model: buildStatementPdfModel(statement, {
      customerName: 'Ali Veli', today: '2026-08-30', ...meta
    }),
    statement
  };
};

const rowByTitle = (model, title) => model.tableRows.find((r) => r.title === title);

describe('buildStatementPdfModel — baslik', () => {
  it('musteri, donem ve olusturma tarihini tasir', () => {
    const { model } = modelFor([debt(100)], {
      period: { start: '2026-08-01', end: '2026-08-31' }
    });

    expect(model.header).toMatchObject({
      customerName: 'Ali Veli',
      periodLabel: '01.08.2026 - 31.08.2026',
      generatedOn: '30.08.2026'
    });
  });

  it('filtresizde donem etiketi tum islemler', () => {
    const { model } = modelFor([debt(100)]);
    expect(model.header.periodLabel).toBe('Tüm işlemler');
  });

  it('sutun basliklari 5 sutunluk basili duzen', () => {
    expect(PDF_COLUMNS).toEqual(['Tarih', 'İşlem', 'Borç', 'Alacak', 'Bakiye']);
  });
});

describe('buildStatementPdfModel — devir', () => {
  it('filtreli ekstrede devir satiri en uste gelir', () => {
    const { model } = modelFor(
      [debt(600, { date: '2026-07-10' }), debt(200, { date: '2026-08-05' })],
      { period: { start: '2026-08-01', end: '2026-08-31' } }
    );

    expect(model.tableRows[0]).toMatchObject({
      title: 'Devir',
      balance: '600,00 ₺',
      debit: '',
      credit: ''
    });
  });

  it('filtresiz ekstrede devir satiri yazilmaz', () => {
    const { model } = modelFor([debt(600)]);
    expect(rowByTitle(model, 'Devir')).toBeUndefined();
  });
});

describe('buildStatementPdfModel — satir bicimleri', () => {
  it('normal satir ne soluk ne ustu cizili', () => {
    const { model } = modelFor([debt(900)]);
    expect(model.tableRows[0]).toMatchObject({
      muted: false, strike: false, note: '', debit: '900,00 ₺', credit: ''
    });
  });

  it('iptal edilmis islem ustu cizili ve para sutunlari bos', () => {
    const { model } = modelFor([
      debt(900, { batchId: 'b1' }),
      log({ kind: 'cancel', flow: 'cancel', amount: 900, batchId: 'b1', title: 'İşlem İptali', timestamp: 9e6 })
    ]);

    expect(model.tableRows.every((r) => r.strike && r.muted)).toBe(true);
    expect(model.tableRows.every((r) => r.debit === '' && r.credit === '')).toBe(true);
  });

  // Kalem iptali sayilmaya devam ediyor; yanindaki rakam gecerliyken satiri cizmek
  // okuyucuya yanlis sey soylerdi
  it('kalem iptali ustu cizili DEGIL, yalnizca not dusulur', () => {
    const { model } = modelFor([
      debt(900, { debtId: 'd1' }),
      log({ debtId: 'd1', kind: 'cancel', flow: 'cancel', amount: 900, title: 'Hizmet Borcu İptali', timestamp: 9e6 })
    ]);

    const opened = model.tableRows[0];
    expect(opened).toMatchObject({ strike: false, note: 'kalem iptal edildi', debit: '900,00 ₺' });
  });

  it('geri alinmis grup ustu cizili', () => {
    const { model } = modelFor([
      debt(1000, { date: '2026-08-01' }),
      collect(400, { batchId: 'p1', date: '2026-08-05' }),
      log({ kind: 'payment', batchId: 'r1', revertOf: 'p1', date: '2026-08-06', title: 'Tahsilat İptali', timestamp: 9e6 })
    ]);

    expect(rowByTitle(model, 'Tahsilat')).toMatchObject({ strike: true, note: 'geri alındı' });
  });

  it('fiyat kilidi soluk ama cizilmemis', () => {
    const { model } = modelFor([debt(500), log({ kind: 'lock', title: 'Fiyat Sabitlendi', timestamp: 9e6 })]);
    expect(rowByTitle(model, 'Fiyat Sabitlendi')).toMatchObject({ muted: true, strike: false });
  });

  it('olculemeyen satir not tasir', () => {
    const { model } = modelFor([debt(500), log({ title: 'Eski Kayıt', timestamp: 9e6 })]);
    expect(rowByTitle(model, 'Eski Kayıt')).toMatchObject({ muted: true, note: 'tutar kaydı yok' });
  });

  it('avans satiri not tasir, para sutunlari bos', () => {
    const { model } = modelFor([
      debt(500),
      log({ kind: 'payment', flow: 'advance', balanceDelta: 200, amount: 200, title: 'Avans Girişi', timestamp: 9e6 })
    ]);

    expect(rowByTitle(model, 'Avans Girişi')).toMatchObject({ note: 'avans', debit: '', credit: '' });
  });

  it('kaynak ve aciklama satirda tasinir', () => {
    const { model } = modelFor([debt(900, { sourceLabel: 'İlaç: Amoksisilin', message: '2 adet × 450 ₺' })]);
    expect(model.tableRows[0]).toMatchObject({
      source: 'İlaç: Amoksisilin',
      description: '2 adet × 450 ₺'
    });
  });
});

describe('buildStatementPdfModel — tutar bicimi', () => {
  it('kurus korunur ve binlik ayirici ile lira isareti yazilir', () => {
    // fmtTL 1 ondalik yazar (1.234,6 ₺); basili ekstrede kurus kaybi kabul edilemez
    const { model } = modelFor([debt(1234.56)]);
    expect(model.tableRows[0].debit).toBe('1.234,56 ₺');
  });
});

describe('buildStatementPdfModel — toplamlar ve notlar', () => {
  it('toplam etiketleri CSV/ReportsView ile ayni', () => {
    const { model } = modelFor([debt(900), collect(500, { timestamp: 9e6 })]);
    const labels = model.totals.map((t) => t.label);

    expect(labels).toEqual([
      'Dönem tahsilatı', 'Açılan borç', 'Enflasyon ile artan borç', 'Zam ile artan borç',
      'Süpürülen küsurat', 'İade ile kapanan borç', 'İptal edilen borç kalemi',
      'Avansa yazılan', 'Avanstan kullanılan', 'Alacak değişimi', 'Dönem sonu bakiye',
      'Kullanılabilir avans (güncel)'
    ]);
  });

  it('guncel avans meta uzerinden gecer', () => {
    const { model } = modelFor([debt(100)], { advanceBalance: 125.5 });
    expect(model.totals.find((t) => t.label.startsWith('Kullanılabilir avans')).value)
      .toBe('125,50 ₺');
  });

  it('bakiye notu her zaman var', () => {
    const { model } = modelFor([debt(100)]);
    expect(model.notes[0]).toMatch(/brüt borcu izler/);
  });

  it('olculemeyen kayit varsa uyari ve lejant satiri eklenir', () => {
    const { model } = modelFor([debt(100), log({ title: 'Eski', timestamp: 9e6 })]);
    expect(model.notes.some((n) => n.includes('1 kayıt'))).toBe(true);
    expect(model.legend.some((l) => l.includes('tutar kaydı yok'))).toBe(true);
  });

  it('olculemeyen kayit yoksa uyari eklenmez', () => {
    const { model } = modelFor([debt(100)]);
    expect(model.notes).toHaveLength(1);
    expect(model.legend).toHaveLength(1);
  });
});

describe('CSV ile dikis', () => {
  const mixed = [
    debt(1000, { date: '2026-08-02' }),
    log({ date: '2026-08-03', flow: 'inflation', amount: 45.5, title: 'Enflasyon Güncellemesi' }),
    collect(500.75, { date: '2026-08-06' }),
    log({ date: '2026-08-07', kind: 'return', flow: 'return', amount: 120, title: 'İade İşlemi' }),
    log({ date: '2026-08-09', kind: 'cancel', flow: 'cancel', amount: 60, title: 'İlaç Borcu İptali' })
  ];

  // PDF yeni bir hesap yapmiyor: ayni loglardan uretilen iki cikti ayni bakiyeyi
  // gostermek zorunda. Model kendi toplamini kursaydi burasi ayrisirdi.
  it('son satirin bakiyesi CSV kapanis bakiyesiyle ayni', () => {
    const { model, statement } = modelFor(mixed);
    const last = model.tableRows[model.tableRows.length - 1];

    expect(last.balance).toBe(model.totals.find((t) => t.label === 'Dönem sonu bakiye').value);
    expect(last.balance).toBe(
      Number(statement.closing).toLocaleString('tr-TR', {
        minimumFractionDigits: 2, maximumFractionDigits: 2
      }) + ' ₺'
    );
  });

  it('satir sayisi CSV satir sayisiyla ayni (devir haric)', () => {
    const { model, statement } = modelFor(mixed);
    expect(model.rowCount).toBe(statement.rowCount);
    expect(model.tableRows).toHaveLength(statement.rowCount);
  });

  it('filtreli ekstrede devir satiri fazladan gelir', () => {
    const { model, statement } = modelFor(mixed, { period: { start: '2026-08-01', end: '2026-08-31' } });
    expect(model.tableRows).toHaveLength(statement.rowCount + 1);
  });

  it('bos ekstrede tablo bos ama baslik ve toplamlar durur', () => {
    const { model } = modelFor([]);
    expect(model.tableRows).toHaveLength(0);
    expect(model.totals).toHaveLength(12);
    expect(model.header.customerName).toBe('Ali Veli');
  });
});
