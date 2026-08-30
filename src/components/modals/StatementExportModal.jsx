import { useState, useEffect, useMemo } from 'react';
import { Download, FileSpreadsheet, CalendarRange, AlertTriangle } from 'lucide-react';
import {
  PERIOD_PRESETS,
  resolvePeriod,
  validatePeriod,
  periodBlockedMessage
} from '../../utils/reporting';
import { buildCustomerStatement } from '../../utils/statementExport';
import { downloadTextFile } from '../../utils/download';
import { todayLocal } from '../../utils/dates';
import { useToast } from '../../hooks/useToast';

const inputCls = 'w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none';
const labelCls = 'block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide';

// `PERIOD_PRESETS`'e dokunulmuyor: Raporlar sekmesi ayni listeyi map'liyor ve orada
// "Tum Zamanlar" donemsel bir raporda anlamsiz olurdu. Bu secenek yalnizca disa aktarmaya ait.
const ALL_ID = 'all';
const EXPORT_PRESETS = [{ id: ALL_ID, label: 'Tüm İşlemler' }, ...PERIOD_PRESETS];

/**
 * Musteri ekstresini CSV olarak indirir.
 *
 * Girdi olarak CustomerDetail'in ekranda kullandigi **ayni** log dizisini alir
 * (`customerAggregateLogs`). Boylece dosya ile Genel Ekstre satir satir ayni kalir.
 *
 * @param {string} customerName
 * @param {Array<object>} logs — `sourceLabel` ile zenginlestirilmis musteri loglari
 * @param {number} advanceBalance — musterinin guncel avansi (TOPLAMLAR blogunda gorunur)
 */
export default function StatementExportModal({ customerName, logs, advanceBalance, onClose }) {
  const { toast } = useToast();
  const today = todayLocal();
  const [preset, setPreset] = useState(ALL_ID);
  const initial = resolvePeriod('thisMonth', null, null, today);
  const [customStart, setCustomStart] = useState(initial.start);
  const [customEnd, setCustomEnd] = useState(initial.end);

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const isAll = preset === ALL_ID;
  const period = useMemo(
    () => (isAll ? null : resolvePeriod(preset, customStart, customEnd, today)),
    [isAll, preset, customStart, customEnd, today]
  );
  const validity = useMemo(() => (isAll ? { ok: true } : validatePeriod(period)), [isAll, period]);

  const statement = useMemo(
    () => (validity.ok
      ? buildCustomerStatement({ customerName, logs, period, advanceBalance, today })
      : null),
    [validity.ok, customerName, logs, period, advanceBalance, today]
  );

  const handleDownload = () => {
    if (!statement) return;
    if (statement.movementCount === 0) {
      toast.warning('Bu aralıkta dışa aktarılacak hareket yok.');
      return;
    }
    downloadTextFile(statement.filename, statement.csv);
    toast.success(`${statement.movementCount} hareket indirildi.`);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh] border-t-4 border-t-indigo-500" onClick={e => e.stopPropagation()}>

        <div className="p-6 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Download className="w-5 h-5 text-indigo-600" /> Ekstreyi İndir
            </h2>
            <p className="text-sm text-slate-500 mt-1">{customerName}</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 bg-slate-200/50 hover:bg-slate-200 p-2 rounded-full transition-colors">&#x2715;</button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <CalendarRange className="w-4 h-4 text-slate-500" />
              <span className={labelCls.replace('block ', '') + ' mb-0'}>Dönem</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {EXPORT_PRESETS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPreset(id)}
                  className={`px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    preset === id
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {preset === 'custom' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className={labelCls} htmlFor="export-start">Başlangıç Tarihi</label>
                  <input
                    id="export-start"
                    type="date"
                    value={customStart}
                    max={today}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls} htmlFor="export-end">Bitiş Tarihi</label>
                  <input
                    id="export-end"
                    type="date"
                    value={customEnd}
                    max={today}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>
            )}

            {!validity.ok && (
              <p className="mt-3 text-sm font-semibold text-rose-600">
                {periodBlockedMessage(validity.reason)}
              </p>
            )}
          </div>

          {statement && (
            <>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm space-y-1.5">
                <p className="text-slate-700">
                  <strong>{statement.movementCount}</strong> hareket dışa aktarılacak.
                </p>
                <p className="text-slate-500 text-xs">
                  Dosya adı: <code className="text-slate-700">{statement.filename}</code>
                </p>
              </div>

              {statement.unmeasured > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm flex gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-amber-800">
                    {statement.unmeasured} kayıt tutar bilgisi tutulmadan yazılmış (dönemsel
                    raporlama öncesi). Dosyada <strong>Ölçülemiyor</strong> olarak görünecek ve
                    bakiyeye dahil edilmeyecek.
                  </p>
                </div>
              )}

              <p className="text-xs text-slate-400 leading-relaxed">
                Dosya noktalı virgülle ayrılmış, Excel'in Türkçe ayarıyla doğrudan açılır.
                Bakiye sütunu brüt borcu izler; avans ayrı bir hesapta tutulur.
              </p>
            </>
          )}
        </div>

        <div className="p-5 border-t border-slate-200 bg-slate-50 flex justify-end gap-3 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-3 rounded-xl text-slate-600 font-bold hover:bg-slate-200 transition-colors"
          >
            Vazgeç
          </button>
          <button
            type="button"
            disabled={!validity.ok}
            onClick={handleDownload}
            className="px-7 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <FileSpreadsheet className="w-5 h-5" /> CSV İndir
          </button>
        </div>
      </div>
    </div>
  );
}
