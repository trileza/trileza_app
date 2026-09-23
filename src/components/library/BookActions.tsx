/**
 * The action panel on a book page.
 *
 * The proposal is explicit: "The Library should not display actions that a user
 * role is not allowed to initiate." So what appears here comes from the
 * backend's own answer about this user and this book, not from a role check
 * written inline — the two would drift, and the UI copy would start promising
 * things the server refuses.
 *
 *   a mentee sees  Buy, and Ask My Mentor
 *   a mentor sees  Buy for me, Buy for a mentee, Borrow for a mentee
 *
 * Hiding a button is not the security control; payments-initialize refuses the
 * same things independently. This is about not offering a dead end.
 */

import React, { useEffect, useState } from 'react';
import { ShoppingBag, Clock, Gift, HandHeart, BookOpen, Loader2, Check } from 'lucide-react';
import { Button } from '../ui';
import { cn, formatCurrency } from '../../utils';
import { licensingService, type BookActions as Actions, type Mentee } from '../../lib/services/licensing';
import { payForBook } from '../../lib/services/bookPayments';
import { errorMessage } from '../../lib/nexus';

interface BookLike {
  id: string;
  title: string;
  retail_price: number;
  rental_price?: number;
  allow_borrow_to_own?: boolean;
  borrow_days?: number;
}

interface Props {
  book: BookLike;
  userId: string;
  userEmail: string;
  onRead: () => void;
  onChanged?: () => void;
  notify: (message: string, type: 'success' | 'info') => void;
}

/** Who a sponsored action is for, while the picker is open. */
type PendingAction = { kind: 'purchase' | 'borrow' } | null;

export const BookActionPanel: React.FC<Props> = ({
  book, userId, userEmail, onRead, onChanged, notify
}) => {
  const [actions, setActions] = useState<Actions | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const [mentees, setMentees] = useState<Mentee[]>([]);
  const [mentors, setMentors] = useState<Mentee[]>([]);
  const [pending, setPending] = useState<PendingAction>(null);
  const [askOpen, setAskOpen] = useState(false);

  const borrowDays = book.borrow_days ?? 5;
  // The author may price a borrow directly; otherwise it is a tenth of retail,
  // which is the proposal's worked example.
  const borrowPrice = Number(book.rental_price) > 0
    ? Number(book.rental_price)
    : Math.round(Number(book.retail_price || 0) * 0.1);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const a = await licensingService.getBookActions(userId, book.id);
        if (alive) setActions(a);
      } catch (err) {
        console.error('[BookActions] Could not load actions:', err);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [userId, book.id]);

  const refresh = async () => {
    const a = await licensingService.getBookActions(userId, book.id).catch(() => null);
    setActions(a);
    onChanged?.();
  };

  /** Buy or borrow, either for myself or for a named mentee. */
  const pay = async (kind: 'purchase' | 'borrow', beneficiaryId?: string) => {
    setBusy(kind + (beneficiaryId || ''));
    try {
      const result = await payForBook(book.id, kind, userEmail, beneficiaryId);
      if (result.status === 'cancelled') {
        notify('Payment cancelled.', 'info');
        return;
      }
      notify(
        beneficiaryId
          ? kind === 'borrow'
            ? `Borrowed for your mentee — ${borrowDays} days of access.`
            : 'Bought for your mentee.'
          : 'Added to your library.',
        'success'
      );
      await refresh();
    } catch (err) {
      notify(errorMessage(err, 'That payment could not be completed.'), 'info');
    } finally {
      setBusy(null);
      setPending(null);
    }
  };

  /** Opens the mentee picker for a sponsored action. */
  const chooseMentee = async (kind: 'purchase' | 'borrow') => {
    setPending({ kind });
    if (mentees.length === 0) {
      const list = await licensingService.myMentees(userId).catch(() => []);
      setMentees(list);
    }
  };

  const askMentor = async () => {
    setAskOpen(true);
    if (mentors.length === 0) {
      const list = await licensingService.myMentors(userId).catch(() => []);
      setMentors(list);
    }
  };

  const sendRequest = async (mentorId: string) => {
    setBusy('request');
    try {
      await licensingService.requestFromMentor(book.id, userId, mentorId);
      notify('Your mentor has been asked for this book.', 'success');
      setAskOpen(false);
    } catch (err) {
      notify(errorMessage(err, 'Could not send that request.'), 'info');
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-xs font-bold text-slate-400">
        <Loader2 size={14} className="animate-spin" /> Checking your access…
      </div>
    );
  }

  if (!actions) return null;

  return (
    <div className="space-y-3">
      {/* Already entitled — reading beats buying. */}
      {actions.can_read && (
        <Button
          onClick={onRead}
          className="w-full h-12 rounded-2xl bg-brand-primary hover:bg-brand-primary-hover text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2"
        >
          <BookOpen size={16} />
          {actions.already_owns ? 'Read — you own this' : 'Read — on loan to you'}
        </Button>
      )}

      {/* ── Buy for myself ── */}
      {actions.can_buy_self && (
        <Button
          onClick={() => pay('purchase')}
          disabled={busy !== null}
          className="w-full h-12 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-widest flex items-center justify-between px-5 disabled:opacity-60"
        >
          <span className="flex items-center gap-2">
            {busy === 'purchase' ? <Loader2 size={15} className="animate-spin" /> : <ShoppingBag size={15} />}
            {actions.is_mentor ? 'Buy for me' : 'Buy this book'}
          </span>
          <span>{formatCurrency(book.retail_price)}</span>
        </Button>
      )}

      {/* ── Mentor: buy for a mentee ── */}
      {actions.can_buy_for_mentee && (
        <Button
          onClick={() => chooseMentee('purchase')}
          disabled={busy !== null}
          className="w-full h-12 rounded-2xl bg-white border-2 border-slate-900 text-slate-900 hover:bg-slate-50 font-black text-xs uppercase tracking-widest flex items-center justify-between px-5 disabled:opacity-60"
        >
          <span className="flex items-center gap-2"><Gift size={15} /> Buy for a mentee</span>
          <span>{formatCurrency(book.retail_price)}</span>
        </Button>
      )}

      {/* ── Mentor: borrow for a mentee ── */}
      {actions.can_borrow_for_mentee && (
        <div className="space-y-1.5">
          <Button
            onClick={() => chooseMentee('borrow')}
            disabled={busy !== null}
            className="w-full h-12 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs uppercase tracking-widest flex items-center justify-between px-5 disabled:opacity-60"
          >
            <span className="flex items-center gap-2">
              <Clock size={15} /> Borrow for a mentee
            </span>
            <span>{formatCurrency(borrowPrice)}</span>
          </Button>
          <p className="text-[10px] font-bold text-slate-500 px-1 leading-relaxed">
            {borrowDays} days of reading access for your mentee. Not a download.
            {book.allow_borrow_to_own && (
              <> Every borrow counts toward the {formatCurrency(book.retail_price)} price —
                {' '}{Math.ceil(Number(book.retail_price) / Math.max(1, borrowPrice))} borrows
                and they own it.</>
            )}
          </p>
        </div>
      )}

      {/* ── Mentee: ask a mentor ── */}
      {actions.can_request && (
        <Button
          onClick={askMentor}
          disabled={busy !== null}
          className="w-full h-12 rounded-2xl bg-white border-2 border-brand-primary text-brand-primary hover:bg-brand-light font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-60"
        >
          <HandHeart size={15} /> Ask my mentor for this
        </Button>
      )}

      {/* Nothing on offer, and nothing held. Say why rather than showing an
          empty panel the reader has to interpret. */}
      {!actions.can_read && !actions.can_buy_self && !actions.can_request && (
        <p className="text-xs font-bold text-slate-500 text-center py-4 leading-relaxed">
          This book is not currently available to you.
          {!actions.is_mentor && ' Ask a mentor to sponsor it, or check back later.'}
        </p>
      )}

      {/* ── Mentee picker ── */}
      {pending && (
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            {pending.kind === 'borrow' ? 'Borrow for which mentee?' : 'Buy for which mentee?'}
          </p>

          {mentees.length === 0 ? (
            <p className="text-xs font-bold text-slate-500 leading-relaxed">
              You have no mentees yet. Once a mentee is linked to you, you can
              buy and borrow on their behalf.
            </p>
          ) : (
            mentees.map(m => (
              <button
                key={m.mentee_id}
                onClick={() => pay(pending.kind, m.mentee_id)}
                disabled={busy !== null}
                className="w-full text-left px-4 py-3 rounded-xl bg-white border border-slate-200 hover:border-brand-primary text-xs font-bold text-slate-800 flex items-center justify-between disabled:opacity-60"
              >
                {m.full_name}
                {busy === pending.kind + m.mentee_id
                  ? <Loader2 size={13} className="animate-spin" />
                  : <Check size={13} className="text-brand-primary" />}
              </button>
            ))
          )}

          <button
            onClick={() => setPending(null)}
            className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 pt-1"
          >
            Cancel
          </button>
        </div>
      )}

      {/* ── Mentor picker, for a request ── */}
      {askOpen && (
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            Ask which mentor?
          </p>

          {mentors.length === 0 ? (
            <p className="text-xs font-bold text-slate-500 leading-relaxed">
              You are not linked to a mentor yet.
            </p>
          ) : (
            mentors.map(m => (
              <button
                key={m.mentee_id}
                onClick={() => sendRequest(m.mentee_id)}
                disabled={busy !== null}
                className="w-full text-left px-4 py-3 rounded-xl bg-white border border-slate-200 hover:border-brand-primary text-xs font-bold text-slate-800 flex items-center justify-between disabled:opacity-60"
              >
                {m.full_name}
                {busy === 'request'
                  ? <Loader2 size={13} className="animate-spin" />
                  : <HandHeart size={13} className="text-brand-primary" />}
              </button>
            ))
          )}

          <button
            onClick={() => setAskOpen(false)}
            className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 pt-1"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
};

export default BookActionPanel;
