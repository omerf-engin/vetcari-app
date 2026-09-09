import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';

/**
 * Kullanicinin bagli oldugu klinik (TASK-038a).
 *
 * Urun karari: **bir kullanici tek klinige uyedir**. Bu sayede uyelik dokumaninin kimligi
 * dogrudan `uid` olabiliyor ve hem istemci hem guvenlik kurali tek dokuman okumasiyla
 * "bu kullanici hangi deftere ait" sorusunu cevapliyor (bkz. firestore.rules `myClinicId`).
 * Coklu uyelik olsaydi burada bir klinik SECICI ve App'te yeni bir durum ekseni gerekirdi.
 *
 * Uyelik dokumanlari istemciye SALT OKUNURDUR; yalnizca goc scripti (Admin SDK) yazar.
 * Yazma acik olsaydi kullanici kendini istedigi klinige uye yapip o defteri acabilirdi.
 *
 * `clinicId: null` iki farkli seyi ifade edebilir ve ikisi de sessizce "bos defter"
 * gosterilmemeli: (1) goc henuz calismadi, (2) kullanicinin uyeligi yok. `loading` ve
 * `error` ayri tutuluyor ki cagiran taraf bunlari ayirt edebilsin — katalog kancasinda
 * ogrenilen ders (bkz. useDrugCatalog `fromCache`).
 */
const SIGNED_OUT = { clinicId: null, role: null, loading: false, error: null };

export function useClinic(currentUser) {
  // Durum, geldigi KULLANICIYLA birlikte saklanir. Hesap degistiginde onceki kullanicinin
  // `clinicId`'si bir render boyunca sizabilirdi; `uid` karsilastirmasi bunu imkansiz kilar.
  // `loading` de saklanmaz, TURETILIR — effect icinde setState cagirmak (ve dolayisiyla
  // zincirleme render) gerekmesin diye.
  const [snap, setSnap] = useState({ uid: null, clinicId: null, role: null, error: null });

  useEffect(() => {
    if (!currentUser) return;

    const unsubscribe = onSnapshot(
      doc(db, 'memberships', currentUser.uid),
      (snapshot) => {
        const data = snapshot.exists() ? snapshot.data() : null;
        setSnap({
          uid: currentUser.uid,
          clinicId: data?.clinicId ?? null,
          role: data?.role ?? null,
          error: null,
        });
      },
      (error) => {
        // Sessizce "uyelik yok" DENMEZ: izin hatasi ile uyeligin gercekten olmamasi
        // ayri seylerdir ve ikincisi kullaniciya bos bir defter gostermek demek olur.
        console.error('[useClinic] Uyelik dinleme hatasi:', error);
        setSnap({ uid: currentUser.uid, clinicId: null, role: null, error });
      }
    );

    return unsubscribe;
  }, [currentUser]);

  if (!currentUser) return SIGNED_OUT;
  if (snap.uid !== currentUser.uid) {
    return { clinicId: null, role: null, loading: true, error: null };
  }
  return { clinicId: snap.clinicId, role: snap.role, loading: false, error: snap.error };
}
