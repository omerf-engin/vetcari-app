// --- YARDIMCI FORMATLAYICILAR ---
export const fmtTL = (val) => Number(val).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 1 }) + ' ₺';
export const fmtQty = (val) => Number(val).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export const fmtDate = (isoString) => {
  if (!isoString) return '-';
  const d = new Date(isoString);
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
};
