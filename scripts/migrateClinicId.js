/**
 * TASK-038a 4. asama: klinik veri modeline goc.
 *
 * Kullanim:
 *   node scripts/migrateClinicId.js --email=sahip@ornek.com                 # KURU CALISMA
 *   node scripts/migrateClinicId.js --email=sahip@ornek.com --commit        # yazar
 *   node scripts/migrateClinicId.js --email=... --name="Klinik Adi" --commit
 *
 * Ne yapar:
 *   1. Sahip icin bir `clinics` dokumani ve `memberships/{uid}` (role: owner) olusturur
 *   2. Bes veri koleksiyonundaki dokumanlara `clinicId` damgalar
 *
 * YENIDEN CALISTIRILABILIR ve bu bir gereklilik, konfor degil: defter aktif kullanimda,
 * goc surerken yazilan yeni kayitlar `clinicId` almadan dogar. Kapanista ikinci bir tur
 * atilmali; ikinci tur 0 dokuman damgaliyorsa goc temiz demektir.
 *
 * Klinik kimligi UYELIKTEN turetilir: uyelik zaten varsa onun `clinicId`'si yeniden
 * kullanilir. Aksi halde her calistirma yeni bir klinik yaratir ve defter ikiye bolunurdu.
 *
 * Gereksinimler: scripts/serviceAccountKey.json + firebase-admin
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const COLLECTIONS = ['customers', 'drugs', 'serviceDebts', 'drugDebts', 'transactions'];
const BATCH_SIZE = 450;   // 500 sinirinin altinda pay birakilir
const SEAT_LIMIT = 2;     // standart paket: 1 owner + 1 staff (urun karari 2026-09-10)

const argOf = (name) => {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};
const COMMIT = process.argv.includes('--commit');

async function main() {
  let serviceAccount;
  try {
    serviceAccount = JSON.parse(readFileSync(join(__dirname, 'serviceAccountKey.json'), 'utf8'));
  } catch {
    console.error('HATA: scripts/serviceAccountKey.json bulunamadi.');
    process.exit(1);
  }

  const email = argOf('email');
  const uidArg = argOf('uid');
  if (!email && !uidArg) {
    console.error('HATA: --email= veya --uid= zorunlu. Hedefi tahmin etmem.');
    process.exit(1);
  }

  initializeApp({ credential: cert(serviceAccount) });
  const db = getFirestore();

  // 1) Sahip
  const user = email ? await getAuth().getUserByEmail(email) : await getAuth().getUser(uidArg);
  const ownerUid = user.uid;
  console.log(COMMIT ? '=== GOC (--commit) ===' : '=== KURU CALISMA (yazma yok) ===');
  console.log(`Sahip: ${user.email}  uid=${ownerUid}\n`);

  // 2) Klinik kimligi — once mevcut uyelige bak
  const memberRef = db.collection('memberships').doc(ownerUid);
  const memberSnap = await memberRef.get();

  let clinicId, clinicYeni = false;
  if (memberSnap.exists && memberSnap.data().clinicId) {
    clinicId = memberSnap.data().clinicId;
    console.log(`Mevcut uyelik bulundu -> klinik yeniden kullanilacak: ${clinicId}`);
  } else {
    clinicId = db.collection('clinics').doc().id;  // yalnizca kimlik uretir, yazmaz
    clinicYeni = true;
    console.log(`Yeni klinik olusturulacak: ${clinicId}`);
  }
  const clinicName = argOf('name') || 'Klinik';
  if (clinicYeni) console.log(`Klinik adi: "${clinicName}"  (--name= ile degistirilebilir)`);

  // 3) Damgalanacak dokumanlar
  console.log('\nKoleksiyonlar:');
  const todo = {};
  let damgaliBaska = 0, toplamDamgalanacak = 0, toplamZatenVar = 0;

  for (const name of COLLECTIONS) {
    const snap = await db.collection(name).where('userId', '==', ownerUid).get();
    const eksik = [];
    let zaten = 0;
    snap.forEach(d => {
      const mevcut = d.data().clinicId;
      if (!mevcut) eksik.push(d.ref);
      else if (mevcut === clinicId) zaten++;
      else damgaliBaska++;   // BASKA bir klinigin damgasi — bu bir tutarsizlik
    });
    todo[name] = eksik;
    toplamDamgalanacak += eksik.length;
    toplamZatenVar += zaten;
    console.log(`  ${name.padEnd(14)} toplam ${String(snap.size).padStart(5)}  damgalanacak ${String(eksik.length).padStart(5)}  zaten damgali ${String(zaten).padStart(5)}`);
  }

  if (damgaliBaska > 0) {
    console.error(`\nDURDURULDU: ${damgaliBaska} dokuman BASKA bir klinigin damgasini tasiyor.`);
    console.error('Once bunun nasil olustugunu anla; korlemesine uzerine yazmak defterleri karistirir.');
    process.exit(1);
  }

  console.log(`\nDamgalanacak: ${toplamDamgalanacak}  |  Zaten damgali: ${toplamZatenVar}`);

  if (!COMMIT) {
    console.log('\nKuru calisma bitti. Yazmak icin --commit ekleyin.');
    return;
  }

  // 4) Once KIMLIK (klinik + uyelik), sonra damgalar.
  // Sira onemli: damgali dokuman varken uyelik yoksa kullanici kendi kayitlarini goremez.
  if (clinicYeni) {
    await db.collection('clinics').doc(clinicId).set({
      name: clinicName,
      ownerId: ownerUid,
      seatLimit: SEAT_LIMIT,
      createdAt: Date.now(),
    });
    console.log(`\nKlinik yazildi: ${clinicId}`);
  }
  await memberRef.set({ clinicId, role: 'owner', createdAt: Date.now() }, { merge: true });
  console.log(`Uyelik yazildi: memberships/${ownerUid} (owner)`);

  // 5) Damgalar
  let yazilan = 0;
  for (const name of COLLECTIONS) {
    const refs = todo[name];
    if (!refs.length) { console.log(`  ${name.padEnd(14)} atlandi (damgalanacak yok)`); continue; }
    for (let i = 0; i < refs.length; i += BATCH_SIZE) {
      const batch = db.batch();
      for (const ref of refs.slice(i, i + BATCH_SIZE)) batch.update(ref, { clinicId });
      await batch.commit();
    }
    yazilan += refs.length;
    console.log(`  ${name.padEnd(14)} ${String(refs.length).padStart(5)} dokuman damgalandi`);
  }

  console.log(`\nToplam ${yazilan} dokuman damgalandi. Klinik: ${clinicId}`);
  console.log('Defter aktif kullanimda oldugu icin script TEKRAR calistirilmali;');
  console.log('ikinci tur 0 damgaliyorsa goc temiz demektir.');
}

main().catch(err => {
  console.error('Goc hatasi:', err.message);
  process.exit(1);
});
