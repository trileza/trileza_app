import React, { useEffect } from 'react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';
import { cn } from '../../utils';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  onClose: () => void;
}

export const Toast = ({ message, type = 'success', onClose }: ToastProps) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[9999] animate-in slide-in-from-top duration-500">
      <div className={cn(
        "px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 text-white min-w-[320px]",
        type === 'success' ? "bg-slate-900 border border-brand-mint/30" :
        type === 'error' ? "bg-red-900 border border-red-500/30" :
        "bg-blue-900 border border-blue-500/30"
      )}>
        <div className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
          type === 'success' ? "bg-brand-mint/20 text-brand-mint" :
          type === 'error' ? "bg-red-500/20 text-red-400" :
          "bg-blue-500/20 text-blue-400"
        )}>
          {type === 'success' && <CheckCircle size={24} />}
          {type === 'error' && <AlertCircle size={24} />}
          {type === 'info' && <Info size={24} />}
        </div>
        <div className="flex-1">
          <p className="font-bold text-sm leading-tight">{message}</p>
          <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest font-semibold">Trileza System Notification</p>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full text-slate-400 transition-colors">
          <X size={16} />
        </button>
      </div>
    </div>
  );
};
