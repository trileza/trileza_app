import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button } from '../ui';
import {
  Plus, Trash2, X, Loader2, ListChecks, FileText, Send, AlertCircle, Users, Award
} from 'lucide-react';
import { cn } from '../../utils';
import { useAuthStore } from '../../store/authStore';
import { useTenant } from '../../lib/tenantContext';
import { assignmentService } from '../../lib/services/assignments';
import { classService } from '../../lib/services/classes';
import type {
  Assignment, AssignmentSubmission, QuizQuestion, SchoolClass, AssignmentType
} from '../../types/school';

const blankQuestion = (): QuizQuestion => ({
  id: `q-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
  prompt: '',
  options: ['', ''],
  correctOptionIndex: 0,
  points: 1
});

const inputClass =
  'w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-semibold focus:outline-none focus:border-emerald-500';

/**
 * Teacher-side assignment authoring and marking.
 *
 * Writes to the `assignments` table. Quiz answers are marked automatically on
 * submission; written work is marked here and flows into the gradebook.
 */
const AssignmentCreator = ({ showFeedback }: any) => {
  const { user } = useAuthStore();
  const { tenant } = useTenant();

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [type, setType] = useState<AssignmentType>('quiz');
  const [classId, setClassId] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [points, setPoints] = useState('100');
  const [questions, setQuestions] = useState<QuizQuestion[]>([blankQuestion()]);

  // Marking
  const [marking, setMarking] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);
  const [markDrafts, setMarkDrafts] = useState<Record<string, { score: string; feedback: string }>>({});
  const [savingMark, setSavingMark] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id || !tenant?.id) return;
    setLoading(true);
    setError(null);
    try {
      const [list, classList] = await Promise.all([
        assignmentService.listForTeacher(user.id),
        classService.listClasses(tenant.id, { teacherId: user.id })
      ]);
      setAssignments(list);
      setClasses(classList);
    } catch (err: any) {
      setError(err.message || 'Could not load your assignments.');
    } finally {
      setLoading(false);
    }
  }, [user?.id, tenant?.id]);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => {
    setTitle(''); setInstructions(''); setType('quiz');
    setClassId(''); setDueAt(''); setPoints('100');
    setQuestions([blankQuestion()]);
  };

  const handleCreate = async (publish: boolean) => {
    if (!user?.id || !tenant?.id || !title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const cleanQuestions = type === 'quiz'
        ? questions.filter(q => q.prompt.trim() && q.options.filter(o => o.trim()).length >= 2)
        : [];

      if (type === 'quiz' && cleanQuestions.length === 0) {
        throw new Error('Add at least one question with two or more options.');
      }

      const totalPoints = type === 'quiz'
        ? cleanQuestions.reduce((s, q) => s + Number(q.points || 1), 0)
        : Number(points) || 100;

      await assignmentService.createAssignment({
        tenant_id: tenant.id,
        teacher_id: user.id,
        class_id: classId || null,
        title: title.trim(),
        instructions: instructions.trim() || null,
        type,
        points_possible: totalPoints,
        questions: cleanQuestions,
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
        status: publish ? 'published' : 'draft'
      });

      showFeedback?.(publish ? 'Assignment published to the class.' : 'Draft saved.');
      window.dispatchEvent(new Event('trileza-assignment-created'));
      setShowForm(false);
      resetForm();
      load();
    } catch (err: any) {
      setError(err.message || 'Could not save the assignment.');
    } finally {
      setSaving(false);
    }
  };

  const openMarking = async (assignment: Assignment) => {
    setMarking(assignment);
    setSubmissions([]);
    try {
      const subs = await assignmentService.listSubmissions(assignment.id);
      setSubmissions(subs);
      const drafts: Record<string, { score: string; feedback: string }> = {};
      subs.forEach(s => {
        drafts[s.id] = {
          score: s.score === null || s.score === undefined ? '' : String(s.score),
          feedback: s.feedback || ''
        };
      });
      setMarkDrafts(drafts);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const saveMark = async (submission: AssignmentSubmission) => {
    if (!user?.id || !marking) return;
    const draft = markDrafts[submission.id];
    const score = Number(draft?.score);
    if (draft?.score === '' || Number.isNaN(score) || score < 0 || score > marking.points_possible) {
      setError(`Enter a score between 0 and ${marking.points_possible}.`);
      return;
    }

    setSavingMark(submission.id);
    setError(null);
    try {
      await assignmentService.gradeSubmission({
        submissionId: submission.id,
        score,
        feedback: draft.feedback,
        gradedBy: user.id,
        returnToStudent: true
      });
      showFeedback?.(`Marked ${submission.student_name}.`);
      const refreshed = await assignmentService.listSubmissions(marking.id);
      setSubmissions(refreshed);
      load();
    } catch (err: any) {
      setError(err.message || 'Could not save the mark.');
    } finally {
      setSavingMark(null);
    }
  };

  const togglePublish = async (a: Assignment) => {
    try {
      await assignmentService.updateAssignment(a.id, {
        status: a.status === 'published' ? 'closed' : 'published'
      });
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const remove = async (a: Assignment) => {
    try {
      await assignmentService.deleteAssignment(a.id);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-black text-slate-900 dark:text-white">Your assignments</h3>
          <p className="text-sm text-slate-500 font-medium">Quizzes mark themselves; written work you mark here.</p>
        </div>
        <Button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="gap-2 rounded-2xl h-12 px-5 bg-brand-primary text-white border-none font-black uppercase text-[10px] tracking-widest"
        >
          <Plus size={14} /> New assignment
        </Button>
      </div>

      {error && (
        <Card className="p-4 rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 flex items-start gap-3">
          <AlertCircle size={18} className="text-red-500 mt-0.5 flex-none" />
          <p className="text-sm font-semibold text-red-800 dark:text-red-200">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600"><X size={16} /></button>
        </Card>
      )}

      {loading ? (
        <Card className="p-12 rounded-[2rem] border-none flex items-center justify-center gap-3">
          <Loader2 size={20} className="animate-spin text-emerald-500" />
          <span className="font-bold text-slate-500">Loading…</span>
        </Card>
      ) : assignments.length === 0 ? (
        <Card className="p-12 rounded-[2rem] border-none text-center">
          <FileText size={40} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-black text-slate-900 dark:text-white">No assignments yet</h3>
          <p className="text-slate-500 font-medium mt-2">Create one and publish it to a class.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {assignments.map(a => {
            const Icon = a.type === 'quiz' ? ListChecks : FileText;
            const cls = classes.find(c => c.id === a.class_id);
            return (
              <Card key={a.id} className="p-6 rounded-[2rem] border-none shadow-lg space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 flex-none"><Icon size={18} /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-black text-slate-900 dark:text-white">{a.title}</h4>
                      <span className={cn(
                        'px-2 py-0.5 rounded-md text-[9px] font-black uppercase',
                        a.status === 'published'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                      )}>{a.status}</span>
                    </div>
                    <p className="text-xs font-bold text-slate-400 mt-1">
                      {cls?.name || 'No class'} · {a.points_possible} points
                    </p>
                  </div>
                  <button onClick={() => remove(a)} className="text-slate-300 hover:text-red-500 p-1 flex-none cursor-pointer" aria-label="Delete">
                    <Trash2 size={15} />
                  </button>
                </div>

                <div className="flex items-center gap-4 text-xs font-bold text-slate-500">
                  <span className="flex items-center gap-1.5"><Users size={13} /> {a.submission_count ?? 0} submitted</span>
                  <span className="flex items-center gap-1.5"><Award size={13} /> {a.graded_count ?? 0} marked</span>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => togglePublish(a)} className="flex-1 rounded-xl text-[10px] font-black uppercase">
                    {a.status === 'published' ? 'Close' : 'Publish'}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => openMarking(a)}
                    disabled={(a.submission_count ?? 0) === 0}
                    className="flex-1 rounded-xl text-[10px] font-black uppercase bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-none"
                  >
                    Mark
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <Card className="w-full max-w-2xl rounded-[2rem] border-none max-h-[88vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-lg font-black text-slate-900 dark:text-white">New assignment</h3>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer" aria-label="Close"><X size={20} /></button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <label className="block">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Title</span>
                <input className={inputClass + ' mt-1'} value={title} onChange={e => setTitle(e.target.value)} placeholder="Photosynthesis quiz" />
              </label>

              <label className="block">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Instructions</span>
                <textarea rows={3} className={inputClass + ' mt-1 h-auto py-3 resize-y'} value={instructions} onChange={e => setInstructions(e.target.value)} />
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</span>
                  <select className={inputClass + ' mt-1'} value={type} onChange={e => setType(e.target.value as AssignmentType)}>
                    <option value="quiz">Quiz (marked automatically)</option>
                    <option value="text">Written response</option>
                    <option value="file">File upload</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Class</span>
                  <select className={inputClass + ' mt-1'} value={classId} onChange={e => setClassId(e.target.value)}>
                    <option value="">Select a class</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Due</span>
                  <input type="datetime-local" className={inputClass + ' mt-1'} value={dueAt} onChange={e => setDueAt(e.target.value)} />
                </label>
                {type !== 'quiz' && (
                  <label className="block">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Points</span>
                    <input type="number" className={inputClass + ' mt-1 tabular-nums'} value={points} onChange={e => setPoints(e.target.value)} />
                  </label>
                )}
              </div>

              {type === 'quiz' && (
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Questions</span>
                    <button
                      onClick={() => setQuestions(q => [...q, blankQuestion()])}
                      className="text-xs font-black uppercase text-emerald-600 hover:text-emerald-700 cursor-pointer"
                    >
                      + Add question
                    </button>
                  </div>

                  {questions.map((q, qi) => (
                    <div key={q.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
                      <div className="flex items-start gap-2">
                        <input
                          className={inputClass}
                          value={q.prompt}
                          onChange={e => setQuestions(qs => qs.map((x, i) => i === qi ? { ...x, prompt: e.target.value } : x))}
                          placeholder={`Question ${qi + 1}`}
                        />
                        {questions.length > 1 && (
                          <button
                            onClick={() => setQuestions(qs => qs.filter((_, i) => i !== qi))}
                            className="text-slate-300 hover:text-red-500 p-2 flex-none cursor-pointer"
                            aria-label="Remove question"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>

                      <div className="space-y-2">
                        {q.options.map((opt, oi) => (
                          <div key={oi} className="flex items-center gap-2">
                            <button
                              onClick={() => setQuestions(qs => qs.map((x, i) => i === qi ? { ...x, correctOptionIndex: oi } : x))}
                              title="Mark as the correct answer"
                              className={cn(
                                'w-6 h-6 rounded-full border-2 flex-none flex items-center justify-center text-[10px] font-black cursor-pointer',
                                q.correctOptionIndex === oi
                                  ? 'bg-emerald-500 border-emerald-500 text-white'
                                  : 'border-slate-300 dark:border-slate-600 text-transparent'
                              )}
                            >
                              ✓
                            </button>
                            <input
                              className={inputClass + ' h-10'}
                              value={opt}
                              onChange={e => setQuestions(qs => qs.map((x, i) =>
                                i === qi ? { ...x, options: x.options.map((o, j) => j === oi ? e.target.value : o) } : x
                              ))}
                              placeholder={`Option ${oi + 1}`}
                            />
                            {q.options.length > 2 && (
                              <button
                                onClick={() => setQuestions(qs => qs.map((x, i) =>
                                  i === qi ? { ...x, options: x.options.filter((_, j) => j !== oi), correctOptionIndex: Math.min(x.correctOptionIndex, x.options.length - 2) } : x
                                ))}
                                className="text-slate-300 hover:text-red-500 p-1 flex-none cursor-pointer"
                                aria-label="Remove option"
                              >
                                <X size={14} />
                              </button>
                            )}
                          </div>
                        ))}
                        <button
                          onClick={() => setQuestions(qs => qs.map((x, i) => i === qi ? { ...x, options: [...x.options, ''] } : x))}
                          className="text-xs font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          + Add option
                        </button>
                      </div>

                      <label className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Points</span>
                        <input
                          type="number"
                          className="w-20 h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold text-sm tabular-nums focus:outline-none focus:border-emerald-500"
                          value={q.points}
                          onChange={e => setQuestions(qs => qs.map((x, i) => i === qi ? { ...x, points: Number(e.target.value) || 1 } : x))}
                        />
                      </label>
                    </div>
                  ))}

                  <p className="text-xs font-bold text-slate-400">
                    Total: {questions.reduce((s, q) => s + Number(q.points || 1), 0)} points. The green tick marks the correct answer.
                  </p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex gap-3">
              <Button variant="outline" onClick={() => handleCreate(false)} disabled={!title.trim() || saving} className="flex-1 rounded-xl h-12 font-bold">
                Save draft
              </Button>
              <Button onClick={() => handleCreate(true)} disabled={!title.trim() || !classId || saving} className="flex-1 rounded-xl h-12 bg-brand-primary text-white border-none font-bold gap-2">
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                Publish
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Marking */}
      {marking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <Card className="w-full max-w-3xl rounded-[2rem] border-none max-h-[88vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">Marking: {marking.title}</h3>
                <p className="text-xs font-bold text-slate-400">{submissions.length} submissions · {marking.points_possible} points</p>
              </div>
              <button onClick={() => setMarking(null)} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer" aria-label="Close"><X size={20} /></button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {submissions.length === 0 ? (
                <p className="text-center text-slate-500 font-medium py-8">No submissions yet.</p>
              ) : submissions.map(s => (
                <div key={s.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-black text-sm text-slate-900 dark:text-white truncate">{s.student_name}</span>
                      {s.status === 'late' && (
                        <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 text-[9px] font-black uppercase">Late</span>
                      )}
                    </div>
                    {s.auto_score !== null && s.auto_score !== undefined && (
                      <span className="text-xs font-bold text-emerald-600 tabular-nums flex-none">Auto: {s.auto_score}</span>
                    )}
                  </div>

                  {s.body && (
                    <p className="text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900 rounded-xl p-3 whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
                      {s.body}
                    </p>
                  )}

                  <div className="flex flex-wrap items-end gap-3">
                    <label className="block">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Score</span>
                      <input
                        type="number"
                        value={markDrafts[s.id]?.score ?? ''}
                        onChange={e => setMarkDrafts(d => ({ ...d, [s.id]: { ...d[s.id], score: e.target.value } }))}
                        className="mt-1 w-24 h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold tabular-nums focus:outline-none focus:border-emerald-500"
                      />
                    </label>
                    <label className="block flex-1 min-w-[180px]">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Feedback</span>
                      <input
                        value={markDrafts[s.id]?.feedback ?? ''}
                        onChange={e => setMarkDrafts(d => ({ ...d, [s.id]: { ...d[s.id], feedback: e.target.value } }))}
                        className={inputClass + ' mt-1 h-11'}
                        placeholder="Optional comment for the student"
                      />
                    </label>
                    <Button
                      onClick={() => saveMark(s)}
                      disabled={savingMark === s.id}
                      className="rounded-xl h-11 px-5 bg-brand-primary text-white border-none font-bold"
                    >
                      {savingMark === s.id ? <Loader2 size={15} className="animate-spin" /> : 'Save'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AssignmentCreator;
