import React, { useState } from 'react';
import { Pill, Plus, Save, TrendingUp } from 'lucide-react';
import { fmtTL } from '../../utils/formatters';

export default function DrugsView({ drugs, onUpdatePrice, onAddDrug }) {
  const [editingId, setEditingId] = useState(null);
  const [tempPrice, setTempPrice] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newDrugName, setNewDrugName] = useState('');
  const [newDrugPrice, setNewDrugPrice] = useState('');

  const handleSavePrice = (id) => {
    const p = parseFloat(tempPrice);
    if (!isNaN(p) && p > 0) onUpdatePrice(id, p);
    setEditingId(null);
  };

  const handleAddSubmit = (e) => {
    e.preventDefault();
    onAddDrug(newDrugName, newDrugPrice);
    setNewDrugName(''); setNewDrugPrice(''); setIsAdding(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Pill className="w-6 h-6 text-indigo-600" /> İlaç & Fiyat Listesi</h2>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          {!isAdding ? (
            <button onClick={() => setIsAdding(true)} className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"><Plus className="w-4 h-4" /> Sisteme Yeni İlaç Tanımla</button>
          ) : (
            <form onSubmit={handleAddSubmit} className="flex flex-col sm:flex-row gap-3 w-full">
              <input type="text" placeholder="İlaç Adı" value={newDrugName} onChange={(e) => setNewDrugName(e.target.value)} className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" autoFocus required />
              <input type="number" step="0.1" placeholder="Satış Fiyatı (₺)" value={newDrugPrice} onChange={(e) => setNewDrugPrice(e.target.value)} className="w-full sm:w-48 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" required />
              <div className="flex gap-2">
                <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">Ekle</button>
                <button type="button" onClick={() => setIsAdding(false)} className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-2 rounded-lg text-sm font-semibold transition-colors">İptal</button>
              </div>
            </form>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">İlaç Adı</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Güncel Birim Fiyat (Satış)</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">İşlem</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {drugs.map(drug => (
                <tr key={drug.id} className="hover:bg-slate-50/50">
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-800">{drug.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-slate-700">
                    {editingId === drug.id ? (
                      <input type="number" step="0.1" value={tempPrice} onChange={(e) => setTempPrice(e.target.value)} className="border-2 border-indigo-400 rounded-md px-2 py-1 w-28 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" autoFocus />
                    ) : (
                      <span className="font-bold text-lg">{fmtTL(drug.price)}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {editingId === drug.id ? (
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => setEditingId(null)} className="text-slate-400 hover:text-slate-600 px-2">İptal</button>
                        <button onClick={() => handleSavePrice(drug.id)} className="text-emerald-600 hover:text-emerald-800 flex items-center gap-1 bg-emerald-50 px-3 py-1.5 rounded-md"><Save className="w-4 h-4" /> Kaydet</button>
                      </div>
                    ) : (
                      <button onClick={() => { setEditingId(drug.id); setTempPrice(drug.price); }} className="text-indigo-600 hover:text-indigo-800 flex items-center justify-end w-full gap-1.5 font-semibold"><TrendingUp className="w-4 h-4" /> Fiyatı Güncelle</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
