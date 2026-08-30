import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { create as createFont } from 'fontkit';
import { REQUIRED_CODE_POINTS, PDF_FONT_FAMILY } from './fonts';

// --- YAZI TIPI KAPSAMA KAPISI ---
//
// Bu test gercek TTF dosyasini acip her kod noktasini tek tek sorar. Amaci ileriye donuk:
// font degistirilirse ya da daha dar kapsamli bir surumle degistirilirse **burasi kirilir**.
//
// Neden bu kadar onemli: eksik glif PDF'te hata vermez, sessizce bos kutu cizilir. Ne lint,
// ne build, ne de bilesen testi yakalar — yalnizca kullanici PDF'i acinca gorur.
//
// `fonts.js` TTF'i Vite varlik URL'i olarak import ettigi icin (vitest'te dizgeye doner)
// dosyalar burada dogrudan `node_modules` yolundan okunur.
//
// `fontkit.openSync` kullanilmiyor: test ortami jsdom oldugundan fontkit'in **tarayici**
// yapisina cozuluyor ve orada dosya sistemi API'si yok. `create(buffer)` her iki yapida
// da var, dosyayi `fs` ile okuyup ona veriyoruz.

const FONT_FILES = [
  ['Roboto Regular', '@expo-google-fonts/roboto/400Regular/Roboto_400Regular.ttf'],
  ['Roboto Bold', '@expo-google-fonts/roboto/700Bold/Roboto_700Bold.ttf']
];

const resolve = (rel) => path.join(process.cwd(), 'node_modules', rel);
const openFont = (rel) => createFont(fs.readFileSync(resolve(rel)));

describe('PDF yazi tipi kapsamasi', () => {
  it.each(FONT_FILES)('%s dosyasi mevcut', (_name, rel) => {
    expect(fs.existsSync(resolve(rel))).toBe(true);
  });

  describe.each(FONT_FILES)('%s', (_name, rel) => {
    const font = openFont(rel);

    it.each(Object.entries(REQUIRED_CODE_POINTS))(
      '%s (U+%s) glifini tasiyor',
      (char, codePoint) => {
        expect(char.codePointAt(0)).toBe(codePoint);
        expect(font.hasGlyphForCodePoint(codePoint)).toBe(true);
      }
    );

    it('ASCII rakam ve harfleri tasiyor', () => {
      for (const cp of [...'0123456789ABCabc.,;-'].map((c) => c.codePointAt(0))) {
        expect(font.hasGlyphForCodePoint(cp)).toBe(true);
      }
    });

    // Yukaridaki kontroller ancak `hasGlyphForCodePoint` gercekten ayirt ediyorsa anlamli.
    // Her seye `true` donen bir surum/yapi gelseydi butun kapi sessizce bosa duserdi.
    it.each([['CJK', 0x6F22], ['emoji', 0x1F600], ['alef', 0x2135]])(
      'kapsam disi %s karakterine false donuyor',
      (_name, codePoint) => {
        expect(font.hasGlyphForCodePoint(codePoint)).toBe(false);
      }
    );
  });

  it('kayitli aile adi Roboto', () => {
    expect(PDF_FONT_FAMILY).toBe('Roboto');
  });

  it('gerekli kod noktalari listesi Turkce harfleri ve lira isaretini kapsiyor', () => {
    // Liste yanlislikla budanirsa kapi anlamsizlasir
    expect(Object.keys(REQUIRED_CODE_POINTS)).toEqual(
      expect.arrayContaining(['ş', 'ğ', 'ı', 'İ', '₺'])
    );
  });
});
