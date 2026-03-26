import React, { useState } from 'react';
import Header from './components/layout/Header';
import DashboardView from './components/dashboard/DashboardView';
import CustomersView from './components/customers/CustomersView';
import CustomerDetail from './components/customers/CustomerDetail';
import DrugsView from './components/drugs/DrugsView';
import { useAuth } from './hooks/useAuth';
import Login from './components/auth/Login';
import { useFirestore } from './hooks/useFirestore';
import { useToast } from './hooks/useToast';
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
  const { customers, drugs, serviceDebts, drugDebts, transactions, dataLoading } = useFirestore(currentUser);
  const { toast, confirm } = useToast();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);

  const handleError = (err, context) => {
    console.error(`[${context}]`, err);
    toast.error(`İşlem sırasında bir hata oluştu: ${err.message || 'Bilinmeyen hata'}`);
  };

  const handleAddCustomer = async (name) => {
    const trimmedInfo = name.trim().toLowerCase();
    const exists = customers.some(c => c.name.trim().toLowerCase() === trimmedInfo);
    if (exists) {
      toast.warning(`"${name}" adında bir müşteri zaten kayıtlı! Lütfen ayırt edici bir ek belirterek farklı bir isim girin.`);
      return;
    }
    try { await addCustomer(name); }
    catch (err) { handleError(err, 'Müşteri Ekleme'); }
  };

  const handleUpdateCustomerName = async (customerId, newName) => {
    const trimmedInfo = newName.trim().toLowerCase();
    const exists = customers.some(c => c.id !== customerId && c.name.trim().toLowerCase() === trimmedInfo);
    if (exists) {
      toast.warning(`"${newName}" adında bir müşteri zaten kayıtlı!`);
      return;
    }
    try { await updateCustomerName(customerId, newName); }
    catch (err) { handleError(err, 'İsim Güncelleme'); }
  };

  const handleDeleteCustomer = async (customerId, grossDebt, balance) => {
    const g = Math.round(Number(grossDebt) * 100) / 100;
    const b = Math.round(Number(balance) * 100) / 100;
    const netReceivable = Math.max(0, Math.round((g - b) * 100) / 100);

    if (netReceivable > 0.01) {
      toast.error(
        "Bu müşterinin ödenmemiş net borcu bulunduğu için silinemez. Önce tahsilat yapın veya borçları kapatın."
      );
      return;
    }

    const extra = [];
    if (g > 0.01) extra.push("borç kayıtları");
    if (b > 0.01) extra.push("avans bakiyesi");
    const detail =
      extra.length > 0
        ? ` İlişikteki ${extra.join(" ve ")} de kalıcı olarak silinecek.`
        : "";

    const ok = await confirm(
      "Müşteri Silme",
      `Bu müşteriyi sistemden kalıcı olarak silmek istediğinize emin misiniz?${detail}`
    );
    if (ok) {
      try {
        await deleteCustomer(customerId);
        setSelectedCustomerId(null);
      } catch (err) { handleError(err, 'Müşteri Silme'); }
    }
  };

  const handleAddDrug = async (name, price) => {
    const trimmedInfo = name.trim().toLowerCase();
    const exists = drugs.some(d => d.name.trim().toLowerCase() === trimmedInfo);
    if (exists) {
      toast.warning(`"${name}" adında bir ilaç sistemde zaten mevcut! Fiyatını değiştirmek için "Fiyatı Güncelle" butonunu kullanabilirsiniz.`);
      return;
    }
    try { await addDrug(name, price); }
    catch (err) { handleError(err, 'İlaç Ekleme'); }
  };

  const handleDeleteDrug = async (drugId) => {
    const hasActiveDebt = drugDebts.some(d => d.drugId === drugId && d.qty > 0);
    if (hasActiveDebt) {
      toast.error("Bu ilacın ödenmemiş aktif müşteri borçları bulunduğu için sistemden silinemez!");
      return;
    }
    const ok = await confirm(
      "İlaç Silme",
      "Bu ilacı kalıcı olarak silmek istediğinize emin misiniz? Müşterilerin geçmiş ekstresinde ilacın adı 'Bilinmeyen İlaç' olarak görünebilir."
    );
    if (ok) {
      try { await deleteDrug(drugId); }
      catch (err) { handleError(err, 'İlaç Silme'); }
    }
  };

  const handleUpdateDrugPrice = async (drugId, newPrice) => {
    try { await updateDrugPrice(drugId, newPrice, drugDebts); }
    catch (err) { handleError(err, 'Fiyat Güncelleme'); }
  };

  const toggleDebtLockHandler = async (debtId) => {
    const debt = drugDebts.find(d => d.id === debtId);
    if (!debt) return;
    try { await toggleDebtLock(debt); }
    catch (err) { handleError(err, 'Kilit Değiştirme'); }
  };

  const handleDrugReturn = async (debt, returnQty) => {
    const customer = customers.find(c => c.id === debt.customerId);
    if (!customer) return;
    try { await returnDrug(debt, returnQty, customer.balance); }
    catch (err) { handleError(err, 'İade İşlemi'); }
  };

  const addServiceDebt = async (customerId, desc, amount) => {
    try { await addServiceDebtOperations(customerId, desc, amount); }
    catch (err) { handleError(err, 'Hizmet Borcu Ekleme'); }
  };

  const deleteServiceDebt = async (debtId) => {
    const ok = await confirm(
      "Hizmet Kaydı İptali",
      "Bu hizmet kaydını iptal etmek istediğinize emin misiniz? Ödenmiş kısımlar iade edilmez, sadece kalan tutar silinir."
    );
    if (ok) {
      try { await deleteServiceDebtOperations(debtId); }
      catch (err) { handleError(err, 'Hizmet Borcu Silme'); }
    }
  };

  const addDrugDebt = async (customerId, drugId, qty) => {
    const drug = drugs.find(d => String(d.id) === String(drugId));
    if (!drug) return;
    try { await addDrugDebtOperations(customerId, drug, qty); }
    catch (err) { handleError(err, 'İlaç Borcu Ekleme'); }
  };

  const applyPayment = async (customerId, receivedAmount, distributionArr) => {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;
    try { await applyPaymentOperations(customer, receivedAmount, distributionArr, serviceDebts, drugDebts); }
    catch (err) { handleError(err, 'Tahsilat'); }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center flex-col gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-200 border-t-indigo-600"></div>
        <p className="text-slate-500 font-medium">Sistem Hazırlanıyor...</p>
      </div>
    );
  }

  if (!currentUser) {
    return <Login />;
  }

  if (dataLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center flex-col gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-200 border-t-indigo-600"></div>
        <p className="text-slate-500 font-medium">Verileriniz Getiriliyor...</p>
      </div>
    );
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
