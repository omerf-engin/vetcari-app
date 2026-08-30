// --- PDF EKSTRE MODELI ---
//
// CSV ile **ayni** veriden basili sayfaya uygun bir model kurar. Burada hicbir para hesabi
// yapilmaz: satirlar `buildStatementRows`'dan, toplamlar `summarizePeriod`'dan gelir. Faz 1'de
// kurulan "tek aritmetik" kurali korunur — PDF'in bakiyesi CSV'ninkinden farkli olamaz.
//
// `@react-pdf/renderer`'a hic dokunmaz; bu yuzden sira, bicim ve etiketler normal birim
// testiyle sinanabilir. JSX katmani (`components/pdf/StatementPdfDocument.jsx`) yalnizca
// bu modeli cizer.

import { fmtDateShort, fmtTLExact } from './formatters';
import { todayLocal } from './dates';

/**
 * `Durum` metnini basili gorunume cevirir.
 *
 * Kagitta ayri bir "Durum" sutunu tasimak yerine satirin **bicimi** durumu anlatir; secilen
 * duzen A4 dikeyde 5 sutuna sigsin diye boyle. Onemli ayrim:
 *
 * - `İptal edildi` / `Geri alındı` → satir **sayilmiyor**, para sutunlari zaten bos → ustu cizili
 * - `Kalem iptal edildi` → satir **sayilmaya devam ediyor**, para sutunlari dolu → ustu
 *   cizilmez, yalnizca not dusulur. Yaninda duran rakam gecerliyken satiri cizmek okuyucuya
 *   yanlis sey soylerdi
 */
const STATUS_STYLE = {
  '': { muted: false, strike: false, note: '' },
  'İptal edildi': { muted: true, strike: true, note: 'iptal edildi' },
  'Geri alındı': { muted: true, strike: true, note: 'geri alındı' },
  'Bilgi': { muted: true, strike: false, note: '' },
  'Ölçülemiyor': { muted: true, strike: false, note: 'tutar kaydı yok' },
  'Avans hareketi': { muted: false, strike: false, note: 'avans' },
  'Kalem iptal edildi': { muted: false, strike: false, note: 'kalem iptal edildi' }
};

const styleFor = (status) => STATUS_STYLE[status] ?? { muted: true, strike: false, note: status };

export const PDF_COLUMNS = ['Tarih', 'İşlem', 'Borç', 'Alacak', 'Bakiye'];

/**
 * @param {object} statement — `buildCustomerStatement` ciktisi (`rows`, `opening`, `closing`,
 *        `summary`, `unmeasured`)
 * @param {object} meta — `customerName`, `period`, `advanceBalance`, `today`
 */
export const buildStatementPdfModel = (statement, meta = {}) => {
  const { rows = [], opening = 0, closing = 0, summary, unmeasured = 0 } = statement || {};
  const { customerName = '', period, advanceBalance = 0, today = todayLocal() } = meta;
  const hasRange = Boolean(period?.start && period?.end);

  const header = {
    title: 'Müşteri Ekstresi',
    customerName,
    periodLabel: hasRange
      ? `${fmtDateShort(period.start)} - ${fmtDateShort(period.end)}`
      : 'Tüm işlemler',
    generatedOn: fmtDateShort(today)
  };

  // Devir yalnizca filtreli ekstrede anlamli; filtresizde bakiye zaten sifirdan baslar
  const tableRows = [];
  if (hasRange) {
    tableRows.push({
      key: 'devir',
      date: fmtDateShort(period.start),
      title: 'Devir',
      source: '',
      description: 'Önceki dönemden devreden bakiye',
      debit: '',
      credit: '',
      balance: fmtTLExact(opening),
      muted: true,
      strike: false,
      note: ''
    });
  }

  rows.forEach((r, i) => {
    const style = styleFor(r.status);
    tableRows.push({
      key: `r${i}`,
      date: fmtDateShort(r.date),
      title: r.type || '',
      source: r.source || '',
      description: r.description || '',
      debit: r.debit === null || r.debit === undefined ? '' : fmtTLExact(r.debit),
      credit: r.credit === null || r.credit === undefined ? '' : fmtTLExact(r.credit),
      balance: fmtTLExact(r.balance),
      ...style
    });
  });

  // Etiketler CSV ve ReportsView ile birebir ayni — ayni sayinin uc yerde farkli adla
  // gorunmesi kullaniciyi tereddute dusururdu
  const s = summary || {};
  const totals = [
    { label: 'Dönem tahsilatı', value: fmtTLExact(s.collected ?? 0), emphasis: true },
    { label: 'Açılan borç', value: fmtTLExact(s.debtOpened ?? 0), emphasis: true },
    { label: 'Enflasyon ile artan borç', value: fmtTLExact(s.inflation ?? 0) },
    { label: 'Zam ile artan borç', value: fmtTLExact(s.priceUp ?? 0) },
    { label: 'Süpürülen küsurat', value: fmtTLExact(s.writeoff ?? 0) },
    { label: 'İade ile kapanan borç', value: fmtTLExact(s.returned ?? 0) },
    { label: 'İptal edilen borç kalemi', value: fmtTLExact(s.cancelled ?? 0) },
    { label: 'Avansa yazılan', value: fmtTLExact(s.advanceIn ?? 0) },
    { label: 'Avanstan kullanılan', value: fmtTLExact(s.advanceUsed ?? 0) },
    { label: 'Alacak değişimi', value: fmtTLExact(s.receivableChange ?? 0), emphasis: true },
    { label: 'Dönem sonu bakiye', value: fmtTLExact(closing), emphasis: true },
    { label: 'Kullanılabilir avans (güncel)', value: fmtTLExact(advanceBalance) }
  ];

  const notes = ['Bakiye sütunu brüt borcu izler; avans ayrı bir hesapta tutulur.'];
  if (unmeasured > 0) {
    notes.push(
      `${unmeasured} kayıt tutar bilgisi tutulmadan yazılmış (dönemsel raporlama öncesi). ` +
      'Bu kayıtlar bakiyeye dahil değildir.'
    );
  }

  const legend = ['Üstü çizili satırlar iptal edilmiş ya da geri alınmıştır; bakiyeye girmezler.'];
  if (unmeasured > 0) {
    legend.push('"tutar kaydı yok" satırlarının tutarı sistemde saklanmamıştır.');
  }

  return { header, columns: PDF_COLUMNS, tableRows, totals, notes, legend, rowCount: rows.length };
};
