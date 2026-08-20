import React from 'react';
import { AlertTriangle, Trash2, ShieldAlert, X } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

const variantConfig = {
  danger: {
    icon: Trash2,
    iconBg: 'bg-red-50 border-red-200',
    iconColor: 'text-red-600',
    confirmBg: 'bg-red-600 hover:bg-red-700 shadow-red-600/20',
    accentBorder: 'border-red-200/60',
  },
  warning: {
    icon: ShieldAlert,
    iconBg: 'bg-amber-50 border-amber-200',
    iconColor: 'text-amber-600',
    confirmBg: 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20',
    accentBorder: 'border-amber-200/60',
  },
  info: {
    icon: AlertTriangle,
    iconBg: 'bg-indigo-50 border-indigo-200',
    iconColor: 'text-indigo-600',
    confirmBg: 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20',
    accentBorder: 'border-indigo-200/60',
  },
};

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
  loading = false,
}) => {
  if (!open) return null;

  const config = variantConfig[variant];
  const IconComponent = config.icon;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget && !loading) onCancel(); }}
    >
      <div
        className={`w-full max-w-md bg-white border ${config.accentBorder} rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200`}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex items-start gap-4">
          <div className={`p-3 rounded-xl border ${config.iconBg} shrink-0`}>
            <IconComponent size={20} className={config.iconColor} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-extrabold text-slate-900 leading-tight">{title}</h3>
            <p className="text-sm text-slate-500 font-medium mt-1.5 leading-relaxed">{message}</p>
          </div>
          <button
            onClick={onCancel}
            disabled={loading}
            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-all shrink-0 disabled:opacity-50"
          >
            <X size={14} />
          </button>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-all active:scale-95 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-5 py-2.5 rounded-xl ${config.confirmBg} text-white text-xs font-extrabold shadow-lg transition-all active:scale-95 disabled:opacity-60 flex items-center gap-2`}
          >
            {loading && (
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default React.memo(ConfirmDialog);
