import { fold, searchMatch } from './search';

/**
 * Ortak ilaç kataloğunun çalışma zamanı mantığı (TASK-037).
 *
 * Katalog dokümanının üretimi `scripts/catalogTransform.js`'te (derleme zamanı);
 * burası aramanın ve mükerrer kuralının yaşadığı yer.
 */

/** Aramanın üzerinde çalıştığı metin — ad + firma + form + etken madde. */
export function catalogHaystack(doc) {
  return [doc.name, doc.firma, doc.form, ...(doc.etkenMaddeler || [])]
    .filter(Boolean)
    .join(' ');
}

/** Sorgudaki her kelime bu alanlardan birinde geçmeli (Türkçe katlamalı). */
export function matchesCatalog(doc, term) {
  return searchMatch(catalogHaystack(doc), term);
}

/**
 * KESİN mükerrer katmanı: kullanıcının listesinde aynı `catalogId` zaten var mı.
 *
 * Bileşik kimlik sayesinde aynı ürünün farklı ambalajı ENGELLENMEZ — `...#100 ML` ile
 * `...#250 ML` ayrı stok kalemleridir ve ikisi de eklenebilir.
 */
export function ownedByCatalogId(drugs) {
  const map = new Map();
  for (const drug of drugs) {
    if (drug.catalogId) map.set(drug.catalogId, drug);
  }
  return map;
}

/** Adı karşılaştırılabilir kelimelere böler (Türkçe katlamalı, noktalama atılır). */
export function tokenizeName(name) {
  return fold(name).split(/[^a-z0-9]+/).filter(Boolean);
}

// Katalogun bu oranından fazlasında geçen kelime ayırt edici sayılmaz.
// `MIN` küçük kataloglarda (ve testlerde) oranın her şeyi elemesini engeller.
const STOP_RATIO = 0.02;
const STOP_MIN = 3;

/** Eşleşme eşiği. Gerçek katalogda ölçülerek seçildi (bkz. docs/TASK.md TASK-037). */
export const SIMILARITY_THRESHOLD = 0.5;

/**
 * Ayırt edici olmayan kelimeleri **veriden öğrenir**: `ml`, `enj`, `çözelti`, `la` ve
 * ambalaj sayıları katalogun büyük bölümünde geçer, dolayısıyla bir eşleşme sinyali değildir.
 * Elle bakım gerektiren bir kelime listesi tutulmaz.
 */
export function buildStopTokens(catalog) {
  const freq = new Map();
  for (const doc of catalog) {
    for (const token of new Set(tokenizeName(doc.name))) {
      freq.set(token, (freq.get(token) || 0) + 1);
    }
  }
  const limit = Math.max(STOP_MIN, catalog.length * STOP_RATIO);
  return new Set([...freq.entries()].filter(([, n]) => n >= limit).map(([t]) => t));
}

/** Paylaşılan ayırt edici kelime / daha küçük kümenin boyutu. */
export function similarityScore(nameA, nameB, stopTokens) {
  const a = new Set(tokenizeName(nameA).filter(t => !stopTokens.has(t)));
  const b = new Set(tokenizeName(nameB).filter(t => !stopTokens.has(t)));
  if (!a.size || !b.size) return 0;

  let shared = 0;
  for (const token of a) if (b.has(token)) shared++;
  return shared / Math.min(a.size, b.size);
}

/**
 * OLASI mükerrer katmanı: elle girilmiş (yani `catalogId` taşımayan) eski kayıtlarla
 * ad benzerliği.
 *
 * Bilerek **engellemez, yalnızca uyarır**: tahmine dayanarak meşru bir eklemeyi engellemek,
 * mükerrer kayıttan daha kötüdür.
 *
 * Eşleşme **ürün ailesi düzeyindedir, ambalaj düzeyinde değil**: ambalaj sayıları katalogun
 * çoğunda geçtiği için elenir, dolayısıyla aynı ürünün 100/250 ml varyantları birbirinden
 * ayrılamaz. Arayüz bu yüzden "aynıdır" demez, "benzer kayıt var" der — algoritmanın gerçekten
 * hesapladığı şey budur. Kapsama isabete tercih edildi: kaçırılan uyarı mükerrer kayıt (iki
 * `drugId`, bölünmüş borç geçmişi) demek, yanlış uyarı yalnızca gürültü.
 */
export function similarOwnedName(drugs, catalogDoc, stopTokens) {
  if (!catalogDoc?.name || !stopTokens) return null;

  return drugs.find(drug => {
    if (drug.catalogId) return false; // kesin katman zaten bakıyor
    return similarityScore(drug.name, catalogDoc.name, stopTokens) >= SIMILARITY_THRESHOLD;
  }) || null;
}
