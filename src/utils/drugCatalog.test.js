import { describe, it, expect } from 'vitest';
import { catalogHaystack, matchesCatalog, ownedByCatalogId, similarOwnedName } from './drugCatalog';

const doc = (over = {}) => ({
  catalogId: 'r-arma-biyokan#250 ML',
  urunId: 'r-arma-biyokan',
  name: 'Biyokan LA Enjeksiyonluk Çözelti - 250 ml',
  firma: 'Arma İlaç',
  form: 'Enjeksiyonluk Çözelti',
  etkenMaddeler: ['Amoksisilin', 'Klavulanik Asit'],
  ...over,
});

describe('catalogHaystack', () => {
  it('ad, firma, form ve etken maddeyi birlestirir', () => {
    const hay = catalogHaystack(doc());
    expect(hay).toContain('Biyokan');
    expect(hay).toContain('Arma İlaç');
    expect(hay).toContain('Enjeksiyonluk');
    expect(hay).toContain('Klavulanik Asit');
  });

  it('eksik alanlar bosluk birakmaz', () => {
    expect(catalogHaystack({ name: 'X' })).toBe('X');
  });
});

describe('matchesCatalog', () => {
  it('ad uzerinden bulur', () => {
    expect(matchesCatalog(doc(), 'biyokan')).toBe(true);
  });

  it('firma uzerinden bulur', () => {
    expect(matchesCatalog(doc(), 'arma')).toBe(true);
  });

  it('etken madde uzerinden bulur — muadil aramasi', () => {
    expect(matchesCatalog(doc(), 'amoksisilin')).toBe(true);
    expect(matchesCatalog(doc(), 'klavulanik')).toBe(true);
  });

  it('Turkce katlama calisir: ASCII yazim yeter', () => {
    expect(matchesCatalog(doc(), 'cozelti')).toBe(true);
    expect(matchesCatalog(doc({ firma: 'İLAÇ SANAYİ' }), 'ilac sanayi')).toBe(true);
  });

  it('kelimelerin HEPSI bulunmali', () => {
    expect(matchesCatalog(doc(), 'biyokan arma')).toBe(true);
    expect(matchesCatalog(doc(), 'biyokan bayer')).toBe(false);
  });

  it('alakasiz sorguyu eslestirmez', () => {
    expect(matchesCatalog(doc(), 'ivermektin')).toBe(false);
  });
});

describe('ownedByCatalogId', () => {
  it('yalnizca catalogId tasiyan kayitlari haritalar', () => {
    const map = ownedByCatalogId([
      { id: 'd1', name: 'A', catalogId: 'c1' },
      { id: 'd2', name: 'B' }, // elle eklenmis
    ]);
    expect(map.size).toBe(1);
    expect(map.get('c1').id).toBe('d1');
  });

  // Bilesik kimligin varlik sebebi: ayni urunun farkli ambalaji ayri kalemdir
  it('ayni urunun farkli ambalaji AYRI kimliktir, biri digerini engellemez', () => {
    const map = ownedByCatalogId([{ id: 'd1', name: 'Biyokan 100', catalogId: 'r-arma-biyokan#100 ML' }]);
    expect(map.has('r-arma-biyokan#100 ML')).toBe(true);
    expect(map.has('r-arma-biyokan#250 ML')).toBe(false);
  });
});

describe('similarOwnedName', () => {
  it('elle girilmis benzer adi bulur', () => {
    const drugs = [{ id: 'd1', name: 'BIYOKAN LA ENJEKSIYONLUK COZELTI - 250 ML' }];
    expect(similarOwnedName(drugs, doc())?.id).toBe('d1');
  });

  it('catalogId tasiyan kaydi dikkate almaz — kesin katman onu zaten goruyor', () => {
    const drugs = [{ id: 'd1', name: 'Biyokan LA Enjeksiyonluk Çözelti - 250 ml', catalogId: 'x' }];
    expect(similarOwnedName(drugs, doc())).toBeNull();
  });

  it('alakasiz kaydi benzer saymaz', () => {
    expect(similarOwnedName([{ id: 'd1', name: 'Sarı Solüsyon' }], doc())).toBeNull();
  });

  it('bos adli katalog kaydinda null doner', () => {
    expect(similarOwnedName([{ id: 'd1', name: 'X' }], doc({ name: '' }))).toBeNull();
  });
});
