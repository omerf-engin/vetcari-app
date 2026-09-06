import { describe, it, expect } from 'vitest';
import { fold, searchMatch, parseQtyToken } from './search';

/**
 * Bu dosya bir KAPI. Turkce katlama bozulursa arama "calisiyor gibi gorunur" ama bazi
 * ilaclar hic bulunamaz; ne lint ne build yakalar. Buradaki cift yonlu iddialar
 * (eslesenler + eslesmemesi gerekenler) katlamanin gercekten ayirt ettigini kanitlar.
 */
describe('fold', () => {
  it('noktali/noktasiz i ailesinin tamamini tek kovaya koyar', () => {
    expect(fold('ı')).toBe('i');
    expect(fold('I')).toBe('i');
    expect(fold('İ')).toBe('i');
    expect(fold('i')).toBe('i');
  });

  it('Turkce harfleri ASCII karsiligina katlar', () => {
    expect(fold('ŞĞÜÖÇ')).toBe('sguoc');
    expect(fold('şğüöç')).toBe('sguoc');
  });

  it('tabloda olmayan karakteri toLowerCase ile birakir', () => {
    expect(fold('ARMAPEN 250 ML')).toBe('armapen 250 ml');
  });

  it('null/undefined icin bos string uretir', () => {
    expect(fold(null)).toBe('');
    expect(fold(undefined)).toBe('');
  });
});

describe('searchMatch', () => {
  // Kullanicinin ASCII yazip Turkce ad bulmasi gereken gercek durumlar
  it('ASCII yazim Turkce ada eslesir', () => {
    expect(searchMatch('İLAÇ', 'ilac')).toBe(true);
    expect(searchMatch('SARI SOLUSYON', 'sari')).toBe(true);
    expect(searchMatch('İĞNE', 'igne')).toBe(true);
    expect(searchMatch('ARMAPEN LA ENJ. SÜSP.', 'susp')).toBe(true);
    expect(searchMatch('ÇÖZELTİ', 'cozelti')).toBe(true);
  });

  it('ciplak toLowerCase ile bozulan noktasiz i durumunu dogru cozer', () => {
    // 'ILIK'.toLowerCase() === 'ilik' (yanlis); dogrusu 'ilik' ile de 'ılık' ile de eslesmeli
    expect(searchMatch('ILIK SOLUSYON', 'ilik')).toBe(true);
    expect(searchMatch('ılık solüsyon', 'ILIK')).toBe(true);
  });

  it('kelimeler sirasiz aranir, hepsi bulunmak zorundadir', () => {
    const name = 'ARMAPEN LA ENJ. SÜSP. - 250 ML';
    expect(searchMatch(name, 'armapen 250')).toBe(true);
    expect(searchMatch(name, '250 armapen')).toBe(true);
    expect(searchMatch(name, 'armapen 500')).toBe(false);
  });

  it('alakasiz sorguyu eslestirmez — kontrol gercekten ayirt ediyor', () => {
    expect(searchMatch('ARMAPEN', 'amoksisilin')).toBe(false);
    expect(searchMatch('İĞNE', 'ilac')).toBe(false);
  });

  it('bos sorgu her seyi eslestirir', () => {
    expect(searchMatch('ARMAPEN', '')).toBe(true);
    expect(searchMatch('ARMAPEN', '   ')).toBe(true);
  });
});

describe('parseQtyToken', () => {
  it('carpan isaretiyle adedi ayirir', () => {
    expect(parseQtyToken('armapen x3')).toEqual({ term: 'armapen', qty: 3 });
    expect(parseQtyToken('armapen *2')).toEqual({ term: 'armapen', qty: 2 });
    expect(parseQtyToken('armapen x 4')).toEqual({ term: 'armapen', qty: 4 });
    expect(parseQtyToken('armapen x1,5')).toEqual({ term: 'armapen', qty: 1.5 });
  });

  it('ciplak sondaki sayiyi adet SAYMAZ — ilac adlari sayi iceriyor', () => {
    expect(parseQtyToken('armapen 250')).toEqual({ term: 'armapen 250', qty: null });
    expect(parseQtyToken('enj 10 mg')).toEqual({ term: 'enj 10 mg', qty: null });
  });

  it('carpan oncesi bosluk sart — ad icindeki x adet saymaz', () => {
    expect(parseQtyToken('max 3')).toEqual({ term: 'max 3', qty: null });
    expect(parseQtyToken('armapenx3')).toEqual({ term: 'armapenx3', qty: null });
  });

  it('terim bos ya da adet sifirsa adet uretmez', () => {
    expect(parseQtyToken('x3')).toEqual({ term: 'x3', qty: null });
    expect(parseQtyToken('armapen x0')).toEqual({ term: 'armapen x0', qty: null });
  });
});
