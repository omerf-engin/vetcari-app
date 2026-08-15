// --- TARİH YARDIMCILARI ---
//
// `new Date().toISOString()` **UTC** döndürür. Türkiye UTC+3 olduğu için yerel saat
// 00:00–03:00 arasında üretilen tarih bir önceki güne düşer; borçlar ve ekstre logları
// bir gün geriye kayardı. Bu yüzden "bugün" her yerde aşağıdaki yardımcılarla üretilir.

/** Bir Date nesnesini **yerel** saate göre `YYYY-MM-DD` formatına çevirir. */
export const toLocalDateStr = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/** Yerel saate göre bugünün tarihi (`YYYY-MM-DD`). */
export const todayLocal = () => toLocalDateStr(new Date());
