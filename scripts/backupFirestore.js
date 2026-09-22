/**
 * Firestore Yedekleme Script'i
 *
 * Kullanim:
 *   node scripts/backupFirestore.js                          # TUM veritabani
 *   node scripts/backupFirestore.js --email=vet.45@x.com     # tek kullanicinin defteri
 *   node scripts/backupFirestore.js --uid=R5lzr2pr...        # ayni sey, uid ile
 *
 * Gereksinimler:
 *   1. npm install firebase-admin (proje kokunde)
 *   2. Firebase Console -> Project Settings -> Service Accounts -> Generate New Private Key
 *   3. Indirilen JSON dosyasini scripts/serviceAccountKey.json olarak kaydet
 *
 * Cikti:
 *   scripts/backup-YYYY-MM-DDTHH-MM-SS.json            (tam yedek)
 *   scripts/backup-<etiket>-YYYY-MM-DDTHH-MM-SS.json   (kullanici bazli)
 *
 * Dosya adi DAIMA `backup-` ile baslar: `.gitignore` bu kalibi disliyor. Yedek gercek
 * musteri adlari ve borc tutarlari icerir; depo PUBLIC oldugu icin bu kritik.
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const COLLECTIONS = ['customers', 'drugs', 'serviceDebts', 'drugDebts', 'transactions'];

const argOf = (name) => {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};

async function main() {
  const keyPath = join(__dirname, 'serviceAccountKey.json');
  let serviceAccount;
  try {
    serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
  } catch {
    console.error('HATA: scripts/serviceAccountKey.json bulunamadi.');
    console.error('Firebase Console -> Project Settings -> Service Accounts -> Generate New Private Key');
    console.error('Indirilen dosyayi scripts/serviceAccountKey.json olarak kaydedin.');
    process.exit(1);
  }

  initializeApp({ credential: cert(serviceAccount) });
  const db = getFirestore();

  // Hedef kullanici (istege bagli)
  const email = argOf('email');
  let uid = argOf('uid');
  let label = 'tum-veritabani';

  if (email) {
    const user = await getAuth().getUserByEmail(email);
    uid = user.uid;
  }
  if (uid) {
    label = (email || uid).replace(/[^a-zA-Z0-9]+/g, '-').slice(0, 24);
    console.log(`Hedef defter: ${email || '(uid ile)'}  uid=${uid}\n`);
  } else {
    console.log('Hedef: TUM veritabani (kullanici suzgeci yok)\n');
  }

  const backup = {};
  let totalDocs = 0;

  for (const name of COLLECTIONS) {
    const ref = uid ? db.collection(name).where('userId', '==', uid) : db.collection(name);
    const snapshot = await ref.get();
    backup[name] = [];
    snapshot.forEach(doc => {
      backup[name].push({ id: doc.id, ...doc.data() });
    });
    totalDocs += backup[name].length;
    console.log(`  ${name.padEnd(14)} ${String(backup[name].length).padStart(5)} dokuman`);
  }

  // Yedegin ne oldugu dosyanin ICINDE de yazsin: bir yil sonra dosya adina guvenilmez
  backup.__meta = {
    takenAt: new Date().toISOString(),
    scope: uid ? { email: email || null, uid } : 'all',
    counts: Object.fromEntries(COLLECTIONS.map(c => [c, backup[c].length])),
    totalDocs,
  };

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outPath = join(__dirname, uid ? `backup-${label}-${timestamp}.json` : `backup-${timestamp}.json`);
  writeFileSync(outPath, JSON.stringify(backup, null, 2), 'utf8');

  console.log(`\nToplam: ${totalDocs} dokuman yedeklendi`);
  console.log(`Dosya: ${outPath}`);
}

main().catch(err => {
  console.error('Yedekleme hatasi:', err.message);
  process.exit(1);
});
