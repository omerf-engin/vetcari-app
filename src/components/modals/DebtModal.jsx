import { useState, useEffect, useMemo } from 'react';
import { Plus, Clock, Check, Trash2, ChevronDown } from 'lucide-react';
import { useCustomer } from '../../hooks/useCustomer';
import DrugPicker from './DrugPicker';
import { fmtTL, fmtQty } from '../../utils/formatters';
import { todayLocal } from '../../utils/dates';

const emptyRow = () => ({ id: crypto.randomUUID(), drugId: '', qty: '1', priceMode: 'unit', unitPrice: '' });

export default function DebtModal({ mode, onClose }) {
  const { drugs, onAddDebtTransaction } = useCustomer();
  const isPast = mode === 'past';

  const [tab, setTab] = useState('service');
  const today = todayLocal();

  // İşlem tarihi — hizmet ve ilaç ortak (tek işlem = tek tarih)
  const [date, setDate] = useState(today);

  // Hizmet state
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [sPaid, setSPaid] = useState('');
  const [sPaidDate, setSPaidDate] = useState(today);

  // İlaç state — liste boş başlar. Doldurulacak boş satır diye bir şey yok; kalem
  // yalnızca arama seçicisinden eklenir. Ön seçim olsaydı yalnızca hizmet girmek
  // isteyen kullanıcıya istemeden ilaç borcu yazılırdı.
  const [rows, setRows] = useState([]);
  const [dPaid, setDPaid] = useState('');
  const [dPaidDate, setDPaidDate] = useState(today);
  const [applyInflation, setApplyInflation] = useState(true);
  const [showServicePayment, setShowServicePayment] = useState(false);
  const [showDrugPayment, setShowDrugPayment] = useState(false);

  // Escape key.
  // Dinleyici `document` üzerinde duruyor ki modal açılır açılmaz, hiçbir şeye
  // odaklanılmamışken de çalışsın. İlaç seçicisinin listesi açıkken Escape'i seçici
  // kendi içinde tüketir (`stopPropagation`), olay buraya hiç ulaşmaz.
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Borç tarihi değiştiğinde tahsilat tarihlerini de güncelle
  useEffect(() => { setSPaidDate(date); setDPaidDate(date); }, [date]);

  // Row management
  //
  // Sıra anlam taşır: kısmi tahsilat orantılı dağıtılırken yuvarlama artığını SON geçerli
  // satır alıyor (bkz. `drugCalc.distributions`). Bu yüzden yeni kalem daima sona eklenir,
  // mevcut satırlar yeniden sıralanmaz ve yeniden anahtarlanmaz.
  const addOrIncrementRow = (drugId, qty) => {
    setRows(prev => {
      const idx = prev.findIndex(r => r.drugId === drugId);
      if (idx !== -1) {
        // Zaten ekli ilaç ikinci satır açmaz, adedi artırır
        const next = [...prev];
        const current = parseFloat(next[idx].qty) || 0;
        next[idx] = { ...next[idx], qty: String(Math.round((current + qty) * 100) / 100) };
        return next;
      }
      const drug = drugs.find(d => d.id === drugId);
      return [...prev, {
        ...emptyRow(),
        drugId,
        qty: String(qty),
        unitPrice: drug ? String(drug.price) : '',
        priceMode: 'unit',
      }];
    });
  };

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

  const stepQty = (row, delta) => {
    const current = parseFloat(row.qty) || 0;
    const next = Math.max(0.1, Math.round((current + delta) * 100) / 100);
    updateRow(row.id, 'qty', String(next));
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
      // "Dolu" (ilaç seçilmiş) satırlar geçerlilikten ayrı tutulur:
      // hiç dokunulmamış satırlar tamamen yok sayılır
      return { ...r, drug, qty: q, unitPrice: up, total, filled: !!r.drugId, valid: q > 0 && up > 0 && !!drug };
    });

    const filled = parsed.filter(r => r.filled);
    const grandTotal = filled.reduce((s, r) => s + r.total, 0);
    const paid = parseFloat(dPaid) || 0;

    // Duplikat kontrolü
    const drugIds = filled.map(r => r.drugId);
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
    const hasInflation = filled.some(r => r.drug && r.unitPrice > 0 && r.drug.price > r.unitPrice);

    return { parsed, filled, grandTotal, paid, duplicates, distributions, hasInflation };
  }, [rows, drugs, isPast, dPaid]);

  // --- Dolu mu / geçerli mi ---
  const serviceFilled = Boolean(desc.trim() || amount);
  const drugFilled = drugCalc.filled.length > 0;

  const isServiceValid = serviceCalc && serviceCalc.amount > 0 && desc.trim()
    && (!isPast || (serviceCalc.paid >= 0 && serviceCalc.paid < serviceCalc.amount));

  const isDrugValid = useMemo(() => {
    if (drugCalc.filled.length === 0) return false;
    if (!drugCalc.filled.every(r => r.valid)) return false;
    if (drugCalc.duplicates.size > 0) return false;
    if (isPast && drugCalc.paid >= drugCalc.grandTotal) return false;
    if (drugCalc.paid < 0) return false;
    return true;
  }, [drugCalc, isPast]);

  // En az bir bölüm dolu olmalı ve dolu olan her bölüm geçerli olmalı
  const canSubmit =
    (serviceFilled || drugFilled)
    && (!serviceFilled || isServiceValid)
    && (!drugFilled || isDrugValid)
    && (!isPast || !!date);

  const summaryTotal =
    (serviceFilled && isServiceValid ? serviceCalc.amount : 0) +
    (drugFilled && isDrugValid ? drugCalc.grandTotal : 0);

  // Submit — hizmet ve ilaç tek atomik işlemde yazılır
  const handleSubmit = () => {
    const sPaidVal = isPast ? (parseFloat(sPaid) || 0) : 0;
    const dPaidVal = isPast ? drugCalc.paid : 0;

    onAddDebtTransaction({
      date: isPast ? date : today,
      service: serviceFilled && isServiceValid
        ? {
            desc,
            amount: parseFloat(amount),
            paidAmount: sPaidVal,
            paidDate: sPaidVal > 0 ? sPaidDate : null
          }
        : null,
      drugItems: drugFilled && isDrugValid
        ? drugCalc.filled.filter(r => r.valid).map(r => ({ drugId: r.drugId, qty: r.qty, unitPrice: r.unitPrice }))
        : [],
      drugPaidAmount: dPaidVal,
      drugPaidDate: dPaidVal > 0 ? dPaidDate : null,
      applyInflation: isPast ? applyInflation : false
    });
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
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700 bg-slate-200/50 hover:bg-slate-200 p-2 rounded-full transition-colors touch-target">&#x2715;</button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">

          {/* İşlem tarihi — her iki bölüm için ortak */}
          {isPast && (
            <div>
              <label className={labelCls}>İşlem Tarihi</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} max={today} className={inputCls} />
            </div>
          )}

          {/* Tab toggle — her iki bölüm de aynı işleme yazılır, dolu olanlar işaretlenir */}
          <div className="flex bg-slate-100 p-1.5 rounded-lg">
            <button
              className={`flex-1 text-sm py-2 rounded-md font-semibold transition-all flex items-center justify-center gap-1.5 ${tab === 'service' ? 'bg-white shadow text-indigo-700' : 'text-slate-500 hover:text-slate-800'}`}
              onClick={() => { setTab('service'); setShowDrugPayment(false); }}
            >
              Hizmet (TL)
              {serviceFilled && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" title="Bu bölümde kayıt var" />}
            </button>
            <button
              className={`flex-1 text-sm py-2 rounded-md font-semibold transition-all flex items-center justify-center gap-1.5 ${tab === 'drug' ? 'bg-white shadow text-indigo-700' : 'text-slate-500 hover:text-slate-800'}`}
              onClick={() => { setTab('drug'); setShowServicePayment(false); }}
              disabled={drugs.length === 0}
            >
              İlaç (Adet)
              {drugFilled && <span className="text-[10px] font-bold text-indigo-600 bg-indigo-100 px-1.5 py-0.5 rounded-full">{drugCalc.filled.length}</span>}
            </button>
          </div>

          {/* ========== Hizmet sekmesi ========== */}
          {tab === 'service' && (
            <div className="space-y-4">
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
              <DrugPicker drugs={drugs} onPick={addOrIncrementRow} />

              {/* Eklenen kalemler — tek satırlık şeritler */}
              {rows.length === 0 ? (
                <p className="text-sm text-slate-500 italic text-center py-6 border border-dashed border-slate-200 rounded-lg">
                  Henüz kalem eklenmedi. Yukarıdan arayıp Enter&rsquo;a basın.
                </p>
              ) : (
                <ul className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                  {rows.map((row, idx) => {
                    const parsedRow = drugCalc.parsed[idx];
                    return (
                      <li key={row.id} className="p-3 space-y-2">
                        <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
                          <div className="w-full sm:flex-1 min-w-0">
                            {/* Kırpma DEĞİL sarma: aynı önekle başlayan iki ilaç
                                (… 250 ML / … 500 ML) kırpılınca ayırt edilemez hale gelir */}
                            <p className="font-semibold text-slate-800 text-sm break-words">
                              {parsedRow?.drug?.name || 'Bilinmeyen ilaç'}
                            </p>
                            <p className="text-xs text-slate-500">{fmtTL(parsedRow?.unitPrice || 0)} / adet</p>
                          </div>

                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => stepQty(row, -1)}
                              title="Adet azalt"
                              className="w-8 h-8 rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200 font-bold transition-colors touch-target"
                            >&minus;</button>
                            <input
                              type="number" step="0.1" min="0.1"
                              value={row.qty}
                              onChange={e => updateRow(row.id, 'qty', e.target.value)}
                              aria-label="Adet"
                              className="w-16 border border-slate-300 rounded-lg px-2 py-1.5 text-sm text-center font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => stepQty(row, 1)}
                              title="Adet artır"
                              className="w-8 h-8 rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200 font-bold transition-colors touch-target"
                            >+</button>
                          </div>

                          <p className="font-bold text-slate-800 text-sm text-right flex-1 sm:flex-none sm:w-24 flex-shrink-0">
                            {fmtTL(parsedRow?.total || 0)}
                          </p>

                          <button
                            onClick={() => removeRow(row.id)}
                            title="Kalemi Çıkar"
                            className="text-slate-500 hover:text-rose-500 hover:bg-rose-50 transition-colors p-1.5 rounded-md flex-shrink-0 touch-target"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {isPast && (
                          <div className="flex items-center gap-2">
                            <div className="flex bg-slate-100 p-1 rounded-lg flex-shrink-0">
                              <button
                                type="button"
                                className={`text-xs px-2.5 py-1.5 rounded-md font-semibold transition-all ${row.priceMode === 'unit' ? 'bg-white shadow text-indigo-700' : 'text-slate-500'}`}
                                onClick={() => updateRow(row.id, 'priceMode', 'unit')}
                              >Birim Fiyat</button>
                              <button
                                type="button"
                                className={`text-xs px-2.5 py-1.5 rounded-md font-semibold transition-all ${row.priceMode === 'total' ? 'bg-white shadow text-indigo-700' : 'text-slate-500'}`}
                                onClick={() => updateRow(row.id, 'priceMode', 'total')}
                              >Toplam Tutar</button>
                            </div>
                            <input
                              type="number" step="0.1" min="0"
                              value={row.unitPrice}
                              onChange={e => updateRow(row.id, 'unitPrice', e.target.value)}
                              placeholder={row.priceMode === 'unit' ? 'Birim fiyat (₺)' : 'Toplam tutar (₺)'}
                              aria-label={row.priceMode === 'unit' ? 'Birim fiyat' : 'Toplam tutar'}
                              className="flex-1 min-w-0 border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            />
                          </div>
                        )}

                        {isPast && parsedRow?.valid && row.priceMode === 'total' && (
                          <p className="text-xs text-slate-500 text-right">
                            {fmtTL(parsedRow.total)} / {fmtQty(parsedRow.qty)} adet = <strong className="text-slate-700">{fmtTL(parsedRow.unitPrice)}/adet</strong>
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              {/* Toplu özet */}
              {drugCalc.grandTotal > 0 && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-indigo-800">{drugCalc.filled.filter(r => r.valid).length} kalem ilaç</span>
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
                        <label className={labelCls}>Yapılmış Tahsilat (₺) <span className="text-slate-500 normal-case font-normal">— tüm satırlara orantılı dağıtılır</span></label>
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
                                <span className={d.swept ? 'line-through text-slate-500' : 'font-bold'}>
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

        {/* Footer — iki bölümün birlikte yazılacağı özeti */}
        <div className="p-5 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row justify-between items-center gap-4 rounded-b-2xl">
          <div className="text-center sm:text-left min-w-0">
            {canSubmit ? (
              <>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Kaydedilecek</p>
                <p className="text-sm font-semibold text-slate-700">
                  {[
                    serviceFilled && isServiceValid ? '1 hizmet' : null,
                    drugFilled && isDrugValid ? `${drugCalc.filled.filter(r => r.valid).length} ilaç kalemi` : null
                  ].filter(Boolean).join(' + ')}
                  <span className="text-slate-500"> · </span>
                  <span className="font-bold text-indigo-700">{fmtTL(summaryTotal)}</span>
                </p>
              </>
            ) : (
              <p className="text-sm text-slate-500 italic">Hizmet veya ilaç bilgisi girin</p>
            )}
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <button onClick={onClose} className="flex-1 sm:flex-none px-6 py-3 rounded-xl text-slate-600 font-bold hover:bg-slate-200 transition-colors">İptal</button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="flex-1 sm:flex-none px-8 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Check className="w-5 h-5" /> Kaydet
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
