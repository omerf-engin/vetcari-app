// --- FIYAT GUNCELLEMESI: ETKI HESABI VE GERI ALMA GUARD'I ---
//
// Bir ilacin fiyati yukseldiginde o ilaca ait tum acik ve sabitlenmemis borclarin `maxPrice`'i
// guncellenir. Dususler yansimaz (is kurali) — bu yuzden yazim hatasi kalicidir.
//
// Onizleme ile gercek yazim ayni kosulu kullanmak zorunda; aksi halde kullaniciya gosterilen
// etki yalan olur. `selectAffectedDebts` bu yuzden hem `computePriceImpact` hem
// `updateDrugPrice` tarafindan kullanilir — kosul tek yerde durur.

const round2 = (val) => Math.round(val * 100) / 100;

/**
 * Fiyat degisiminden **gercekten etkilenecek** borclar.
 * `updateDrugPrice` de guncellenecek borclari buradan secer.
 */
export const selectAffectedDebts = (drugId, newPrice, drugDebts) =>
  (drugDebts || []).filter(d => d.drugId === drugId && !d.isFixed && newPrice > d.maxPrice);

/**
 * Fiyat degisikliginin acik borclara etkisini hesaplar (saf, yazma yok).
 *
 * @param {{id: string, price: number}} drug — ilacin mevcut hali; `direction` bununla belirlenir
 * @returns {{direction: 'increase'|'decrease'|'same', affected: Array, unchanged: Array,
 *            debtCount: number, customerCount: number, totalDelta: number}}
 *          `affected`: `maxPrice`'i yukselecek borclar.
 *          `unchanged`: dokunulmayacak acik borclar — dususte eski (yuksek) fiyatta kalanlar ve
 *          her iki yonde sabitlenmis (`isFixed`) olanlar.
 */
export const computePriceImpact = (drug, newPrice, drugDebts, customers) => {
  const drugId = drug?.id;
  const price = Number(newPrice);
  const all = (drugDebts || []).filter(d => d.drugId === drugId);
  const nameById = new Map((customers || []).map(c => [c.id, c.name]));
  const nameOf = (d) => nameById.get(d.customerId) || 'Bilinmeyen Müşteri';

  const affectedDebts = selectAffectedDebts(drugId, price, all);
  const affectedIds = new Set(affectedDebts.map(d => d.id));

  const affected = affectedDebts.map(debt => {
    const oldTl = round2(debt.qty * debt.maxPrice);
    const newTl = round2(debt.qty * price);
    return { debt, customerName: nameOf(debt), oldTl, newTl, delta: round2(newTl - oldTl) };
  });

  const unchanged = all
    .filter(d => !affectedIds.has(d.id))
    .map(debt => ({ debt, customerName: nameOf(debt), currentTl: round2(debt.qty * debt.maxPrice) }));

  const customerCount = new Set(affected.map(a => a.debt.customerId)).size;
  const totalDelta = round2(affected.reduce((sum, a) => sum + a.delta, 0));

  const current = Number(drug?.price) || 0;

  return {
    direction: price > current ? 'increase' : price < current ? 'decrease' : 'same',
    affected,
    unchanged,
    debtCount: affected.length,
    customerCount,
    totalDelta
  };
};

/** Onay penceresi acilmali mi? Hicbir acik borc yoksa kullaniciyi bosuna durdurmayiz. */
export const needsPriceConfirm = (impact) =>
  impact.affected.length > 0 || impact.unchanged.length > 0;

// --- GERI ALMA ---

/** Iptali/geri almayi engellemeyen log turleri. */
const NON_BLOCKING_KINDS = new Set(['lock']);

/**
 * Bir ilaca ait **en son** zam grubunu bulur. Yalnizca yapisal veri tasiyan (TASK-032 sonrasi
 * yazilmis) loglar aday olur; eski zamlarda `maxPriceBefore` yoktur, geri alinamazlar.
 */
export const latestPriceBatch = (drugId, transactions) => {
  const logs = (transactions || []).filter(
    t => t.kind === 'price' && t.drugId === drugId && t.batchId && t.maxPriceBefore != null
  );
  if (logs.length === 0) return null;

  const byBatch = new Map();
  for (const log of logs) {
    const group = byBatch.get(log.batchId) || { batchId: log.batchId, logs: [], timestamp: 0 };
    group.logs.push(log);
    group.timestamp = Math.max(group.timestamp, log.timestamp ?? 0);
    byBatch.set(log.batchId, group);
  }

  return [...byBatch.values()].sort((a, b) => b.timestamp - a.timestamp)[0];
};

/**
 * Son zammin geri alinip alinamayacagi.
 *
 * @returns {{ok: boolean, batch?: object, reason?: 'legacy'|'not-latest'|'missing'|'activity'}}
 */
export const canRevertPriceUpdate = (drugId, transactions, drugDebts) => {
  const batch = latestPriceBatch(drugId, transactions);
  if (!batch) return { ok: false, reason: 'legacy' };

  const logs = transactions || [];

  // Bu gruptan sonra ayni ilaca baska bir fiyat islemi (zam veya geri alma) yapilmissa,
  // geri alma artik guncel durumu temsil etmez
  const newerPriceLog = logs.some(
    t => t.kind === 'price' && t.drugId === drugId && t.batchId !== batch.batchId
      && (t.timestamp ?? 0) > batch.timestamp
  );
  if (newerPriceLog) return { ok: false, reason: 'not-latest' };

  const debtById = new Map((drugDebts || []).map(d => [d.id, d]));
  if (batch.logs.some(log => !debtById.has(log.debtId))) return { ok: false, reason: 'missing' };

  // Fail-closed: zamdan sonra o borclara inen taninmayan bir log da engeller
  const debtIds = new Set(batch.logs.map(log => log.debtId));
  const touched = logs.some(
    t => debtIds.has(t.debtId) && t.batchId !== batch.batchId
      && (t.timestamp ?? 0) > batch.timestamp && !NON_BLOCKING_KINDS.has(t.kind)
  );
  if (touched) return { ok: false, reason: 'activity' };

  return { ok: true, batch };
};

/**
 * Geri alma onizlemesi: `canRevertPriceUpdate`'in dondugu grubun borclari hangi tutara donecek?
 * `computePriceImpact` ile ayni sekli uretir, boylece modal tek bir veri yapisiyla calisir.
 * `oldTl` donulecek (zam oncesi) tutar, `newTl` su anki tutardir.
 */
export const computeRevertImpact = (batch, drugDebts, customers) => {
  const nameById = new Map((customers || []).map(c => [c.id, c.name]));
  const debtById = new Map((drugDebts || []).map(d => [d.id, d]));

  const affected = (batch?.logs || []).reduce((acc, log) => {
    const debt = debtById.get(log.debtId);
    if (!debt) return acc;
    const oldTl = round2(debt.qty * log.maxPriceBefore);
    const newTl = round2(debt.qty * (log.maxPriceAfter ?? debt.maxPrice));
    acc.push({
      debt,
      customerName: nameById.get(debt.customerId) || 'Bilinmeyen Müşteri',
      oldTl,
      newTl,
      delta: round2(newTl - oldTl)
    });
    return acc;
  }, []);

  return {
    direction: 'revert',
    affected,
    unchanged: [],
    debtCount: affected.length,
    customerCount: new Set(affected.map(a => a.debt.customerId)).size,
    totalDelta: round2(affected.reduce((sum, a) => sum + a.delta, 0))
  };
};

/** Geri almanin neden yapilamadigini kullaniciya gosterilecek metne cevirir. */
export const revertBlockedMessage = (reason) => {
  switch (reason) {
    case 'not-latest':
      return 'Bu ilaçta daha yeni bir fiyat işlemi var; yalnızca son zam geri alınabilir.';
    case 'missing':
      return 'Zamdan etkilenen borçlardan biri kapanmış; geri alınamıyor.';
    case 'activity':
      return 'Zamdan sonra bu borçlara tahsilat veya iade işlenmiş. Önce o işlemi geri alın.';
    case 'legacy':
      return 'Bu zam eski kayıt — geri alma için gereken fiyat bilgisi tutulmamış.';
    case 'stale':
      // Surum kontrolu (TASK-033): yazim anindan once baska bir cihaz borca dokunmus
      return 'Kayıt siz bakarken değişti. Ekranı kontrol edip tekrar deneyin.';
    default:
      return 'Bu zam geri alınamıyor.';
  }
};
