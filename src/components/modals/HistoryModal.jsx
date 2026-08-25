import React, { useEffect, useMemo } from 'react';
import { History, Ban } from 'lucide-react';
import { fmtDate } from '../../utils/formatters';

// Ekstre yeniden eskiye sıralanır: küçük öncelik = üstte = olayın daha sonrasında olduğu anlamına gelir.
// Süpürücü her zaman kendisini tetikleyen tahsilattan SONRA gerçekleşir, bu yüzden onun üstündedir.
const getLogSortPriority = (title) => {
  if (title.includes('Enflasyon') || title.includes('Fiyat Güncellemesi')) return 0;
  if (title.includes('Süpürücü')) return 1;
  if (title.includes('Tahsilat')) return 2;
  if (title.includes('Borcu') || title.includes('Borç Açıldı')) return 4;
  return 3;
};

const sortLogsInternal = (arr) => [...arr].sort((a, b) => {
  // Tarihe göre sırala (yeni → eski)
  if (a.date !== b.date) return b.date.localeCompare(a.date);
  // Aynı tarih: timestamp'e göre (yeni → eski)
  const ta = a.timestamp ?? 0;
  const tb = b.timestamp ?? 0;
  if (ta !== tb) return tb - ta;
  // Aynı timestamp (batch): öncelik sırasına göre (enflasyon üstte, borç altta)
  return getLogSortPriority(a.title) - getLogSortPriority(b.title);
});

/**
 * @param {'debt'|'customer'|'batch'} [variant='debt'] — debt: tek borç ekstresi (varsayılan, mevcut davranış).
 *        customer: müşteri genel ekstre. batch: aynı işlemde açılmış borçların ekstresi.
 * @param {object} [debtInfo] — variant debt iken ilaç satırı bilgisi (drugName).
 * @param {string} [customerName] — variant customer iken müşteri adı.
 * @param {object} [batchInfo] — variant batch iken işlem bilgisi (date, itemCount, total).
 * @param {(batchId: string, date: string) => void} [onCancelBatch] — dokümanı kalmamış hatalı
 *        girişi iptal etmek için; yalnızca `log.cancellableBatchId` taşıyan gruplarda görünür.
 */
export default function HistoryModal({ variant = 'debt', debtInfo, customerName, batchInfo, logs, onCancelBatch, onClose }) {
  const isGrouped = variant === 'customer' || variant === 'batch';

  const sortedLogs = useMemo(() => isGrouped ? [] : sortLogsInternal(logs), [logs, isGrouped]);

  // Kümeleme: log.groupKey verilmişse ona göre (işlem bazlı), aksi halde debtId bazında
  const logGroups = useMemo(() => {
    if (!isGrouped) return null;
    const map = new Map();
    for (const log of logs) {
      const key = log.groupKey || log.debtId || '__unknown__';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(log);
    }
    const groups = [...map.entries()].map(([groupKey, group]) => {
      const sorted = sortLogsInternal(group);
      const oldestDate = group.reduce((min, l) => (l.date && l.date < min) ? l.date : min, group[0].date || '9999');
      const distinctSources = new Set(group.map((l) => l.sourceLabel).filter(Boolean));
      return {
        groupKey,
        label: group[0].groupLabel || group[0].sourceLabel || 'Bilinmeyen Borç',
        logs: sorted,
        oldestDate,
        cancelled: group.some((l) => l.cancelled),
        // Dokümanı kalmamış hatalı giriş: kartı olmadığı için iptal buradan yapılır
        cancellableBatchId: group.find((l) => l.cancellableBatchId)?.cancellableBatchId,
        batchDate: group.find((l) => l.batchDate)?.batchDate,
        // Bir işlemde birden fazla kalem varsa her log'un hangi ilaca ait olduğu belirtilir
        showSourceLabels: distinctSources.size > 1
      };
    });
    groups.sort((a, b) => b.oldestDate.localeCompare(a.oldestDate));
    return groups;
  }, [logs, isGrouped]);

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const getBadgeColor = (type) => {
    switch (type) {
      case 'info': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'success': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'warning': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'danger': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const title = variant === 'customer' ? 'Genel Ekstre' : variant === 'batch' ? 'İşlem Ekstresi' : 'Borç Ekstresi (Log)';
  const subtitle = variant === 'customer'
    ? (customerName ? `${customerName} — Tüm borç hareketleri` : 'Tüm borç hareketleri')
    : variant === 'batch'
      ? `${fmtDate(batchInfo?.date)} — ${batchInfo?.itemCount ?? 0} kalemlik işlem`
      : (debtInfo?.drugName || 'İlaç Borcu');

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>

        <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-indigo-50">
          <div>
            <h2 className="text-xl font-bold text-indigo-900 flex items-center gap-2"><History className="w-5 h-5" /> {title}</h2>
            <p className="text-sm text-indigo-700/80 mt-1 font-medium">{subtitle}</p>
          </div>
          <button type="button" onClick={onClose} className="text-indigo-400 hover:text-indigo-900 bg-indigo-200/50 hover:bg-indigo-200 p-2 rounded-full transition-colors">&#x2715;</button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50">
          {logs.length === 0 ? (
            <p className="text-center text-slate-400 py-8">Bu kayıt için henüz bir geçmiş bulunmuyor.</p>
          ) : isGrouped && logGroups ? (
            <div className="space-y-6">
              {logGroups.map((group) => (
                <div key={group.groupKey}>
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <span className={`text-xs font-bold uppercase tracking-wider ${group.cancelled ? 'text-slate-400 line-through' : 'text-indigo-600'}`}>{group.label}</span>
                    {group.cancelled && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider border bg-rose-100 text-rose-700 border-rose-200">
                        İptal Edildi
                      </span>
                    )}
                    <div className={`flex-1 h-px ${group.cancelled ? 'bg-slate-200' : 'bg-indigo-200/60'}`}></div>
                    {group.cancellableBatchId && onCancelBatch && (
                      <button
                        type="button"
                        onClick={() => onCancelBatch(group.cancellableBatchId, group.batchDate || group.oldestDate)}
                        className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 text-slate-500 hover:bg-rose-100 hover:text-rose-600 text-[10px] font-bold uppercase tracking-wider transition-colors flex-shrink-0"
                      >
                        <Ban className="w-3 h-3" /> İptal Et
                      </button>
                    )}
                  </div>
                  <div className="space-y-3 ml-2 pl-4 border-l-2 border-indigo-100">
                    {group.logs.map((log) => (
                      <div key={log.id} className={`p-3 rounded-xl border shadow-sm transition-shadow ${log.cancelled ? 'border-slate-200 bg-slate-100/70 opacity-70' : 'border-slate-200 bg-white hover:shadow-md'}`}>
                        <div className="flex items-center justify-between mb-1.5 gap-2">
                          <span className="flex items-center gap-1.5 min-w-0">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase tracking-wider border ${getBadgeColor(log.type)} ${log.cancelled ? 'line-through' : ''}`}>
                              {log.title}
                            </span>
                            {log.cancelled && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider border bg-rose-100 text-rose-700 border-rose-200 flex-shrink-0">
                                İptal
                              </span>
                            )}
                          </span>
                          <time className="text-xs text-slate-400 font-medium flex-shrink-0">{fmtDate(log.date)}</time>
                        </div>
                        {group.showSourceLabels && log.sourceLabel && (
                          <p className="text-[11px] font-semibold text-slate-400 mb-1">{log.sourceLabel}</p>
                        )}
                        <div className={`text-sm leading-relaxed font-medium ${log.cancelled ? 'text-slate-500' : 'text-slate-700'}`}>
                          {log.message}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">

              {sortedLogs.map((log) => (
                <div key={log.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 border-white shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm ${getBadgeColor(log.type).split(' ')[0]} ${getBadgeColor(log.type).split(' ')[1]} z-10`}>
                    <div className="w-2.5 h-2.5 rounded-full bg-current"></div>
                  </div>

                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase tracking-wider border ${getBadgeColor(log.type)}`}>
                        {log.title}
                      </span>
                      <time className="text-xs text-slate-400 font-medium">{fmtDate(log.date)}</time>
                    </div>
                    <div className="text-sm text-slate-700 leading-relaxed font-medium">
                      {log.message}
                    </div>
                  </div>
                </div>
              ))}

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
