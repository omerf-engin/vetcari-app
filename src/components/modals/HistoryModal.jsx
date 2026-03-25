import React from 'react';
import { History } from 'lucide-react';

export default function HistoryModal({ debtInfo, logs, onClose }) {

  const getBadgeColor = (type) => {
    switch (type) {
      case 'info': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'success': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'warning': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'danger': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">

        <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-indigo-50">
          <div>
            <h2 className="text-xl font-bold text-indigo-900 flex items-center gap-2"><History className="w-5 h-5" /> Borç Ekstresi (Log)</h2>
            <p className="text-sm text-indigo-700/80 mt-1 font-medium">{debtInfo?.drugName || 'İlaç Borcu'}</p>
          </div>
          <button onClick={onClose} className="text-indigo-400 hover:text-indigo-900 bg-indigo-200/50 hover:bg-indigo-200 p-2 rounded-full transition-colors">✕</button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50">
          {logs.length === 0 ? (
            <p className="text-center text-slate-400 py-8">Bu kayıt için henüz bir geçmiş bulunmuyor.</p>
          ) : (
            <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">

              {logs.map((log) => (
                <div key={log.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 border-white shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm ${getBadgeColor(log.type).split(' ')[0]} ${getBadgeColor(log.type).split(' ')[1]} z-10`}>
                    <div className="w-2.5 h-2.5 rounded-full bg-current"></div>
                  </div>

                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase tracking-wider border ${getBadgeColor(log.type)}`}>
                        {log.title}
                      </span>
                      <time className="text-xs text-slate-400 font-medium">{log.date}</time>
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
