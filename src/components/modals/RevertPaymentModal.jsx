import { useState, useEffect } from 'react';
import { Undo2, AlertTriangle } from 'lucide-react';
import { fmtTL, fmtQty } from '../../utils/formatters';

/**
 * Son tahsilatı bütünüyle geri alır.
 *
 * Para hareketi geri alındığı için gerekçe zorunludur (TASK-031'deki işlem iptaliyle aynı
 * kural): bir yıl sonra ekstreye bakan kişi neden geri alındığını görebilmeli.
 *
 * @param {object} batch — `latestPaymentBatch` çıktısı (`debtLogs`, `balanceDelta`, `totalDeducted`)
 * @param {(reason: string) => void} onConfirm
 */
export default function RevertPaymentModal({ batch, onConfirm, onClose }) {
  const [reason, setReason] = useState('');

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const canSubmit = reason.trim().length > 0;
  const received = Math.round((batch.totalDeducted + batch.balanceDelta) * 100) / 100;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh] border-t-4 border-t-amber-500" onClick={e => e.stopPropagation()}>

        <div className="p-6 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Undo2 className="w-5 h-5 text-amber-600" /> Tahsilatı Geri Al
            </h2>
            <p className="text-sm text-slate-500 mt-1">Toplam {fmtTL(received)} tahsilat</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 bg-slate-200/50 hover:bg-slate-200 p-2 rounded-full transition-colors">&#x2715;</button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm flex gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-amber-800">
              Borçlar tahsilat öncesi haline dönecek, kapanmış borçlar yeniden açılacak.
              Ekstre satırları <strong>silinmez</strong>; gerekçesiyle birlikte iptal kaydı düşer.
            </p>
          </div>

          {batch.debtLogs.length > 0 && (
            <div>
              <p className="text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Geri Yüklenecek Borçlar</p>
              <ul className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                {batch.debtLogs.map(log => {
                  const isService = log.before?.desc !== undefined;
                  const restored = isService
                    ? fmtTL(log.before.amount)
                    : `${fmtQty(log.before.qty)} adet · ${fmtTL(Math.round(log.before.qty * log.before.maxPrice * 100) / 100)}`;
                  return (
                    <li key={log.id} className="px-3 py-2.5 flex justify-between items-center gap-3 text-sm">
                      <span className="flex items-center gap-2 min-w-0">
                        {isService && (
                          <span className="bg-slate-200 text-slate-600 text-[10px] px-2 py-0.5 rounded-full font-bold tracking-wide flex-shrink-0">HİZMET</span>
                        )}
                        <span className="font-semibold text-slate-700 truncate">
                          {isService ? log.before.desc : `${fmtTL(log.deduct)} tahsilat`}
                        </span>
                      </span>
                      <span className="text-slate-500 flex-shrink-0">→ {restored}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {batch.balanceDelta !== 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-600">
              {batch.balanceDelta > 0
                ? <>Avansa yazılan <strong>{fmtTL(batch.balanceDelta)}</strong> geri alınacak.</>
                : <>Kullanılan <strong>{fmtTL(Math.abs(batch.balanceDelta))}</strong> avans iade edilecek.</>}
            </div>
          )}

          <div>
            <label htmlFor="revert-payment-reason" className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">
              Geri Alma Gerekçesi (zorunlu)
            </label>
            <textarea
              id="revert-payment-reason"
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
              placeholder="Örn: Yanlış müşteriye tahsilat girildi"
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none resize-none"
            />
          </div>
        </div>

        <div className="p-5 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row justify-between items-center gap-4 rounded-b-2xl">
          <div className="text-center sm:text-left">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Geri Alınacak Tutar</p>
            <p className="font-bold text-amber-600 text-2xl">{fmtTL(received)}</p>
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <button onClick={onClose} className="flex-1 sm:flex-none px-6 py-3 rounded-xl text-slate-600 font-bold hover:bg-slate-200 transition-colors">Vazgeç</button>
            <button
              disabled={!canSubmit}
              onClick={() => { onConfirm(reason.trim()); onClose(); }}
              className="flex-1 sm:flex-none px-8 py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Undo2 className="w-5 h-5" /> Geri Almayı Onayla
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
