import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert, Download, Loader2, AlertTriangle, X, ArrowLeft,
  CalendarCheck, Award, ClipboardList, MessageSquarePlus, Heart, Trash2
} from 'lucide-react';
import PageHeader from '../../components/shared/PageHeader';
import { Card, Button } from '../../components/ui';
import { useAuthStore } from '../../store/authStore';
import { useTenant } from '../../lib/tenantContext';
import { classService } from '../../lib/services/classes';
import { gradebookService } from '../../lib/services/gradebook';
import { schoolOpsService } from '../../lib/services/schoolOps';
import { guardianService } from '../../lib/services/guardians';
import { exportToCSV } from '../../components/admin/hooks/useExport';
import type {
  SchoolClass, RiskSignal, BehaviourLog, GuardianLink, AttendanceSummary
} from '../../types/school';
import { cn } from '../../utils';

const BAND_STYLES: Record<RiskSignal['band'], { chip: string; bar: string; label: string }> = {
  high:   { chip: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',        bar: 'bg-red-500',     label: 'High' },
  medium: { chip: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400', bar: 'bg-amber-500',   label: 'Medium' },
  low:    { chip: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400', bar: 'bg-emerald-500', label: 'Low' }
};

const BEHAVIOUR_KINDS = ['note', 'positive', 'concern', 'incident', 'wellbeing', 'intervention'] as const;

const inputClass =
  'w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-semibold focus:outline-none focus:border-emerald-500';

const formatDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

/**
 * Early warning and the student record behind it.
 *
 * The risk score combines attendance, grade average, missing work and
 * inactivity — and always shows the reasons, because a number on its own tells
 * a form tutor nothing about what to do next.
 */
const StudentInsights: React.FC = () => {
  const { user } = useAuthStore();
  const { tenant } = useTenant();

  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [activeClassId, setActiveClassId] = useState('');
  const [signals, setSignals] = useState<RiskSignal[]>([]);
  const [attendance, setAttendance] = useState<AttendanceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Drill-down
  const [selected, setSelected] = useState<RiskSignal | null>(null);
  const [logs, setLogs] = useState<BehaviourLog[]>([]);
  const [guardians, setGuardians] = useState<GuardianLink[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Logging a pastoral note
  const [showLog, setShowLog] = useState(false);
  const [logForm, setLogForm] = useState<Record<string, any>>({ kind: 'note', severity: 'low' });
  const [savingLog, setSavingLog] = useState(false);

  useEffect(() => {
    if (!user?.id || !tenant?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await classService.listClasses(tenant.id, { teacherId: user.id });
        if (cancelled) return;
        setClasses(list);
        if (list.length > 0) setActiveClassId(prev => prev || list[0].id);
        else setLoading(false);
      } catch (err: any) {
        if (!cancelled) { setError(err.message); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, tenant?.id]);

  const load = useCallback(async () => {
    if (!activeClassId) return;
    setLoading(true);
    setError(null);
    try {
      const [risk, att] = await Promise.all([
        gradebookService.getRiskSignals(activeClassId),
        classService.getAttendanceSummary(activeClassId)
      ]);
      setSignals(risk);
      setAttendance(att);
    } catch (err: any) {
      setError(err.message || 'Could not load student insights.');
    } finally {
      setLoading(false);
    }
  }, [activeClassId]);

  useEffect(() => { load(); }, [load]);

  const openStudent = async (signal: RiskSignal) => {
    setSelected(signal);
    setDetailLoading(true);
    try {
      const [behaviour, guardianLinks] = await Promise.all([
        schoolOpsService.listBehaviourLogs({ studentId: signal.student_id, limit: 20 }),
        guardianService.getGuardiansOf(signal.student_id)
      ]);
      setLogs(behaviour);
      setGuardians(guardianLinks);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDetailLoading(false);
    }
  };

  const saveLog = async () => {
    if (!selected || !user?.id || !tenant?.id || !logForm.title?.trim()) return;
    setSavingLog(true);
    try {
      await schoolOpsService.logBehaviour({
        tenant_id: tenant.id,
        student_id: selected.student_id,
        class_id: activeClassId,
        logged_by: user.id,
        kind: logForm.kind,
        severity: logForm.severity,
        title: logForm.title.trim(),
        detail: logForm.detail?.trim() || null,
        action_taken: logForm.action_taken?.trim() || null,
        is_confidential: Boolean(logForm.is_confidential)
      });
      setShowLog(false);
      setLogForm({ kind: 'note', severity: 'low' });
      openStudent(selected);
    } catch (err: any) {
      setError(err.message || 'Could not save that record.');
    } finally {
      setSavingLog(false);
    }
  };

  const highCount = signals.filter(s => s.band === 'high').length;
  const mediumCount = signals.filter(s => s.band === 'medium').length;

  // ─── Student detail view ────────────────────────────────────────────────
  if (selected) {
    const att = attendance.find(a => a.student_id === selected.student_id);
    return (
      <div className="w-full pb-20 space-y-6 animate-in fade-in duration-500">
        <button
          onClick={() => { setSelected(null); setLogs([]); setGuardians([]); }}
          className="flex items-center gap-2 text-emerald-600 font-bold text-xs uppercase tracking-widest hover:text-emerald-700 cursor-pointer"
        >
          <ArrowLeft size={14} /> Back to class
        </button>

        <Card className="p-8 rounded-[2.5rem] border-none shadow-xl">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              {selected.avatar_url
                ? <img src={selected.avatar_url} alt="" className="w-16 h-16 rounded-2xl object-cover" />
                : <div className="w-16 h-16 rounded-2xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-xl font-black text-slate-500">
                    {selected.student_name.charAt(0).toUpperCase()}
                  </div>}
              <div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">{selected.student_name}</h2>
                <span className={cn('inline-block mt-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase', BAND_STYLES[selected.band].chip)}>
                  {BAND_STYLES[selected.band].label} risk · {selected.risk_score}/100
                </span>
              </div>
            </div>
            <Button onClick={() => setShowLog(true)} className="gap-2 rounded-2xl h-12 px-5 bg-brand-primary text-white border-none font-black uppercase text-[10px] tracking-widest">
              <MessageSquarePlus size={14} /> Log a note
            </Button>
          </div>

          {selected.reasons.length > 0 && (
            <div className="mt-6 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Why this student is flagged</p>
              <ul className="space-y-1">
                {selected.reasons.map((r, i) => (
                  <li key={i} className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-start gap-2">
                    <span className="text-amber-500 mt-0.5">•</span> {r}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: CalendarCheck, label: 'Attendance', value: selected.attendance_pct === null ? '—' : `${selected.attendance_pct}%` },
            { icon: Award, label: 'Grade average', value: selected.average_grade_pct === null ? '—' : `${selected.average_grade_pct}%` },
            { icon: ClipboardList, label: 'Missing work', value: selected.missing_assignments },
            { icon: CalendarCheck, label: 'Sessions', value: att?.total ?? 0 }
          ].map(tile => (
            <Card key={tile.label} className="p-5 rounded-3xl border-none shadow-lg">
              <tile.icon size={15} className="text-slate-400 mb-2" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{tile.label}</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-1 tabular-nums">{tile.value}</p>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pastoral log */}
          <Card className="rounded-[2rem] border-none shadow-xl overflow-hidden">
            <h3 className="font-black text-slate-900 dark:text-white px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              Pastoral record
            </h3>
            {detailLoading ? (
              <div className="p-8 flex justify-center"><Loader2 size={18} className="animate-spin text-emerald-500" /></div>
            ) : logs.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-500 font-medium">Nothing logged for this student.</p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[420px] overflow-y-auto">
                {logs.map(l => (
                  <li key={l.id} className="px-6 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-sm text-slate-900 dark:text-white">{l.title}</p>
                          <span className={cn(
                            'px-2 py-0.5 rounded-md text-[9px] font-black uppercase',
                            l.kind === 'positive' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                              : l.severity === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                          )}>{l.kind}</span>
                          {l.is_confidential && (
                            <span className="px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-400 text-[9px] font-black uppercase">
                              Confidential
                            </span>
                          )}
                        </div>
                        {l.detail && <p className="text-sm text-slate-500 mt-1 leading-relaxed">{l.detail}</p>}
                        {l.action_taken && (
                          <p className="text-xs text-slate-400 mt-1"><span className="font-black uppercase">Action:</span> {l.action_taken}</p>
                        )}
                        <p className="text-xs text-slate-400 font-semibold mt-2">{l.logged_by_name} · {formatDate(l.created_at)}</p>
                      </div>
                      <button
                        onClick={async () => { await schoolOpsService.resolveBehaviourLog(l.id); openStudent(selected); }}
                        className="text-slate-300 hover:text-emerald-500 p-1 flex-none cursor-pointer"
                        title="Mark as closed"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Guardians */}
          <Card className="rounded-[2rem] border-none shadow-xl overflow-hidden">
            <h3 className="font-black text-slate-900 dark:text-white px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <Heart size={15} className="text-rose-500" /> Parents & guardians
            </h3>
            {guardians.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-500 font-medium">
                No guardian linked. The school office can link a parent account to this student.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {guardians.map(g => (
                  <li key={g.id} className="px-6 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{g.guardian_name}</p>
                        <p className="text-xs text-slate-400 font-semibold truncate">{g.guardian_email}</p>
                      </div>
                      <div className="flex gap-1.5 flex-none">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[9px] font-black uppercase text-slate-600 dark:text-slate-300">
                          {g.relationship}
                        </span>
                        {g.is_primary && (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 text-[9px] font-black uppercase">
                            Primary
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* Log a note */}
        {showLog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
            <Card className="w-full max-w-md p-8 rounded-[2rem] border-none space-y-4 max-h-[88vh] overflow-y-auto">
              <h3 className="text-xl font-black text-slate-900 dark:text-white">Log a record for {selected.student_name}</h3>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kind</span>
                  <select className={inputClass + ' mt-1'} value={logForm.kind} onChange={e => setLogForm(f => ({ ...f, kind: e.target.value }))}>
                    {BEHAVIOUR_KINDS.map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Severity</span>
                  <select className={inputClass + ' mt-1'} value={logForm.severity} onChange={e => setLogForm(f => ({ ...f, severity: e.target.value }))}>
                    {['low', 'medium', 'high'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Summary</span>
                <input className={inputClass + ' mt-1'} value={logForm.title || ''} onChange={e => setLogForm(f => ({ ...f, title: e.target.value }))} />
              </label>

              <label className="block">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Detail</span>
                <textarea rows={3} className={inputClass + ' mt-1 h-auto py-3 resize-y'} value={logForm.detail || ''} onChange={e => setLogForm(f => ({ ...f, detail: e.target.value }))} />
              </label>

              <label className="block">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Action taken</span>
                <input className={inputClass + ' mt-1'} value={logForm.action_taken || ''} onChange={e => setLogForm(f => ({ ...f, action_taken: e.target.value }))} />
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(logForm.is_confidential)}
                  onChange={e => setLogForm(f => ({ ...f, is_confidential: e.target.checked }))}
                  className="w-4 h-4 accent-emerald-500"
                />
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  Confidential — visible only to you and safeguarding leads
                </span>
              </label>

              <div className="flex gap-3 pt-1">
                <Button variant="outline" onClick={() => setShowLog(false)} className="flex-1 rounded-xl h-12 font-bold">Cancel</Button>
                <Button onClick={saveLog} disabled={!logForm.title?.trim() || savingLog} className="flex-1 rounded-xl h-12 bg-brand-primary text-white border-none font-bold">
                  {savingLog ? 'Saving…' : 'Save record'}
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    );
  }

  // ─── Class overview ─────────────────────────────────────────────────────
  return (
    <div className="w-full pb-20 space-y-8 animate-in fade-in duration-500">
      <PageHeader
        title={<span>Student <span className="text-emerald-400">Insights</span></span>}
        description="Who needs attention, and why. Combines attendance, grades, missing work and inactivity."
        tag="Early warning"
        icon={ShieldAlert}
        variant="mentor"
        rightContent={
          <Button
            onClick={() => exportToCSV(
              signals.map(s => ({
                student: s.student_name,
                risk: s.risk_score,
                band: s.band,
                attendance: s.attendance_pct ?? '',
                average: s.average_grade_pct ?? '',
                missing: s.missing_assignments,
                reasons: s.reasons.join('; ')
              })),
              [
                { key: 'student', header: 'Student' },
                { key: 'risk', header: 'Risk score' },
                { key: 'band', header: 'Band' },
                { key: 'attendance', header: 'Attendance %' },
                { key: 'average', header: 'Average %' },
                { key: 'missing', header: 'Missing work' },
                { key: 'reasons', header: 'Reasons' }
              ],
              'student_risk_report'
            )}
            disabled={signals.length === 0}
            className="gap-2 bg-brand-primary text-white border-none shadow-xl shadow-emerald-500/20 rounded-2xl h-11 sm:h-14 px-4 sm:px-6 font-black uppercase text-[10px] tracking-widest mt-3 sm:mt-0"
          >
            <Download size={14} /> Export
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2 px-1">
        {classes.map(c => (
          <button
            key={c.id}
            onClick={() => setActiveClassId(c.id)}
            className={cn(
              'px-4 py-2.5 rounded-2xl font-bold text-xs transition-all border cursor-pointer',
              activeClassId === c.id
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent shadow-lg'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800'
            )}
          >
            {c.name}
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

      {!loading && signals.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'High risk', value: highCount, tone: 'text-red-600' },
            { label: 'Medium risk', value: mediumCount, tone: 'text-amber-600' },
            { label: 'On track', value: signals.length - highCount - mediumCount, tone: 'text-emerald-600' }
          ].map(t => (
            <Card key={t.label} className="p-5 rounded-3xl border-none shadow-lg">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t.label}</p>
              <p className={cn('text-3xl font-black mt-1 tabular-nums', t.tone)}>{t.value}</p>
            </Card>
          ))}
        </div>
      )}

      {loading ? (
        <Card className="p-12 rounded-[2.5rem] border-none flex items-center justify-center gap-3">
          <Loader2 size={20} className="animate-spin text-emerald-500" />
          <span className="font-bold text-slate-500">Analysing…</span>
        </Card>
      ) : classes.length === 0 ? (
        <Card className="p-12 rounded-[2.5rem] border-none text-center">
          <ShieldAlert size={40} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-xl font-black text-slate-900 dark:text-white">No classes yet</h3>
          <p className="text-slate-500 font-medium mt-2">Create a class and add students to see insights.</p>
        </Card>
      ) : signals.length === 0 ? (
        <Card className="p-12 rounded-[2.5rem] border-none text-center">
          <h3 className="text-xl font-black text-slate-900 dark:text-white">Nothing to analyse yet</h3>
          <p className="text-slate-500 font-medium mt-2 max-w-md mx-auto">
            Risk scores need attendance records or grades to work from. Take a register or mark some
            work, and this fills in.
          </p>
        </Card>
      ) : (
        <Card className="rounded-[2.5rem] border-none shadow-xl overflow-hidden">
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {signals.map(s => (
              <li key={s.student_id}>
                <button
                  onClick={() => openStudent(s)}
                  className="w-full text-left px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors cursor-pointer"
                >
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {s.avatar_url
                        ? <img src={s.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover flex-none" />
                        : <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-sm font-black text-slate-500 flex-none">
                            {s.student_name.charAt(0).toUpperCase()}
                          </div>}
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{s.student_name}</p>
                        <p className="text-xs text-slate-400 font-semibold truncate">
                          {s.reasons.length > 0 ? s.reasons.join(' · ') : 'No concerns flagged'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-none">
                      <div className="w-24 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div className={cn('h-full rounded-full', BAND_STYLES[s.band].bar)} style={{ width: `${s.risk_score}%` }} />
                      </div>
                      <span className={cn('px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tabular-nums w-20 text-center', BAND_STYLES[s.band].chip)}>
                        {s.risk_score}
                      </span>
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
};

export default StudentInsights;
