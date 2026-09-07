/**
 * Ortak Ilac Katalogu Yukleme Script'i (TASK-037)
 *
 * Kullanim:
 *   node scripts/loadDrugCatalog.js --src <disa-aktarim-klasoru>
 *   node scripts/loadDrugCatalog.js --src <klasor> --dry-run    (yazmaz, yalnizca ozet)
 *   node scripts/loadDrugCatalog.js --src <klasor> --prune      (katalogdan dusen kayitlari siler)
 *
 * Gereksinimler:
 *   1. npm install -D firebase-admin
 *   2. scripts/serviceAccountKey.json (Firebase Console → Service Accounts → Generate New Private Key)
 *
 * Kaynak klasorde `urunler.csv` ve `varyantlar.csv` bulunmali (VetKatalog disa aktarimi).
 * Kaynak veri repoya GIRMEZ (.gitignore: *.csv, *.zip) — katalog Firestore'da yasar.
 *
 * Dokuman id'si = `catalogId` oldugu icin script IDEMPOTENT'tir: tekrar tekrar
 * calistirmak mukerrer kayit uretmez, mevcutlarin uzerine yazar.
 */

// firebase-admin BILEREK dinamik import ediliyor (asagida): `--dry-run` donusumu
// dogrulamak icin var ve Admin SDK kurulu olmadan da calisabilmeli.
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { buildCatalogDocs } from './catalogTransform.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const COLLECTION = 'drugCatalog';
const BATCH_LIMIT = 500; // Firestore writeBatch siniri

function arg(name) {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : (process.argv[i + 1] ?? true);
}

async function main() {
  const src = arg('--src');
  const dryRun = process.argv.includes('--dry-run');
  const prune = process.argv.includes('--prune');

  if (!src || src === true) {
    console.error('HATA: --src <disa-aktarim-klasoru> gerekli.');
    console.error('Ornek: node scripts/loadDrugCatalog.js --src C:/tmp/vetkatalog');
    process.exit(1);
  }

  // --- Donusum (Firestore'a dokunmadan) ---
  let urunlerCsv, varyantlarCsv;
  try {
    urunlerCsv = readFileSync(join(src, 'urunler.csv'), 'utf8');
    varyantlarCsv = readFileSync(join(src, 'varyantlar.csv'), 'utf8');
  } catch (err) {
    console.error(`HATA: kaynak dosyalar okunamadi (${src})`);
    console.error('  urunler.csv ve varyantlar.csv bu klasorde olmali.');
    console.error(`  ${err.message}`);
    process.exit(1);
  }

  const { docs, skippedDraft, collisions } = buildCatalogDocs({ urunlerCsv, varyantlarCsv });

  console.log('Donusum:');
  console.log(`  uretilen dokuman        ${docs.length}`);
  console.log(`  haric tutulan taslak    ${skippedDraft}`);
  console.log(`  ambalaj (unit) tasiyan  ${docs.filter(d => d.unit).length}`);
  console.log(`  etken madde tasiyan     ${docs.filter(d => d.etkenMaddeler).length}`);

  // Cakisma sessizce gecilmemeli: iki farkli kalem ayni kimlige dusuyorsa katalog bozuktur
  if (collisions.length) {
    console.error(`\nHATA: ${collisions.length} kimlik cakismasi — yukleme durduruldu.`);
    collisions.slice(0, 10).forEach(c => console.error(`  ${c}`));
    process.exit(1);
  }
  if (!docs.length) {
    console.error('\nHATA: hic dokuman uretilmedi.');
    process.exit(1);
  }

  // Kimlik gecerliligi YAZMADAN once topluca denetlenir: aksi halde hata batch'in
  // ortasinda patlar ve katalog yarim yazilmis halde kalir (bir kez oldu: `/` iceren
  // ambalaj adlari — Firestore'da yol ayraci).
  const invalid = docs
    .map(d => d.catalogId)
    .filter(id => id.includes('/') || id === '.' || id === '..' || /^__.*__$/.test(id) || Buffer.byteLength(id, 'utf8') > 1500);

  if (invalid.length) {
    console.error(`\nHATA: ${invalid.length} gecersiz dokuman kimligi — yukleme durduruldu.`);
    invalid.slice(0, 10).forEach(id => console.error(`  ${id}`));
    process.exit(1);
  }

  if (dryRun) {
    console.log('\n--dry-run: Firestore\'a yazilmadi.');
    console.log('Ornek dokuman:', JSON.stringify(docs[0]));
    return;
  }

  // --- Firestore ---
  const keyPath = join(__dirname, 'serviceAccountKey.json');
  let serviceAccount;
  try {
    serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
  } catch {
    console.error('\nHATA: scripts/serviceAccountKey.json bulunamadi.');
    console.error('Firebase Console → Project Settings → Service Accounts → Generate New Private Key');
    process.exit(1);
  }

  const { initializeApp, cert } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');

  initializeApp({ credential: cert(serviceAccount) });
  const db = getFirestore();
  const col = db.collection(COLLECTION);

  const before = await col.get();
  console.log(`\nFirestore: mevcut ${before.size} dokuman`);

  // Upsert — dokuman id'si catalogId, dolayisiyla tekrar calistirma mukerrer uretmez
  let written = 0;
  for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    for (const doc of docs.slice(i, i + BATCH_LIMIT)) {
      batch.set(col.doc(doc.catalogId), doc);
    }
    await batch.commit();
    written += Math.min(BATCH_LIMIT, docs.length - i);
    console.log(`  yazildi ${written}/${docs.length}`);
  }

  // Katalogdan dusmus kayitlar: silmek YIKICI oldugu icin acikca istenmedikce yapilmaz
  const currentIds = new Set(docs.map(d => d.catalogId));
  const stale = before.docs.filter(d => !currentIds.has(d.id)).map(d => d.id);

  if (stale.length && !prune) {
    console.log(`\nUYARI: ${stale.length} dokuman bu disa aktarimda YOK (katalogda kaldi).`);
    stale.slice(0, 10).forEach(id => console.log(`  ${id}`));
    console.log('Silmek icin --prune ile tekrar calistirin.');
  } else if (stale.length && prune) {
    for (let i = 0; i < stale.length; i += BATCH_LIMIT) {
      const batch = db.batch();
      for (const id of stale.slice(i, i + BATCH_LIMIT)) batch.delete(col.doc(id));
      await batch.commit();
    }
    console.log(`\n${stale.length} bayat dokuman silindi (--prune).`);
  }

  const after = await col.get();
  console.log(`\nTamamlandi. Katalogda ${after.size} dokuman var.`);
}

main().catch(err => {
  console.error('HATA:', err);
  process.exit(1);
});
