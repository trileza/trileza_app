import React from 'react';

interface LoadingOverlayProps {
  message?: string;
  submessage?: string;
  isFullPage?: boolean;
}

/**
 * The loading state, built around the logo rather than beside it.
 *
 * Previously a bare spinner sat above the mark, which read as two unrelated
 * things stacked. Here the ring is drawn *around* the logo — one object, with
 * the brand at its centre — so a slow page still looks like Trileza rather
 * than like a generic spinner.
 */
export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  message = '',
  submessage = '',
  isFullPage = true
}) => {
  const content = (
    <div className="flex flex-col items-center justify-center text-center gap-5 relative z-10">
      <div className="relative w-20 h-20 flex items-center justify-center">
        {/* Track — the full circle, so the moving arc has something to run on. */}
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full border-[3px] border-brand-primary/15"
        />
        {/* The arc itself. */}
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-brand-primary animate-spin motion-reduce:animate-none"
        />
        {/* Brand mark at the centre of the ring, breathing gently so the whole
            unit reads as alive without the mark itself appearing to spin. */}
        <img
          src="/icon-192.png"
          alt=""
          aria-hidden="true"
          width={44}
          height={44}
          className="w-11 h-11 object-contain animate-pulse motion-reduce:animate-none"
        />
      </div>

      {/* One live region: a screen reader hears the status, not the decoration. */}
      <div role="status" aria-live="polite" className="flex flex-col gap-1">
        <span className="sr-only">Loading</span>
        {message && (
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">{message}</p>
        )}
        {submessage && (
          <p className="text-xs text-slate-400 dark:text-slate-500">{submessage}</p>
        )}
      </div>
    </div>
  );

  if (!isFullPage) return content;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background">
      {content}
    </div>
  );
};
