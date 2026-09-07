/**
 * VetKatalog disa aktarimini `drugCatalog` dokumanlarina cevirir.
 *
 * Admin SDK'ya BAGLI DEGIL — saf fonksiyon, vitest'ten test edilebilsin diye ayri duruyor.
 * Yukleyici (`loadDrugCatalog.js`) bunu kullanir.
 *
 * En kritik karar burada: KIMLIK.
 *
 *   `urun_id` bir URUN KARTI kimligidir, stok kalemi degil. Ayni urunun 50/100/250 ml
 *   varyantlari AYNI `urun_id`'yi tasir (or. DR. ANIMAL 100 ML / 250 ML / 500 ML / 1 LT / 5 LT).
 *   Kimlik olarak `urun_id` kullanilsaydi, 100 ml ekliyken 250 ml eklemek "zaten var" diye
 *   yanlislikla engellenirdi. Bu yuzden kimlik BILESIKTIR.
 */

/** RFC 4180 CSV ayristirici — tirnak icinde virgul ve satir sonu olabilir. */
export function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  // UTF-8 BOM'u kirp. Kaynakta ciplak BOM karakteri BIRAKILMAZ: gorunmez oldugu icin
  // hem lint'i kirar hem de editorler sessizce kaybedebilir (bkz. utils/csv.js).
  const raw = String(text ?? '');
  const s = raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw;

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }

  const filled = rows.filter(r => r.length > 1);
  if (!filled.length) return [];
  const [head, ...body] = filled;
  return body.map(r => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}

/**
 * Ambalaj etiketini kimlik icin normalize eder.
 *
 * Iki is yapar:
 * 1. Kozmetik farklari siler ("100 ml" -> "100 ML", cift bosluk tekile). Bir sonraki disa
 *    aktarimda kimlik degisseydi, o kayittan turemis tum `drugs` baglari kopardi.
 * 2. Firestore dokuman kimliginde YASAKLI karakterleri temizler. Gercek veride
 *    "50 MG — KEDI/KOPEK (10 TB)" gibi EGIK CIZGI iceren ambalajlar var; `/` Firestore'da
 *    yol ayracidir ve dokuman olusturmayi hata ile durdurur.
 *
 * Not: yalnizca KIMLIK sadelesir. Dokumandaki `unit` alani ham metni tasir, kullaniciya
 * ambalaj oldugu gibi gosterilir.
 */
export function normalizePackage(value) {
  return String(value ?? '')
    .trim()
    .toLocaleUpperCase('tr')
    .replace(/\//g, '-')      // Firestore dokuman kimliginde yasak
    .replace(/\s+/g, ' ');
}

/** Bos ambalaj kimlige eklenmez: urun kartinin kendisi stok kalemidir. */
export function buildCatalogId(urunId, ambalaj) {
  const norm = normalizePackage(ambalaj);
  return norm ? `${urunId}#${norm}` : urunId;
}

const splitList = (value) =>
  String(value ?? '').split('|').map(s => s.trim()).filter(Boolean);

function makeDoc(catalogId, urun, name, unit) {
  const doc = {
    catalogId,
    urunId: urun.urun_id,
    name: String(name ?? '').trim(),
    form: urun.form || '',
    firma: urun.firma || '',
    sinif: urun.sinif || '',
    bolum: urun.bolum || '',
  };
  if (unit) doc.unit = unit;

  const etken = splitList(urun.etken_maddeler);
  if (etken.length) doc.etkenMaddeler = etken;

  // Saklanir ama arayuzde GOSTERILMEZ (kullanici karari 2026-09-07): gostermek uygulamayi
  // klinik karar destegine donusturur. Alan ileride acilabilir diye tasiniyor.
  if (urun.uyari) doc.uyari = urun.uyari;

  return doc;
}

/**
 * @param {{ urunlerCsv: string, varyantlarCsv: string }} input
 * @returns {{ docs: object[], skippedDraft: number, collisions: string[] }}
 */
export function buildCatalogDocs({ urunlerCsv, varyantlarCsv }) {
  const urunler = parseCsv(urunlerCsv);
  const varyantlar = parseCsv(varyantlarCsv);

  // Kaynak dogrulamasi eksik kayitlar disarida (fail-closed).
  const draftIds = new Set(urunler.filter(u => u.taslak === '1').map(u => u.urun_id));
  const urunById = new Map(
    urunler.filter(u => !draftIds.has(u.urun_id)).map(u => [u.urun_id, u])
  );

  const docs = [];
  const seen = new Set();
  const collisions = [];
  const withVariants = new Set();

  const push = (catalogId, urun, name, unit) => {
    if (seen.has(catalogId)) { collisions.push(catalogId); return; }
    seen.add(catalogId);
    docs.push(makeDoc(catalogId, urun, name, unit));
  };

  // 1) Varyanti olan urunler: her varyant ayri bir stok kalemi
  for (const v of varyantlar) {
    const urun = urunById.get(v.urun_id);
    if (!urun) continue; // taslak ya da eslesmeyen satir
    withVariants.add(v.urun_id);
    const unit = String(v.ambalaj ?? '').trim();
    push(buildCatalogId(v.urun_id, unit), urun, v.varyant_adi || urun.urun_adi, unit);
  }

  // 2) Varyanti olmayan urunler: urun kartinin kendisi stok kalemi
  for (const urun of urunById.values()) {
    if (withVariants.has(urun.urun_id)) continue;
    push(urun.urun_id, urun, urun.urun_adi, '');
  }

  docs.sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  return { docs, skippedDraft: draftIds.size, collisions };
}

// Not: aramanin uzerinde calistigi metin (`catalogHaystack`) burada DEGIL,
// `src/utils/drugCatalog.js`'te — o calisma zamani mantigi, bu dosya derleme zamani.
