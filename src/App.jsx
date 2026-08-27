import React, { useState, useCallback, useMemo } from 'react';
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
import { canCancelBatch, cancelBlockedMessage } from './utils/batchCancel';
import { canRevertPriceUpdate, revertBlockedMessage } from './utils/priceImpact';
import { canRevertPayment, revertPaymentBlockedMessage } from './utils/paymentRevert';
import {
  addCustomer,
  deleteCustomer,
  updateCustomerName,
  addDrug,
  deleteDrug,
  updateDrugPrice,
  toggleDebtLock,
  toggleBatchLockOperations,
  returnDrug,
  returnBatchOperations,
  cancelDebtTransactionOperations,
  revertDrugPriceOperations,
  revertPaymentOperations,
  cancelDebtItemOperations,
  addDebtTransactionOperations,
  applyPaymentOperations
} from './services/firestoreOperations';

export default function App() {
  const { currentUser, loading } = useAuth();
  const { customers, drugs, serviceDebts, drugDebts, transactions, dataLoading } = useFirestore(currentUser);
  const { toast, confirm } = useToast();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);

  const handleError = useCallback((err, context) => {
    console.error(`[${context}]`, err);
    toast.error(`İşlem sırasında bir hata oluştu: ${err.message || 'Bilinmeyen hata'}`);
  }, [toast]);

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
      try { await deleteDrug(drugId); }
      catch (err) { handleError(err, 'İlaç Silme'); }
    }
  };

  const handleUpdateDrugPrice = async (drugId, newPrice) => {
    const drug = drugs.find(d => d.id === drugId);
    try {
      await updateDrugPrice(drugId, newPrice, drugDebts, currentUser.uid, drug?.price);
      toast.success('Fiyat güncellendi');
    }
    catch (err) { handleError(err, 'Fiyat Güncelleme'); }
  };

  /**
   * Bir ilacın son zammını geri alır; hangi grubun geri alınacağına guard karar verir.
   * Modal açıkken araya işlem girebileceği için guard yazımdan hemen önce tekrar çalışır.
   */
  const handleRevertDrugPrice = async (drugId, priceLogs) => {
    const fresh = canRevertPriceUpdate(drugId, transactions, drugDebts);
    if (!fresh.ok) {
      toast.error(revertBlockedMessage(fresh.reason));
      return;
    }
    try {
      await revertDrugPriceOperations(drugId, priceLogs, currentUser.uid);
      toast.success('Zam geri alındı');
    }
    catch (err) { handleError(err, 'Zam Geri Alma'); }
  };

  const toggleDebtLockHandler = useCallback(async (debtId) => {
    const debt = drugDebts.find(d => d.id === debtId);
    if (!debt) return;
    try { await toggleDebtLock(debt, currentUser.uid); }
    catch (err) { handleError(err, 'Kilit Değiştirme'); }
  }, [drugDebts, currentUser, handleError]);

  const toggleBatchLockHandler = useCallback(async (debts) => {
    if (!debts || debts.length === 0) return;
    try { await toggleBatchLockOperations(debts, currentUser.uid); }
    catch (err) { handleError(err, 'Toplu Kilit Değiştirme'); }
  }, [currentUser, handleError]);

  const handleDrugReturn = useCallback(async (debt, returnQty) => {
    const customer = customers.find(c => c.id === debt.customerId);
    if (!customer) return;
    try { await returnDrug(debt, returnQty, customer.balance, currentUser.uid); }
    catch (err) { handleError(err, 'İade İşlemi'); }
  }, [customers, currentUser, handleError]);

  const handleBatchReturn = useCallback(async (items) => {
    if (!items || items.length === 0) return;
    const customer = customers.find(c => c.id === items[0].debt.customerId);
    if (!customer) return;
    try { await returnBatchOperations(items, customer.balance, currentUser.uid); toast.success('İade işlemi uygulandı'); }
    catch (err) { handleError(err, 'Toplu İade'); }
  }, [customers, currentUser, toast, handleError]);

  /**
   * Yanlış girilen bir işlemin tüm kalemlerini gerekçeyle iptal eder.
   *
   * Guard yazımdan **hemen önce** tekrar çalıştırılır: modal açıkken (kullanıcı gerekçe
   * yazarken) başka bir cihazdan tahsilat inebilir. Buton durumu `onSnapshot` ile canlı
   * güncelleniyor ama modal kendi anlık görüntüsünü tutuyor.
   */
  const handleCancelBatch = useCallback(async (group, reason) => {
    if (!group?.batchId || !reason) return;

    const fresh = canCancelBatch(group, transactions);
    if (!fresh.ok) {
      toast.error(cancelBlockedMessage(fresh.reason));
      return;
    }

    const customerId = group.items?.[0]?.customerId ?? selectedCustomerId;
    try {
      await cancelDebtTransactionOperations(customerId, group.items, group.batchId, reason, currentUser.uid);
      toast.success('İşlem iptal edildi');
    } catch (err) { handleError(err, 'İşlem İptali'); }
  }, [selectedCustomerId, transactions, currentUser, toast, handleError]);

  /** Tek bir borç kalemini (hizmet veya ilaç) gerekçeyle iptal eder. */
  const handleCancelItem = useCallback(async (item, reason) => {
    if (!item || !reason) return;
    const customerId = item.customerId ?? selectedCustomerId;
    try {
      await cancelDebtItemOperations(customerId, item, reason, currentUser.uid);
      toast.success('Kalem iptal edildi');
    } catch (err) { handleError(err, 'Kalem İptali'); }
  }, [selectedCustomerId, currentUser, toast, handleError]);

  /** Bir ziyarette girilen hizmet ve ilaç kalemlerini tek atomik işlem olarak yazar. */
  const addDebtTransaction = useCallback(async (customerId, payload) => {
    const resolvedItems = (payload.drugItems || []).map(row => {
      const drug = drugs.find(d => String(d.id) === String(row.drugId));
      if (!drug) return null;
      return { drug, qty: row.qty, unitPrice: row.unitPrice };
    }).filter(Boolean);

    if (!payload.service && resolvedItems.length === 0) return;

    try {
      await addDebtTransactionOperations(customerId, { ...payload, drugItems: resolvedItems }, currentUser.uid);
    } catch (err) { handleError(err, 'Borç Ekleme'); }
  }, [drugs, currentUser, handleError]);

  /**
   * Son tahsilatı gerekçeyle geri alır. Guard yazımdan hemen önce tekrar çalışır: modal
   * açıkken (kullanıcı gerekçe yazarken) başka bir cihazdan işlem inebilir.
   */
  const handleRevertPayment = useCallback(async (batch, reason) => {
    const customer = customers.find(c => c.id === selectedCustomerId);
    if (!customer || !batch || !reason) return;

    const fresh = canRevertPayment(customer.id, transactions);
    if (!fresh.ok) {
      toast.error(revertPaymentBlockedMessage(fresh.reason));
      return;
    }

    try {
      await revertPaymentOperations(customer, fresh.batch.logs, reason, currentUser.uid);
      toast.success('Tahsilat geri alındı');
    } catch (err) { handleError(err, 'Tahsilat Geri Alma'); }
  }, [customers, selectedCustomerId, transactions, currentUser, toast, handleError]);

  const applyPayment = useCallback(async (customerId, receivedAmount, distributionArr) => {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;
    try { await applyPaymentOperations(customer, receivedAmount, distributionArr, serviceDebts, drugDebts, currentUser.uid); toast.success('Tahsilat başarıyla uygulandı'); }
    catch (err) { handleError(err, 'Tahsilat'); }
  }, [customers, serviceDebts, drugDebts, currentUser, toast, handleError]);

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
      onToggleBatchLock: toggleBatchLockHandler, onReturnBatch: handleBatchReturn,
      onCancelBatch: handleCancelBatch,
      onRevertPayment: handleRevertPayment,
      onCancelItem: handleCancelItem,
      onAddDebtTransaction: (payload) => addDebtTransaction(selectedCustomerId, payload),
      onApplyPayment: (amt, dist) => applyPayment(selectedCustomerId, amt, dist),
    };
  }, [selectedCustomerId, customers, drugs, serviceDebts, drugDebts, transactions,
      toggleDebtLockHandler, handleDrugReturn, toggleBatchLockHandler, handleBatchReturn,
      handleCancelBatch, handleRevertPayment, handleCancelItem, addDebtTransaction, applyPayment]);

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
            onSelectCustomer={(id) => { setSelectedCustomerId(id); setActiveTab('customerDetail'); }}
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
            drugDebts={drugDebts}
            customers={customers}
            transactions={transactions}
            onUpdatePrice={handleUpdateDrugPrice}
            onRevertPrice={handleRevertDrugPrice}
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
