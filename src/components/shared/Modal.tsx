import React, { useEffect, useRef, useCallback } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  /** Hides the visual title but keeps it for screen readers. */
  hideTitle?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Footer actions. Primary last, so it lands bottom-right. */
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

const SIZES = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl'
};

/**
 * The standard dialog.
 *
 * The app has ~26 hand-rolled modals and none of them carried dialog
 * semantics: no `role="dialog"`, no `aria-modal`, no focus trap, no Escape
 * handler, and no accessible name. To a screen reader they were an
 * indistinguishable pile of divs, and to a keyboard user focus stayed loose in
 * the page behind them.
 *
 * This provides all of that once. New dialogs should use it rather than
 * repeating a fixed-inset div.
 */
export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  description,
  hideTitle,
  size = 'md',
  actions,
  children,
  className
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useRef(`modal-title-${Math.random().toString(36).slice(2, 9)}`).current;
  const descId = useRef(`modal-desc-${Math.random().toString(36).slice(2, 9)}`).current;

  const focusables = useCallback(() => {
    if (!panelRef.current) return [] as HTMLElement[];
    return Array.from(
      panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    ).filter(el => el.offsetParent !== null);
  }, []);

  // Remember what was focused, move focus in, and restore it on close — losing
  // your place in the page after dismissing a dialog is disorienting for
  // keyboard and screen-reader users alike.
  useEffect(() => {
    if (!open) return;

    returnFocusRef.current = document.activeElement as HTMLElement;
    const first = focusables()[0] || panelRef.current;
    first?.focus({ preventScroll: true });

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
      returnFocusRef.current?.focus?.({ preventScroll: true });
    };
  }, [open, focusables]);

  // Escape closes; Tab cycles within the panel rather than escaping behind it.
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;

      const items = focusables();
      if (items.length === 0) return;

      const first = items[0];
      const last = items[items.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [open, onClose, focusables]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn(
          'w-full bg-surface dark:bg-slate-900 border border-slate-200 dark:border-slate-800',
          'rounded-[var(--radius-panel)] shadow-[var(--shadow-prominent)]',
          'max-h-[88vh] flex flex-col outline-none',
          SIZES[size],
          className
        )}
      >
        <header className="flex items-start justify-between gap-4 px-6 sm:px-7 pt-6 pb-5 border-b border-slate-200 dark:border-slate-800">
          <div className="min-w-0">
            <h2
              id={titleId}
              className={cn(
                'text-lg font-black tracking-tight text-slate-900 dark:text-white text-balance',
                hideTitle && 'sr-only'
              )}
            >
              {title}
            </h2>
            {description && (
              <p id={descId} className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                {description}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="p-2 -mr-2 -mt-1 rounded-[var(--radius-control)] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 accent-ring cursor-pointer"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="px-6 sm:px-7 py-6 overflow-y-auto flex-1">
          {children}
        </div>

        {actions && (
          <footer className="px-6 sm:px-7 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 flex flex-wrap items-center justify-end gap-3">
            {actions}
          </footer>
        )}
      </div>
    </div>
  );
};

export default Modal;
