import { useState, useEffect, useMemo } from 'react';
import { Plus, Clock, Check, Trash2, ChevronDown } from 'lucide-react';
import { useCustomer } from '../../hooks/useCustomer';
import { fmtTL, fmtQty } from '../../utils/formatters';

export default function DebtModal({ mode, onClose }) {
  const { drugs, onAddServiceDebt, onAddPastServiceDebt, onAddBulkDrugDebt } = useCustomer();
  const isPast = mode === 'past';

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
  const [rows, setRows] = useState([{ id: crypto.randomUUID(), drugId: drugs[0]?.id || '', qty: '1', priceMode: 'unit', unitPrice: drugs[0]?.price ? String(drugs[0].price) : '' }]);
  const [dPaid, setDPaid] = useState('');
  const [dPaidDate, setDPaidDate] = useState(today);
  const [applyInflation, setApplyInflation] = useState(true);
  const [showServicePayment, setShowServicePayment] = useState(false);
  const [showDrugPayment, setShowDrugPayment] = useState(false);

  // Escape key
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Borç tarihi değiştiğinde tahsilat tarihini de güncelle (hizmet ve ilaç)
  useEffect(() => { setSPaidDate(sDate); }, [sDate]);
  useEffect(() => { setDPaidDate(dDate); }, [dDate]);

  // Row management
  const addRow = () => setRows(prev => [...prev, { id: crypto.randomUUID(), drugId: '', qty: '1', priceMode: 'unit', unitPrice: '' }]);
  const removeRow = (rowId) => setRows(prev => prev.filter(r => r.id !== rowId));
  const updateRow = (rowId, field, value) => {
    setRows(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      const updated = { ...r, [field]: value };
      // İlaç seçildiğinde birim fiyatı otomatik doldur
      if (field === 'drugId') {
        const drug = drugs.find(d => d.id === value);
        if (drug) { updated.unitPrice = String(drug.price); updated.priceMode = 'unit'; }
      }
      return updated;
    }));
  };

  // Hizmet hesaplaması
  const serviceCalc = useMemo(() => {
    const a = parseFloat(amount) || 0;
    const p = Math.max(0, parseFloat(sPaid) || 0);
    if (a <= 0) return null;
    return { amount: a, paid: p, remaining: Math.round((a - p) * 100) / 100 };
  }, [amount, sPaid]);

  // İlaç hesaplamaları
  const drugCalc = useMemo(() => {
    const parsed = rows.map(r => {
      const drug = drugs.find(d => d.id === r.drugId);
      const q = parseFloat(r.qty) || 0;
      const priceInput = parseFloat(r.unitPrice) || 0;
      let up, total;
      if (!isPast) {
        up = drug?.price || 0;
        total = Math.round(q * up * 100) / 100;
      } else if (r.priceMode === 'total') {
        total = priceInput;
        up = q > 0 ? Math.round((priceInput / q) * 100) / 100 : 0;
      } else {
        up = priceInput;
        total = Math.round(q * up * 100) / 100;
      }
      return { ...r, drug, qty: q, unitPrice: up, total, valid: q > 0 && up > 0 && !!drug };
    });

    const grandTotal = parsed.reduce((s, r) => s + r.total, 0);
    const paid = parseFloat(dPaid) || 0;

    // Duplikat kontrolü
    const drugIds = parsed.filter(r => r.drugId).map(r => r.drugId);
    const duplicates = new Set(drugIds.filter((id, i) => drugIds.indexOf(id) !== i));

    // Orantılı dağılım (geçmiş mod, paid > 0)
    let distributions = null;
    if (paid > 0 && grandTotal > 0) {
      let remaining = paid;
      const lastValidIdx = parsed.reduce((acc, r, i) => r.valid ? i : acc, -1);
      distributions = parsed.map((r, i) => {
        if (!r.valid) return { ...r, paidShare: 0, remainQty: r.qty, remainTl: r.total, swept: false };
        const isLast = i === lastValidIdx;
        const share = isLast ? remaining : Math.round((r.total / grandTotal) * paid * 100) / 100;
        const actual = Math.min(share, r.total, remaining);
        remaining = Math.round((remaining - actual) * 100) / 100;
        const qtyDeducted = r.unitPrice > 0 ? Math.round((actual / r.unitPrice) * 100) / 100 : 0;
        const remainQty = Math.round((r.qty - qtyDeducted) * 100) / 100;
        const remainTl = Math.round(remainQty * r.unitPrice * 100) / 100;
        return { ...r, paidShare: actual, remainQty, remainTl, swept: remainTl <= 10 && remainTl >= 0 };
      });
    }

    // Enflasyon gösterimi
    const hasInflation = parsed.some(r => r.drug && r.unitPrice > 0 && r.drug.price > r.unitPrice);

    return { parsed, grandTotal, paid, duplicates, distributions, hasInflation };
  }, [rows, drugs, isPast, dPaid]);

  // Validasyon
  const isServiceValid = serviceCalc && serviceCalc.amount > 0 && desc.trim()
    && (!isPast || sDate)
    && (!isPast || (serviceCalc.paid >= 0 && serviceCalc.paid < serviceCalc.amount));

  const isDrugValid = useMemo(() => {
    if (drugCalc.parsed.length === 0) return false;
    if (!drugCalc.parsed.every(r => r.valid)) return false;
    if (drugCalc.duplicates.size > 0) return false;
    if (isPast && drugCalc.paid >= drugCalc.grandTotal) return false;
    if (drugCalc.paid < 0) return false;
    if (isPast && !dDate) return false;
    return true;
  }, [drugCalc, isPast, dDate]);

  const canSubmit = tab === 'service' ? isServiceValid : isDrugValid;

  // Submit
  const handleSubmit = () => {
    if (tab === 'service') {
      if (!isPast) {
        onAddServiceDebt(desc, parseFloat(amount));
      } else {
        const paid = parseFloat(sPaid) || 0;
        onAddPastServiceDebt(desc, parseFloat(amount), sDate, paid, paid > 0 ? sPaidDate : null);
      }
    } else {
      const items = drugCalc.parsed.filter(r => r.valid).map(r => ({
        drugId: r.drugId, qty: r.qty, unitPrice: r.unitPrice
      }));
      const date = isPast ? dDate : today;
      const paid = isPast ? drugCalc.paid : 0;
      const paidDate = isPast && paid > 0 ? dPaidDate : null;
      const inflation = isPast ? applyInflation : false;
      onAddBulkDrugDebt(items, date, paid, paidDate, inflation);
    }
    onClose();
  };

  const inputCls = 'w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none';
  const labelCls = 'block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide';

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              {!isPast
                ? <><Plus className="w-5 h-5 text-indigo-600" /> Borç Ekle</>
                : <><Clock className="w-5 h-5 text-indigo-600" /> Geçmiş Borç Kaydı</>
              }
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              {!isPast ? 'Bugünkü borç girişi' : 'Geçmiş tarihli borç girişi'}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 bg-slate-200/50 hover:bg-slate-200 p-2 rounded-full transition-colors">&#x2715;</button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">

          {/* Tab toggle */}
          <div className="flex bg-slate-100 p-1.5 rounded-lg">
            <button
              className={`flex-1 text-sm py-2 rounded-md font-semibold transition-all ${tab === 'service' ? 'bg-white shadow text-indigo-700' : 'text-slate-500 hover:text-slate-800'}`}
              onClick={() => { setTab('service'); setShowDrugPayment(false); }}
            >Hizmet (TL)</button>
            <button
              className={`flex-1 text-sm py-2 rounded-md font-semibold transition-all ${tab === 'drug' ? 'bg-white shadow text-indigo-700' : 'text-slate-500 hover:text-slate-800'}`}
              onClick={() => { setTab('drug'); setShowServicePayment(false); }}
              disabled={drugs.length === 0}
            >İlaç (Adet)</button>
          </div>

          {/* ========== Hizmet sekmesi ========== */}
          {tab === 'service' && (
            <div className="space-y-4">
              {isPast && (
                <div>
                  <label className={labelCls}>Tarih</label>
                  <input type="date" value={sDate} onChange={e => setSDate(e.target.value)} max={today} className={inputCls} />
                </div>
              )}
              <div>
                <label className={labelCls}>Açıklama</label>
                <input type="text" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Örn: Muayene" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Toplam Tutar (₺)</label>
                <input type="number" step="0.1" min="0" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.0" className={`${inputCls} font-semibold text-lg`} />
              </div>
              {isPast && (
                <>
                  <button
                    type="button"
                    onClick={() => { setShowServicePayment(p => !p); if (showServicePayment) setSPaid(''); }}
                    className="w-full flex items-center justify-between text-sm font-semibold text-indigo-600 bg-indigo-50 px-3 py-2 rounded-lg border border-indigo-100 hover:bg-indigo-100 transition-colors"
                  >
                    <span className="flex items-center gap-1.5">
                      <ChevronDown className={`w-4 h-4 transition-transform ${showServicePayment ? 'rotate-180' : ''}`} />
                      Kısmi Tahsilat Ekle (Opsiyonel)
                    </span>
                  </button>
                  {showServicePayment && (
                    <div className="space-y-3 pl-1">
                      <div>
                        <label className={labelCls}>Yapılmış Tahsilat (₺)</label>
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
                </>
              )}
            </div>
          )}

          {/* ========== İlaç sekmesi ========== */}
          {tab === 'drug' && (
            <div className="space-y-4">
              {isPast && (
                <div>
                  <label className={labelCls}>Tarih</label>
                  <input type="date" value={dDate} onChange={e => setDDate(e.target.value)} max={today} className={inputCls} />
                </div>
              )}

              {/* İlaç satırları */}
              <div className="space-y-3">
                {rows.map((row, idx) => {
                  const isDuplicate = drugCalc.duplicates.has(row.drugId);
                  const parsedRow = drugCalc.parsed[idx];
                  return (
                    <div key={row.id} className="bg-slate-50 rounded-lg p-3 border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-400">#{idx + 1}</span>
                        {rows.length > 1 && (
                          <button onClick={() => removeRow(row.id)} className="text-slate-300 hover:text-rose-500 transition-colors p-1 rounded" title="Satırı Sil">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <div>
                        <label className={labelCls}>İlaç Seçimi</label>
                        <select
                          value={row.drugId}
                          onChange={e => updateRow(row.id, 'drugId', e.target.value)}
                          className={`${inputCls} bg-white ${isDuplicate ? 'border-red-400 ring-1 ring-red-300' : ''}`}
                        >
                          <option value="">-- İlaç seçin --</option>
                          {drugs.map(d => <option key={d.id} value={d.id}>{d.name} ({fmtTL(d.price)})</option>)}
                        </select>
                        {isDuplicate && (
                          <p className="text-xs text-red-500 mt-1">Bu ilaç zaten listede mevcut.</p>
                        )}
                      </div>
                      <div className="flex gap-3">
                        <div className="flex-1">
                          <label className={labelCls}>Adet</label>
                          <input
                            type="number" step="0.1" min="0.1"
                            value={row.qty}
                            onChange={e => updateRow(row.id, 'qty', e.target.value)}
                            className={`${inputCls} font-semibold`}
                          />
                        </div>
                        {isPast && (
                          <div className="flex-1">
                            <label className={labelCls}>Fiyat Bilgisi</label>
                            <div className="flex bg-slate-100 p-1 rounded-lg mb-2">
                              <button
                                type="button"
                                className={`flex-1 text-xs py-1.5 rounded-md font-semibold transition-all ${row.priceMode === 'unit' ? 'bg-white shadow text-indigo-700' : 'text-slate-500'}`}
                                onClick={() => updateRow(row.id, 'priceMode', 'unit')}
                              >Birim Fiyat</button>
                              <button
                                type="button"
                                className={`flex-1 text-xs py-1.5 rounded-md font-semibold transition-all ${row.priceMode === 'total' ? 'bg-white shadow text-indigo-700' : 'text-slate-500'}`}
                                onClick={() => updateRow(row.id, 'priceMode', 'total')}
                              >Toplam Tutar</button>
                            </div>
                            <input
                              type="number" step="0.1" min="0"
                              value={row.unitPrice}
                              onChange={e => updateRow(row.id, 'unitPrice', e.target.value)}
                              placeholder={row.priceMode === 'unit' ? 'Birim fiyat (\u20BA)' : 'Toplam tutar (\u20BA)'}
                              className={`${inputCls} font-semibold`}
                            />
                          </div>
                        )}
                      </div>
                      {parsedRow && parsedRow.valid && (
                        <div className="text-xs text-slate-500 text-right">
                          {isPast && row.priceMode === 'total'
                            ? <>{fmtTL(parsedRow.total)} / {fmtQty(parsedRow.qty)} adet = <strong className="text-slate-700">{fmtTL(parsedRow.unitPrice)}/adet</strong></>
                            : <>{fmtQty(parsedRow.qty)} adet &times; {fmtTL(parsedRow.unitPrice)} = <strong className="text-slate-700">{fmtTL(parsedRow.total)}</strong></>
                          }
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Satır ekle butonu */}
              <button
                type="button"
                onClick={addRow}
                className="w-full py-2.5 rounded-lg border-2 border-dashed border-indigo-200 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-300 transition-colors text-sm font-semibold flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" /> İlaç Satırı Ekle
              </button>

              {/* Toplu özet */}
              {drugCalc.grandTotal > 0 && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-indigo-800">{drugCalc.parsed.filter(r => r.valid).length} kalem ilaç</span>
                    <span className="font-bold text-indigo-800">{fmtTL(drugCalc.grandTotal)}</span>
                  </div>
                </div>
              )}

              {/* Geçmiş mod: kısmi tahsilat */}
              {isPast && (
                <>
                  <button
                    type="button"
                    onClick={() => { setShowDrugPayment(p => !p); if (showDrugPayment) setDPaid(''); }}
                    className="w-full flex items-center justify-between text-sm font-semibold text-indigo-600 bg-indigo-50 px-3 py-2 rounded-lg border border-indigo-100 hover:bg-indigo-100 transition-colors"
                  >
                    <span className="flex items-center gap-1.5">
                      <ChevronDown className={`w-4 h-4 transition-transform ${showDrugPayment ? 'rotate-180' : ''}`} />
                      Kısmi Tahsilat Ekle (Opsiyonel)
                    </span>
                  </button>
                  {showDrugPayment && (
                    <div className="space-y-3 pl-1">
                      <div>
                        <label className={labelCls}>Yapılmış Tahsilat (₺) <span className="text-slate-400 normal-case font-normal">— tüm satırlara orantılı dağıtılır</span></label>
                        <input type="number" step="0.1" min="0" value={dPaid} onChange={e => setDPaid(e.target.value)} placeholder="0" className={inputCls} />
                      </div>

                      {drugCalc.paid > 0 && drugCalc.distributions && (
                        <>
                          <div>
                            <label className={labelCls}>Tahsilat Tarihi</label>
                            <input type="date" value={dPaidDate} onChange={e => setDPaidDate(e.target.value)} max={today} className={inputCls} />
                          </div>

                          {/* Orantılı dağılım preview */}
                          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm space-y-1.5">
                            <p className="font-semibold text-emerald-800 mb-2">Tahsilat Dağılımı</p>
                            {drugCalc.distributions.filter(d => d.valid).map(d => (
                              <div key={d.id} className="flex justify-between text-emerald-700">
                                <span>{d.drug?.name || '?'}: -{fmtTL(d.paidShare)}</span>
                                <span className={d.swept ? 'line-through text-slate-400' : 'font-bold'}>
                                  {d.swept ? 'Süpürüldü' : `Kalan: ${fmtQty(d.remainQty)} adet (${fmtTL(d.remainTl)})`}
                                </span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Enflasyon — kısmi tahsilattan bağımsız, her zaman görünür */}
                  {drugCalc.hasInflation && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input type="checkbox" checked={applyInflation} onChange={e => setApplyInflation(e.target.checked)} className="mt-0.5 rounded border-amber-300 text-amber-600 focus:ring-amber-500" />
                        <div className="text-sm">
                          <span className="font-semibold text-amber-800">Tüm satırlara enflasyon uygula</span>
                          <p className="text-amber-700 mt-0.5">Girilen birim fiyat, güncel fiyattan düşük olan satırlarda güncel fiyat uygulanır.</p>
                        </div>
                      </label>
                    </div>
                  )}
                </>
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
