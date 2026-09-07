import { describe, it, expect } from 'vitest';
import {
  parseCsv, normalizePackage, buildCatalogId, buildCatalogDocs
} from './catalogTransform.js';

/**
 * Fixture gercek disa aktarimin yapisini taklit eder ama ONA BAGLI DEGILDIR:
 * kaynak zip repoya girmiyor (.gitignore), test onsuz da calismali.
 */
const URUNLER = [
  'urun_id,bolum,firma,urun_adi,sinif,etken_madde,etken_maddeler,form,uyari,taslak',
  'r-arma-biyokan-la-100-ml,ruminant,Arma İlaç,Biyokan LA Enjeksiyonluk Çözelti - 100 ml,ilac,Amoksisilin,Amoksisilin | Klavulanik Asit,Enjeksiyonluk Çözelti,,0',
  'p-elanco-advantix,pet,ELANCO,ADVANTİX 4×4 ML,antiparaziter,İmidakloprid,İmidakloprid | Permetrin,Spot-On,dog-only,0',
  'r-test-varyantsiz,ruminant,Teknovet,SARI SOLÜSYON,ilac,Bakır,Bakır,Çözelti,,0',
  'r-test-taslak,ruminant,Bilinmeyen,TASLAK ÜRÜN,ilac,,,,,1',
].join('\n');

const VARYANTLAR = [
  'urun_id,urun_adi,varyant_adi,ambalaj',
  'r-arma-biyokan-la-100-ml,Biyokan LA Enjeksiyonluk Çözelti - 100 ml,Biyokan LA Enjeksiyonluk Çözelti - 100 ml,100 ML',
  'r-arma-biyokan-la-100-ml,Biyokan LA Enjeksiyonluk Çözelti - 100 ml,Biyokan LA Enjeksiyonluk Çözelti - 250 ml,250 ML',
  'p-elanco-advantix,ADVANTİX 4×4 ML,ADVANTİX 4×4 ML,',
  'r-test-taslak,TASLAK ÜRÜN,TASLAK ÜRÜN,50 ML',
].join('\n');

const build = () => buildCatalogDocs({ urunlerCsv: URUNLER, varyantlarCsv: VARYANTLAR });

describe('parseCsv', () => {
  it('BOM ve tirnakli alanlari cozer', () => {
    const rows = parseCsv('﻿a,b\n"x,1","y ""z"""');
    expect(rows).toEqual([{ a: 'x,1', b: 'y "z"' }]);
  });

  it('bos girdide bos dizi doner', () => {
    expect(parseCsv('')).toEqual([]);
  });
});

describe('buildCatalogId', () => {
  it('ambalaji kimlige katar', () => {
    expect(buildCatalogId('r-x', '250 ML')).toBe('r-x#250 ML');
  });

  it('bos ambalajda urun kimligine coker', () => {
    expect(buildCatalogId('r-x', '')).toBe('r-x');
    expect(buildCatalogId('r-x', '   ')).toBe('r-x');
  });

  // Kozmetik degisiklik kimligi degistirseydi, o kayittan turemis tum drugs baglari kopardi
  it('yazim farkliliklari ayni kimligi uretir', () => {
    const a = buildCatalogId('r-x', '250 ml');
    expect(buildCatalogId('r-x', '250 ML')).toBe(a);
    expect(buildCatalogId('r-x', '  250   ml  ')).toBe(a);
  });

  it('Turkce buyuk harf donusumu dogru yapilir', () => {
    expect(normalizePackage('20 tablet')).toBe('20 TABLET');
    expect(normalizePackage('1 lt')).toBe('1 LT');
  });

  // Gercek veride "50 MG — KEDİ/KÖPEK (10 TB)" gibi ambalajlar var; `/` Firestore
  // dokuman kimliginde YASAKTIR ve yuklemeyi hata ile durdurur.
  it('egik cizgi kimlikten temizlenir — Firestore yol ayraci', () => {
    expect(buildCatalogId('p-x', '50 MG — KEDİ/KÖPEK (10 TB)')).not.toContain('/');
    expect(buildCatalogId('p-x', 'A/B')).toBe('p-x#A-B');
  });

  it('kimlik Firestore dokuman kimligi kurallarina uyar', () => {
    const id = buildCatalogId('p-x', '50 MG — KEDİ/KÖPEK (10 TB)');
    expect(id).not.toContain('/');
    expect(id).not.toBe('.');
    expect(id).not.toBe('..');
    expect(id).not.toMatch(/^__.*__$/);
    expect(Buffer.byteLength(id, 'utf8')).toBeLessThan(1500);
  });
});

describe('buildCatalogDocs', () => {
  it('ayni urunun farkli ambalajlari AYRI kalem olur', () => {
    const { docs } = build();
    const biyokan = docs.filter(d => d.urunId === 'r-arma-biyokan-la-100-ml');

    expect(biyokan).toHaveLength(2);
    expect(biyokan.map(d => d.catalogId).sort()).toEqual([
      'r-arma-biyokan-la-100-ml#100 ML',
      'r-arma-biyokan-la-100-ml#250 ML',
    ]);
    // Ayni urun_id'yi paylasiyorlar — kimlik urun_id olsaydi biri digerini engellerdi
    expect(new Set(biyokan.map(d => d.urunId)).size).toBe(1);
  });

  it('bos ambalajli varyant urun kimligine coker', () => {
    const { docs } = build();
    const advantix = docs.filter(d => d.urunId === 'p-elanco-advantix');
    expect(advantix).toHaveLength(1);
    expect(advantix[0].catalogId).toBe('p-elanco-advantix');
    expect(advantix[0].unit).toBeUndefined();
  });

  it('varyanti olmayan urun kendisi kalem olur', () => {
    const { docs } = build();
    const tekil = docs.find(d => d.urunId === 'r-test-varyantsiz');
    expect(tekil).toBeDefined();
    expect(tekil.catalogId).toBe('r-test-varyantsiz');
    expect(tekil.name).toBe('SARI SOLÜSYON');
  });

  it('taslak urun ve varyanti tamamen haric tutulur', () => {
    const { docs, skippedDraft } = build();
    expect(skippedDraft).toBe(1);
    expect(docs.some(d => d.urunId === 'r-test-taslak')).toBe(false);
  });

  // Sessiz veri kaybina karsi sayac: urunu bulunmayan varyant satiri atlanir ama RAPORLANIR
  it('urunu bulunmayan varyant satiri sayilir, sessizce atilmaz', () => {
    const varyantlar = VARYANTLAR + '\nr-yok-boyle-urun,HAYALET,HAYALET,10 ML';
    const { orphanVariants, docs } = buildCatalogDocs({ urunlerCsv: URUNLER, varyantlarCsv: varyantlar });

    expect(orphanVariants).toEqual(['r-yok-boyle-urun']);
    expect(docs.some(d => d.name === 'HAYALET')).toBe(false);
  });

  it('taslak urunun varyanti yetim SAYILMAZ — kasitli olarak elenmis', () => {
    const { orphanVariants } = build();
    expect(orphanVariants).toEqual([]);
  });

  it('kimlik cakismasi olmaz', () => {
    const { docs, collisions } = build();
    expect(collisions).toEqual([]);
    expect(new Set(docs.map(d => d.catalogId)).size).toBe(docs.length);
  });

  // Yukleyici tekrar tekrar calistirilabilmeli: ayni girdi ayni kimlikleri uretmeli
  it('idempotent: ayni girdi ayni kimlikleri uretir', () => {
    const a = build().docs.map(d => d.catalogId);
    const b = build().docs.map(d => d.catalogId);
    expect(a).toEqual(b);
  });

  it('etken maddeler diziye ayrilir, uyari saklanir', () => {
    const { docs } = build();
    const advantix = docs.find(d => d.urunId === 'p-elanco-advantix');
    expect(advantix.etkenMaddeler).toEqual(['İmidakloprid', 'Permetrin']);
    expect(advantix.uyari).toBe('dog-only');
  });

  it('bos alanlar dokumana bos string olarak degil, hic girmez', () => {
    const { docs } = build();
    const tekil = docs.find(d => d.urunId === 'r-test-varyantsiz');
    expect(tekil.unit).toBeUndefined();
    expect('uyari' in tekil).toBe(false);
  });
});

describe('dokuman alanlari', () => {
  it('aramanin ihtiyac duydugu tum alanlari tasir', () => {
    const { docs } = build();
    const biyokan = docs.find(d => d.catalogId.endsWith('#250 ML'));

    // `src/utils/drugCatalog.js` bu alanlardan arama metnini kuruyor
    expect(biyokan.name).toContain('Biyokan');
    expect(biyokan.firma).toBe('Arma İlaç');
    expect(biyokan.form).toBe('Enjeksiyonluk Çözelti');
    expect(biyokan.etkenMaddeler).toContain('Klavulanik Asit');
  });
});
