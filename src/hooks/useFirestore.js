import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, where } from 'firebase/firestore';
import { db } from '../services/firebase';

/**
 * Defterin canlı verisi (TASK-038a 5. aşama).
 *
 * Artık **kullanıcıya değil kliniğe** bağlı: sorgular `clinicId` üzerinden. Aynı kliniğin
 * iki farklı hesabı aynı defteri görür — işin bütün amacı bu.
 *
 * `clinicId` yoksa hiçbir abonelik kurulmaz ve listeler boş kalır. **Çağıran taraf bu boşluğu
 * sessizce "defter boş" diye göstermemeli**: üyeliğin henüz yüklenmemiş olması ile gerçekten
 * olmaması ayrı şeylerdir ve ikincisi kullanıcıya verisi silinmiş gibi görünür. `App.jsx`
 * bu ayrımı `useClinic`'in `loading`/`error` alanlarıyla yapar.
 *
 * Sorguların `clinicId`'ye geçmesi için bileşik indekslerin ÖNCEDEN yayınlanmış olması
 * gerekiyordu (1. aşama); yoksa dinleyiciler "index required" ile düşer ve uygulama boş açılır.
 */
export function useFirestore(clinicId) {
  const [customers, setCustomers] = useState([]);
  const [drugs, setDrugs] = useState([]);
  const [serviceDebts, setServiceDebts] = useState([]);
  const [drugDebts, setDrugDebts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!clinicId) {
      setCustomers([]);
      setDrugs([]);
      setServiceDebts([]);
      setDrugDebts([]);
      setTransactions([]);
      setDataLoading(false);
      return;
    }

    setDataLoading(true);
    let unsubs = [];
    let loadedCount = 0;

    const checkLoaded = () => {
      loadedCount++;
      if (loadedCount === 5) setDataLoading(false);
    };

    // Generic snapshot handler
    const handleSnapshot = (setter) => (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setter(data);
      if (loadedCount < 5) checkLoaded();
    };

    const handleError = (error) => {
      console.error('[useFirestore] Veri dinleme hatası:', error);
      setDataLoading(false);
    };

    // Subscriptions — klinik üyeleri aynı defteri görür
    unsubs.push(onSnapshot(query(collection(db, 'customers'), where('clinicId', '==', clinicId)), handleSnapshot(setCustomers), handleError));
    unsubs.push(onSnapshot(query(collection(db, 'drugs'), where('clinicId', '==', clinicId)), handleSnapshot(setDrugs), handleError));
    unsubs.push(onSnapshot(query(collection(db, 'serviceDebts'), where('clinicId', '==', clinicId)), handleSnapshot(setServiceDebts), handleError));
    unsubs.push(onSnapshot(query(collection(db, 'drugDebts'), where('clinicId', '==', clinicId)), handleSnapshot(setDrugDebts), handleError));

    // Transactions: clinicId filtresi + timestamp sıralaması (composite index gerektirir)
    const qTrans = query(collection(db, 'transactions'), where('clinicId', '==', clinicId), orderBy('timestamp', 'desc'));
    unsubs.push(onSnapshot(qTrans, handleSnapshot(setTransactions), handleError));

    return () => {
      unsubs.forEach(unsub => unsub());
    };
  }, [clinicId]);

  return { customers, drugs, serviceDebts, drugDebts, transactions, dataLoading };
}
