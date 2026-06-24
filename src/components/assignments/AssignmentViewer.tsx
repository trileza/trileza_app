import React, { useState, useEffect } from 'react';
import { Card, Button } from '../ui';
import { ListChecks, FileText, Video, Upload, CheckCircle2, AlertCircle, PlayCircle, X, Loader2, Type } from 'lucide-react';
import { cn } from '../../utils';
import { useAuthStore } from '../../store/authStore';
import { nexus } from '../../lib/nexus';

const AssignmentViewer = ({ showFeedback }: any) => {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending');
  const [loading, setLoading] = useState(false);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);

  // Working task modal state
  const [activeTask, setActiveTask] = useState<any | null>(null);
  const [textAnswer, setTextAnswer] = useState('');
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      // 1. Fetch student's enrollments
      const { data: enrolls } = await nexus.database
        .from('enrollments')
        .select('course_id')
        .eq('user_id', user.id);

      const enrolledIds = enrolls?.map(e => e.course_id) || [];

      // 2. Fetch all profiles to extract assignments
      const { data: profiles } = await nexus.database
        .from('profiles')
        .select('*');

      const allAssignments: any[] = [];
      profiles?.forEach(p => {
        const created = p.metadata?.created_assignments;
        if (Array.isArray(created)) {
          created.forEach(asn => {
            if (enrolledIds.includes(asn.courseId)) {
              allAssignments.push({
                ...asn,
                tutorName: p.full_name,
                tutorAvatar: p.avatar_url
              });
            }
          });
        }
      });

      setAssignments(allAssignments);

      // 3. Fetch latest student submissions
      const { data: studentProfile } = await nexus.database
        .from('profiles')
        .select('metadata')
        .eq('id', user.id)
        .single();

      if (studentProfile) {
        setSubmissions(studentProfile.metadata?.submissions || []);
      }
    } catch (e) {
      console.error('Error loading assignments/submissions:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchData();
    }
  }, [user]);

  const handleSubmitAssignment = async () => {
    if (!activeTask) return;
    setSubmitting(true);
    try {
      const { data: profile } = await nexus.database
        .from('profiles')
        .select('metadata')
        .eq('id', user.id)
        .single();

      const metadata = profile?.metadata || {};
      const currentSubmissions = metadata.submissions || [];

      let formattedAnswers: any = null;
      if (activeTask.type === 'multichoice') {
        const questions = activeTask.details?.questions || [];
        formattedAnswers = questions.map((q: any, idx: number) => ({
          question: q.questionText,
          selected: q.options[quizAnswers[idx] ?? 0],
          correct: q.options[q.correctOptionIndex]
        }));
      } else {
        formattedAnswers = textAnswer;
      }

      const newSubmission = {
        assignmentId: activeTask.assignmentId,
        courseId: activeTask.courseId,
        title: activeTask.title,
        type: activeTask.type,
        points: activeTask.points,
        status: 'Pending Grade',
        submittedAt: new Date().toISOString(),
        answers: formattedAnswers,
        score: '-',
        grade: '-',
        feedback: ''
      };

      const updatedSubmissions = [...currentSubmissions.filter((s: any) => s.assignmentId !== activeTask.assignmentId), newSubmission];
      const updatedMetadata = {
        ...metadata,
        submissions: updatedSubmissions
      };

      const { error } = await nexus.database
        .from('profiles')
        .update({ metadata: updatedMetadata })
        .eq('id', user.id);

      if (error) throw error;

      showFeedback('Assignment submitted successfully!');
      setActiveTask(null);
      setTextAnswer('');
      setQuizAnswers({});
      await fetchData();
    } catch (e: any) {
      console.error(e);
      alert('Failed to submit assignment: ' + (e.message || e));
    } finally {
      setSubmitting(false);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'multichoice': return ListChecks;
      case 'blanks': return Type;
      case 'video': return Video;
      default: return FileText;
    }
  };

  const completedIds = submissions.map(s => s.assignmentId);
  const pendingTasks = assignments.filter(asn => !completedIds.includes(asn.assignmentId));
  const completedTasks = submissions.map(sub => {
    const orig = assignments.find(a => a.assignmentId === sub.assignmentId) || {};
    return {
      ...sub,
      tutorName: orig.tutorName || 'Mentor',
      tutorAvatar: orig.tutorAvatar
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <button 
          onClick={() => setActiveTab('pending')}
          className={cn("font-bold pb-2 border-b-2 transition-all flex items-center gap-2", activeTab === 'pending' ? "border-amber-500 text-amber-600 dark:text-amber-400" : "border-transparent text-slate-500 hover:text-slate-700")}
        >
          <AlertCircle size={16} /> Pending Tasks ({pendingTasks.length})
        </button>
        <button 
          onClick={() => setActiveTab('completed')}
          className={cn("font-bold pb-2 border-b-2 transition-all flex items-center gap-2", activeTab === 'completed' ? "border-emerald-600 text-emerald-700 dark:text-emerald-400" : "border-transparent text-slate-500 hover:text-slate-700")}
        >
          <CheckCircle2 size={16} /> Completed ({completedTasks.length})
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500 font-semibold">Loading assignments...</div>
      ) : activeTab === 'pending' && (
        pendingTasks.length === 0 ? (
          <div className="text-center py-12 text-slate-500 font-semibold bg-slate-50 dark:bg-slate-900/50 rounded-[2rem]">No pending assignments found! Keep it up.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pendingTasks.map(task => {
              const TaskIcon = getIcon(task.type);
              return (
                <Card key={task.assignmentId} className="p-6 border-none shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 rounded-[2rem] bg-white dark:bg-slate-950 flex flex-col h-full group hover:shadow-2xl transition-all">
                  <div className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <TaskIcon size={24} className="text-slate-700 dark:text-slate-300" />
                  </div>
                  <h4 className="font-black text-xl text-slate-900 dark:text-white mb-2 leading-tight">{task.title}</h4>
                  <div className="flex items-center gap-4 text-xs font-bold text-slate-500 mb-8 uppercase tracking-wider">
                    <span className="text-amber-500">Due: {task.dueDate}</span>
                    <span>•</span>
                    <span>{task.points} Pts</span>
                  </div>
                  <div className="mt-auto">
                    <Button 
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl"
                      onClick={() => {
                        setActiveTask(task);
                        setTextAnswer('');
                        setQuizAnswers({});
                      }}
                    >
                      <PlayCircle size={16} className="mr-2" /> Start Task
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )
      )}

      {activeTab === 'completed' && (
        completedTasks.length === 0 ? (
          <div className="text-center py-12 text-slate-500 font-semibold bg-slate-50 dark:bg-slate-900/50 rounded-[2rem]">No completed tasks. Submit assignments to see grades here.</div>
        ) : (
          <Card className="p-8 border-none shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 rounded-[2.5rem] bg-white dark:bg-slate-950">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <CheckCircle2 className="text-emerald-500" /> Graded & Pending Assessments
            </h3>
            <div className="space-y-4">
              {completedTasks.map(task => {
                const TaskIcon = getIcon(task.type);
                return (
                  <div key={task.assignmentId} className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-2xl border border-emerald-100 dark:border-emerald-950 bg-emerald-50/30 dark:bg-emerald-950/10 gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-900 border border-emerald-100 dark:border-emerald-950 flex items-center justify-center">
                        <TaskIcon size={20} className="text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-white">{task.title}</h4>
                        <p className="text-xs font-medium text-slate-500 mt-1 uppercase tracking-wider">
                          {task.status === 'Graded' ? 'Completed • Graded' : 'Submitted • Pending Evaluation'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="font-black text-2xl text-emerald-600 dark:text-emerald-400">{task.grade || '-'}</p>
                        <p className="text-xs font-bold text-slate-500">{task.score || '-'}</p>
                      </div>
                      {task.feedback && (
                        <Button 
                          variant="outline" 
                          className="border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-400 font-bold bg-white dark:bg-slate-900"
                          onClick={() => alert(`Feedback from Mentor:\n\n${task.feedback}`)}
                        >
                          Feedback
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )
      )}

      {/* Task Execution Modal */}
      {activeTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 w-full max-w-2xl rounded-[2.5rem] shadow-2xl p-8 max-h-[90vh] overflow-y-auto space-y-6 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white">{activeTask.title}</h3>
                <p className="text-sm font-semibold text-amber-500 mt-1">Due Date: {activeTask.dueDate} • {activeTask.points} Pts</p>
              </div>
              <button 
                onClick={() => setActiveTask(null)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-full transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              {activeTask.type === 'multichoice' && (
                <div className="space-y-6">
                  {activeTask.details?.questions?.map((q: any, qIdx: number) => (
                    <div key={qIdx} className="space-y-3 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                      <p className="font-bold text-slate-900 dark:text-white text-lg">Q{qIdx + 1}: {q.questionText}</p>
                      <div className="space-y-2">
                        {q.options?.map((opt: string, optIdx: number) => (
                          <label 
                            key={optIdx} 
                            className={cn(
                              "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all",
                              quizAnswers[qIdx] === optIdx
                                ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-500 text-emerald-700 dark:text-emerald-400 font-semibold"
                                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                            )}
                          >
                            <input 
                              type="radio" 
                              name={`quiz-${qIdx}`}
                              checked={quizAnswers[qIdx] === optIdx}
                              onChange={() => setQuizAnswers({ ...quizAnswers, [qIdx]: optIdx })}
                              className="hidden"
                            />
                            <span className="w-6 h-6 rounded-full border border-slate-300 flex items-center justify-center text-xs font-bold shrink-0">
                              {String.fromCharCode(65 + optIndex)}
                            </span>
                            <span>{opt}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTask.type === 'blanks' && (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <p className="font-semibold text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{activeTask.details?.textWithBlanks}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-600 dark:text-slate-400 mb-2">Your Fill-in Answers / Text</label>
                    <textarea 
                      rows={5}
                      value={textAnswer}
                      onChange={(e) => setTextAnswer(e.target.value)}
                      placeholder="Type your response here..."
                      className="w-full p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium resize-none transition-colors"
                    />
                  </div>
                </div>
              )}

              {activeTask.type === 'written' && (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <p className="font-bold text-slate-800 dark:text-white mb-2">Prompt:</p>
                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{activeTask.details?.writtenPrompt}</p>
                  </div>
                  
                  {activeTask.details?.requireFile && (
                    <div className="p-4 border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-2xl text-center hover:border-emerald-500 transition-colors">
                      <Upload className="mx-auto text-slate-400 mb-2" size={32} />
                      <span className="text-sm font-bold text-slate-600 dark:text-slate-400 block mb-2">Drag file or click to select PDF/ZIP</span>
                      <input 
                        type="file" 
                        onChange={(e) => {
                          if (e.target.files && e.target.files.length > 0) {
                            setTextAnswer(e.target.files[0].name + " (File attached)");
                            showFeedback("File selected successfully!");
                          }
                        }}
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-bold text-slate-600 dark:text-slate-400 mb-2">Your Answer</label>
                    <textarea 
                      rows={6}
                      value={textAnswer}
                      onChange={(e) => setTextAnswer(e.target.value)}
                      placeholder="Type your response or paste code/github URLs..."
                      className="w-full p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium resize-none transition-colors"
                    />
                  </div>
                </div>
              )}

              {activeTask.type === 'video' && (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <p className="font-bold text-slate-800 dark:text-white mb-2">Instructions:</p>
                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{activeTask.details?.videoPrompt}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-600 dark:text-slate-400 mb-2">Video Response URL or Notes</label>
                    <input 
                      type="text"
                      value={textAnswer}
                      onChange={(e) => setTextAnswer(e.target.value)}
                      placeholder="Paste your Loom or YouTube explanation URL..."
                      className="w-full p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium transition-colors"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-4 border-t border-slate-100 dark:border-slate-800 pt-4">
              <Button variant="ghost" onClick={() => setActiveTask(null)} className="font-bold text-slate-500">Cancel</Button>
              <Button 
                onClick={handleSubmitAssignment}
                disabled={submitting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-8 shadow-lg shadow-emerald-500/20"
              >
                {submitting ? <Loader2 className="animate-spin" size={16} /> : 'Submit Answer'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssignmentViewer;
