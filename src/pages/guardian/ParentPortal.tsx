import React, { useState, useEffect, useCallback } from 'react';
import { Heart, CalendarCheck, GraduationCap, Clock, AlertTriangle, Loader2, Megaphone, Lock } from 'lucide-react';
import PageHeader from '../../components/shared/PageHeader';
import { Card } from '../../components/ui';
import { useAuthStore } from '../../store/authStore';
import { useTenant } from '../../lib/tenantContext';
import { guardianService } from '../../lib/services/guardians';
import { schoolOpsService } from '../../lib/services/schoolOps';
import type { GuardianLink, ChildOverview, Announcement } from '../../types/school';
import { cn } from '../../utils';

const formatDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const formatDue = (iso?: string | null) => {
  if (!iso) return 'No deadline';
  const due = new Date(iso);
  const days = Math.ceil((due.getTime() - Date.now()) / 86_400_000);
  if (days < 0) return 'Overdue';
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `Due in ${days} days`;
};

/**
 * The parent portal: a read-only view of a child's attendance, grades and
 * upcoming work, plus school announcements.
 *
 * What a guardian may see is decided per link (can_view_grades /
 * can_view_attendance) and enforced in the database, not here — this page only
 * explains the gap when a panel is withheld.
 */
const ParentPortal: React.FC = () => {
  const { user } = useAuthStore();
  const { tenant } = useTenant();

  const [links, setLinks] = useState<GuardianLink[]>([]);
  const [activeChildId, setActiveChildId] = useState<string>('');
  const [overview, setOverview] = useState<ChildOverview | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    (async () => {
      try {
        const children = await guardianService.getChildren(user.id);
        if (cancelled) return;
        setLinks(children);
        if (children.length > 0) setActiveChildId(children[0].student_id);
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Could not load your children.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user?.id]);

  useEffect(() => {
    if (!tenant?.id) return;
    schoolOpsService
      .listAnnouncements(tenant.id, { limit: 5 })
      .then(setAnnouncements)
      .catch(() => setAnnouncements([]));
  }, [tenant?.id]);

  const loadChild = useCallback(async () => {
    const link = links.find(l => l.student_id === activeChildId);
    if (!link) return;
    setDetailLoading(true);
    try {
      setOverview(await guardianService.getChildOverview(link));
    } catch (err: any) {
      setError(err.message || 'Could not load that child’s record.');
    } finally {
      setDetailLoading(false);
    }
  }, [activeChildId, links]);

  useEffect(() => { if (activeChildId) loadChild(); }, [activeChildId, loadChild]);

  const activeLink = links.find(l => l.student_id === activeChildId);

  if (loading) {
    return (
      <div className="p-12 flex items-center justify-center gap-3">
        <Loader2 size={20} className="animate-spin text-emerald-500" />
        <span className="font-bold text-slate-500">Loading…</span>
      </div>
    );
  }

  return (
    <div className="w-full pb-20 space-y-8 animate-in fade-in duration-500">
      <PageHeader
        title={<span>Parent <span className="text-emerald-400">Portal</span></span>}
        description="Your child’s attendance, grades and upcoming work, kept up to date by their school."
        tag="Family"
        icon={Heart}
        variant="default"
      />

      {error && (
        <Card className="p-4 rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 flex items-start gap-3">
          <AlertTriangle size={18} className="text-red-500 mt-0.5 flex-none" />
          <p className="text-sm font-semibold text-red-800 dark:text-red-200">{error}</p>
        </Card>
      )}

      {links.length === 0 && !error && (
        <Card className="p-12 rounded-[2.5rem] border-none text-center">
          <Heart size={40} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-xl font-black text-slate-900 dark:text-white">No children linked yet</h3>
          <p className="text-slate-500 font-medium mt-2 max-w-md mx-auto">
            Your school links a parent account to a student. Contact the school office if you expected
            to see a child here.
          </p>
        </Card>
      )}

      {links.length > 1 && (
        <div className="flex flex-wrap gap-2 px-1">
          {links.map(l => (
            <button
              key={l.student_id}
              onClick={() => setActiveChildId(l.student_id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-xs transition-all border cursor-pointer',
                activeChildId === l.student_id
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent shadow-lg'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800'
              )}
            >
              {l.student_avatar
                ? <img src={l.student_avatar} alt="" className="w-5 h-5 rounded-full object-cover" />
                : null}
              {l.student_name}
            </button>
          ))}
        </div>
      )}

      {detailLoading && (
        <Card className="p-12 rounded-[2.5rem] border-none flex items-center justify-center gap-3">
          <Loader2 size={20} className="animate-spin text-emerald-500" />
          <span className="font-bold text-slate-500">Loading record…</span>
        </Card>
      )}

      {overview && !detailLoading && (
        <>
          {/* Headline figures */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="p-6 rounded-3xl border-none shadow-lg">
              <div className="flex items-center gap-2 mb-2">
                <CalendarCheck size={15} className="text-emerald-500" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Attendance</p>
              </div>
              {activeLink?.can_view_attendance === false ? (
                <p className="text-sm font-bold text-slate-400 flex items-center gap-1.5"><Lock size={13} /> Not shared</p>
              ) : (
                <p className={cn(
                  'text-3xl font-black tabular-nums',
                  overview.attendance_pct === null ? 'text-slate-300'
                    : overview.attendance_pct >= 90 ? 'text-emerald-600'
                    : overview.attendance_pct >= 80 ? 'text-amber-600' : 'text-red-600'
                )}>
                  {overview.attendance_pct === null ? '—' : `${overview.attendance_pct}%`}
                </p>
              )}
            </Card>

            <Card className="p-6 rounded-3xl border-none shadow-lg">
              <div className="flex items-center gap-2 mb-2">
                <GraduationCap size={15} className="text-indigo-500" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Grade average</p>
              </div>
              {activeLink?.can_view_grades === false ? (
                <p className="text-sm font-bold text-slate-400 flex items-center gap-1.5"><Lock size={13} /> Not shared</p>
              ) : (
                <p className="text-3xl font-black text-slate-900 dark:text-white tabular-nums">
                  {overview.average_grade_pct === null ? '—' : `${overview.average_grade_pct}%`}
                </p>
              )}
            </Card>

            <Card className="p-6 rounded-3xl border-none shadow-lg">
              <div className="flex items-center gap-2 mb-2">
                <Clock size={15} className="text-amber-500" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Work due</p>
              </div>
              <p className="text-3xl font-black text-slate-900 dark:text-white tabular-nums">{overview.upcoming.length}</p>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Upcoming work */}
            <Card className="rounded-[2rem] border-none shadow-xl overflow-hidden">
              <h3 className="font-black text-slate-900 dark:text-white px-6 py-4 border-b border-slate-100 dark:border-slate-800">
                Upcoming work
              </h3>
              {overview.upcoming.length === 0 ? (
                <p className="p-8 text-center text-sm text-slate-500 font-medium">Nothing due in the next fortnight.</p>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {overview.upcoming.map(a => (
                    <li key={a.id} className="px-6 py-4 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{a.title}</p>
                        <p className="text-xs text-slate-400 font-semibold">{a.class_name}</p>
                      </div>
                      <span className="text-xs font-black text-amber-600 flex-none">{formatDue(a.due_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {/* Recent grades */}
            <Card className="rounded-[2rem] border-none shadow-xl overflow-hidden">
              <h3 className="font-black text-slate-900 dark:text-white px-6 py-4 border-b border-slate-100 dark:border-slate-800">
                Recent grades
              </h3>
              {activeLink?.can_view_grades === false ? (
                <p className="p-8 text-center text-sm text-slate-500 font-medium flex items-center justify-center gap-2">
                  <Lock size={14} /> The school has not shared grades with you.
                </p>
              ) : overview.recent_grades.length === 0 ? (
                <p className="p-8 text-center text-sm text-slate-500 font-medium">No grades recorded yet.</p>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {overview.recent_grades.map((g, i) => {
                    const pct = g.score !== null && g.points_possible > 0
                      ? Math.round((g.score / g.points_possible) * 100)
                      : null;
                    return (
                      <li key={`${g.label}-${i}`} className="px-6 py-4 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{g.label}</p>
                          <p className="text-xs text-slate-400 font-semibold">{formatDate(g.recorded_at)}</p>
                        </div>
                        <span className="text-sm font-black text-slate-900 dark:text-white tabular-nums flex-none">
                          {g.score === null ? '—' : `${g.score}/${g.points_possible}`}
                          {pct !== null && <span className="text-slate-400 ml-2">{pct}%</span>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </div>

          {/* Classes */}
          <Card className="rounded-[2rem] border-none shadow-xl overflow-hidden">
            <h3 className="font-black text-slate-900 dark:text-white px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              {overview.student_name}’s classes
            </h3>
            {overview.classes.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-500 font-medium">Not enrolled in any classes yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {overview.classes.map(c => (
                  <li key={c.id} className="px-6 py-4 flex items-center justify-between gap-3">
                    <span className="font-bold text-sm text-slate-900 dark:text-white">{c.name}</span>
                    <span className="text-xs text-slate-400 font-semibold">{c.teacher || 'No teacher assigned'}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

      {/* School announcements */}
      {announcements.length > 0 && (
        <Card className="rounded-[2rem] border-none shadow-xl overflow-hidden">
          <h3 className="font-black text-slate-900 dark:text-white px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
            <Megaphone size={16} className="text-emerald-500" /> From the school
          </h3>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {announcements.map(a => (
              <li key={a.id} className="px-6 py-4">
                <div className="flex items-start gap-2">
                  {a.priority !== 'normal' && (
                    <span className={cn(
                      'px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wide flex-none mt-0.5',
                      a.priority === 'urgent'
                        ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
                    )}>
                      {a.priority}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-slate-900 dark:text-white">{a.title}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{a.body}</p>
                    <p className="text-xs text-slate-400 font-semibold mt-2">
                      {a.author_name} · {formatDate(a.publish_at)}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
};

export default ParentPortal;
