// --- TARAYICI INDIRMESI ---
//
// DOM'a ve `URL` API'sine dokunan tek yer burasi. Ekstre uretimi (`statementExport.js`)
// saf metin dondurur; boylece asil mantik jsdom stub'i olmadan test edilebilir ve bu
// dosya testte tek satirla mock'lanir.

/**
 * Metni dosya olarak indirir.
 *
 * @param {string} filename — uzantisi dahil dosya adi
 * @param {string} text — dosya icerigi (BOM eklenecekse cagiran ekler)
 * @param {string} [mime]
 */
export const downloadTextFile = (filename, text, mime = 'text/csv;charset=utf-8') => {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Blob referansi birakilmazsa sekme kapanana kadar bellekte kalir
  URL.revokeObjectURL(url);
};
