import React, { useState, useEffect, useMemo } from 'react';
import { Undo } from 'lucide-react';
import { fmtTL, fmtQty, fmtDate } from '../../utils/formatters';

/**
 * Aynı işlemde açılmış ilaç borçlarından seçilenleri toplu iade eder.
 * Hizmet kalemleri iade edilmez (kendi Sil butonuyla iptal edilir), bu yüzden listelenmez.
 * @param {object} group — groupDebtsByBatch çıktısındaki bir grup
 * @param {(items: Array<{debt: object, returnQty: number}>) => void} onConfirm
 */
export default function BatchReturnModal({ group, onConfirm, onClose }) {
  const drugItems = useMemo(() => group.items.filter(i => i.type === 'drug'), [group.items]);

  const [rows, setRows] = useState(() =>
    drugItems.map(d => ({ id: d.id, selected: false, qty: String(d.qty) }))
  );

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const allSelected = rows.length > 0 && rows.every(r => r.selected);

  const toggleAll = () => {
    const next = !allSelected;
    setRows(prev => prev.map(r => ({ ...r, selected: next })));
  };

  const toggleRow = (id) => {
    setRows(prev => prev.map(r => (r.id === id ? { ...r, selected: !r.selected } : r)));
  };

  const setQty = (id, value) => {
    setRows(prev => prev.map(r => (r.id === id ? { ...r, qty: value, selected: true } : r)));
  };

  const { selection, totalTl, hasInvalid } = useMemo(() => {
    const sel = [];
    let total = 0;
    let invalid = false;

    rows.forEach(row => {
      if (!row.selected) return;
      const debt = drugItems.find(d => d.id === row.id);
      const qty = parseFloat(row.qty);
      if (!debt || !(qty > 0)) { invalid = true; return; }
      sel.push({ debt, returnQty: qty });
      total += Math.min(qty, debt.qty) * debt.maxPrice;
    });

    return { selection: sel, totalTl: Math.round(total * 100) / 100, hasInvalid: invalid };
  }, [rows, drugItems]);

  const canSubmit = selection.length > 0 && !hasInvalid;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh] border-t-4 border-t-rose-500" onClick={e => e.stopPropagation()}>

        <div className="p-6 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Undo className="w-5 h-5 text-rose-600" /> Toplu İade</h2>
            <p className="text-sm text-slate-500 mt-1">{fmtDate(group.date)} · {group.itemCount} kalemlik işlem</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 bg-slate-200/50 hover:bg-slate-200 p-2 rounded-full transition-colors">&#x2715;</button>
        </div>

        <div className="px-6 py-3 border-b border-slate-100 flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-slate-600">
            <input type="checkbox" checked={allSelected} onChange={toggleAll} className="w-4 h-4 accent-rose-600 cursor-pointer" />
            Tümünü seç
          </label>
          <span className="text-xs text-slate-400 font-medium">{selection.length} kalem seçili</span>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-3">
          {drugItems.map(debt => {
            const row = rows.find(r => r.id === debt.id);
            const qty = parseFloat(row.qty);
            const invalid = row.selected && !(qty > 0);
            return (
              <div key={debt.id} className={`p-4 rounded-xl border transition-colors ${row.selected ? 'border-rose-200 bg-rose-50/50' : 'border-slate-200 bg-white'}`}>
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={row.selected}
                    onChange={() => toggleRow(debt.id)}
                    className="w-4 h-4 mt-1 accent-rose-600 cursor-pointer flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800">{debt.drugName}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Mevcut borç: {fmtQty(debt.qty)} adet × {fmtTL(debt.maxPrice)}
                    </p>
                  </div>
                  <div className="w-28 flex-shrink-0">
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      value={row.qty}
                      onChange={(e) => setQty(debt.id, e.target.value)}
                      className={`w-full border-2 rounded-lg px-3 py-2 text-right font-bold focus:outline-none transition-colors ${
                        invalid ? 'border-rose-400 text-rose-700 bg-white' : 'border-slate-200 text-slate-700 focus:border-rose-400'
                      }`}
                    />
                    <p className="text-[10px] text-slate-400 text-right mt-1 uppercase tracking-wide">İade adedi</p>
                  </div>
                </div>
                {qty > debt.qty && row.selected && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1 mt-2">
                    Mevcut borçtan fazla: aşan {fmtQty(qty - debt.qty)} adet karşılığı avansa yazılacak.
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <div className="p-5 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row justify-between items-center gap-4 rounded-b-2xl">
          <div className="text-center sm:text-left">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Düşülecek Borç</p>
            <p className="font-bold text-rose-600 text-2xl">{fmtTL(totalTl)}</p>
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <button onClick={onClose} className="flex-1 sm:flex-none px-6 py-3 rounded-xl text-slate-600 font-bold hover:bg-slate-200 transition-colors">İptal</button>
            <button
              disabled={!canSubmit}
              onClick={() => { onConfirm(selection); onClose(); }}
              className="flex-1 sm:flex-none px-8 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Undo className="w-5 h-5" /> İadeyi Onayla
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
