import { describe, it, expect } from 'vitest';
import {
  catalogHaystack, matchesCatalog, ownedByCatalogId, similarOwnedName,
  buildStopTokens, similarityScore, tokenizeName,
} from './drugCatalog';

/**
 * Benzerlik testleri icin sabit katalog.
 *
 * Gercek katalogun istatistiksel sekli taklit edilir: jenerik kelimeler (`ml`,
 * `enjeksiyonluk`, `cozelti`, `la`, ambalaj sayilari) COK gecer ve elenmeli; marka
 * kelimeleri (`armaflor`, `armapen`) AZ gecer ve ayirt edici kalmali.
 */
const FIXTURE = [
  { catalogId: 'c1', name: 'Armaflor Enjeksiyonluk Çözelti - 100 ml' },
  { catalogId: 'c2', name: 'Armaflor Enjeksiyonluk Çözelti - 250 ml' },
  { catalogId: 'c3', name: 'Armapen LA Enjeksiyonluk Süspansiyon - 100 ml' },
  { catalogId: 'c4', name: 'Armapen LA Enjeksiyonluk Süspansiyon - 250 ml' },
  { catalogId: 'c5', name: 'Baymycin LA Enjeksiyonluk Çözelti - 100 ml' },
  { catalogId: 'c6', name: 'Terramisin LA Enjeksiyonluk Çözelti - 250 ml' },
  { catalogId: 'c7', name: 'Oksitosin Enjeksiyonluk Çözelti - 50 ml' },
  { catalogId: 'c8', name: 'Kalsiyum Boroglukonat Enjeksiyonluk Çözelti - 100 ml' },
  { catalogId: 'c9', name: 'Vitamin AD3E Enjeksiyonluk Çözelti - 50 ml' },
  { catalogId: 'c10', name: 'Vitamin B Kompleks Enjeksiyonluk Çözelti - 100 ml' },
  { catalogId: 'c11', name: 'Deksametazon Enjeksiyonluk Çözelti - 50 ml' },
  { catalogId: 'c12', name: 'Flunixin Enjeksiyonluk Çözelti - 100 ml' },
  { catalogId: 'c13', name: 'Enrofloksasin LA Enjeksiyonluk Çözelti - 250 ml' },
  { catalogId: 'c14', name: 'Tilmikosin Enjeksiyonluk Çözelti - 100 ml' },
  { catalogId: 'c15', name: 'Sulfadoksin Enjeksiyonluk Süspansiyon - 100 ml' },
  { catalogId: 'c16', name: 'Ivermektin Enjeksiyonluk Çözelti - 50 ml' },
  { catalogId: 'c17', name: 'Ketoprofen Enjeksiyonluk Çözelti - 100 ml' },
  { catalogId: 'c18', name: 'Butafosfan Enjeksiyonluk Çözelti - 250 ml' },
  { catalogId: 'c19', name: 'Gentamisin LA Enjeksiyonluk Çözelti - 100 ml' },
  { catalogId: 'c20', name: 'Marbofloksasin Enjeksiyonluk Çözelti - 50 ml' },
];
const STOP = buildStopTokens(FIXTURE);
const own = (name) => [{ id: 'd1', name }];

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

describe('tokenizeName', () => {
  it('noktalamayi atar, Turkce katlar', () => {
    expect(tokenizeName('ARMAPEN LA ENJ. SÜSP. - 250 ML'))
      .toEqual(['armapen', 'la', 'enj', 'susp', '250', 'ml']);
  });
});

describe('buildStopTokens', () => {
  it('jenerik kelimeleri eler, marka kelimelerini birakir', () => {
    expect(STOP.has('ml')).toBe(true);
    expect(STOP.has('enjeksiyonluk')).toBe(true);
    expect(STOP.has('cozelti')).toBe(true);
    expect(STOP.has('la')).toBe(true);
    // Ambalaj sayilari da elenir — bu yuzden esleme URUN duzeyindedir, ambalaj duzeyinde degil
    expect(STOP.has('100')).toBe(true);
    expect(STOP.has('250')).toBe(true);

    expect(STOP.has('armaflor')).toBe(false);
    expect(STOP.has('armapen')).toBe(false);
    expect(STOP.has('oksitosin')).toBe(false);
  });
});

describe('similarityScore', () => {
  it('yalnizca noktalama farki tam eslesme sayilir', () => {
    // Kullanicinin gercek kaydi ile katalog arasindaki fark yalnizca bir tire
    const score = similarityScore(
      'ARMAFLOR ENJEKSIYONLUK COZELTI 250 ML',
      'Armaflor Enjeksiyonluk Çözelti - 250 ml',
      STOP
    );
    expect(score).toBe(1);
  });

  it('ayirt edici kelimesi kalmayan ad 0 verir', () => {
    expect(similarityScore('LA', 'Armapen LA Enjeksiyonluk Süspansiyon - 100 ml', STOP)).toBe(0);
  });
});

describe('similarOwnedName', () => {
  // Duzeltmenin ASIL SEBEBI: eski surum bu kaydi bulamiyordu (tek fark bir tire)
  it('elle girilmis kaydi katalogdaki karsiligiyla eslestirir', () => {
    const hit = similarOwnedName(own('ARMAFLOR ENJEKSIYONLUK COZELTI 250 ML'), FIXTURE[1], STOP);
    expect(hit?.name).toBe('ARMAFLOR ENJEKSIYONLUK COZELTI 250 ML');
  });

  it('kisaltmali yazim da eslesir (ENJ. SUSP. <-> Enjeksiyonluk Süspansiyon)', () => {
    expect(similarOwnedName(own('ARMAPEN LA ENJ. SÜSP. - 250 ML'), FIXTURE[3], STOP)).not.toBeNull();
  });

  // GURULTU OLCUMU — mutasyon denetiminin isiracagi iddia bu.
  // Stop listesi devre disi kalirsa "LA" katalogun onda birinde uyari tetikler.
  it('jenerik kisa ad HICBIR kayitla eslesmez', () => {
    const hits = FIXTURE.filter(d => similarOwnedName(own('LA'), d, STOP));
    expect(hits).toHaveLength(0);
  });

  it('tek harflik ad hicbir kayitla eslesmez', () => {
    const hits = FIXTURE.filter(d => similarOwnedName(own('K'), d, STOP));
    expect(hits).toHaveLength(0);
  });

  it('jenerik uzun ad yalnizca kendi ailesini isaretler', () => {
    const hits = FIXTURE.filter(d => similarOwnedName(own('Oksitosin'), d, STOP));
    expect(hits.map(h => h.catalogId)).toEqual(['c7']);
  });

  it('catalogId tasiyan kaydi dikkate almaz — kesin katman onu zaten goruyor', () => {
    const drugs = [{ id: 'd1', name: 'Armaflor Enjeksiyonluk Çözelti - 250 ml', catalogId: 'x' }];
    expect(similarOwnedName(drugs, FIXTURE[1], STOP)).toBeNull();
  });

  it('alakasiz kaydi benzer saymaz', () => {
    expect(similarOwnedName(own('Sarı Solüsyon'), FIXTURE[1], STOP)).toBeNull();
  });

  it('bos adli katalog kaydinda ve stop listesi yoksa null doner', () => {
    expect(similarOwnedName(own('X'), { name: '' }, STOP)).toBeNull();
    expect(similarOwnedName(own('X'), FIXTURE[1], null)).toBeNull();
  });
});
