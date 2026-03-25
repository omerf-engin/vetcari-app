import React, { useState, useEffect } from 'react';
import { ArrowLeft, CreditCard, Lock, Unlock, History, Undo, Plus, Trash2 } from 'lucide-react';
import { fmtTL, fmtQty, fmtDate } from '../../utils/formatters';
import PaymentModal from '../modals/PaymentModal';
import HistoryModal from '../modals/HistoryModal';

export default function CustomerDetail({ customer, drugs, serviceDebts, drugDebts, transactions, onBack, onToggleLock, onReturnDrug, onAddServiceDebt, onDeleteServiceDebt, onAddDrugDebt, onApplyPayment }) {
  const [isPaymentModalOpen, setPaymentModalOpen] = useState(false);
  const [historyDebtId, setHistoryDebtId] = useState(null);
  const [returnModalDebt, setReturnModalDebt] = useState(null);
  const [returnInputQty, setReturnInputQty] = useState('');

  const extreDDebts = drugDebts.map(d => ({
    ...d,
    tlValue: d.qty * d.maxPrice,
    drugName: drugs.find(x => x.id === d.drugId)?.name || 'Bilinmeyen İlaç'
  }));

  const totalServiceDebt = serviceDebts.reduce((sum, d) => sum + d.amount, 0);
  const totalDrugDebt = extreDDebts.reduce((sum, d) => sum + d.tlValue, 0);
  const grossDebt = totalServiceDebt + totalDrugDebt;
  const netDebt = Math.max(0, grossDebt - customer.balance);

  const [newDebtType, setNewDebtType] = useState('service');
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [selDrugId, setSelDrugId] = useState(drugs[0]?.id || '');
  const [qty, setQty] = useState('1');

  useEffect(() => {
    if (drugs.length > 0 && !selDrugId) setSelDrugId(drugs[0].id);
  }, [drugs, selDrugId]);

  const handleAddDebt = (e) => {
    e.preventDefault();
    if (newDebtType === 'service') {
      if (!desc || !amount) return;
      onAddServiceDebt(desc, parseFloat(amount));
      setDesc(''); setAmount('');
    } else {
      if (!selDrugId || !qty) return;
      onAddDrugDebt(selDrugId, parseFloat(qty));
      setQty('1');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-slate-500 hover:text-indigo-600 flex items-center gap-1 font-medium transition-colors bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm"><ArrowLeft className="w-4 h-4" /> Listeye Dön</button>
        <button onClick={() => setPaymentModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-bold shadow-md flex items-center gap-2 transition-transform transform active:scale-95"><CreditCard className="w-5 h-5" /> Tahsilat Yap</button>
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
            {extreDDebts.length === 0 ? (
              <p className="p-5 text-slate-400 text-sm italic text-center">Aktif ilaç borcu bulunmuyor.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {extreDDebts.map(d => (
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

                      <div className="flex sm:flex-col gap-1.5 border-l border-slate-200 pl-4">
                        <div className="flex gap-1.5">
                          <button onClick={() => setHistoryDebtId(d.id)} title="Borç Geçmişini (Ekstre) Gör" className="p-2 rounded-md bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors flex items-center justify-center">
                            <History className="w-4 h-4" />
                          </button>

                          <button onClick={() => onToggleLock(d.id)} title={d.isFixed ? "Kilidi Aç (Zamlardan Etkilenir)" : "Fiyatı Sabitle (Zamlardan Etkilenmez)"} className={`p-2 rounded-md transition-colors flex items-center justify-center ${d.isFixed ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                            {d.isFixed ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                          </button>
                        </div>
                        <div className="flex gap-1.5 mt-1 sm:mt-0">
                          <button onClick={() => { setReturnModalDebt(d); setReturnInputQty('1'); }} title="İade Al / Adet Düş" className="p-2 w-full rounded-md bg-slate-100 text-slate-600 hover:bg-rose-100 hover:text-rose-600 transition-colors flex items-center justify-center gap-2 font-medium text-sm">
                            <Undo className="w-4 h-4" /> İade Al
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 self-start sticky top-6">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-100 pb-3"><Plus className="w-5 h-5 text-indigo-600" /> Yeni İşlem (Borç Yaz)</h3>
          <div className="flex bg-slate-100 p-1.5 rounded-lg mb-5">
            <button className={`flex-1 text-sm py-2 rounded-md font-semibold transition-all ${newDebtType === 'service' ? 'bg-white shadow text-indigo-700' : 'text-slate-500 hover:text-slate-800'}`} onClick={() => setNewDebtType('service')}>Hizmet (TL)</button>
            <button className={`flex-1 text-sm py-2 rounded-md font-semibold transition-all ${newDebtType === 'drug' ? 'bg-white shadow text-indigo-700' : 'text-slate-500 hover:text-slate-800'}`} onClick={() => setNewDebtType('drug')}>İlaç (Adet)</button>
          </div>
          <form onSubmit={handleAddDebt} className="space-y-4">
            {newDebtType === 'service' ? (
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Açıklama</label>
                  <input type="text" value={desc} onChange={e => setDesc(e.target.value)} required placeholder="Örn: Muayene" className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Tutar (₺)</label>
                  <input type="number" step="0.1" min="0" value={amount} onChange={e => setAmount(e.target.value)} required placeholder="0.0" className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none font-semibold text-lg" />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">İlaç Seçimi</label>
                  {drugs.length === 0 ? (
                    <div className="text-sm text-red-500 bg-red-50 p-2 rounded border border-red-100">Önce sisteme ilaç eklemelisiniz.</div>
                  ) : (
                    <select value={selDrugId} onChange={e => setSelDrugId(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white">
                      {drugs.map(d => <option key={d.id} value={d.id}>{d.name} ({fmtTL(d.price)})</option>)}
                    </select>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Adet / Kutu</label>
                  <input type="number" step="0.1" value={qty} onChange={e => setQty(e.target.value)} required min="0.1" className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none font-semibold text-lg" />
                </div>
              </>
            )}
            <button type="submit" disabled={newDebtType === 'drug' && drugs.length === 0} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg transition-colors mt-4 shadow-sm disabled:opacity-50">Hesaba Ekle</button>
          </form>
        </div>
      </div>

      {isPaymentModalOpen && (
        <PaymentModal
          customer={customer}
          serviceDebts={serviceDebts}
          extreDDebts={extreDDebts}
          onClose={() => setPaymentModalOpen(false)}
          onConfirm={(amt, dist) => { onApplyPayment(amt, dist); setPaymentModalOpen(false); }}
        />
      )}

      {historyDebtId && (
        <HistoryModal
          debtInfo={extreDDebts.find(d => d.id === historyDebtId)}
          logs={transactions.filter(t => t.debtId === historyDebtId)}
          onClose={() => setHistoryDebtId(null)}
        />
      )}

      {returnModalDebt && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col p-6 border-t-4 border-t-rose-500">
            <h3 className="font-bold text-xl text-slate-800 mb-2">İade Alınacak Adet</h3>
            <p className="text-sm text-slate-500 mb-5">
              <strong className="text-slate-700">{returnModalDebt.drugName}</strong> için iade edilecek miktarı girin.
              (Mevcut Borç: {fmtQty(returnModalDebt.qty)} Adet)
            </p>

            <input type="number" step="0.1" min="0.1" value={returnInputQty} onChange={(e) => setReturnInputQty(e.target.value)} className="w-full border-2 border-slate-200 rounded-lg px-4 py-3 focus:border-rose-500 focus:outline-none text-xl font-bold mb-6 text-center text-slate-700" autoFocus />

            <div className="flex gap-3">
              <button onClick={() => setReturnModalDebt(null)} className="flex-1 py-2.5 text-slate-600 font-bold bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">İptal</button>
              <button onClick={() => { const qty = parseFloat(returnInputQty); if (qty > 0) { onReturnDrug(returnModalDebt, qty); setReturnModalDebt(null); } }} className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg transition-colors">İadeyi Onayla</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
