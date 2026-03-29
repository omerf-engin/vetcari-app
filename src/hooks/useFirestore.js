import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, where } from 'firebase/firestore';
import { db } from '../services/firebase';

export function useFirestore(currentUser) {
  const [customers, setCustomers] = useState([]);
  const [drugs, setDrugs] = useState([]);
  const [serviceDebts, setServiceDebts] = useState([]);
  const [drugDebts, setDrugDebts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) {
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

    const uid = currentUser.uid;

    // Subscriptions — her kullanıcı sadece kendi verilerini görür
    unsubs.push(onSnapshot(query(collection(db, 'customers'), where('userId', '==', uid)), handleSnapshot(setCustomers)));
    unsubs.push(onSnapshot(query(collection(db, 'drugs'), where('userId', '==', uid)), handleSnapshot(setDrugs)));
    unsubs.push(onSnapshot(query(collection(db, 'serviceDebts'), where('userId', '==', uid)), handleSnapshot(setServiceDebts)));
    unsubs.push(onSnapshot(query(collection(db, 'drugDebts'), where('userId', '==', uid)), handleSnapshot(setDrugDebts)));

    // Transactions: userId filtresi + timestamp sıralaması (composite index gerektirir)
    const qTrans = query(collection(db, 'transactions'), where('userId', '==', uid), orderBy('timestamp', 'desc'));
    unsubs.push(onSnapshot(qTrans, handleSnapshot(setTransactions)));

    return () => {
      unsubs.forEach(unsub => unsub());
    };
  }, [currentUser]);

  return { customers, drugs, serviceDebts, drugDebts, transactions, dataLoading };
}
