/**
 * Password rules, shown while they are being met.
 *
 * The backend enforces ten characters with a digit, both cases and a symbol,
 * and said so only after the form was submitted — as one run-on sentence
 * listing every rule, with no indication which one had failed. Someone with a
 * nine-character password had to read five clauses to find the one that
 * applied to them.
 *
 * These are the same rules, checked as they type, each ticking off on its own.
 *
 * The list mirrors `[auth.password]` in insforge.toml. If that changes, this
 * has to change with it: a form that accepts what the server refuses is worse
 * than no guidance at all.
 */

import React from 'react';
import { Check, X } from 'lucide-react';
import { cn } from '../../utils';

export interface PasswordRule {
  label: string;
  met: boolean;
}

export const passwordRules = (password: string): PasswordRule[] => [
  { label: 'At least 10 characters', met: password.length >= 10 },
  { label: 'A lowercase letter',     met: /[a-z]/.test(password) },
  { label: 'An uppercase letter',    met: /[A-Z]/.test(password) },
  { label: 'A number',               met: /[0-9]/.test(password) },
  // Anything that is not a letter, a digit or a space. Deliberately broad:
  // a narrow list would reject a symbol the server happily accepts.
  { label: 'A symbol (!, #, @…)',    met: /[^A-Za-z0-9\s]/.test(password) }
];

export const passwordMeetsPolicy = (password: string): boolean =>
  passwordRules(password).every(r => r.met);

interface Props {
  password: string;
  /** Hidden until typing starts, so an untouched form is not a wall of red. */
  show?: boolean;
}

export const PasswordStrength: React.FC<Props> = ({ password, show = true }) => {
  const rules = passwordRules(password);
  const met = rules.filter(r => r.met).length;

  if (!show || !password) return null;

  // Four bars rather than five: the scale is the strength of the password, not
  // a count of the rules, and the last rule met is what makes it usable rather
  // than what makes it strong.
  const strength = met === rules.length ? 4 : Math.max(1, Math.min(3, met - 1));

  const bar = (i: number) =>
    i < strength
      ? strength === 4
        ? 'bg-emerald-500'
        : strength >= 3
          ? 'bg-amber-500'
          : 'bg-rose-500'
      : 'bg-slate-200 dark:bg-slate-800';

  const label =
    strength === 4 ? 'Strong' : strength === 3 ? 'Almost there' : 'Too weak';

  const labelTone =
    strength === 4
      ? 'text-emerald-600 dark:text-emerald-400'
      : strength === 3
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-rose-600 dark:text-rose-400';

  return (
    <div className="space-y-2.5 pt-2">
      <div className="flex items-center gap-2">
        <div className="flex-1 flex gap-1" aria-hidden="true">
          {[0, 1, 2, 3].map(i => (
            <span
              key={i}
              className={cn('h-1.5 flex-1 rounded-full transition-colors duration-300', bar(i))}
            />
          ))}
        </div>
        <span className={cn('text-[10px] font-black uppercase tracking-wider', labelTone)}>
          {label}
        </span>
      </div>

      {/* Announced politely, so a screen reader hears progress without being
          interrupted on every keystroke. */}
      <ul className="space-y-1" aria-live="polite">
        {rules.map(r => (
          <li
            key={r.label}
            className={cn(
              'flex items-center gap-1.5 text-[11px] font-semibold transition-colors',
              r.met ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'
            )}
          >
            {r.met ? <Check size={12} strokeWidth={3} /> : <X size={12} strokeWidth={3} />}
            {r.label}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default PasswordStrength;
