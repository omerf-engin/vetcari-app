import { useState, useEffect } from 'react';
import { Ban, AlertTriangle } from 'lucide-react';
import { fmtTL, fmtQty, fmtDate } from '../../utils/formatters';

/**
 * Yanlış girilen bir işlemin tamamını gerekçeyle iptal eder.
 *
 * Gerekçe zorunludur: bir yıl sonra ekstreye bakan kişi kaydın neden iptal edildiğini
 * görebilmeli. `ToastContext`'teki `confirm(title, message)` metin girişi desteklemediği için
 * paylaşılan onay modalı yerine ayrı bir bileşen kullanılıyor.
 *
 * @param {object} group — `groupDebtsByBatch` çıktısındaki grup
 * @param {(reason: string) => void} onConfirm
 */
export default function CancelBatchModal({ group, onConfirm, onClose }) {
  const [reason, setReason] = useState('');

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const canSubmit = reason.trim().length > 0;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh] border-t-4 border-t-rose-500" onClick={e => e.stopPropagation()}>

        <div className="p-6 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Ban className="w-5 h-5 text-rose-600" /> İşlemi İptal Et
            </h2>
            <p className="text-sm text-slate-500 mt-1">{fmtDate(group.date)} · {group.itemCount} kalemlik işlem</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 bg-slate-200/50 hover:bg-slate-200 p-2 rounded-full transition-colors">&#x2715;</button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm flex gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-amber-800">
              Bu işlemin borç kayıtları silinecek. Ekstre satırları <strong>silinmez</strong>,
              gerekçesiyle birlikte <strong>iptal edilmiş</strong> olarak işaretlenir.
            </p>
          </div>

          <div>
            <p className="text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">İptal Edilecek Kalemler</p>
            {group.items.length === 0 && (
              // Kısmi tahsilat sonrası kalan 10 TL altına düştüyse süpürücü borcu hiç yazmaz;
              // geriye yalnızca ekstre satırları kalır
              <p className="text-sm text-slate-500 border border-slate-200 rounded-lg px-3 py-3 bg-slate-50">
                Bu işlemin açık borç kaydı kalmamış. Yalnızca ekstre satırları
                <strong> iptal edilmiş</strong> olarak işaretlenecek.
              </p>
            )}
            <ul className="border border-slate-200 rounded-lg divide-y divide-slate-100 empty:hidden">
              {group.items.map(item => (
                <li key={item.id} className="px-3 py-2.5 flex justify-between items-center gap-3 text-sm">
                  <span className="min-w-0 flex items-center gap-2">
                    {item.type === 'service' ? (
                      <>
                        <span className="bg-slate-200 text-slate-600 text-[10px] px-2 py-0.5 rounded-full font-bold tracking-wide flex-shrink-0">HİZMET</span>
                        <span className="font-semibold text-slate-700 truncate">{item.desc}</span>
                      </>
                    ) : (
                      <>
                        <span className="font-semibold text-slate-700 truncate">{item.drugName}</span>
                        <span className="text-xs text-slate-400 flex-shrink-0">{fmtQty(item.qty)} adet</span>
                      </>
                    )}
                  </span>
                  <span className="font-bold text-slate-700 flex-shrink-0">
                    {fmtTL(item.type === 'service' ? item.amount : (item.tlValue ?? item.qty * item.maxPrice))}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <label htmlFor="cancel-reason" className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">
              İptal Gerekçesi (zorunlu)
            </label>
            <textarea
              id="cancel-reason"
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
              placeholder="Örn: Yanlış müşteriye girildi"
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-rose-500 focus:outline-none resize-none"
            />
          </div>
        </div>

        <div className="p-5 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row justify-between items-center gap-4 rounded-b-2xl">
          {/* Süpürülmüş işlemde silinecek borç yok; "0 ₺" göstermek yanıltıcı olurdu */}
          <div className="text-center sm:text-left">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              {group.items.length === 0 ? 'Borç Kaydı' : 'Silinecek Borç'}
            </p>
            <p className={`font-bold text-2xl ${group.items.length === 0 ? 'text-slate-400' : 'text-rose-600'}`}>
              {group.items.length === 0 ? 'Yok' : fmtTL(group.total)}
            </p>
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <button onClick={onClose} className="flex-1 sm:flex-none px-6 py-3 rounded-xl text-slate-600 font-bold hover:bg-slate-200 transition-colors">Vazgeç</button>
            <button
              disabled={!canSubmit}
              onClick={() => { onConfirm(reason.trim()); onClose(); }}
              className="flex-1 sm:flex-none px-8 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Ban className="w-5 h-5" /> İptali Onayla
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
