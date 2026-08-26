// --- TAHSILAT GERI ALMA GUARD'I ---
//
// `utils/priceImpact.js` ile ayni desen: yapisal veri tasiyan en son islem grubu bulunur,
// uzerine aktivite gelmisse engellenir. Karar log basligina degil `kind` alanina bakar ve
// **fail-closed**'dur — taninmayan bir log da geri almayi engeller.

const round2 = (val) => Math.round(val * 100) / 100;

/** Geri almayi engellemeyen log turleri: kilit degisimi zararsiz ve geri donusludur. */
const NON_BLOCKING_KINDS = new Set(['lock']);

/**
 * Bir musteriye ait **en son** tahsilat grubunu bulur.
 *
 * Yalnizca yapisal veri tasiyan (TASK-034 sonrasi yazilmis) loglar aday olur; eski
 * tahsilatlarda `before` / `balanceDelta` yoktur, geri alinamazlar. Geri alma loglari
 * bilincli olarak `balanceDelta` tasimadigi icin burada aday sayilmaz — "geri almanin geri
 * alinmasi" zinciri boylece acilmaz.
 */
export const latestPaymentBatch = (customerId, transactions) => {
  const logs = (transactions || []).filter(
    t => t.kind === 'payment' && t.customerId === customerId && t.batchId && t.balanceDelta != null
  );
  if (logs.length === 0) return null;

  const byBatch = new Map();
  for (const log of logs) {
    const group = byBatch.get(log.batchId) || { batchId: log.batchId, logs: [], timestamp: 0 };
    group.logs.push(log);
    group.timestamp = Math.max(group.timestamp, log.timestamp ?? 0);
    byBatch.set(log.batchId, group);
  }

  const batch = [...byBatch.values()].sort((a, b) => b.timestamp - a.timestamp)[0];
  batch.balanceDelta = batch.logs.find(l => l.balanceDelta != null)?.balanceDelta ?? 0;
  // Yalnizca borca dokunan loglar geri yuklenir; avans logunun `before`'i yoktur
  batch.debtLogs = batch.logs.filter(l => l.before);
  batch.totalDeducted = round2(batch.debtLogs.reduce((sum, l) => sum + (l.deduct || 0), 0));
  return batch;
};

/**
 * Son tahsilatin geri alinip alinamayacagi.
 *
 * @returns {{ok: boolean, batch?: object, reason?: 'legacy' | 'not-latest' | 'activity'}}
 */
export const canRevertPayment = (customerId, transactions) => {
  if (!customerId) return { ok: false, reason: 'legacy' };

  const batch = latestPaymentBatch(customerId, transactions);
  if (!batch) return { ok: false, reason: 'legacy' };

  const logs = transactions || [];

  // Bu gruptan sonra ayni musteriye baska bir tahsilat islemi (tahsilat veya geri alma)
  // yapilmissa, geri alma artik guncel durumu temsil etmez
  const newerPaymentLog = logs.some(
    t => t.kind === 'payment' && t.customerId === customerId && t.batchId !== batch.batchId
      && (t.timestamp ?? 0) > batch.timestamp
  );
  if (newerPaymentLog) return { ok: false, reason: 'not-latest' };

  // Fail-closed: tahsilattan sonra o borclara inen taninmayan bir log da engeller
  const debtIds = new Set(batch.debtLogs.map(l => l.debtId));
  const touched = logs.some(
    t => debtIds.has(t.debtId) && t.batchId !== batch.batchId
      && (t.timestamp ?? 0) > batch.timestamp && !NON_BLOCKING_KINDS.has(t.kind)
  );
  if (touched) return { ok: false, reason: 'activity' };

  return { ok: true, batch };
};

/** Geri almanin neden yapilamadigini kullaniciya gosterilecek metne cevirir. */
export const revertPaymentBlockedMessage = (reason) => {
  switch (reason) {
    case 'not-latest':
      return 'Bu müşteride daha yeni bir tahsilat işlemi var; yalnızca son tahsilat geri alınabilir.';
    case 'activity':
      return 'Tahsilattan sonra bu borçlara başka bir işlem uygulanmış. Önce onu geri alın.';
    case 'legacy':
      return 'Bu tahsilat eski kayıt — geri alma için gereken borç bilgisi tutulmamış.';
    default:
      return 'Bu tahsilat geri alınamıyor.';
  }
};
