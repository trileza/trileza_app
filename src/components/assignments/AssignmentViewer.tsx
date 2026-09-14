import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button } from '../ui';
import {
  ListChecks, FileText, CheckCircle2, AlertCircle, X, Loader2, Clock, Award
} from 'lucide-react';
import { cn } from '../../utils';
import { useAuthStore } from '../../store/authStore';
import { useTenant } from '../../lib/tenantContext';
import { assignmentService } from '../../lib/services/assignments';
import type { Assignment, AssignmentSubmission } from '../../types/school';

type Row = Assignment & { submission?: AssignmentSubmission };

const formatDue = (iso?: string | null) => {
  if (!iso) return 'No deadline';
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return 'Overdue';
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `Due in ${days} days`;
};

/**
 * The student's assignment list.
 *
 * Reads from the `assignments` table and writes real rows to
 * `assignment_submissions`. Quizzes are marked on submit and the score is shown
 * immediately; written work shows "Awaiting marking" until a teacher grades it.
 */
const AssignmentViewer = ({ showFeedback }: any) => {
  const { user } = useAuthStore();
  const { tenant } = useTenant();

  const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);

  const [activeTask, setActiveTask] = useState<Row | null>(null);
  const [textAnswer, setTextAnswer] = useState('');
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      setRows(await assignmentService.listForStudent(user.id));
    } catch (err: any) {
      setError(err.message || 'Could not load your assignments.');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchData();
    const handleSync = () => fetchData();
    window.addEventListener('trileza-assignment-created', handleSync);
    return () => window.removeEventListener('trileza-assignment-created', handleSync);
  }, [fetchData]);

  const isDone = (r: Row) =>
    Boolean(r.submission && r.submission.status !== 'draft' && r.submission.status !== 'resubmit_requested');

  const pending = rows.filter(r => !isDone(r));
  const completed = rows.filter(isDone);
  const visible = activeTab === 'pending' ? pending : completed;

  const openTask = (row: Row) => {
    setActiveTask(row);
    setTextAnswer(row.submission?.body || '');
    const restored: Record<number, number> = {};
    (row.submission?.answers || []).forEach((a, i) => { if (typeof a === 'number') restored[i] = a; });
    setQuizAnswers(restored);
  };

  const handleSubmit = async () => {
    if (!activeTask || !user?.id || !tenant?.id) return;
    setSubmitting(true);
    try {
      const answers = activeTask.type === 'quiz'
        ? (activeTask.questions || []).map((_, i) => quizAnswers[i] ?? -1)
        : undefined;

      const submission = await assignmentService.submit({
        assignmentId: activeTask.id,
        studentId: user.id,
        tenantId: tenant.id,
        body: activeTask.type === 'quiz' ? undefined : textAnswer,
        answers
      });

      // A quiz is marked on the spot, so tell the student their score now.
      if (submission.score !== null && submission.score !== undefined) {
        showFeedback?.(`Submitted — you scored ${submission.score} of ${activeTask.points_possible}.`);
      } else {
        showFeedback?.('Assignment submitted. Your teacher will mark it.');
      }

      setActiveTask(null);
      setTextAnswer('');
      setQuizAnswers({});
      await fetchData();
    } catch (err: any) {
      showFeedback?.(err.message || 'Could not submit your work.', 'info');
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = () => {
    if (!activeTask) return false;
    if (activeTask.type === 'quiz') {
      return (activeTask.questions || []).every((_, i) => quizAnswers[i] !== undefined);
    }
    return textAnswer.trim().length > 0;
  };

  if (loading) {
    return (
      <Card className="p-12 rounded-[2rem] border-none flex items-center justify-center gap-3">
        <Loader2 size={20} className="animate-spin text-emerald-500" />
        <span className="font-bold text-slate-500">Loading assignments…</span>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <Card className="p-4 rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 flex items-center gap-3">
          <AlertCircle size={18} className="text-red-500 flex-none" />
          <p className="text-sm font-semibold text-red-800 dark:text-red-200">{error}</p>
        </Card>
      )}

      <div className="flex gap-2">
        {(['pending', 'completed'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-5 py-2.5 rounded-2xl font-bold text-xs capitalize transition-all border cursor-pointer',
              activeTab === tab
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent shadow-lg'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800'
            )}
          >
            {tab}
            <span className="ml-2 opacity-60">{tab === 'pending' ? pending.length : completed.length}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <Card className="p-12 rounded-[2rem] border-none text-center">
          <CheckCircle2 size={40} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-black text-slate-900 dark:text-white">
            {activeTab === 'pending' ? 'Nothing outstanding' : 'No completed work yet'}
          </h3>
          <p className="text-slate-500 font-medium mt-2">
            {activeTab === 'pending'
              ? 'You are up to date. New assignments will appear here as teachers publish them.'
              : 'Work you submit will be listed here with its mark.'}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visible.map(row => {
            const Icon = row.type === 'quiz' ? ListChecks : FileText;
            const sub = row.submission;
            const awaiting = sub && sub.score === null;

            return (
              <Card key={row.id} className="p-6 rounded-[2rem] border-none shadow-lg flex flex-col gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 flex-none">
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-black text-slate-900 dark:text-white leading-snug">{row.title}</h4>
                    <p className="text-xs font-bold text-slate-400 mt-1">
                      {row.points_possible} points · {formatDue(row.due_at)}
                    </p>
                  </div>
                </div>

                {row.instructions && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2">{row.instructions}</p>
                )}

                {sub ? (
                  <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                    {awaiting ? (
                      <span className="flex items-center gap-1.5 text-xs font-bold text-amber-600">
                        <Clock size={13} /> Awaiting marking
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-sm font-black text-slate-900 dark:text-white tabular-nums">
                        <Award size={14} className="text-emerald-500" />
                        {sub.score} / {row.points_possible}
                      </span>
                    )}
                    {sub.status === 'resubmit_requested' && (
                      <Button size="sm" onClick={() => openTask(row)} className="rounded-xl text-[10px] font-black uppercase">
                        Resubmit
                      </Button>
                    )}
                  </div>
                ) : (
                  <Button
                    onClick={() => openTask(row)}
                    className="w-full rounded-2xl h-11 bg-brand-primary text-white border-none font-black uppercase text-[10px] tracking-widest"
                  >
                    Start
                  </Button>
                )}

                {sub?.feedback && (
                  <p className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-900 rounded-xl p-3 leading-relaxed">
                    <span className="font-black text-slate-400 uppercase tracking-wide text-[9px] block mb-1">Feedback</span>
                    {sub.feedback}
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Task modal */}
      {activeTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <Card className="w-full max-w-2xl rounded-[2rem] border-none max-h-[88vh] flex flex-col">
            <div className="flex items-start justify-between gap-4 p-6 border-b border-slate-100 dark:border-slate-800">
              <div className="min-w-0">
                <h3 className="text-lg font-black text-slate-900 dark:text-white">{activeTask.title}</h3>
                <p className="text-xs font-bold text-slate-400 mt-0.5">
                  {activeTask.points_possible} points · {formatDue(activeTask.due_at)}
                </p>
              </div>
              <button onClick={() => setActiveTask(null)} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer" aria-label="Close">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              {activeTask.instructions && (
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{activeTask.instructions}</p>
              )}

              {activeTask.type === 'quiz' ? (
                (activeTask.questions || []).map((q, qi) => (
                  <div key={q.id || qi} className="space-y-2">
                    <p className="font-bold text-sm text-slate-900 dark:text-white">
                      {qi + 1}. {q.prompt}
                    </p>
                    <div className="space-y-1.5">
                      {(q.options || []).map((opt, oi) => (
                        <button
                          key={oi}
                          onClick={() => setQuizAnswers(a => ({ ...a, [qi]: oi }))}
                          className={cn(
                            'w-full text-left p-3 rounded-xl border text-sm font-semibold transition-all cursor-pointer',
                            quizAnswers[qi] === oi
                              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-slate-900 dark:text-white'
                              : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                          )}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <label className="block">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Your answer</span>
                  <textarea
                    rows={10}
                    value={textAnswer}
                    onChange={e => setTextAnswer(e.target.value)}
                    placeholder="Write your response here…"
                    className="mt-2 w-full p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium text-sm focus:outline-none focus:border-emerald-500 resize-y"
                  />
                </label>
              )}
            </div>

            <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex gap-3">
              <Button variant="outline" onClick={() => setActiveTask(null)} className="flex-1 rounded-xl h-12 font-bold">Cancel</Button>
              <Button
                onClick={handleSubmit}
                disabled={!canSubmit() || submitting}
                className="flex-1 rounded-xl h-12 bg-brand-primary text-white border-none font-bold"
              >
                {submitting ? 'Submitting…' : 'Submit'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AssignmentViewer;
