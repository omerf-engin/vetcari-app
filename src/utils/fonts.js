// --- PDF YAZI TIPI ---
//
// **PDF'in standart fontlari Turkce yazamaz.** Helvetica/Times/Courier WinAnsi (CP1252)
// kodlamasi kullanir: `ç ö ü` vardir ama `ş ğ ı İ Ş Ğ` ve `₺` (U+20BA) **yoktur**.
// Uygulamanin butun metni Turkce oldugu icin ("Müşteri", "İptal edildi", "Kalan borç")
// gomulu bir TTF olmadan cikti bos kutularla dolar. Bozuk glif sessizce cizilir —
// hicbir birim testi yakalamaz, ancak kullanici PDF'i acinca gorur.
//
// Roboto secildi: her iki agirlik toplam ~312 KB ve asagidaki kod noktalarinin hepsini
// tasiyor. DejaVu Sans da tasiyor ama 1.4 MB (4.5 kat) — bu bundle icin fazla.
//
// `fonts.test.js` bu kod noktalarini gercek dosyada tek tek dogrular; font degistirilirse
// ya da kapsama daralirsa orasi kirilir.

import RobotoRegular from '@expo-google-fonts/roboto/400Regular/Roboto_400Regular.ttf';
import RobotoBold from '@expo-google-fonts/roboto/700Bold/Roboto_700Bold.ttf';

export const PDF_FONT_FAMILY = 'Roboto';

/** `Font.register`'a verilecek kayit. Vite TTF'leri varlik URL'ine cevirir. */
export const PDF_FONT_SOURCES = [
  { src: RobotoRegular, fontWeight: 400 },
  { src: RobotoBold, fontWeight: 700 }
];

/**
 * PDF'te gecmesi kesin olan kod noktalari.
 *
 * Turkce'ye ozgu harfler (`ş ğ ı İ`) log basliklarinda ve musteri adlarinda; `₺` tutar
 * aciklamalarinda; `—` ve `×` ise borc mesajlarinda geciyor ("2 adet × 450 ₺ = ...").
 */
export const REQUIRED_CODE_POINTS = {
  'ş': 0x015F, 'Ş': 0x015E,
  'ğ': 0x011F, 'Ğ': 0x011E,
  'ı': 0x0131, 'İ': 0x0130,
  'ç': 0x00E7, 'Ç': 0x00C7,
  'ö': 0x00F6, 'Ö': 0x00D6,
  'ü': 0x00FC, 'Ü': 0x00DC,
  '₺': 0x20BA,
  '—': 0x2014,
  '×': 0x00D7
};
