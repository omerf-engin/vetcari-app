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
 *
 * **`fromCache` neden yayınlanıyor:** çevrimdışıyken `onSnapshot` HATA VERMEZ — önbellekten
 * boş bir anlık görüntü verir. Hata geri çağrısı yalnızca izin/sorgu hatalarında çalışır.
 * Bu ayrım yapılmadığı sürece kullanıcı "Katalog boş" görür ve 1.141 kayıtlık listeyi elle
 * kurmaya girişir. Tarayıcıda ölçüldü (2026-09-08, `disableNetwork` ile):
 *
 *   çevrimiçi + soğuk önbellek → 1 olay, size 0, fromCache **false**  (128 ms)
 *   çevrimdışı + soğuk önbellek → 1 olay, size 0, fromCache **true**  (21 ms)
 *   çevrimdışı + sıcak önbellek → 1 olay, size **1141**, fromCache true (1 ms)
 *
 * İlk satır kritik: çevrimiçi açılışta önce boş bir önbellek anlık görüntüsü GELMİYOR, bu
 * yüzden "boş + fromCache" güvenli bir ayraçtır — zaman aşımı gerekmez. Üçüncü satır da
 * yukarıdaki `persistentLocalCache` iddiasının kanıtı: çevrimdışı sıcak önbellekte katalog
 * eksiksiz geliyor, dolayısıyla uyarı YALNIZCA liste boşken gösterilmeli.
 */

// Dis depo: React disinda yasar, `useSyncExternalStore` ile okunur. Anlik goruntunun
// KIMLIGI yalnizca gercekten degistiginde degismeli, yoksa sonsuz render dongusu olur.
let state = { catalog: [], loading: true, error: null, fromCache: false };
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
        fromCache: snapshot.metadata.fromCache,
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
  state = { catalog: [], loading: true, error: null, fromCache: false };
  started = false;
  subscribers.clear();
}
