import React, { useState, useEffect, useCallback } from 'react';
import {
  LifeBuoy, Plus, X, Loader2, AlertTriangle, Send, Scale, MessageSquare, CheckCircle2
} from 'lucide-react';
import PageHeader from '../../components/shared/PageHeader';
import { Card, Button } from '../../components/ui';
import { useAuthStore } from '../../store/authStore';
import { useTenant } from '../../lib/tenantContext';
import { supportService } from '../../lib/services/support';
import type { SupportTicket, ComplianceRequest } from '../../types/admin';
import { cn } from '../../utils';

const inputClass =
  'w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-semibold focus:outline-none focus:border-emerald-500';

const STATUS_TONE: Record<string, string> = {
  open: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400',
  in_progress: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  escalated: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
  closed: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  under_review: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400',
  resolved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
  dismissed: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
};

const formatWhen = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—';

/**
 * Help & Support: raise a ticket, follow the conversation with an agent, and
 * file copyright or data-protection requests.
 *
 * This is the intake the Support Agent and Compliance Officer consoles were
 * built to receive but never had.
 */
const Support: React.FC = () => {
  const { user } = useAuthStore();
  const { tenant } = useTenant();

  const [tab, setTab] = useState<'tickets' | 'legal'>('tickets');
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [requests, setRequests] = useState<ComplianceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({ priority: 'medium' });
  const [submitting, setSubmitting] = useState(false);

  const [openTicket, setOpenTicket] = useState<SupportTicket | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      if (tab === 'tickets') setTickets(await supportService.getMyTickets(user.id));
      else setRequests(await supportService.getMyComplianceRequests(user.id));
    } catch (err: any) {
      setError(err.message || 'Could not load this section.');
    } finally {
      setLoading(false);
    }
  }, [user?.id, tab]);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (!user?.id) return;
    setSubmitting(true);
    setError(null);
    try {
      if (tab === 'tickets') {
        await supportService.createTicket({
          userId: user.id,
          tenantId: tenant?.id,
          title: form.title,
          description: form.description,
          priority: form.priority as SupportTicket['priority']
        });
        setNotice('Ticket raised. Our support team will reply here.');
      } else {
        await supportService.fileComplianceRequest({
          userId: user.id,
          tenantId: tenant?.id,
          type: (form.type || 'copyright_claim') as ComplianceRequest['type'],
          details: {
            claimant: form.claimant || user.full_name,
            infringement_url: form.url,
            reason: form.reason,
            request_type: form.type,
            notes: form.notes
          }
        });
        setNotice('Request filed. Our compliance team will be in touch.');
      }
      setShowNew(false);
      setForm({ priority: 'medium' });
      load();
    } catch (err: any) {
      setError(err.message || 'Could not submit that.');
    } finally {
      setSubmitting(false);
    }
  };

  const sendReply = async () => {
    if (!openTicket || !user?.id || !replyText.trim()) return;
    setReplying(true);
    try {
      const updated = await supportService.replyToTicket({
        ticketId: openTicket.id,
        senderId: user.id,
        senderName: user.full_name || 'You',
        text: replyText
      });
      setOpenTicket(updated);
      setReplyText('');
      load();
    } catch (err: any) {
      setError(err.message || 'Could not send your reply.');
    } finally {
      setReplying(false);
    }
  };

  const closeTicket = async (ticket: SupportTicket) => {
    if (!user?.id) return;
    try {
      await supportService.closeMyTicket(ticket.id, user.id);
      setNotice('Ticket closed. Reply to it any time to reopen.');
      setOpenTicket(null);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const canSubmit = tab === 'tickets'
    ? Boolean(form.title?.trim() && form.description?.trim())
    : Boolean(form.reason?.trim());

  return (
    <div className="w-full pb-20 space-y-8 animate-in fade-in duration-500">
      <PageHeader
        title={<span>Help & <span className="text-emerald-400">Support</span></span>}
        description="Raise an issue with our team, follow the conversation, or file a copyright or data-protection request."
        tag="Support"
        icon={LifeBuoy}
        rightContent={
          <Button
            onClick={() => { setForm({ priority: 'medium' }); setShowNew(true); setError(null); }}
            className="gap-2 bg-brand-primary hover:bg-brand-primary-hover text-white border-none shadow-xl shadow-emerald-500/20 rounded-2xl h-11 sm:h-14 px-4 sm:px-6 font-black uppercase text-[10px] tracking-widest mt-3 sm:mt-0"
          >
            <Plus size={14} /> {tab === 'tickets' ? 'New ticket' : 'New request'}
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2">
        {([
          { key: 'tickets' as const, label: 'My tickets', icon: MessageSquare },
          { key: 'legal' as const, label: 'Copyright & data requests', icon: Scale }
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setNotice(null); setError(null); }}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-xs transition-all border cursor-pointer',
              tab === t.key
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent shadow-lg'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800'
            )}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {error && (
        <Card className="p-4 rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 flex items-start gap-3">
          <AlertTriangle size={18} className="text-red-500 mt-0.5 flex-none" />
          <p className="text-sm font-semibold text-red-800 dark:text-red-200">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600"><X size={16} /></button>
        </Card>
      )}
      {notice && (
        <Card className="p-4 rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30 flex items-center gap-3">
          <CheckCircle2 size={18} className="text-emerald-500 flex-none" />
          <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">{notice}</p>
          <button onClick={() => setNotice(null)} className="ml-auto text-emerald-500"><X size={16} /></button>
        </Card>
      )}

      {loading ? (
        <Card className="p-12 rounded-[2.5rem] border-none flex items-center justify-center gap-3">
          <Loader2 size={20} className="animate-spin text-emerald-500" />
          <span className="font-bold text-slate-500">Loading…</span>
        </Card>
      ) : tab === 'tickets' ? (
        tickets.length === 0 ? (
          <Card className="p-12 rounded-[2.5rem] border-none text-center">
            <LifeBuoy size={40} className="mx-auto text-slate-300 mb-4" />
            <h3 className="text-xl font-black text-slate-900 dark:text-white">No tickets yet</h3>
            <p className="text-slate-500 font-medium mt-2 max-w-md mx-auto">
              Stuck on something? Raise a ticket and our support team will pick it up.
            </p>
          </Card>
        ) : (
          <Card className="rounded-[2.5rem] border-none shadow-xl overflow-hidden">
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {tickets.map(t => (
                <li key={t.id}>
                  <button
                    onClick={() => setOpenTicket(t)}
                    className="w-full text-left px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors cursor-pointer"
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{t.title}</p>
                          <span className={cn('px-2 py-0.5 rounded-md text-[9px] font-black uppercase', STATUS_TONE[t.status])}>
                            {t.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 font-semibold mt-0.5">
                          {formatWhen(t.created_at)}
                          {(t.replies?.length ?? 0) > 0 && ` · ${t.replies!.length} repl${t.replies!.length === 1 ? 'y' : 'ies'}`}
                        </p>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        )
      ) : requests.length === 0 ? (
        <Card className="p-12 rounded-[2.5rem] border-none text-center">
          <Scale size={40} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-xl font-black text-slate-900 dark:text-white">No requests filed</h3>
          <p className="text-slate-500 font-medium mt-2 max-w-md mx-auto">
            Use this to report a copyright infringement, a terms violation, or to request a copy or
            deletion of your personal data.
          </p>
        </Card>
      ) : (
        <Card className="rounded-[2.5rem] border-none shadow-xl overflow-hidden">
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {requests.map(r => (
              <li key={r.id} className="px-6 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-sm text-slate-900 dark:text-white capitalize">
                        {r.type.replace(/_/g, ' ')}
                      </p>
                      <span className={cn('px-2 py-0.5 rounded-md text-[9px] font-black uppercase', STATUS_TONE[r.status])}>
                        {r.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    {r.details?.reason && <p className="text-sm text-slate-500 mt-1">{r.details.reason}</p>}
                    <p className="text-xs text-slate-400 font-semibold mt-1">{formatWhen(r.created_at)}</p>
                    {r.resolution_notes && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-900">
                        <span className="font-black uppercase text-[9px] text-slate-400 block mb-1">Outcome</span>
                        {r.resolution_notes}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Ticket thread */}
      {openTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <Card className="w-full max-w-2xl rounded-[2rem] border-none max-h-[88vh] flex flex-col">
            <div className="flex items-start justify-between gap-3 p-6 border-b border-slate-100 dark:border-slate-800">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">{openTicket.title}</h3>
                  <span className={cn('px-2 py-0.5 rounded-md text-[9px] font-black uppercase', STATUS_TONE[openTicket.status])}>
                    {openTicket.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <p className="text-xs font-bold text-slate-400 mt-0.5">{formatWhen(openTicket.created_at)}</p>
              </div>
              <button onClick={() => setOpenTicket(null)} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer flex-none" aria-label="Close">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">You wrote</p>
                <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {openTicket.description}
                </p>
              </div>

              {(openTicket.replies || []).map((r, i) => {
                const mine = r.sender_id === user?.id;
                return (
                  <div
                    key={i}
                    className={cn(
                      'p-4 rounded-2xl',
                      mine
                        ? 'bg-slate-50 dark:bg-slate-900'
                        : 'bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40'
                    )}
                  >
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      {mine ? 'You' : `${r.sender_name} · Support`} · {formatWhen(r.created_at)}
                    </p>
                    <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">{r.text}</p>
                  </div>
                );
              })}
            </div>

            <div className="p-6 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <textarea
                rows={3}
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                placeholder={openTicket.status === 'closed' ? 'Replying will reopen this ticket…' : 'Add to the conversation…'}
                className={inputClass + ' h-auto py-3 resize-y'}
              />
              <div className="flex gap-3">
                {openTicket.status !== 'closed' && (
                  <Button variant="outline" onClick={() => closeTicket(openTicket)} className="rounded-xl h-12 px-5 font-bold">
                    Mark resolved
                  </Button>
                )}
                <Button
                  onClick={sendReply}
                  disabled={!replyText.trim() || replying}
                  className="flex-1 rounded-xl h-12 bg-brand-primary text-white border-none font-bold gap-2"
                >
                  {replying ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                  Send reply
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* New ticket / request */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <Card className="w-full max-w-lg p-8 rounded-[2rem] border-none space-y-4 max-h-[88vh] overflow-y-auto">
            <h3 className="text-xl font-black text-slate-900 dark:text-white">
              {tab === 'tickets' ? 'Raise a support ticket' : 'File a request'}
            </h3>

            {tab === 'tickets' ? (
              <>
                <label className="block">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Subject</span>
                  <input
                    className={inputClass + ' mt-1'}
                    value={form.title || ''}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="I can't access a course I paid for"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">What happened?</span>
                  <textarea
                    rows={5}
                    className={inputClass + ' mt-1 h-auto py-3 resize-y'}
                    value={form.description || ''}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Include anything that would help us reproduce it — what you did, what you expected, and what happened instead."
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">How urgent is it?</span>
                  <select
                    className={inputClass + ' mt-1'}
                    value={form.priority || 'medium'}
                    onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                  >
                    <option value="low">Low — a question or suggestion</option>
                    <option value="medium">Medium — something is not working</option>
                    <option value="high">High — I am blocked</option>
                    <option value="urgent">Urgent — payment or access problem</option>
                  </select>
                </label>
              </>
            ) : (
              <>
                <label className="block">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Request type</span>
                  <select
                    className={inputClass + ' mt-1'}
                    value={form.type || 'copyright_claim'}
                    onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                  >
                    <option value="copyright_claim">Copyright infringement</option>
                    <option value="terms_violation">Terms of service violation</option>
                    <option value="gdpr_request">Personal data request (access or deletion)</option>
                  </select>
                </label>

                {form.type !== 'gdpr_request' && (
                  <label className="block">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Link to the content</span>
                    <input
                      className={inputClass + ' mt-1'}
                      value={form.url || ''}
                      onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                      placeholder="https://trileza.com/…"
                    />
                  </label>
                )}

                <label className="block">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {form.type === 'gdpr_request' ? 'What would you like us to do?' : 'Describe the issue'}
                  </span>
                  <textarea
                    rows={5}
                    className={inputClass + ' mt-1 h-auto py-3 resize-y'}
                    value={form.reason || ''}
                    onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                    placeholder={
                      form.type === 'gdpr_request'
                        ? 'For example: send me a copy of my data, or delete my account and all associated records.'
                        : 'Explain what has been infringed and how you know it is yours.'
                    }
                  />
                </label>

                {form.type === 'copyright_claim' && (
                  <p className="text-xs text-slate-400 leading-relaxed">
                    By filing this you confirm you are the rights holder or authorised to act for them,
                    and that the information you have given is accurate.
                  </p>
                )}
              </>
            )}

            <div className="flex gap-3 pt-1">
              <Button variant="outline" onClick={() => setShowNew(false)} className="flex-1 rounded-xl h-12 font-bold">Cancel</Button>
              <Button onClick={submit} disabled={!canSubmit || submitting} className="flex-1 rounded-xl h-12 bg-brand-primary text-white border-none font-bold">
                {submitting ? 'Sending…' : 'Submit'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Support;
