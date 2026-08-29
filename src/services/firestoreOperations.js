import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  runTransaction,
  getDocs,
  query,
  where
} from 'firebase/firestore';
import { db } from './firebase';
import { fmtTL, fmtQty } from '../utils/formatters';
import { todayLocal } from '../utils/dates';
import { selectAffectedDebts } from '../utils/priceImpact';

const chunkIds = (ids, size) => {
  const out = [];
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
  return out;
};

const commitDeletesInBatches = async (refs) => {
  let batch = writeBatch(db);
  let n = 0;
  for (const ref of refs) {
    batch.delete(ref);
    n++;
    if (n >= 450) {
      await batch.commit();
      batch = writeBatch(db);
      n = 0;
    }
  }
  if (n > 0) await batch.commit();
};

/**
 * Yardımcı: Log objesi oluşturucu.
 *
 * `meta.kind` işlemin **türünü** yapısal olarak taşır: `entry` | `payment` | `return` |
 * `price` | `lock` | `cancel`. İptal guard'ı (`utils/batchCancel.js`) "bu borca sonradan
 * aktivite geldi mi" sorusunu bu alanla cevaplar — log başlığına bakmaz, çünkü başlıklar
 * `HistoryModal`'daki `getLogSortPriority` tarafından zaten metin olarak eşleştiriliyor ve
 * oraya ikinci bir bağımlılık eklemek kırılganlığı artırırdı.
 *
 * `meta.batchId` ise logu açıldığı işleme bağlar: aynı `batchId`'yi taşıyan loglar girişin
 * parçasıdır (gömülü geçmiş tahsilat, süpürücü, enflasyon dahil), sonraki aktivite değildir.
 *
 * `meta.flow` + `meta.amount` para hareketini **ölçülebilir** kılar (dönemsel raporlama).
 * `kind` bunun için yetmez: tek başına `kind: 'entry'` beş ayrı olayı kapsar (borç açılışı,
 * gömülü tahsilat, süpürücü, enflasyon). Ayrımı başlıktan yapmak yasak — başlıklar zaten
 * `HistoryModal`'da metin olarak eşleşiyor. `flow` bu ayrımı yapısal hale getirir:
 *
 *   `debt`      borç açıldı            `collect`   para tahsil edildi
 *   `writeoff`  alacak silindi         `inflation` borç enflasyonla arttı
 *   `priceUp`   borç zamla arttı       `return`    mal iade edildi
 *   `cancel`    borç iptal edildi      `advance`   avans hareketi (`balanceDelta`)
 *
 * `amount` **her zaman pozitif büyüklüktür**; yönü `flow` belirler. Raporun okuduğu tek tutar
 * alanı budur — `deduct` tahsilat geri almaya ait iç alan olarak kalır, `balanceDelta` işaretli.
 * Geri alma logları (`Tahsilat İptali`, `Fiyat Güncellemesi İptali`) bilinçli olarak `flow`
 * taşımaz: kendilerini yeni bir hareket saydırmazlar, `revertOf` ile hangi grubu etkisiz
 * kıldıklarını söylerler ve rapor o grubu bütünüyle eler.
 */
/**
 * Borç dokümanlarının sürüm damgası (optimistic lock).
 *
 * Sayaç değil **monoton damga**: `revertPaymentOperations` borcu `set(ref, before)` ile geri
 * yüklüyor ve süpürülmüş borcu aynı doküman id'siyle yeniden yaratıyor — bir sayaç bu yollarda
 * geriye sarardı. Damga sarmaz, dolayısıyla "gördüğümden beri değişti mi" sorusu eşitlik
 * karşılaştırmasıyla güvenle cevaplanır.
 *
 * **Operasyon başına bir kez** çağrılmalı: aynı işlemin dokunduğu tüm borçlar aynı damgayı taşır.
 *
 * Bilinen sınır: aynı milisaniyede iki farklı cihazdan aynı dokümana yazım damgayı eşitleyebilir.
 * Tek kullanıcılı bir defterde pratik bir senaryo değil.
 */
const newRev = () => Date.now();

/** `runTransaction` callback'ini durduran işaret; dışarıda `reason: 'stale'`e çevrilir. */
class StaleWriteError extends Error {
  constructor() {
    super('stale');
    this.name = 'StaleWriteError';
  }
}

/**
 * Borç dokümanı, guard'ın gördüğü halden beri değişmiş mi?
 *
 * Doküman silinmişse veya `rev` uyuşmuyorsa işlem durur. Eski kayıtlarda iki taraf da
 * `undefined` olur ve eşit sayılır — bu bir koruma kaybı **değil**: başka bir sekmenin
 * yaptığı her yazım artık damgalıyor, dolayısıyla `undefined !== <damga>` ile yakalanır.
 */
const assertUnchanged = (snap, expectedRev) => {
  if (!snap.exists()) throw new StaleWriteError();
  if ((snap.data()?.rev ?? undefined) !== (expectedRev ?? undefined)) throw new StaleWriteError();
};

/**
 * Sürüm kontrollü yazım sarmalayıcısı.
 *
 * `writeBatch` ön koşulsuz yazıyor; guard'ın gördüğü durumla commit arasındaki pencereyi
 * ancak transaction kapatabilir. **Bedeli:** `runTransaction` çevrimdışı çalışmaz
 * (`persistentLocalCache` yalnızca `writeBatch`'i kuyruğa alır). Bu yüzden yalnızca nadir
 * geri alma/iptal işlemleri bu yoldan geçer; günlük akış `writeBatch` kalır.
 *
 * @returns {Promise<{ok: boolean, reason?: 'stale'}>}
 */
const runGuarded = async (work) => {
  try {
    await runTransaction(db, work);
    return { ok: true };
  } catch (err) {
    if (err instanceof StaleWriteError) return { ok: false, reason: 'stale' };
    throw err;
  }
};

const createLog = (debtId, title, message, type = 'neutral', customerId, drugId, userId, dateOverride, meta = {}) => {
  const o = {
    debtId,
    date: dateOverride || todayLocal(),
    timestamp: Date.now(),
    title,
    message,
    type
  };
  if (customerId != null && customerId !== '') o.customerId = customerId;
  if (drugId != null && drugId !== '') o.drugId = drugId;
  if (userId != null && userId !== '') o.userId = userId;
  // `meta` içindeki tanımlı tüm alanlar log'a yazılır (kind, batchId ve fiyat geri alma için
  // maxPriceBefore/After, drugPriceBefore/After). 0 geçerli bir fiyat olduğu için yalnızca
  // undefined/null elenir.
  for (const [key, value] of Object.entries(meta)) {
    if (value !== undefined && value !== null && value !== '') o[key] = value;
  }
  return o;
};

export const addCustomer = async (name, userId) => {
  if (!name.trim()) return;
  await addDoc(collection(db, 'customers'), { name: name.trim(), balance: 0, userId });
};

/** Müşteriyi ve ona bağlı tüm hizmet/ilaç borçları ile ilgili ekstre satırlarını siler. */
export const deleteCustomer = async (customerId, userId) => {
  const svcSnap = await getDocs(
    query(collection(db, 'serviceDebts'), where('customerId', '==', customerId), where('userId', '==', userId))
  );
  const drugSnap = await getDocs(
    query(collection(db, 'drugDebts'), where('customerId', '==', customerId), where('userId', '==', userId))
  );

  const debtIds = [...svcSnap.docs.map((d) => d.id), ...drugSnap.docs.map((d) => d.id)];

  const transactionRefSet = new Map();
  const addTxRefs = (snap) => {
    snap.forEach((td) => transactionRefSet.set(td.ref.path, td.ref));
  };

  for (const group of chunkIds(debtIds, 10)) {
    if (group.length === 0) continue;
    const tSnap = await getDocs(query(collection(db, 'transactions'), where('debtId', 'in', group), where('userId', '==', userId)));
    addTxRefs(tSnap);
  }

  const txByCustomer = await getDocs(
    query(collection(db, 'transactions'), where('customerId', '==', customerId), where('userId', '==', userId))
  );
  addTxRefs(txByCustomer);

  const toDelete = [
    ...transactionRefSet.values(),
    ...svcSnap.docs.map((d) => d.ref),
    ...drugSnap.docs.map((d) => d.ref),
    doc(db, 'customers', customerId)
  ];

  await commitDeletesInBatches(toDelete);
};

export const updateCustomerName = async (customerId, newName) => {
  if (!newName.trim()) return;
  await updateDoc(doc(db, 'customers', customerId), { name: newName.trim() });
};

export const addDrug = async (name, price, userId) => {
  const numPrice = parseFloat(price);
  if (!name.trim() || isNaN(numPrice) || numPrice <= 0) return;
  await addDoc(collection(db, 'drugs'), { name: name.trim(), price: numPrice, userId });
};

export const deleteDrug = async (drugId) => {
  await deleteDoc(doc(db, 'drugs', drugId));
};

/**
 * İlacın fiyatını günceller; zam ise açık ve sabitlenmemiş borçların `maxPrice`'ini de yükseltir.
 * Düşüşler mevcut borçlara yansımaz (iş kuralı).
 *
 * Etkilenecek borçlar `selectAffectedDebts` ile seçilir — `computePriceImpact`'in kullanıcıya
 * gösterdiği önizleme **aynı** yardımcıyı kullanır, böylece önizleme ile gerçek yazım ayrışamaz.
 *
 * Loglar geri alma için yapısal veri taşır: borç bazında `maxPriceBefore`/`maxPriceAfter` (her
 * borcun zam öncesi fiyatı farklı olabilir) ve ilacın kendi `drugPriceBefore`/`drugPriceAfter`
 * değeri. Hiçbir borç etkilenmiyorsa log yazılmaz; borçlara dokunulmadığı için geri almaya da
 * gerek yoktur (doğru fiyatı yeniden yazmak tam düzeltmedir).
 *
 * @param {number} [currentPrice] — ilacın zam öncesi fiyatı. Verilmezse `drugPriceBefore`
 *        **hiç yazılmaz**: borç bazındaki `maxPrice`'ten türetmek gruptaki loglara birbirinden
 *        farklı değerler yazardı ve geri alma ilacın fiyatını yanlış bir değere döndürürdü.
 *        O durumda geri alma yalnızca borçların `maxPrice`'ini onarır.
 */
export const updateDrugPrice = async (drugId, newPrice, currentDrugDebts, userId, currentPrice) => {
  if (newPrice <= 0) return;
  const batch = writeBatch(db);
  const priceBatchId = doc(collection(db, 'transactions')).id;
  const rev = newRev();

  batch.update(doc(db, 'drugs', drugId), { price: newPrice });

  selectAffectedDebts(drugId, newPrice, currentDrugDebts).forEach(debt => {
    const oldTotalTl = debt.qty * debt.maxPrice;
    const newTotalTl = debt.qty * newPrice;
    const diffTl = newTotalTl - oldTotalTl;

    batch.update(doc(db, 'drugDebts', debt.id), { maxPrice: newPrice, rev });

    const logRef = doc(collection(db, 'transactions'));
    batch.set(logRef, createLog(
      debt.id,
      'Fiyat Güncellemesi (Zam)',
      `Birim fiyat ${fmtTL(debt.maxPrice)} -> ${fmtTL(newPrice)} oldu. Toplam borç ${fmtTL(oldTotalTl)}'den ${fmtTL(newTotalTl)}'ye çıktı (+${fmtTL(diffTl)} fark).`,
      'warning',
      debt.customerId,
      debt.drugId,
      userId,
      undefined,
      {
        kind: 'price',
        flow: 'priceUp',
        amount: Math.round(diffTl * 100) / 100,
        batchId: priceBatchId,
        maxPriceBefore: debt.maxPrice,
        maxPriceAfter: newPrice,
        drugPriceBefore: currentPrice,
        drugPriceAfter: newPrice
      }
    ));
  });

  await batch.commit();
};

/**
 * Bir ilacın **son** zammını geri alır: ilacın fiyatı ve etkilenen borçların `maxPrice` değeri
 * zam öncesine döner, her borç için bir iptal logu yazılır.
 *
 * Hangi zammın geri alınabileceğine `utils/priceImpact.js` içindeki `canRevertPriceUpdate` karar
 * verir (fail-closed); bu fonksiyon yalnızca o guard'ın verdiği grubun loglarıyla çağrılır.
 *
 * @param {Array<object>} priceLogs — geri alınacak zam grubunun logları (`batch.logs`)
 * @param {Object<string, number>} [expectedRevs] — `debtId → rev`; guard'ın gördüğü sürümler
 * @returns {Promise<{ok: boolean, reason?: 'legacy' | 'stale'}>}
 */
export const revertDrugPriceOperations = async (drugId, priceLogs, userId, expectedRevs = {}) => {
  const logs = (priceLogs || []).filter(l => l?.debtId && l.maxPriceBefore != null);
  if (!drugId || logs.length === 0) return { ok: false, reason: 'legacy' };

  const revertBatchId = doc(collection(db, 'transactions')).id;
  const revertOf = logs.find(l => l.batchId)?.batchId;
  const drugPriceBefore = logs.find(l => l.drugPriceBefore != null)?.drugPriceBefore;
  const rev = newRev();

  // Ref'ler ve loglar callback dışında üretilir (retry'da yeniden çalışır — bkz. `runGuarded`)
  const entries = logs.map(log => ({
    log,
    ref: doc(db, 'drugDebts', log.debtId),
    logRef: doc(collection(db, 'transactions')),
    entry: createLog(
      log.debtId,
      'Fiyat Güncellemesi İptali',
      `Zam geri alındı. Birim fiyat ${fmtTL(log.maxPriceAfter)} -> ${fmtTL(log.maxPriceBefore)} olarak eski değerine döndürüldü.`,
      'success',
      log.customerId,
      drugId,
      userId,
      undefined,
      // `maxPriceBefore` bilinçli olarak yazılmıyor: iptal logu yeni bir "geri alınabilir zam"
      // sayılmamalı, aksi halde geri almanın geri alınması zinciri açılırdı. Guard bu logu
      // yalnızca "daha yeni bir fiyat işlemi var" (not-latest) sinyali olarak görür.
      // `revertOf` hangi grubun etkisiz kaldığını söyler: tam geri alma sonrası borç zam
      // öncesi haline döndüğü için o giriş yeniden iptal edilebilir olmalı.
      { kind: 'price', batchId: revertBatchId, revertOf }
    )
  }));

  return runGuarded(async (tx) => {
    const snaps = await Promise.all(entries.map(e => tx.get(e.ref)));
    snaps.forEach((snap, i) => assertUnchanged(snap, expectedRevs[entries[i].log.debtId]));

    if (drugPriceBefore != null) {
      tx.update(doc(db, 'drugs', drugId), { price: drugPriceBefore });
    }
    entries.forEach(({ log, ref, logRef, entry }) => {
      tx.update(ref, { maxPrice: log.maxPriceBefore, rev });
      tx.set(logRef, entry);
    });
  });
};

export const toggleDebtLock = async (debt, userId) => {
  const batch = writeBatch(db);
  batch.update(doc(db, 'drugDebts', debt.id), { isFixed: !debt.isFixed, rev: newRev() });

  const logRef = doc(collection(db, 'transactions'));
  batch.set(logRef, createLog(
    debt.id,
    debt.isFixed ? 'Sabitleme Kaldırıldı' : 'Fiyat Sabitlendi',
    debt.isFixed ? 'Borç tekrar zamlara açık hale geldi.' : 'Borç donduruldu, zamlardan etkilenmeyecek.',
    'neutral',
    debt.customerId,
    debt.drugId,
    userId,
    undefined,
    { kind: 'lock' }
  ));

  await batch.commit();
};

/**
 * Tek bir ilaç borcunun iade işlemini verilen batch'e yazar.
 * Hem tekli (`returnDrug`) hem toplu (`returnBatchOperations`) iade bu yardımcıyı kullanır.
 * @returns {number} Avansa yazılması gereken fazla iade tutarı (yoksa 0)
 */
const applyReturnToBatch = (batch, debt, returnQty, userId, rev) => {
  if (returnQty <= debt.qty) {
    let finalQty = Math.round((debt.qty - returnQty) * 100) / 100;
    const remainingTl = finalQty * debt.maxPrice;
    let isSwept = false;

    if (remainingTl <= 10) { isSwept = true; finalQty = 0; }

    if (finalQty > 0) {
      batch.update(doc(db, 'drugDebts', debt.id), { qty: finalQty, rev });
    } else {
      batch.delete(doc(db, 'drugDebts', debt.id));
    }

    const returnedTl = Math.round(returnQty * debt.maxPrice * 100) / 100;

    const logRef1 = doc(collection(db, 'transactions'));
    batch.set(logRef1, createLog(debt.id, 'İade İşlemi', `${fmtQty(returnQty)} adet iade edildi. Kalan yeni borç: ${fmtQty(finalQty)} adet (${fmtTL(remainingTl)}).`, 'info', debt.customerId, debt.drugId, userId, undefined, { kind: 'return', flow: 'return', amount: returnedTl }));

    if (isSwept) {
      const logRef2 = doc(collection(db, 'transactions'));
      batch.set(logRef2, createLog(debt.id, 'Süpürücü (Silindi)', `Kalan tutar 10 TL'nin altında (${fmtTL(remainingTl)}) olduğu için sistem borcu sıfırladı.`, 'success', debt.customerId, debt.drugId, userId, undefined, { kind: 'return', flow: 'writeoff', amount: Math.round(remainingTl * 100) / 100 }));
    }

    return 0;
  }

  const excessQty = returnQty - debt.qty;
  const refundTl = Math.round(excessQty * debt.maxPrice * 100) / 100;

  batch.delete(doc(db, 'drugDebts', debt.id));

  // `amount` yalnızca borca sayılan kısımdır; avansa yazılan fazlalık `refund` alanında durur,
  // aksi halde rapor iadeyi olduğundan büyük bir alacak azalması sayardı.
  const closedTl = Math.round(debt.qty * debt.maxPrice * 100) / 100;

  const logRef = doc(collection(db, 'transactions'));
  batch.set(logRef, createLog(debt.id, 'Fazla İade (Avans)', `Tüm borç kapatıldı. Artan ${fmtQty(excessQty)} adet karşılığı ${fmtTL(refundTl)} avans yazıldı.`, 'success', debt.customerId, debt.drugId, userId, undefined, { kind: 'return', flow: 'return', amount: closedTl, refund: refundTl }));

  return refundTl;
};

/**
 * Aynı işlemdeki tüm ilaç borçlarının fiyat kilidini tek atomik yazımda değiştirir.
 * Hepsi sabitse tümü serbest bırakılır; aksi halde (karışık veya hepsi serbest) tümü sabitlenir.
 * Zaten hedef durumda olan kalemlere dokunulmaz, ekstreye gereksiz log düşmez.
 */
export const toggleBatchLockOperations = async (debts, userId) => {
  if (!debts || debts.length === 0) return;

  const target = !debts.every(d => d.isFixed);
  const changed = debts.filter(d => Boolean(d.isFixed) !== target);
  if (changed.length === 0) return;

  const batch = writeBatch(db);
  const rev = newRev();

  changed.forEach(debt => {
    batch.update(doc(db, 'drugDebts', debt.id), { isFixed: target, rev });

    const logRef = doc(collection(db, 'transactions'));
    batch.set(logRef, createLog(
      debt.id,
      target ? 'Fiyat Sabitlendi' : 'Sabitleme Kaldırıldı',
      target ? 'Borç donduruldu, zamlardan etkilenmeyecek.' : 'Borç tekrar zamlara açık hale geldi.',
      'neutral',
      debt.customerId,
      debt.drugId,
      userId,
      undefined,
      { kind: 'lock' }
    ));
  });

  await batch.commit();
};

export const returnDrug = async (debt, returnQty, customerBalance, userId) => {
  if (returnQty <= 0) return;
  const batch = writeBatch(db);

  const refundTl = applyReturnToBatch(batch, debt, returnQty, userId, newRev());
  if (refundTl > 0) {
    batch.update(doc(db, 'customers', debt.customerId), { balance: customerBalance + refundTl });
  }

  await batch.commit();
};

/**
 * Aynı işlemde (batch) açılmış birden fazla ilaç borcunu tek atomik yazımda iade eder.
 * @param {Array<{debt: object, returnQty: number}>} items — kullanıcının seçtiği kalemler
 */
export const returnBatchOperations = async (items, customerBalance, userId) => {
  const valid = (items || []).filter(it => it?.debt && it.returnQty > 0);
  if (valid.length === 0) return;

  const batch = writeBatch(db);
  const rev = newRev();
  let totalRefund = 0;
  let customerId = null;

  for (const { debt, returnQty } of valid) {
    totalRefund += applyReturnToBatch(batch, debt, returnQty, userId, rev);
    customerId = debt.customerId;
  }

  totalRefund = Math.round(totalRefund * 100) / 100;
  if (totalRefund > 0 && customerId) {
    batch.update(doc(db, 'customers', customerId), { balance: Math.round((customerBalance + totalRefund) * 100) / 100 });
  }

  await batch.commit();
};

/**
 * **Tek bir borç kalemini** gerekçeyle iptal eder (hizmet veya ilaç).
 *
 * İşlem iptalinin (`cancelDebtTransactionOperations`) aksine burada guard yoktur: bu, hizmet
 * borcunda bugüne kadar var olan "kalanı sil" yeteneğinin karşılığıdır ve ödeme görmüş bir
 * kalemde de anlamlıdır (tahsil edilen para iade edilmez, yalnızca kalan borç kapanır). Modal
 * bu durumu kullanıcıya açıkça söyler.
 *
 * İptal logu **`batchId` taşımaz**: yalnızca bu kalemin logları iptal işaretlenmeli, aynı
 * işlemdeki diğer kalemler etkilenmemelidir (iptal durumu `debtId` üzerinden türetilir).
 *
 * @param {object} item — `groupDebtsByBatch` grubundaki kalem (`type`, `id`, tutar alanları)
 * @param {string} reason — kullanıcının yazdığı gerekçe (zorunlu)
 */
export const cancelDebtItemOperations = async (customerId, item, reason, userId) => {
  const trimmedReason = (reason || '').trim();
  if (!item?.id || !trimmedReason) return false;

  const isService = item.type === 'service';
  const batch = writeBatch(db);

  batch.delete(doc(db, isService ? 'serviceDebts' : 'drugDebts', item.id));

  const cancelledTl = Math.round((isService
    ? (Number(item.amount) || 0)
    : (item.tlValue ?? item.qty * item.maxPrice)) * 100) / 100;

  const label = isService
    ? `${item.desc || 'Hizmet'} — ${fmtTL(cancelledTl)}`
    : `${item.drugName || 'İlaç'} — ${fmtQty(item.qty)} adet (${fmtTL(cancelledTl)})`;

  const logRef = doc(collection(db, 'transactions'));
  batch.set(logRef, createLog(
    item.id,
    isService ? 'Hizmet Borcu İptali' : 'İlaç Borcu İptali',
    `${label} borç kaydı hatalı giriş olarak iptal edildi. Gerekçe: ${trimmedReason}`,
    'warning',
    customerId,
    isService ? undefined : item.drugId,
    userId,
    undefined,
    { kind: 'cancel', flow: 'cancel', amount: cancelledTl }
  ));

  await batch.commit();
  return true;
};

/**
 * Yanlış girilen bir **işlemin tamamını** tek atomik yazımda iptal eder:
 * gruptaki hizmet/ilaç borcu dokümanları silinir, gerekçeli tek bir `İşlem İptali` logu yazılır.
 *
 * Loglar **silinmez** — açılış logları ekstrede kalır ve iptal logu üzerinden `IPTAL EDİLDİ`
 * olarak işaretlenir; denetim izi korunur.
 *
 * `customers.balance`'a dokunulmaz: giriş yolu (`appendServiceDebtToBatch` /
 * `appendDrugItemsToBatch`) zaten bakiyeye yazmıyor — geçmiş borcun içine gömülü kısmi tahsilat
 * da borç dokümanına işleniyor, şelaleden para geçmiyor. Sonradan gerçek tahsilat/iade görmüş
 * işlemleri `utils/batchCancel.js` içindeki guard zaten dışarıda bırakıyor.
 *
 * @param {string} customerId — süpürülmüş (dokümanı kalmamış) işlemlerde logun sahibini belirler
 * @param {Array<object>} items — `groupDebtsByBatch` grubundaki kalemler (`type: 'service'|'drug'`)
 * @param {string} batchId
 * @param {string} reason — kullanıcının yazdığı gerekçe (zorunlu)
 * @param {Object<string, number>} [expectedRevs] — `debtId → rev`; guard'ın gördüğü sürümler.
 *        Aradan başka bir cihazdan yazım geçmişse iptal yazılmaz.
 * @returns {Promise<{ok: boolean, reason?: 'empty' | 'stale'}>}
 */
export const cancelDebtTransactionOperations = async (customerId, items, batchId, reason, userId, expectedRevs = {}) => {
  const trimmedReason = (reason || '').trim();
  if (!batchId || !trimmedReason) return { ok: false, reason: 'empty' };

  const list = items || [];

  let total = 0;
  for (const item of list) {
    total += item.type === 'service'
      ? (Number(item.amount) || 0)
      : (item.tlValue ?? item.qty * item.maxPrice);
  }
  total = Math.round(total * 100) / 100;

  // Ref'ler ve log callback **dışında** üretilir: transaction retry'da callback yeniden
  // çalışır, içeride üretilen doküman id'si ve `timestamp` her denemede değişirdi.
  const refs = list.map(item => doc(db, item.type === 'service' ? 'serviceDebts' : 'drugDebts', item.id));
  const logRef = doc(collection(db, 'transactions'));
  const log = createLog(
    batchId,
    'İşlem İptali',
    list.length > 0
      ? `${list.length} kalemlik işlem (${fmtTL(total)}) hatalı giriş olarak iptal edildi. Gerekçe: ${trimmedReason}`
      : `Borç kaydı kalmamış işlem hatalı giriş olarak iptal edildi. Gerekçe: ${trimmedReason}`,
    'warning',
    customerId,
    undefined,
    userId,
    undefined,
    { kind: 'cancel', flow: 'cancel', amount: total, batchId }
  );

  return runGuarded(async (tx) => {
    // Firestore kuralı: transaction'da TÜM okumalar TÜM yazmalardan önce gelmeli
    const snaps = await Promise.all(refs.map(ref => tx.get(ref)));
    snaps.forEach((snap, i) => assertUnchanged(snap, expectedRevs[list[i].id]));

    refs.forEach(ref => tx.delete(ref));
    tx.set(logRef, log);
  });
};

/**
 * Bir hizmet borcunu verilen batch'e ekler (bugün veya geçmiş tarihli).
 * @returns {boolean} batch'e bir şey yazıldıysa true
 */
const appendServiceDebtToBatch = (batch, ctx) => {
  const { customerId, desc, amount, date, isToday, paidAmount = 0, paidDate, batchId, createdAt, rev, userId } = ctx;

  if (!(amount > 0)) return false;
  const trimmed = (desc || '').trim();
  if (!trimmed) return false;
  if (paidAmount >= amount) return false;

  const debtRef = doc(collection(db, 'serviceDebts'));
  let finalAmount = amount;
  let isSwept = false;

  const logRef1 = doc(collection(db, 'transactions'));
  batch.set(logRef1, createLog(debtRef.id, isToday ? 'Hizmet Borcu' : 'Geçmiş Hizmet Borcu', `${trimmed} — ${fmtTL(amount)} tutarında hizmet borcu eklendi.`, 'info', customerId, undefined, userId, isToday ? undefined : date, { kind: 'entry', flow: 'debt', amount, batchId }));

  if (paidAmount > 0) {
    finalAmount = Math.round((amount - paidAmount) * 100) / 100;
    if (finalAmount < 0) finalAmount = 0;
    const logRef2 = doc(collection(db, 'transactions'));
    batch.set(logRef2, createLog(debtRef.id, 'Geçmiş Tahsilat', `${fmtTL(paidAmount)} tahsilat düşüldü. Kalan borç: ${fmtTL(finalAmount)}.`, 'success', customerId, undefined, userId, paidDate, { kind: 'entry', flow: 'collect', amount: paidAmount, batchId }));

    if (finalAmount <= 10) {
      isSwept = true;
      const logRef3 = doc(collection(db, 'transactions'));
      // Süpürücü bu dalda yalnızca gömülü tahsilatın sonucu olarak tetiklenir; anlattığı olay
      // o tahsilatla aynı gün gerçekleşmiştir. `timestamp` gerçek giriş anını tutmaya devam eder.
      batch.set(logRef3, createLog(debtRef.id, 'Süpürücü (Silindi)', `Kalan tutar 10 TL'nin altında (${fmtTL(finalAmount)}) olduğu için borç sıfırlandı.`, 'success', customerId, undefined, userId, paidDate || (isToday ? undefined : date), { kind: 'entry', flow: 'writeoff', amount: finalAmount, batchId }));
    }
  }

  if (!isSwept) {
    batch.set(debtRef, { customerId, desc: trimmed, amount: finalAmount, date, batchId, createdAt, rev, userId });
  }

  return true;
};

/**
 * Aynı işlemde girilen ilaç kalemlerini verilen batch'e ekler.
 * Kısmi tahsilat toplam tutara orantılı dağıtılır; son geçerli satır yuvarlama farkını alır.
 * @returns {boolean} batch'e bir şey yazıldıysa true
 */
const appendDrugItemsToBatch = (batch, ctx) => {
  const { customerId, items, date, isToday, paidAmount = 0, paidDate, applyInflation, batchId, createdAt, rev, userId } = ctx;

  const valid = (items || []).filter(it => it?.drug && it.qty > 0 && it.unitPrice > 0);
  if (valid.length === 0) return false;

  const grandTotal = valid.reduce((sum, it) => sum + Math.round(it.qty * it.unitPrice * 100) / 100, 0);
  if (grandTotal <= 0) return false;
  if (paidAmount > 0 && paidAmount >= grandTotal) return false;

  let paidRemaining = paidAmount || 0;

  for (let i = 0; i < valid.length; i++) {
    const item = valid[i];

    const debtRef = doc(collection(db, 'drugDebts'));
    const itemTotal = Math.round(item.qty * item.unitPrice * 100) / 100;
    let finalQty = item.qty;
    let finalMaxPrice = item.unitPrice;
    let isSwept = false;

    const logRef1 = doc(collection(db, 'transactions'));
    batch.set(logRef1, createLog(debtRef.id, isToday ? 'Borç Açıldı' : 'Geçmiş İlaç Borcu', `${fmtQty(item.qty)} adet × ${fmtTL(item.unitPrice)} = ${fmtTL(itemTotal)} borç eklendi.`, 'info', customerId, item.drug.id, userId, isToday ? undefined : date, { kind: 'entry', flow: 'debt', amount: itemTotal, batchId }));

    if (paidRemaining > 0 && grandTotal > 0) {
      const isLast = i === valid.length - 1;
      const share = isLast ? paidRemaining : Math.round((itemTotal / grandTotal) * paidAmount * 100) / 100;
      const actualShare = Math.min(share, itemTotal, paidRemaining);

      if (actualShare > 0) {
        const qtyDeducted = Math.round((actualShare / item.unitPrice) * 100) / 100;
        finalQty = Math.round((item.qty - qtyDeducted) * 100) / 100;
        if (finalQty < 0) finalQty = 0;
        const remainTl = Math.round(finalQty * item.unitPrice * 100) / 100;
        paidRemaining = Math.round((paidRemaining - actualShare) * 100) / 100;

        const logRef2 = doc(collection(db, 'transactions'));
        batch.set(logRef2, createLog(debtRef.id, 'Geçmiş Tahsilat', `${fmtTL(actualShare)} tahsilat düşüldü. ${fmtQty(qtyDeducted)} adet düşüldü. Kalan: ${fmtQty(finalQty)} adet (${fmtTL(remainTl)}).`, 'success', customerId, item.drug.id, userId, paidDate, { kind: 'entry', flow: 'collect', amount: actualShare, batchId }));

        if (remainTl <= 10) {
          isSwept = true;
          const logRef3 = doc(collection(db, 'transactions'));
          // Bkz. hizmet dalındaki not: süpürücünün tarihi onu tetikleyen tahsilatın tarihidir
          batch.set(logRef3, createLog(debtRef.id, 'Süpürücü (Silindi)', `Kalan tutar 10 TL'nin altında (${fmtTL(remainTl)}) olduğu için borç sıfırlandı.`, 'success', customerId, item.drug.id, userId, paidDate || (isToday ? undefined : date), { kind: 'entry', flow: 'writeoff', amount: remainTl, batchId }));
        }
      }
    }

    if (!isSwept && applyInflation && item.drug.price > item.unitPrice) {
      finalMaxPrice = item.drug.price;
      const oldRemaining = Math.round(finalQty * item.unitPrice * 100) / 100;
      const newRemaining = Math.round(finalQty * item.drug.price * 100) / 100;
      const logRef4 = doc(collection(db, 'transactions'));
      batch.set(logRef4, createLog(debtRef.id, 'Enflasyon Güncellemesi', `Birim fiyat ${fmtTL(item.unitPrice)} → ${fmtTL(item.drug.price)} olarak güncellendi. Kalan borç ${fmtTL(oldRemaining)} → ${fmtTL(newRemaining)}.`, 'warning', customerId, item.drug.id, userId, undefined, { kind: 'entry', flow: 'inflation', amount: Math.round((newRemaining - oldRemaining) * 100) / 100, batchId }));
    }

    if (!isSwept) {
      batch.set(debtRef, { customerId, drugId: item.drug.id, qty: finalQty, maxPrice: finalMaxPrice, isFixed: false, date, batchId, createdAt, rev, userId });
    }
  }

  return true;
};

/**
 * Bir ziyarette girilen hizmet ve ilaç kalemlerini **tek atomik yazımda** borç olarak açar.
 * Yazılan tüm dokümanlar (hizmet + ilaç) ortak bir `batchId` taşır; `createdAt` aynı güne
 * düşen iki ayrı işlemi kronolojik olarak ayırt eder.
 *
 * Bölümler birbirinden bağımsız doğrulanır: geçersiz bir hizmet girişi, geçerli ilaç
 * kalemlerinin yazılmasını engellemez. Hiçbir bölüm yazmadıysa commit edilmez.
 *
 * @param {object} payload
 * @param {string} payload.date — işlem tarihi (YYYY-MM-DD); bugünse "bugünkü borç" logları yazılır
 * @param {{desc: string, amount: number, paidAmount?: number, paidDate?: string}|null} payload.service
 * @param {Array<{drug: object, qty: number, unitPrice: number}>} payload.drugItems
 */
export const addDebtTransactionOperations = async (customerId, payload, userId) => {
  const {
    date,
    service = null,
    drugItems = [],
    drugPaidAmount = 0,
    drugPaidDate = null,
    applyInflation = false
  } = payload || {};

  const today = todayLocal();
  const effectiveDate = date || today;
  const common = {
    customerId,
    date: effectiveDate,
    isToday: effectiveDate === today,
    batchId: doc(collection(db, 'drugDebts')).id,
    createdAt: Date.now(),
    rev: newRev(),
    userId
  };

  const batch = writeBatch(db);
  let wrote = false;

  if (service) {
    wrote = appendServiceDebtToBatch(batch, {
      ...common,
      desc: service.desc,
      amount: service.amount,
      paidAmount: service.paidAmount || 0,
      paidDate: service.paidDate
    }) || wrote;
  }

  if (drugItems.length > 0) {
    wrote = appendDrugItemsToBatch(batch, {
      ...common,
      items: drugItems,
      paidAmount: drugPaidAmount,
      paidDate: drugPaidDate,
      applyInflation
    }) || wrote;
  }

  if (!wrote) return;
  await batch.commit();
};

/**
 * Bir tahsilatı bütünüyle geri alır: borçlar ödeme öncesi haline döner, bakiye ters delta ile
 * onarılır, her borç için gerekçeli bir `Tahsilat İptali` logu yazılır.
 *
 * Her kalem için **tek kod yolu** vardır: `set(ref, before)`. Süpürülüp silinmiş borç aynı
 * doküman id'siyle yeniden yaratılır (eski logları kopmaz), yaşayan borç ise ödeme öncesi haline
 * geri yazılır. Guard (`utils/paymentRevert.js`) aradan değişiklik geçmediğini garanti ettiği
 * için mutlak geri yükleme delta hesabından hem daha basit hem kayan noktadan bağımsızdır.
 *
 * @param {Array<object>} paymentLogs — geri alınacak ödeme grubunun logları (`batch.logs`)
 * @param {string} reason — kullanıcının yazdığı gerekçe (zorunlu)
 * @param {Object<string, number>} [expectedRevs] — `debtId → rev`; yaşayan borçların guard
 *        anındaki sürümleri. Süpürülmüş borçlar (`log.removed`) burada yer almaz.
 * @returns {Promise<{ok: boolean, reason?: 'empty' | 'stale'}>}
 */
export const revertPaymentOperations = async (customer, paymentLogs, reason, userId, expectedRevs = {}) => {
  const trimmedReason = (reason || '').trim();
  const logs = (paymentLogs || []).filter(l => l?.debtId && l.before);
  const balanceDelta = (paymentLogs || []).find(l => l?.balanceDelta != null)?.balanceDelta ?? 0;

  if (!customer?.id || !trimmedReason || (logs.length === 0 && balanceDelta === 0)) {
    return { ok: false, reason: 'empty' };
  }

  const revertBatchId = doc(collection(db, 'transactions')).id;
  const revertOf = (paymentLogs || []).find(l => l?.batchId)?.batchId;
  const rev = newRev();

  // Ref'ler ve loglar callback dışında üretilir (retry'da yeniden çalışır — bkz. `runGuarded`)
  const entries = logs.map((log) => {
    const isService = log.before.desc !== undefined;
    const restored = isService
      ? fmtTL(log.before.amount)
      : `${fmtQty(log.before.qty)} adet (${fmtTL(Math.round(log.before.qty * log.before.maxPrice * 100) / 100)})`;

    return {
      log,
      ref: doc(db, isService ? 'serviceDebts' : 'drugDebts', log.debtId),
      logRef: doc(collection(db, 'transactions')),
      entry: createLog(
        log.debtId,
        'Tahsilat İptali',
        `${fmtTL(log.deduct ?? 0)} tahsilat geri alındı. Borç ${restored} olarak eski haline döndü. Gerekçe: ${trimmedReason}`,
        'warning',
        customer.id,
        log.drugId,
        userId,
        undefined,
        // `balanceDelta` bilinçli olarak yazılmıyor: iptal logu yeni bir "geri alınabilir tahsilat"
        // sayılmamalı. Guard onu yalnızca `not-latest` sinyali olarak görür.
        { kind: 'payment', batchId: revertBatchId, revertOf }
      )
    };
  });

  const advanceLogRef = doc(collection(db, 'transactions'));
  const advanceLog = balanceDelta === 0 ? null : createLog(
    revertBatchId,
    'Tahsilat İptali',
    balanceDelta > 0
      ? `Avansa yazılan ${fmtTL(balanceDelta)} geri alındı. Gerekçe: ${trimmedReason}`
      : `Kullanılan ${fmtTL(Math.abs(balanceDelta))} avans iade edildi. Gerekçe: ${trimmedReason}`,
    'warning',
    customer.id,
    undefined,
    userId,
    undefined,
    { kind: 'payment', batchId: revertBatchId, revertOf }
  );

  // Süpürülmüş borçlar (`removed`) **okunmaz**: tahsilat onları silmişti, yani dokümanın
  // yok olması beklenir. Var olmayan bir dokümanı okumak, güvenlik kuralı `resource.data`ya
  // dokunduğu sürece `permission-denied` verir — `exists() === false` değil. Bu, geri almanın
  // en sık senaryosunu (tam tahsilatın geri alınması) tümüyle kırıyordu. Aradan işlem geçmiş
  // olması durumu zaten `canRevertPayment` guard'ında yakalanıyor.
  const toVerify = entries.filter(e => !e.log.removed);

  return runGuarded(async (tx) => {
    const snaps = await Promise.all(toVerify.map(e => tx.get(e.ref)));
    snaps.forEach((snap, i) => assertUnchanged(snap, expectedRevs[toVerify[i].log.debtId]));

    entries.forEach(({ log, ref, logRef, entry }) => {
      // `before` `rev` taşımaz (bkz. `snapshotOf`); geri yüklenen borç taze damga alır
      tx.set(ref, { ...log.before, rev });
      tx.set(logRef, entry);
    });

    if (advanceLog) tx.set(advanceLogRef, advanceLog);

    tx.update(doc(db, 'customers', customer.id), {
      balance: Math.round((customer.balance - balanceDelta) * 100) / 100
    });
  });
};

/**
 * Borç dokümanının geri yükleme için saklanacak anlık görüntüsü.
 *
 * `id` doküman yolunda taşınır. `rev` **bilinçli olarak elenir**: geri yükleme taze bir damga
 * almalı. Eski damgayı geri yazmak sürüm sayacını geriye sarardı ve bayat bir sekme borcu
 * "değişmemiş" sanardı (ABA). Ayrıca denetim logunu sürüm verisiyle kirletmez.
 */
const snapshotOf = (debt) => {
  const copy = { ...debt };
  delete copy.id;
  delete copy.rev;
  return copy;
};

/**
 * Tahsilatı şelale dağıtımına göre borçlara uygular ve müşteri bakiyesini günceller.
 *
 * Her `kind: 'payment'` logu geri alma için yapısal veri taşır: çağrı başına ortak `batchId`,
 * borcun ödeme **öncesi tam anlık görüntüsü** (`before`) ve grubun `balanceDelta` değeri.
 * `before` hem silinen borcu aynı doküman id'siyle yeniden yaratmayı hem yaşayan borcu birebir
 * geri yüklemeyi mümkün kılar (bkz. `revertPaymentOperations`).
 *
 * Bakiye yalnızca **gerçekten uygulanan** düşümlerden etkilenir: dağıtımdaki bir borç artık
 * yoksa (bayat veri) o kalem tamamen atlanır. Önceden düşüm bakiyeden çıkarılıyor ama borca
 * yazılmıyordu, yani para kayboluyordu.
 */
export const applyPaymentOperations = async (customer, receivedAmount, distributionArr, currentServiceDebts, currentDrugDebts, userId) => {
  if (receivedAmount < 0) return;

  const batch = writeBatch(db);
  const paymentBatchId = doc(collection(db, 'transactions')).id;
  const rev = newRev();

  // Loglar `balanceDelta`'yı taşıyacağı için toplam, yazımdan önce hesaplanır
  const resolved = (distributionArr || [])
    .filter(item => item.deduct > 0)
    .map(item => {
      const debt = item.type === 'service'
        ? currentServiceDebts.find(d => d.id === item.id)
        : currentDrugDebts.find(d => d.id === item.id);
      return debt ? { item, debt } : null;
    })
    .filter(Boolean);

  const totalDeducted = Math.round(resolved.reduce((sum, r) => sum + r.item.deduct, 0) * 100) / 100;
  const balanceDelta = Math.round((receivedAmount - totalDeducted) * 100) / 100;
  const meta = { kind: 'payment', batchId: paymentBatchId, balanceDelta };

  resolved.forEach(({ item, debt }) => {
    const before = snapshotOf(debt);

    if (item.type === 'service') {
      const newAmount = Math.round((debt.amount - item.deduct) * 100) / 100;
      const removed = newAmount <= 10;

      if (removed) batch.delete(doc(db, 'serviceDebts', item.id));
      else batch.update(doc(db, 'serviceDebts', item.id), { amount: newAmount, rev });

      const logRef1 = doc(collection(db, 'transactions'));
      batch.set(logRef1, createLog(item.id, 'Tahsilat',
        `${fmtTL(item.deduct)} ödendi. Kalan borç: ${fmtTL(newAmount)}.`,
        'success', customer.id, undefined, userId, undefined,
        { ...meta, flow: 'collect', amount: item.deduct, deduct: item.deduct, removed, before }));

      if (removed && newAmount > 0) {
        const logRef2 = doc(collection(db, 'transactions'));
        batch.set(logRef2, createLog(item.id, 'Süpürücü (Kapatıldı)',
          `Kalan mikro küsurat 10 TL altında olduğu için silindi.`,
          'success', customer.id, undefined, userId, undefined,
          { ...meta, flow: 'writeoff', amount: newAmount }));
      }
    } else {
      const qtyToDeduct = Math.round((item.deduct / debt.maxPrice) * 100) / 100;
      const newQty = Math.round((debt.qty - qtyToDeduct) * 100) / 100;
      const remainingTl = Math.round(newQty * debt.maxPrice * 100) / 100;
      const removed = remainingTl <= 10;

      const logRef1 = doc(collection(db, 'transactions'));
      batch.set(logRef1, createLog(item.id, 'Tahsilat', `${fmtTL(item.deduct)} ödendi. ${fmtQty(qtyToDeduct)} adet borçtan düşüldü. Kalan yeni borç: ${fmtQty(newQty)} adet (${fmtTL(remainingTl)}).`, 'success', customer.id, debt.drugId, userId, undefined,
        { ...meta, flow: 'collect', amount: item.deduct, deduct: item.deduct, qtyDeducted: qtyToDeduct, removed, before }));

      if (removed) {
        if (remainingTl > 0) {
          const logRef2 = doc(collection(db, 'transactions'));
          batch.set(logRef2, createLog(item.id, 'Süpürücü (Kapatıldı)', `Kalan mikro küsurat 10 TL altında olduğu için silindi.`, 'success', customer.id, debt.drugId, userId, undefined, { ...meta, flow: 'writeoff', amount: remainingTl }));
        }
        batch.delete(doc(db, 'drugDebts', item.id));
      } else {
        batch.update(doc(db, 'drugDebts', item.id), { qty: newQty, rev });
      }
    }
  });

  // Avans hareketi bugüne kadar ekstrede hiç görünmüyordu: borçlara dağıtılmayan para sessizce
  // bakiyeye yazılıyordu. Artık kaydı düşüyor ve geri almanın tutunacağı bir log oluyor.
  if (balanceDelta !== 0) {
    const logRef = doc(collection(db, 'transactions'));
    batch.set(logRef, createLog(paymentBatchId, 'Avans Girişi',
      balanceDelta > 0
        ? `${fmtTL(balanceDelta)} borçlara dağıtılmadı, avansa yazıldı.`
        : `${fmtTL(Math.abs(balanceDelta))} mevcut avanstan kullanıldı.`,
      'success', customer.id, undefined, userId, undefined,
      // Tutar `balanceDelta`'da ve işaretlidir; `amount` yazılmaz ki avans hareketi
      // pozitif büyüklük olarak ikinci kez toplanmasın.
      { ...meta, flow: 'advance' }));
  }

  batch.update(doc(db, 'customers', customer.id), {
    balance: Math.round((customer.balance + balanceDelta) * 100) / 100
  });

  await batch.commit();
};

