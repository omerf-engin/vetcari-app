/**
 * TASK-014: userId Migration Script
 *
 * Kullanim:
 *   node scripts/migrateUserId.js
 *
 * Ne yapar:
 *   customers, drugs, serviceDebts, drugDebts, transactions koleksiyonlarindaki
 *   tum dokumanlara userId alani eksikse ekler.
 *
 * Idempotent: iki kez calistirilsa da veri bozulmaz (userId zaten varsa atlar).
 *
 * Gereksinimler:
 *   - scripts/serviceAccountKey.json mevcut olmali
 *   - npm install firebase-admin
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Tum mevcut verilerin sahibi olan kullanicinin UID'si
const OWNER_UID = 'R5lzr2pr53gXrGhlEGBeIQsVtGV2';

const COLLECTIONS = ['customers', 'drugs', 'serviceDebts', 'drugDebts', 'transactions'];

async function migrateCollection(db, collectionName) {
  const snapshot = await db.collection(collectionName).get();
  const docs = snapshot.docs.filter(doc => !doc.data().userId);

  if (docs.length === 0) {
    console.log(`  ${collectionName}: zaten migrate edilmis, atlanıyor`);
    return 0;
  }

  // Firestore batch max 500 dokuman
  const BATCH_SIZE = 500;
  let migrated = 0;

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = docs.slice(i, i + BATCH_SIZE);
    chunk.forEach(doc => {
      batch.update(doc.ref, { userId: OWNER_UID });
    });
    await batch.commit();
    migrated += chunk.length;
  }

  console.log(`  ${collectionName}: ${migrated} dokuman guncellendi`);
  return migrated;
}

async function main() {
  const keyPath = join(__dirname, 'serviceAccountKey.json');
  let serviceAccount;
  try {
    serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
  } catch {
    console.error('HATA: scripts/serviceAccountKey.json bulunamadi.');
    process.exit(1);
  }

  initializeApp({ credential: cert(serviceAccount) });
  const db = getFirestore();

  console.log(`Migration basliyor...`);
  console.log(`Hedef UID: ${OWNER_UID}\n`);

  let total = 0;
  for (const col of COLLECTIONS) {
    total += await migrateCollection(db, col);
  }

  console.log(`\nToplam ${total} dokuman guncellendi.`);
  console.log('Migration tamamlandi.');
}

main().catch(err => {
  console.error('Migration hatasi:', err.message);
  process.exit(1);
});
