import React, { useMemo, useState } from 'react';
import { BarChart3, TrendingDown, TrendingUp, Minus, Wallet, AlertTriangle, CheckCircle2, CalendarRange } from 'lucide-react';
import { fmtTL } from '../../utils/formatters';
import { todayLocal } from '../../utils/dates';
import {
  PERIOD_PRESETS,
  resolvePeriod,
  validatePeriod,
  periodBlockedMessage,
  summarizePeriod
} from '../../utils/reporting';

const inputCls = 'w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none';
const labelCls = 'block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide';

export default function ReportsView({ transactions }) {
  const today = todayLocal();
  const [preset, setPreset] = useState('thisMonth');
  const initial = resolvePeriod('thisMonth', null, null, today);
  const [customStart, setCustomStart] = useState(initial.start);
  const [customEnd, setCustomEnd] = useState(initial.end);

  const period = useMemo(
    () => resolvePeriod(preset, customStart, customEnd, today),
    [preset, customStart, customEnd, today]
  );
  const validity = useMemo(() => validatePeriod(period), [period]);
  const summary = useMemo(
    () => (validity.ok ? summarizePeriod(transactions, period) : null),
    [transactions, period, validity.ok]
  );

  const isEmpty = summary && summary.movementCount === 0 && summary.unmeasured === 0;

  // Üç durum: sıfır değişim "azaldı" sayılmamalı — hareket olup net etkisi olmayan bir dönem
  // (ör. açılan borcun aynı dönemde iptal edilmesi) yanlış yönde okunurdu.
  const change = summary?.receivableChange ?? 0;
  const receivable = change > 0
    ? { tone: 'rose', sign: '+', icon: <TrendingUp className="w-6 h-6" />, note: 'Toplam alacak bu dönemde arttı' }
    : change < 0
      ? { tone: 'emerald', sign: '', icon: <TrendingDown className="w-6 h-6" />, note: 'Toplam alacak bu dönemde azaldı' }
      : { tone: 'slate', sign: '', icon: <Minus className="w-6 h-6" />, note: 'Toplam alacak bu dönemde değişmedi' };

  const RECEIVABLE_TONE = {
    rose: { border: 'border-l-rose-500', text: 'text-rose-600', badge: 'bg-rose-50 text-rose-600' },
    emerald: { border: 'border-l-emerald-500', text: 'text-emerald-600', badge: 'bg-emerald-50 text-emerald-600' },
    slate: { border: 'border-l-slate-400', text: 'text-slate-600', badge: 'bg-slate-100 text-slate-500' }
  }[receivable.tone];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <BarChart3 className="w-7 h-7 text-indigo-600" />
        <h2 className="text-2xl font-bold text-slate-800">Dönemsel Rapor</h2>
      </div>

      {/* Dönem Seçici */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <CalendarRange className="w-5 h-5 text-slate-500" />
          <h3 className="font-bold text-slate-800">Dönem</h3>
        </div>

        <div className="flex flex-wrap gap-2">
          {PERIOD_PRESETS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setPreset(id)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
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
              <label className={labelCls} htmlFor="report-start">Başlangıç Tarihi</label>
              <input
                id="report-start"
                type="date"
                value={customStart}
                max={today}
                onChange={(e) => setCustomStart(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="report-end">Bitiş Tarihi</label>
              <input
                id="report-end"
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
          <p className="mt-4 text-sm font-semibold text-rose-600">
            {periodBlockedMessage(validity.reason)}
          </p>
        )}
      </div>

      {summary && (
        <>
          {summary.unmeasured > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <p className="font-bold">Bu dönemin bir kısmı ölçülemiyor</p>
                <p className="mt-1">
                  {summary.unmeasured} kayıt tutar bilgisi tutulmadan yazılmış (dönemsel
                  raporlama öncesi). Bu kayıtlar aşağıdaki toplamlara <strong>dahil değil</strong>;
                  ekstrede görünmeye devam ediyorlar.
                </p>
              </div>
            </div>
          )}

          {isEmpty ? (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-10 text-center text-slate-400">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              <p className="font-medium">Bu dönemde para hareketi yok</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 border-l-4 border-l-emerald-500 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Dönem Tahsilatı</p>
                      <h3 className="text-3xl font-bold text-emerald-600 mt-2">{fmtTL(summary.collected)}</h3>
                    </div>
                    <div className="p-3 bg-emerald-50 rounded-lg text-emerald-600"><Wallet className="w-6 h-6" /></div>
                  </div>
                  <p className="text-xs text-slate-400 mt-4 font-medium">Müşterilerden alınan nakit</p>
                </div>

                <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 border-l-4 border-l-rose-500 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Açılan Borç</p>
                      <h3 className="text-3xl font-bold text-rose-600 mt-2">{fmtTL(summary.debtOpened)}</h3>
                    </div>
                    <div className="p-3 bg-rose-50 rounded-lg text-rose-600"><TrendingUp className="w-6 h-6" /></div>
                  </div>
                  <p className="text-xs text-slate-400 mt-4 font-medium">Dönemde girilen hizmet ve ilaç borcu</p>
                </div>

                <div className={`bg-white rounded-xl p-6 shadow-sm border border-slate-200 border-l-4 hover:shadow-md transition-shadow ${RECEIVABLE_TONE.border}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Alacak Değişimi</p>
                      <h3 className={`text-3xl font-bold mt-2 ${RECEIVABLE_TONE.text}`}>
                        {receivable.sign}{fmtTL(summary.receivableChange)}
                      </h3>
                    </div>
                    <div className={`p-3 rounded-lg ${RECEIVABLE_TONE.badge}`}>{receivable.icon}</div>
                  </div>
                  <p className="text-xs text-slate-400 mt-4 font-medium">{receivable.note}</p>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mt-8">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-slate-500" /> Hareket Dökümü
                </h3>
                <div className="space-y-3">
                  {[
                    { label: 'Enflasyon ile artan borç', value: summary.inflation, tone: 'text-rose-600' },
                    { label: 'Zam ile artan borç', value: summary.priceUp, tone: 'text-rose-600' },
                    { label: 'Süpürülen küsurat', value: summary.writeoff, tone: 'text-slate-700' },
                    { label: 'İade ile kapanan borç', value: summary.returned, tone: 'text-emerald-600' },
                    { label: 'İptal edilen borç kalemi', value: summary.cancelled, tone: 'text-slate-700' },
                    { label: 'Avansa yazılan', value: summary.advanceIn, tone: 'text-emerald-600' },
                    { label: 'Avanstan kullanılan', value: summary.advanceUsed, tone: 'text-slate-700' }
                  ].map(({ label, value, tone }) => (
                    <div key={label} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                      <span className="text-sm text-slate-600">{label}</span>
                      <span className={`font-bold ${value === 0 ? 'text-slate-300' : tone}`}>
                        {fmtTL(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
