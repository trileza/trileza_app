import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../utils';

type LogoSize = 'sm' | 'md' | 'lg' | 'xl';

interface LogoProps {
  /** Mark only, or mark plus the Trileza wordmark. */
  variant?: 'mark' | 'full';
  size?: LogoSize;
  /** Where clicking goes. `false` renders it inert (login, splash, print). */
  to?: string | false;
  /** Optional tag beside the wordmark, e.g. "Admin", "Enterprise". */
  badge?: string;
  className?: string;
}

/**
 * The Trileza logo.
 *
 * One component so placement, sizing, dark-mode handling and click-through are
 * identical everywhere. Previously a raw img tag pointing at the 633 KB
 * logo.png was pasted into 22 places, with different dimensions, different
 * dark-mode treatment, and inconsistent linking — some clickable, some not.
 *
 * Sizing note: the brand source file is 633 KB, far larger than any position it
 * is rendered at, so this picks the nearest pre-scaled icon instead. A sidebar
 * mark should never pull the full-resolution file.
 */
const SIZES: Record<LogoSize, { box: string; text: string; img: number }> = {
  sm: { box: 'w-8 h-8',   text: 'text-base', img: 32 },
  md: { box: 'w-10 h-10', text: 'text-lg',   img: 192 },
  lg: { box: 'w-12 h-12', text: 'text-xl',   img: 192 },
  xl: { box: 'w-16 h-16', text: 'text-2xl',  img: 512 }
};

export const Logo: React.FC<LogoProps> = ({
  variant = 'full',
  size = 'md',
  to = '/',
  badge,
  className
}) => {
  const s = SIZES[size];

  const mark = (
    <span
      className={cn(
        s.box,
        'flex items-center justify-center shrink-0 rounded-2xl bg-white dark:bg-slate-900',
        'border border-slate-200 dark:border-slate-800 p-1.5 shadow-sm'
      )}
    >
      <img
        src={s.img <= 32 ? '/icon-32.png' : s.img <= 192 ? '/icon-192.png' : '/icon-512.png'}
        alt=""
        width={s.img}
        height={s.img}
        // Decorative: the accessible name comes from the wordmark or the
        // link's aria-label, so announcing the image too would be duplication.
        aria-hidden="true"
        loading="eager"
        decoding="async"
        className="w-full h-full object-contain"
      />
    </span>
  );

  const content = (
    <span className={cn('flex items-center gap-3 min-w-0', className)}>
      {mark}
      {variant === 'full' && (
        <span className="flex items-center gap-2 min-w-0">
          <span className={cn(s.text, 'font-black tracking-tight text-slate-900 dark:text-white truncate')}>
            Trileza
          </span>
          {badge && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 whitespace-nowrap">
              {badge}
            </span>
          )}
        </span>
      )}
    </span>
  );

  if (to === false) {
    return content;
  }

  return (
    <Link
      to={to}
      aria-label="Trileza — go to dashboard"
      className="inline-flex items-center hover:opacity-90 transition-opacity rounded-2xl focus-visible:outline-2 focus-visible:outline-emerald-500 focus-visible:outline-offset-2"
    >
      {content}
    </Link>
  );
};

export default Logo;
