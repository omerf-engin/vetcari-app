import React, { useState } from 'react';
import { fmtTL, fmtQty } from './utils/formatters';
import Header from './components/layout/Header';
import DashboardView from './components/dashboard/DashboardView';
import CustomersView from './components/customers/CustomersView';
import CustomerDetail from './components/customers/CustomerDetail';
import { useAuth } from './hooks/useAuth';
import Login from './components/auth/Login';
import { useFirestore } from './hooks/useFirestore';
import { 
  addCustomer, 
  deleteCustomer,
  updateCustomerName,
  addDrug, 
  deleteDrug,
  updateDrugPrice, 
  toggleDebtLock, 
  returnDrug, 
  addServiceDebtOperations, 
  deleteServiceDebtOperations,
  addDrugDebtOperations, 
  applyPaymentOperations 
} from './services/firestoreOperations';

export default function App() {
  const { currentUser, loading } = useAuth();
  const { customers, drugs, serviceDebts, drugDebts, transactions, dataLoading } = useFirestore();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);

  const handleAddCustomer = async (name) => {
    const trimmedInfo = name.trim().toLowerCase();
    const exists = customers.some(c => c.name.trim().toLowerCase() === trimmedInfo);
    if (exists) {
      alert(`"${name}" adında bir müşteri zaten kayıtlı!\n\nLütfen (Köpek/Kedi ismi) veya başka bir ayırt edici ek belirterek isimleri farklı yapmaya çalışın.`);
      return;
    }
    await addCustomer(name);
  };

  const handleUpdateCustomerName = async (customerId, newName) => {
    const trimmedInfo = newName.trim().toLowerCase();
    const exists = customers.some(c => c.id !== customerId && c.name.trim().toLowerCase() === trimmedInfo);
    if (exists) {
      alert(`"${newName}" adında bir müşteri zaten kayıtlı!`);
      return;
    }
    await updateCustomerName(customerId, newName);
  };

  const handleDeleteCustomer = async (customerId, totalDebt, balance) => {
    if (totalDebt > 0 || balance > 0) {
      alert("UYARI: Bu müşterinin aktif finansal bakiyesi (borç veya avans) bulunduğu için silinemez. Lütfen önce hesapları sıfırlayın.");
      return;
    }
    if (window.confirm("Bu müşteriyi sistemden kalıcı olarak silmek istediğinize emin misiniz?")) {
      await deleteCustomer(customerId);
      setSelectedCustomerId(null);
    }
  };

  const handleAddDrug = async (name, price) => {
    const trimmedInfo = name.trim().toLowerCase();
    const exists = drugs.some(d => d.name.trim().toLowerCase() === trimmedInfo);
    if (exists) {
      alert(`"${name}" adında bir ilaç sistemde zaten mevcut!\n\nEğer fiyatını değiştirmek istiyorsanız "İlaçlar & Fiyatlar" sekmesindeki "Fiyatı Güncelle" butonunu kullanabilirsiniz.`);
      return;
    }
    await addDrug(name, price);
  };

  const handleDeleteDrug = async (drugId) => {
    const hasActiveDebt = drugDebts.some(d => d.drugId === drugId && d.qty > 0);
    if (hasActiveDebt) {
      alert("UYARI: Bu ilacın ödenmemiş aktif müşteri borçları bulunduğu için sistemden silinmesine izin verilmez!");
      return;
    }
    
    if (window.confirm("Bu ilacı kalıcı olarak silmek istediğinize emin misiniz?\nMüşterilerin geçmiş (ödenmiş) ekstresinde ilacın adı 'Bilinmeyen İlaç' olarak görünebilir.")) {
      await deleteDrug(drugId);
    }
  };

  const handleUpdateDrugPrice = async (drugId, newPrice) => {
    await updateDrugPrice(drugId, newPrice, drugDebts);
  };

  const toggleDebtLockHandler = async (debtId) => {
    const debt = drugDebts.find(d => d.id === debtId);
    if (debt) await toggleDebtLock(debt);
  };

  const handleDrugReturn = async (debt, returnQty) => {
    const customer = customers.find(c => c.id === debt.customerId);
    if (!customer) return;
    await returnDrug(debt, returnQty, customer.balance);
  };

  const addServiceDebt = async (customerId, desc, amount) => {
    await addServiceDebtOperations(customerId, desc, amount);
  };

  const deleteServiceDebt = async (debtId) => {
    if (window.confirm("Hatalı işlemleri düzeltmek için: Bu hizmet kaydını iptal etmek istediğinize emin misiniz? (Ödenmiş kısımlar iade edilmez, sadece kalan tutar silinir)")) {
      await deleteServiceDebtOperations(debtId);
    }
  };

  const addDrugDebt = async (customerId, drugId, qty) => {
    const drug = drugs.find(d => String(d.id) === String(drugId));
    if (!drug) return;
    await addDrugDebtOperations(customerId, drug, qty);
  };

  const applyPayment = async (customerId, receivedAmount, distributionArr) => {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;
    await applyPaymentOperations(customer, receivedAmount, distributionArr, serviceDebts, drugDebts);
  };

  if (loading || dataLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center flex-col gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-200 border-t-indigo-600"></div>
        <p className="text-slate-500 font-medium">Veriler Yükleniyor...</p>
      </div>
    );
  }

  if (!currentUser) {
    return <Login />;
  }

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
            onDeleteCustomer={handleDeleteCustomer}
            onUpdateCustomerName={handleUpdateCustomerName}
          />
        )}

        {activeTab === 'drugs' && (
          <DrugsView
            drugs={drugs}
            onUpdatePrice={handleUpdateDrugPrice}
            onAddDrug={handleAddDrug}
            onDeleteDrug={handleDeleteDrug}
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
            onToggleLock={toggleDebtLockHandler}
            onReturnDrug={handleDrugReturn}
            onAddServiceDebt={(desc, amt) => addServiceDebt(selectedCustomerId, desc, amt)}
            onDeleteServiceDebt={deleteServiceDebt}
            onAddDrugDebt={(drugId, qty) => addDrugDebt(selectedCustomerId, drugId, qty)}
            onApplyPayment={(amt, dist) => applyPayment(selectedCustomerId, amt, dist)}
          />
        )}
      </main>
    </div>
  );
}