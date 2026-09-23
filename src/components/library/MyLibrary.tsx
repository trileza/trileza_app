/**
 * My Library, in the proposal's sections.
 *
 * The section a book falls into is decided server-side, from its licence, so
 * "owned" and "expired" mean the same thing here as they do to the reader that
 * enforces them.
 *
 * One rule shapes the whole screen: "The Mentee should never feel that a
 * borrowed book has disappeared without explanation. When access expires, the
 * interface should explain why and provide the permitted next actions." So an
 * expired book stays visible, with its reason and a way forward, rather than
 * vanishing from the list.
 */

import React, { useEffect, useState } from 'react';
import { BookOpen, Clock, AlertTriangle, Gift, Loader2, Library } from 'lucide-react';
import { Card, Button } from '../ui';
import { cn } from '../../utils';
import { licensingService, type LibraryEntry } from '../../lib/services/licensing';

interface Props {
  userId: string;
  onRead: (bookId: string) => void;
  onBrowse: () => void;
}

type SectionKey = 'reading' | 'owned' | 'borrowed' | 'expiring' | 'expired';

const SECTIONS: Array<{ key: SectionKey; label: string; blurb: string }> = [
  { key: 'reading',  label: 'Currently Reading', blurb: 'Picked up recently.' },
  { key: 'borrowed', label: 'Borrowed',          blurb: 'On loan to you now.' },
  { key: 'expiring', label: 'Expiring Soon',     blurb: 'Less than a day left.' },
  { key: 'owned',    label: 'Owned',             blurb: 'Yours to keep.' },
  { key: 'expired',  label: 'Expired',           blurb: 'The loan has ended.' }
];

export const MyLibrary: React.FC<Props> = ({ userId, onRead, onBrowse }) => {
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<SectionKey>('reading');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const rows = await licensingService.myLibrary(userId);
        if (alive) setEntries(rows);
      } catch (err) {
        console.error('[MyLibrary] Could not load:', err);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [userId]);

  // "Currently reading" is a view over the others rather than its own licence
  // state: anything started but not finished, most recent first.
  const inSection = (key: SectionKey): LibraryEntry[] => {
    if (key === 'reading') {
      return entries.filter(
        e => e.percent_read > 0 && e.percent_read < 100 && e.section !== 'expired'
      );
    }
    return entries.filter(e => e.section === key);
  };

  const counts = Object.fromEntries(
    SECTIONS.map(s => [s.key, inSection(s.key).length])
  ) as Record<SectionKey, number>;

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-xs font-bold uppercase tracking-widest text-slate-400">
        <Loader2 size={16} className="animate-spin" /> Loading your library
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="py-20 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
          <Library size={26} />
        </div>
        <div className="space-y-1">
          <p className="font-black text-slate-800 dark:text-white">Nothing here yet</p>
          <p className="text-xs font-bold text-slate-500 max-w-sm mx-auto leading-relaxed">
            Books you buy, and books a mentor sponsors for you, appear here.
          </p>
        </div>
        <Button
          onClick={onBrowse}
          className="bg-brand-primary hover:bg-brand-primary-hover text-white font-black text-[10px] uppercase tracking-widest px-6 py-3 rounded-xl"
        >
          Browse the library
        </Button>
      </div>
    );
  }

  const rows = inSection(active);

  return (
    <div className="space-y-6">
      {/* Sections carry their count, so an empty one is visibly empty rather
          than looking like a failed load once opened. */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {SECTIONS.map(s => (
          <button
            key={s.key}
            onClick={() => setActive(s.key)}
            className={cn(
              'px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border',
              active === s.key
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400'
            )}
          >
            {s.label}
            {counts[s.key] > 0 && (
              <span className="ml-2 opacity-60">{counts[s.key]}</span>
            )}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="py-14 text-center text-xs font-bold text-slate-400">
          {SECTIONS.find(s => s.key === active)?.blurb} Nothing here at the moment.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {rows.map(e => (
            <Card
              key={`${e.book_id}-${e.license_type}`}
              className="p-5 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4"
            >
              <div className="flex gap-4">
                <img
                  src={e.cover_url}
                  alt=""
                  className="w-16 h-24 rounded-xl object-cover bg-slate-100 shadow"
                />
                <div className="flex-1 min-w-0 space-y-1">
                  <h4 className="font-extrabold text-sm text-slate-900 dark:text-white leading-snug line-clamp-2">
                    {e.title}
                  </h4>
                  <p className="text-[10px] font-bold text-slate-400 truncate">
                    {e.author_name}
                  </p>

                  {/* A sponsored book says so. The proposal treats the payer
                      and the reader as different people, and the reader should
                      know which of their books someone else paid for. */}
                  {e.sponsored && (
                    <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-brand-primary">
                      <Gift size={10} /> Sponsored
                    </span>
                  )}
                </div>
              </div>

              {/* Where this licence stands. */}
              {e.section === 'expired' ? (
                <div className="px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                    <AlertTriangle size={11} /> Loan ended
                  </p>
                  <p className="text-[10px] font-bold text-slate-500 leading-relaxed">
                    {e.sponsored
                      ? 'Ask your mentor to borrow it again, or buy your own copy.'
                      : 'Buy a copy to keep reading.'}
                  </p>
                </div>
              ) : e.days_left !== null ? (
                <div
                  className={cn(
                    'px-3 py-2 rounded-xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest',
                    e.days_left <= 1
                      ? 'bg-red-50 text-red-600'
                      : e.days_left <= 2
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-500'
                  )}
                >
                  <Clock size={11} />
                  {e.days_left === 0
                    ? 'Ends today'
                    : `${e.days_left} day${e.days_left === 1 ? '' : 's'} left`}
                </div>
              ) : (
                <div className="px-3 py-2 rounded-xl bg-brand-light dark:bg-slate-800 text-[10px] font-black uppercase tracking-widest text-brand-dark dark:text-brand-accent">
                  Owned
                </div>
              )}

              {/* Progress, where there is any. */}
              {e.percent_read > 0 && (
                <div className="space-y-1">
                  <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-brand-primary rounded-full transition-all"
                      style={{ width: `${Math.min(100, e.percent_read)}%` }}
                    />
                  </div>
                  <p className="text-[9px] font-bold text-slate-400">
                    {Math.round(e.percent_read)}% read
                  </p>
                </div>
              )}

              <Button
                onClick={() => onRead(e.book_id)}
                disabled={e.section === 'expired'}
                className={cn(
                  'w-full h-11 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2',
                  e.section === 'expired'
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                    : 'bg-brand-primary hover:bg-brand-primary-hover text-white'
                )}
              >
                <BookOpen size={13} />
                {e.section === 'expired'
                  ? 'No longer available'
                  : e.percent_read > 0 ? 'Continue reading' : 'Start reading'}
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyLibrary;
