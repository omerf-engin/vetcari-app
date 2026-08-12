import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ArrowLeft, CreditCard, Lock, Unlock, History, Undo, Plus, Trash2, Clock, ChevronDown, ChevronRight } from 'lucide-react';
import { fmtTL, fmtQty, fmtDate } from '../../utils/formatters';
import { groupDrugDebtsByBatch } from '../../utils/debtGrouping';
import PaymentModal from '../modals/PaymentModal';
import HistoryModal from '../modals/HistoryModal';
import DebtModal from '../modals/DebtModal';
import BatchReturnModal from '../modals/BatchReturnModal';
import { useCustomer } from '../../hooks/useCustomer';

export default function CustomerDetail({ onBack }) {
  const { customer, drugs, serviceDebts, drugDebts, transactions, onToggleLock, onReturnDrug, onDeleteServiceDebt, onToggleBatchLock, onReturnBatch } = useCustomer();
  const [isPaymentModalOpen, setPaymentModalOpen] = useState(false);
  const [historyDebtId, setHistoryDebtId] = useState(null);
  const [showCustomerHistory, setShowCustomerHistory] = useState(false);
  const [returnModalDebt, setReturnModalDebt] = useState(null);
  const [returnInputQty, setReturnInputQty] = useState('');
  const [debtModalMode, setDebtModalMode] = useState(null);
  const [expandedBatches, setExpandedBatches] = useState(() => new Set());
  const [batchReturnId, setBatchReturnId] = useState(null);
  const [historyBatchId, setHistoryBatchId] = useState(null);

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

  const debtGroups = useMemo(() => groupDrugDebtsByBatch(extreDDebts), [extreDDebts]);

  // Modallar id tutar; grup verisi her zaman guncel snapshot'tan cozulur
  const batchReturnGroup = useMemo(
    () => debtGroups.find(g => g.batchId === batchReturnId) || null,
    [debtGroups, batchReturnId]
  );

  const totalServiceDebt = serviceDebts.reduce((sum, d) => sum + d.amount, 0);
  const totalDrugDebt = extreDDebts.reduce((sum, d) => sum + d.tlValue, 0);
  const grossDebt = totalServiceDebt + totalDrugDebt;
  const netDebt = Math.max(0, grossDebt - customer.balance);

  // Her log'a kaynak etiketi (ilaç/hizmet adı) ve ait olduğu işlem grubu bilgisi eklenir
  const decorateLogs = useCallback((logs) => {
    const groupByDebtId = new Map();
    debtGroups.forEach((g) => g.items.forEach((it) => groupByDebtId.set(it.id, g)));

    return logs.map((log) => {
      const svc = serviceDebts.find((d) => d.id === log.debtId);
      if (svc) {
        return { ...log, sourceLabel: `Hizmet: ${svc.desc}`, groupKey: log.debtId, groupLabel: `Hizmet: ${svc.desc}` };
      }

      const group = groupByDebtId.get(log.debtId);
      if (group) {
        const drugDebt = group.items.find((it) => it.id === log.debtId);
        const sourceLabel = `İlaç: ${drugDebt.drugName}`;
        return {
          ...log,
          sourceLabel,
          groupKey: group.batchId,
          // Tek kalemlik işlemde ilaç adı, çok kalemlide işlem başlığı daha okunaklı
          groupLabel: group.itemCount > 1
            ? `${fmtDate(group.date)} · ${group.itemCount} kalemlik işlem`
            : sourceLabel
        };
      }

      if (log.drugId) {
        const name = drugs.find((x) => x.id === log.drugId)?.name || 'Bilinmeyen İlaç';
        return { ...log, sourceLabel: `İlaç: ${name} / silinmiş borç`, groupKey: '__closed__', groupLabel: 'Kapalı / silinmiş borçlar' };
      }
      return { ...log, sourceLabel: 'Kapalı / silinmiş borç', groupKey: '__closed__', groupLabel: 'Kapalı / silinmiş borçlar' };
    });
  }, [debtGroups, serviceDebts, drugs]);

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
        <button onClick={onBack} className="text-slate-500 hover:text-indigo-600 flex items-center gap-1 font-medium transition-colors bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm w-fit"><ArrowLeft className="w-4 h-4" /> Listeye Dön</button>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <button
            type="button"
            onClick={() => setShowCustomerHistory(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-md flex items-center gap-2 transition-transform transform active:scale-95"
          >
            <History className="w-5 h-5" /> Genel ekstre
          </button>
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
            <p className="text-2xl font-bold text-red-600">{fmtTL(netDebt)}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 font-semibold text-slate-700">Sabit Hizmet Borçları (TL)</div>
            {serviceDebts.length === 0 ? (
              <p className="p-5 text-slate-400 text-sm italic text-center">Aktif hizmet borcu bulunmuyor.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {serviceDebts.map(d => (
                  <li key={d.id} className="p-4 flex justify-between items-center hover:bg-slate-50/80 transition-colors">
                    <div>
                      <p className="font-semibold text-slate-800">{d.desc}</p>
                      <p className="text-xs text-slate-400 mt-1">{fmtDate(d.date)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-slate-700 text-lg">{fmtTL(d.amount)}</span>
                      <button onClick={() => onDeleteServiceDebt(d.id)} title="Borcu Sil / İptal Et" className="text-slate-300 hover:text-rose-500 transition-colors bg-white hover:bg-rose-50 p-1.5 rounded-md border border-transparent hover:border-rose-100"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 font-semibold text-slate-700 flex justify-between items-center">
              <span>İlaç Borçları (Enflasyon Korumalı)</span>
            </div>
            {debtGroups.length === 0 ? (
              <p className="p-5 text-slate-400 text-sm italic text-center">Aktif ilaç borcu bulunmuyor.</p>
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
                            ? <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                            : <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />}
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
                        <span className="font-bold text-red-600 text-lg flex-shrink-0">{fmtTL(group.total)}</span>
                      </button>

                      {isOpen && (
                        <>
                          <div className="px-5 pb-3 flex flex-wrap gap-2 border-b border-slate-100">
                            <button
                              onClick={() => onToggleBatchLock(group.items)}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
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
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-100 text-slate-600 hover:bg-rose-100 hover:text-rose-600 text-xs font-semibold transition-colors"
                            >
                              <Undo className="w-3.5 h-3.5" /> Toplu İade
                            </button>
                            <button
                              onClick={() => setHistoryBatchId(group.batchId)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-semibold transition-colors"
                            >
                              <History className="w-3.5 h-3.5" /> Grup Ekstresi
                            </button>
                          </div>

                          <ul className="divide-y divide-slate-100 bg-slate-50/30">
                            {group.items.map(d => (
                              <li key={d.id} className="p-5 hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-slate-800 text-lg">{d.drugName}</p>
                        {d.isFixed && <span className="bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 border border-amber-200"><Lock className="w-3 h-3" /> SABİT</span>}
                      </div>
                      <div className="text-sm text-slate-600 mt-1 flex items-center gap-2">
                        <span>Kalan: <strong className="text-slate-800">{fmtQty(d.qty)} Adet</strong></span>
                        <span className="text-slate-300">|</span>
                        <span>Baz Fiyat: {fmtTL(d.maxPrice)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-5 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-3 sm:pt-0 mt-2 sm:mt-0">
                      <div className="text-right">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Güncel Tutar</p>
                        <p className="font-bold text-red-600 text-xl">{fmtTL(d.tlValue)}</p>
                      </div>

                      <div className="flex gap-2 border-l border-slate-200 pl-4 ml-2 flex-shrink-0">
                        <button
                          title="Borç Geçmişini Gör"
                          onClick={() => setHistoryDebtId(d.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-semibold transition-colors"
                        >
                          <History className="w-3.5 h-3.5" /> Geçmiş
                        </button>
                        <button
                          onClick={() => onToggleLock(d.id)}
                          title={d.isFixed ? "Kilidi Aç" : "Fiyatı Sabitle"}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
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
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-100 text-slate-600 hover:bg-rose-100 hover:text-rose-600 text-xs font-semibold transition-colors"
                        >
                          <Undo className="w-3.5 h-3.5" /> İade
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

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 self-start sticky top-6">
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

      {historyDebtId && (
        <HistoryModal
          variant="debt"
          debtInfo={extreDDebts.find(d => d.id === historyDebtId)}
          logs={transactions.filter(t => t.debtId === historyDebtId)}
          onClose={() => setHistoryDebtId(null)}
        />
      )}

      {showCustomerHistory && (
        <HistoryModal
          variant="customer"
          customerName={customer.name}
          logs={customerAggregateLogs}
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
