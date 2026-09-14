import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { CalendarCheck, Download, AlertTriangle, X, Loader2, Users } from 'lucide-react';
import PageHeader from '../../components/shared/PageHeader';
import { Card, Button } from '../../components/ui';
import { useAuthStore } from '../../store/authStore';
import { useTenant } from '../../lib/tenantContext';
import { classService, PERSISTENT_ABSENCE_THRESHOLD } from '../../lib/services/classes';
import { exportToCSV } from '../../components/admin/hooks/useExport';
import type { SchoolClass, ClassMember, AttendanceStatus, AttendanceSummary } from '../../types/school';
import { cn } from '../../utils';

const STATUS_OPTIONS: Array<{ value: AttendanceStatus; label: string; short: string; classes: string }> = [
  { value: 'present',    label: 'Present',    short: 'P', classes: 'bg-emerald-500 text-white border-emerald-500' },
  { value: 'late',       label: 'Late',       short: 'L', classes: 'bg-amber-500 text-white border-amber-500' },
  { value: 'absent',     label: 'Absent',     short: 'A', classes: 'bg-red-500 text-white border-red-500' },
  { value: 'excused',    label: 'Excused',    short: 'E', classes: 'bg-sky-500 text-white border-sky-500' },
  { value: 'left_early', label: 'Left early', short: 'X', classes: 'bg-purple-500 text-white border-purple-500' }
];

const todayISO = () => new Date().toISOString().slice(0, 10);

/**
 * The daily register. Distinct from live-session participation, which only
 * records who joined a video call.
 */
const AttendanceRegister: React.FC = () => {
  const { user } = useAuthStore();
  const { tenant } = useTenant();

  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [activeClassId, setActiveClassId] = useState('');
  const [sessionDate, setSessionDate] = useState(todayISO());
  const [roster, setRoster] = useState<ClassMember[]>([]);
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>({});
  const [summary, setSummary] = useState<AttendanceSummary[]>([]);
  const [view, setView] = useState<'register' | 'summary'>('register');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

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

  const loadDay = useCallback(async () => {
    if (!activeClassId) return;
    setLoading(true);
    setError(null);
    setSavedAt(null);
    try {
      const [rosterList, existing] = await Promise.all([
        classService.getRoster(activeClassId),
        classService.getRegister(activeClassId, sessionDate)
      ]);

      const students = rosterList.filter(m => m.role === 'student');
      setRoster(students);

      // Default everyone to present; a register is mostly presents, so this is
      // the fewest taps for the common case.
      const existingByStudent = new Map(existing.map(r => [r.student_id, r.status]));
      const next: Record<string, AttendanceStatus> = {};
      students.forEach(s => { next[s.user_id] = existingByStudent.get(s.user_id) || 'present'; });
      setMarks(next);
      if (existing.length > 0) setSavedAt('Loaded from a saved register');
    } catch (err: any) {
      setError(err.message || 'Could not load the register.');
    } finally {
      setLoading(false);
    }
  }, [activeClassId, sessionDate]);

  useEffect(() => { loadDay(); }, [loadDay]);

  const loadSummary = useCallback(async () => {
    if (!activeClassId) return;
    try {
      setSummary(await classService.getAttendanceSummary(activeClassId));
    } catch (err: any) {
      setError(err.message);
    }
  }, [activeClassId]);

  useEffect(() => { if (view === 'summary') loadSummary(); }, [view, loadSummary]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { present: 0, late: 0, absent: 0, excused: 0, left_early: 0 };
    Object.values(marks).forEach(s => { c[s] = (c[s] || 0) + 1; });
    return c;
  }, [marks]);

  const handleSave = async () => {
    if (!tenant?.id || !user?.id || roster.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      await classService.saveRegister({
        tenantId: tenant.id,
        classId: activeClassId,
        sessionDate,
        recordedBy: user.id,
        marks: roster.map(s => ({ student_id: s.user_id, status: marks[s.user_id] || 'present' }))
      });
      setSavedAt(`Saved at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
    } catch (err: any) {
      setError(err.message || 'Could not save the register.');
    } finally {
      setSaving(false);
    }
  };

  const markAll = (status: AttendanceStatus) => {
    const next: Record<string, AttendanceStatus> = {};
    roster.forEach(s => { next[s.user_id] = status; });
    setMarks(next);
  };

  const activeClass = classes.find(c => c.id === activeClassId);

  return (
    <div className="w-full pb-20 space-y-8 animate-in fade-in duration-500">
      <PageHeader
        title={<span>Attendance <span className="text-emerald-400">Register</span></span>}
        description="Take the daily register, review attendance rates, and spot persistent absence early."
        tag="Class management"
        icon={CalendarCheck}
        variant="mentor"
        rightContent={
          <div className="flex gap-2 mt-3 sm:mt-0">
            <Button
              variant="outline"
              onClick={() => setView(v => (v === 'register' ? 'summary' : 'register'))}
              className="gap-2 rounded-2xl h-11 sm:h-14 px-4 font-black uppercase text-[10px] tracking-widest"
            >
              {view === 'register' ? 'View rates' : 'Take register'}
            </Button>
            {view === 'register' && (
              <Button
                onClick={handleSave}
                disabled={saving || roster.length === 0}
                className="gap-2 bg-brand-primary hover:bg-brand-primary-hover text-white border-none shadow-xl shadow-emerald-500/20 rounded-2xl h-11 sm:h-14 px-4 sm:px-6 font-black uppercase text-[10px] tracking-widest"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <CalendarCheck size={14} />}
                {saving ? 'Saving' : 'Save'}
              </Button>
            )}
          </div>
        }
      />

      {/* Class + date */}
      <div className="flex flex-wrap items-center gap-3 px-1">
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
        {view === 'register' && (
          <input
            type="date"
            value={sessionDate}
            max={todayISO()}
            onChange={e => setSessionDate(e.target.value)}
            className="ml-auto h-11 px-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold text-xs focus:outline-none focus:border-emerald-500"
          />
        )}
      </div>

      {error && (
        <Card className="p-4 rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 flex items-start gap-3">
          <AlertTriangle size={18} className="text-red-500 mt-0.5 flex-none" />
          <p className="text-sm font-semibold text-red-800 dark:text-red-200">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600"><X size={16} /></button>
        </Card>
      )}

      {loading && (
        <Card className="p-12 rounded-[2.5rem] border-none flex items-center justify-center gap-3">
          <Loader2 size={20} className="animate-spin text-emerald-500" />
          <span className="font-bold text-slate-500">Loading…</span>
        </Card>
      )}

      {!loading && classes.length === 0 && (
        <Card className="p-12 rounded-[2.5rem] border-none text-center">
          <Users size={40} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-xl font-black text-slate-900 dark:text-white">No classes yet</h3>
          <p className="text-slate-500 font-medium mt-2">Create a class and add students before taking a register.</p>
        </Card>
      )}

      {/* Register */}
      {!loading && view === 'register' && roster.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map(opt => (
                <span key={opt.value} className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 tabular-nums">
                  {opt.label} <span className="text-slate-900 dark:text-white ml-1">{counts[opt.value] || 0}</span>
                </span>
              ))}
            </div>
            <button
              onClick={() => markAll('present')}
              className="ml-auto text-xs font-black uppercase tracking-widest text-emerald-600 hover:text-emerald-700 cursor-pointer"
            >
              Mark all present
            </button>
          </div>

          <Card className="rounded-[2.5rem] border-none shadow-xl overflow-hidden">
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {roster.map(student => (
                <li key={student.user_id} className="flex flex-wrap items-center gap-4 px-6 py-4">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {student.avatar_url
                      ? <img src={student.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover flex-none" />
                      : <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-xs font-black text-slate-500 flex-none">
                          {(student.full_name || '?').charAt(0).toUpperCase()}
                        </div>}
                    <span className="font-bold text-sm text-slate-900 dark:text-white truncate">{student.full_name}</span>
                  </div>

                  <div className="flex gap-1.5 flex-wrap">
                    {STATUS_OPTIONS.map(opt => {
                      const selected = marks[student.user_id] === opt.value;
                      return (
                        <button
                          key={opt.value}
                          onClick={() => setMarks(m => ({ ...m, [student.user_id]: opt.value }))}
                          title={opt.label}
                          aria-label={`${student.full_name}: ${opt.label}`}
                          aria-pressed={selected}
                          className={cn(
                            'w-9 h-9 rounded-xl border-2 font-black text-xs transition-all cursor-pointer',
                            selected
                              ? opt.classes
                              : 'bg-transparent border-slate-200 dark:border-slate-700 text-slate-400 hover:border-slate-400'
                          )}
                        >
                          {opt.short}
                        </button>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ul>
            {savedAt && (
              <p className="px-6 py-3 text-xs font-bold text-emerald-600 border-t border-slate-100 dark:border-slate-800">{savedAt}</p>
            )}
          </Card>
        </>
      )}

      {/* Rates */}
      {!loading && view === 'summary' && (
        <Card className="rounded-[2.5rem] border-none shadow-xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-black text-slate-900 dark:text-white">Attendance rates</h3>
            <Button
              variant="outline"
              size="sm"
              disabled={summary.length === 0}
              onClick={() => exportToCSV(
                summary,
                [
                  { key: 'student_name', header: 'Student' },
                  { key: 'present', header: 'Present' },
                  { key: 'late', header: 'Late' },
                  { key: 'absent', header: 'Absent' },
                  { key: 'excused', header: 'Excused' },
                  { key: 'total', header: 'Sessions' },
                  { key: 'attendance_pct', header: 'Attendance %' }
                ],
                `attendance_${activeClass?.name?.replace(/\s+/g, '_') || 'class'}`
              )}
              className="gap-2 rounded-xl text-[10px] font-black uppercase"
            >
              <Download size={13} /> Export
            </Button>
          </div>

          {summary.length === 0 ? (
            <p className="p-12 text-center text-slate-500 font-medium">
              No register has been taken for this class yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[560px]">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900/60">
                    {['Student', 'Present', 'Late', 'Absent', 'Excused', 'Rate'].map(h => (
                      <th key={h} className={cn(
                        'px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400',
                        h === 'Student' ? 'text-left' : 'text-center'
                      )}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {summary.map(s => (
                    <tr key={s.student_id} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-5 py-3 font-bold text-sm text-slate-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          {s.student_name}
                          {s.is_persistently_absent && (
                            <span className="px-2 py-0.5 rounded-md bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400 text-[9px] font-black uppercase tracking-wide">
                              Persistent absence
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-center text-sm font-bold text-slate-600 dark:text-slate-300 tabular-nums">{s.present}</td>
                      <td className="px-5 py-3 text-center text-sm font-bold text-amber-600 tabular-nums">{s.late}</td>
                      <td className="px-5 py-3 text-center text-sm font-bold text-red-600 tabular-nums">{s.absent}</td>
                      <td className="px-5 py-3 text-center text-sm font-bold text-sky-600 tabular-nums">{s.excused}</td>
                      <td className="px-5 py-3 text-center">
                        <span className={cn(
                          'px-2.5 py-1 rounded-lg text-xs font-black tabular-nums',
                          s.attendance_pct >= PERSISTENT_ABSENCE_THRESHOLD
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                            : s.attendance_pct >= 80
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
                              : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'
                        )}>
                          {s.attendance_pct}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};

export default AttendanceRegister;
