import React, { useCallback, useEffect, useState } from 'react';
import {
  Building2, FileText, ExternalLink, ShieldCheck, ShieldAlert,
  MessageSquareWarning, Loader2, CheckCircle2, RefreshCcw
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

import { Card, Button } from '../ui';
import { useAuthStore } from '../../store/authStore';
import { institutionKycService } from '../../lib/services/institutionKyc';
import { KYC_SECTIONS } from '../../types/institutionKyc';
import type { InstitutionKyc } from '../../types/institutionKyc';

/**
 * The institutional KYC review queue.
 *
 * Submissions here decide whether an institution may operate on the platform,
 * so the panel is built around three things a reviewer actually needs: the
 * declared details laid out section by section, the evidence behind them, and a
 * decision that cannot be recorded without a reason.
 *
 * Documents are opened through short-lived signed URLs generated on click. The
 * bucket is private and the stored paths are not URLs — a reviewer's open tab
 * stops working shortly after they close the case, which is the intent.
 */

const STATUS_STYLES: Record<string, string> = {
  submitted: 'bg-blue-50 text-blue-700 border-blue-200',
  in_review: 'bg-amber-50 text-amber-700 border-amber-200',
  info_requested: 'bg-purple-50 text-purple-700 border-purple-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-rose-50 text-rose-700 border-rose-200'
};

const STATUS_LABELS: Record<string, string> = {
  submitted: 'Awaiting review',
  in_review: 'In review',
  info_requested: 'Info requested',
  approved: 'Approved',
  rejected: 'Rejected'
};

const InstitutionKycQueue: React.FC = () => {
  const { user } = useAuthStore();

  const [records, setRecords] = useState<InstitutionKyc[]>([]);
  const [selected, setSelected] = useState<InstitutionKyc | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [notes, setNotes] = useState('');
  const [infoRequest, setInfoRequest] = useState('');
  const [risk, setRisk] = useState<'low' | 'medium' | 'high'>('low');
  const [message, setMessage] = useState<{ text: string; kind: 'ok' | 'err' } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRecords(await institutionKycService.listForReview());
    } catch (err: any) {
      setMessage({ text: err?.message || 'Could not load the queue.', kind: 'err' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openDocument = async (path: string) => {
    try {
      const url = await institutionKycService.downloadDocument(path);
      window.open(url, '_blank', 'noopener,noreferrer');
      // The new tab has the blob by now; releasing it here keeps the reviewer's
      // session from accumulating passports in memory for its whole lifetime.
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err: any) {
      setMessage({ text: err?.message || 'Could not open that document.', kind: 'err' });
    }
  };

  const decide = async (status: 'in_review' | 'info_requested' | 'approved' | 'rejected') => {
    if (!selected || !user?.id) return;

    setWorking(true);
    setMessage(null);
    try {
      await institutionKycService.review({
        recordId: selected.id,
        reviewerId: user.id,
        status,
        notes,
        infoRequested: infoRequest,
        riskRating: risk
      });
      setSelected(null);
      setNotes('');
      setInfoRequest('');
      await load();
      setMessage({ text: `Application marked ${STATUS_LABELS[status].toLowerCase()}.`, kind: 'ok' });
    } catch (err: any) {
      setMessage({ text: err?.message || 'Could not record that decision.', kind: 'err' });
    } finally {
      setWorking(false);
    }
  };

  // ── Detail view ───────────────────────────────────────────────────────────
  if (selected) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-lg font-black text-slate-900 truncate">{selected.legal_name}</h3>
            <p className="text-xs text-slate-500 font-semibold mt-0.5">
              {selected.country_of_incorporation || 'Country not stated'}
              {selected.registration_number && ` · Reg. ${selected.registration_number}`}
            </p>
          </div>
          <Button
            onClick={() => setSelected(null)}
            variant="outline"
            className="h-10 rounded-xl border-slate-200 text-slate-700 font-bold text-xs"
          >
            ← Back to queue
          </Button>
        </div>

        {message && (
          <div
            role="alert"
            className={`p-3.5 rounded-xl text-sm font-semibold border ${
              message.kind === 'ok'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Declared details, in the order the applicant gave them. */}
        <div className="grid gap-5">
          {KYC_SECTIONS.map(section => {
            const data = ((selected as any)[section.column] || {}) as Record<string, any>;
            const entries = section.fields
              .filter(f => f.type !== 'file')
              .map(f => [f.label, data[f.key]] as const)
              .filter(([, v]) => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && !v.length));

            if (entries.length === 0) return null;

            return (
              <Card key={section.id} className="p-5 bg-white border-slate-200/60 rounded-2xl shadow-sm">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">
                  {section.title}
                </h4>
                <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
                  {entries.map(([label, value]) => (
                    <div key={label} className="min-w-0">
                      <dt className="text-[11px] font-bold text-slate-400">{label}</dt>
                      <dd className="text-sm font-semibold text-slate-900 break-words">
                        {typeof value === 'boolean'
                          ? (value ? 'Yes' : 'No')
                          : Array.isArray(value) ? value.join(', ') : String(value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </Card>
            );
          })}

          {/* Evidence */}
          <Card className="p-5 bg-white border-slate-200/60 rounded-2xl shadow-sm">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">
              Supporting documents ({selected.documents?.length || 0})
            </h4>
            {!selected.documents?.length ? (
              <p className="text-sm text-slate-500 font-semibold">No documents were attached.</p>
            ) : (
              <ul className="grid sm:grid-cols-2 gap-2">
                {selected.documents.map(doc => (
                  <li key={doc.path}>
                    <button
                      onClick={() => openDocument(doc.path)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-purple-300 hover:bg-purple-50/40 transition-colors text-left cursor-pointer"
                    >
                      <FileText size={16} className="text-slate-400 shrink-0" aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-bold text-slate-900 truncate">{doc.name}</span>
                        <span className="block text-[10px] text-slate-400 font-semibold">{doc.kind}</span>
                      </span>
                      <ExternalLink size={13} className="text-slate-400 shrink-0" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* Decision */}
        <Card className="p-5 bg-white border-slate-200/60 rounded-2xl shadow-sm space-y-5">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Decision</h4>

          <div>
            <label className="text-[11px] font-black uppercase tracking-wider text-slate-600 block mb-2">
              Risk rating
            </label>
            <div className="flex gap-2" role="group" aria-label="Risk rating">
              {(['low', 'medium', 'high'] as const).map(level => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setRisk(level)}
                  aria-pressed={risk === level}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider border transition-colors cursor-pointer ${
                    risk === level
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="kyc-notes" className="text-[11px] font-black uppercase tracking-wider text-slate-600 block mb-2">
              Review notes
            </label>
            <textarea
              id="kyc-notes"
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="What you checked and what you concluded. Required to reject."
              className="w-full p-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/15 resize-y"
            />
          </div>

          <div>
            <label htmlFor="kyc-info" className="text-[11px] font-black uppercase tracking-wider text-slate-600 block mb-2">
              Request more information
            </label>
            <textarea
              id="kyc-info"
              rows={2}
              value={infoRequest}
              onChange={e => setInfoRequest(e.target.value)}
              placeholder="Shown to the applicant verbatim — be specific about what is missing."
              className="w-full p-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/15 resize-y"
            />
          </div>

          <div className="flex flex-wrap gap-3 pt-1">
            <Button
              onClick={() => decide('in_review')}
              disabled={working}
              variant="outline"
              className="h-11 rounded-xl border-slate-200 text-slate-700 font-bold text-xs"
            >
              Mark in review
            </Button>
            <Button
              onClick={() => decide('info_requested')}
              disabled={working || !infoRequest.trim()}
              variant="outline"
              className="h-11 rounded-xl border-purple-200 text-purple-700 font-bold text-xs flex items-center gap-2"
            >
              <MessageSquareWarning size={14} aria-hidden="true" /> Request info
            </Button>
            <Button
              onClick={() => decide('rejected')}
              disabled={working || !notes.trim()}
              className="h-11 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-2"
            >
              <ShieldAlert size={14} aria-hidden="true" /> Reject
            </Button>
            <Button
              onClick={() => decide('approved')}
              disabled={working}
              className="h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2"
            >
              {working
                ? <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                : <ShieldCheck size={14} aria-hidden="true" />}
              Approve
            </Button>
          </div>
          <p className="text-[11px] text-slate-400 font-semibold">
            Approval verifies the institution for 24 months. It does not create their portal —
            that happens when they complete payment.
          </p>
        </Card>
      </div>
    );
  }

  // ── Queue ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">
          Institution verification queue ({records.length})
        </h3>
        <Button
          onClick={load}
          variant="outline"
          className="h-9 rounded-xl border-slate-200 text-slate-600 font-bold text-xs flex items-center gap-2"
        >
          <RefreshCcw size={13} aria-hidden="true" /> Refresh
        </Button>
      </div>

      {message && (
        <div
          role="status"
          className={`p-3.5 rounded-xl text-sm font-semibold border ${
            message.kind === 'ok'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {loading ? (
        <Card className="p-12 text-center border-slate-200 bg-white shadow-sm">
          <p className="text-slate-400 font-bold uppercase tracking-wider text-xs">Loading verification queue…</p>
        </Card>
      ) : records.length === 0 ? (
        <Card className="p-12 text-center border-slate-200 bg-white rounded-2xl shadow-sm">
          <CheckCircle2 size={36} className="text-emerald-500 mx-auto mb-3" aria-hidden="true" />
          <h4 className="font-extrabold text-slate-800 text-base">Nothing awaiting verification</h4>
          <p className="text-xs text-slate-500 mt-1">Submitted institutions will appear here.</p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {records.map(rec => (
            <Card
              key={rec.id}
              onClick={() => { setSelected(rec); setNotes(''); setInfoRequest(''); setRisk(rec.risk_rating || 'low'); setMessage(null); }}
              className="p-5 bg-white border border-slate-200/60 hover:border-purple-300 rounded-2xl cursor-pointer shadow-sm transition-all flex items-center gap-4"
            >
              <span className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                <Building2 size={18} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <h4 className="font-extrabold text-sm text-slate-900 truncate">{rec.legal_name}</h4>
                <p className="text-xs text-slate-500 font-semibold truncate">
                  {rec.country_of_incorporation || 'Country not stated'}
                  {rec.submitted_at && ` · submitted ${formatDistanceToNow(new Date(rec.submitted_at), { addSuffix: true })}`}
                </p>
              </div>
              <span
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border shrink-0 ${
                  STATUS_STYLES[rec.status] || 'bg-slate-50 text-slate-600 border-slate-200'
                }`}
              >
                {STATUS_LABELS[rec.status] || rec.status}
              </span>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default InstitutionKycQueue;
