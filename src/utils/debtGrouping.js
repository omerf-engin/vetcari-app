// --- ISLEM (BATCH) BAZLI BORC GRUPLAMA ---
// Ayni islemde acilan ilac borclari ortak bir `batchId` tasir.
// `batchId` alani olmayan eski kayitlar kendi doküman id'leriyle
// tek kalemlik gruplara ayrilir (migration gerektirmez).

const round2 = (val) => Math.round(val * 100) / 100;

/**
 * İlaç borçlarını açıldıkları işleme göre gruplar.
 * Ham Firestore dokümanıyla da, zenginleştirilmiş satırla (`tlValue`, `drugName`) da çalışır.
 *
 * @param {Array<object>} debts
 * @returns {Array<{batchId: string, date: string, createdAt: number, items: object[], itemCount: number, total: number, hasFixed: boolean, allFixed: boolean}>}
 *          Gruplar tarihe göre yeniden eskiye; aynı tarihte `createdAt` yeniden eskiye sıralı.
 */
export const groupDrugDebtsByBatch = (debts) => {
  const map = new Map();

  for (const debt of debts || []) {
    const key = debt.batchId || debt.id;
    if (!map.has(key)) {
      map.set(key, {
        batchId: key,
        date: debt.date || '',
        createdAt: debt.createdAt ?? 0,
        items: [],
        itemCount: 0,
        total: 0,
        hasFixed: false,
        allFixed: true
      });
    }

    const group = map.get(key);
    group.items.push(debt);
    group.total += debt.tlValue ?? (debt.qty * debt.maxPrice);
    if (debt.isFixed) group.hasFixed = true;
    else group.allFixed = false;
  }

  const groups = [...map.values()];
  groups.forEach(g => {
    g.itemCount = g.items.length;
    g.total = round2(g.total);
  });

  groups.sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return b.createdAt - a.createdAt;
  });

  return groups;
};
