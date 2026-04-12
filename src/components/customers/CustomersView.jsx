import React, { useState } from 'react';
import { Users, UserPlus, Edit2, Trash2, Check, X, SearchX } from 'lucide-react';
import { fmtTL } from '../../utils/formatters';

export default function CustomersView({ customers, serviceDebts, drugDebts, onSelect, onAddCustomer, onDeleteCustomer, onUpdateCustomerName }) {
  const [newCustomerName, setNewCustomerName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [tempName, setTempName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredCustomers = customers.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const calculateTotalDebt = (customerId) => {
    const sDebt = serviceDebts
      .filter((d) => d.customerId === customerId)
      .reduce((sum, d) => sum + Number(d.amount || 0), 0);
    const dDebt = drugDebts
      .filter((d) => d.customerId === customerId)
      .reduce((sum, d) => sum + Number(d.qty || 0) * Number(d.maxPrice || 0), 0);
    return Math.max(0, Math.round((sDebt + dDebt) * 100) / 100);
  };

  const handleAddSubmit = (e) => {
    e.preventDefault();
    onAddCustomer(newCustomerName);
    setNewCustomerName(''); setIsAdding(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Users className="w-6 h-6 text-indigo-600" /> Müşteriler Listesi</h2>
        <div className="flex-1 w-full sm:w-auto px-0 sm:px-4">
          <input type="text" placeholder="Müşteri Ara..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full border border-slate-300 shadow-sm rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
        </div>
        {!isAdding ? (
          <button onClick={() => setIsAdding(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors"><UserPlus className="w-4 h-4" /> Yeni Müşteri Ekle</button>
        ) : (
          <form onSubmit={handleAddSubmit} className="flex gap-2 w-full sm:w-auto">
            <input type="text" placeholder="Ad Soyad" value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none w-full sm:w-64" autoFocus required />
            <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">Kaydet</button>
            <button type="button" onClick={() => setIsAdding(false)} className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-2 rounded-lg text-sm font-semibold transition-colors">İptal</button>
          </form>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {customers.length === 0 ? (
          <div className="col-span-1 md:col-span-2 lg:col-span-3 text-center py-16 text-slate-500">
            <Users className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p className="font-semibold text-slate-600">Henüz müşteri eklenmemiş</p>
            <p className="text-sm mt-1 mb-4">İlk müşterinizi eklemek için aşağıdaki butonu kullanın.</p>
            <button
              onClick={() => { setIsAdding(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors mx-auto"
            >
              <UserPlus className="w-4 h-4" /> İlk Müşteriyi Ekle
            </button>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="col-span-1 md:col-span-2 lg:col-span-3 text-center py-16 text-slate-400">
            <SearchX className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p>&ldquo;<strong className="text-slate-600">{searchTerm}</strong>&rdquo; ile eşleşen müşteri bulunamadı.</p>
          </div>
        ) : null}
        {filteredCustomers.map(c => {
          const totalDebt = calculateTotalDebt(c.id);
          const netBalance = c.balance - totalDebt;
          return (
            <div key={c.id} onClick={() => { if (!editingId) onSelect(c.id); }} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 cursor-pointer hover:shadow-md hover:border-indigo-400 transition-all group relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              
              <div className="flex justify-between items-start mb-4">
                {editingId === c.id ? (
                  <div className="flex gap-2 w-full z-10" onClick={e => e.stopPropagation()}>
                    <input type="text" value={tempName} onChange={e => setTempName(e.target.value)} className="w-full border border-slate-300 px-2 py-1 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" autoFocus />
                    <button onClick={() => { onUpdateCustomerName(c.id, tempName); setEditingId(null); }} className="text-emerald-600 hover:text-emerald-800 p-1 bg-emerald-50 rounded"><Check className="w-4 h-4" /></button>
                    <button onClick={() => setEditingId(null)} className="text-slate-400 hover:text-slate-600 p-1 bg-slate-50 rounded"><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <>
                    <h3 className="text-lg font-semibold text-slate-800 group-hover:text-indigo-600 pr-4">{c.name}</h3>
                    <div className="flex gap-1.5 z-10" onClick={e => e.stopPropagation()}>
                       <button onClick={() => { setEditingId(c.id); setTempName(c.name); }} title="İsmi Düzenle" className="text-slate-400 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 p-1.5 rounded-md transition-colors"><Edit2 className="w-4 h-4" /></button>
                       <button onClick={() => onDeleteCustomer(c.id, totalDebt, c.balance)} title="Müşteriyi Sil" className="text-slate-400 hover:text-rose-600 bg-slate-50 hover:bg-rose-50 p-1.5 rounded-md transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </>
                )}
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Güncel Borç:</span><span className="font-medium text-red-600">{fmtTL(totalDebt)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Avans/Bakiye:</span><span className="font-medium text-emerald-600">{fmtTL(c.balance)}</span></div>
                <div className="pt-2 border-t flex justify-between font-bold"><span>Net Durum:</span><span className={netBalance < 0 ? 'text-red-600' : 'text-emerald-600'}>{fmtTL(Math.abs(netBalance))} {netBalance < 0 ? 'Borçlu' : 'Alacaklı'}</span></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
