/**
 * The Author Studio dashboard (§22, §30.1).
 *
 * The old dashboard showed three numbers: how many books, how many
 * entitlements, and a royalty balance. §30.1 asks for ten, per book, and the
 * data was all being recorded already — nothing was asking for it.
 *
 * Two things this deliberately does not show:
 *
 * Who read what. §18.3 says an author "does not gain access to private learner
 * information beyond the analytics permitted by platform policy", so every
 * figure here is a count or an average. A reader's identity never reaches this
 * component, because the database function never returns it.
 *
 * A payout button. Earnings are real money and the payout path is not wired
 * yet; a button that looks like it pays and does not is worse than its
 * absence. The balance says plainly that payouts are not open.
 */

import React, { useEffect, useState } from 'react';
import {
  BookOpen, ShoppingBag, Clock, Users, TrendingUp, Wallet,
  Loader2, AlertCircle, PlusCircle, Eye, CheckCircle2
} from 'lucide-react';
import { cn, formatCurrency } from '../../utils';
import { authorStudio, toNaira, type AuthorSummary, type BookAnalytics } from '../../lib/services/authorStudio';

interface Props {
  authorId: string;
  onPublishNew: () => void;
}

export const AuthorStudio: React.FC<Props> = ({ authorId, onPublishNew }) => {
  const [summary, setSummary] = useState<AuthorSummary | null>(null);
  const [books, setBooks] = useState<BookAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [s, b] = await Promise.all([
          authorStudio.summary(authorId),
          authorStudio.books(authorId)
        ]);
        if (!alive) return;
        setSummary(s);
        setBooks(b);
      } catch (err: any) {
        if (alive) setFailure(err?.message || 'Your figures could not be loaded.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [authorId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-[10px] font-black uppercase tracking-widest text-slate-500">
        <Loader2 size={14} className="animate-spin" /> Loading your studio
      </div>
    );
  }

  if (failure) {
    return (
      <div className="flex items-start gap-2.5 px-4 py-3.5 rounded-xl bg-red-500/10 text-red-300">
        <AlertCircle size={15} className="mt-0.5 shrink-0" />
        <p className="text-[11px] font-bold leading-relaxed">{failure}</p>
      </div>
    );
  }

  const s = summary!;

  const cards = [
    {
      label: 'Published', value: String(s.books_published), icon: BookOpen,
      note: s.books_pending > 0 ? `${s.books_pending} waiting for review` : 'All reviewed'
    },
    {
      label: 'Sold', value: String(s.purchases), icon: ShoppingBag,
      note: `${s.borrows} borrowed`
    },
    {
      label: 'Reading now', value: String(s.active_readers), icon: Users,
      note: `${s.active_loans} loan${s.active_loans === 1 ? '' : 's'} running`
    },
    {
      label: 'Earned', value: formatCurrency(toNaira(s.earned_minor)), icon: Wallet,
      note: `of ${formatCurrency(toNaira(s.revenue_minor))} taken`
    }
  ];

  return (
    <div className="space-y-8">
      {/* ── Headline ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map(c => (
          <div
            key={c.label}
            className="px-5 py-5 rounded-2xl bg-slate-900 border border-slate-800"
          >
            <div className="flex items-center gap-2 mb-2.5">
              <c.icon size={13} className="text-brand-accent" />
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                {c.label}
              </span>
            </div>
            <p className="text-2xl font-black text-white tabular-nums leading-none">{c.value}</p>
            <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">{c.note}</p>
          </div>
        ))}
      </div>

      {/* ── Balance ──
          Separated from the cards above because it is money the author is
          owed, not a statistic. */}
      <div className="px-5 py-5 rounded-2xl bg-brand-primary/10 border border-brand-primary/30">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-brand-accent mb-1.5">
              Your balance
            </p>
            <p className="text-3xl font-black text-white tabular-nums leading-none">
              {formatCurrency(toNaira(s.available_minor))}
            </p>
            <p className="text-[10px] text-slate-400 mt-2 leading-relaxed max-w-md">
              {s.paid_minor > 0
                ? `${formatCurrency(toNaira(s.paid_minor))} has already been paid out. `
                : ''}
              Payouts are not open yet — this balance is held and will be
              payable once they are.
            </p>
          </div>
        </div>
      </div>

      {/* ── Per book ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-black text-white uppercase tracking-wider">
            Your books
          </h3>
          <button
            onClick={onPublishNew}
            className="px-4 py-2.5 rounded-xl bg-brand-primary hover:bg-brand-primary-hover text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border-none cursor-pointer"
          >
            <PlusCircle size={13} /> Publish
          </button>
        </div>

        {books.length === 0 ? (
          <div className="px-6 py-12 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-3">
            <BookOpen size={28} className="text-slate-700 mx-auto" />
            <p className="text-xs font-bold text-slate-400">
              Nothing published yet.
            </p>
            <p className="text-[11px] text-slate-500 leading-relaxed max-w-sm mx-auto">
              Publishing takes five steps and asks what you want to offer —
              buying, lending, or borrowing that builds toward ownership.
            </p>
          </div>
        ) : (
          books.map(b => <BookRow key={b.book_id} book={b} />)
        )}
      </div>
    </div>
  );
};

/** One book, with the figures §30.1 asks for. */
const BookRow: React.FC<{ book: BookAnalytics }> = ({ book }) => {
  const published = book.status === 'published';

  return (
    <div className="px-4 py-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3.5">
      <div className="flex items-start gap-3.5">
        {book.cover_url ? (
          <img
            src={book.cover_url}
            alt=""
            className="w-11 h-15 object-cover rounded-lg shrink-0 bg-slate-800"
          />
        ) : (
          <div className="w-11 h-15 rounded-lg bg-slate-800 shrink-0 flex items-center justify-center">
            <BookOpen size={15} className="text-slate-600" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <h4 className="text-xs font-black text-white truncate">{book.title}</h4>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span
              className={cn(
                'px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider inline-flex items-center gap-1',
                published
                  ? 'bg-emerald-500/15 text-emerald-300'
                  : 'bg-amber-500/15 text-amber-300'
              )}
            >
              {published ? <CheckCircle2 size={9} /> : <Eye size={9} />}
              {published ? 'Live' : 'In review'}
            </span>
            <span className="text-[10px] font-bold text-slate-500">
              {formatCurrency(book.retail_price)}
            </span>
          </div>
        </div>

        <div className="text-right shrink-0">
          <p className="text-sm font-black text-white tabular-nums">
            {formatCurrency(toNaira(book.earnings_minor))}
          </p>
          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mt-0.5">
            earned
          </p>
        </div>
      </div>

      {/* The figures only mean something once someone has read it. */}
      {(book.purchases > 0 || book.borrows > 0) && (
        <div className="grid grid-cols-4 gap-2 pt-3 border-t border-slate-800">
          <Stat label="Sold" value={book.purchases} />
          <Stat
            label="Borrowed"
            value={book.borrows}
            note={book.active_loans > 0 ? `${book.active_loans} now` : undefined}
          />
          <Stat label="Readers" value={book.active_readers} icon={TrendingUp} />
          <Stat
            label="Read"
            value={`${Math.round(book.avg_progress)}%`}
            note={book.completions > 0 ? `${book.completions} finished` : undefined}
          />
        </div>
      )}

      {book.conversions > 0 && (
        <p className="text-[10px] font-bold text-brand-accent flex items-center gap-1.5">
          <Clock size={10} />
          {book.conversions} borrow{book.conversions === 1 ? '' : 's'} became ownership
        </p>
      )}
    </div>
  );
};

const Stat: React.FC<{ label: string; value: number | string; note?: string; icon?: any }> = ({
  label, value, note
}) => (
  <div>
    <p className="text-sm font-black text-white tabular-nums leading-none">{value}</p>
    <p className="text-[9px] font-black uppercase tracking-wider text-slate-500 mt-1">{label}</p>
    {note && <p className="text-[9px] text-slate-600 mt-0.5">{note}</p>}
  </div>
);

export default AuthorStudio;
