import React, { useState, useEffect, useMemo } from 'react';
import { Clock, Check } from 'lucide-react';
import { useCustomer } from '../../hooks/useCustomer';
import { fmtTL, fmtQty } from '../../utils/formatters';

export default function PastDebtModal({ onClose }) {
  const { drugs, onAddPastServiceDebt, onAddPastDrugDebt } = useCustomer();

  const [tab, setTab] = useState('service');
  const today = new Date().toISOString().split('T')[0];

  // Hizmet state
  const [sDate, setSDate] = useState(today);
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [sPaid, setSPaid] = useState('');
  const [sPaidDate, setSPaidDate] = useState(today);

  // İlaç state
  const [dDate, setDDate] = useState(today);
  const [selDrugId, setSelDrugId] = useState(drugs[0]?.id || '');
  const [qty, setQty] = useState('');
  const [priceMode, setPriceMode] = useState('unit');
  const [priceInput, setPriceInput] = useState('');
  const [dPaid, setDPaid] = useState('');
  const [dPaidDate, setDPaidDate] = useState(today);
  const [applyInflation, setApplyInflation] = useState(false);

  const effectiveDrugId = selDrugId || (drugs.length > 0 ? drugs[0].id : '');
  const selectedDrug = drugs.find(d => d.id === effectiveDrugId);

  // İlaç hesaplamaları
  const drugCalc = useMemo(() => {
    const q = parseFloat(qty) || 0;
    const p = parseFloat(priceInput) || 0;
    if (q <= 0 || p <= 0) return null;

    const unitPrice = priceMode === 'unit' ? p : Math.round((p / q) * 100) / 100;
    const totalPrice = priceMode === 'total' ? p : Math.round(q * p * 100) / 100;
    const paid = parseFloat(dPaid) || 0;

    let remainQty = q;
    let remainTl = totalPrice;
    if (paid > 0) {
      const qtyDeducted = Math.round((paid / unitPrice) * 100) / 100;
      remainQty = Math.round((q - qtyDeducted) * 100) / 100;
      remainTl = Math.round(remainQty * unitPrice * 100) / 100;
    }

    const showInflation = selectedDrug && selectedDrug.price > unitPrice;
    let inflatedTl = null;
    if (showInflation && applyInflation) {
      inflatedTl = Math.round(remainQty * selectedDrug.price * 100) / 100;
    }

    return { unitPrice, totalPrice, paid, remainQty, remainTl, showInflation, inflatedTl };
  }, [qty, priceInput, priceMode, dPaid, selectedDrug, applyInflation]);

  // Hizmet hesaplaması
  const serviceCalc = useMemo(() => {
    const a = parseFloat(amount) || 0;
    const p = parseFloat(sPaid) || 0;
    if (a <= 0) return null;
    return { amount: a, paid: p, remaining: Math.round((a - p) * 100) / 100 };
  }, [amount, sPaid]);

  // Escape
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleSubmit = () => {
    if (tab === 'service') {
      if (!serviceCalc || serviceCalc.amount <= 0 || !desc.trim() || !sDate) return;
      const paid = serviceCalc.paid;
      if (paid < 0 || paid >= serviceCalc.amount) return;
      onAddPastServiceDebt(desc, serviceCalc.amount, sDate, paid, paid > 0 ? sPaidDate : null);
      onClose();
    } else {
      if (!drugCalc || !effectiveDrugId || !dDate) return;
      if (drugCalc.paid < 0 || drugCalc.paid >= drugCalc.totalPrice) return;
      onAddPastDrugDebt(effectiveDrugId, parseFloat(qty), drugCalc.unitPrice, dDate, drugCalc.paid, drugCalc.paid > 0 ? dPaidDate : null, applyInflation);
      onClose();
    }
  };

  const isServiceValid = tab === 'service' && serviceCalc && serviceCalc.amount > 0 && desc.trim() && sDate
    && serviceCalc.paid >= 0 && serviceCalc.paid < serviceCalc.amount;

  const isDrugValid = tab === 'drug' && drugCalc && effectiveDrugId && dDate
    && drugCalc.paid >= 0 && drugCalc.paid < drugCalc.totalPrice;

  const canSubmit = tab === 'service' ? isServiceValid : isDrugValid;

  const inputCls = 'w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none';
  const labelCls = 'block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide';

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-600" /> Geçmiş Borç Kaydı
            </h2>
            <p className="text-sm text-slate-500 mt-1">Geçmiş tarihli borç girişi</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 bg-slate-200/50 hover:bg-slate-200 p-2 rounded-full transition-colors">&#x2715;</button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">

          {/* Tab toggle */}
          <div className="flex bg-slate-100 p-1.5 rounded-lg">
            <button
              className={`flex-1 text-sm py-2 rounded-md font-semibold transition-all ${tab === 'service' ? 'bg-white shadow text-indigo-700' : 'text-slate-500 hover:text-slate-800'}`}
              onClick={() => setTab('service')}
            >Hizmet (TL)</button>
            <button
              className={`flex-1 text-sm py-2 rounded-md font-semibold transition-all ${tab === 'drug' ? 'bg-white shadow text-indigo-700' : 'text-slate-500 hover:text-slate-800'}`}
              onClick={() => setTab('drug')}
              disabled={drugs.length === 0}
            >İlaç (Adet)</button>
          </div>

          {/* Hizmet sekmesi */}
          {tab === 'service' && (
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Tarih</label>
                <input type="date" value={sDate} onChange={e => setSDate(e.target.value)} max={today} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Açıklama</label>
                <input type="text" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Örn: Muayene" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Toplam Tutar (₺)</label>
                <input type="number" step="0.1" min="0" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.0" className={`${inputCls} font-semibold text-lg`} />
              </div>
              <div>
                <label className={labelCls}>Yapılmış Tahsilat (₺) <span className="text-slate-400 normal-case font-normal">— opsiyonel</span></label>
                <input type="number" step="0.1" min="0" value={sPaid} onChange={e => setSPaid(e.target.value)} placeholder="0" className={inputCls} />
              </div>
              {serviceCalc && serviceCalc.paid > 0 && (
                <div>
                  <label className={labelCls}>Tahsilat Tarihi</label>
                  <input type="date" value={sPaidDate} onChange={e => setSPaidDate(e.target.value)} max={today} className={inputCls} />
                </div>
              )}
              {serviceCalc && serviceCalc.paid > 0 && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm">
                  <span className="font-semibold text-emerald-800">Kalan Borç:</span>{' '}
                  <span className="text-emerald-700 font-bold">{fmtTL(serviceCalc.remaining)}</span>
                </div>
              )}
            </div>
          )}

          {/* İlaç sekmesi */}
          {tab === 'drug' && (
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Tarih</label>
                <input type="date" value={dDate} onChange={e => setDDate(e.target.value)} max={today} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>İlaç Seçimi</label>
                {drugs.length === 0 ? (
                  <div className="text-sm text-red-500 bg-red-50 p-2 rounded border border-red-100">Önce sisteme ilaç eklemelisiniz.</div>
                ) : (
                  <select value={effectiveDrugId} onChange={e => setSelDrugId(e.target.value)} className={`${inputCls} bg-white`}>
                    {drugs.map(d => <option key={d.id} value={d.id}>{d.name} (Güncel: {fmtTL(d.price)})</option>)}
                  </select>
                )}
              </div>
              <div>
                <label className={labelCls}>Adet / Kutu</label>
                <input type="number" step="0.1" min="0.1" value={qty} onChange={e => setQty(e.target.value)} placeholder="0" className={`${inputCls} font-semibold text-lg`} />
              </div>

              {/* Fiyat modu toggle */}
              <div>
                <label className={labelCls}>Fiyat Bilgisi</label>
                <div className="flex bg-slate-100 p-1 rounded-lg mb-2">
                  <button
                    className={`flex-1 text-xs py-1.5 rounded-md font-semibold transition-all ${priceMode === 'unit' ? 'bg-white shadow text-indigo-700' : 'text-slate-500'}`}
                    onClick={() => setPriceMode('unit')}
                  >Birim Fiyat</button>
                  <button
                    className={`flex-1 text-xs py-1.5 rounded-md font-semibold transition-all ${priceMode === 'total' ? 'bg-white shadow text-indigo-700' : 'text-slate-500'}`}
                    onClick={() => setPriceMode('total')}
                  >Toplam Tutar</button>
                </div>
                <input
                  type="number" step="0.1" min="0"
                  value={priceInput}
                  onChange={e => setPriceInput(e.target.value)}
                  placeholder={priceMode === 'unit' ? 'Birim fiyat (₺)' : 'Toplam tutar (₺)'}
                  className={`${inputCls} font-semibold text-lg`}
                />
              </div>

              {/* Canlı hesaplama */}
              {drugCalc && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-sm space-y-1">
                  {priceMode === 'unit' ? (
                    <p className="text-indigo-800">{fmtQty(parseFloat(qty))} adet &times; {fmtTL(drugCalc.unitPrice)} = <strong>{fmtTL(drugCalc.totalPrice)}</strong></p>
                  ) : (
                    <p className="text-indigo-800">{fmtTL(drugCalc.totalPrice)} / {fmtQty(parseFloat(qty))} adet = <strong>{fmtTL(drugCalc.unitPrice)}/adet</strong></p>
                  )}
                </div>
              )}

              <div>
                <label className={labelCls}>Yapılmış Tahsilat (₺) <span className="text-slate-400 normal-case font-normal">— opsiyonel</span></label>
                <input type="number" step="0.1" min="0" value={dPaid} onChange={e => setDPaid(e.target.value)} placeholder="0" className={inputCls} />
              </div>
              {drugCalc && drugCalc.paid > 0 && (
                <div>
                  <label className={labelCls}>Tahsilat Tarihi</label>
                  <input type="date" value={dPaidDate} onChange={e => setDPaidDate(e.target.value)} max={today} className={inputCls} />
                </div>
              )}

              {/* Kalan borç gösterimi */}
              {drugCalc && drugCalc.paid > 0 && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm">
                  <span className="font-semibold text-emerald-800">Kalan:</span>{' '}
                  <span className="text-emerald-700 font-bold">{fmtQty(drugCalc.remainQty)} adet ({fmtTL(drugCalc.remainTl)})</span>
                </div>
              )}

              {/* Enflasyon seçeneği */}
              {drugCalc && drugCalc.showInflation && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input type="checkbox" checked={applyInflation} onChange={e => setApplyInflation(e.target.checked)} className="mt-0.5 rounded border-amber-300 text-amber-600 focus:ring-amber-500" />
                    <div className="text-sm">
                      <span className="font-semibold text-amber-800">Kalan borca enflasyon uygula</span>
                      <p className="text-amber-700 mt-0.5">
                        Güncel fiyat: {fmtTL(selectedDrug.price)}
                        {drugCalc.inflatedTl !== null && (
                          <> &rarr; Yeni kalan borç: <strong>{fmtTL(drugCalc.inflatedTl)}</strong></>
                        )}
                      </p>
                    </div>
                  </label>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-200 bg-slate-50 flex justify-end gap-3 rounded-b-2xl">
          <button onClick={onClose} className="px-6 py-3 rounded-xl text-slate-600 font-bold hover:bg-slate-200 transition-colors">İptal</button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="px-8 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md disabled:opacity-50 flex items-center gap-2"
          >
            <Check className="w-5 h-5" /> Kaydet
          </button>
        </div>
      </div>
    </div>
  );
}
