// --- MUSTERI EKSTRESI DISA AKTARMA ---
//
// Ekrandaki Genel Ekstre'nin (HistoryModal, variant `customer`) dosya karsiligi. Klasik
// Turk cari ekstresi duzeni: her satirin Borc/Alacak sutunu ve yuruyen Bakiye'si var.
//
// **Tutar yalnizca yapisal `flow` + `amount` alanlarindan okunur**, log `message` metninden
// asla. Metinden geri okumak hem kayipli olurdu (`fmtTL` en fazla 1 ondalik yazar) hem de
// ekrandaki Raporlar sekmesiyle ayrisan ikinci bir hesap yolu acardi.
//
// Eleme sirasi ve alacak yonu `reporting.js`'ten **paylasilir** (`classifyLog`,
// `FLOW_RECEIVABLE_SIGN`) — kopyalanmaz. Boylece CSV'nin son bakiyesi ile Raporlar
// sekmesindeki "Alacak Degisimi" ayrisamaz; `statementExport.test.js` bu dikisi test eder.

import { classifyLog, buildExclusions, summarizePeriod } from './reporting';
import { toCSV, csvNumber } from './csv';
import { fmtDateShort } from './formatters';
import { todayLocal } from './dates';

const round2 = (val) => Math.round(val * 100) / 100;

export const STATEMENT_COLUMNS = [
  'Tarih', 'Tür', 'Kaynak', 'Açıklama', 'Borç', 'Alacak', 'Bakiye', 'Durum'
];

// `counted` disindaki her satir gorunur ama bakiyeyi oynatmaz — ekrandaki ekstre ile
// satir satir ayni kalsin diye gizlenmiyorlar, ne olduklari `Durum` sutununda yaziyor.
const STATUS_LABEL = {
  counted: '',
  cancelled: 'İptal edildi',
  reverted: 'Geri alındı',
  info: 'Bilgi',
  unmeasured: 'Ölçülemiyor'
};

/** Kronolojik: eski -> yeni. Ekranin tersi; yuruyen bakiye ancak bu sirada anlamli. */
const chronological = (a, b) => {
  const da = a?.date || '';
  const db = b?.date || '';
  if (da !== db) return da.localeCompare(db);
  return (a?.timestamp ?? 0) - (b?.timestamp ?? 0);
};

/**
 * Filtresiz disa aktarmada `summarizePeriod`'a verilecek arahk.
 *
 * `summarizePeriod` iki ucu da dolu bir arahk ister (bos gelirse sifir ozet doner). "Tum
 * islemler" secildiginde loglarin en eski ve en yeni tarihi arahk olarak kullanilir; bu
 * satirlarla birebir ayni kumeyi kapsar, dolayisiyla ozet ile bakiye sutunu tutar.
 */
const effectivePeriod = (logs, period) => {
  if (period?.start && period?.end) return { start: period.start, end: period.end };
  const dates = (logs || []).map((l) => l?.date).filter(Boolean).sort();
  if (dates.length === 0) return { start: '', end: '' };
  return { start: dates[0], end: dates[dates.length - 1] };
};

/**
 * Ekstre satirlarini kurar ve bakiyeyi yurutur.
 *
 * @param {Array<object>} logs — musterinin ekstre loglari (CustomerDetail'deki
 *        `customerAggregateLogs`: `sourceLabel` ve `cancelled` ile zenginlestirilmis)
 * @param {{start?: string, end?: string}} [period] — eksik/bos ise tum hareketler
 * @param {Array<object>} [allLogs] — eleme kumelerinin hesaplandigi kume; varsayilan `logs`.
 *        `summarizePeriod` ile ayni kume verilmeli, aksi halde iki taraf ayrisir.
 * @returns {{rows: object[], opening: number, closing: number, unmeasured: number}}
 */
export const buildStatementRows = (logs, period, allLogs) => {
  const list = logs || [];
  const exclusions = buildExclusions(allLogs || list);
  const start = period?.start || '';
  const end = period?.end || '';

  // Devir: donem baslangicindan ONCEKI hareketlerin alacak etkisi. Bu olmadan filtreli bir
  // ekstrenin bakiye sutunu sifirdan baslar ve gercek borcu gostermez.
  let opening = 0;
  const inPeriod = [];

  for (const log of list) {
    // Tarihsiz log `summarizePeriod`'da da elenir; iki taraf ayni kumeyi gormeli
    const date = log?.date || '';
    if (!date) continue;

    if (start && date < start) {
      const { status, sign, amount } = classifyLog(log, exclusions);
      if (status === 'counted') opening += sign * amount;
      continue;
    }
    if (end && date > end) continue;
    inPeriod.push(log);
  }

  inPeriod.sort(chronological);

  opening = round2(opening);
  let balance = opening;
  let unmeasured = 0;

  const rows = inPeriod.map((log) => {
    const { status, flow, sign, amount } = classifyLog(log, exclusions);
    if (status === 'unmeasured') unmeasured++;

    const counted = status === 'counted';
    if (counted) balance = round2(balance + sign * amount);

    return {
      date: log.date,
      type: log.title || '',
      source: log.sourceLabel || '',
      description: log.message || '',
      // Sayilmayan satirda iki para sutunu da bos kalir; boylece her satirda
      // "onceki bakiye + Borc - Alacak = Bakiye" aritmetigi tutar.
      debit: counted && sign > 0 ? amount : null,
      credit: counted && sign < 0 ? amount : null,
      balance,
      // Avans brut borcu degistirmez (sign 0) — para sutunlari bos kalir, tutar
      // aciklamada ve TOPLAMLAR blogunda gorunur.
      status: counted && flow === 'advance' ? 'Avans hareketi' : (STATUS_LABEL[status] ?? '')
    };
  });

  return { rows, opening, closing: balance, unmeasured };
};

const TR_ASCII = {
  ç: 'c', Ç: 'c', ğ: 'g', Ğ: 'g', ı: 'i', İ: 'i',
  ö: 'o', Ö: 'o', ş: 's', Ş: 's', ü: 'u', Ü: 'u'
};

// Dosya adi ASCII'ye indirgenir: Turkce karakterler Windows'ta sorunsuz calisir ama
// dosya e-posta/bulut uzerinden gecerken bozulabiliyor.
const slugify = (name) => String(name || '')
  .replace(/[çÇğĞıİöÖşŞüÜ]/g, (c) => TR_ASCII[c])
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || 'musteri';

/** `ali-veli-ekstre-2025-08-01_2025-08-30.csv` — filtresizse tarih yerine bugun. */
export const statementFileName = (customerName, period, today = todayLocal()) => {
  const range = period?.start && period?.end
    ? `${period.start}_${period.end}`
    : today;
  return `${slugify(customerName)}-ekstre-${range}.csv`;
};

/**
 * Baslik blogu + hareket tablosu + TOPLAMLAR blogundan CSV metnini kurar.
 * Toplam etiketleri ReportsView'daki "Hareket Dokumu" ile birebir ayni — ayni sayinin
 * ekranda ve dosyada farkli adlarla gorunmesi kullaniciyi tereddute dusururdu.
 */
export const buildStatementCsv = ({
  customerName, period, rows, opening, closing, summary, unmeasured, advanceBalance, today
}) => {
  const hasRange = Boolean(period?.start && period?.end);
  const lines = [];

  lines.push(['VetCari — Müşteri Ekstresi']);
  lines.push(['Müşteri', customerName || '']);
  lines.push(['Dönem', hasRange ? `${fmtDateShort(period.start)} - ${fmtDateShort(period.end)}` : 'Tüm işlemler']);
  lines.push(['Oluşturma', fmtDateShort(today || todayLocal())]);
  lines.push(['Not', 'Bakiye sütunu brüt borcu izler; avans ayrı bir hesapta tutulur.']);
  if (unmeasured > 0) {
    lines.push(['Uyarı', `${unmeasured} kayıt tutar bilgisi tutulmadan yazılmış (dönemsel raporlama öncesi). Bu kayıtlar bakiyeye dahil değil.`]);
  }

  lines.push([]);
  lines.push(STATEMENT_COLUMNS);

  if (hasRange) {
    lines.push([
      fmtDateShort(period.start), 'Devir', '', 'Önceki dönemden devreden bakiye',
      '', '', csvNumber(opening), ''
    ]);
  }

  for (const r of rows) {
    lines.push([
      fmtDateShort(r.date),
      r.type,
      r.source,
      r.description,
      r.debit === null ? '' : csvNumber(r.debit),
      r.credit === null ? '' : csvNumber(r.credit),
      csvNumber(r.balance),
      r.status
    ]);
  }

  lines.push([]);
  lines.push(['TOPLAMLAR']);
  lines.push(['Dönem tahsilatı', csvNumber(summary.collected)]);
  lines.push(['Açılan borç', csvNumber(summary.debtOpened)]);
  lines.push(['Enflasyon ile artan borç', csvNumber(summary.inflation)]);
  lines.push(['Zam ile artan borç', csvNumber(summary.priceUp)]);
  lines.push(['Süpürülen küsurat', csvNumber(summary.writeoff)]);
  lines.push(['İade ile kapanan borç', csvNumber(summary.returned)]);
  lines.push(['İptal edilen borç kalemi', csvNumber(summary.cancelled)]);
  lines.push(['Avansa yazılan', csvNumber(summary.advanceIn)]);
  lines.push(['Avanstan kullanılan', csvNumber(summary.advanceUsed)]);
  lines.push(['Alacak değişimi', csvNumber(summary.receivableChange)]);
  lines.push(['Dönem sonu bakiye', csvNumber(closing)]);
  lines.push(['Kullanılabilir avans (güncel)', csvNumber(advanceBalance ?? 0)]);

  return toCSV(lines);
};

/**
 * Tek giris noktasi: satirlari, ozeti, CSV metnini ve dosya adini birlikte uretir.
 *
 * `buildStatementRows` ile `summarizePeriod`'a **ayni log dizisi** verilir — eleme kumeleri
 * (iptal/geri alma) ayni kaynaktan hesaplansin diye. Farkli kumeler verilseydi bakiye
 * sutunu ile TOPLAMLAR blogu sessizce ayrisabilirdi.
 */
export const buildCustomerStatement = ({
  customerName, logs, period, advanceBalance, today = todayLocal()
}) => {
  const list = logs || [];
  const { rows, opening, closing, unmeasured } = buildStatementRows(list, period, list);
  const summary = summarizePeriod(list, effectivePeriod(list, period));

  return {
    rows,
    opening,
    closing,
    unmeasured,
    summary,
    // `summary.movementCount` ile karistirilmamali: o **sayilan** para hareketlerini sayar,
    // bu ise dosyaya yazilan satirlari — olculemeyen ve iptal edilmis satirlar da dahil.
    // Bos ekstre uyarisi buna bakar: kullanicinin sordugu "dosyada bir sey cikacak mi".
    rowCount: rows.length,
    filename: statementFileName(customerName, period, today),
    csv: buildStatementCsv({
      customerName, period, rows, opening, closing, summary, unmeasured, advanceBalance, today
    })
  };
};
