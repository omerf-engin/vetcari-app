/**
 * Firestore Yedekleme Script'i
 *
 * Kullanim:
 *   node scripts/backupFirestore.js
 *
 * Gereksinimler:
 *   1. npm install firebase-admin (proje kokunde)
 *   2. Firebase Console → Project Settings → Service Accounts → Generate New Private Key
 *   3. Indirilen JSON dosyasini scripts/serviceAccountKey.json olarak kaydet
 *
 * Cikti:
 *   scripts/backup-YYYY-MM-DDTHH-MM-SS.json
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const COLLECTIONS = ['customers', 'drugs', 'serviceDebts', 'drugDebts', 'transactions'];

async function main() {
  // Service account key kontrolu
  const keyPath = join(__dirname, 'serviceAccountKey.json');
  let serviceAccount;
  try {
    serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
  } catch {
    console.error('HATA: scripts/serviceAccountKey.json bulunamadi.');
    console.error('Firebase Console → Project Settings → Service Accounts → Generate New Private Key');
    console.error('Indirilen dosyayi scripts/serviceAccountKey.json olarak kaydedin.');
    process.exit(1);
  }

  initializeApp({ credential: cert(serviceAccount) });
  const db = getFirestore();

  const backup = {};
  let totalDocs = 0;

  for (const name of COLLECTIONS) {
    const snapshot = await db.collection(name).get();
    backup[name] = [];
    snapshot.forEach(doc => {
      backup[name].push({ id: doc.id, ...doc.data() });
    });
    totalDocs += backup[name].length;
    console.log(`  ${name}: ${backup[name].length} dokuman`);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outPath = join(__dirname, `backup-${timestamp}.json`);
  writeFileSync(outPath, JSON.stringify(backup, null, 2), 'utf8');

  console.log(`\nToplam: ${totalDocs} dokuman yedeklendi`);
  console.log(`Dosya: ${outPath}`);
}

main().catch(err => {
  console.error('Yedekleme hatasi:', err.message);
  process.exit(1);
});
