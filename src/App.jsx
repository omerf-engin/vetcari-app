import React, { useState, useMemo } from 'react';
import Header from './components/layout/Header';
import DashboardView from './components/dashboard/DashboardView';
import CustomersView from './components/customers/CustomersView';
import CustomerDetail from './components/customers/CustomerDetail';
import DrugsView from './components/drugs/DrugsView';
import { useAuth } from './hooks/useAuth';
import Login from './components/auth/Login';
import { useFirestore } from './hooks/useFirestore';
import { useToast } from './hooks/useToast';
import { CustomerProvider } from './contexts/CustomerContext';
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
  addBulkDrugDebtOperations,
  applyPaymentOperations,
  addPastServiceDebtOperations
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
    try { await addCustomer(name, currentUser.uid); toast.success('Müşteri eklendi'); }
    catch (err) { handleError(err, 'Müşteri Ekleme'); }
  };

  const handleUpdateCustomerName = async (customerId, newName) => {
    const trimmedInfo = newName.trim().toLowerCase();
    const exists = customers.some(c => c.id !== customerId && c.name.trim().toLowerCase() === trimmedInfo);
    if (exists) {
      toast.warning(`"${newName}" adında bir müşteri zaten kayıtlı!`);
      return;
    }
    try { await updateCustomerName(customerId, newName, currentUser.uid); }
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
        await deleteCustomer(customerId, currentUser.uid);
        setSelectedCustomerId(null);
        toast.success('Müşteri silindi');
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
    try { await addDrug(name, price, currentUser.uid); toast.success('İlaç eklendi'); }
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
      try { await deleteDrug(drugId, currentUser.uid); }
      catch (err) { handleError(err, 'İlaç Silme'); }
    }
  };

  const handleUpdateDrugPrice = async (drugId, newPrice) => {
    try { await updateDrugPrice(drugId, newPrice, drugDebts, currentUser.uid); toast.success('Fiyat güncellendi'); }
    catch (err) { handleError(err, 'Fiyat Güncelleme'); }
  };

  const toggleDebtLockHandler = async (debtId) => {
    const debt = drugDebts.find(d => d.id === debtId);
    if (!debt) return;
    try { await toggleDebtLock(debt, currentUser.uid); }
    catch (err) { handleError(err, 'Kilit Değiştirme'); }
  };

  const handleDrugReturn = async (debt, returnQty) => {
    const customer = customers.find(c => c.id === debt.customerId);
    if (!customer) return;
    try { await returnDrug(debt, returnQty, customer.balance, currentUser.uid); }
    catch (err) { handleError(err, 'İade İşlemi'); }
  };

  const addServiceDebt = async (customerId, desc, amount) => {
    try { await addServiceDebtOperations(customerId, desc, amount, currentUser.uid); }
    catch (err) { handleError(err, 'Hizmet Borcu Ekleme'); }
  };

  const deleteServiceDebt = async (debtId) => {
    const ok = await confirm(
      "Hizmet Kaydı İptali",
      "Bu hizmet kaydını iptal etmek istediğinize emin misiniz? Ödenmiş kısımlar iade edilmez, sadece kalan tutar silinir."
    );
    if (ok) {
      try { await deleteServiceDebtOperations(debtId, currentUser.uid); }
      catch (err) { handleError(err, 'Hizmet Borcu Silme'); }
    }
  };

  const addBulkDrugDebt = async (customerId, items, date, paidAmount, paidDate, applyInflation) => {
    const resolvedItems = items.map(item => {
      const drug = drugs.find(d => String(d.id) === String(item.drugId));
      if (!drug) return null;
      return { drug, qty: item.qty, unitPrice: item.unitPrice };
    }).filter(Boolean);
    if (resolvedItems.length === 0) return;
    try { await addBulkDrugDebtOperations(customerId, resolvedItems, date, paidAmount, paidDate, applyInflation, currentUser.uid); }
    catch (err) { handleError(err, 'Toplu İlaç Borcu'); }
  };

  const addPastServiceDebt = async (customerId, desc, amount, date, paidAmount, paidDate) => {
    try { await addPastServiceDebtOperations(customerId, desc, amount, date, paidAmount, paidDate, currentUser.uid); }
    catch (err) { handleError(err, 'Geçmiş Hizmet Borcu'); }
  };

  const applyPayment = async (customerId, receivedAmount, distributionArr) => {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;
    try { await applyPaymentOperations(customer, receivedAmount, distributionArr, serviceDebts, drugDebts, currentUser.uid); toast.success('Tahsilat başarıyla uygulandı'); }
    catch (err) { handleError(err, 'Tahsilat'); }
  };

  const customerProviderValue = useMemo(() => {
    if (!selectedCustomerId) return null;
    const customer = customers.find(c => c.id === selectedCustomerId);
    const custServiceDebts = serviceDebts.filter(d => d.customerId === selectedCustomerId);
    const custDrugDebts = drugDebts.filter(d => d.customerId === selectedCustomerId);
    const debtIds = new Set([...custServiceDebts.map(d => d.id), ...custDrugDebts.map(d => d.id)]);
    const custTransactions = transactions.filter(t =>
      t.customerId === selectedCustomerId || (!t.customerId && debtIds.has(t.debtId))
    );
    return {
      customer, drugs,
      serviceDebts: custServiceDebts, drugDebts: custDrugDebts,
      transactions: custTransactions,
      onToggleLock: toggleDebtLockHandler, onReturnDrug: handleDrugReturn,
      onAddServiceDebt: (desc, amt) => addServiceDebt(selectedCustomerId, desc, amt),
      onDeleteServiceDebt: deleteServiceDebt,
      onAddBulkDrugDebt: (items, date, paidAmount, paidDate, applyInflation) => addBulkDrugDebt(selectedCustomerId, items, date, paidAmount, paidDate, applyInflation),
      onApplyPayment: (amt, dist) => applyPayment(selectedCustomerId, amt, dist),
      onAddPastServiceDebt: (desc, amount, date, paidAmount, paidDate) => addPastServiceDebt(selectedCustomerId, desc, amount, date, paidAmount, paidDate),
    };
  }, [selectedCustomerId, customers, drugs, serviceDebts, drugDebts, transactions,
      toggleDebtLockHandler, handleDrugReturn, addServiceDebt, deleteServiceDebt,
      addBulkDrugDebt, applyPayment, addPastServiceDebt]);

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

        {activeTab === 'customerDetail' && selectedCustomerId && customerProviderValue && (
          <CustomerProvider value={customerProviderValue}>
            <CustomerDetail
              onBack={() => { setActiveTab('customers'); setSelectedCustomerId(null); }}
            />
          </CustomerProvider>
        )}
      </main>
    </div>
  );
}
