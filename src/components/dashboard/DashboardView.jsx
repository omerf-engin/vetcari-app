import React, { useMemo } from 'react';
import { LayoutDashboard, Wallet, CreditCard, Users, ReceiptText, TrendingUp, Pill } from 'lucide-react';
import { fmtTL } from '../../utils/formatters';

export default function DashboardView({ customers, serviceDebts, drugDebts, drugs, onNavigate }) {
  // İstatistikleri Hesapla (Optimize Edilmiş Memoization)
  const { netReceivables, totalAdvances, customerDebts } = useMemo(() => {
    const tServiceDebt = serviceDebts.reduce((sum, d) => sum + d.amount, 0);
    const tDrugDebt = drugDebts.reduce((sum, d) => sum + (d.qty * d.maxPrice), 0);
    const grossReceivables = tServiceDebt + tDrugDebt; // Brüt Alacak

    const tAdvances = customers.reduce((sum, c) => sum + c.balance, 0); // Müşterilerdeki toplam avans
    const nReceivables = Math.max(0, grossReceivables - tAdvances); // Net Alacak

    // En borçlu 5 müşteriyi bul
    const cDebts = customers.map(c => {
      const cService = serviceDebts.filter(d => d.customerId === c.id).reduce((sum, d) => sum + d.amount, 0);
      const cDrug = drugDebts.filter(d => d.customerId === c.id).reduce((sum, d) => sum + (d.qty * d.maxPrice), 0);
      const net = Math.max(0, (cService + cDrug) - c.balance);
      return { ...c, netDebt: net };
    }).filter(c => c.netDebt > 0).sort((a, b) => b.netDebt - a.netDebt).slice(0, 5);

    return { netReceivables: nReceivables, totalAdvances: tAdvances, customerDebts: cDebts };
  }, [customers, serviceDebts, drugDebts]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <LayoutDashboard className="w-7 h-7 text-indigo-600" />
        <h2 className="text-2xl font-bold text-slate-800">Sistem Özeti</h2>
      </div>

      {/* Üst İstatistik Kartları */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 border-l-4 border-l-rose-500 hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Toplam Net Alacak</p>
              <h3 className="text-3xl font-bold text-rose-600 mt-2">{fmtTL(netReceivables)}</h3>
            </div>
            <div className="p-3 bg-rose-50 rounded-lg text-rose-600"><Wallet className="w-6 h-6" /></div>
          </div>
          <p className="text-xs text-slate-400 mt-4 font-medium">İlaç ve Hizmet borçlarının toplamı</p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 border-l-4 border-l-emerald-500 hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide">İçerideki Avans</p>
              <h3 className="text-3xl font-bold text-emerald-600 mt-2">{fmtTL(totalAdvances)}</h3>
            </div>
            <div className="p-3 bg-emerald-50 rounded-lg text-emerald-600"><CreditCard className="w-6 h-6" /></div>
          </div>
          <p className="text-xs text-slate-400 mt-4 font-medium">Müşterilerin fazladan bıraktığı bakiyeler</p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 border-l-4 border-l-indigo-500 hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Kayıtlı Müşteri</p>
              <h3 className="text-3xl font-bold text-indigo-600 mt-2">{customers.length} <span className="text-lg text-slate-500 font-medium">Kişi</span></h3>
            </div>
            <div className="p-3 bg-indigo-50 rounded-lg text-indigo-600"><Users className="w-6 h-6" /></div>
          </div>
          <button onClick={() => onNavigate('customers')} className="text-xs text-indigo-600 mt-4 font-bold hover:underline flex items-center gap-1">Müşterilere Git &rarr;</button>
        </div>
      </div>

      {/* Alt Bölüm: En Borçlular ve Hızlı İşlemler */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
            <ReceiptText className="w-5 h-5 text-slate-500" />
            <h3 className="font-bold text-slate-800">En Yüksek Borcu Olanlar</h3>
          </div>
          <div className="p-0">
            {customerDebts.length === 0 ? (
              <p className="p-6 text-center text-slate-500 italic text-sm">Sistemde borçlu müşteri bulunmuyor.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {customerDebts.map((c, i) => (
                  <li key={c.id} className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-xs font-bold">{i + 1}</span>
                      <span className="font-semibold text-slate-700">{c.name}</span>
                    </div>
                    <span className="font-bold text-rose-600">{fmtTL(c.netDebt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="bg-indigo-600 rounded-xl shadow-sm border border-indigo-700 p-6 text-white flex flex-col justify-center items-center text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-8 -mt-8 opacity-10"><TrendingUp className="w-48 h-48" /></div>
          <h3 className="text-2xl font-bold mb-2 relative z-10">İlaç Fiyatlarını Güncel Tutun</h3>
          <p className="text-indigo-200 mb-6 max-w-sm relative z-10">Enflasyona karşı kârınızı korumak için yeni mal alımlarında ilaç satış fiyatlarını sisteme girmeyi unutmayın.</p>
          <button
            onClick={() => onNavigate('drugs')}
            className="bg-white text-indigo-700 px-6 py-3 rounded-xl font-bold hover:bg-indigo-50 transition-colors shadow-lg flex items-center gap-2 relative z-10"
          >
            <Pill className="w-5 h-5" /> Fiyat Listesine Git
          </button>
        </div>

      </div>
    </div>
  );
}
