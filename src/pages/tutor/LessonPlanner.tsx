import React, { useState, useEffect, useCallback } from 'react';
import {
  NotebookPen, Plus, Trash2, X, Loader2, AlertTriangle, Share2, Clock, Target, GripVertical
} from 'lucide-react';
import PageHeader from '../../components/shared/PageHeader';
import { Card, Button } from '../../components/ui';
import { useAuthStore } from '../../store/authStore';
import { useTenant } from '../../lib/tenantContext';
import { schoolOpsService } from '../../lib/services/schoolOps';
import { classService } from '../../lib/services/classes';
import type { LessonPlan, SchoolClass, CurriculumStandard } from '../../types/school';
import { cn } from '../../utils';

const inputClass =
  'w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-semibold focus:outline-none focus:border-emerald-500';

interface Activity { title: string; minutes?: number; detail?: string }

const formatDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' }) : 'Unscheduled';

/**
 * Lesson planning: objectives, materials, a timed activity sequence,
 * differentiation notes, and alignment to curriculum standards.
 */
const LessonPlanner: React.FC = () => {
  const { user } = useAuthStore();
  const { tenant } = useTenant();

  const [plans, setPlans] = useState<LessonPlan[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [standards, setStandards] = useState<CurriculumStandard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMine, setShowMine] = useState(true);

  const [editing, setEditing] = useState<Partial<LessonPlan> | null>(null);
  const [saving, setSaving] = useState(false);
  const [objectiveDraft, setObjectiveDraft] = useState('');
  const [materialDraft, setMaterialDraft] = useState('');

  const load = useCallback(async () => {
    if (!tenant?.id || !user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const [planList, classList, standardList] = await Promise.all([
        schoolOpsService.listLessonPlans(tenant.id, showMine ? user.id : undefined),
        classService.listClasses(tenant.id, { teacherId: user.id }),
        schoolOpsService.listStandards(tenant.id).catch(() => [])
      ]);
      setPlans(planList);
      setClasses(classList);
      setStandards(standardList);
    } catch (err: any) {
      setError(err.message || 'Could not load lesson plans.');
    } finally {
      setLoading(false);
    }
  }, [tenant?.id, user?.id, showMine]);

  useEffect(() => { load(); }, [load]);

  const startNew = () => setEditing({
    title: '', objectives: [], materials: [], activities: [], standard_ids: [], is_shared: false
  });

  const save = async () => {
    if (!editing || !tenant?.id || !user?.id || !editing.title?.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await schoolOpsService.saveLessonPlan({
        ...editing,
        tenant_id: tenant.id,
        author_id: user.id,
        title: editing.title.trim()
      } as any);
      setEditing(null);
      load();
    } catch (err: any) {
      setError(err.message || 'Could not save the plan.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await schoolOpsService.deleteLessonPlan(id);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const patch = (updates: Partial<LessonPlan>) => setEditing(e => (e ? { ...e, ...updates } : e));

  const addObjective = () => {
    if (!objectiveDraft.trim() || !editing) return;
    patch({ objectives: [...(editing.objectives || []), objectiveDraft.trim()] });
    setObjectiveDraft('');
  };

  const addMaterial = () => {
    if (!materialDraft.trim() || !editing) return;
    patch({ materials: [...(editing.materials || []), materialDraft.trim()] });
    setMaterialDraft('');
  };

  const addActivity = () => {
    if (!editing) return;
    patch({ activities: [...(editing.activities || []), { title: '', minutes: 10 }] as Activity[] });
  };

  const totalMinutes = (editing?.activities || []).reduce((s, a) => s + Number(a.minutes || 0), 0);

  return (
    <div className="w-full pb-20 space-y-8 animate-in fade-in duration-500">
      <PageHeader
        title={<span>Lesson <span className="text-emerald-400">Planner</span></span>}
        description="Plan objectives, materials and a timed activity sequence. Share plans with the department."
        tag="Planning"
        icon={NotebookPen}
        variant="mentor"
        rightContent={
          <Button
            onClick={startNew}
            className="gap-2 bg-brand-primary text-white border-none shadow-xl shadow-emerald-500/20 rounded-2xl h-11 sm:h-14 px-4 sm:px-6 font-black uppercase text-[10px] tracking-widest mt-3 sm:mt-0"
          >
            <Plus size={14} /> New plan
          </Button>
        }
      />

      <div className="flex gap-2">
        {[{ key: true, label: 'My plans' }, { key: false, label: 'Shared with me' }].map(t => (
          <button
            key={String(t.key)}
            onClick={() => setShowMine(t.key)}
            className={cn(
              'px-5 py-2.5 rounded-2xl font-bold text-xs transition-all border cursor-pointer',
              showMine === t.key
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent shadow-lg'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800'
            )}
          >
            {t.label}
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

      {loading ? (
        <Card className="p-12 rounded-[2.5rem] border-none flex items-center justify-center gap-3">
          <Loader2 size={20} className="animate-spin text-emerald-500" />
          <span className="font-bold text-slate-500">Loading plans…</span>
        </Card>
      ) : plans.length === 0 ? (
        <Card className="p-12 rounded-[2.5rem] border-none text-center">
          <NotebookPen size={40} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-xl font-black text-slate-900 dark:text-white">
            {showMine ? 'No lesson plans yet' : 'Nothing shared with you'}
          </h3>
          <p className="text-slate-500 font-medium mt-2 max-w-md mx-auto">
            {showMine
              ? 'Build a plan with objectives, materials and a timed activity sequence.'
              : 'Colleagues who share a plan will have it appear here.'}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {plans.map(p => {
            const mins = (p.activities || []).reduce((s, a) => s + Number(a.minutes || 0), 0);
            return (
              <Card key={p.id} className="p-6 rounded-[2rem] border-none shadow-lg flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="font-black text-slate-900 dark:text-white leading-snug">{p.title}</h4>
                    <p className="text-xs font-bold text-slate-400 mt-1">
                      {[p.subject, p.year_group].filter(Boolean).join(' · ') || 'No subject set'}
                    </p>
                  </div>
                  {p.is_shared && <Share2 size={14} className="text-emerald-500 flex-none mt-1" />}
                </div>

                <div className="flex items-center gap-3 text-xs font-bold text-slate-500">
                  <span className="flex items-center gap-1.5"><Clock size={12} /> {mins || p.duration_mins || 0} min</span>
                  <span className="flex items-center gap-1.5"><Target size={12} /> {(p.objectives || []).length} objectives</span>
                </div>

                <p className="text-xs text-slate-400 font-semibold">{formatDate(p.planned_for)}</p>

                <div className="flex gap-2 mt-auto pt-2">
                  <Button variant="outline" size="sm" onClick={() => setEditing(p)} className="flex-1 rounded-xl text-[10px] font-black uppercase">
                    Open
                  </Button>
                  {p.author_id === user?.id && (
                    <button onClick={() => remove(p.id)} className="text-slate-300 hover:text-red-500 p-2 cursor-pointer" aria-label="Delete plan">
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Editor */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <Card className="w-full max-w-3xl rounded-[2rem] border-none max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                {editing.id ? 'Edit lesson plan' : 'New lesson plan'}
              </h3>
              <button onClick={() => setEditing(null)} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer" aria-label="Close">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              <label className="block">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Title</span>
                <input className={inputClass + ' mt-1'} value={editing.title || ''} onChange={e => patch({ title: e.target.value })} placeholder="Photosynthesis: light-dependent reactions" />
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="block">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Subject</span>
                  <input className={inputClass + ' mt-1'} value={editing.subject || ''} onChange={e => patch({ subject: e.target.value })} />
                </label>
                <label className="block">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Year group</span>
                  <input className={inputClass + ' mt-1'} value={editing.year_group || ''} onChange={e => patch({ year_group: e.target.value })} />
                </label>
                <label className="block">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</span>
                  <input type="date" className={inputClass + ' mt-1'} value={editing.planned_for?.slice(0, 10) || ''} onChange={e => patch({ planned_for: e.target.value })} />
                </label>
              </div>

              <label className="block">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Class</span>
                <select className={inputClass + ' mt-1'} value={editing.class_id || ''} onChange={e => patch({ class_id: e.target.value || null })}>
                  <option value="">Not tied to a class</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>

              {/* Objectives */}
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Learning objectives</span>
                <div className="flex gap-2 mt-1">
                  <input
                    className={inputClass}
                    value={objectiveDraft}
                    onChange={e => setObjectiveDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addObjective(); } }}
                    placeholder="Students will be able to…"
                  />
                  <Button onClick={addObjective} variant="outline" className="rounded-xl h-12 px-5 font-bold flex-none">Add</Button>
                </div>
                {(editing.objectives || []).length > 0 && (
                  <ul className="mt-2 space-y-1.5">
                    {(editing.objectives || []).map((o, i) => (
                      <li key={i} className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900">
                        <span className="text-emerald-500 font-black text-xs flex-none">{i + 1}</span>
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex-1 min-w-0">{o}</span>
                        <button onClick={() => patch({ objectives: (editing.objectives || []).filter((_, j) => j !== i) })} className="text-slate-300 hover:text-red-500 flex-none cursor-pointer" aria-label="Remove objective">
                          <X size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Materials */}
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Materials</span>
                <div className="flex gap-2 mt-1">
                  <input
                    className={inputClass}
                    value={materialDraft}
                    onChange={e => setMaterialDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addMaterial(); } }}
                    placeholder="Microscopes, worksheet 4b…"
                  />
                  <Button onClick={addMaterial} variant="outline" className="rounded-xl h-12 px-5 font-bold flex-none">Add</Button>
                </div>
                {(editing.materials || []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {(editing.materials || []).map((m, i) => (
                      <span key={i} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300">
                        {m}
                        <button onClick={() => patch({ materials: (editing.materials || []).filter((_, j) => j !== i) })} className="text-slate-400 hover:text-red-500 cursor-pointer" aria-label="Remove material">
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Activities */}
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Activity sequence {totalMinutes > 0 && <span className="text-slate-500">· {totalMinutes} min total</span>}
                  </span>
                  <button onClick={addActivity} className="text-xs font-black uppercase text-emerald-600 hover:text-emerald-700 cursor-pointer">
                    + Add activity
                  </button>
                </div>
                <div className="space-y-2 mt-2">
                  {(editing.activities || []).map((a, i) => (
                    <div key={i} className="flex items-start gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                      <GripVertical size={15} className="text-slate-300 mt-3 flex-none" />
                      <div className="flex-1 min-w-0 space-y-2">
                        <input
                          className={inputClass + ' h-10'}
                          value={a.title}
                          onChange={e => patch({
                            activities: (editing.activities || []).map((x, j) => j === i ? { ...x, title: e.target.value } : x)
                          })}
                          placeholder={`Activity ${i + 1}`}
                        />
                        <input
                          className={inputClass + ' h-10'}
                          value={a.detail || ''}
                          onChange={e => patch({
                            activities: (editing.activities || []).map((x, j) => j === i ? { ...x, detail: e.target.value } : x)
                          })}
                          placeholder="What happens (optional)"
                        />
                      </div>
                      <input
                        type="number"
                        className="w-20 h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold text-sm tabular-nums focus:outline-none focus:border-emerald-500 flex-none"
                        value={a.minutes ?? ''}
                        onChange={e => patch({
                          activities: (editing.activities || []).map((x, j) => j === i ? { ...x, minutes: Number(e.target.value) || 0 } : x)
                        })}
                        placeholder="min"
                      />
                      <button
                        onClick={() => patch({ activities: (editing.activities || []).filter((_, j) => j !== i) })}
                        className="text-slate-300 hover:text-red-500 p-1.5 flex-none cursor-pointer"
                        aria-label="Remove activity"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <label className="block">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Differentiation</span>
                <textarea
                  rows={3}
                  className={inputClass + ' mt-1 h-auto py-3 resize-y'}
                  value={editing.differentiation || ''}
                  onChange={e => patch({ differentiation: e.target.value })}
                  placeholder="Support and stretch: who needs what, and how."
                />
              </label>

              {/* Standards */}
              {standards.length > 0 && (
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Curriculum standards</span>
                  <div className="flex flex-wrap gap-1.5 mt-2 max-h-32 overflow-y-auto">
                    {standards.map(s => {
                      const on = (editing.standard_ids || []).includes(s.id);
                      return (
                        <button
                          key={s.id}
                          onClick={() => patch({
                            standard_ids: on
                              ? (editing.standard_ids || []).filter(x => x !== s.id)
                              : [...(editing.standard_ids || []), s.id]
                          })}
                          title={s.description}
                          className={cn(
                            'px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border',
                            on
                              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400'
                              : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                          )}
                        >
                          {s.code}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(editing.is_shared)}
                  onChange={e => patch({ is_shared: e.target.checked })}
                  className="w-4 h-4 accent-emerald-500"
                />
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  Share with colleagues in this institution
                </span>
              </label>
            </div>

            <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex gap-3">
              <Button variant="outline" onClick={() => setEditing(null)} className="flex-1 rounded-xl h-12 font-bold">Cancel</Button>
              <Button onClick={save} disabled={!editing.title?.trim() || saving} className="flex-1 rounded-xl h-12 bg-brand-primary text-white border-none font-bold">
                {saving ? 'Saving…' : 'Save plan'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default LessonPlanner;
