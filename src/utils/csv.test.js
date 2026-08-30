import { describe, it, expect } from 'vitest';
import { toCSV, escapeField, csvNumber, BOM, CSV_SEPARATOR } from './csv';

/** BOM'suz govde — satir icerigini kiyaslarken onek gurultu yaratir. */
const body = (rows) => toCSV(rows, { bom: false });

describe('escapeField', () => {
  it('sade metni oldugu gibi birakir', () => {
    expect(escapeField('Muayene')).toBe('Muayene');
  });

  it('ayirici iceren alani tirnaklar', () => {
    expect(escapeField('Muayene; asi')).toBe('"Muayene; asi"');
  });

  it('ic tirnaklari ikiler ve alani tirnaklar', () => {
    expect(escapeField('12 "adet" ilac')).toBe('"12 ""adet"" ilac"');
  });

  it('satir sonu iceren alani tirnaklar', () => {
    expect(escapeField('birinci\nikinci')).toBe('"birinci\nikinci"');
  });

  it('null ve undefined bos hucre olur', () => {
    expect(escapeField(null)).toBe('');
    expect(escapeField(undefined)).toBe('');
  });

  it('0 bos degil, sifir yazilir', () => {
    // Tutar sutununda 0 gecerli bir deger; dogruluk kontrolu kullanilsaydi kaybolurdu
    expect(escapeField(0)).toBe('0');
  });

  it.each(['=1+1', '+A1', '@SUM(A1)', '\tveri'])('formul onekini etkisizlestirir: %j', (raw) => {
    expect(escapeField(raw).replace(/^"/, '').charAt(0)).toBe("'");
  });

  it('tire ile baslayan metne dokunmaz', () => {
    // Negatif tutarlar sayi sutununda; onlari apostrofla metne cevirmek Excel'de toplamayi bozardi
    expect(escapeField('-450,00')).toBe('-450,00');
  });
});

describe('toCSV', () => {
  it('satirlari CRLF, hucreleri noktali virgul ile birlestirir', () => {
    expect(body([['a', 'b'], ['c', 'd']])).toBe('a;b\r\nc;d');
  });

  it('varsayilan ayirici tr-TR Excel icin noktali virguldur', () => {
    // Virgul olsaydi ondalik ayiriciyla catisir, tum satir tek hucreye duserdi
    expect(CSV_SEPARATOR).toBe(';');
  });

  it('varsayilan olarak basa BOM koyar', () => {
    const out = toCSV([['ş', 'ğ']]);
    expect(out.charCodeAt(0)).toBe(0xFEFF);
    expect(out).toBe(`${BOM}ş;ğ`);
  });

  it('BOM tam olarak U+FEFF karakteridir', () => {
    // Kaynaktan sessizce silinirse Turkce karakterler Excel'de bozulur
    expect(BOM).toBe(String.fromCharCode(0xFEFF));
    expect(BOM).toHaveLength(1);
  });

  it('bos satir bos bir hucre satiri uretir', () => {
    expect(body([['a'], [], ['b']])).toBe('a\r\n\r\nb');
  });

  it('ozel ayirici verildiginde kacis o ayiriciya gore yapilir', () => {
    expect(toCSV([['a,b', 'c;d']], { separator: ',', bom: false })).toBe('"a,b",c;d');
  });
});

describe('csvNumber', () => {
  it('iki ondalikli tr-TR virgullu bicim yazar', () => {
    expect(csvNumber(1234.5)).toBe('1234,50');
  });

  it('tam sayiya da iki ondalik ekler', () => {
    expect(csvNumber(900)).toBe('900,00');
  });

  it('binlik ayirici koymaz', () => {
    // `.` baska bir yerel ayarda ondalik noktasi gibi okunurdu
    expect(csvNumber(1234567.89)).toBe('1234567,89');
  });

  it('negatif tutari isaretiyle yazar', () => {
    expect(csvNumber(-450.25)).toBe('-450,25');
  });

  it('para simgesi eklemez', () => {
    // fmtTL burada kullanilamaz: ` ₺` ekler ve 1 ondalikla yuvarlar
    expect(csvNumber(120.45)).not.toContain('₺');
    expect(csvNumber(120.45)).toBe('120,45');
  });

  it('sayi olmayan girdi bos hucre olur', () => {
    expect(csvNumber(null)).toBe('');
    expect(csvNumber(undefined)).toBe('');
    expect(csvNumber('abc')).toBe('');
    expect(csvNumber(Infinity)).toBe('');
  });

  it('sifiri yazar, bos birakmaz', () => {
    expect(csvNumber(0)).toBe('0,00');
  });
});
