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

/** Eşleşme eşiği. Gerçek katalogda ölçülerek seçildi (bkz. docs/TASK.md TASK-037/039). */
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

/**
 * Paylaşılan ayırt edici kelime / **birleşim** (Jaccard).
 *
 * Önce `min(|a|,|b|)`'ye bölünüyordu; bu, tek kelimelik bir ada ("Vitamin", "K") her zaman
 * 1.0 verir — kelime ne kadar yaygın olursa olsun, küçük küme tamamen kapsanır. Sorun
 * nadirlik değil **kapsama** idi: ölçüm, `vitamin`'in yalnızca 11 dokümanda geçtiğini
 * gösterdi (`armaflor` 3, `armapen` 5), yani nadirliğe göre ağırlıklandırma bu ikisini
 * ayıramazdı. Birleşime bölmek, eşleşmeyen kelimeleri de cezalandırdığı için "Vitamin"i
 * "Vitamin ADEK"ten ayırır.
 *
 * Gerçek katalogda ölçüldü (1.141 doküman, 2026-09-08) — eşik her iki kuralda da 0.5:
 *
 *   kural            Vitamin  K  B12  ARMAFLOR  ARMAPEN  isabet  gürültü (ortanca/p90/en çok)
 *   min (eski)            11  9   10         3        5    %100            4 / 13 / 30
 *   birleşim (yeni)        2  6    9         3        4    %100             2 /  4 /  8
 *
 * "İsabet", katalog adının AYNISI elle girilmişse mutlaka uyarılması — ikisinde de %100,
 * yani gürültü azalırken hiçbir gerçek mükerrer kaçırılmıyor. ARMAPEN'de düşen tek kayıt
 * "Armapen Enjeksiyonluk Süspansiyon **Tozu ve Çözücüsü**" (0.20): zaten farklı bir ürün.
 * Eşik 0.34 / 0.4 / 0.5'te aynı sonucu veriyor — sonuç eşiğe duyarlı değil.
 */
export function similarityScore(nameA, nameB, stopTokens) {
  const a = new Set(tokenizeName(nameA).filter(t => !stopTokens.has(t)));
  const b = new Set(tokenizeName(nameB).filter(t => !stopTokens.has(t)));
  if (!a.size || !b.size) return 0;

  let shared = 0;
  for (const token of a) if (b.has(token)) shared++;
  return shared / (a.size + b.size - shared);
}

/**
 * Ambalaj imzası: addaki **başlı başına sayı** olan kelimeler.
 *
 * `b12` içindeki 12 sayılmaz — imza yalnızca ayrı bir kelime olan sayılardan kurulur,
 * yoksa etken madde adları ambalaj sanılır. `4×4` biçimi **bozulmadan** taşınır (fold
 * `×`'i `x`'e çevirir, bkz. utils/search.js): parçalarına ayrılıp tekilleştirilseydi
 * `4×4 ML` ile `4 ML` aynı imzayı alırdı — 4 pipetlik kutu ile tek pipet aynı şey değil.
 *
 * Tekilleştirme kelime düzeyinde: katalogda ambalaj hem adda hem `unit`'te geçtiği için
 * ("… - 250 ml" + `unit: '250 ML'`) aynı kelime iki kez sayılmamalı.
 *
 * Boş imza "ambalaj bilinmiyor" demektir, "ambalaj yok" değil — bilinmeyen imza asla
 * eşleşme sayılmaz (katalogun 93 dokümanı imzasız).
 */
export function packageSignature(text) {
  const parts = new Set();
  for (const token of tokenizeName(text)) {
    if (/^\d+$/.test(token) || /^\d+x\d+$/.test(token)) parts.add(token);
  }
  return [...parts].sort().join('+');
}

/** Katalog dokümanının imzası: ad + `unit` (ad ambalajı taşımayabilir, `unit` taşır). */
export function catalogPackageSignature(doc) {
  return packageSignature(`${doc?.name ?? ''} ${doc?.unit ?? ''}`);
}

/**
 * OLASI mükerrer katmanı: elle girilmiş (yani `catalogId` taşımayan) eski kayıtlarla
 * ad benzerliği.
 *
 * Bilerek **engellemez, yalnızca uyarır**: tahmine dayanarak meşru bir eklemeyi engellemek,
 * mükerrer kayıttan daha kötüdür.
 *
 * İki güçte döner ve bu ayrım **bilgi ekler, uyarı eksiltmez**:
 * - `samePackage: true` — ad ailesi VE ambalaj imzası tutuyor; muhtemelen aynı kalem
 * - `samePackage: false` — yalnızca aile tutuyor; "250 ML" ile "100 ML" gerçekten farklı
 *   ürünlerdir, o yüzden bu hâlâ yalnızca bir not
 *
 * Ambalaj **eşiği yükseltmek için kullanılmaz**: 100 ml eklerken listedeki 250 ml'nin
 * uyarısı susturulsaydı, tam da önlenmek istenen mükerrer geri gelirdi. Kapsama isabete
 * tercih edilir — kaçırılan uyarı mükerrer kayıt (iki `drugId`, bölünmüş borç geçmişi)
 * demek, fazladan uyarı yalnızca gürültü.
 *
 * Birden çok eşleşmede ambalajı tutan tercih edilir: kullanıcıya en çok bilgi veren o.
 */
export function similarOwned(drugs, catalogDoc, stopTokens) {
  if (!catalogDoc?.name || !stopTokens) return null;
  const docSignature = catalogPackageSignature(catalogDoc);

  let weakest = null;
  for (const drug of drugs) {
    if (drug.catalogId) continue; // kesin katman zaten bakıyor
    if (similarityScore(drug.name, catalogDoc.name, stopTokens) < SIMILARITY_THRESHOLD) continue;

    // Imzasiz dokuman asla "ayni ambalaj" sayilmaz: bilinmeyen esitlik degildir
    if (docSignature && packageSignature(drug.name) === docSignature) {
      return { drug, samePackage: true };
    }
    if (!weakest) weakest = { drug, samePackage: false };
  }
  return weakest;
}
