import { useSyncExternalStore } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';

/**
 * Ortak ilaç kataloğu (TASK-037).
 *
 * Katalog global ve salt okunurdur (`userId` taşımaz; güvenlik kuralı herkese okuma,
 * kimseye yazma verir). Yalnızca Admin SDK yazar — `scripts/loadDrugCatalog.js`.
 *
 * **Tembel ve tek abonelik:** abonelik ilk `useDrugCatalog()` çağrısında kurulur ve oturum
 * boyunca yaşar. Kataloğu hiç açmayan kullanıcı hiç okuma ödemez; sekme değiştirip geri
 * dönen kullanıcı da yeniden ödemez ve yükleniyor ekranını tekrar görmez.
 *
 * `getDocs` değil `onSnapshot`: `persistentLocalCache` (firebase.js'te açık) sayesinde
 * sonraki oturumlarda yalnızca DEĞİŞİKLİKLER çekilir. `getDocs` her seferinde tüm
 * koleksiyonu okurdu — yüzlerce klinikte bu gereksiz bir tekrar maliyeti olurdu.
 */

// Dis depo: React disinda yasar, `useSyncExternalStore` ile okunur. Anlik goruntunun
// KIMLIGI yalnizca gercekten degistiginde degismeli, yoksa sonsuz render dongusu olur.
let state = { catalog: [], loading: true, error: null };
let started = false;
const subscribers = new Set();

function publish(next) {
  state = { ...state, ...next };
  subscribers.forEach(fn => fn());
}

function start() {
  if (started) return;
  started = true;

  onSnapshot(
    collection(db, 'drugCatalog'),
    (snapshot) => {
      publish({
        catalog: snapshot.docs.map(d => ({ id: d.id, ...d.data() })),
        loading: false,
        error: null,
      });
    },
    (error) => {
      // Sessizce boş liste GÖSTERİLMEZ: kullanıcı kataloğun neden boş olduğunu bilmeli
      console.error('[useDrugCatalog] Katalog dinleme hatası:', error);
      publish({ loading: false, error });
    }
  );
}

function subscribe(onStoreChange) {
  subscribers.add(onStoreChange);
  start(); // ilk tuketicide abonelik kurulur — tembelligin kaynagi burasi
  return () => { subscribers.delete(onStoreChange); };
}

const getSnapshot = () => state;

export function useDrugCatalog() {
  return useSyncExternalStore(subscribe, getSnapshot);
}

/** Yalnızca testler için: modül düzeyi durumu sıfırlar. */
export function __resetDrugCatalog() {
  state = { catalog: [], loading: true, error: null };
  started = false;
  subscribers.clear();
}
