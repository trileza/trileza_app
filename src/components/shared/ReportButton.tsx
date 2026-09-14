import React, { useState } from 'react';
import { Flag, X, Loader2, CheckCircle2 } from 'lucide-react';
import { Card, Button } from '../ui';
import { useAuthStore } from '../../store/authStore';
import { useTenant } from '../../lib/tenantContext';
import { supportService, REPORT_CATEGORIES } from '../../lib/services/support';
import type { FlaggedContent } from '../../types/admin';
import { cn } from '../../utils';

interface ReportButtonProps {
  targetType: FlaggedContent['target_type'];
  targetId: string;
  /** Shown in the dialog so the reporter can confirm what they are flagging. */
  targetLabel?: string;
  /** 'icon' suits a card corner; 'menu-item' suits an overflow menu. */
  variant?: 'icon' | 'menu-item';
  className?: string;
  onReported?: () => void;
}

/**
 * Reports a course, book, post or comment into the moderation queue.
 *
 * The Support and Compliance consoles read `flagged_content`, but nothing in
 * the app ever wrote to it — there was no way for anyone to report anything.
 * Severity is derived from the chosen category rather than asked for, so the
 * queue orders itself without trusting reporter input.
 */
const ReportButton: React.FC<ReportButtonProps> = ({
  targetType,
  targetId,
  targetLabel,
  variant = 'icon',
  className,
  onReported
}) => {
  const { user } = useAuthStore();
  const { tenant } = useTenant();

  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<string>('');
  const [detail, setDetail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Reporting is attributable on purpose — anonymous reports cannot be
  // rate-limited or followed up.
  if (!user) return null;

  const submit = async () => {
    if (!category) return;
    setSubmitting(true);
    setError(null);
    try {
      await supportService.reportContent({
        reporterId: user.id,
        tenantId: tenant?.id,
        targetType,
        targetId,
        category,
        reason: detail.trim() || category
      });
      setDone(true);
      onReported?.();
      setTimeout(() => { setOpen(false); setDone(false); setCategory(''); setDetail(''); }, 1800);
    } catch (err: any) {
      setError(err.message || 'Could not submit your report.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {variant === 'icon' ? (
        <button
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); setOpen(true); }}
          title="Report this"
          aria-label="Report this content"
          className={cn(
            'p-2 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer',
            className
          )}
        >
          <Flag size={15} />
        </button>
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); setOpen(true); }}
          className={cn(
            'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600 transition-colors cursor-pointer',
            className
          )}
        >
          <Flag size={14} /> Report
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <Card className="w-full max-w-md p-8 rounded-[2rem] border-none space-y-5">
            {done ? (
              <div className="text-center py-6 space-y-3">
                <CheckCircle2 size={40} className="mx-auto text-emerald-500" />
                <h3 className="text-lg font-black text-slate-900 dark:text-white">Report submitted</h3>
                <p className="text-sm text-slate-500 font-medium">
                  Our moderation team will review it. Thank you for flagging it.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white">Report content</h3>
                    {targetLabel && (
                      <p className="text-xs font-bold text-slate-400 mt-1 truncate max-w-[280px]">{targetLabel}</p>
                    )}
                  </div>
                  <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer flex-none" aria-label="Close">
                    <X size={18} />
                  </button>
                </div>

                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Why are you reporting this?</span>
                  <div className="mt-2 space-y-1.5">
                    {REPORT_CATEGORIES.map(c => (
                      <button
                        key={c}
                        onClick={() => setCategory(c)}
                        className={cn(
                          'w-full text-left p-3 rounded-xl border text-sm font-semibold transition-all cursor-pointer',
                          category === c
                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-slate-900 dark:text-white'
                            : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                        )}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="block">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Anything else? (optional)</span>
                  <textarea
                    rows={3}
                    value={detail}
                    onChange={e => setDetail(e.target.value)}
                    placeholder="Details help our team act faster."
                    className="mt-1 w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-semibold text-sm focus:outline-none focus:border-emerald-500 resize-y"
                  />
                </label>

                {error && (
                  <p className="text-sm font-semibold text-red-600 dark:text-red-400">{error}</p>
                )}

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setOpen(false)} className="flex-1 rounded-xl h-12 font-bold">Cancel</Button>
                  <Button
                    onClick={submit}
                    disabled={!category || submitting}
                    className="flex-1 rounded-xl h-12 bg-red-600 hover:bg-red-500 text-white border-none font-bold gap-2"
                  >
                    {submitting ? <Loader2 size={15} className="animate-spin" /> : <Flag size={15} />}
                    Submit report
                  </Button>
                </div>
              </>
            )}
          </Card>
        </div>
      )}
    </>
  );
};

export default ReportButton;
