// --- PDF URETIMI (LAZY CHUNK SINIRI) ---
//
// `@react-pdf/renderer` ve gomulu TTF'ler **yalnizca** buradan import edilir. Baska bir
// dosyadan import edilirse lazy chunk ana bundle'a geri duser; ana bundle zaten 759 KB ile
// uyari esiginin uzerinde. `StatementExportModal` bu modulu `await import(...)` ile cagirir.

import { createElement } from 'react';
import { Font, pdf } from '@react-pdf/renderer';
import { PDF_FONT_FAMILY, PDF_FONT_SOURCES } from './fonts';
import StatementPdfDocument from '../components/pdf/StatementPdfDocument';

let registered = false;

/**
 * Yazi tipini bir kez kaydeder.
 *
 * `Font.register` TTF'i URL'den **indirir**; uygulamada service worker olmadigi icin
 * cevrimdisiyken bu adim basarisiz olur. Sessizce bozuk (bos kutulu) PDF uretmek yerine
 * hata yukari verilir, cagiran kullaniciya anlasilir bir mesaj gosterir.
 */
const ensureFont = () => {
  if (registered) return;
  Font.register({ family: PDF_FONT_FAMILY, fonts: PDF_FONT_SOURCES });
  // Turkce metinde otomatik heceleme kelimeleri bozuk bolebiliyor; ekstre satirlari kisa,
  // hecelemeye ihtiyac yok.
  Font.registerHyphenationCallback((word) => [word]);
  registered = true;
};

/**
 * Modeli PDF `Blob`'una cevirir.
 *
 * @param {object} model — `buildStatementPdfModel` ciktisi
 * @returns {Promise<Blob>}
 */
export const renderStatementPdf = async (model) => {
  ensureFont();
  // JSX yerine `createElement`: bu dosya `utils/` altinda saf JS kalsin diye (Vite yalnizca
  // `.jsx` uzantisini JSX olarak isler)
  return pdf(createElement(StatementPdfDocument, { model })).toBlob();
};
