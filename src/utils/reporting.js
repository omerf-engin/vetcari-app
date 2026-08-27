// --- DONEMSEL FINANSAL RAPORLAMA ---
//
// Ekstre loglarindan bir tarih araligi icin para hareketi toplamlari cikarir.
//
// Karar log basligina degil `flow` alanina bakar (bkz. `createLog`): `kind` tek basina
// yetmez, cunku `kind: 'entry'` bes ayri olayi kapsar (borc acilisi, gomulu tahsilat,
// supurucu, enflasyon). `amount` her zaman pozitif buyuklüktur, yonu `flow` belirler.
//
// `flow` tasimayan loglar **hicbir toplama katilmaz**, `unmeasured` olarak sayilir ve
// kullaniciya bildirilir — fail-closed. Bu alanlar TASK-020 ile eklendi; oncesinde
// yazilmis kayitlarda tutar yalnizca `message` metninde durur ve `fmtTL` en fazla 1
// ondalik yazdigi icin oradan geri okumak kayiplidir.

import { cancelledBatchIds, neutralizedBatchIds } from './batchCancel';
import { toLocalDateStr, todayLocal } from './dates';

const round2 = (val) => Math.round(val * 100) / 100;

/** `YYYY-MM-DD` -> yerel gece yarisi `Date` (UTC kaymasi olmadan). */
const parseLocal = (dateStr) => {
  const [y, m, d] = String(dateStr).split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const PERIOD_PRESETS = [
  { id: 'thisMonth', label: 'Bu Ay' },
  { id: 'lastMonth', label: 'Geçen Ay' },
  { id: 'last30', label: 'Son 30 Gün' },
  { id: 'custom', label: 'Özel Aralık' }
];

/**
 * Preset kimligini somut `{start, end}` araligina cevirir (her ikisi de dahil).
 *
 * @param {string} preset — `PERIOD_PRESETS` icindeki bir `id`
 * @param {string} [customStart] — yalnizca `custom` icin
 * @param {string} [customEnd] — yalnizca `custom` icin
 * @param {string} [today] — testler icin enjekte edilebilir; varsayilan `todayLocal()`
 */
export const resolvePeriod = (preset, customStart, customEnd, today = todayLocal()) => {
  const ref = parseLocal(today);

  switch (preset) {
    case 'lastMonth': {
      const first = new Date(ref.getFullYear(), ref.getMonth() - 1, 1);
      const last = new Date(ref.getFullYear(), ref.getMonth(), 0);
      return { start: toLocalDateStr(first), end: toLocalDateStr(last) };
    }
    case 'last30': {
      const first = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - 29);
      return { start: toLocalDateStr(first), end: today };
    }
    case 'custom':
      return { start: customStart || '', end: customEnd || '' };
    case 'thisMonth':
    default:
      return { start: toLocalDateStr(new Date(ref.getFullYear(), ref.getMonth(), 1)), end: today };
  }
};

/**
 * @returns {{ok: boolean, reason?: 'incomplete' | 'order'}}
 *          `incomplete`: iki tarihten biri girilmemis
 *          `order`: baslangic bitisten sonra
 */
export const validatePeriod = (period) => {
  const { start, end } = period || {};
  if (!start || !end) return { ok: false, reason: 'incomplete' };
  if (start > end) return { ok: false, reason: 'order' };
  return { ok: true };
};

/** Gecersiz araligin sebebini kullaniciya gosterilecek metne cevirir. */
export const periodBlockedMessage = (reason) => {
  switch (reason) {
    case 'incomplete':
      return 'Başlangıç ve bitiş tarihlerinin ikisini de girin.';
    case 'order':
      return 'Başlangıç tarihi bitiş tarihinden sonra olamaz.';
    default:
      return 'Bu tarih aralığı kullanılamıyor.';
  }
};

const emptySummary = () => ({
  collected: 0,
  debtOpened: 0,
  inflation: 0,
  priceUp: 0,
  writeoff: 0,
  returned: 0,
  cancelled: 0,
  advanceIn: 0,
  advanceUsed: 0,
  receivableChange: 0,
  unmeasured: 0,
  movementCount: 0
});

/**
 * Bir tarih araligindaki para hareketlerini toplar.
 *
 * **Tarih alani `date`, `timestamp` degil**: `date` logun anlattigi olayin tarihidir, yani
 * gecmis tarihli bir borc girisi gercekten ait oldugu doneme duser. `timestamp` kaydin
 * girildigi ani tutar ve rapor icin yaniltici olurdu.
 *
 * Elenenler (sirasiyla):
 *  1. Geri alma loglari (`revertOf`) ve etkisiz kildiklari gruplar — olmamis sayilir
 *  2. Iptal edilmis **islemlerin** tum loglari (`cancelledBatchIds`) — "hatali giris",
 *     hic acilmamis sayilir; iptal logunun kendisi de bu yolla elenir, aksi halde borc
 *     hem acilmamis hem silinmis sayilip cift duselirdi
 *  3. `kind: 'lock'` — fiyat kilidi para hareketi degil
 *
 * **Kalem iptali elenmez**, azalis olarak sayilir: `cancelDebtItemOperations` eski "kalani
 * sil" yeteneginin karsiligidir ve kismen odenmis (yani gercekten var olmus) bir borcta da
 * kullanilir. Onu da silmek gercek bir borcu hic acilmamis gostermek olurdu. Ayirt etme
 * bedavaya gelir: islem iptali `batchId` tasir ve 2. adimda elenir, kalem iptali tasimaz.
 *
 * @param {Array<object>} transactions — musterinin degil, **tum** ekstre loglari
 * @param {{start: string, end: string}} period
 */
export const summarizePeriod = (transactions, period) => {
  const sum = emptySummary();
  const { start, end } = period || {};
  if (!start || !end || start > end) return sum;

  const all = transactions || [];
  const cancelledBatches = cancelledBatchIds(all);
  const neutralized = neutralizedBatchIds(all);

  // Isaretli avans hareketi ayri tutulur: `advanceIn` gorunume ait (iade fazlasini da
  // icerir), nakit hesabina yalnizca odeme yolundaki net delta girer.
  let advanceDelta = 0;
  let collect = 0;

  for (const t of all) {
    if (!t?.date || t.date < start || t.date > end) continue;

    if (t.revertOf) continue;
    if (t.batchId && neutralized.has(t.batchId)) continue;
    if (t.batchId && cancelledBatches.has(t.batchId)) continue;
    if (t.kind === 'lock') continue;

    if (!t.flow) {
      sum.unmeasured++;
      continue;
    }

    sum.movementCount++;
    const amount = Number(t.amount) || 0;

    switch (t.flow) {
      case 'debt':
        sum.debtOpened += amount;
        break;
      case 'collect':
        collect += amount;
        break;
      case 'inflation':
        sum.inflation += amount;
        break;
      case 'priceUp':
        sum.priceUp += amount;
        break;
      case 'writeoff':
        sum.writeoff += amount;
        break;
      case 'return':
        sum.returned += amount;
        // Fazla iadenin avansa yazilan kismi borcu azaltmaz, musterinin alacagi olur
        sum.advanceIn += Number(t.refund) || 0;
        break;
      case 'cancel':
        sum.cancelled += amount;
        break;
      case 'advance': {
        const delta = Number(t.balanceDelta) || 0;
        advanceDelta += delta;
        if (delta > 0) sum.advanceIn += delta;
        else sum.advanceUsed += -delta;
        break;
      }
      default:
        // Taninmayan bir `flow` sessizce toplanmaz — fail-closed
        sum.movementCount--;
        sum.unmeasured++;
    }
  }

  // Kasaya giren gercek nakit = borclara dagitilan + avansa yazilan − avanstan kullanilan.
  // (`applyPaymentOperations`: receivedAmount = totalDeducted + balanceDelta)
  sum.collected = round2(collect + advanceDelta);

  sum.receivableChange = round2(
    sum.debtOpened + sum.inflation + sum.priceUp - collect - sum.writeoff - sum.returned - sum.cancelled
  );

  sum.debtOpened = round2(sum.debtOpened);
  sum.inflation = round2(sum.inflation);
  sum.priceUp = round2(sum.priceUp);
  sum.writeoff = round2(sum.writeoff);
  sum.returned = round2(sum.returned);
  sum.cancelled = round2(sum.cancelled);
  sum.advanceIn = round2(sum.advanceIn);
  sum.advanceUsed = round2(sum.advanceUsed);

  return sum;
};
