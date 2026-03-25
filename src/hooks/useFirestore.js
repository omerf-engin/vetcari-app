import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
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

    // Subscriptions
    unsubs.push(onSnapshot(collection(db, 'customers'), handleSnapshot(setCustomers)));
    unsubs.push(onSnapshot(collection(db, 'drugs'), handleSnapshot(setDrugs)));
    unsubs.push(onSnapshot(collection(db, 'serviceDebts'), handleSnapshot(setServiceDebts)));
    unsubs.push(onSnapshot(collection(db, 'drugDebts'), handleSnapshot(setDrugDebts)));

    // Transactions generally ordered by timestamp descending
    const qTrans = query(collection(db, 'transactions'), orderBy('timestamp', 'desc'));
    unsubs.push(onSnapshot(qTrans, handleSnapshot(setTransactions)));

    return () => {
      unsubs.forEach(unsub => unsub());
    };
  }, [currentUser]);

  return { customers, drugs, serviceDebts, drugDebts, transactions, dataLoading };
}
