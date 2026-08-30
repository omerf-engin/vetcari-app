import { describe, it, expect } from 'vitest';
import {
  buildStatementRows,
  buildCustomerStatement,
  statementFileName,
  STATEMENT_COLUMNS
} from './statementExport';
import { summarizePeriod, FLOW_RECEIVABLE_SIGN } from './reporting';
import { BOM } from './csv';

let seq = 0;
const log = (over = {}) => ({
  id: `l${++seq}`,
  date: '2026-08-10',
  timestamp: seq * 1000,
  kind: 'entry',
  title: 'Borç Açıldı',
  message: 'test',
  ...over
});

const debt = (amount, over = {}) => log({ flow: 'debt', amount, ...over });
const collect = (amount, over = {}) =>
  log({ kind: 'payment', flow: 'collect', amount, title: 'Tahsilat', ...over });

/** CSV govdesini satirlara boler; hucre kiyaslamasi icin. */
const csvRows = (text) =>
  (text.startsWith(BOM) ? text.slice(BOM.length) : text)
    .split('\r\n')
    .map((l) => l.split(';'));
const findRow = (text, first) => csvRows(text).find((r) => r[0] === first);

describe('buildStatementRows — siralama ve bakiye', () => {
  it('kronolojik sirar: eski once, ekranin tersi', () => {
    const rows = buildStatementRows([
      debt(100, { date: '2026-08-20' }),
      debt(200, { date: '2026-08-05' }),
      debt(300, { date: '2026-08-12' })
    ]).rows;

    expect(rows.map((r) => r.date)).toEqual(['2026-08-05', '2026-08-12', '2026-08-20']);
  });

  it('ayni tarihte timestamp artan sirada', () => {
    const rows = buildStatementRows([
      log({ flow: 'debt', amount: 1, timestamp: 900, message: 'ikinci' }),
      log({ flow: 'debt', amount: 1, timestamp: 100, message: 'birinci' })
    ]).rows;

    expect(rows.map((r) => r.description)).toEqual(['birinci', 'ikinci']);
  });

  it('borc satiri Borc sutununa, tahsilat Alacak sutununa duser', () => {
    const { rows } = buildStatementRows([debt(900), collect(500, { timestamp: 2e6 })]);

    expect(rows[0]).toMatchObject({ debit: 900, credit: null, balance: 900 });
    expect(rows[1]).toMatchObject({ debit: null, credit: 500, balance: 400 });
  });

  it('bakiye satir satir yurur', () => {
    const { rows, closing } = buildStatementRows([
      debt(1000, { date: '2026-08-01' }),
      log({ date: '2026-08-05', flow: 'inflation', amount: 50, title: 'Enflasyon Güncellemesi' }),
      collect(300, { date: '2026-08-09' })
    ]);

    expect(rows.map((r) => r.balance)).toEqual([1000, 1050, 750]);
    expect(closing).toBe(750);
  });
});

describe('buildStatementRows — devir', () => {
  it('donem oncesi hareketler devire toplanir, satir olarak gorunmez', () => {
    const logs = [
      debt(1000, { date: '2026-07-15' }),
      collect(400, { date: '2026-07-20' }),
      debt(200, { date: '2026-08-03' })
    ];

    const { rows, opening, closing } = buildStatementRows(
      logs, { start: '2026-08-01', end: '2026-08-31' }
    );

    expect(opening).toBe(600);
    expect(rows).toHaveLength(1);
    expect(closing).toBe(800);
  });

  it('filtresiz disa aktarmada devir sifir', () => {
    const { opening } = buildStatementRows([debt(1000, { date: '2026-07-15' })]);
    expect(opening).toBe(0);
  });

  it('donem sonrasi hareketler ne devire ne satira girer', () => {
    const { rows, opening, closing } = buildStatementRows(
      [debt(500, { date: '2026-09-05' })],
      { start: '2026-08-01', end: '2026-08-31' }
    );

    expect(opening).toBe(0);
    expect(rows).toHaveLength(0);
    expect(closing).toBe(0);
  });

  it('donem sinirlari her iki uctan dahildir', () => {
    const { rows } = buildStatementRows(
      [debt(1, { date: '2026-08-01' }), debt(2, { date: '2026-08-31' })],
      { start: '2026-08-01', end: '2026-08-31' }
    );
    expect(rows).toHaveLength(2);
  });
});

describe('buildStatementRows — sayilmayan satirlar', () => {
  it('iptal edilmis islemin satirlari gorunur ama bakiyeyi oynatmaz', () => {
    const logs = [
      debt(900, { batchId: 'b1' }),
      log({ kind: 'cancel', flow: 'cancel', amount: 900, batchId: 'b1', title: 'İşlem İptali', timestamp: 2e6 })
    ];

    const { rows, closing } = buildStatementRows(logs);

    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.debit === null && r.credit === null)).toBe(true);
    expect(rows.every((r) => r.status === 'İptal edildi')).toBe(true);
    expect(closing).toBe(0);
  });

  it('kalem iptali (batchId yok) azalis olarak sayilir', () => {
    // Kalem iptali eski "kalani sil" yeteneginin karsiligi; gercekten var olmus bir borcu kapatir
    const { rows, closing } = buildStatementRows([
      debt(900),
      log({ kind: 'cancel', flow: 'cancel', amount: 900, title: 'Hizmet Borcu İptali', timestamp: 2e6 })
    ]);

    expect(rows[1]).toMatchObject({ credit: 900, status: '' });
    expect(closing).toBe(0);
  });

  it('geri alinmis grup ve geri alma logu bakiyeyi oynatmaz', () => {
    const logs = [
      debt(1000, { date: '2026-08-01' }),
      collect(400, { batchId: 'p1', date: '2026-08-05' }),
      log({
        kind: 'payment', batchId: 'r1', revertOf: 'p1', date: '2026-08-06',
        title: 'Tahsilat İptali', timestamp: 3e6
      })
    ];

    const { rows, closing } = buildStatementRows(logs);

    expect(closing).toBe(1000);
    expect(rows[1].status).toBe('Geri alındı');
    expect(rows[2].status).toBe('Geri alındı');
  });

  it('fiyat kilidi bilgi satiridir, para hareketi degil', () => {
    const { rows, closing } = buildStatementRows([
      debt(500),
      log({ kind: 'lock', title: 'Fiyat Sabitlendi', timestamp: 2e6 })
    ]);

    expect(rows[1]).toMatchObject({ debit: null, credit: null, status: 'Bilgi' });
    expect(closing).toBe(500);
  });

  it('flow tasimayan eski kayit olculemiyor olarak isaretlenir ve sayilir', () => {
    const { rows, closing, unmeasured } = buildStatementRows([
      debt(500),
      log({ title: 'Borç Açıldı', message: '300 ₺ borç', timestamp: 2e6 })
    ]);

    expect(unmeasured).toBe(1);
    expect(rows[1].status).toBe('Ölçülemiyor');
    expect(closing).toBe(500);
  });

  it('avans hareketi brut bakiyeyi degistirmez', () => {
    const { rows, closing } = buildStatementRows([
      debt(500),
      log({
        kind: 'payment', flow: 'advance', balanceDelta: 200, amount: 200,
        title: 'Avans Girişi', timestamp: 2e6
      })
    ]);

    expect(rows[1]).toMatchObject({ debit: null, credit: null, status: 'Avans hareketi' });
    expect(closing).toBe(500);
  });

  it('tarihsiz log hic gorunmez — summarizePeriod da onu elemektedir', () => {
    const { rows } = buildStatementRows([debt(100), log({ flow: 'debt', amount: 50, date: undefined })]);
    expect(rows).toHaveLength(1);
  });
});

describe('reporting ile dikis', () => {
  // Bakiye sutunu ile Raporlar sekmesindeki "Alacak Degisimi" ayni haritadan beslenir.
  // Ikisi ayrisirsa CSV sessizce yanlis bakiye gosterirdi; bu test o dikisi kapatir.
  const mixed = [
    debt(1000, { date: '2026-08-02' }),
    log({ date: '2026-08-03', flow: 'inflation', amount: 45.5, title: 'Enflasyon Güncellemesi' }),
    log({ date: '2026-08-04', kind: 'price', flow: 'priceUp', amount: 30.25, title: 'Fiyat Güncellemesi (Zam)' }),
    collect(500.75, { date: '2026-08-06' }),
    log({ date: '2026-08-07', kind: 'return', flow: 'return', amount: 120, title: 'İade İşlemi' }),
    log({ date: '2026-08-08', kind: 'return', flow: 'writeoff', amount: 8.4, title: 'Süpürücü (Silindi)' }),
    log({ date: '2026-08-09', kind: 'cancel', flow: 'cancel', amount: 60, title: 'İlaç Borcu İptali' }),
    log({ date: '2026-08-10', kind: 'payment', flow: 'advance', balanceDelta: 300, amount: 300, title: 'Avans Girişi' }),
    log({ date: '2026-08-11', kind: 'lock', title: 'Fiyat Sabitlendi' }),
    log({ date: '2026-08-12', title: 'Eski Kayıt', message: 'flow yok' })
  ];
  const period = { start: '2026-08-01', end: '2026-08-31' };

  it('kapanis bakiyesi = devir + summarizePeriod alacak degisimi', () => {
    const { opening, closing } = buildStatementRows(mixed, period);
    const summary = summarizePeriod(mixed, period);

    expect(closing).toBe(opening + summary.receivableChange);
  });

  it('devirli donemde de tutar', () => {
    const withPrior = [debt(750, { date: '2026-07-10' }), ...mixed];
    const { opening, closing } = buildStatementRows(withPrior, period);
    const summary = summarizePeriod(withPrior, period);

    expect(opening).toBe(750);
    expect(closing).toBe(opening + summary.receivableChange);
  });

  it('olculemeyen satir sayisi summarizePeriod ile ayni', () => {
    const { unmeasured } = buildStatementRows(mixed, period);
    expect(unmeasured).toBe(summarizePeriod(mixed, period).unmeasured);
  });

  it.each(Object.entries(FLOW_RECEIVABLE_SIGN))(
    'flow %s icin satirin yonu haritayla ayni',
    (flow, sign) => {
      const one = [log({ flow, amount: 100, balanceDelta: 100 })];
      const { rows, closing } = buildStatementRows(one);

      expect(closing).toBe(100 * sign);
      if (sign > 0) expect(rows[0].debit).toBe(100);
      else if (sign < 0) expect(rows[0].credit).toBe(100);
      else expect(rows[0]).toMatchObject({ debit: null, credit: null });
    }
  );
});

describe('statementFileName', () => {
  it('filtreli aralikta iki tarihi de kullanir', () => {
    expect(statementFileName('Ali Veli', { start: '2026-08-01', end: '2026-08-30' }))
      .toBe('ali-veli-ekstre-2026-08-01_2026-08-30.csv');
  });

  it('filtresizken bugunun tarihini kullanir', () => {
    expect(statementFileName('Ali Veli', null, '2026-08-30'))
      .toBe('ali-veli-ekstre-2026-08-30.csv');
  });

  it('Turkce karakterleri ASCII karsiligina indirger', () => {
    expect(statementFileName('Şükrü Öztürk Çiğdem', null, '2026-08-30'))
      .toBe('sukru-ozturk-cigdem-ekstre-2026-08-30.csv');
  });

  it('dosya adinda kullanilamayan karakterleri temizler', () => {
    expect(statementFileName('A/B\\C:D*?', null, '2026-08-30'))
      .toBe('a-b-c-d-ekstre-2026-08-30.csv');
  });

  it('bos ada makul bir varsayilan verir', () => {
    expect(statementFileName('', null, '2026-08-30')).toBe('musteri-ekstre-2026-08-30.csv');
  });
});

describe('buildStatementCsv', () => {
  const base = () => buildCustomerStatement({
    customerName: 'Ali Veli',
    logs: [
      debt(900, { date: '2026-08-02', sourceLabel: 'İlaç: Amoksisilin', message: '2 adet × 450 ₺' }),
      collect(500, { date: '2026-08-06', sourceLabel: 'İlaç: Amoksisilin', message: '500 ₺ tahsil edildi' })
    ],
    period: { start: '2026-08-01', end: '2026-08-31' },
    advanceBalance: 125.5,
    today: '2026-08-30'
  });

  it('baslik blogu musteri, donem ve olusturma tarihini tasir', () => {
    const { csv } = base();
    expect(findRow(csv, 'Müşteri')).toEqual(['Müşteri', 'Ali Veli']);
    expect(findRow(csv, 'Dönem')).toEqual(['Dönem', '01.08.2026 - 31.08.2026']);
    expect(findRow(csv, 'Oluşturma')).toEqual(['Oluşturma', '30.08.2026']);
  });

  it('sutun basliklari beklenen sirada', () => {
    expect(csvRows(base().csv)).toContainEqual(STATEMENT_COLUMNS);
  });

  it('filtreli ekstrede devir satiri yazilir', () => {
    expect(findRow(base().csv, '01.08.2026')).toEqual(
      ['01.08.2026', 'Devir', '', 'Önceki dönemden devreden bakiye', '', '', '0,00', '']
    );
  });

  it('filtresiz ekstrede devir satiri yazilmaz', () => {
    const { csv } = buildCustomerStatement({
      customerName: 'Ali', logs: [debt(100)], today: '2026-08-30'
    });
    expect(csv).not.toContain('Devir');
    expect(findRow(csv, 'Dönem')).toEqual(['Dönem', 'Tüm işlemler']);
  });

  it('hareket satiri GG.AA.YYYY tarih ve dogru sutunlarla yazilir', () => {
    expect(findRow(base().csv, '02.08.2026')).toEqual(
      ['02.08.2026', 'Borç Açıldı', 'İlaç: Amoksisilin', '2 adet × 450 ₺', '900,00', '', '900,00', '']
    );
    expect(findRow(base().csv, '06.08.2026')).toEqual(
      ['06.08.2026', 'Tahsilat', 'İlaç: Amoksisilin', '500 ₺ tahsil edildi', '', '500,00', '400,00', '']
    );
  });

  it('TOPLAMLAR blogu summarizePeriod ile ayni sayilari verir', () => {
    const { csv, summary, closing } = base();
    expect(findRow(csv, 'Dönem tahsilatı')[1]).toBe('500,00');
    expect(findRow(csv, 'Açılan borç')[1]).toBe('900,00');
    expect(findRow(csv, 'Alacak değişimi')[1]).toBe('400,00');
    expect(findRow(csv, 'Dönem sonu bakiye')[1]).toBe('400,00');
    expect(findRow(csv, 'Kullanılabilir avans (güncel)')[1]).toBe('125,50');
    expect(summary.collected).toBe(500);
    expect(closing).toBe(400);
  });

  it('BOM ile baslar', () => {
    expect(base().csv.charCodeAt(0)).toBe(0xFEFF);
  });

  it('olculemeyen kayit varsa baslikta uyari satiri olur', () => {
    const { csv } = buildCustomerStatement({
      customerName: 'Ali',
      logs: [debt(100), log({ title: 'Eski', message: 'flow yok', timestamp: 2e6 })],
      today: '2026-08-30'
    });
    expect(findRow(csv, 'Uyarı')[1]).toContain('1 kayıt');
  });

  it('olculemeyen kayit yoksa uyari satiri yazilmaz', () => {
    expect(base().csv).not.toContain('Uyarı');
  });

  it('noktali virgul iceren aciklama tirnaklanir, sutunlar kaymaz', () => {
    const { csv } = buildCustomerStatement({
      customerName: 'Ali',
      logs: [debt(100, { date: '2026-08-02', message: 'Gerekçe: yanlış; tekrar girildi' })],
      today: '2026-08-30'
    });
    expect(csv).toContain('"Gerekçe: yanlış; tekrar girildi"');
  });

  it('bos ekstrede satir yok ama baslik ve toplamlar yazilir', () => {
    const { csv, rowCount } = buildCustomerStatement({
      customerName: 'Ali', logs: [], today: '2026-08-30'
    });
    expect(rowCount).toBe(0);
    expect(csvRows(csv)).toContainEqual(STATEMENT_COLUMNS);
    expect(findRow(csv, 'Dönem sonu bakiye')[1]).toBe('0,00');
  });
});

describe('kalem iptali — ekranla ayni isaret', () => {
  it('kalem iptali edilmis borc sayilmaya devam eder ama durumu yazilir', () => {
    // Ekranda `cancelledDebtIds` bu satiri uzeri cizili gosteriyor; dosyada hic
    // isaretlenmeseydi kullanici ekranla dosyayi yan yana koydugunda farki goremezdi.
    const { rows, closing } = buildStatementRows([
      debt(900, { id: 'd1', debtId: 'debt-1' }),
      log({
        id: 'c1', debtId: 'debt-1', kind: 'cancel', flow: 'cancel', amount: 900,
        title: 'Hizmet Borcu İptali', timestamp: 9e6
      })
    ]);

    // Isaret yalnizca bilgi amacli: satir sayilmaya devam ediyor, bakiyeyi de yurutuyor
    expect(rows[0]).toMatchObject({ debit: 900, balance: 900, status: 'Kalem iptal edildi' });
    // Iptal logunun kendisi isaretlenmez — `Tur` sutunu zaten "Hizmet Borcu İptali" diyor
    expect(rows[1]).toMatchObject({ credit: 900, balance: 0, status: '' });
    expect(closing).toBe(0);
  });

  it('islem iptali (batchId var) kalem iptali gibi isaretlenmez', () => {
    const { rows } = buildStatementRows([
      debt(900, { debtId: 'debt-2', batchId: 'b9' }),
      log({
        debtId: 'debt-2', kind: 'cancel', flow: 'cancel', amount: 900,
        batchId: 'b9', title: 'İşlem İptali', timestamp: 9e6
      })
    ]);

    expect(rows.every((r) => r.status === 'İptal edildi')).toBe(true);
  });

  it('iptal edilmemis borcun durumu bos kalir', () => {
    const { rows } = buildStatementRows([debt(900, { debtId: 'debt-3' })]);
    expect(rows[0].status).toBe('');
  });
});
