// --- YARDIMCI FORMATLAYICILAR ---
export const fmtTL = (val) => Number(val).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 1 }) + ' ₺';
export const fmtQty = (val) => Number(val).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
