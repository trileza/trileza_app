import React, { useEffect } from 'react';
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '../../utils';

/**
 * The app's notification toast.
 *
 * Every variant sits on the same dark surface and is distinguished by its
 * accent, so a notification always reads as part of Trileza rather than as a
 * browser alert. Info used to be `bg-blue-900`, which put a large blue panel in
 * the middle of a green app; it now carries the brand green, and only the
 * genuinely exceptional states — error and warning — break to red and amber,
 * because those need to be distinguishable at a glance rather than on-brand.
 *
 * `brand-mint` was referenced here but never defined in index.css, so the
 * success accent generated no colour at all. It now uses the real tokens.
 */

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info' | 'warning';
  onClose: () => void;
}

const VARIANTS = {
  success: {
    surface: 'bg-slate-900 border-brand-secondary/40',
    accent: 'bg-brand-secondary/20 text-brand-accent',
    Icon: CheckCircle
  },
  info: {
    surface: 'bg-slate-900 border-brand-primary/40',
    accent: 'bg-brand-primary/25 text-brand-accent',
    Icon: Info
  },
  warning: {
    surface: 'bg-slate-900 border-amber-500/40',
    accent: 'bg-amber-500/20 text-amber-300',
    Icon: AlertTriangle
  },
  error: {
    surface: 'bg-slate-900 border-red-500/40',
    accent: 'bg-red-500/20 text-red-300',
    Icon: AlertCircle
  }
} as const;

export const Toast = ({ message, type = 'success', onClose }: ToastProps) => {
  // Errors and warnings stay long enough to read and act on; the rest clear
  // quickly so they do not sit over the page.
  const dwell = type === 'error' || type === 'warning' ? 6000 : 3500;

  useEffect(() => {
    const timer = setTimeout(onClose, dwell);
    return () => clearTimeout(timer);
  }, [onClose, dwell]);

  const { surface, accent, Icon } = VARIANTS[type] ?? VARIANTS.info;

  return (
    <div
      role="status"
      aria-live={type === 'error' ? 'assertive' : 'polite'}
      className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] px-4 w-full max-w-[min(420px,calc(100vw-2rem))] animate-in slide-in-from-top duration-500"
    >
      <div
        className={cn(
          'px-5 py-4 rounded-2xl shadow-2xl backdrop-blur-xl flex items-center gap-4 text-white border',
          surface
        )}
      >
        <div className={cn('w-10 h-10 rounded-full flex items-center justify-center shrink-0', accent)}>
          <Icon size={22} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm leading-snug">{message}</p>
          <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest font-semibold">
            Trileza
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Dismiss notification"
          className="p-1 hover:bg-white/10 rounded-full text-slate-500 hover:text-white transition-colors shrink-0"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};
