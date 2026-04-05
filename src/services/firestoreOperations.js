import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  getDocs,
  getDoc,
  query,
  where
} from 'firebase/firestore';
import { db } from './firebase';
import { fmtTL, fmtQty } from '../utils/formatters';

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

// Yardımcı: Log objesi oluşturucu
const createLog = (debtId, title, message, type = 'neutral', customerId, drugId, userId, dateOverride) => {
  const o = {
    debtId,
    date: dateOverride || new Date().toISOString().split('T')[0],
    timestamp: Date.now(),
    title,
    message,
    type
  };
  if (customerId != null && customerId !== '') o.customerId = customerId;
  if (drugId != null && drugId !== '') o.drugId = drugId;
  if (userId != null && userId !== '') o.userId = userId;
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

export const updateDrugPrice = async (drugId, newPrice, currentDrugDebts, userId) => {
  if (newPrice <= 0) return;
  const batch = writeBatch(db);

  batch.update(doc(db, 'drugs', drugId), { price: newPrice });

  currentDrugDebts.forEach(debt => {
    if (debt.drugId === drugId && !debt.isFixed && newPrice > debt.maxPrice) {
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
        userId
      ));
    }
  });

  await batch.commit();
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
    userId
  ));

  await batch.commit();
};

export const returnDrug = async (debt, returnQty, customerBalance, userId) => {
  if (returnQty <= 0) return;
  const batch = writeBatch(db);

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
    batch.set(logRef1, createLog(debt.id, 'İade İşlemi', `${fmtQty(returnQty)} adet iade edildi. Kalan yeni borç: ${fmtQty(finalQty)} adet (${fmtTL(remainingTl)}).`, 'info', debt.customerId, debt.drugId, userId));

    if (isSwept) {
      const logRef2 = doc(collection(db, 'transactions'));
      batch.set(logRef2, createLog(debt.id, 'Süpürücü (Silindi)', `Kalan tutar 10 TL'nin altında (${fmtTL(remainingTl)}) olduğu için sistem borcu sıfırladı.`, 'success', debt.customerId, debt.drugId, userId));
    }

  } else {
    const excessQty = returnQty - debt.qty;
    const refundTl = Math.round(excessQty * debt.maxPrice * 100) / 100;

    batch.delete(doc(db, 'drugDebts', debt.id));
    batch.update(doc(db, 'customers', debt.customerId), { balance: customerBalance + refundTl });

    const logRef = doc(collection(db, 'transactions'));
    batch.set(logRef, createLog(debt.id, 'Fazla İade (Avans)', `Tüm borç kapatıldı. Artan ${fmtQty(excessQty)} adet karşılığı ${fmtTL(refundTl)} avans yazıldı.`, 'success', debt.customerId, debt.drugId, userId));
  }

  await batch.commit();
};

export const addServiceDebtOperations = async (customerId, desc, amount, userId) => {
  if (amount <= 0) return;
  const trimmed = desc.trim();
  if (!trimmed) return;
  const batch = writeBatch(db);
  const debtRef = doc(collection(db, 'serviceDebts'));
  const dateStr = new Date().toISOString().split('T')[0];
  batch.set(debtRef, {
    customerId,
    desc: trimmed,
    amount,
    date: dateStr,
    userId
  });
  const logRef = doc(collection(db, 'transactions'));
  batch.set(
    logRef,
    createLog(debtRef.id, 'Hizmet Borcu', `${trimmed} — ${fmtTL(amount)} tutarında hizmet borcu eklendi.`, 'info', customerId, undefined, userId)
  );
  await batch.commit();
};

export const deleteServiceDebtOperations = async (debtId) => {
  const debtRef = doc(db, 'serviceDebts', debtId);
  const snap = await getDoc(debtRef);
  const batch = writeBatch(db);
  if (snap.exists()) {
    const d = snap.data();
    const logRef = doc(collection(db, 'transactions'));
    const cid = d.customerId;
    batch.set(
      logRef,
      createLog(
        debtId,
        'Hizmet Borcu İptali',
        `${d.desc || 'Hizmet'} — ${fmtTL(Number(d.amount) || 0)} borç kaydı silindi.`,
        'warning',
        cid,
        undefined,
        d.userId
      )
    );
  }
  batch.delete(debtRef);
  await batch.commit();
};

export const addDrugDebtOperations = async (customerId, drug, qty, userId) => {
  if (qty <= 0) return;
  const batch = writeBatch(db);
  const debtRef = doc(collection(db, 'drugDebts'));

  batch.set(debtRef, {
    customerId,
    drugId: drug.id,
    qty,
    maxPrice: drug.price,
    isFixed: false,
    date: new Date().toISOString().split('T')[0],
    userId
  });

  const logRef = doc(collection(db, 'transactions'));
  batch.set(logRef, createLog(debtRef.id, 'Borç Açıldı', `${fmtQty(qty)} Adet eklendi. (Birim fiyat: ${fmtTL(drug.price)}. Toplam Borç: ${fmtTL(qty * drug.price)})`, 'info', customerId, drug.id, userId));

  await batch.commit();
};

export const applyPaymentOperations = async (customer, receivedAmount, distributionArr, currentServiceDebts, currentDrugDebts, userId) => {
  if (receivedAmount < 0) return;
  const batch = writeBatch(db);
  let currentBalance = customer.balance + receivedAmount;

  distributionArr.forEach(item => {
    if (item.deduct <= 0) return;
    currentBalance -= item.deduct;

    if (item.type === 'service') {
      const debt = currentServiceDebts.find(d => d.id === item.id);
      if (debt) {
        const newAmount = Math.round((debt.amount - item.deduct) * 100) / 100;
        if (newAmount <= 10) {
          batch.delete(doc(db, 'serviceDebts', item.id));
        } else {
          batch.update(doc(db, 'serviceDebts', item.id), { amount: newAmount });
        }
      }
    } else if (item.type === 'drug') {
      const debt = currentDrugDebts.find(d => d.id === item.id);
      if (debt) {
        const qtyToDeduct = Math.round((item.deduct / debt.maxPrice) * 100) / 100;
        const newQty = Math.round((debt.qty - qtyToDeduct) * 100) / 100;
        const remainingTl = Math.round(newQty * debt.maxPrice * 100) / 100;

        const logRef1 = doc(collection(db, 'transactions'));
        batch.set(logRef1, createLog(item.id, 'Tahsilat', `${fmtTL(item.deduct)} ödendi. ${fmtQty(qtyToDeduct)} adet borçtan düşüldü. Kalan yeni borç: ${fmtQty(newQty)} adet (${fmtTL(remainingTl)}).`, 'success', customer.id, debt.drugId, userId));

        if (remainingTl <= 10) {
          if (remainingTl > 0) {
            const logRef2 = doc(collection(db, 'transactions'));
            batch.set(logRef2, createLog(item.id, 'Süpürücü (Kapatıldı)', `Kalan mikro küsurat 10 TL altında olduğu için silindi.`, 'success', customer.id, debt.drugId, userId));
          }
          batch.delete(doc(db, 'drugDebts', item.id));
        } else {
          batch.update(doc(db, 'drugDebts', item.id), { qty: newQty });
        }
      }
    }
  });

  currentBalance = Math.round(currentBalance * 100) / 100;
  batch.update(doc(db, 'customers', customer.id), { balance: currentBalance });

  await batch.commit();
};

export const addPastServiceDebtOperations = async (customerId, desc, amount, date, paidAmount, paidDate, userId) => {
  if (amount <= 0) return;
  if (paidAmount >= amount) return;
  const trimmed = desc.trim();
  if (!trimmed) return;

  const batch = writeBatch(db);
  const debtRef = doc(collection(db, 'serviceDebts'));
  let finalAmount = amount;
  let isSwept = false;

  const logRef1 = doc(collection(db, 'transactions'));
  batch.set(logRef1, createLog(debtRef.id, 'Geçmiş Hizmet Borcu', `${trimmed} — ${fmtTL(amount)} tutarında hizmet borcu eklendi.`, 'info', customerId, undefined, userId, date));

  if (paidAmount > 0) {
    finalAmount = Math.round((amount - paidAmount) * 100) / 100;
    if (finalAmount < 0) finalAmount = 0;
    const logRef2 = doc(collection(db, 'transactions'));
    batch.set(logRef2, createLog(debtRef.id, 'Geçmiş Tahsilat', `${fmtTL(paidAmount)} tahsilat düşüldü. Kalan borç: ${fmtTL(finalAmount)}.`, 'success', customerId, undefined, userId, paidDate));

    if (finalAmount <= 10) {
      isSwept = true;
      const logRef3 = doc(collection(db, 'transactions'));
      batch.set(logRef3, createLog(debtRef.id, 'Süpürücü (Silindi)', `Kalan tutar 10 TL'nin altında (${fmtTL(finalAmount)}) olduğu için borç sıfırlandı.`, 'success', customerId, undefined, userId));
    }
  }

  if (!isSwept) {
    batch.set(debtRef, { customerId, desc: trimmed, amount: finalAmount, date, userId });
  }

  await batch.commit();
};

export const addPastDrugDebtOperations = async (customerId, drug, qty, unitPrice, date, paidAmount, paidDate, applyInflation, userId) => {
  if (qty <= 0 || unitPrice <= 0) return;
  const totalDebt = Math.round(qty * unitPrice * 100) / 100;
  if (paidAmount >= totalDebt) return;

  const batch = writeBatch(db);
  const debtRef = doc(collection(db, 'drugDebts'));
  let finalQty = qty;
  let finalMaxPrice = unitPrice;
  let isSwept = false;

  const logRef1 = doc(collection(db, 'transactions'));
  batch.set(logRef1, createLog(debtRef.id, 'Geçmiş İlaç Borcu', `${fmtQty(qty)} adet × ${fmtTL(unitPrice)} = ${fmtTL(totalDebt)} borç eklendi.`, 'info', customerId, drug.id, userId, date));

  if (paidAmount > 0) {
    const qtyToDeduct = Math.round((paidAmount / unitPrice) * 100) / 100;
    finalQty = Math.round((qty - qtyToDeduct) * 100) / 100;
    if (finalQty < 0) finalQty = 0;
    const remainingTl = Math.round(finalQty * unitPrice * 100) / 100;

    const logRef2 = doc(collection(db, 'transactions'));
    batch.set(logRef2, createLog(debtRef.id, 'Geçmiş Tahsilat', `${fmtTL(paidAmount)} tahsilat düşüldü. ${fmtQty(qtyToDeduct)} adet düşüldü. Kalan: ${fmtQty(finalQty)} adet (${fmtTL(remainingTl)}).`, 'success', customerId, drug.id, userId, paidDate));

    if (remainingTl <= 10) {
      isSwept = true;
      const logRef3 = doc(collection(db, 'transactions'));
      batch.set(logRef3, createLog(debtRef.id, 'Süpürücü (Silindi)', `Kalan tutar 10 TL'nin altında (${fmtTL(remainingTl)}) olduğu için borç sıfırlandı.`, 'success', customerId, drug.id, userId));
    }
  }

  if (!isSwept && applyInflation && drug.price > unitPrice) {
    finalMaxPrice = drug.price;
    const oldRemaining = Math.round(finalQty * unitPrice * 100) / 100;
    const newRemaining = Math.round(finalQty * drug.price * 100) / 100;
    const logRef4 = doc(collection(db, 'transactions'));
    batch.set(logRef4, createLog(debtRef.id, 'Enflasyon Güncellemesi', `Birim fiyat ${fmtTL(unitPrice)} → ${fmtTL(drug.price)} olarak güncellendi. Kalan borç ${fmtTL(oldRemaining)} → ${fmtTL(newRemaining)}.`, 'warning', customerId, drug.id, userId));
  }

  if (!isSwept) {
    batch.set(debtRef, { customerId, drugId: drug.id, qty: finalQty, maxPrice: finalMaxPrice, isFixed: false, date, userId });
  }

  await batch.commit();
};
