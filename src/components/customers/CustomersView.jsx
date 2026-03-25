import React, { useState } from 'react';
import { Users, UserPlus } from 'lucide-react';
import { fmtTL } from '../../utils/formatters';

export default function CustomersView({ customers, serviceDebts, drugDebts, onSelect, onAddCustomer }) {
  const [newCustomerName, setNewCustomerName] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const calculateTotalDebt = (customerId) => {
    const sDebt = serviceDebts.filter(d => d.customerId === customerId).reduce((sum, d) => sum + d.amount, 0);
    const dDebt = drugDebts.filter(d => d.customerId === customerId).reduce((sum, d) => sum + (d.qty * d.maxPrice), 0);
    return Math.max(0, sDebt + dDebt);
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
        {!isAdding ? (
          <button onClick={() => setIsAdding(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors"><UserPlus className="w-4 h-4" /> Yeni Müşteri Ekle</button>
        ) : (
          <form onSubmit={handleAddSubmit} className="flex gap-2 w-full sm:w-auto">
            <input type="text" placeholder="Ad Soyad (Hayvan Adı)" value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none w-full sm:w-64" autoFocus required />
            <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">Kaydet</button>
            <button type="button" onClick={() => setIsAdding(false)} className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-2 rounded-lg text-sm font-semibold transition-colors">İptal</button>
          </form>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {customers.map(c => {
          const totalDebt = calculateTotalDebt(c.id);
          const netBalance = c.balance - totalDebt;
          return (
            <div key={c.id} onClick={() => onSelect(c.id)} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 cursor-pointer hover:shadow-md hover:border-indigo-400 transition-all group relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <h3 className="text-lg font-semibold text-slate-800 group-hover:text-indigo-600 mb-4 pr-4">{c.name}</h3>
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
