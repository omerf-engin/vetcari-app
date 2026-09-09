import { defineConfig } from 'vitest/config';

/**
 * Guvenlik kurali DAVRANIS testleri icin ayri yapilandirma (BAKIM-002).
 *
 * Neden ayri: bu testler calisan bir Firestore emulatoru (dolayisiyla Java) ister.
 * Ana `npm test` paketine karisirlarsa emulator olmayan her ortamda kirmizi yanar.
 * `vite.config.js` bu klasoru DISLAR, burasi da yalnizca onu ICERIR.
 *
 * `jsdom` yok: burada DOM degil, gercek istemci SDK'si ile ag cagrisi test ediliyor.
 */
export default defineConfig({
  test: {
    include: ['tests/rules/**/*.test.js'],
    environment: 'node',
    // Emulator TEK ornek ve testler arasinda `clearFirestore()` cagriliyor. Dosyalar
    // paralel kosarsa biri digerinin verisini silip yaris kosulu yaratir.
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
