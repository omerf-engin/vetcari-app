// --- CSV URETIMI ---
//
// Excel'in tr-TR yerel ayariyla dogru acilan CSV uretir. Iki karar zorunlu, ikisi de
// gorunmez ama biri eksik olursa dosya kullanicinin elinde bozuk cikar:
//
// 1. **Ayirici `;`** — tr-TR'de ondalik ayirici virguldur, bu yuzden Excel'in liste
//    ayiricisi noktali virguldur. Virgulle yazilan dosya tum satiri tek hucreye dusurur.
// 2. **UTF-8 BOM** — BOM yoksa Excel dosyayi ANSI sanir ve `ş ğ İ ı ö ü ç` bozulur.
//
// Bu dosya ekstreden bagimsizdir; ekstreye ozgu mantik `statementExport.js` icindedir.

/** tr-TR Excel'in bekledigi alan ayirici. */
export const CSV_SEPARATOR = ';';

/**
 * Excel'in ANSI varsayimini bozan UTF-8 bayt sirasi isareti (U+FEFF).
 *
 * `String.fromCharCode` ile uretilir, kaynakta duz karakter olarak yazilmaz: BOM gorunmez
 * bir karakterdir, bir dize sabitinin icinde durdugunda kod incelemesinde fark edilmez ve
 * editorler/formatlayicilar tarafindan sessizce silinebilir. Silinirse Turkce karakterler
 * Excel'de bozulur ve bunu hicbir birim testi degil, ancak kullanici fark eder.
 */
export const BOM = String.fromCharCode(0xFEFF);

// Excel `=`, `+`, `@` (ve tab/CR) ile baslayan hucreyi formul olarak degerlendirir. Iptal
// gerekcesi serbest metin oldugu icin bu alanlar bir apostrofla etkisizlestirilir.
// `-` kasten disarida: negatif tutarlar sayi sutununda ve orada formul riski yok.
const FORMULA_PREFIX = /^[=+@\t\r]/;

/**
 * Tek bir hucreyi CSV'ye guvenli hale getirir.
 * `null`/`undefined` bos hucre olur — 0 gecerli bir tutar oldugu icin `0` yazilir.
 */
export const escapeField = (value, separator = CSV_SEPARATOR) => {
  if (value === null || value === undefined) return '';
  let s = String(value);
  if (FORMULA_PREFIX.test(s)) s = `'${s}`;
  if (s.includes('"') || s.includes(separator) || s.includes('\r') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
};

/**
 * Satir dizilerini CSV metnine cevirir.
 *
 * @param {Array<Array<*>>} rows — her eleman bir satir, her ic eleman bir hucre
 * @param {{separator?: string, bom?: boolean}} [options]
 */
export const toCSV = (rows, { separator = CSV_SEPARATOR, bom = true } = {}) => {
  const body = (rows || [])
    .map((row) => (row || []).map((cell) => escapeField(cell, separator)).join(separator))
    .join('\r\n');
  return bom ? BOM + body : body;
};

/**
 * Tutari Excel'in **sayi** olarak okuyabilecegi tr-TR biciminde yazar: `1234.5` -> `1234,50`.
 *
 * `fmtTL` burada kullanilamaz: hem ` ₺` ekler hem en fazla 1 ondalik yazar. Ikisi de hucreyi
 * metne cevirir, ustelik kurus bilgisi kaybolur. Binlik ayirici da kasten kapali — `.`
 * karakteri dosyayi baska bir yerel ayarda acan icin ondalik noktasi gibi gorunurdu.
 */
export const csvNumber = (val) => {
  // `Number(null)` ve `Number('')` sifirdir — dogrudan `Number`'a gecilseydi "deger yok"
  // hucresi `0,00` diye yazilirdi. Bilinmeyen tutari sifir gostermek sessiz bir yalandir.
  if (val === null || val === undefined || val === '') return '';
  const n = Number(val);
  if (!Number.isFinite(n)) return '';
  return n.toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: false
  });
};
