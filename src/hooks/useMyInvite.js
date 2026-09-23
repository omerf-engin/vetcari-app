import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { inviteKeyOf } from '../services/clinicOperations';

const YOK = { invite: null, loading: false, error: null };

/**
 * Kullanıcının kendi davetini izler (TASK-038b).
 *
 * `getDoc` değil `onSnapshot`: personel "kliniğe bağlı değil" ekranında beklerken sahip
 * daveti oluşturursa, sayfayı yenilemeden görünsün. Bu ekranın tek işi beklemek olduğu
 * için canlı olması anlamlı.
 *
 * Yalnızca **üyeliği olmayan** kullanıcı için çalışır; üyesi olanın davete bakması
 * gereksiz okuma olurdu.
 *
 * Durum, geldiği e-posta anahtarıyla saklanır — hesap değişince önceki kullanıcının
 * daveti bir render boyunca sızmasın diye (`useClinic` ile aynı desen).
 */
export function useMyInvite(currentUser, { enabled = true } = {}) {
  const [snap, setSnap] = useState({ key: null, invite: null, error: null });

  const key = inviteKeyOf(currentUser?.email);
  const aktif = enabled && !!key && key.includes('@');

  useEffect(() => {
    if (!aktif) return;

    const unsubscribe = onSnapshot(
      doc(db, 'invites', key),
      (s) => setSnap({ key, invite: s.exists() ? { id: s.id, ...s.data() } : null, error: null }),
      (err) => {
        // Davet yoksa kural zaten reddedebilir; bu bir HATA degil, beklenen durum.
        // Yine de sessiz gecilmiyor: cagiran taraf ayirt edebilsin.
        console.error('[useMyInvite] Davet dinleme hatasi:', err);
        setSnap({ key, invite: null, error: err });
      }
    );
    return unsubscribe;
  }, [key, aktif]);

  if (!aktif) return YOK;
  if (snap.key !== key) return { invite: null, loading: true, error: null };
  return { invite: snap.invite, loading: false, error: snap.error };
}
