import React, { useState } from 'react';
import { fmtTL, fmtQty } from './utils/formatters';
import Header from './components/layout/Header';
import DashboardView from './components/dashboard/DashboardView';
import CustomersView from './components/customers/CustomersView';
import DrugsView from './components/drugs/DrugsView';
import CustomerDetail from './components/customers/CustomerDetail';

// --- BAŞLANGIÇ VERİLERİ (MOCK DATA) ---
const initialDrugs = [
  { id: 1, name: 'Bravecto (Kene/Pire)', price: 450 },
  { id: 2, name: 'İç Parazit Hapı (Tenikur)', price: 120 },
  { id: 3, name: 'Karma Aşı', price: 600 }
];

const initialCustomers = [
  { id: 1, name: 'Ayşe Yılmaz (Tarçın)', balance: 0 },
  { id: 2, name: 'Kemal Demir (Karabaş)', balance: 150 }
];

const initialServiceDebts = [
  { id: 1, customerId: 1, desc: 'Genel Muayene', amount: 400, date: '2023-10-25' }
];

const initialDrugDebts = [
  { id: 1, customerId: 1, drugId: 1, qty: 1.5, maxPrice: 450, isFixed: false, date: '2023-10-25' },
  { id: 2, customerId: 2, drugId: 2, qty: 3, maxPrice: 120, isFixed: true, date: '2023-10-20' }
];

const initialLogs = [
  { id: 101, debtId: 1, date: '25.10.2023 10:00', title: 'Borç Açıldı', message: `1.5 Adet eklendi. (Birim fiyat: 450 ₺. Toplam: 675 ₺)`, type: 'info' },
  { id: 102, debtId: 2, date: '20.10.2023 14:30', title: 'Borç Açıldı', message: `3 Adet eklendi. (Birim fiyat: 120 ₺. Toplam: 360 ₺)`, type: 'info' }
];

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);

  const [drugs, setDrugs] = useState(initialDrugs);
  const [customers, setCustomers] = useState(initialCustomers);
  const [serviceDebts, setServiceDebts] = useState(initialServiceDebts);
  const [drugDebts, setDrugDebts] = useState(initialDrugDebts);
  const [transactions, setTransactions] = useState(initialLogs);

  const addLog = (debtId, title, message, type = 'neutral') => {
    return {
      id: Date.now() + Math.random(),
      debtId,
      date: new Date().toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }),
      title,
      message,
      type
    };
  };

  const handleAddCustomer = (name) => {
    if (!name.trim()) return;
    const newCustomer = { id: Date.now(), name: name.trim(), balance: 0 };
    setCustomers([...customers, newCustomer]);
  };

  const handleAddDrug = (name, price) => {
    if (!name.trim() || price <= 0) return;
    const newDrug = { id: Date.now(), name: name.trim(), price: parseFloat(price) };
    setDrugs([...drugs, newDrug]);
  };

  const handleUpdateDrugPrice = (drugId, newPrice) => {
    setDrugs(prev => prev.map(d => d.id === drugId ? { ...d, price: newPrice } : d));

    const generatedLogs = [];

    const updatedDebts = drugDebts.map(debt => {
      if (debt.drugId === drugId && !debt.isFixed && newPrice > debt.maxPrice) {
        const oldTotalTl = debt.qty * debt.maxPrice;
        const newTotalTl = debt.qty * newPrice;
        const diffTl = newTotalTl - oldTotalTl;

        generatedLogs.push(addLog(
          debt.id,
          'Fiyat Güncellemesi (Zam)',
          `Birim fiyat ${fmtTL(debt.maxPrice)} -> ${fmtTL(newPrice)} oldu. Toplam borç ${fmtTL(oldTotalTl)}'den ${fmtTL(newTotalTl)}'ye çıktı (+${fmtTL(diffTl)} fark).`,
          'warning'
        ));

        return { ...debt, maxPrice: newPrice };
      }
      return debt;
    });

    setDrugDebts(updatedDebts);
    if (generatedLogs.length > 0) setTransactions(prev => [...prev, ...generatedLogs]);
  };

  const toggleDebtLock = (debtId) => {
    const debt = drugDebts.find(d => d.id === debtId);
    if (debt) {
      setTransactions(prev => [...prev, addLog(debtId, debt.isFixed ? 'Sabitleme Kaldırıldı' : 'Fiyat Sabitlendi', debt.isFixed ? 'Borç tekrar zamlara açık hale geldi.' : 'Borç donduruldu, zamlardan etkilenmeyecek.', 'neutral')]);
      setDrugDebts(prev => prev.map(d => d.id === debtId ? { ...d, isFixed: !d.isFixed } : d));
    }
  };

  const handleDrugReturn = (debt, returnQty) => {
    if (returnQty <= 0) return;

    if (returnQty <= debt.qty) {
      let finalQty = debt.qty - returnQty;
      const remainingTl = finalQty * debt.maxPrice;
      let isSwept = false;

      if (remainingTl <= 10) { isSwept = true; finalQty = 0; }

      setDrugDebts(prev => prev.map(d => d.id === debt.id ? { ...d, qty: finalQty } : d).filter(d => d.qty > 0));

      const logs = [addLog(debt.id, 'İade İşlemi', `${fmtQty(returnQty)} adet iade edildi. Kalan yeni borç: ${fmtQty(finalQty)} adet (${fmtTL(remainingTl)}).`, 'info')];
      if (isSwept) logs.push(addLog(debt.id, 'Süpürücü (Silindi)', `Kalan tutar 10 TL'nin altında (${fmtTL(remainingTl)}) olduğu için sistem borcu sıfırladı.`, 'success'));
      setTransactions(prev => [...prev, ...logs]);

    } else {
      const excessQty = returnQty - debt.qty;
      const refundTl = excessQty * debt.maxPrice;

      setDrugDebts(prev => prev.filter(d => d.id !== debt.id));
      setCustomers(prev => prev.map(c => c.id === debt.customerId ? { ...c, balance: c.balance + refundTl } : c));
      setTransactions(prev => [...prev, addLog(debt.id, 'Fazla İade (Avans)', `Tüm borç kapatıldı. Artan ${fmtQty(excessQty)} adet karşılığı ${fmtTL(refundTl)} avans yazıldı.`, 'success')]);
    }
  };

  const addServiceDebt = (customerId, desc, amount) => {
    const newDebt = { id: Date.now(), customerId, desc, amount, date: new Date().toISOString().split('T')[0] };
    setServiceDebts([...serviceDebts, newDebt]);
  };

  const addDrugDebt = (customerId, drugId, qty) => {
    const drug = drugs.find(d => d.id === drugId);
    if (!drug) return;
    const debtId = Date.now();
    const newDebt = { id: debtId, customerId, drugId, qty, maxPrice: drug.price, isFixed: false, date: new Date().toISOString().split('T')[0] };
    setDrugDebts([...drugDebts, newDebt]);
    setTransactions(prev => [...prev, addLog(debtId, 'Borç Açıldı', `${fmtQty(qty)} Adet eklendi. (Birim fiyat: ${fmtTL(drug.price)}. Toplam Borç: ${fmtTL(qty * drug.price)})`, 'info')]);
  };

  const applyPayment = (customerId, receivedAmount, distributionArr) => {
    let currentBalance = customers.find(c => c.id === customerId).balance + receivedAmount;

    let newSDebts = [...serviceDebts];
    let newDDebts = [...drugDebts];
    let newLogs = [];

    distributionArr.forEach(item => {
      if (item.deduct <= 0) return;
      currentBalance -= item.deduct;

      if (item.type === 'service') {
        const idx = newSDebts.findIndex(d => d.id === item.id);
        if (idx !== -1) {
          newSDebts[idx].amount -= item.deduct;
          if (newSDebts[idx].amount <= 10) newSDebts.splice(idx, 1);
        }
      } else if (item.type === 'drug') {
        const idx = newDDebts.findIndex(d => d.id === item.id);
        if (idx !== -1) {
          const qtyToDeduct = item.deduct / newDDebts[idx].maxPrice;
          newDDebts[idx].qty -= qtyToDeduct;

          const kalanAdet = newDDebts[idx].qty;
          const kalanTlKarsiligi = kalanAdet * newDDebts[idx].maxPrice;

          newLogs.push(addLog(item.id, 'Tahsilat', `${fmtTL(item.deduct)} ödendi. ${fmtQty(qtyToDeduct)} adet borçtan düşüldü. Kalan yeni borç: ${fmtQty(kalanAdet)} adet (${fmtTL(kalanTlKarsiligi)}).`, 'success'));

          if (kalanTlKarsiligi <= 10) {
            if (kalanTlKarsiligi > 0) newLogs.push(addLog(item.id, 'Süpürücü (Kapatıldı)', `Kalan mikro küsurat 10 TL altında olduğu için silindi.`, 'success'));
            newDDebts.splice(idx, 1);
          }
        }
      }
    });

    setServiceDebts(newSDebts);
    setDrugDebts(newDDebts);
    setCustomers(customers.map(c => c.id === customerId ? { ...c, balance: currentBalance } : c));
    if (newLogs.length > 0) setTransactions(prev => [...prev, ...newLogs]);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-12">
      <Header activeTab={activeTab} onNavigate={setActiveTab} />

      <main className="max-w-6xl mx-auto px-4 py-8">

        {activeTab === 'dashboard' && (
          <DashboardView
            customers={customers}
            serviceDebts={serviceDebts}
            drugDebts={drugDebts}
            drugs={drugs}
            onNavigate={(tab) => setActiveTab(tab)}
          />
        )}

        {activeTab === 'customers' && (
          <CustomersView
            customers={customers}
            serviceDebts={serviceDebts}
            drugDebts={drugDebts}
            onSelect={(id) => { setSelectedCustomerId(id); setActiveTab('customerDetail'); }}
            onAddCustomer={handleAddCustomer}
          />
        )}

        {activeTab === 'drugs' && (
          <DrugsView
            drugs={drugs}
            onUpdatePrice={handleUpdateDrugPrice}
            onAddDrug={handleAddDrug}
          />
        )}

        {activeTab === 'customerDetail' && selectedCustomerId && (
          <CustomerDetail
            customer={customers.find(c => c.id === selectedCustomerId)}
            drugs={drugs}
            serviceDebts={serviceDebts.filter(d => d.customerId === selectedCustomerId)}
            drugDebts={drugDebts.filter(d => d.customerId === selectedCustomerId)}
            transactions={transactions}
            onBack={() => { setActiveTab('customers'); setSelectedCustomerId(null); }}
            onToggleLock={toggleDebtLock}
            onReturnDrug={handleDrugReturn}
            onAddServiceDebt={(desc, amt) => addServiceDebt(selectedCustomerId, desc, amt)}
            onAddDrugDebt={(drugId, qty) => addDrugDebt(selectedCustomerId, drugId, qty)}
            onApplyPayment={(amt, dist) => applyPayment(selectedCustomerId, amt, dist)}
          />
        )}
      </main>
    </div>
  );
}