// --- ISLEM (BATCH) BAZLI BORC GRUPLAMA ---
// Ayni islemde acilan hizmet ve ilac borclari ortak bir `batchId` tasir.
// `batchId` alani olmayan eski kayitlar kendi doküman id'leriyle tek kalemlik
// gruplara ayrilir (migration gerektirmez).

const round2 = (val) => Math.round(val * 100) / 100;

const itemTotal = (debt) =>
  debt.type === 'service' ? (debt.amount || 0) : (debt.tlValue ?? debt.qty * debt.maxPrice);

/**
 * Hizmet ve ilaç borçlarını açıldıkları işleme göre gruplar.
 * Ham Firestore dokümanıyla da, zenginleştirilmiş satırla (`tlValue`, `drugName`) da çalışır.
 *
 * @param {Array<object>} serviceDebts
 * @param {Array<object>} drugDebts
 * @returns {Array<{batchId: string, date: string, createdAt: number, items: object[], itemCount: number,
 *                  total: number, hasService: boolean, hasDrug: boolean, hasFixed: boolean, allFixed: boolean}>}
 *          Gruplar tarihe göre yeniden eskiye; aynı tarihte `createdAt` yeniden eskiye sıralı.
 *          Her kalem `type: 'service' | 'drug'` ayırt edicisi taşır.
 */
export const groupDebtsByBatch = (serviceDebts, drugDebts) => {
  const map = new Map();

  const add = (debt, type) => {
    // Eski kayitlarda iki koleksiyonun doküman id'leri cakismasin diye tip oneki
    const key = debt.batchId || `${type}:${debt.id}`;
    if (!map.has(key)) {
      map.set(key, {
        batchId: key,
        date: debt.date || '',
        createdAt: debt.createdAt ?? 0,
        items: [],
        itemCount: 0,
        total: 0,
        hasService: false,
        hasDrug: false,
        hasFixed: false,
        allFixed: true
      });
    }

    const group = map.get(key);
    const item = { ...debt, type };
    group.items.push(item);
    group.total += itemTotal(item);

    if (type === 'service') {
      group.hasService = true;
    } else {
      group.hasDrug = true;
      if (debt.isFixed) group.hasFixed = true;
      else group.allFixed = false;
    }
  };

  for (const debt of serviceDebts || []) add(debt, 'service');
  for (const debt of drugDebts || []) add(debt, 'drug');

  const groups = [...map.values()];
  groups.forEach(g => {
    g.itemCount = g.items.length;
    g.total = round2(g.total);
    // Kilit yalnizca ilac kalemleri icin anlamli
    if (!g.hasDrug) g.allFixed = false;
  });

  groups.sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return b.createdAt - a.createdAt;
  });

  return groups;
};
