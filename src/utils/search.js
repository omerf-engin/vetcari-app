/**
 * Türkçe-güvenli arama yardımcıları.
 *
 * Neden gerekli: JavaScript'in `toLowerCase()` metodu Türkçe'nin noktalı/noktasız `i`
 * çiftini bilmez. `'ILAÇ'.toLowerCase()` → `'ilaç'` olur ama `'ILIK'.toLowerCase()` → `'ilik'`
 * verir; oysa doğrusu `'ılık'`tır. Üstelik hızlı yazan kullanıcı `ş ğ ü ö ç` tuşlarına
 * uzanmaz — `sari` yazıp `SARI ILAÇ` bulmayı bekler.
 *
 * Katlama olmadan arama "çalışıyor gibi görünür": çoğu ilaç bulunur, bazıları hiç bulunmaz.
 * Ne lint ne build bunu yakalar; yalnızca kullanıcının elinde ortaya çıkar. Bu yüzden
 * `search.test.js` bir kapı olarak duruyor.
 */

// Tabloda olmayan karakterler `toLowerCase()`'e düşer. Türkçe'ye özgü çiftler burada
// açıkça çözülür ki `toLowerCase()`'in yerel-bağımsız davranışına hiç güvenmeyelim.
const FOLD = {
  'ı': 'i', 'I': 'i', 'İ': 'i', 'i': 'i',
  'ş': 's', 'Ş': 's',
  'ğ': 'g', 'Ğ': 'g',
  'ü': 'u', 'Ü': 'u',
  'ö': 'o', 'Ö': 'o',
  'ç': 'c', 'Ç': 'c',
  'â': 'a', 'Â': 'a',
  'î': 'i', 'Î': 'i',
  'û': 'u', 'Û': 'u',
};

/** Aramada karşılaştırılabilir biçime indirger: Türkçe harfler ASCII karşılığına katlanır. */
export function fold(value) {
  let out = '';
  // `for...of` kod noktası bazında gezer; yüzey çiftleri bölünmez
  for (const ch of String(value ?? '')) out += FOLD[ch] ?? ch.toLowerCase();
  return out;
}

/**
 * Sorgudaki her kelimenin metinde geçmesi gerekir (sıra önemsiz).
 * "armapen 250" → hem `armapen` hem `250` içeren adlar eşleşir.
 * Boş sorgu her şeyi eşler.
 */
export function searchMatch(text, query) {
  const haystack = fold(text);
  const tokens = fold(query).split(/\s+/).filter(Boolean);
  return tokens.every(token => haystack.includes(token));
}

/**
 * Adet hızlandırıcısı: "armapen x3" → { term: 'armapen', qty: 3 }.
 *
 * Çarpan işareti (`x`, `*`, `×`) ZORUNLUDUR ve öncesinde boşluk ister. Çıplak sondaki sayı
 * adet sayılmaz, çünkü gerçek ilaç adları sayı içeriyor: "ARMAPEN LA ENJ. SÜSP. - 250 ML".
 * "armapen 250" bir arama terimidir; "max 3" de öyledir (x'in önünde boşluk yok).
 */
export function parseQtyToken(input) {
  const raw = String(input ?? '');
  const match = raw.match(/^(.*?)\s+[x*×]\s*(\d+(?:[.,]\d+)?)\s*$/i);
  if (!match) return { term: raw.trim(), qty: null };

  const term = match[1].trim();
  const qty = parseFloat(match[2].replace(',', '.'));
  if (!term || !(qty > 0)) return { term: raw.trim(), qty: null };

  return { term, qty };
}
