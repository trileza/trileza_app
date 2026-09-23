/**
 * The mentor's sponsorship view.
 *
 * Renders what the proposal describes as the example line:
 *
 *   John — Sustainable Architecture — 3 days remaining — 62% read
 *
 * Reading progress is shown because the mentor paid for the licence, and the
 * backend only returns it on that basis. A mentor cannot see how far a mentee
 * has read a book they did not sponsor.
 */

import React, { useEffect, useState } from 'react';
import { Clock, TrendingUp, Gift, Loader2, Users, HandHeart, X } from 'lucide-react';
import { Card, Button } from '../ui';
import { cn, formatCurrency } from '../../utils';
import { licensingService, type Sponsorship } from '../../lib/services/licensing';
import { payForBook } from '../../lib/services/bookPayments';
import { errorMessage } from '../../lib/nexus';

interface Props {
  mentorId: string;
  mentorEmail: string;
  notify: (message: string, type: 'success' | 'info') => void;
}

export const MentorSponsorship: React.FC<Props> = ({ mentorId, mentorEmail, notify }) => {
  const [rows, setRows] = useState<Sponsorship[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const [s, r] = await Promise.all([
      licensingService.mentorSponsorships(mentorId).catch(() => []),
      licensingService.pendingRequests(mentorId).catch(() => [])
    ]);
    setRows(s);
    setRequests(r);
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      await load();
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [mentorId]);

  /** Fulfil a mentee's request by paying for it. */
  const fulfil = async (req: any, kind: 'purchase' | 'borrow') => {
    setBusy(req.id + kind);
    try {
      const result = await payForBook(req.book_id, kind, mentorEmail, req.mentee_id, req.id);
      if (result.status === 'cancelled') {
        notify('Payment cancelled.', 'info');
        return;
      }
      notify(kind === 'borrow' ? 'Borrowed for your mentee.' : 'Bought for your mentee.', 'success');
      await load();
    } catch (err) {
      notify(errorMessage(err, 'That payment could not be completed.'), 'info');
    } finally {
      setBusy(null);
    }
  };

  const decline = async (id: string) => {
    setBusy(id + 'decline');
    try {
      await licensingService.declineRequest(id);
      await load();
    } catch (err) {
      notify(errorMessage(err, 'Could not decline that request.'), 'info');
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-xs font-bold uppercase tracking-widest text-slate-400">
        <Loader2 size={16} className="animate-spin" /> Loading sponsorships
      </div>
    );
  }

  const active = rows.filter(r => ['active', 'expiring'].includes(r.status));
  const spend = rows.reduce((sum, r) => sum + Number(r.amount_minor || 0), 0) / 100;

  return (
    <div className="space-y-8">
      {/* ── Pending requests come first: they are the only part of this screen
             that is waiting on the mentor to act. ── */}
      {requests.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2">
            <HandHeart size={12} /> Waiting on you ({requests.length})
          </h3>

          {requests.map(req => (
            <Card
              key={req.id}
              className="p-5 rounded-3xl border border-amber-200 bg-amber-50/50 space-y-3"
            >
              <p className="text-xs font-bold text-slate-700 leading-relaxed">
                A mentee asked for a book.
                {req.message && <span className="block mt-1 italic text-slate-500">“{req.message}”</span>}
              </p>

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => fulfil(req, 'borrow')}
                  disabled={busy !== null}
                  className="flex-1 min-w-[140px] h-10 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {busy === req.id + 'borrow'
                    ? <Loader2 size={12} className="animate-spin" />
                    : <Clock size={12} />}
                  Borrow for them
                </Button>

                <Button
                  onClick={() => fulfil(req, 'purchase')}
                  disabled={busy !== null}
                  className="flex-1 min-w-[140px] h-10 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {busy === req.id + 'purchase'
                    ? <Loader2 size={12} className="animate-spin" />
                    : <Gift size={12} />}
                  Buy it for them
                </Button>

                <Button
                  onClick={() => decline(req.id)}
                  disabled={busy !== null}
                  className="h-10 px-4 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-slate-800 font-black text-[10px] uppercase tracking-widest disabled:opacity-60"
                >
                  <X size={12} />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ── Totals ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {[
          { label: 'Active loans', value: String(active.length), icon: Clock },
          { label: 'Books sponsored', value: String(rows.length), icon: Gift },
          { label: 'Total spend', value: formatCurrency(spend), icon: TrendingUp }
        ].map(s => (
          <Card
            key={s.label}
            className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
          >
            <s.icon size={14} className="text-brand-primary mb-2" />
            <p className="text-lg font-black text-slate-900 dark:text-white leading-none">{s.value}</p>
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-1">
              {s.label}
            </p>
          </Card>
        ))}
      </div>

      {/* ── The sponsorships themselves ── */}
      {rows.length === 0 ? (
        <div className="py-16 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
            <Users size={22} />
          </div>
          <p className="text-xs font-bold text-slate-500 max-w-sm mx-auto leading-relaxed">
            Nothing sponsored yet. From a book page you can buy a copy for a
            mentee, or borrow one for them.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
            Sponsored books
          </h3>

          {rows.map(r => (
            <Card
              key={r.license_id}
              className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-4"
            >
              <img src={r.cover_url} alt="" className="w-11 h-16 rounded-lg object-cover bg-slate-100 shrink-0" />

              <div className="flex-1 min-w-0 space-y-1">
                {/* The proposal's own example line. */}
                <p className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                  {r.mentee_name} — {r.title}
                </p>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-bold">
                  {r.license_type === 'borrowed' && r.days_left !== null && (
                    <span className={cn(
                      'flex items-center gap-1',
                      r.days_left <= 1 ? 'text-red-600' : r.days_left <= 2 ? 'text-amber-600' : 'text-slate-500'
                    )}>
                      <Clock size={10} />
                      {r.status === 'expired'
                        ? 'Expired'
                        : r.days_left === 0 ? 'Ends today' : `${r.days_left} days remaining`}
                    </span>
                  )}

                  {r.license_type !== 'borrowed' && (
                    <span className="text-brand-primary">Owned</span>
                  )}

                  <span className="text-slate-500">{Math.round(r.percent_read)}% read</span>

                  {/* Borrow-to-own progress, where credit has accumulated. */}
                  {r.credit_minor > 0 && (
                    <span className="text-slate-400">
                      {formatCurrency(r.credit_minor / 100)} toward ownership
                    </span>
                  )}
                </div>

                {r.percent_read > 0 && (
                  <div className="h-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden max-w-[220px]">
                    <div
                      className="h-full bg-brand-primary rounded-full"
                      style={{ width: `${Math.min(100, r.percent_read)}%` }}
                    />
                  </div>
                )}
              </div>

              <span className="text-[10px] font-black text-slate-400 shrink-0">
                {formatCurrency(Number(r.amount_minor || 0) / 100)}
              </span>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default MentorSponsorship;
