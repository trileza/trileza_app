import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../utils';

export interface FormStep {
  label: string;
  /** Optional short hint shown under the label on the active step. */
  hint?: string;
}

interface FormShellProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  /** Small label above the title, e.g. "Section 2" or "Mentor application". */
  eyebrow?: string;
  /** Renders a progress indicator. Omit for single-step forms. */
  steps?: FormStep[];
  /** 1-based index of the active step. */
  currentStep?: number;
  /** Footer actions. Submit belongs last so it lands bottom-right. */
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * The standard wrapper for a form.
 *
 * Two rules it exists to enforce, both of which were being broken across the
 * app:
 *
 *   1. The header comes first. Content cannot render above it, because the
 *      header is a sibling this component owns rather than something each page
 *      remembers to place.
 *
 *   2. Every form gets a title and a description. Forms were appearing as bare
 *      field stacks, which read as unfinished and gave no context for what was
 *      being asked or why.
 *
 * Actions sit in a footer with submit last, so the primary action is
 * consistently bottom-right on every form in the product.
 */
export const FormShell: React.FC<FormShellProps> = ({
  title,
  description,
  icon: Icon,
  eyebrow,
  steps,
  currentStep = 1,
  actions,
  children,
  className
}) => {
  const hasSteps = Boolean(steps && steps.length > 1);

  return (
    <section
      className={cn(
        'w-full bg-surface dark:bg-slate-900 border border-slate-200 dark:border-slate-800',
        'rounded-[var(--radius-panel)] shadow-[var(--shadow-medium)] overflow-hidden',
        className
      )}
      aria-labelledby="form-shell-title"
    >
      {/* ── Header. Always first. ── */}
      <header className="px-6 sm:px-8 pt-7 pb-6 border-b border-slate-200 dark:border-slate-800 bg-brand-light/40 dark:bg-slate-950/40">
        <div className="flex items-start gap-4">
          {Icon && (
            <span className="w-11 h-11 rounded-[var(--radius-control)] bg-surface dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-brand-primary shrink-0 shadow-[var(--shadow-subtle)]">
              <Icon size={20} aria-hidden="true" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            {eyebrow && (
              <p className="text-[10px] font-black uppercase tracking-[0.18em] accent-text mb-1">
                {eyebrow}
              </p>
            )}
            <h2
              id="form-shell-title"
              className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white text-balance"
            >
              {title}
            </h2>
            {description && (
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed max-w-2xl">
                {description}
              </p>
            )}
          </div>
        </div>

        {/* ── Progress. Below the header text, never above it. ── */}
        {hasSteps && (
          <ol className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-6" aria-label="Progress">
            {steps!.map((step, i) => {
              const n = i + 1;
              const done = n < currentStep;
              const active = n === currentStep;
              return (
                <li key={step.label} className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className={cn(
                        'w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 transition-colors',
                        done && 'bg-brand-primary text-white',
                        active && 'accent-bg text-white',
                        !done && !active && 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                      )}
                    >
                      {done ? '✓' : n}
                    </span>
                    <span
                      className={cn(
                        'text-xs font-bold',
                        active ? 'text-slate-900 dark:text-white' : 'text-slate-400'
                      )}
                      aria-current={active ? 'step' : undefined}
                    >
                      {step.label}
                    </span>
                  </div>
                  {n < steps!.length && (
                    <span aria-hidden="true" className="w-6 h-px bg-slate-200 dark:bg-slate-800" />
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </header>

      {/* ── Fields ── */}
      <div className="px-6 sm:px-8 py-7 flex flex-col gap-6">
        {children}
      </div>

      {/* ── Actions. Submit last so it sits bottom-right. ── */}
      {actions && (
        <footer className="px-6 sm:px-8 py-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 flex flex-wrap items-center justify-end gap-3">
          {actions}
        </footer>
      )}
    </section>
  );
};

/**
 * A labelled field. Labels sit above the control, which is the alignment the
 * design system standardises on.
 */
export const Field: React.FC<{
  label: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  htmlFor?: string;
  children: React.ReactNode;
}> = ({ label, hint, error, required, htmlFor, children }) => (
  <div className="flex flex-col gap-1.5">
    <label
      htmlFor={htmlFor}
      className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300"
    >
      {label}
      {required && <span className="text-brand-primary ml-1" aria-hidden="true">*</span>}
      {required && <span className="sr-only"> (required)</span>}
    </label>
    {children}
    {/* Errors replace the hint rather than stacking, so the row never jumps. */}
    {error ? (
      <p className="text-xs font-semibold text-red-600 dark:text-red-400" role="alert">
        {error}
      </p>
    ) : hint ? (
      <p className="text-xs text-slate-400">{hint}</p>
    ) : null}
  </div>
);

export default FormShell;
