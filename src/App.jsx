import React, { useState, useCallback, useMemo } from 'react';
import Header from './components/layout/Header';
import DashboardView from './components/dashboard/DashboardView';
import CustomersView from './components/customers/CustomersView';
import CustomerDetail from './components/customers/CustomerDetail';
import DrugsView from './components/drugs/DrugsView';
import ReportsView from './components/reports/ReportsView';
import { useAuth } from './hooks/useAuth';
import Login from './components/auth/Login';
import { useClinic } from './hooks/useClinic';
import { useMyInvite } from './hooks/useMyInvite';
import { useClinicAdmin } from './hooks/useClinicAdmin';
import ClinicView from './components/clinic/ClinicView';
import { joinClinic } from './services/clinicOperations';
import { useFirestore } from './hooks/useFirestore';
import { useToast } from './hooks/useToast';
import { CustomerProvider } from './contexts/CustomerContext';
import { ledgerGate } from './utils/ledgerGate';
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

/**
 * `debtId → rev` haritası: guard'ın gördüğü sürümleri yazma yoluna taşır (TASK-033).
 * Yazım anında doküman bu sürümden farklıysa işlem yazılmaz ve kullanıcıya bildirilir.
 */
const revsOf = (...debtArrays) => {
  const out = {};
  for (const arr of debtArrays) for (const d of arr || []) out[d.id] = d.rev;
  return out;
};

export default function App() {
  const { currentUser, loading } = useAuth();
  const { clinicId, role, loading: clinicLoading, error: clinicError } = useClinic(currentUser);
  // Davet YALNIZCA uyeligi olmayan icin aranir; uyesi olanin davete bakmasi gereksiz okuma
  const { invite, loading: inviteLoading } = useMyInvite(currentUser, { enabled: !clinicLoading && !clinicId });
  const { clinic, invites } = useClinicAdmin(clinicId, role);
  const { customers, drugs, serviceDebts, drugDebts, transactions, dataLoading } = useFirestore(clinicId);
  const { toast, confirm } = useToast();

  // Yazma işlemlerinin taşıdığı kimlik (TASK-038a): kim yaptı + hangi defter.
  // Tek nesne, çünkü iki ayrı konumsal parametre yer değiştirse hata SESSİZ olurdu.
  // Göç tamamlanana kadar `clinicId` null; `ownerFields` alanı o zaman hiç yazmaz.
  // `role` de session'da: sahip gerektiren islemler (`requireOwner`) ve iptal guard'i
  // ayni kimlik nesnesinden okusun — rolun ayri bir yoldan gelmesi ikisinin ayrismasina
  // acik kapi birakirdi.
  const session = useMemo(
    () => ({ actorId: currentUser?.uid ?? null, clinicId, role }),
    [currentUser, clinicId, role]
  );
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
    try { await addCustomer(name, session); toast.success('Müşteri eklendi'); }
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
        await deleteCustomer(customerId, session);
        setSelectedCustomerId(null);
        toast.success('Müşteri silindi');
      } catch (err) { handleError(err, 'Müşteri Silme'); }
    }
  };

  const handleAddDrug = async (name, price, catalogMeta) => {
    // Kesin katman: ayni katalog kalemi ikinci kez eklenemez
    if (catalogMeta?.catalogId && drugs.some(d => d.catalogId === catalogMeta.catalogId)) {
      toast.warning('Bu katalog kalemi listenizde zaten var.');
      return;
    }
    const trimmedInfo = name.trim().toLowerCase();
    const exists = drugs.some(d => d.name.trim().toLowerCase() === trimmedInfo);
    if (exists) {
      toast.warning(`"${name}" adında bir ilaç sistemde zaten mevcut! Fiyatını değiştirmek için "Fiyatı Güncelle" butonunu kullanabilirsiniz.`);
      return;
    }
    try { await addDrug(name, price, session, catalogMeta); toast.success('İlaç eklendi'); }
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
      try { await deleteDrug(drugId, session); }
      catch (err) { handleError(err, 'İlaç Silme'); }
    }
  };

  const handleUpdateDrugPrice = async (drugId, newPrice) => {
    const drug = drugs.find(d => d.id === drugId);
    try {
      await updateDrugPrice(drugId, newPrice, drugDebts, session, drug?.price);
      toast.success('Fiyat güncellendi');
    }
    catch (err) { handleError(err, 'Fiyat Güncelleme'); }
  };

  /**
   * Bir ilacın son zammını geri alır; hangi grubun geri alınacağına guard karar verir.
   * Modal açıkken araya işlem girebileceği için guard yazımdan hemen önce tekrar çalışır.
   */
  const handleRevertDrugPrice = async (drugId) => {
    const fresh = canRevertPriceUpdate(drugId, transactions, drugDebts);
    if (!fresh.ok) {
      toast.error(revertBlockedMessage(fresh.reason));
      return;
    }
    try {
      // Modal'ın taşıdığı `priceLogs` bayat olabilir; yazıma guard'ın taze grubu gider
      const res = await revertDrugPriceOperations(
        drugId, fresh.batch.logs, session, revsOf(drugDebts)
      );
      if (!res.ok) { toast.error(revertBlockedMessage(res.reason)); return; }
      toast.success('Zam geri alındı');
    }
    catch (err) { handleError(err, 'Zam Geri Alma'); }
  };

  const toggleDebtLockHandler = useCallback(async (debtId) => {
    const debt = drugDebts.find(d => d.id === debtId);
    if (!debt) return;
    try { await toggleDebtLock(debt, session); }
    catch (err) { handleError(err, 'Kilit Değiştirme'); }
  }, [drugDebts, session, handleError]);

  const toggleBatchLockHandler = useCallback(async (debts) => {
    if (!debts || debts.length === 0) return;
    try { await toggleBatchLockOperations(debts, session); }
    catch (err) { handleError(err, 'Toplu Kilit Değiştirme'); }
  }, [session, handleError]);

  const handleDrugReturn = useCallback(async (debt, returnQty) => {
    const customer = customers.find(c => c.id === debt.customerId);
    if (!customer) return;
    try { await returnDrug(debt, returnQty, customer.balance, session); }
    catch (err) { handleError(err, 'İade İşlemi'); }
  }, [customers, session, handleError]);

  const handleBatchReturn = useCallback(async (items) => {
    if (!items || items.length === 0) return;
    const customer = customers.find(c => c.id === items[0].debt.customerId);
    if (!customer) return;
    try { await returnBatchOperations(items, customer.balance, session); toast.success('İade işlemi uygulandı'); }
    catch (err) { handleError(err, 'Toplu İade'); }
  }, [customers, session, toast, handleError]);

  /**
   * Yanlış girilen bir işlemin tüm kalemlerini gerekçeyle iptal eder.
   *
   * Guard yazımdan **hemen önce** tekrar çalıştırılır: modal açıkken (kullanıcı gerekçe
   * yazarken) başka bir cihazdan tahsilat inebilir. Buton durumu `onSnapshot` ile canlı
   * güncelleniyor ama modal kendi anlık görüntüsünü tutuyor.
   */
  const handleCancelBatch = useCallback(async (group, reason) => {
    if (!group?.batchId || !reason) return;

    const fresh = canCancelBatch(group, transactions, { uid: session.actorId, role: session.role });
    if (!fresh.ok) {
      toast.error(cancelBlockedMessage(fresh.reason));
      return;
    }

    const customerId = group.items?.[0]?.customerId ?? selectedCustomerId;
    try {
      const res = await cancelDebtTransactionOperations(
        customerId, group.items, group.batchId, reason, session,
        revsOf(serviceDebts, drugDebts)
      );
      if (!res.ok) { toast.error(cancelBlockedMessage(res.reason)); return; }
      toast.success('İşlem iptal edildi');
    } catch (err) { handleError(err, 'İşlem İptali'); }
  }, [selectedCustomerId, transactions, serviceDebts, drugDebts, session, toast, handleError]);

  /** Tek bir borç kalemini (hizmet veya ilaç) gerekçeyle iptal eder. */
  const handleCancelItem = useCallback(async (item, reason) => {
    if (!item || !reason) return;
    const customerId = item.customerId ?? selectedCustomerId;
    try {
      await cancelDebtItemOperations(customerId, item, reason, session);
      toast.success('Kalem iptal edildi');
    } catch (err) { handleError(err, 'Kalem İptali'); }
  }, [selectedCustomerId, session, toast, handleError]);

  /** Bir ziyarette girilen hizmet ve ilaç kalemlerini tek atomik işlem olarak yazar. */
  const addDebtTransaction = useCallback(async (customerId, payload) => {
    const resolvedItems = (payload.drugItems || []).map(row => {
      const drug = drugs.find(d => String(d.id) === String(row.drugId));
      if (!drug) return null;
      return { drug, qty: row.qty, unitPrice: row.unitPrice };
    }).filter(Boolean);

    if (!payload.service && resolvedItems.length === 0) return;

    try {
      await addDebtTransactionOperations(customerId, { ...payload, drugItems: resolvedItems }, session);
    } catch (err) { handleError(err, 'Borç Ekleme'); }
  }, [drugs, session, handleError]);

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
      const res = await revertPaymentOperations(
        customer, fresh.batch.logs, reason, session,
        revsOf(serviceDebts, drugDebts)
      );
      if (!res.ok) { toast.error(revertPaymentBlockedMessage(res.reason)); return; }
      toast.success('Tahsilat geri alındı');
    } catch (err) { handleError(err, 'Tahsilat Geri Alma'); }
  }, [customers, selectedCustomerId, transactions, serviceDebts, drugDebts, session, toast, handleError]);

  const applyPayment = useCallback(async (customerId, receivedAmount, distributionArr) => {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;
    try { await applyPaymentOperations(customer, receivedAmount, distributionArr, serviceDebts, drugDebts, session); toast.success('Tahsilat başarıyla uygulandı'); }
    catch (err) { handleError(err, 'Tahsilat'); }
  }, [customers, serviceDebts, drugDebts, session, toast, handleError]);

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
      // Iptal guard'i ve rol'e gore gizlenen dugmeler icin: ekrani goren kisi kim
      viewer: { uid: session.actorId, role: session.role },
      onToggleLock: toggleDebtLockHandler, onReturnDrug: handleDrugReturn,
      onToggleBatchLock: toggleBatchLockHandler, onReturnBatch: handleBatchReturn,
      onCancelBatch: handleCancelBatch,
      onRevertPayment: handleRevertPayment,
      onCancelItem: handleCancelItem,
      onAddDebtTransaction: (payload) => addDebtTransaction(selectedCustomerId, payload),
      onApplyPayment: (amt, dist) => applyPayment(selectedCustomerId, amt, dist),
    };
  }, [selectedCustomerId, customers, drugs, serviceDebts, drugDebts, transactions, session,
      toggleDebtLockHandler, handleDrugReturn, toggleBatchLockHandler, handleBatchReturn,
      handleCancelBatch, handleRevertPayment, handleCancelItem, addDebtTransaction, applyPayment]);

  // Defterin gosterilip gosterilmeyecegi TEK yerde karar veriliyor (`utils/ledgerGate.js`).
  // Art arda if bloklariyken sirasi yanlis olsa hata sessiz ve agir olurdu: uyelik daha
  // yuklenmemisken "klinik yok" demek, kullaniciya defterini BOS gostermek demek.
  const gate = ledgerGate({
    authLoading: loading, currentUser,
    clinicLoading, clinicError, clinicId,
    inviteLoading, hasInvite: !!invite,
    dataLoading,
  });

  if (gate === 'login') return <Login />;

  if (gate === 'auth-loading' || gate === 'clinic-loading' || gate === 'data-loading') {
    const mesaj = {
      'auth-loading': 'Sistem Hazırlanıyor...',
      'clinic-loading': 'Defteriniz Hazırlanıyor...',
      'data-loading': 'Verileriniz Getiriliyor...',
    }[gate];
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center flex-col gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-200 border-t-indigo-600"></div>
        <p className="text-slate-500 font-medium">{mesaj}</p>
      </div>
    );
  }

  if (gate === 'clinic-error') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-amber-200 p-6 text-center">
          <p className="text-slate-800 font-bold mb-2">Defterinize şu an ulaşılamıyor</p>
          <p className="text-sm text-slate-600">
            Bağlantı kurulamadı. İnternetinizi kontrol edip sayfayı yenileyin. Verileriniz
            yerinde duruyor — bu ekran yalnızca erişimin kurulamadığını söylüyor.
          </p>
        </div>
      </div>
    );
  }

  if (gate === 'has-invite') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-slate-200 p-6 text-center">
          <p className="text-slate-800 font-bold mb-2">Bir kliniğe davet edildiniz</p>
          <p className="text-sm text-slate-600 mb-5">
            Katıldığınızda kliniğin defterini görür ve işlem yapabilirsiniz. Girdiğiniz her
            kayıt sizin adınıza kaydedilir.
          </p>
          <button
            onClick={async () => {
              try { await joinClinic(invite, currentUser); toast.success('Kliniğe katıldınız'); }
              catch (err) { handleError(err, 'Kliniğe Katılma'); }
            }}
            className="w-full px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors touch-target"
          >
            Kliniğe Katıl
          </button>
        </div>
      </div>
    );
  }

  if (gate === 'no-clinic') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-slate-200 p-6 text-center">
          <p className="text-slate-800 font-bold mb-2">Hesabınız bir kliniğe bağlı değil</p>
          <p className="text-sm text-slate-600">
            Bu hesap henüz bir defterle ilişkilendirilmemiş. Klinik sahibinden sizi eklemesini
            isteyin.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-12">
      <Header activeTab={activeTab} onNavigate={setActiveTab} role={role} />

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

        {activeTab === 'reports' && (
          <ReportsView transactions={transactions} />
        )}

        {/* Sekme yalnizca sahibe ciziliyor (Header), ama `role` kontrolu BURADA da var:
            sekme adi state'te tutuldugu icin rol degisse bile ekran acik kalmasin. */}
        {activeTab === 'clinic' && role === 'owner' && (
          <ClinicView session={session} clinic={clinic} invites={invites} />
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
