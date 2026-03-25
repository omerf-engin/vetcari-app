import React from 'react';
import { CircleX, AlertTriangle, CheckCircle, Info, X } from 'lucide-react';

const TOAST_STYLES = {
  error:   { bg: 'bg-rose-50',    border: 'border-rose-300',    accent: 'border-l-rose-500',    icon: CircleX,       iconColor: 'text-rose-600',    text: 'text-rose-800' },
  warning: { bg: 'bg-amber-50',   border: 'border-amber-300',   accent: 'border-l-amber-500',   icon: AlertTriangle, iconColor: 'text-amber-600',   text: 'text-amber-800' },
  success: { bg: 'bg-emerald-50', border: 'border-emerald-300', accent: 'border-l-emerald-500', icon: CheckCircle,   iconColor: 'text-emerald-600', text: 'text-emerald-800' },
  info:    { bg: 'bg-indigo-50',  border: 'border-indigo-300',  accent: 'border-l-indigo-500',  icon: Info,          iconColor: 'text-indigo-600',  text: 'text-indigo-800' },
};

export default function Toast({ id, type, message, onRemove }) {
  const style = TOAST_STYLES[type] || TOAST_STYLES.info;
  const Icon = style.icon;

  return (
    <div className={`animate-toast-in flex items-start gap-3 px-4 py-3 rounded-xl border ${style.bg} ${style.border} border-l-4 ${style.accent} shadow-lg`}>
      <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${style.iconColor}`} />
      <p className={`flex-1 text-sm font-medium ${style.text}`}>{message}</p>
      <button onClick={() => onRemove(id)} className={`shrink-0 p-0.5 rounded hover:bg-white/60 transition-colors ${style.iconColor}`}>
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
