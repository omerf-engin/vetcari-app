import React, { useState } from 'react';
import { Pill, Plus, Save, Edit2, Trash2 } from 'lucide-react';
import { fmtTL } from '../../utils/formatters';

export default function DrugsView({ drugs, onUpdatePrice, onAddDrug, onDeleteDrug }) {
  const [editingId, setEditingId] = useState(null);
  const [tempPrice, setTempPrice] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newDrugName, setNewDrugName] = useState('');
  const [newDrugPrice, setNewDrugPrice] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredDrugs = drugs.filter(d => d.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const handleSavePrice = (id) => {
    const p = parseFloat(tempPrice);
    if (!isNaN(p) && p > 0) onUpdatePrice(id, p);
    setEditingId(null);
  };

  const handleAddSubmit = (e) => {
    e.preventDefault();
    const p = parseFloat(newDrugPrice);
    if (isNaN(p) || p <= 0) return;
    onAddDrug(newDrugName, p);
    setNewDrugName(''); setNewDrugPrice(''); setIsAdding(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Pill className="w-6 h-6 text-indigo-600" /> İlaç & Fiyat Listesi</h2>
        <div className="flex-1 w-full md:w-auto px-0 md:px-4">
          <input type="text" placeholder="İlaç Ara..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full border border-slate-300 shadow-sm rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          {!isAdding ? (
            <button onClick={() => setIsAdding(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors"><Plus className="w-4 h-4" /> Yeni İlaç Ekle</button>
          ) : (
            <form onSubmit={handleAddSubmit} className="flex flex-col sm:flex-row gap-3 w-full">
              <input type="text" placeholder="İlaç Adı" value={newDrugName} onChange={(e) => setNewDrugName(e.target.value)} className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" autoFocus required />
              <input type="number" step="0.1" min="0.1" placeholder="Satış Fiyatı (₺)" value={newDrugPrice} onChange={(e) => setNewDrugPrice(e.target.value)} className="w-full sm:w-48 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" required />
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
              {filteredDrugs.length === 0 && (
                <tr><td colSpan="3" className="px-6 py-8 text-center text-slate-500">Listede ilaç bulunamadı.</td></tr>
              )}
              {filteredDrugs.map(drug => (
                <tr key={drug.id} className="hover:bg-slate-50/50">
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-800">{drug.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-slate-700">
                    {editingId === drug.id ? (
                      <input type="number" step="0.1" min="0.1" value={tempPrice} onChange={(e) => setTempPrice(e.target.value)} className="border-2 border-indigo-400 rounded-md px-2 py-1 w-28 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" autoFocus />
                    ) : (
                      <span className="font-bold text-lg">{fmtTL(drug.price)}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {editingId === drug.id ? (
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => setEditingId(null)} className="text-slate-400 hover:text-slate-600 px-2 flex items-center transition-colors">İptal</button>
                        <button onClick={() => handleSavePrice(drug.id)} className="text-emerald-600 hover:text-emerald-800 flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-md transition-colors"><Save className="w-4 h-4" /> Kaydet</button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-3">
                        <button onClick={() => { setEditingId(drug.id); setTempPrice(drug.price); }} className="text-indigo-600 hover:text-indigo-800 flex items-center justify-end gap-1.5 font-semibold transition-colors"><Edit2 className="w-4 h-4" /> Fiyatı Güncelle</button>
                        <button onClick={() => onDeleteDrug(drug.id)} title="İlacı Sistemden Sil" className="text-rose-500 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 p-1.5 rounded-md transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
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
