import { useState, useEffect } from 'react';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';

const BOS = { clinic: null, invites: [], loading: false, error: null };

/**
 * Klinik yönetim verisi — klinik dokümanı + bekleyen davetler (TASK-038b).
 *
 * Yalnızca **sahip** için çalışır. `staff` bu sorguları çalıştırsa `permission-denied`
 * alırdı (kural davet listesini ve üye listesini sahibe açıyor), bu yüzden rol `owner`
 * değilse hiç abone olunmaz — gereksiz okuma da olmaz, konsol da kirlenmez.
 *
 * Davet sorgusu `clinicId` ile kısıtlanmak zorunda: Firestore bir listeyi ancak kural
 * TÜM sonuçlar için geçiyorsa döndürür.
 */
export function useClinicAdmin(clinicId, role) {
  const [state, setState] = useState({ key: null, clinic: null, invites: [], error: null });

  const yetkili = role === 'owner' && !!clinicId;

  useEffect(() => {
    if (!yetkili) return;

    let clinic = null;
    let invites = [];
    const yayinla = () => setState({ key: clinicId, clinic, invites, error: null });
    const hata = (err) => {
      console.error('[useClinicAdmin] Klinik verisi dinleme hatasi:', err);
      setState({ key: clinicId, clinic, invites, error: err });
    };

    const unsubClinic = onSnapshot(
      doc(db, 'clinics', clinicId),
      (s) => { clinic = s.exists() ? { id: s.id, ...s.data() } : null; yayinla(); },
      hata
    );

    const unsubInvites = onSnapshot(
      query(collection(db, 'invites'), where('clinicId', '==', clinicId)),
      (s) => { invites = s.docs.map(d => ({ id: d.id, ...d.data() })); yayinla(); },
      hata
    );

    return () => { unsubClinic(); unsubInvites(); };
  }, [clinicId, yetkili]);

  if (!yetkili) return BOS;
  if (state.key !== clinicId) return { clinic: null, invites: [], loading: true, error: null };
  return { clinic: state.clinic, invites: state.invites, loading: false, error: state.error };
}
