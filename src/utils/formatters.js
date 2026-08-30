// --- YARDIMCI FORMATLAYICILAR ---
export const fmtTL = (val) => Number(val).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 1 }) + ' ₺';
export const fmtQty = (val) => Number(val).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

/**
 * Kurusu koruyan para bicimi: `1234.56` -> `1.234,56 ₺`.
 *
 * `fmtTL` en fazla **1 ondalik** yazar; ekranda bu kabul edilebilir bir sadelestirme ama
 * musterinin eline verilen basili ekstrede kurus kaybi olmamali. Binlik ayirici burada
 * **isteniyor** (insan okuyacak) — makine tarafi icin `csvNumber` kullanilir, o hem
 * gruplamayi hem simgeyi kasten atar.
 */
export const fmtTLExact = (val) => {
  const n = Number(val);
  if (!Number.isFinite(n)) return '';
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';
};

export const fmtDate = (isoString) => {
  if (!isoString) return '-';
  const d = new Date(isoString);
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
};

/**
 * `YYYY-MM-DD` -> `GG.AA.YYYY`. Dosyaya yazilan kisa tarih bicimi.
 *
 * Kasten **`Date` nesnesi kurmadan**, dizgiyi dogrudan parcalayarak calisir. `new Date('2025-08-01')`
 * UTC gece yarisi olarak ayrisir; yerel saate cevrilirken UTC-* saat dilimlerinde bir onceki
 * gune duser. Log tarihleri zaten yerel `YYYY-MM-DD` olarak yazildigi icin (bkz. `dates.js`)
 * araya bir `Date` sokmanin hicbir faydasi yok, tek getirisi o riski geri getirmek olurdu.
 */
export const fmtDateShort = (dateStr) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr ?? ''));
  if (!m) return '';
  const [, y, mo, d] = m;
  return `${d}.${mo}.${y}`;
};
