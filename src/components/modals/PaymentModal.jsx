import React, { useState, useEffect } from 'react';
import { CreditCard, Check } from 'lucide-react';
import { fmtTL, fmtQty } from '../../utils/formatters';

export default function PaymentModal({ customer, serviceDebts, extreDDebts, onClose, onConfirm }) {
  const [amountReceived, setAmountReceived] = useState('');
  const [distribution, setDistribution] = useState([]);

  useEffect(() => {
    const received = parseFloat(amountReceived) || 0;
    let pool = received + customer.balance;

    const newDist = [];

    serviceDebts.forEach(sd => {
      let deduct = Math.max(0, Math.min(pool, sd.amount));
      deduct = Math.round(deduct * 10) / 10;
      newDist.push({ type: 'service', id: sd.id, desc: sd.desc, original: sd.amount, deduct });
      pool -= deduct;
    });

    const totalDrugDebt = extreDDebts.reduce((sum, dd) => sum + dd.tlValue, 0);
    if (pool > 0 && totalDrugDebt > 0) {
      let drugPool = pool;
      extreDDebts.forEach(dd => {
        const ratio = dd.tlValue / totalDrugDebt;
        let deduct = Math.min(drugPool * ratio, dd.tlValue);
        deduct = Math.round(deduct * 10) / 10;
        newDist.push({ type: 'drug', id: dd.id, desc: dd.drugName, original: dd.tlValue, deduct, maxPrice: dd.maxPrice, qty: dd.qty });
      });
    } else {
      extreDDebts.forEach(dd => {
        newDist.push({ type: 'drug', id: dd.id, desc: dd.drugName, original: dd.tlValue, deduct: 0, maxPrice: dd.maxPrice, qty: dd.qty });
      });
    }

    setDistribution(newDist);
  }, [amountReceived, customer.balance, serviceDebts, extreDDebts]);

  const handleOverride = (id, val) => {
    const num = parseFloat(val) || 0;
    setDistribution(prev => prev.map(item => item.id === id ? { ...item, deduct: num } : item));
  };

  const received = parseFloat(amountReceived) || 0;
  const totalDistributed = distribution.reduce((sum, item) => sum + item.deduct, 0);
  const totalAvailable = received + customer.balance;
  const newBalance = totalAvailable - totalDistributed;
  const isValid = newBalance >= -0.1;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><CreditCard className="text-emerald-600" /> Tahsilat & Dağıtım</h2>
            <p className="text-sm text-slate-500 mt-1">Müşteri: <strong className="text-slate-700">{customer.name}</strong></p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 bg-slate-200/50 hover:bg-slate-200 p-2 rounded-full transition-colors">✕</button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 bg-white">
          <div className="flex flex-col sm:flex-row gap-4 mb-8">
            <div className="flex-1">
              <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Kasaya Giren Tutar (₺)</label>
              <input type="number" step="0.1" value={amountReceived} onChange={e => setAmountReceived(e.target.value)} placeholder="Örn: 1500" className="w-full text-3xl font-bold border-2 border-indigo-200 rounded-xl px-4 py-4 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 focus:outline-none transition-all text-slate-800" autoFocus />
            </div>
            <div className="sm:w-1/3 bg-emerald-50 rounded-xl p-5 border border-emerald-100 flex flex-col justify-center items-center sm:items-start text-center sm:text-left">
              <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">Mevcut Avans</span>
              <span className="text-2xl font-bold text-emerald-700">+{fmtTL(customer.balance)}</span>
            </div>
          </div>

          <div className="mb-4">
            <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2 text-lg">
              Dağıtım Tablosu <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-1 rounded-md">Sistem Önerisi - Değiştirebilirsiniz</span>
            </h3>

            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3.5 font-bold uppercase tracking-wider text-xs">Borç Kalemi</th>
                    <th className="px-5 py-3.5 font-bold uppercase tracking-wider text-xs text-right">Güncel Borç</th>
                    <th className="px-5 py-3.5 font-bold uppercase tracking-wider text-xs w-48 text-right">Düşülecek Tutar (₺)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {distribution.length === 0 && (
                    <tr><td colSpan="3" className="p-8 text-center text-slate-500 bg-slate-50/50">Kapatılacak borç bulunmuyor. Alınan para doğrudan avansa yazılacak.</td></tr>
                  )}
                  {distribution.map(item => (
                    <tr key={item.id} className={`transition-colors ${item.deduct > 0 ? 'bg-indigo-50/40' : 'hover:bg-slate-50'}`}>
                      <td className="px-5 py-4">
                        <span className="font-bold text-slate-800 text-base">{item.desc}</span>
                        <div className="text-xs font-medium text-slate-500 mt-1">{item.type === 'service' ? 'Sabit Hizmet Borcu' : `İlaç (Kalan: ${fmtQty(item.qty)} Adet)`}</div>
                      </td>
                      <td className="px-5 py-4 text-right font-bold text-slate-600 text-base">{fmtTL(item.original)}</td>
                      <td className="px-5 py-3">
                        <input type="number" step="0.1" value={item.deduct === 0 ? '' : item.deduct} onChange={(e) => handleOverride(item.id, e.target.value)} placeholder="0.0" className={`w-full border-2 rounded-lg px-3 py-2 text-right font-bold text-lg focus:outline-none transition-colors ${item.deduct > 0 ? 'border-indigo-400 text-indigo-700 bg-white focus:ring-4 focus:ring-indigo-500/20' : 'border-slate-200 text-slate-500 bg-slate-50 focus:border-indigo-400 focus:bg-white'}`} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className={`p-5 rounded-xl flex justify-between items-center border-2 transition-colors mt-6 ${isValid ? 'bg-slate-50 border-slate-200' : 'bg-red-50 border-red-300'}`}>
            <div>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-wide">Dağıtılan Toplam</p>
              <p className="font-bold text-slate-800 text-2xl mt-1">{fmtTL(totalDistributed)}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-slate-500 uppercase tracking-wide">İşlem Sonrası Yeni Avans</p>
              <p className={`font-bold text-2xl mt-1 ${newBalance < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {fmtTL(newBalance)}
              </p>
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-slate-200 bg-slate-50 flex justify-end gap-3 rounded-b-2xl">
          <button onClick={onClose} className="px-6 py-3 rounded-xl text-slate-600 font-bold hover:bg-slate-200 transition-colors">İptal</button>
          <button disabled={!isValid || (received === 0 && customer.balance === 0)} onClick={() => onConfirm(received, distribution)} className="px-8 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md disabled:opacity-50 flex items-center gap-2 text-lg"><Check className="w-6 h-6" /> Tahsilatı Onayla</button>
        </div>
      </div>
    </div>
  );
}
