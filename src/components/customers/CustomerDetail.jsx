import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ArrowLeft, CreditCard, Lock, Unlock, History, Undo, Undo2, Plus, Clock, ChevronDown, ChevronRight, Ban, Download } from 'lucide-react';
import { fmtTL, fmtQty, fmtDate } from '../../utils/formatters';
import { groupDebtsByBatch } from '../../utils/debtGrouping';
import { canCancelBatch, canCancelOrphanBatch, cancelBlockedMessage, cancelledBatchIds, cancelledDebtIds } from '../../utils/batchCancel';
import { canRevertPayment, revertPaymentBlockedMessage } from '../../utils/paymentRevert';
import PaymentModal from '../modals/PaymentModal';
import HistoryModal from '../modals/HistoryModal';
import DebtModal from '../modals/DebtModal';
import BatchReturnModal from '../modals/BatchReturnModal';
import CancelBatchModal from '../modals/CancelBatchModal';
import RevertPaymentModal from '../modals/RevertPaymentModal';
import StatementExportModal from '../modals/StatementExportModal';
import { useCustomer } from '../../hooks/useCustomer';

export default function CustomerDetail({ onBack }) {
  const { customer, drugs, serviceDebts, drugDebts, transactions, onToggleLock, onReturnDrug, onCancelItem, onToggleBatchLock, onReturnBatch, onCancelBatch, onRevertPayment } = useCustomer();
  const [isPaymentModalOpen, setPaymentModalOpen] = useState(false);
  const [historyDebtId, setHistoryDebtId] = useState(null);
  const [showCustomerHistory, setShowCustomerHistory] = useState(false);
  const [returnModalDebt, setReturnModalDebt] = useState(null);
  const [returnInputQty, setReturnInputQty] = useState('');
  const [debtModalMode, setDebtModalMode] = useState(null);
  const [expandedBatches, setExpandedBatches] = useState(() => new Set());
  const [batchReturnId, setBatchReturnId] = useState(null);
  const [historyBatchId, setHistoryBatchId] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [isRevertPaymentOpen, setRevertPaymentOpen] = useState(false);
  const [cancelItem, setCancelItem] = useState(null);
  const [isExportOpen, setExportOpen] = useState(false);

  const closeReturnModal = useCallback(() => setReturnModalDebt(null), []);

  useEffect(() => {
    if (!returnModalDebt) return;
    const handleKey = (e) => { if (e.key === 'Escape') closeReturnModal(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [returnModalDebt, closeReturnModal]);

  const toggleBatch = useCallback((batchId) => {
    setExpandedBatches(prev => {
      const next = new Set(prev);
      if (next.has(batchId)) next.delete(batchId);
      else next.add(batchId);
      return next;
    });
  }, []);

  const extreDDebts = useMemo(() => drugDebts.map(d => ({
    ...d,
    tlValue: d.qty * d.maxPrice,
    drugName: drugs.find(x => x.id === d.drugId)?.name || 'Bilinmeyen İlaç'
  })), [drugDebts, drugs]);

  const debtGroups = useMemo(() => groupDebtsByBatch(serviceDebts, extreDDebts), [serviceDebts, extreDDebts]);

  // Modallar id tutar; grup verisi her zaman guncel snapshot'tan cozulur
  const batchReturnGroup = useMemo(
    () => debtGroups.find(g => g.batchId === batchReturnId) || null,
    [debtGroups, batchReturnId]
  );

  // Kartı olan işlem gruptan çözülür; süpürülmüş (dokümansız) işlem için ekstredeki
  // başlık bilgisiyle kalemsiz geçici bir grup kurulur
  const cancelGroup = useMemo(() => {
    if (!cancelTarget) return null;
    return debtGroups.find(g => g.batchId === cancelTarget.batchId)
      || { batchId: cancelTarget.batchId, date: cancelTarget.date, items: [], itemCount: 0, total: 0 };
  }, [debtGroups, cancelTarget]);

  // Son tahsilat geri alinabilir mi? `legacy`/`not-latest` durumunda buton hic gosterilmez —
  // geri alinacak bir sey yokken kalici pasif buton gurultusu olmasin (TASK-032 kurali)
  const revertPaymentState = useMemo(
    () => canRevertPayment(customer.id, transactions),
    [customer.id, transactions]
  );
  const showRevertPayment = revertPaymentState.ok || revertPaymentState.reason === 'activity';

  // İptal edilebilirlik grup bazinda onceden hesaplanir (guard loglara bakar)
  const cancelStateByBatch = useMemo(() => {
    const map = new Map();
    debtGroups.forEach(g => map.set(g.batchId, canCancelBatch(g, transactions)));
    return map;
  }, [debtGroups, transactions]);

  const totalServiceDebt = serviceDebts.reduce((sum, d) => sum + d.amount, 0);
  const totalDrugDebt = extreDDebts.reduce((sum, d) => sum + d.tlValue, 0);
  const grossDebt = totalServiceDebt + totalDrugDebt;
  const netDebt = Math.max(0, grossDebt - customer.balance);

  // İptal durumu ayrı bir alanda saklanmaz, iptal loglarından türetilir — işlem bazında
  // (`batchId`) ve kalem bazında (`debtId`) ayrı ayrı
  const cancelledBatches = useMemo(() => cancelledBatchIds(transactions), [transactions]);
  const cancelledDebts = useMemo(() => cancelledDebtIds(transactions), [transactions]);

  // Her log'a kaynak etiketi (ilaç/hizmet adı) ve ait olduğu işlem grubu bilgisi eklenir
  const decorateLogs = useCallback((logs) => {
    const groupByDebtId = new Map();
    const groupByBatchId = new Map();
    debtGroups.forEach((g) => {
      groupByBatchId.set(g.batchId, g);
      g.items.forEach((it) => groupByDebtId.set(it.id, g));
    });

    // Dokümanı kalmamış işlemin tarihi, gruptaki **en eski** log'dan gelir: süpürücü ve
    // iptal logları bugünün tarihini taşır, işlemin kendi tarihini değil
    const batchDates = new Map();
    // Bir işlemin bazı kalemleri süpürülüp bazıları yazılmış olabilir. O durumda dokümansız
    // kalemin logları da aynı karta ait olduğu için işlem başlığı kalem adı yerine tarih
    // bazlı olmalı — aksi halde "İlaç: A" başlığı altında B'nin logları görünürdü.
    const batchesWithOrphanLogs = new Set();
    logs.forEach((log) => {
      if (!log.batchId) return;
      if (log.date) {
        const current = batchDates.get(log.batchId);
        if (!current || log.date < current) batchDates.set(log.batchId, log.date);
      }
      if (!groupByDebtId.has(log.debtId)) batchesWithOrphanLogs.add(log.batchId);
    });

    return logs.map((log) => {
      const cancelled = Boolean(
        (log.batchId && cancelledBatches.has(log.batchId)) || cancelledDebts.has(log.debtId)
      );
      const group = groupByDebtId.get(log.debtId);
      if (group) {
        const item = group.items.find((it) => it.id === log.debtId);
        const sourceLabel = item.type === 'service'
          ? `Hizmet: ${item.desc}`
          : `İlaç: ${item.drugName}`;
        const mixed = group.itemCount > 1 || batchesWithOrphanLogs.has(group.batchId);
        return {
          ...log,
          cancelled,
          sourceLabel,
          groupKey: group.batchId,
          // Tek kalemlik işlemde kalem adı, çok kalemlide işlem başlığı daha okunaklı
          groupLabel: mixed
            ? `${fmtDate(group.date)} · ${group.itemCount} kalemlik işlem`
            : sourceLabel
        };
      }

      // Borç dokümanı kalmamış loglar. `batchId` varsa (iptal edilmiş ya da kısmi tahsilat
      // sonrası süpürülmüş işlem) kendi işlem başlığı altında toplanır; yoksa eski kayıt
      // olduğu için tek bir "kapalı borçlar" grubuna düşer.
      const drugName = log.drugId
        ? drugs.find((x) => x.id === log.drugId)?.name || 'Bilinmeyen İlaç'
        : null;

      if (log.batchId) {
        const batchDate = batchDates.get(log.batchId) || log.date;
        // İşlemin yaşayan bir kalemi varsa onun grubuna katılır: aynı işlem ekstrede iki
        // ayrı başlık altında görünmemeli ve iptal yalnızca kartın butonundan yapılmalı
        const liveGroup = groupByBatchId.get(log.batchId);
        // Tahsilat/geri alma grupları bir borç işlemi değil; "kapanmış işlem" demek yanıltıcı
        const isPayment = log.kind === 'payment';
        // Grup başlığı durumu zaten söylüyor; satırda "silinmiş borç" tekrarına gerek yok
        const sourceLabel = drugName
          ? `İlaç: ${drugName}`
          : (isPayment ? 'Tahsilat' : 'Hizmet');

        if (liveGroup) {
          return {
            ...log,
            cancelled,
            batchDate,
            sourceLabel,
            groupKey: liveGroup.batchId,
            groupLabel: `${fmtDate(liveGroup.date)} · ${liveGroup.itemCount} kalemlik işlem`
          };
        }

        return {
          ...log,
          cancelled,
          batchDate,
          sourceLabel,
          groupKey: log.batchId,
          groupLabel: isPayment
            ? `${fmtDate(batchDate)} · tahsilat kaydı`
            : `${fmtDate(batchDate)} · ${cancelled ? 'iptal edilmiş işlem' : 'kapanmış işlem'}`,
          // Süpürülüp dokümanı kalmamış hatalı giriş: kartı olmadığı için ekstreden iptal edilir
          cancellableBatchId: canCancelOrphanBatch(log.batchId, logs).ok ? log.batchId : undefined
        };
      }

      return {
        ...log,
        cancelled,
        sourceLabel: drugName ? `İlaç: ${drugName} / silinmiş borç` : 'Kapalı / silinmiş borç',
        groupKey: '__closed__',
        groupLabel: 'Kapalı / silinmiş borçlar'
      };
    });
  }, [debtGroups, drugs, cancelledBatches, cancelledDebts]);

  const customerAggregateLogs = useMemo(() => {
    const debtIds = new Set([
      ...serviceDebts.map((d) => d.id),
      ...drugDebts.map((d) => d.id)
    ]);
    const filtered = transactions.filter(
      (t) => t.customerId === customer.id || (!t.customerId && debtIds.has(t.debtId))
    );
    return decorateLogs(filtered).sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
  }, [transactions, serviceDebts, drugDebts, customer.id, decorateLogs]);

  const historyBatch = useMemo(
    () => debtGroups.find((g) => g.batchId === historyBatchId) || null,
    [debtGroups, historyBatchId]
  );

  // İşlem ekstresi: gruptaki kalemlerin logları ilaç adına göre kümelenir
  const batchLogs = useMemo(() => {
    if (!historyBatch) return [];
    const ids = new Set(historyBatch.items.map((it) => it.id));
    const filtered = transactions.filter((t) => ids.has(t.debtId));
    return decorateLogs(filtered).map((log) => ({ ...log, groupKey: log.debtId, groupLabel: log.sourceLabel }));
  }, [historyBatch, transactions, decorateLogs]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <button onClick={onBack} className="text-slate-500 hover:text-indigo-600 flex items-center gap-1 font-medium transition-colors bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm w-fit touch-target"><ArrowLeft className="w-4 h-4" /> Listeye Dön</button>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <button
            type="button"
            onClick={() => setShowCustomerHistory(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-md flex items-center gap-2 transition-transform transform active:scale-95"
          >
            <History className="w-5 h-5" /> Genel Ekstre
          </button>
          {showRevertPayment && (
            <button
              type="button"
              onClick={() => setRevertPaymentOpen(true)}
              disabled={!revertPaymentState.ok}
              title={revertPaymentState.ok
                ? 'Son tahsilatı geri al'
                : revertPaymentBlockedMessage(revertPaymentState.reason)}
              className="bg-amber-50 hover:bg-amber-100 text-amber-700 px-4 py-2.5 rounded-xl font-semibold border border-amber-200 flex items-center gap-2 text-sm transition-colors disabled:opacity-40 disabled:text-slate-500 disabled:bg-slate-100 disabled:border-slate-200 disabled:cursor-not-allowed"
            >
              <Undo2 className="w-4 h-4" /> Son Tahsilatı Geri Al
            </button>
          )}
          <button onClick={() => setPaymentModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-bold shadow-md flex items-center gap-2 transition-transform transform active:scale-95"><CreditCard className="w-5 h-5" /> Tahsilat Yap</button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-l-4 border-l-indigo-500">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">{customer.name}</h2>
          <p className="text-slate-500 text-sm mt-1">Müşteri ekstresi ve güncel cari durumu</p>
        </div>
        <div className="flex gap-6 text-right w-full md:w-auto bg-slate-50 p-4 rounded-lg border border-slate-100">
          <div>
            <p className="text-sm font-semibold text-slate-500 mb-1">Kullanılabilir Avans</p>
            <p className="text-xl font-bold text-emerald-600">{fmtTL(customer.balance)}</p>
          </div>
          <div className="pl-6 border-l border-slate-200">
            <p className="text-sm font-semibold text-slate-500 mb-1">Toplam Güncel Borç</p>
            <p className="text-2xl font-bold text-rose-600">{fmtTL(netDebt)}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 font-semibold text-slate-700 flex justify-between items-center">
              <span>İşlemler</span>
              <span className="text-xs font-medium text-slate-500 normal-case">İlaç borçları enflasyon korumalıdır</span>
            </div>
            {debtGroups.length === 0 ? (
              <p className="p-5 text-slate-500 text-sm italic text-center">Aktif borç bulunmuyor.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {debtGroups.map(group => {
                  const isOpen = expandedBatches.has(group.batchId);
                  return (
                    <div key={group.batchId}>
                      <button
                        type="button"
                        onClick={() => toggleBatch(group.batchId)}
                        aria-expanded={isOpen}
                        className="w-full px-5 py-4 flex items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {isOpen
                            ? <ChevronDown className="w-4 h-4 text-slate-500 flex-shrink-0" />
                            : <ChevronRight className="w-4 h-4 text-slate-500 flex-shrink-0" />}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-slate-800">{fmtDate(group.date)}</span>
                              <span className="text-xs font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">{group.itemCount} kalem</span>
                              {group.hasFixed && (
                                <span className="bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 border border-amber-200">
                                  <Lock className="w-3 h-3" /> SABİT
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <span className="font-bold text-rose-600 text-lg flex-shrink-0">{fmtTL(group.total)}</span>
                      </button>

                      {isOpen && (
                        <>
                          <div className="px-5 pb-3 flex flex-wrap gap-2 border-b border-slate-100">
                            {/* Kilit ve iade yalnızca ilaç kalemleri için anlamlı */}
                            {group.hasDrug && (
                              <>
                                <button
                                  onClick={() => onToggleBatchLock(group.items.filter(i => i.type === 'drug'))}
                                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md touch-target text-xs font-semibold transition-colors ${
                                    group.allFixed
                                      ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                  }`}
                                >
                                  {group.allFixed ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                                  {group.allFixed ? 'Tümünü Serbest Bırak' : 'Tümünü Sabitle'}
                                </button>
                                <button
                                  onClick={() => setBatchReturnId(group.batchId)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md touch-target bg-slate-100 text-slate-600 hover:bg-rose-100 hover:text-rose-600 text-xs font-semibold transition-colors"
                                >
                                  <Undo className="w-3.5 h-3.5" /> Toplu İade
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => setHistoryBatchId(group.batchId)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md touch-target bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-semibold transition-colors"
                            >
                              <History className="w-3.5 h-3.5" /> Grup Ekstresi
                            </button>
                            {(() => {
                              const cancelState = cancelStateByBatch.get(group.batchId) || { ok: false };
                              return (
                                <button
                                  onClick={() => setCancelTarget({ batchId: group.batchId, date: group.date })}
                                  disabled={!cancelState.ok}
                                  title={cancelState.ok ? 'Hatalı girişi iptal et' : cancelBlockedMessage(cancelState.reason)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md touch-target bg-slate-100 text-slate-600 hover:bg-rose-100 hover:text-rose-600 text-xs font-semibold transition-colors disabled:opacity-40 disabled:hover:bg-slate-100 disabled:hover:text-slate-600 disabled:cursor-not-allowed"
                                >
                                  <Ban className="w-3.5 h-3.5" /> İşlemi İptal Et
                                </button>
                              );
                            })()}
                          </div>
                          {!(cancelStateByBatch.get(group.batchId)?.ok) && (
                            <p className="px-5 pb-3 -mt-1 text-xs text-slate-500 italic">
                              {cancelBlockedMessage(cancelStateByBatch.get(group.batchId)?.reason)}
                            </p>
                          )}

                          <ul className="divide-y divide-slate-100 bg-slate-50/30">
                            {group.items.map(d => d.type === 'service' ? (
                              <li key={d.id} className="p-5 hover:bg-slate-50/80 transition-colors flex justify-between items-center gap-4">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="bg-slate-200 text-slate-600 text-[10px] px-2 py-0.5 rounded-full font-bold tracking-wide">HİZMET</span>
                                    <p className="font-bold text-slate-800 text-lg">{d.desc}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4 flex-shrink-0">
                                  <div className="text-right">
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Tutar</p>
                                    <p className="font-bold text-rose-600 text-xl">{fmtTL(d.amount)}</p>
                                  </div>
                                  {/* Ilac satirindakiyle ayni cip: ayni is ayni gorunmeli,
                                      etiketsiz ikon yikici bir eylemde ne yaptigini soylemiyor */}
                                  <button
                                    onClick={() => setCancelItem(d)}
                                    title="Kalemi İptal Et"
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md touch-target bg-slate-100 text-slate-600 hover:bg-rose-100 hover:text-rose-600 text-xs font-semibold transition-colors"
                                  >
                                    <Ban className="w-3.5 h-3.5" /> İptal
                                  </button>
                                </div>
                              </li>
                            ) : (
                              <li key={d.id} className="p-5 hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className="font-bold text-slate-800 text-lg">{d.drugName}</p>
                                    {d.isFixed && <span className="bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 border border-amber-200"><Lock className="w-3 h-3" /> SABİT</span>}
                                  </div>
                                  <div className="text-sm text-slate-600 mt-1 flex items-center gap-2">
                                    <span>Kalan: <strong className="text-slate-800">{fmtQty(d.qty)} Adet</strong></span>
                                    <span className="text-slate-400">|</span>
                                    <span>Baz Fiyat: {fmtTL(d.maxPrice)}</span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-5 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-3 sm:pt-0 mt-2 sm:mt-0">
                                  <div className="text-right">
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Güncel Tutar</p>
                                    <p className="font-bold text-rose-600 text-xl">{fmtTL(d.tlValue)}</p>
                                  </div>

                                  <div className="flex gap-2 border-l border-slate-200 pl-4 ml-2 flex-shrink-0">
                                    <button
                                      title="Borç Geçmişini Gör"
                                      onClick={() => setHistoryDebtId(d.id)}
                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md touch-target bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-semibold transition-colors"
                                    >
                                      <History className="w-3.5 h-3.5" /> Geçmiş
                                    </button>
                                    <button
                                      onClick={() => onToggleLock(d.id)}
                                      title={d.isFixed ? "Kilidi Aç" : "Fiyatı Sabitle"}
                                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md touch-target text-xs font-semibold transition-colors ${
                                        d.isFixed
                                          ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                      }`}
                                    >
                                      {d.isFixed ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                                      {d.isFixed ? 'Sabit' : 'Serbest'}
                                    </button>
                                    <button
                                      onClick={() => { setReturnModalDebt(d); setReturnInputQty('1'); }}
                                      title="İade Al / Adet Düş"
                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md touch-target bg-slate-100 text-slate-600 hover:bg-rose-100 hover:text-rose-600 text-xs font-semibold transition-colors"
                                    >
                                      <Undo className="w-3.5 h-3.5" /> İade
                                    </button>
                                    {/* Yanlış girilen tek kalem: iade defterde gerçek bir iade
                                        gibi görünürdü, iptal doğru olanı söyler */}
                                    <button
                                      onClick={() => setCancelItem(d)}
                                      title="Kalemi İptal Et"
                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md touch-target bg-slate-100 text-slate-600 hover:bg-rose-100 hover:text-rose-600 text-xs font-semibold transition-colors"
                                    >
                                      <Ban className="w-3.5 h-3.5" /> İptal
                                    </button>
                                  </div>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        <div className="space-y-6 self-start sticky top-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-100 pb-3"><Plus className="w-5 h-5 text-indigo-600" /> Yeni İşlem (Borç Yaz)</h3>
            <div className="space-y-3">
              <button
                onClick={() => setDebtModalMode('today')}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg transition-colors shadow-sm flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" /> Borç Ekle
              </button>
              <button
                onClick={() => setDebtModalMode('past')}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm border border-slate-200"
              >
                <Clock className="w-4 h-4" /> Geçmiş Borç Ekle
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-100 pb-3"><Download className="w-5 h-5 text-indigo-600" /> Ekstre</h3>
            <button
              onClick={() => setExportOpen(true)}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm border border-slate-200"
            >
              <Download className="w-4 h-4" /> Ekstreyi İndir
            </button>
            <p className="text-xs text-slate-500 mt-3 leading-relaxed">
              Seçtiğin dönemin hareket dökümünü Excel'de açılabilen CSV olarak indirir.
            </p>
          </div>
        </div>
      </div>

      {isPaymentModalOpen && (
        <PaymentModal
          onClose={() => setPaymentModalOpen(false)}
        />
      )}

      {debtModalMode && (
        <DebtModal mode={debtModalMode} onClose={() => setDebtModalMode(null)} />
      )}

      {batchReturnGroup && (
        <BatchReturnModal
          key={batchReturnGroup.batchId}
          group={batchReturnGroup}
          onConfirm={onReturnBatch}
          onClose={() => setBatchReturnId(null)}
        />
      )}

      {cancelItem && (
        <CancelBatchModal
          key={cancelItem.id}
          variant="item"
          hasMoneyHistory={transactions.some(
            t => t.debtId === cancelItem.id && (t.kind === 'payment' || t.kind === 'return')
          )}
          group={{
            batchId: cancelItem.id,
            date: cancelItem.date,
            items: [cancelItem],
            itemCount: 1,
            total: cancelItem.type === 'service'
              ? (cancelItem.amount || 0)
              : (cancelItem.tlValue ?? cancelItem.qty * cancelItem.maxPrice)
          }}
          onConfirm={(reason) => onCancelItem(cancelItem, reason)}
          onClose={() => setCancelItem(null)}
        />
      )}

      {isRevertPaymentOpen && revertPaymentState.ok && (
        <RevertPaymentModal
          batch={revertPaymentState.batch}
          onConfirm={(reason) => onRevertPayment(revertPaymentState.batch, reason)}
          onClose={() => setRevertPaymentOpen(false)}
        />
      )}

      {cancelGroup && (
        <CancelBatchModal
          key={cancelGroup.batchId}
          group={cancelGroup}
          onConfirm={(reason) => onCancelBatch(cancelGroup, reason)}
          onClose={() => setCancelTarget(null)}
        />
      )}

      {historyDebtId && (
        <HistoryModal
          variant="debt"
          debtInfo={extreDDebts.find(d => d.id === historyDebtId)}
          logs={transactions.filter(t => t.debtId === historyDebtId)}
          onClose={() => setHistoryDebtId(null)}
        />
      )}

      {isExportOpen && (
        <StatementExportModal
          customerName={customer.name}
          logs={customerAggregateLogs}
          advanceBalance={customer.balance}
          onClose={() => setExportOpen(false)}
        />
      )}

      {showCustomerHistory && (
        <HistoryModal
          variant="customer"
          customerName={customer.name}
          logs={customerAggregateLogs}
          onCancelBatch={(batchId, date) => { setShowCustomerHistory(false); setCancelTarget({ batchId, date }); }}
          onClose={() => setShowCustomerHistory(false)}
        />
      )}

      {historyBatch && (
        <HistoryModal
          variant="batch"
          batchInfo={historyBatch}
          logs={batchLogs}
          onClose={() => setHistoryBatchId(null)}
        />
      )}

      {returnModalDebt && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={closeReturnModal}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col p-6 border-t-4 border-t-rose-500" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-xl text-slate-800 mb-2">İade Alınacak Adet</h3>
            <p className="text-sm text-slate-500 mb-5">
              <strong className="text-slate-700">{returnModalDebt.drugName}</strong> için iade edilecek miktarı girin.
              (Mevcut Borç: {fmtQty(returnModalDebt.qty)} Adet)
            </p>

            <input type="number" step="0.1" min="0.1" value={returnInputQty} onChange={(e) => setReturnInputQty(e.target.value)} className="w-full border-2 border-slate-200 rounded-lg px-4 py-3 focus:border-rose-500 focus:outline-none text-xl font-bold mb-6 text-center text-slate-700" autoFocus />

            <div className="flex gap-3">
              <button onClick={closeReturnModal} className="flex-1 py-2.5 text-slate-600 font-bold bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">İptal</button>
              <button onClick={() => { const qty = parseFloat(returnInputQty); if (qty > 0) { onReturnDrug(returnModalDebt, qty); closeReturnModal(); } }} className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg transition-colors">İadeyi Onayla</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
