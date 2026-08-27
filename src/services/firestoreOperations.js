import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
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
 */
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

  batch.update(doc(db, 'drugs', drugId), { price: newPrice });

  selectAffectedDebts(drugId, newPrice, currentDrugDebts).forEach(debt => {
    const oldTotalTl = debt.qty * debt.maxPrice;
    const newTotalTl = debt.qty * newPrice;
    const diffTl = newTotalTl - oldTotalTl;

    batch.update(doc(db, 'drugDebts', debt.id), { maxPrice: newPrice });

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
 */
export const revertDrugPriceOperations = async (drugId, priceLogs, userId) => {
  const logs = (priceLogs || []).filter(l => l?.debtId && l.maxPriceBefore != null);
  if (!drugId || logs.length === 0) return false;

  const batch = writeBatch(db);
  const revertBatchId = doc(collection(db, 'transactions')).id;
  const revertOf = logs.find(l => l.batchId)?.batchId;
  const drugPriceBefore = logs.find(l => l.drugPriceBefore != null)?.drugPriceBefore;

  if (drugPriceBefore != null) {
    batch.update(doc(db, 'drugs', drugId), { price: drugPriceBefore });
  }

  for (const log of logs) {
    batch.update(doc(db, 'drugDebts', log.debtId), { maxPrice: log.maxPriceBefore });

    const logRef = doc(collection(db, 'transactions'));
    batch.set(logRef, createLog(
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
    ));
  }

  await batch.commit();
  return true;
};

export const toggleDebtLock = async (debt, userId) => {
  const batch = writeBatch(db);
  batch.update(doc(db, 'drugDebts', debt.id), { isFixed: !debt.isFixed });

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
const applyReturnToBatch = (batch, debt, returnQty, userId) => {
  if (returnQty <= debt.qty) {
    let finalQty = Math.round((debt.qty - returnQty) * 100) / 100;
    const remainingTl = finalQty * debt.maxPrice;
    let isSwept = false;

    if (remainingTl <= 10) { isSwept = true; finalQty = 0; }

    if (finalQty > 0) {
      batch.update(doc(db, 'drugDebts', debt.id), { qty: finalQty });
    } else {
      batch.delete(doc(db, 'drugDebts', debt.id));
    }

    const logRef1 = doc(collection(db, 'transactions'));
    batch.set(logRef1, createLog(debt.id, 'İade İşlemi', `${fmtQty(returnQty)} adet iade edildi. Kalan yeni borç: ${fmtQty(finalQty)} adet (${fmtTL(remainingTl)}).`, 'info', debt.customerId, debt.drugId, userId, undefined, { kind: 'return' }));

    if (isSwept) {
      const logRef2 = doc(collection(db, 'transactions'));
      batch.set(logRef2, createLog(debt.id, 'Süpürücü (Silindi)', `Kalan tutar 10 TL'nin altında (${fmtTL(remainingTl)}) olduğu için sistem borcu sıfırladı.`, 'success', debt.customerId, debt.drugId, userId, undefined, { kind: 'return' }));
    }

    return 0;
  }

  const excessQty = returnQty - debt.qty;
  const refundTl = Math.round(excessQty * debt.maxPrice * 100) / 100;

  batch.delete(doc(db, 'drugDebts', debt.id));

  const logRef = doc(collection(db, 'transactions'));
  batch.set(logRef, createLog(debt.id, 'Fazla İade (Avans)', `Tüm borç kapatıldı. Artan ${fmtQty(excessQty)} adet karşılığı ${fmtTL(refundTl)} avans yazıldı.`, 'success', debt.customerId, debt.drugId, userId, undefined, { kind: 'return' }));

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

  changed.forEach(debt => {
    batch.update(doc(db, 'drugDebts', debt.id), { isFixed: target });

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

  const refundTl = applyReturnToBatch(batch, debt, returnQty, userId);
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
  let totalRefund = 0;
  let customerId = null;

  for (const { debt, returnQty } of valid) {
    totalRefund += applyReturnToBatch(batch, debt, returnQty, userId);
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

  const label = isService
    ? `${item.desc || 'Hizmet'} — ${fmtTL(Number(item.amount) || 0)}`
    : `${item.drugName || 'İlaç'} — ${fmtQty(item.qty)} adet (${fmtTL(item.tlValue ?? item.qty * item.maxPrice)})`;

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
    { kind: 'cancel' }
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
 * @returns {boolean} iptal yazıldıysa true
 */
export const cancelDebtTransactionOperations = async (customerId, items, batchId, reason, userId) => {
  const trimmedReason = (reason || '').trim();
  if (!batchId || !trimmedReason) return false;

  const list = items || [];
  const batch = writeBatch(db);

  let total = 0;
  for (const item of list) {
    batch.delete(doc(db, item.type === 'service' ? 'serviceDebts' : 'drugDebts', item.id));
    total += item.type === 'service'
      ? (Number(item.amount) || 0)
      : (item.tlValue ?? item.qty * item.maxPrice);
  }
  total = Math.round(total * 100) / 100;

  const logRef = doc(collection(db, 'transactions'));
  batch.set(logRef, createLog(
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
    { kind: 'cancel', batchId }
  ));

  await batch.commit();
  return true;
};

/**
 * Bir hizmet borcunu verilen batch'e ekler (bugün veya geçmiş tarihli).
 * @returns {boolean} batch'e bir şey yazıldıysa true
 */
const appendServiceDebtToBatch = (batch, ctx) => {
  const { customerId, desc, amount, date, isToday, paidAmount = 0, paidDate, batchId, createdAt, userId } = ctx;

  if (!(amount > 0)) return false;
  const trimmed = (desc || '').trim();
  if (!trimmed) return false;
  if (paidAmount >= amount) return false;

  const debtRef = doc(collection(db, 'serviceDebts'));
  let finalAmount = amount;
  let isSwept = false;

  const logRef1 = doc(collection(db, 'transactions'));
  batch.set(logRef1, createLog(debtRef.id, isToday ? 'Hizmet Borcu' : 'Geçmiş Hizmet Borcu', `${trimmed} — ${fmtTL(amount)} tutarında hizmet borcu eklendi.`, 'info', customerId, undefined, userId, isToday ? undefined : date, { kind: 'entry', batchId }));

  if (paidAmount > 0) {
    finalAmount = Math.round((amount - paidAmount) * 100) / 100;
    if (finalAmount < 0) finalAmount = 0;
    const logRef2 = doc(collection(db, 'transactions'));
    batch.set(logRef2, createLog(debtRef.id, 'Geçmiş Tahsilat', `${fmtTL(paidAmount)} tahsilat düşüldü. Kalan borç: ${fmtTL(finalAmount)}.`, 'success', customerId, undefined, userId, paidDate, { kind: 'entry', batchId }));

    if (finalAmount <= 10) {
      isSwept = true;
      const logRef3 = doc(collection(db, 'transactions'));
      // Süpürücü bu dalda yalnızca gömülü tahsilatın sonucu olarak tetiklenir; anlattığı olay
      // o tahsilatla aynı gün gerçekleşmiştir. `timestamp` gerçek giriş anını tutmaya devam eder.
      batch.set(logRef3, createLog(debtRef.id, 'Süpürücü (Silindi)', `Kalan tutar 10 TL'nin altında (${fmtTL(finalAmount)}) olduğu için borç sıfırlandı.`, 'success', customerId, undefined, userId, paidDate || (isToday ? undefined : date), { kind: 'entry', batchId }));
    }
  }

  if (!isSwept) {
    batch.set(debtRef, { customerId, desc: trimmed, amount: finalAmount, date, batchId, createdAt, userId });
  }

  return true;
};

/**
 * Aynı işlemde girilen ilaç kalemlerini verilen batch'e ekler.
 * Kısmi tahsilat toplam tutara orantılı dağıtılır; son geçerli satır yuvarlama farkını alır.
 * @returns {boolean} batch'e bir şey yazıldıysa true
 */
const appendDrugItemsToBatch = (batch, ctx) => {
  const { customerId, items, date, isToday, paidAmount = 0, paidDate, applyInflation, batchId, createdAt, userId } = ctx;

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
    batch.set(logRef1, createLog(debtRef.id, isToday ? 'Borç Açıldı' : 'Geçmiş İlaç Borcu', `${fmtQty(item.qty)} adet × ${fmtTL(item.unitPrice)} = ${fmtTL(itemTotal)} borç eklendi.`, 'info', customerId, item.drug.id, userId, isToday ? undefined : date, { kind: 'entry', batchId }));

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
        batch.set(logRef2, createLog(debtRef.id, 'Geçmiş Tahsilat', `${fmtTL(actualShare)} tahsilat düşüldü. ${fmtQty(qtyDeducted)} adet düşüldü. Kalan: ${fmtQty(finalQty)} adet (${fmtTL(remainTl)}).`, 'success', customerId, item.drug.id, userId, paidDate, { kind: 'entry', batchId }));

        if (remainTl <= 10) {
          isSwept = true;
          const logRef3 = doc(collection(db, 'transactions'));
          // Bkz. hizmet dalındaki not: süpürücünün tarihi onu tetikleyen tahsilatın tarihidir
          batch.set(logRef3, createLog(debtRef.id, 'Süpürücü (Silindi)', `Kalan tutar 10 TL'nin altında (${fmtTL(remainTl)}) olduğu için borç sıfırlandı.`, 'success', customerId, item.drug.id, userId, paidDate || (isToday ? undefined : date), { kind: 'entry', batchId }));
        }
      }
    }

    if (!isSwept && applyInflation && item.drug.price > item.unitPrice) {
      finalMaxPrice = item.drug.price;
      const oldRemaining = Math.round(finalQty * item.unitPrice * 100) / 100;
      const newRemaining = Math.round(finalQty * item.drug.price * 100) / 100;
      const logRef4 = doc(collection(db, 'transactions'));
      batch.set(logRef4, createLog(debtRef.id, 'Enflasyon Güncellemesi', `Birim fiyat ${fmtTL(item.unitPrice)} → ${fmtTL(item.drug.price)} olarak güncellendi. Kalan borç ${fmtTL(oldRemaining)} → ${fmtTL(newRemaining)}.`, 'warning', customerId, item.drug.id, userId, undefined, { kind: 'entry', batchId }));
    }

    if (!isSwept) {
      batch.set(debtRef, { customerId, drugId: item.drug.id, qty: finalQty, maxPrice: finalMaxPrice, isFixed: false, date, batchId, createdAt, userId });
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
 */
export const revertPaymentOperations = async (customer, paymentLogs, reason, userId) => {
  const trimmedReason = (reason || '').trim();
  const logs = (paymentLogs || []).filter(l => l?.debtId && l.before);
  const balanceDelta = (paymentLogs || []).find(l => l?.balanceDelta != null)?.balanceDelta ?? 0;

  if (!customer?.id || !trimmedReason || (logs.length === 0 && balanceDelta === 0)) return false;

  const batch = writeBatch(db);
  const revertBatchId = doc(collection(db, 'transactions')).id;
  const revertOf = (paymentLogs || []).find(l => l?.batchId)?.batchId;

  logs.forEach((log) => {
    const isService = log.before.desc !== undefined;
    const ref = doc(db, isService ? 'serviceDebts' : 'drugDebts', log.debtId);
    batch.set(ref, log.before);

    const restored = isService
      ? fmtTL(log.before.amount)
      : `${fmtQty(log.before.qty)} adet (${fmtTL(Math.round(log.before.qty * log.before.maxPrice * 100) / 100)})`;

    const logRef = doc(collection(db, 'transactions'));
    batch.set(logRef, createLog(
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
    ));
  });

  if (balanceDelta !== 0) {
    const logRef = doc(collection(db, 'transactions'));
    batch.set(logRef, createLog(
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
    ));
  }

  batch.update(doc(db, 'customers', customer.id), {
    balance: Math.round((customer.balance - balanceDelta) * 100) / 100
  });

  await batch.commit();
  return true;
};

/** Borç dokümanının geri yükleme için saklanacak anlık görüntüsü (`id` doküman yolunda taşınır). */
const snapshotOf = (debt) => {
  const copy = { ...debt };
  delete copy.id;
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
      else batch.update(doc(db, 'serviceDebts', item.id), { amount: newAmount });

      const logRef1 = doc(collection(db, 'transactions'));
      batch.set(logRef1, createLog(item.id, 'Tahsilat',
        `${fmtTL(item.deduct)} ödendi. Kalan borç: ${fmtTL(newAmount)}.`,
        'success', customer.id, undefined, userId, undefined,
        { ...meta, deduct: item.deduct, removed, before }));

      if (removed && newAmount > 0) {
        const logRef2 = doc(collection(db, 'transactions'));
        batch.set(logRef2, createLog(item.id, 'Süpürücü (Kapatıldı)',
          `Kalan mikro küsurat 10 TL altında olduğu için silindi.`,
          'success', customer.id, undefined, userId, undefined, meta));
      }
    } else {
      const qtyToDeduct = Math.round((item.deduct / debt.maxPrice) * 100) / 100;
      const newQty = Math.round((debt.qty - qtyToDeduct) * 100) / 100;
      const remainingTl = Math.round(newQty * debt.maxPrice * 100) / 100;
      const removed = remainingTl <= 10;

      const logRef1 = doc(collection(db, 'transactions'));
      batch.set(logRef1, createLog(item.id, 'Tahsilat', `${fmtTL(item.deduct)} ödendi. ${fmtQty(qtyToDeduct)} adet borçtan düşüldü. Kalan yeni borç: ${fmtQty(newQty)} adet (${fmtTL(remainingTl)}).`, 'success', customer.id, debt.drugId, userId, undefined,
        { ...meta, deduct: item.deduct, qtyDeducted: qtyToDeduct, removed, before }));

      if (removed) {
        if (remainingTl > 0) {
          const logRef2 = doc(collection(db, 'transactions'));
          batch.set(logRef2, createLog(item.id, 'Süpürücü (Kapatıldı)', `Kalan mikro küsurat 10 TL altında olduğu için silindi.`, 'success', customer.id, debt.drugId, userId, undefined, meta));
        }
        batch.delete(doc(db, 'drugDebts', item.id));
      } else {
        batch.update(doc(db, 'drugDebts', item.id), { qty: newQty });
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
      'success', customer.id, undefined, userId, undefined, meta));
  }

  batch.update(doc(db, 'customers', customer.id), {
    balance: Math.round((customer.balance + balanceDelta) * 100) / 100
  });

  await batch.commit();
};

