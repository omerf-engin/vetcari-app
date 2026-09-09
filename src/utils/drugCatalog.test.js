import { describe, it, expect } from 'vitest';
import {
  catalogHaystack, matchesCatalog, ownedByCatalogId, similarOwned,
  buildStopTokens, similarityScore, tokenizeName, distinctiveTokens,
  packageSignature, catalogPackageSignature, SIMILARITY_THRESHOLD,
} from './drugCatalog';

/**
 * Benzerlik testleri icin sabit katalog.
 *
 * Gercek katalogun istatistiksel sekli taklit edilir: jenerik kelimeler (`ml`,
 * `enjeksiyonluk`, `cozelti`, `la`, ambalaj sayilari) COK gecer ve elenmeli; marka
 * kelimeleri (`armaflor`, `armapen`) AZ gecer ve ayirt edici kalmali.
 *
 * KISALTMALAR da (c21-c25) bilerek var: gercek katalogda `enj` 185, `susp` 26 dokumanda
 * geciyor (olcum 2026-09-08), yani ikisi de eleniyor. Kisaltmasiz bir sabit katalog bu
 * yonuyle gercege benzemez ve "ENJ. SÜSP." yazan kullanicinin kaydini bulan kodu yanlis
 * yere kirmis olurdu.
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
  // Kisaltmali yazim — `enj` ve `susp` gercek katalogda oldugu gibi elenecek kadar sik
  { catalogId: 'c21', name: 'Oksitetrasiklin LA Enj. Çözelti - 100 ml' },
  { catalogId: 'c22', name: 'Tulatromisin Enj. Çözelti - 50 ml' },
  { catalogId: 'c23', name: 'Amoksisilin Enj. Süsp. - 100 ml' },
  { catalogId: 'c24', name: 'Seftiofur Enj. Süsp. - 250 ml' },
  { catalogId: 'c25', name: 'Penisilin Enj. Süsp. - 50 ml' },
  // Tek harf TUZAGI: ikisinde de "K" var ama ayni sey degiller — Fitadinon gercek K
  // vitamini, Baytril'de "K" marka soneki. Bu iki satir olmadan asagidaki "K" testi
  // bosta calisiyordu (fixture'da hic `k` kelimesi yoktu).
  { catalogId: 'c26', name: 'Fitadinon K Enjeksiyonluk Çözelti - 100 ml' },
  { catalogId: 'c27', name: 'Baytril K Enjeksiyonluk Çözelti - 50 ml' },
  // Beden kodlari: tek harf ayirt edici sayilirsa AYNI urunun bedenleri farkli aile gorunur
  { catalogId: 'c28', name: 'Nexgard Dog 11 mg (S)' },
  { catalogId: 'c29', name: 'Nexgard Dog 28 mg (M)' },
  // IKI harflik kelime kanittir: "B6" bir vitamin adi, "K" gibi belirsiz degil.
  // Esik 2 yerine 3 olsaydi bu kayit bulunamazdi.
  { catalogId: 'c30', name: 'Nörobiyon B6 Enjeksiyonluk Çözelti - 100 ml' },
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

/**
 * Sabit katalog 30 kayit oldugu icin esik HEP taban dalindan geciyor
 * (`max(3, 30*0.02=0.6) = 3`) ve ORAN dali hic sinanmiyordu. Mutasyon denetimi bunu
 * dogruladi: `STOP_RATIO = 0` yapilinca butun paket yesil kaliyordu.
 *
 * O mutasyon gercek katalogda yikici olurdu: limit 3'e duser, `armaflor` (3 dokuman)
 * stop kelime olur ve ARMAFLOR eslesmesi tamamen kaybolurdu. Bu yuzden oran dali
 * sabit katalogdan bagimsiz, SENTETIK bir katalogla sinanir.
 */
describe('buildStopTokens — oran dali', () => {
  // 300 kayit -> limit = max(3, 300*0.02 = 6) = 6
  const BUYUK = Array.from({ length: 300 }, (_, i) => ({
    catalogId: `b${i}`,
    name: [`Urun${i}`, i < 10 ? 'yaygin' : '', i < 5 ? 'nadir' : ''].filter(Boolean).join(' '),
  }));

  it('esik ORANA gore olusur, tabana gore degil', () => {
    const stop = buildStopTokens(BUYUK);

    expect(stop.has('yaygin')).toBe(true);   // 10/300 = %3.3, oranin ustunde
    // 5/300 = %1.7: TABANIN (3) ustunde ama ORANIN altinda. Oran silinseydi
    // bu kelime de elenir ve marka adlari ayirt edici olmaktan cikardi.
    expect(stop.has('nadir')).toBe(false);
  });
});

describe('distinctiveTokens', () => {
  it('tek harflik kelimeleri ve stop kelimeleri eler', () => {
    expect([...distinctiveTokens('Baytril K Enjeksiyonluk Çözelti - 50 ml', STOP)]).toEqual(['baytril']);
  });

  it('iki harften uzun kelimeler kalir — B12 kanit sayilir', () => {
    expect([...distinctiveTokens('Butafos-B12 Enj. Çözelti', STOP)].sort()).toEqual(['b12', 'butafos']);
  });

  // Esigin tam olarak 2 oldugunu sabitler: 3 olsaydi "B6" kanit olmaktan cikardi.
  // Gercek katalogda da 3 olcumle daha kotuydu (Vitamin 2 -> 3, gurultu artiyor).
  it('IKI harflik kelime hala kanittir', () => {
    expect([...distinctiveTokens('Nörobiyon B6 Enjeksiyonluk Çözelti - 100 ml', STOP)].sort())
      .toEqual(['b6', 'norobiyon']);

    const hit = similarOwned(own('B6'), FIXTURE.find(d => d.catalogId === 'c30'), STOP);
    expect(hit).not.toBeNull();
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

  // BIRLESIME bolunur, `max`'a degil. Ikisi yalnizca su durumda ayrisir: her IKI tarafta
  // da eslesmeyen kelime var. `max` bunu 0.5 sayip esigi gecirir, birlesim 0.33'e dusurur.
  // Gercek katalogda fark buyuk: gurultu ortancasi 3 -> 2, p90 7 -> 4, en cok 17 -> 8.
  it('iki tarafta da eslesmeyen kelime varsa skor duser', () => {
    // a = {vitamin, b12}, b = {vitamin, ad3e} -> paylasilan 1, birlesim 3
    const score = similarityScore('Vitamin B12', FIXTURE[8].name, STOP);
    expect(score).toBeCloseTo(1 / 3, 5);
    expect(score).toBeLessThan(SIMILARITY_THRESHOLD);
  });
});

describe('packageSignature', () => {
  it('basli basina sayilari imzaya alir', () => {
    expect(packageSignature('ARMAFLOR ENJEKSIYONLUK COZELTI 250 ML')).toBe('250');
  });

  it('kelime ICINDEKI sayiyi ambalaj sanmaz', () => {
    // "b12" bir etken madde adi; icindeki 12 ambalaj degil
    expect(packageSignature('Vitamin B12 Enjeksiyonluk')).toBe('');
    expect(packageSignature('AD3E Solüsyon')).toBe('');
  });

  it('carpim bicimini BOZMADAN tasir (× ve x ayni imza)', () => {
    expect(packageSignature('ADVANTİX 4×4 ML')).toBe('4x4');
    expect(packageSignature('ADVANTIX 4X4 ML')).toBe('4x4');
  });

  // 4 pipetlik kutu ile tek pipet ayni sey degil — parcalanip tekillestirilseydi olurdu
  it('4×4 ile 4 ayni imzayi ALMAZ', () => {
    expect(packageSignature('ADVANTİX 4×4 ML')).not.toBe(packageSignature('ADVANTİX 4 ML'));
  });

  // Katalogda ambalaj hem adda hem `unit`'te gecer; ayni kelime iki kez sayilmamali
  it('ad ve unit tekrari imzayi ikilemez', () => {
    expect(catalogPackageSignature({ name: 'Armaflor - 250 ml', unit: '250 ML' })).toBe('250');
  });

  it('yazim sirasi imzayi degistirmez', () => {
    expect(packageSignature('20/20 - 100 ml')).toBe(packageSignature('100 ml 20 20'));
  });

  it('katalog imzasi ad ambalaji tasimasa da `unit` alanindan kurulur', () => {
    expect(catalogPackageSignature({ name: 'REVERSAL', unit: '10 ML' })).toBe('10');
    expect(catalogPackageSignature({ name: 'REVERSAL' })).toBe('');
  });
});

describe('similarOwned', () => {
  // Duzeltmenin ASIL SEBEBI: eski surum bu kaydi bulamiyordu (tek fark bir tire)
  it('elle girilmis kaydi katalogdaki karsiligiyla eslestirir', () => {
    const hit = similarOwned(own('ARMAFLOR ENJEKSIYONLUK COZELTI 250 ML'), FIXTURE[1], STOP);
    expect(hit?.drug.name).toBe('ARMAFLOR ENJEKSIYONLUK COZELTI 250 ML');
  });

  it('kisaltmali yazim da eslesir (ENJ. SUSP. <-> Enjeksiyonluk Süspansiyon)', () => {
    expect(similarOwned(own('ARMAPEN LA ENJ. SÜSP. - 250 ML'), FIXTURE[3], STOP)).not.toBeNull();
  });

  // GURULTU OLCUMU — mutasyon denetiminin isiracagi iddia bu.
  // Stop listesi devre disi kalirsa "LA" katalogun onda birinde uyari tetikler.
  it('jenerik kisa ad HICBIR kayitla eslesmez', () => {
    const hits = FIXTURE.filter(d => similarOwned(own('LA'), d, STOP));
    expect(hits).toHaveLength(0);
  });

  // Katalogda "K" iki ayri sey: FITADINON K gercek K vitamini, BAYTRIL K'de marka soneki.
  // Tek harf, ayni olduklarini iddia etmeye yetmez. (Gercek katalogda 6 -> 0, "C" 10 -> 0.)
  it('tek harflik ad hicbir kayitla eslesmez', () => {
    // Once testin BOSTA calismadigini dogrula: fixture'da gercekten `k` tasiyan kayit var
    const kTasiyan = FIXTURE.filter(d => tokenizeName(d.name).includes('k'));
    expect(kTasiyan.length).toBeGreaterThan(1);

    const hits = FIXTURE.filter(d => similarOwned(own('K'), d, STOP));
    expect(hits).toHaveLength(0);
  });

  // Tek harf ayirt edici sayilsaydi AYNI urunun bedenleri farkli aile gorunurdu.
  // Gercek katalogda 57 dokuman bu yuzden ailesinden kopmustu (NEXGARD DOG S/M/L).
  it('tek harflik beden kodu ayni aileyi bolmez', () => {
    const s = FIXTURE.find(d => d.catalogId === 'c28');
    const m = FIXTURE.find(d => d.catalogId === 'c29');

    const hit = similarOwned(own(s.name), m, STOP);
    expect(hit).not.toBeNull();
    // Ambalaj imzalari farkli (11 vs 28), o yuzden GUCLU degil zayif not
    expect(hit.samePackage).toBe(false);
  });

  it('jenerik uzun ad yalnizca kendi ailesini isaretler', () => {
    const hits = FIXTURE.filter(d => similarOwned(own('Oksitosin'), d, STOP));
    expect(hits.map(h => h.catalogId)).toEqual(['c7']);
  });

  // TASK-039: eskiden `min`'e bolunuyordu, tek kelimelik ad her zaman 1.0 aliyordu ve
  // "Vitamin" katalogun her yerini isaretliyordu. (Gercek katalogda 11 -> 2.)
  //
  // c10 ("Vitamin B Kompleks") burada UYARIYOR ve bu bilincli bir odunlesim: tek harflik
  // "B" atilinca o kaydin ayirt edici kelimeleri {vitamin, kompleks}'e dusuyor, yani
  // jenerik "Vitamin"e yaklasiyor. Gercek katalogda bu tetiklenmiyor ("Vitamin" 2'de
  // kaliyor); alternatif — tek harfi paydada tutup paylasilan saymamak — ISABETI
  // %100'den %95,5'e dusurdugu icin reddedildi (bkz. TASK-039).
  it('yaygin tek kelimelik ad tum aileyi isaretlemez', () => {
    const hits = FIXTURE.filter(d => similarOwned(own('Vitamin'), d, STOP));

    expect(hits.map(h => h.catalogId)).toEqual(['c9', 'c10']); // yalnizca Vitamin adlilar
    expect(hits.length).toBeLessThan(FIXTURE.length / 10);     // katalogun geri kalani sessiz
  });

  it('tek jenerik kelime paylasan ad eslesmez', () => {
    expect(similarOwned(own('Vitamin B12'), FIXTURE[8], STOP)).toBeNull();
  });

  it('catalogId tasiyan kaydi dikkate almaz — kesin katman onu zaten goruyor', () => {
    const drugs = [{ id: 'd1', name: 'Armaflor Enjeksiyonluk Çözelti - 250 ml', catalogId: 'x' }];
    expect(similarOwned(drugs, FIXTURE[1], STOP)).toBeNull();
  });

  it('alakasiz kaydi benzer saymaz', () => {
    expect(similarOwned(own('Sarı Solüsyon'), FIXTURE[1], STOP)).toBeNull();
  });

  it('bos adli katalog kaydinda ve stop listesi yoksa null doner', () => {
    expect(similarOwned(own('X'), { name: '' }, STOP)).toBeNull();
    expect(similarOwned(own('X'), FIXTURE[1], null)).toBeNull();
  });
});

// TASK-039 B1: ambalaj duzeyi ayrimi. Amac uyari EKSILTMEK degil, guclu olani ayirmak.
describe('similarOwned — ambalaj gucu', () => {
  const ARMAFLOR_100 = FIXTURE[0];
  const ARMAFLOR_250 = FIXTURE[1];

  it('ayni ambalaj GUCLU isaretlenir', () => {
    const hit = similarOwned(own('ARMAFLOR ENJEKSIYONLUK COZELTI 250 ML'), ARMAFLOR_250, STOP);
    expect(hit.samePackage).toBe(true);
  });

  // Kritik: farkli ambalaj uyariyi SUSTURMAZ, yalnizca zayif not olur.
  // Susturulsaydi 100 ml eklerken listedeki 250 ml gorunmez olurdu.
  it('farkli ambalaj hala uyarir ama zayif kalir', () => {
    const hit = similarOwned(own('ARMAFLOR ENJEKSIYONLUK COZELTI 250 ML'), ARMAFLOR_100, STOP);
    expect(hit).not.toBeNull();
    expect(hit.samePackage).toBe(false);
  });

  it('imzasiz katalog kaydi asla GUCLU olmaz — bilinmeyen esitlik degildir', () => {
    const doc = { catalogId: 'x', name: 'Oksitosin Enjeksiyonluk Çözelti' }; // sayi yok
    const hit = similarOwned(own('Oksitosin'), doc, STOP);
    expect(hit).not.toBeNull();
    expect(hit.samePackage).toBe(false);
  });

  it('birden cok eslesmede ambalaji tutan tercih edilir', () => {
    const drugs = [
      { id: 'd1', name: 'ARMAFLOR ENJEKSIYONLUK COZELTI 100 ML' }, // once geliyor, zayif
      { id: 'd2', name: 'ARMAFLOR ENJEKSIYONLUK COZELTI 250 ML' }, // sonra geliyor, guclu
    ];
    const hit = similarOwned(drugs, ARMAFLOR_250, STOP);
    expect(hit.drug.id).toBe('d2');
    expect(hit.samePackage).toBe(true);
  });
});
