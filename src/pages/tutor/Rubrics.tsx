import React, { useState, useEffect, useCallback } from 'react';
import { Grid3x3, Plus, Trash2, X, Loader2, AlertTriangle, Share2, Copy } from 'lucide-react';
import PageHeader from '../../components/shared/PageHeader';
import { Card, Button } from '../../components/ui';
import { useAuthStore } from '../../store/authStore';
import { useTenant } from '../../lib/tenantContext';
import { assignmentService } from '../../lib/services/assignments';
import type { Rubric, RubricCriterion } from '../../types/school';
import { cn } from '../../utils';

const inputClass =
  'w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-semibold text-sm focus:outline-none focus:border-emerald-500';

/** A fresh criterion pre-filled with a conventional four-level scale. */
const blankCriterion = (): RubricCriterion => ({
  id: `c-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
  label: '',
  description: '',
  levels: [
    { label: 'Excellent', points: 4 },
    { label: 'Good', points: 3 },
    { label: 'Developing', points: 2 },
    { label: 'Beginning', points: 1 }
  ]
});

/**
 * Rubric builder. Criteria × levels, with the achievable total computed from
 * the top level of each criterion so it always matches what a student can earn.
 */
const Rubrics: React.FC = () => {
  const { user } = useAuthStore();
  const { tenant } = useTenant();

  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<Partial<Rubric> | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!tenant?.id) return;
    setLoading(true);
    setError(null);
    try {
      setRubrics(await assignmentService.listRubrics(tenant.id));
    } catch (err: any) {
      setError(err.message || 'Could not load rubrics.');
    } finally {
      setLoading(false);
    }
  }, [tenant?.id]);

  useEffect(() => { load(); }, [load]);

  const startNew = () => setEditing({ title: '', description: '', criteria: [blankCriterion()], is_shared: false });

  const duplicate = (r: Rubric) => setEditing({
    title: `${r.title} (copy)`,
    description: r.description,
    criteria: r.criteria.map(c => ({ ...c, id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` })),
    is_shared: false
  });

  const patch = (updates: Partial<Rubric>) => setEditing(e => (e ? { ...e, ...updates } : e));

  const totalPoints = (editing?.criteria || []).reduce(
    (sum, c) => sum + Math.max(0, ...(c.levels || []).map(l => Number(l.points || 0))),
    0
  );

  const save = async () => {
    if (!editing || !tenant?.id || !user?.id || !editing.title?.trim()) return;
    const criteria = (editing.criteria || []).filter(c => c.label.trim());
    if (criteria.length === 0) {
      setError('Add at least one criterion with a name.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await assignmentService.createRubric({
        tenant_id: tenant.id,
        owner_id: user.id,
        title: editing.title.trim(),
        description: editing.description?.trim() || null,
        criteria,
        is_shared: Boolean(editing.is_shared)
      });
      setEditing(null);
      load();
    } catch (err: any) {
      setError(err.message || 'Could not save the rubric.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await assignmentService.deleteRubric(id);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="w-full pb-20 space-y-8 animate-in fade-in duration-500">
      <PageHeader
        title={<span>Marking <span className="text-emerald-400">Rubrics</span></span>}
        description="Define criteria and levels once, then attach them to assignments for consistent, transparent marking."
        tag="Assessment"
        icon={Grid3x3}
        variant="mentor"
        rightContent={
          <Button
            onClick={startNew}
            className="gap-2 bg-brand-primary text-white border-none shadow-xl shadow-emerald-500/20 rounded-2xl h-11 sm:h-14 px-4 sm:px-6 font-black uppercase text-[10px] tracking-widest mt-3 sm:mt-0"
          >
            <Plus size={14} /> New rubric
          </Button>
        }
      />

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
          <span className="font-bold text-slate-500">Loading rubrics…</span>
        </Card>
      ) : rubrics.length === 0 ? (
        <Card className="p-12 rounded-[2.5rem] border-none text-center">
          <Grid3x3 size={40} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-xl font-black text-slate-900 dark:text-white">No rubrics yet</h3>
          <p className="text-slate-500 font-medium mt-2 max-w-md mx-auto">
            A rubric breaks a mark into named criteria, so students can see exactly where marks came
            from and two markers reach the same score.
          </p>
          <Button onClick={startNew} className="mt-6 rounded-2xl bg-brand-primary text-white border-none font-bold px-6 h-12">
            Build your first rubric
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {rubrics.map(r => (
            <Card key={r.id} className="p-6 rounded-[2rem] border-none shadow-lg flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h4 className="font-black text-slate-900 dark:text-white leading-snug">{r.title}</h4>
                  <p className="text-xs font-bold text-slate-400 mt-1 tabular-nums">
                    {r.criteria.length} criteria · {r.total_points} points
                  </p>
                </div>
                {r.is_shared && <Share2 size={14} className="text-emerald-500 flex-none mt-1" />}
              </div>

              {r.description && <p className="text-sm text-slate-500 line-clamp-2">{r.description}</p>}

              <div className="flex flex-wrap gap-1.5">
                {r.criteria.slice(0, 4).map(c => (
                  <span key={c.id} className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300 truncate max-w-[140px]">
                    {c.label}
                  </span>
                ))}
                {r.criteria.length > 4 && (
                  <span className="px-2 py-1 text-[10px] font-bold text-slate-400">+{r.criteria.length - 4}</span>
                )}
              </div>

              <div className="flex gap-2 mt-auto pt-2">
                <Button variant="outline" size="sm" onClick={() => duplicate(r)} className="flex-1 gap-1.5 rounded-xl text-[10px] font-black uppercase">
                  <Copy size={12} /> Duplicate
                </Button>
                {r.owner_id === user?.id && (
                  <button onClick={() => remove(r.id)} className="text-slate-300 hover:text-red-500 p-2 cursor-pointer" aria-label="Delete rubric">
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Builder */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <Card className="w-full max-w-4xl rounded-[2rem] border-none max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">Rubric builder</h3>
                <p className="text-xs font-bold text-slate-400 tabular-nums">{totalPoints} points achievable</p>
              </div>
              <button onClick={() => setEditing(null)} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer" aria-label="Close">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              <label className="block">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Title</span>
                <input className={inputClass + ' mt-1 h-12'} value={editing.title || ''} onChange={e => patch({ title: e.target.value })} placeholder="Extended writing assessment" />
              </label>

              <label className="block">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Description</span>
                <input className={inputClass + ' mt-1 h-12'} value={editing.description || ''} onChange={e => patch({ description: e.target.value })} />
              </label>

              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Criteria</span>
                <button
                  onClick={() => patch({ criteria: [...(editing.criteria || []), blankCriterion()] })}
                  className="text-xs font-black uppercase text-emerald-600 hover:text-emerald-700 cursor-pointer"
                >
                  + Add criterion
                </button>
              </div>

              <div className="space-y-4">
                {(editing.criteria || []).map((c, ci) => (
                  <div key={c.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 space-y-2 min-w-0">
                        <input
                          className={inputClass}
                          value={c.label}
                          onChange={e => patch({
                            criteria: (editing.criteria || []).map((x, i) => i === ci ? { ...x, label: e.target.value } : x)
                          })}
                          placeholder={`Criterion ${ci + 1} — e.g. "Use of evidence"`}
                        />
                        <input
                          className={inputClass}
                          value={c.description || ''}
                          onChange={e => patch({
                            criteria: (editing.criteria || []).map((x, i) => i === ci ? { ...x, description: e.target.value } : x)
                          })}
                          placeholder="What this criterion is looking for (optional)"
                        />
                      </div>
                      {(editing.criteria || []).length > 1 && (
                        <button
                          onClick={() => patch({ criteria: (editing.criteria || []).filter((_, i) => i !== ci) })}
                          className="text-slate-300 hover:text-red-500 p-2 flex-none cursor-pointer"
                          aria-label="Remove criterion"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>

                    <div className="overflow-x-auto">
                      <div className="flex gap-2 min-w-min">
                        {c.levels.map((lv, li) => (
                          <div key={li} className="w-40 flex-none rounded-xl border border-slate-200 dark:border-slate-800 p-2.5 space-y-2">
                            <input
                              className={inputClass + ' h-9 text-xs'}
                              value={lv.label}
                              onChange={e => patch({
                                criteria: (editing.criteria || []).map((x, i) =>
                                  i === ci ? { ...x, levels: x.levels.map((y, j) => j === li ? { ...y, label: e.target.value } : y) } : x
                                )
                              })}
                              placeholder="Level"
                            />
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                className={inputClass + ' h-9 text-xs tabular-nums'}
                                value={lv.points}
                                onChange={e => patch({
                                  criteria: (editing.criteria || []).map((x, i) =>
                                    i === ci ? { ...x, levels: x.levels.map((y, j) => j === li ? { ...y, points: Number(e.target.value) || 0 } : y) } : x
                                  )
                                })}
                              />
                              {c.levels.length > 2 && (
                                <button
                                  onClick={() => patch({
                                    criteria: (editing.criteria || []).map((x, i) =>
                                      i === ci ? { ...x, levels: x.levels.filter((_, j) => j !== li) } : x
                                    )
                                  })}
                                  className="text-slate-300 hover:text-red-500 flex-none cursor-pointer"
                                  aria-label="Remove level"
                                >
                                  <X size={13} />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                        <button
                          onClick={() => patch({
                            criteria: (editing.criteria || []).map((x, i) =>
                              i === ci ? { ...x, levels: [...x.levels, { label: '', points: 0 }] } : x
                            )
                          })}
                          className="w-24 flex-none rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-slate-400 hover:border-emerald-400 hover:text-emerald-600 text-xs font-black cursor-pointer transition-colors"
                        >
                          + Level
                        </button>
                      </div>
                    </div>

                    <p className="text-[10px] font-bold text-slate-400 tabular-nums">
                      Best available: {Math.max(0, ...c.levels.map(l => Number(l.points || 0)))} points
                    </p>
                  </div>
                ))}
              </div>

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
                {saving ? 'Saving…' : 'Save rubric'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Rubrics;
