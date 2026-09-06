import React, { useMemo } from 'react';
import { LayoutDashboard, Wallet, CreditCard, Users, ReceiptText, CheckCircle2 } from 'lucide-react';
import { fmtTL } from '../../utils/formatters';

export default function DashboardView({ customers, serviceDebts, drugDebts, onNavigate, onSelectCustomer }) {
  // İstatistikleri Hesapla (Optimize Edilmiş Memoization)
  const { netReceivables, totalAdvances, customerDebts, activeServiceCount, activeDrugCount, advanceCustomerCount } = useMemo(() => {
    const tServiceDebt = serviceDebts.reduce((sum, d) => sum + d.amount, 0);
    const tDrugDebt = drugDebts.reduce((sum, d) => sum + (d.qty * d.maxPrice), 0);
    const grossReceivables = tServiceDebt + tDrugDebt; // Brüt Alacak

    const tAdvances = customers.reduce((sum, c) => sum + c.balance, 0); // Müşterilerdeki toplam avans
    const nReceivables = Math.max(0, grossReceivables - tAdvances); // Net Alacak

    // Borçları müşteri bazında indexle (O(n+m) yerine O(n*m))
    const serviceByCustomer = new Map();
    serviceDebts.forEach(d => {
      serviceByCustomer.set(d.customerId, (serviceByCustomer.get(d.customerId) || 0) + d.amount);
    });

    const drugByCustomer = new Map();
    drugDebts.forEach(d => {
      drugByCustomer.set(d.customerId, (drugByCustomer.get(d.customerId) || 0) + (d.qty * d.maxPrice));
    });

    // En borçlu 5 müşteriyi bul
    const cDebts = customers.map(c => {
      const cService = serviceByCustomer.get(c.id) || 0;
      const cDrug = drugByCustomer.get(c.id) || 0;
      const net = Math.max(0, (cService + cDrug) - c.balance);
      return { ...c, netDebt: net };
    }).filter(c => c.netDebt > 0).sort((a, b) => b.netDebt - a.netDebt).slice(0, 5);

    const activeServiceCount = serviceDebts.length;
    const activeDrugCount = drugDebts.length;
    const advanceCustomerCount = customers.filter(c => c.balance > 0).length;

    return { netReceivables: nReceivables, totalAdvances: tAdvances, customerDebts: cDebts, activeServiceCount, activeDrugCount, advanceCustomerCount };
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
          <p className="text-xs text-slate-500 mt-4 font-medium">İlaç ve Hizmet borçlarının toplamı</p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 border-l-4 border-l-emerald-500 hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide">İçerideki Avans</p>
              <h3 className="text-3xl font-bold text-emerald-600 mt-2">{fmtTL(totalAdvances)}</h3>
            </div>
            <div className="p-3 bg-emerald-50 rounded-lg text-emerald-600"><CreditCard className="w-6 h-6" /></div>
          </div>
          <p className="text-xs text-slate-500 mt-4 font-medium">Müşterilerin fazladan bıraktığı bakiyeler</p>
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
              <div className="p-8 text-center text-slate-500">
                <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-300" />
                <p className="font-medium">Tüm müşteriler borçsuz</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {customerDebts.map((c, i) => (
                  <li key={c.id} className="p-4 flex justify-between items-center hover:bg-indigo-50 transition-colors cursor-pointer" onClick={() => onSelectCustomer(c.id)}>
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

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <ReceiptText className="w-5 h-5 text-slate-500" /> Borç Özeti
          </h3>
          <div className="space-y-3">
            {[
              { label: 'Aktif Hizmet Borcu', value: activeServiceCount, unit: 'kayıt' },
              { label: 'Aktif İlaç Borcu', value: activeDrugCount, unit: 'kayıt' },
              { label: 'Borçlu Müşteri', value: customerDebts.length, unit: 'kişi', link: 'customers' },
              { label: 'Avansı Olan Müşteri', value: advanceCustomerCount, unit: 'kişi' },
            ].map(({ label, value, unit, link }) => (
              <div key={label} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                <span className="text-sm text-slate-600">{label}</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-800">{value} <span className="text-xs text-slate-500 font-normal">{unit}</span></span>
                  {link && <button onClick={() => onNavigate(link)} className="text-xs text-indigo-600 hover:underline">Görüntüle</button>}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
