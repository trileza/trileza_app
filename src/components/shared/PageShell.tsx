import React from 'react';
import { cn } from '../../utils';

type ShellWidth = 'form' | 'content' | 'wide';

interface PageShellProps {
  /**
   * How wide the column may grow.
   *
   *  - `form`    — authentication, onboarding, checkout, any page that is
   *                mostly fields. Portrait: a narrow, centred column.
   *  - `content` — reading and detail pages (a course, a book, a profile).
   *  - `wide`    — dashboards and tables, which genuinely need the room.
   */
  width?: ShellWidth;
  /** Vertically centre the column. For short standalone pages like sign-in. */
  center?: boolean;
  children: React.ReactNode;
  className?: string;
}

/**
 * The page-level width container.
 *
 * Every page was choosing its own max width, and they disagreed: sign-up ran
 * to max-w-2xl, mentor onboarding to max-w-5xl, the author application to
 * max-w-4xl, checkout to max-w-xl. The result was that moving between two
 * steps of the same flow visibly changed the column width, and forms stretched
 * edge-to-edge on a desktop monitor — a single column of inputs 1024px wide
 * reads as unfinished, and long line lengths are genuinely harder to scan.
 *
 * `form` is deliberately 42rem (672px). That is wide enough for a two-column
 * field row on a laptop and narrow enough that the eye does not have to travel
 * across the whole display to get from a label to its input.
 */
const WIDTHS: Record<ShellWidth, string> = {
  form: 'max-w-2xl',
  content: 'max-w-4xl',
  wide: 'max-w-7xl',
};

export const PageShell: React.FC<PageShellProps> = ({
  width = 'form',
  center = false,
  children,
  className,
}) => (
  <div
    className={cn(
      'w-full mx-auto px-4 sm:px-6',
      WIDTHS[width],
      center && 'flex flex-col justify-center min-h-[100dvh] py-10',
      !center && 'py-8 sm:py-12',
      className
    )}
  >
    {children}
  </div>
);

export default PageShell;
