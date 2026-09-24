import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, deleteField, collection, query, where } from 'firebase/firestore';

/**
 * Guvenlik kurallarinin DAVRANIS testleri (BAKIM-002).
 *
 * `src/services/firestoreRules.test.js` kural DOSYASININ METNINI denetler — koleksiyon
 * kurala yazilmis mi, blanket kalip geri gelmis mi. Kuralin gercekte bir seyi reddedip
 * reddetmedigini SOYLEYEMEZ. Bu dosya onu soyler: gercek Firestore emulatorunde,
 * gercek istemci SDK'siyla.
 *
 * Neden onemli: sahiplik TASK-038'de `userId` esitliginden klinik UYELIGINE gecti.
 * A klinigi ile B kliniginin cari defteri arasinda duran tek sey o kural; oradaki hata
 * bug degil, odeme yapan musteriler arasinda veri sizintisi olur.
 *
 * Calistirma: `npm run test:rules` (Firestore emulatorunu kendisi baslatir, Java ister).
 * Normal `npm test` bu klasoru DISLAR — emulator olmadan calismaz.
 */

const PROJECT_ID = 'demo-vetcari'; // `demo-` oneki: emulator disina asla cikmaz
const OWNED = ['customers', 'drugs', 'serviceDebts', 'drugDebts', 'transactions'];
// Tahsilat geri alma supurulmus borcu ilk GIRENIN `userId`'siyle yeniden yaratir; bu
// koleksiyonlarda olusturmada "kendi adina" sarti bu yuzden YOK (bkz. `createdByMe`)
const DEBTS = ['serviceDebts', 'drugDebts'];

const KLINIK_A = 'klinik-a';
const KLINIK_B = 'klinik-b';
const ALI = 'ali-uid';            // KLINIK_A sahibi
const PERSONEL = 'personel-uid';  // KLINIK_A personeli, ALI'den farkli kisi
const VELI = 'veli-uid';          // KLINIK_B sahibi
const YABANCI = 'yabanci-uid';    // hicbir uyeligi yok

let testEnv;

beforeAll(async () => {
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host, port: Number(port) },
  });
});

afterAll(async () => { await testEnv?.cleanup(); });
beforeEach(async () => { await testEnv.clearFirestore(); });

const asAli = () => testEnv.authenticatedContext(ALI).firestore();
const asPersonel = () => testEnv.authenticatedContext(PERSONEL).firestore();
const asVeli = () => testEnv.authenticatedContext(VELI).firestore();
const asYabanci = () => testEnv.authenticatedContext(YABANCI).firestore();
const asAnon = () => testEnv.unauthenticatedContext().firestore();

/** Kurallari baypas ederek tohum verisi yazar (test kurulumu, kural sinamasi degil). */
const seed = (path, data) =>
  testEnv.withSecurityRulesDisabled(ctx => setDoc(doc(ctx.firestore(), path), data));

/**
 * Iki klinik, her birinde bir sahip; A'da ayrica personel.
 *
 * VELI'nin BASKA bir klinikte uyeligi OLMALI. Olmasaydi "baska klinigin uyesi okuyamaz"
 * iddialari yanlis sebepten gecerdi (uye olmadigi icin reddedilir) ve kural "her uye her
 * klinigi okur"a gevsetilse bile testler yesil kalirdi.
 */
const klinikleriKur = async () => {
  await seed(`memberships/${ALI}`, { clinicId: KLINIK_A, role: 'owner' });
  await seed(`memberships/${PERSONEL}`, { clinicId: KLINIK_A, role: 'staff' });
  await seed(`memberships/${VELI}`, { clinicId: KLINIK_B, role: 'owner' });
  await seed(`clinics/${KLINIK_A}`, { name: 'A Klinigi', ownerId: ALI, seatLimit: 2 });
};

/** Uygulamanin yazdigi sekil: `userId` = giren kisi, `clinicId` = defter. */
const kayit = (over = {}) => ({ userId: ALI, clinicId: KLINIK_A, name: 'x', ...over });

describe('Sahipli koleksiyonlar — okuma', () => {
  beforeEach(klinikleriKur);

  for (const col of OWNED) {
    it(`${col}: klinigin uyesi kaydi OKUR`, async () => {
      await seed(`${col}/d1`, kayit());
      await assertSucceeds(getDoc(doc(asAli(), `${col}/d1`)));
    });

    it(`${col}: ayni klinigin BASKA uyesi de okur — isin butun amaci`, async () => {
      await seed(`${col}/d1`, kayit());
      await assertSucceeds(getDoc(doc(asPersonel(), `${col}/d1`)));
    });

    it(`${col}: BASKA klinigin uyesi okuyamaz`, async () => {
      await seed(`${col}/d1`, kayit());
      await assertFails(getDoc(doc(asVeli(), `${col}/d1`)));
    });

    it(`${col}: uyeligi olmayan kullanici okuyamaz`, async () => {
      await seed(`${col}/d1`, kayit());
      await assertFails(getDoc(doc(asYabanci(), `${col}/d1`)));
    });

    it(`${col}: kimlik dogrulanmamis kullanici okuyamaz`, async () => {
      await seed(`${col}/d1`, kayit());
      await assertFails(getDoc(doc(asAnon(), `${col}/d1`)));
    });
  }
});

describe('Sahipli koleksiyonlar — yazma', () => {
  beforeEach(klinikleriKur);

  for (const col of OWNED) {
    it(`${col}: kendi kliniginin clinicId'siyle OLUSTURUR`, async () => {
      await assertSucceeds(setDoc(doc(asAli(), `${col}/yeni`), kayit()));
    });

    it(`${col}: BASKA klinigin clinicId'siyle olusturamaz — enjeksiyon`, async () => {
      await assertFails(setDoc(doc(asAli(), `${col}/yeni`), kayit({ clinicId: KLINIK_B })));
    });

    it(`${col}: uyeligi olmayan kullanici HICBIR klinige yazamaz`, async () => {
      await assertFails(setDoc(doc(asYabanci(), `${col}/yeni`), kayit({ userId: YABANCI })));
    });

    it(`${col}: uyesi gunceller`, async () => {
      await seed(`${col}/d1`, kayit());
      await assertSucceeds(updateDoc(doc(asAli(), `${col}/d1`), { name: 'y' }));
    });

    // Rol kisitlari (personel musteri/ilac silemez) `invites.rules.test.js`'te sinaniyor
    it(`${col}: sahip siler`, async () => {
      await seed(`${col}/d1`, kayit());
      await assertSucceeds(deleteDoc(doc(asAli(), `${col}/d1`)));
    });

    it(`${col}: BASKA klinigin uyesi guncelleyemez/silemez`, async () => {
      await seed(`${col}/d1`, kayit());
      await assertFails(updateDoc(doc(asVeli(), `${col}/d1`), { name: 'y' }));
      await assertFails(deleteDoc(doc(asVeli(), `${col}/d1`)));
    });
  }
});

/**
 * 6. ASAMA — eski `userId` yolu KAPALI (TASK-038a, 2026-09-24).
 *
 * Gecis doneminde `userId == request.auth.uid` tek basina erisim veriyordu ve uyelik
 * aramiyordu. Kaldirildi; buradaki her test o yolun artik HICBIR seye izin vermedigini
 * sinar. Cikarilan personel senaryosunun tamami `invites.rules.test.js`'te.
 */
describe('Eski userId yolu kapali (6. asama)', () => {
  beforeEach(klinikleriKur);

  for (const col of OWNED) {
    // Asama 6'nin ana iddiasi: `userId` kendi uid'i olsa bile `clinicId`'siz kayit yok
    it(`${col}: clinicId'siz OLUSTURULAMAZ — userId kendi uid'i olsa bile`, async () => {
      await assertFails(setDoc(doc(asAli(), `${col}/yeni`), { userId: ALI, name: 'x' }));
    });

    it(`${col}: uyeligi olmayan hesap clinicId'siz kayit YARATAMAZ`, async () => {
      await assertFails(setDoc(doc(asYabanci(), `${col}/yeni`), { userId: YABANCI, name: 'x' }));
    });

    // Gecis doneminde bu kayit sahibine acikti ("goc henuz damgalamadi"). Uretimde
    // damgasiz dokuman 0 olculdu; boyle bir kayit artik yalnizca Admin SDK ile duzeltilir.
    it(`${col}: clinicId tasimayan kayit sahibine bile KAPALI`, async () => {
      await seed(`${col}/eski`, { userId: ALI, name: 'Goc oncesi' });
      await assertFails(getDoc(doc(asAli(), `${col}/eski`)));
      await assertFails(updateDoc(doc(asAli(), `${col}/eski`), { name: 'y' }));
      await assertFails(deleteDoc(doc(asAli(), `${col}/eski`)));
    });

    // Uyelik yokken `userId` esitligi tek basina bir sey kazandirmamali
    it(`${col}: uyeligi olmayan kullanici userId'si kendisi olan kaydi okuyamaz/silemez`, async () => {
      await seed(`${col}/d1`, kayit({ userId: YABANCI }));
      await assertFails(getDoc(doc(asYabanci(), `${col}/d1`)));
      await assertFails(deleteDoc(doc(asYabanci(), `${col}/d1`)));
    });
  }
});

/**
 * `clinicId` ve `userId` — kayit ne defter degistirebilir ne de atif.
 *
 * BAKIM-002'de bulunan acik: kendi kaydinin sahibini baskasina cevirip ONUN defterine
 * kayit enjekte etmek. Klinik modelinde defteri `clinicId` belirliyor; enjeksiyonun
 * karsiligi onu degistirmek. `userId` ise artik "kim girdi" — yeniden yazilabilseydi
 * yalnizca istemcide duran rol kisitlarinin tek korumasi olan atif da kalmazdi.
 */
describe('Defter ve atif degistirilemez', () => {
  beforeEach(klinikleriKur);

  for (const col of OWNED) {
    it(`${col}: kaydin clinicId'sini BASKA klinige cevirmek reddedilir`, async () => {
      await seed(`${col}/d1`, kayit());
      await assertFails(updateDoc(doc(asAli(), `${col}/d1`), { clinicId: KLINIK_B }));
    });

    it(`${col}: clinicId'yi SILMEK reddedilir — kayit defterden kaybolurdu`, async () => {
      await seed(`${col}/d1`, kayit());
      await assertFails(updateDoc(doc(asAli(), `${col}/d1`), { clinicId: deleteField() }));
    });

    // Ayni klinik icinde bile: reddin sebebi klinik degil atif olmali
    it(`${col}: userId'yi ayni klinigin BASKA uyesine cevirmek reddedilir`, async () => {
      await seed(`${col}/d1`, kayit());
      await assertFails(updateDoc(doc(asAli(), `${col}/d1`), { userId: PERSONEL }));
    });

    it(`${col}: setDoc ile atif devri de reddedilir`, async () => {
      await seed(`${col}/d1`, kayit());
      await assertFails(setDoc(doc(asAli(), `${col}/d1`), kayit({ userId: PERSONEL })));
    });

    it(`${col}: personel, sahibin girdigi kaydi gunceller — atif sahipte kalir`, async () => {
      await seed(`${col}/d1`, kayit());
      await assertSucceeds(updateDoc(doc(asPersonel(), `${col}/d1`), { name: 'y' }));
    });
  }

  // Musteri, ilac ve islem logu her zaman o an, islemi yapanin adiyla yaratilir
  for (const col of OWNED.filter(c => !DEBTS.includes(c))) {
    it(`${col}: BASKASI adina OLUSTURULAMAZ`, async () => {
      await assertFails(setDoc(doc(asAli(), `${col}/yeni`), kayit({ userId: PERSONEL })));
    });
  }

  // `revertPaymentOperations` borcu `set(ref, before)` ile geri yazar; `snapshotOf` yalnizca
  // `id` ve `rev` siler, `userId` korunur, `clinicId` oturumdan damgalanir.
  for (const col of DEBTS) {
    it(`${col}: geri alma — yasayan borca tam dokuman set CALISIR`, async () => {
      await seed(`${col}/d1`, kayit({ userId: PERSONEL, amount: 100 }));
      const before = kayit({ userId: PERSONEL, amount: 300 });
      await assertSucceeds(setDoc(doc(asAli(), `${col}/d1`), { ...before, rev: Date.now() }));
    });

    // Sahip, personelin girdigi ve tahsilatin supurdugu borcu geri getiriyor
    it(`${col}: geri alma — supurulmus borcu ilk GIRENIN userId'siyle yeniden yaratir`, async () => {
      const before = kayit({ userId: PERSONEL, amount: 300 });
      await assertSucceeds(setDoc(doc(asAli(), `${col}/supurulmus`), { ...before, rev: Date.now() }));
    });

    // Goc oncesi `before` clinicId tasimiyordu; istemci damgalamasaydi kural reddetmeli
    it(`${col}: geri alma — clinicId'siz before REDDEDILIR`, async () => {
      const { clinicId: _c, ...before } = kayit({ userId: PERSONEL, amount: 300 });
      await assertFails(setDoc(doc(asAli(), `${col}/supurulmus`), { ...before, rev: Date.now() }));
    });
  }
});

describe('Sorgu (list) davranisi — useFirestore bunun uzerine kurulu', () => {
  beforeEach(klinikleriKur);

  it('clinicId filtreli sorgu CALISIR', async () => {
    await seed('customers/d1', kayit());
    const q = query(collection(asAli(), 'customers'), where('clinicId', '==', KLINIK_A));
    await assertSucceeds(getDocs(q));
  });

  it('personel de klinigin sorgusunu calistirir', async () => {
    await seed('customers/d1', kayit());
    const q = query(collection(asPersonel(), 'customers'), where('clinicId', '==', KLINIK_A));
    await assertSucceeds(getDocs(q));
  });

  it('filtresiz koleksiyon sorgusu REDDEDILIR', async () => {
    await seed('customers/d1', kayit());
    await assertFails(getDocs(collection(asAli(), 'customers')));
  });

  it('BASKA klinigin clinicId sorgusu reddedilir', async () => {
    await seed('customers/d1', kayit({ userId: VELI, clinicId: KLINIK_B }));
    const q = query(collection(asAli(), 'customers'), where('clinicId', '==', KLINIK_B));
    await assertFails(getDocs(q));
  });

  // Gecis doneminin sorgusu. Istemcide artik yok (`src/`'de 0 eslesme); kural da reddetmeli
  it('userId filtreli sorgu REDDEDILIR — kendi uid ile bile', async () => {
    await seed('customers/d1', kayit());
    const q = query(collection(asAli(), 'customers'), where('userId', '==', ALI));
    await assertFails(getDocs(q));
  });
});

describe('memberships / clinics — yetkilendirmenin dayanagi, salt okunur', () => {
  beforeEach(klinikleriKur);

  it('kendi uyeligini okur', async () => {
    await assertSucceeds(getDoc(doc(asAli(), `memberships/${ALI}`)));
  });

  // VELI'nin kendi uyeligi VAR; yine de ALI'ninkini goremez
  it('BASKASININ uyeligini okuyamaz', async () => {
    await assertSucceeds(getDoc(doc(asVeli(), `memberships/${VELI}`)));
    await assertFails(getDoc(doc(asVeli(), `memberships/${ALI}`)));
  });

  // En kritik yazma kisiti: acik olsaydi kullanici kendini istedigi klinige uye yapardi
  it('kendine uyelik YAZAMAZ — yetkilendirmenin anahtari istemcide degil', async () => {
    await assertFails(setDoc(doc(asVeli(), `memberships/${VELI}`), { clinicId: KLINIK_A, role: 'owner' }));
    await assertFails(updateDoc(doc(asAli(), `memberships/${ALI}`), { role: 'owner' }));
    await assertFails(deleteDoc(doc(asAli(), `memberships/${ALI}`)));
  });

  // TASK-038b ile `clinics` okunabilir oldu (arayuz klinik adini ve koltuk sayisini
  // gosteriyor). Yazma Admin SDK'da kaldi: koltuk sinirini kullanici kendisi degistiremez.
  it('uyesi kendi klinigini OKUR, yazamaz', async () => {
    await assertSucceeds(getDoc(doc(asAli(), `clinics/${KLINIK_A}`)));
    await assertFails(updateDoc(doc(asAli(), `clinics/${KLINIK_A}`), { seatLimit: 99 }));
    await assertFails(setDoc(doc(asAli(), 'clinics/yeni'), { name: 'sahte' }));
  });

  it('BASKA klinigi okuyamaz', async () => {
    await seed('clinics/baska-klinik', { name: 'B', ownerId: VELI, seatLimit: 2 });
    await assertFails(getDoc(doc(asAli(), 'clinics/baska-klinik')));
  });
});

/**
 * TASK-033'ten gelen dal. Kural `resource.data`ya kosulsuz dokunsaydi, VAR OLMAYAN bir
 * dokumani okumak `permission-denied` dondururdu ve cagiran taraf "silinmis mi" sorusunu
 * soramazdi. `rev` surum kontrolu ve geri alma yollari bu davranisa dayaniyor.
 */
describe('resource == null dali (TASK-033)', () => {
  beforeEach(klinikleriKur);

  it('var olmayan dokumani okumak BASARILI olur ve exists=false doner', async () => {
    const snap = await assertSucceeds(getDoc(doc(asAli(), 'drugDebts/hicyok')));
    expect(snap.exists()).toBe(false);
  });

  it('var olmayan dokumani GUNCELLEMEK yine de reddedilir', async () => {
    await assertFails(updateDoc(doc(asAli(), 'drugDebts/hicyok'), { name: 'y' }));
  });

  it('kimlik dogrulanmamis kullanici var olmayan dokumani da okuyamaz', async () => {
    await assertFails(getDoc(doc(asAnon(), 'drugDebts/hicyok')));
  });
});

describe('drugCatalog — ortak, salt okunur (TASK-037)', () => {
  it('kimligi dogrulanmis kullanici OKUR', async () => {
    await seed('drugCatalog/k1', { name: 'Armaflor', catalogId: 'k1' });
    await assertSucceeds(getDoc(doc(asAli(), 'drugCatalog/k1')));
  });

  it('filtresiz katalog sorgusu da CALISIR — sahipsiz koleksiyon', async () => {
    await seed('drugCatalog/k1', { name: 'Armaflor', catalogId: 'k1' });
    await assertSucceeds(getDocs(collection(asAli(), 'drugCatalog')));
  });

  it('kimlik dogrulanmamis kullanici okuyamaz', async () => {
    await seed('drugCatalog/k1', { name: 'Armaflor', catalogId: 'k1' });
    await assertFails(getDoc(doc(asAnon(), 'drugCatalog/k1')));
  });

  // Yazma acik kalsaydi herhangi bir veteriner TUM kliniklerin katalogunu degistirebilirdi
  it('hicbir istemci YAZAMAZ (olusturma/guncelleme/silme)', async () => {
    await assertFails(setDoc(doc(asAli(), 'drugCatalog/yeni'), { name: 'sahte' }));

    await seed('drugCatalog/k1', { name: 'Armaflor', catalogId: 'k1' });
    await assertFails(updateDoc(doc(asAli(), 'drugCatalog/k1'), { name: 'degistirildi' }));
    await assertFails(deleteDoc(doc(asAli(), 'drugCatalog/k1')));
  });
});

/**
 * Blanket `match /{collection}/{docId}` kaldirilmasinin CANLI kaniti.
 * Eskiden kimligi dogrulanmis bir kullanici, `userId` alanini kendi uid'iyle doldurdugu
 * surece istedigi adda koleksiyon olusturup veri yazabiliyordu.
 */
describe('Kurala yazilmamis koleksiyon', () => {
  beforeEach(klinikleriKur);

  it('kendi userId ve clinicId ile bile YAZILAMAZ', async () => {
    await assertFails(setDoc(doc(asAli(), 'rastgeleKoleksiyon/d1'), kayit()));
  });

  it('OKUNAMAZ', async () => {
    await seed('rastgeleKoleksiyon/d1', kayit());
    await assertFails(getDoc(doc(asAli(), 'rastgeleKoleksiyon/d1')));
  });
});
