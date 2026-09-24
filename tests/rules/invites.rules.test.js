import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, query, where } from 'firebase/firestore';

/**
 * DAVET, KATILMA ve ROLLER — guvenlik kurallari davranis testleri (TASK-038b).
 *
 * Bu dosya defterin ANAHTARINI sinar: `memberships` create artik istemciye acik. Her test
 * bir saldiriya karsilik geliyor — davetsiz girme, davetle `owner` olma, baska klinige
 * atlama, sahip olmadan davet etme, sahibin kendini atmasi.
 *
 * Ayri dosyada, cunku bu bolum kimlik dogrulama TOKEN'ina (e-posta) dayaniyor ve digerinden
 * bagimsiz okunabilmeli.
 */

const PROJECT_ID = 'demo-vetcari-davet';

const KLINIK_A = 'klinik-a';
const KLINIK_B = 'klinik-b';
const SAHIP = 'sahip-uid';
const PERSONEL = 'personel-uid';
const YENI = 'yeni-uid';
const B_SAHIBI = 'b-sahibi-uid';

let testEnv;

beforeAll(async () => {
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host, port: Number(port) },
  });
});
afterAll(async () => { await testEnv?.cleanup(); });

const seed = (path, data) =>
  testEnv.withSecurityRulesDisabled(ctx => setDoc(doc(ctx.firestore(), path), data));

// E-posta token'i SART: kural daveti `request.auth.token.email.lower()` ile buluyor
const as = (uid, email) => testEnv.authenticatedContext(uid, { email }).firestore();
const sahip = () => as(SAHIP, 'sahip@ornek.com');
const personel = () => as(PERSONEL, 'personel@ornek.com');
const yeni = () => as(YENI, 'yeni@ornek.com');
const bSahibi = () => as(B_SAHIBI, 'b@ornek.com');

const davet = (over = {}) =>
  ({ email: 'yeni@ornek.com', clinicId: KLINIK_A, role: 'staff', createdBy: SAHIP, ...over });

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed(`memberships/${SAHIP}`, { clinicId: KLINIK_A, role: 'owner' });
  await seed(`memberships/${PERSONEL}`, { clinicId: KLINIK_A, role: 'staff' });
  await seed(`memberships/${B_SAHIBI}`, { clinicId: KLINIK_B, role: 'owner' });
  await seed(`clinics/${KLINIK_A}`, { name: 'A Klinigi', ownerId: SAHIP, seatLimit: 2 });
});

describe('Davet olusturma', () => {
  it('sahip kendi klinigine staff daveti olusturur', async () => {
    await assertSucceeds(setDoc(doc(sahip(), 'invites/yeni@ornek.com'), davet()));
  });

  it('PERSONEL davet edemez', async () => {
    await assertFails(setDoc(doc(personel(), 'invites/yeni@ornek.com'), davet({ createdBy: PERSONEL })));
  });

  it('sahip BASKA klinige davet edemez', async () => {
    await assertFails(setDoc(doc(sahip(), 'invites/yeni@ornek.com'), davet({ clinicId: KLINIK_B })));
  });

  // `role` serbest olsaydi sahip birini `owner` davet edip yetki dagitirdi
  it('owner rolunde davet OLUSTURULAMAZ', async () => {
    await assertFails(setDoc(doc(sahip(), 'invites/yeni@ornek.com'), davet({ role: 'owner' })));
  });

  // Dokuman kimligi ile icerideki e-posta ayrisirsa, X'e gonderilen davetle Y katilirdi
  it('dokuman kimligi ile e-posta alani ayrisamaz', async () => {
    await assertFails(setDoc(doc(sahip(), 'invites/yeni@ornek.com'), davet({ email: 'baskasi@ornek.com' })));
  });
});

describe('Daveti gorme', () => {
  beforeEach(async () => { await seed('invites/yeni@ornek.com', davet()); });

  it('davetli KENDI davetini okur', async () => {
    await assertSucceeds(getDoc(doc(yeni(), 'invites/yeni@ornek.com')));
  });

  // E-posta yazim farki akisi kirmamali (kural `.lower()` kullaniyor)
  it('BUYUK harfli e-posta ile giren de kendi davetini bulur', async () => {
    await assertSucceeds(getDoc(doc(as(YENI, 'Yeni@Ornek.COM'), 'invites/yeni@ornek.com')));
  });

  it('sahip kendi kliniginin davetlerini gorur', async () => {
    await assertSucceeds(getDoc(doc(sahip(), 'invites/yeni@ornek.com')));
  });

  it('BASKA klinigin sahibi goremez', async () => {
    await assertFails(getDoc(doc(bSahibi(), 'invites/yeni@ornek.com')));
  });

  it('ilgisiz kullanici baskasinin davetini goremez', async () => {
    await assertFails(getDoc(doc(as('ilgisiz', 'ilgisiz@ornek.com'), 'invites/yeni@ornek.com')));
  });
});

describe('Katilma — defterin anahtari', () => {
  beforeEach(async () => { await seed('invites/yeni@ornek.com', davet()); });

  it('daveti olan KENDI uyeligini olusturur', async () => {
    await assertSucceeds(setDoc(doc(yeni(), `memberships/${YENI}`), { clinicId: KLINIK_A, role: 'staff' }));
  });

  it('DAVETSIZ kullanici uyelik olusturamaz', async () => {
    await assertFails(setDoc(doc(as('davetsiz', 'davetsiz@ornek.com'), 'memberships/davetsiz'),
      { clinicId: KLINIK_A, role: 'staff' }));
  });

  // En kritik yukseltme denemesi
  it('davetle OWNER olunamaz', async () => {
    await assertFails(setDoc(doc(yeni(), `memberships/${YENI}`), { clinicId: KLINIK_A, role: 'owner' }));
  });

  // SAVUNMANIN IKINCI KATMANI. Davet kurali `role: 'owner'` yazilmasini engelliyor ama
  // Admin SDK (goc scripti, elle mudahale) o kuraldan GECMEZ. Uyelik kurali bu yuzden
  // rolu AYRICA 'staff' diye sabitliyor; yoksa boyle bir davet owner yaratirdi.
  it('Admin SDK ile yazilmis OWNER daveti bile owner uyeligi yaratamaz', async () => {
    await seed('invites/yeni@ornek.com', davet({ role: 'owner' }));
    await assertFails(setDoc(doc(yeni(), `memberships/${YENI}`), { clinicId: KLINIK_A, role: 'owner' }));
  });

  it('davetteki disinda bir klinige katilamaz', async () => {
    await assertFails(setDoc(doc(yeni(), `memberships/${YENI}`), { clinicId: KLINIK_B, role: 'staff' }));
  });

  it('BASKASI adina uyelik olusturamaz', async () => {
    await assertFails(setDoc(doc(yeni(), 'memberships/baskasi-uid'), { clinicId: KLINIK_A, role: 'staff' }));
  });

  // Guncelleme kapali: personel sonradan kendini owner yapamasin
  it('mevcut uyeligin rolu GUNCELLENEMEZ', async () => {
    await assertFails(updateDoc(doc(personel(), `memberships/${PERSONEL}`), { role: 'owner' }));
  });
});

describe('Personel cikarma ve davet iptali', () => {
  it('sahip personeli cikarir', async () => {
    await assertSucceeds(deleteDoc(doc(sahip(), `memberships/${PERSONEL}`)));
  });

  // Sahip kendini atabilseydi klinik sahipsiz kalir, kimse davet edemezdi
  it('sahip KENDINI cikaramaz', async () => {
    await assertFails(deleteDoc(doc(sahip(), `memberships/${SAHIP}`)));
  });

  it('personel kimseyi cikaramaz', async () => {
    await assertFails(deleteDoc(doc(personel(), `memberships/${SAHIP}`)));
  });

  it('baska klinigin sahibi cikaramaz', async () => {
    await assertFails(deleteDoc(doc(bSahibi(), `memberships/${PERSONEL}`)));
  });


  // Katildiktan sonra davet dokumaninin kalmasi, sahibin "bekleyen davetler" listesinde
  // katilmis birini gosterirdi. Davetli kendi davetini silebilir — yetki genislemesi degil,
  // kisi yalnizca kendi katilma hakkini kaybeder.
  it('davetli KENDI davetini silebilir', async () => {
    await seed('invites/yeni@ornek.com', davet());
    await assertSucceeds(deleteDoc(doc(yeni(), 'invites/yeni@ornek.com')));
  });

  it('BASKASININ davetini silemez', async () => {
    await seed('invites/yeni@ornek.com', davet());
    await assertFails(deleteDoc(doc(as('ilgisiz', 'ilgisiz@ornek.com'), 'invites/yeni@ornek.com')));
  });
  it('sahip daveti iptal eder, personel edemez', async () => {
    await seed('invites/yeni@ornek.com', davet());
    await assertFails(deleteDoc(doc(personel(), 'invites/yeni@ornek.com')));
    await assertSucceeds(deleteDoc(doc(sahip(), 'invites/yeni@ornek.com')));
  });
});

describe('Sahip personel listesini gorur', () => {
  it('sahip kendi kliniginin uyeliklerini sorgular', async () => {
    await assertSucceeds(getDocs(query(collection(sahip(), 'memberships'), where('clinicId', '==', KLINIK_A))));
  });

  it('personel uyelik listesini sorgulayamaz', async () => {
    await assertFails(getDocs(query(collection(personel(), 'memberships'), where('clinicId', '==', KLINIK_A))));
  });

  it('sahip BASKA klinigin listesini sorgulayamaz', async () => {
    await assertFails(getDocs(query(collection(sahip(), 'memberships'), where('clinicId', '==', KLINIK_B))));
  });
});

describe('Rol tabanli yazma kisitlari', () => {
  beforeEach(async () => {
    await seed('customers/m1', { clinicId: KLINIK_A, userId: SAHIP, name: 'Musteri' });
    await seed('drugs/i1', { clinicId: KLINIK_A, userId: SAHIP, name: 'Ilac', price: 100 });
  });

  it('personel musteri SILEMEZ, sahip siler', async () => {
    await assertFails(deleteDoc(doc(personel(), 'customers/m1')));
    await assertSucceeds(deleteDoc(doc(sahip(), 'customers/m1')));
  });

  it('personel ilac SILEMEZ, sahip siler', async () => {
    await assertFails(deleteDoc(doc(personel(), 'drugs/i1')));
    await assertSucceeds(deleteDoc(doc(sahip(), 'drugs/i1')));
  });

  it('personel FIYAT degistiremez, sahip degistirir', async () => {
    await assertFails(updateDoc(doc(personel(), 'drugs/i1'), { price: 200 }));
    await assertSucceeds(updateDoc(doc(sahip(), 'drugs/i1'), { price: 200 }));
  });

  // Kisit yalnizca FIYATA: personel gunluk isini yapabilmeli
  it('personel fiyat DISINDAKI alani guncelleyebilir', async () => {
    await assertSucceeds(updateDoc(doc(personel(), 'drugs/i1'), { name: 'Ilac (duzeltildi)' }));
  });

  it('personel musteri ve borc EKLEYEBILIR — gunluk is kisitlanmadi', async () => {
    await assertSucceeds(setDoc(doc(personel(), 'customers/yeni'),
      { clinicId: KLINIK_A, userId: PERSONEL, name: 'Yeni Musteri' }));
    await assertSucceeds(setDoc(doc(personel(), 'drugDebts/yeni'),
      { clinicId: KLINIK_A, userId: PERSONEL, customerId: 'm1', qty: 1 }));
  });
});
