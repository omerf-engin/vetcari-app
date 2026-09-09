import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, query, where } from 'firebase/firestore';

/**
 * Guvenlik kurallarinin DAVRANIS testleri (BAKIM-002).
 *
 * `src/services/firestoreRules.test.js` kural DOSYASININ METNINI denetler — koleksiyon
 * kurala yazilmis mi, blanket kalip geri gelmis mi. Kuralin gercekte bir seyi reddedip
 * reddetmedigini SOYLEYEMEZ. Bu dosya onu soyler: gercek Firestore emulatorunde,
 * gercek istemci SDK'siyla.
 *
 * Neden onemli: TASK-038'de sahiplik kurali `userId` esitliginden `memberships`
 * varligina gececek. A klinigi ile B kliniginin cari defteri arasinda duran tek sey
 * o satir; oradaki hata bug degil, odeme yapan musteriler arasinda veri sizintisi olur.
 *
 * Calistirma: `npm run test:rules` (Firestore emulatorunu kendisi baslatir, Java ister).
 * Normal `npm test` bu klasoru DISLAR — emulator olmadan calismaz.
 */

const PROJECT_ID = 'demo-vetcari'; // `demo-` oneki: emulator disina asla cikmaz
const OWNED = ['customers', 'drugs', 'serviceDebts', 'drugDebts', 'transactions'];

const ALI = 'ali-uid';
const VELI = 'veli-uid';

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
const asVeli = () => testEnv.authenticatedContext(VELI).firestore();
const asAnon = () => testEnv.unauthenticatedContext().firestore();

/** Kurallari baypas ederek tohum verisi yazar (test kurulumu, kural sinamasi degil). */
const seed = (path, data) =>
  testEnv.withSecurityRulesDisabled(ctx => setDoc(doc(ctx.firestore(), path), data));

describe('Sahipli koleksiyonlar — okuma', () => {
  for (const col of OWNED) {
    it(`${col}: sahibi kendi kaydini OKUR`, async () => {
      await seed(`${col}/d1`, { userId: ALI, name: 'x' });
      await assertSucceeds(getDoc(doc(asAli(), `${col}/d1`)));
    });

    it(`${col}: BASKASININ kaydini okuyamaz`, async () => {
      await seed(`${col}/d1`, { userId: ALI, name: 'x' });
      await assertFails(getDoc(doc(asVeli(), `${col}/d1`)));
    });

    it(`${col}: kimlik dogrulanmamis kullanici okuyamaz`, async () => {
      await seed(`${col}/d1`, { userId: ALI, name: 'x' });
      await assertFails(getDoc(doc(asAnon(), `${col}/d1`)));
    });
  }
});

describe('Sahipli koleksiyonlar — yazma', () => {
  for (const col of OWNED) {
    it(`${col}: kendi userId'siyle OLUSTURUR`, async () => {
      await assertSucceeds(setDoc(doc(asAli(), `${col}/yeni`), { userId: ALI, name: 'x' }));
    });

    // `canCreateOwned` request.resource.data.userId'ye bakar: baskasinin defterine
    // kayit ENJEKTE edilemez. Cok kiracili urunde en kritik yazma kurali bu.
    it(`${col}: BASKASININ userId'siyle olusturamaz`, async () => {
      await assertFails(setDoc(doc(asAli(), `${col}/yeni`), { userId: VELI, name: 'x' }));
    });

    it(`${col}: userId'siz olusturamaz`, async () => {
      await assertFails(setDoc(doc(asAli(), `${col}/yeni`), { name: 'x' }));
    });

    it(`${col}: sahibi gunceller ve siler`, async () => {
      await seed(`${col}/d1`, { userId: ALI, name: 'x' });
      await assertSucceeds(updateDoc(doc(asAli(), `${col}/d1`), { name: 'y' }));
      await assertSucceeds(deleteDoc(doc(asAli(), `${col}/d1`)));
    });

    it(`${col}: BASKASININ kaydini guncelleyemez/silemez`, async () => {
      await seed(`${col}/d1`, { userId: ALI, name: 'x' });
      await assertFails(updateDoc(doc(asVeli(), `${col}/d1`), { name: 'y' }));
      await assertFails(deleteDoc(doc(asVeli(), `${col}/d1`)));
    });
  }
});

/**
 * BAKIM-002'de bu paket yazilirken BULUNAN acik.
 *
 * Kural once yalnizca MEVCUT dokumanin sahibine bakiyordu; kendi kaydinin `userId`
 * alanini baskasinin uid'i yapmak serbestti, yani A klinigi B'nin defterine sahte borc
 * ENJEKTE edebiliyordu. Veri sizintisi degil (B'nin kayitlari hala okunamiyor) ama bir
 * muhasebe urununde kabul edilemez. `canUpdateOwned` eski VE yeni sahibi birlikte arar.
 */
describe('Sahiplik devri — enjeksiyon acigi (BAKIM-002)', () => {
  for (const col of OWNED) {
    it(`${col}: kendi kaydinin userId'sini BASKASINA cevirmek reddedilir`, async () => {
      await seed(`${col}/d1`, { userId: ALI, name: 'x' });
      await assertFails(updateDoc(doc(asAli(), `${col}/d1`), { userId: VELI }));
    });

    it(`${col}: setDoc ile sahiplik devri de reddedilir`, async () => {
      await seed(`${col}/d1`, { userId: ALI, name: 'x' });
      await assertFails(setDoc(doc(asAli(), `${col}/d1`), { userId: VELI, name: 'x' }));
    });
  }

  it('kendi userId sabit kalarak guncelleme CALISMAYA devam eder', async () => {
    await seed('drugDebts/d1', { userId: ALI, amount: 100 });
    await assertSucceeds(updateDoc(doc(asAli(), 'drugDebts/d1'), { amount: 200 }));
  });

  // `revertPaymentOperations` borcu `set(ref, before)` ile geri yazar; `snapshotOf`
  // yalnizca `id` ve `rev` siler, `userId` korunur. Sikilastirma bu yolu kirmamali.
  it('geri alma yolu (tam dokuman set) userId korundugu icin calisir', async () => {
    await seed('drugDebts/d1', { userId: ALI, amount: 100, customerId: 'm1' });
    const before = { userId: ALI, amount: 100, customerId: 'm1' };
    await assertSucceeds(setDoc(doc(asAli(), 'drugDebts/d1'), { ...before, rev: Date.now() }));
  });
});

describe('Sorgu (list) davranisi — useFirestore bunun uzerine kurulu', () => {
  it('userId filtreli sorgu CALISIR', async () => {
    await seed('customers/d1', { userId: ALI, name: 'x' });
    const q = query(collection(asAli(), 'customers'), where('userId', '==', ALI));
    await assertSucceeds(getDocs(q));
  });

  it('filtresiz koleksiyon sorgusu REDDEDILIR', async () => {
    await seed('customers/d1', { userId: ALI, name: 'x' });
    await assertFails(getDocs(collection(asAli(), 'customers')));
  });

  it('BASKASININ userId sorgusu reddedilir', async () => {
    await seed('customers/d1', { userId: VELI, name: 'x' });
    const q = query(collection(asAli(), 'customers'), where('userId', '==', VELI));
    await assertFails(getDocs(q));
  });
});

/**
 * TASK-033'ten gelen dal. Kural `resource.data.userId`'ye kosulsuz dokunsaydi, VAR OLMAYAN
 * bir dokumani okumak `permission-denied` dondururdu ve cagiran taraf "silinmis mi"
 * sorusunu soramazdi. `rev` surum kontrolu ve geri alma yollari bu davranisa dayaniyor.
 */
describe('resource == null dali (TASK-033)', () => {
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
  it('kendi userId ile bile YAZILAMAZ', async () => {
    await assertFails(setDoc(doc(asAli(), 'rastgeleKoleksiyon/d1'), { userId: ALI }));
  });

  it('OKUNAMAZ', async () => {
    await seed('rastgeleKoleksiyon/d1', { userId: ALI });
    await assertFails(getDoc(doc(asAli(), 'rastgeleKoleksiyon/d1')));
  });
});
