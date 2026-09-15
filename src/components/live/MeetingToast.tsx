/**
 * MeetingToast — Custom Meeting Notifications
 * ─────────────────────────────────────────────
 * Trileza-themed toast stack for meeting events.
 * Auto-dismisses after 4 seconds.
 */
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Info, CheckCircle, AlertTriangle } from 'lucide-react';
import { useMeetingStore } from '../../store/meetingStore';

const MeetingToast: React.FC = () => {
  const { toasts, removeToast } = useMeetingStore();

  // Informational notices carry the brand green rather than blue, matching the
  // app's Toast. Amber is kept for warnings — the session countdown uses it,
  // and it must be distinguishable at a glance rather than on-brand.
  const icons = {
    info: <Info size={16} className="text-brand-accent" />,
    success: <CheckCircle size={16} className="text-brand-accent" />,
    warning: <AlertTriangle size={16} className="text-amber-400" />,
  };

  const borders = {
    info: 'border-brand-primary/40',
    success: 'border-brand-secondary/40',
    warning: 'border-amber-500/40',
  };

  return (
    <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 400 }}
            className={`pointer-events-auto flex items-center gap-3 px-5 py-3 rounded-2xl bg-slate-900/90 backdrop-blur-xl border ${borders[toast.type]} shadow-2xl max-w-sm`}
          >
            <div className="shrink-0">{icons[toast.type]}</div>
            <p className="text-xs font-bold text-white leading-tight flex-1">{toast.message}</p>
            <button
              onClick={() => removeToast(toast.id)}
              className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-all shrink-0"
            >
              <X size={12} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default MeetingToast;
