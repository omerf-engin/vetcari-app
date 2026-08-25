import { useEffect } from 'react';
import { TrendingUp, TrendingDown, Undo, AlertTriangle } from 'lucide-react';
import { fmtTL, fmtQty } from '../../utils/formatters';

/**
 * Fiyat değişikliğinin açık borçlara etkisini onaydan **önce** gösterir.
 *
 * Üç mod:
 * - `increase` — etkilenecek müşteriler ve borçlarının ne kadar artacağı
 * - `decrease` — düşüşün açık borçlara yansımayacağı bilgisi (iş kuralı), eski fiyatta kalanlar
 * - `revert`   — son zammın geri alınmasında hangi borçların hangi tutara döneceği
 *
 * @param {object} impact — `computePriceImpact` çıktısı
 */
export default function PriceImpactModal({ mode, drugName, oldPrice, newPrice, impact, onConfirm, onClose }) {
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const isRevert = mode === 'revert';
  const isIncrease = mode === 'increase';

  const config = isRevert
    ? { icon: Undo, accent: 'text-emerald-600', border: 'border-t-emerald-500', btn: 'bg-emerald-600 hover:bg-emerald-700', title: 'Zammı Geri Al', cta: 'Geri Almayı Onayla' }
    : isIncrease
      ? { icon: TrendingUp, accent: 'text-rose-600', border: 'border-t-rose-500', btn: 'bg-rose-600 hover:bg-rose-700', title: 'Fiyat Artışı', cta: 'Zammı Uygula' }
      : { icon: TrendingDown, accent: 'text-indigo-600', border: 'border-t-indigo-500', btn: 'bg-indigo-600 hover:bg-indigo-700', title: 'Fiyat Düşüşü', cta: 'Fiyatı Güncelle' };

  const Icon = config.icon;
  const rows = isIncrease || isRevert ? impact.affected : impact.unchanged;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className={`bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[85vh] border-t-4 ${config.border}`} onClick={e => e.stopPropagation()}>

        <div className="p-6 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Icon className={`w-5 h-5 ${config.accent}`} /> {config.title}
            </h2>
            <p className="text-sm text-slate-500 mt-1 truncate">
              <strong className="text-slate-700">{drugName}</strong>
              {' · '}{fmtTL(oldPrice)} → {fmtTL(newPrice)}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 bg-slate-200/50 hover:bg-slate-200 p-2 rounded-full transition-colors flex-shrink-0">&#x2715;</button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {isIncrease && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm flex gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-amber-800">
                Bu zam <strong>{impact.customerCount} müşterinin</strong> {impact.debtCount} açık borcuna
                anında yansıyacak. Fiyatı sonradan düşürmek bu borçları geri indirmez.
              </p>
            </div>
          )}

          {mode === 'decrease' && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-sm text-indigo-800">
              Düşüşler açık borçlara <strong>yansımaz</strong>. Aşağıdaki {impact.unchanged.length} borç
              eski fiyatından kalmaya devam edecek; yalnızca bundan sonra açılacak borçlar yeni fiyattan
              hesaplanır.
            </div>
          )}

          {isRevert && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-800">
              İlacın fiyatı ve aşağıdaki {impact.affected.length} borç zam öncesi değerine dönecek.
              Her borç için ekstreye bir iptal kaydı düşecek.
            </div>
          )}

          {rows.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">Etkilenen açık borç yok.</p>
          ) : (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-bold uppercase tracking-wider text-xs">Müşteri</th>
                    <th className="px-4 py-2.5 text-right font-bold uppercase tracking-wider text-xs">Adet</th>
                    <th className="px-4 py-2.5 text-right font-bold uppercase tracking-wider text-xs">
                      {isIncrease || isRevert ? 'Borç' : 'Kalan Borç'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map(row => (
                    <tr key={row.debt.id}>
                      <td className="px-4 py-2.5 font-semibold text-slate-700 truncate max-w-[12rem]">{row.customerName}</td>
                      <td className="px-4 py-2.5 text-right text-slate-500">{fmtQty(row.debt.qty)}</td>
                      <td className="px-4 py-2.5 text-right">
                        {isIncrease || isRevert ? (
                          <span className="whitespace-nowrap">
                            <span className="text-slate-400">{fmtTL(isRevert ? row.newTl : row.oldTl)}</span>
                            <span className="text-slate-300"> → </span>
                            <strong className={isRevert ? 'text-emerald-700' : 'text-rose-600'}>
                              {fmtTL(isRevert ? row.oldTl : row.newTl)}
                            </strong>
                          </span>
                        ) : (
                          <strong className="text-slate-700">{fmtTL(row.currentTl)}</strong>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row justify-between items-center gap-4 rounded-b-2xl">
          <div className="text-center sm:text-left">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              {isRevert ? 'Geri Alınacak Tutar' : isIncrease ? 'Toplam Borç Artışı' : 'Etkilenen Borç'}
            </p>
            <p className={`font-bold text-2xl ${isRevert ? 'text-emerald-600' : isIncrease ? 'text-rose-600' : 'text-slate-700'}`}>
              {mode === 'decrease' ? `${impact.unchanged.length} kayıt` : fmtTL(impact.totalDelta)}
            </p>
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <button onClick={onClose} className="flex-1 sm:flex-none px-6 py-3 rounded-xl text-slate-600 font-bold hover:bg-slate-200 transition-colors">Vazgeç</button>
            <button
              onClick={() => { onConfirm(); onClose(); }}
              className={`flex-1 sm:flex-none px-8 py-3 rounded-xl ${config.btn} text-white font-bold shadow-md flex items-center justify-center gap-2`}
            >
              <Icon className="w-5 h-5" /> {config.cta}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
