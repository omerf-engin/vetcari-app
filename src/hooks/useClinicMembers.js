import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';

/**
 * Kliniğin üye listesi — yalnızca SAHİP için (TASK-038b).
 *
 * Güvenlik kuralı `memberships` okumasını "kendi kaydın **veya** aynı kliniğin sahibiysen"
 * diye açıyor. Personel bu sorguyu çalıştırırsa `permission-denied` alır; bu yüzden hook
 * rol `owner` değilse **hiç abone olmaz** — hata üretip konsolu kirletmesin diye.
 *
 * Sorgu `clinicId` ile kısıtlanmak ZORUNDA: Firestore bir listeyi ancak kural tüm
 * sonuçlar için geçiyorsa döndürür, filtresiz sorgu tümden reddedilir.
 */
export function useClinicMembers(clinicId, role) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const yetkili = role === 'owner' && !!clinicId;

  useEffect(() => {
    if (!yetkili) return;

    const q = query(collection(db, 'memberships'), where('clinicId', '==', clinicId));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setMembers(snapshot.docs.map(d => ({ uid: d.id, ...d.data() })));
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('[useClinicMembers] Uye listesi dinleme hatasi:', err);
        setMembers([]);
        setLoading(false);
        setError(err);
      }
    );
    return unsubscribe;
  }, [clinicId, yetkili]);

  // Yetkisi olmayan icin "yukleniyor" demek yaniltici olurdu: beklenecek bir sey yok.
  if (!yetkili) return { members: [], loading: false, error: null, yetkili: false };
  return { members, loading, error, yetkili: true };
}
