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

/**
 * OLASI mükerrer katmanı: elle girilmiş (yani `catalogId` taşımayan) eski kayıtlarla
 * ad benzerliği.
 *
 * Bilerek **engellemez, yalnızca uyarır**: "250 ML" ile "500 ML" gerçekten farklı
 * ürünlerdir ve tahmine dayanarak meşru bir eklemeyi engellemek, mükerrer kayıttan
 * daha kötüdür.
 */
export function similarOwnedName(drugs, catalogDoc) {
  const target = fold(catalogDoc.name);
  if (!target) return null;

  return drugs.find(drug => {
    if (drug.catalogId) return false; // kesin katman zaten bakıyor
    const own = fold(drug.name);
    return own === target || own.includes(target) || target.includes(own);
  }) || null;
}
