// --- ISLEM IPTALI GUARD ---
//
// Bir islemin "hatali giris" olarak iptal edilip edilemeyecegini belirler.
// Olcut: islem yazildiktan SONRA uzerine aktivite gelmis mi?
//
// Ayni `batchId`'yi tasiyan loglar girisin parcasidir — gecmis borcun icine gomulu
// `Gecmis Tahsilat`, `Supurucu` ve `Enflasyon Guncellemesi` loglari dahil. Bunlar iptali
// engellemez; sonradan gelen gercek tahsilat, iade veya zam engeller.
//
// Karar log basligina degil, `kind` alanina bakar (bkz. `createLog`): basliklar
// `HistoryModal`'daki `getLogSortPriority` tarafindan zaten metin olarak esleniyor ve
// oraya ikinci bir bagimlilik eklemek kirilganligi artirirdi.

/** Iptali engellemeyen log turleri: kilit degisimi zararsiz ve geri donusludur. */
const NON_BLOCKING_KINDS = new Set(['lock', 'cancel']);

/**
 * Bir logun "sonradan gelen aktivite" sayilip sayilmayacagi.
 *
 * Tamamen geri alinmis bir islem borcu eski haline dondurur; o islem artik borca dokunmuyor
 * sayilir ve girisin iptali yeniden acilir. `revertOf` alani hangi grubun etkisiz kaldigini
 * soyler (TASK-035 sonrasi yazilan geri alma loglari tasir); geri alma logunun kendisi de
 * engellemez.
 */
const isNeutralized = (log, neutralizedBatchIds) =>
  Boolean(log.revertOf) || (log.batchId && neutralizedBatchIds.has(log.batchId));

/** Geri alinmis (etkisiz kalmis) islem gruplarinin kimlikleri. */
const neutralizedBatches = (logs) => {
  const set = new Set();
  for (const log of logs) if (log.revertOf) set.add(log.revertOf);
  return set;
};

/**
 * @param {object} group — `groupDebtsByBatch` ciktisindaki bir grup
 * @param {Array<object>} transactions — musteriye ait ekstre loglari
 * @returns {{ok: boolean, reason?: 'empty' | 'legacy' | 'activity'}}
 *          `legacy`: batchId tasimayan eski kayit — iptal kapali, sil/iade kullanilir
 *          `activity`: uzerine tahsilat/iade/zam inmis — once o islem geri alinmali
 */
export const canCancelBatch = (group, transactions) => {
  const items = group?.items || [];
  if (items.length === 0) return { ok: false, reason: 'empty' };

  // Eski kayitlarda grup anahtari sentetiktir (`legacy:...` / `service:...`); gercek batchId yok
  const batchId = group.batchId;
  if (!batchId || !items.every(i => i.batchId === batchId)) return { ok: false, reason: 'legacy' };

  const logs = transactions || [];

  // batchId loglara TASK-031 ile eklendi; oncesinde yazilmis islemlerde giris loglari
  // ayirt edilemez, bu yuzden iptal kapali kalir.
  // `kind === 'entry'` sarti onemli: tahsilat gibi diger islemler de artik `batchId` tasiyor,
  // bir odeme grubu iptal edilebilir bir giris grubu sanilmamali.
  const hasEntryLogs = logs.some(t => t.batchId === batchId && t.kind === 'entry');
  if (!hasEntryLogs) return { ok: false, reason: 'legacy' };

  // Fail-closed: kind'i taninmayan (veya hic olmayan) bir log da engeller
  const itemIds = new Set(items.map(i => i.id));
  const neutralized = neutralizedBatches(logs);
  const blocked = logs.some(t =>
    itemIds.has(t.debtId) && t.batchId !== batchId
      && !NON_BLOCKING_KINDS.has(t.kind) && !isNeutralized(t, neutralized)
  );

  return blocked ? { ok: false, reason: 'activity' } : { ok: true };
};

/**
 * Borc dokumani kalmamis bir islemin iptal edilip edilemeyecegi.
 *
 * Kismi tahsilat kalani 10 TL altina dusurduyse supurucu devreye girer ve borc dokumani
 * **hic yazilmaz** — geriye yalnizca loglar kalir, `CustomerDetail`'de kart olusmaz. Bu tur
 * kayitlar bugune kadar hicbir yerden temizlenemiyordu.
 *
 * Yalnizca **girisin kendi loglariyla** kapanmis islemler hatali giris sayilir; tahsilat veya
 * iade ile kapanmis (yani gercekten odenmis) bir islem iptal edilemez.
 */
export const canCancelOrphanBatch = (batchId, transactions) => {
  if (!batchId) return { ok: false, reason: 'empty' };

  const logs = transactions || [];
  // Yalnizca giris loglari: odeme/iade gruplari da `batchId` tasidigi icin tur kontrolu sart
  const entryLogs = logs.filter(t => t.batchId === batchId && t.kind === 'entry');
  if (entryLogs.length === 0) return { ok: false, reason: 'legacy' };
  if (logs.some(t => t.batchId === batchId && t.kind === 'cancel')) return { ok: false, reason: 'cancelled' };

  const debtIds = new Set(entryLogs.map(t => t.debtId));
  const neutralized = neutralizedBatches(logs);
  const blocked = logs.some(t =>
    debtIds.has(t.debtId) && t.batchId !== batchId
      && !NON_BLOCKING_KINDS.has(t.kind) && !isNeutralized(t, neutralized)
  );

  return blocked ? { ok: false, reason: 'activity' } : { ok: true };
};

/** Iptal butonunun pasif olma sebebini kullaniciya gosterilecek metne cevirir. */
export const cancelBlockedMessage = (reason) => {
  switch (reason) {
    case 'activity':
      return 'Bu işleme sonradan tahsilat, iade veya zam işlenmiş. Önce o işlemi geri alın.';
    case 'legacy':
      return 'Eski kayıt — iptal edilemiyor. Hizmet borcunu Sil, ilaç borcunu İade ile kapatın.';
    default:
      return 'Bu işlem iptal edilemiyor.';
  }
};

/**
 * Ekstrede iptal edilmis islemleri isaretlemek icin: iptal logu bulunan `batchId` kumesi.
 * Iptal durumu ayri bir alanda saklanmaz, loglardan turetilir — eski loglara yazma gerekmez.
 */
export const cancelledBatchIds = (transactions) => {
  const set = new Set();
  for (const t of transactions || []) {
    if (t.kind === 'cancel' && t.batchId) set.add(t.batchId);
  }
  return set;
};

/**
 * Tek tek iptal edilmis borclarin kimlikleri.
 *
 * Kalem iptali (`cancelDebtItemOperations`) bilincli olarak `batchId` yazmaz — ayni islemdeki
 * diger kalemler etkilenmemeli. Bu yuzden iptal isareti `batchId` yaninda `debtId` uzerinden
 * de turetilir.
 */
export const cancelledDebtIds = (transactions) => {
  const set = new Set();
  for (const t of transactions || []) {
    if (t.kind === 'cancel' && !t.batchId && t.debtId) set.add(t.debtId);
  }
  return set;
};
