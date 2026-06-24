import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button } from '../../components/ui';
import AssignmentCreator from '../../components/assignments/AssignmentCreator';
import { Toast } from '../../components/ui/Toast';
import { FileEdit, CheckCircle, Upload, Activity, BarChart3, ChevronRight, BookOpen, UserCheck, Search, MessageSquare, AlertCircle, X } from 'lucide-react';
import { PageHeader } from '../../components/shared';
import { cn } from '../../utils';
import { useAuthStore } from '../../store/authStore';
import { nexus } from '../../lib/nexus';

const MentorshipAssessment = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'create' | 'grade' | 'materials' | 'diagnostics'>('create');
  const [toast, setToast] = useState<{message: string, type: 'success' | 'info'} | null>(null);
  const showFeedback = (msg: string, type: 'success' | 'info' = 'success') => setToast({ message: msg, type });

  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourse, setSelectedCourse] = useState('all');
  const [selectedCourseGrading, setSelectedCourseGrading] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Submissions state
  const [submissionsList, setSubmissionsList] = useState<any[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);

  // Grading modal state
  const [gradingSubmission, setGradingSubmission] = useState<any | null>(null);
  const [gradeScore, setGradeScore] = useState('');
  const [gradeFeedback, setGradeFeedback] = useState('');
  const [submittingGrade, setSubmittingGrade] = useState(false);

  const fetchTutorCourses = async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await nexus.database
        .from('courses')
        .select('id, title')
        .eq('tutor_id', user.id);

      if (data && !error) {
        setCourses(data);
        if (data.length > 0) {
          setSelectedCourse(data[0].id);
        }
      }
    } catch (e) {
      console.error('[Error fetching tutor courses]:', e);
    }
  };

  const fetchSubmissions = async () => {
    setLoadingSubmissions(true);
    try {
      const { data: profiles, error } = await nexus.database
        .from('profiles')
        .select('*');

      if (profiles && !error) {
        const subs: any[] = [];
        profiles.forEach((p: any) => {
          const profileSubs = p.metadata?.submissions;
          if (Array.isArray(profileSubs)) {
            profileSubs.forEach((sub: any) => {
              subs.push({
                ...sub,
                studentId: p.id,
                studentName: p.full_name,
                studentEmail: p.email,
                studentAvatar: p.avatar_url
              });
            });
          }
        });
        setSubmissionsList(subs);
      }
    } catch (e) {
      console.error('[Error fetching submissions]:', e);
    } finally {
      setLoadingSubmissions(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchTutorCourses();
      fetchSubmissions();
    }
  }, [user]);

  const handleGradeSubmission = async () => {
    if (!gradingSubmission || !gradeScore.trim()) return;
    setSubmittingGrade(true);
    try {
      const studentId = gradingSubmission.studentId;
      const assignmentId = gradingSubmission.assignmentId;

      const { data: profile } = await nexus.database
        .from('profiles')
        .select('metadata')
        .eq('id', studentId)
        .single();

      if (profile) {
        const metadata = profile.metadata || {};
        const submissions = metadata.submissions || [];
        const updatedSubmissions = submissions.map((sub: any) => {
          if (sub.assignmentId === assignmentId) {
            return {
              ...sub,
              status: 'Graded',
              score: `${gradeScore}/${gradingSubmission.points || 100}`,
              grade: Number(gradeScore) >= 90 ? 'A' : Number(gradeScore) >= 80 ? 'B' : Number(gradeScore) >= 70 ? 'C' : 'D',
              feedback: gradeFeedback,
              gradedAt: new Date().toISOString()
            };
          }
          return sub;
        });

        const updatedMetadata = {
          ...metadata,
          submissions: updatedSubmissions
        };

        const { error } = await nexus.database
          .from('profiles')
          .update({ metadata: updatedMetadata })
          .eq('id', studentId);

        if (error) throw error;

        showFeedback('Submission graded successfully!');
        setGradingSubmission(null);
        setGradeScore('');
        setGradeFeedback('');
        await fetchSubmissions();
      }
    } catch (e: any) {
      console.error(e);
      alert('Failed to submit grade: ' + (e.message || e));
    } finally {
      setSubmittingGrade(false);
    }
  };

  const tutorCourseIds = courses.map(c => c.id);
  const filteredSubmissions = submissionsList.filter(sub => {
    const isTutorCourse = tutorCourseIds.includes(sub.courseId);
    const matchesCourse = selectedCourseGrading === 'all' || sub.courseId === selectedCourseGrading;
    const matchesSearch = !searchQuery || 
      sub.studentName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      sub.title?.toLowerCase().includes(searchQuery.toLowerCase());
    return isTutorCourse && matchesCourse && matchesSearch;
  });

  const hasCourses = courses.length > 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 max-w-7xl mx-auto">
      {/* Global Premium Header */}
      <PageHeader
        title="Mentorship Assessment"
        description="Design assignments, grade submissions, publish study materials, and audit student progress natively."
        tag="Evaluations & Diagnostics"
        icon={FileEdit}
        className="mb-8"
      />

      <div className="flex flex-col md:flex-row gap-4 mb-8">
        {[
          { id: 'create', icon: FileEdit, label: 'Create Assignment' },
          { id: 'grade', icon: CheckCircle, label: 'Grade Submissions' },
          { id: 'materials', icon: BookOpen, label: 'Publish Study Materials' },
          { id: 'diagnostics', icon: Activity, label: 'Diagnostics & Audit' },
        ].map(tab => (
          <Button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex-1 justify-center py-6 rounded-2xl font-bold transition-all gap-2 border-none shadow-sm",
              activeTab === tab.id 
                ? "bg-brand-primary text-white shadow-xl shadow-emerald-500/30" 
                : "bg-card text-muted-foreground hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-foreground"
            )}
          >
            <tab.icon size={20} /> {tab.label}
          </Button>
        ))}
      </div>
      
      <div className="relative z-10">
          {activeTab === 'create' && (
           <Card className="p-8 border-none shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 rounded-[2.5rem]">
              <div className="mb-8 border-b border-border pb-8">
                <h2 className="text-2xl font-black text-foreground mb-2">Create New Assignment</h2>
                <p className="text-muted-foreground font-medium">Select a course to build an assignment for your cohort.</p>
               
               {!hasCourses ? (
                 <div className="mt-6 p-6 border border-amber-200 bg-amber-50 rounded-2xl flex items-center gap-4">
                   <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600"><AlertCircle size={24}/></div>
                   <div className="flex-1">
                     <h3 className="font-bold text-amber-900">No Courses Available</h3>
                     <p className="text-sm text-amber-700">You must create a course before you can assign tasks to a cohort.</p>
                   </div>
                   <Button onClick={() => navigate('/tutor/courses')} className="bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl">Create Course</Button>
                 </div>
               ) : (
                  <div className="mt-6 space-y-2">
                    <label className="text-sm font-bold text-muted-foreground">Target Course</label>
                    <select 
                      value={selectedCourse}
                      onChange={(e) => setSelectedCourse(e.target.value)}
                      className="w-full md:w-1/2 bg-slate-50 dark:bg-slate-900/50 border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium transition-colors"
                    >
                      {courses.map(c => <option key={c.id} value={c.id} className="bg-background text-foreground">{c.title}</option>)}
                    </select>
                  </div>
               )}
             </div>

             {hasCourses && <AssignmentCreator courseId={selectedCourse} tutorId={user?.id} showFeedback={showFeedback} />}
           </Card>
         )}

          {activeTab === 'grade' && (
           <Card className="p-8 border-none shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 rounded-[2.5rem] space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
                <h2 className="text-2xl font-black text-foreground">Grade Submissions</h2>
                <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                  <select 
                    value={selectedCourseGrading}
                    onChange={(e) => setSelectedCourseGrading(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-900/50 border border-border rounded-xl px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium w-full sm:w-auto transition-colors"
                  >
                    <option value="all" className="bg-background">All Courses</option>
                    {courses.map(c => <option key={c.id} value={c.id} className="bg-background">{c.title}</option>)}
                  </select>
                  <div className="relative w-full sm:w-auto">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input 
                      type="text" 
                      placeholder="Search students..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-foreground placeholder:text-muted-foreground transition-colors" 
                    />
                  </div>
                </div>
              </div>
             
             <div className="space-y-4">
               {loadingSubmissions ? (
                 <div className="text-center py-8 text-muted-foreground font-medium">Loading submissions...</div>
               ) : filteredSubmissions.length === 0 ? (
                 <div className="text-center py-8 text-muted-foreground font-medium">No submissions found matching criteria.</div>
               ) : (
                 filteredSubmissions.map((sub, i) => (
                  <div key={i} className="p-5 border border-border rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-emerald-200 dark:hover:border-emerald-800 transition-colors bg-card">
                    <div className="flex items-center gap-4">
                      <img src={sub.studentAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${sub.studentName}`} className="w-12 h-12 rounded-full border border-border" />
                      <div>
                        <h4 className="font-bold text-foreground">{sub.studentName}</h4>
                        <p className="text-xs text-muted-foreground font-medium">{sub.title} ({sub.type})</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className={cn("text-xs font-black uppercase tracking-widest", sub.status === 'Graded' ? "text-emerald-600" : "text-amber-500")}>{sub.status}</p>
                        <p className="text-lg font-black text-foreground">{sub.score}</p>
                      </div>
                      <Button 
                        variant="outline" 
                        className="gap-2 font-bold text-muted-foreground hover:text-foreground hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl border-border"
                        onClick={() => {
                          setGradingSubmission(sub);
                          setGradeScore(sub.score && sub.score !== '-' ? sub.score.split('/')[0] : '');
                          setGradeFeedback(sub.feedback || '');
                        }}
                      >
                        <MessageSquare size={16} /> {sub.status === 'Graded' ? 'Edit Grade' : 'Grade & Comment'}
                      </Button>
                    </div>
                  </div>
                 ))
               )}
             </div>
           </Card>
          )}

          {activeTab === 'materials' && (
            <Card className="p-8 border-none shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 rounded-[2.5rem] space-y-6 flex flex-col items-center justify-center min-h-[400px] text-center">
              <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-3xl flex items-center justify-center mb-4"><Upload size={40}/></div>
              <h2 className="text-2xl font-black text-foreground">Publish Study Materials</h2>
              <p className="text-muted-foreground font-medium max-w-md">Upload PDFs, video links, or zip files. Published materials automatically sync to your students' personal Library.</p>
              <div className="flex gap-4 mt-4">
                <select className="bg-slate-50 dark:bg-slate-900/50 border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium min-w-[200px] transition-colors">
                  <option className="bg-background">Select Target Course</option>
                  {courses.map(c => <option key={c.id} value={c.id} className="bg-background">{c.title}</option>)}
                </select>
                <label className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl px-8 py-3 cursor-pointer inline-flex items-center justify-center transition-colors">
                  Upload File
                  <input 
                    type="file" 
                    className="hidden" 
                    multiple 
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        showFeedback(`Selected ${e.target.files.length} file(s) for upload.`);
                      }
                    }} 
                  />
                </label>
              </div>
            </Card>
          )}

          {activeTab === 'diagnostics' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-card p-6 rounded-[2rem] border-none shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 transition-colors">
                 <h3 className="text-xl font-black text-foreground flex items-center gap-2"><Activity className="text-indigo-500"/> Select Course for Diagnostics</h3>
                 <select className="bg-slate-50 dark:bg-slate-900/50 border border-border rounded-xl px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium w-full sm:w-auto transition-colors">
                   <option className="bg-background">Overall Performance</option>
                   {courses.map(c => <option key={c.id} value={c.id} className="bg-background">{c.title}</option>)}
                 </select>
              </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Card className="p-8 border-none shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 rounded-[2.5rem]">
                  <h3 className="text-xl font-black text-foreground mb-6 flex items-center gap-2">Course Metrics</h3>
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between text-sm font-bold text-muted-foreground mb-2"><span>Average Cohort Score</span> <span>84%</span></div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3"><div className="bg-indigo-500 h-3 rounded-full" style={{ width: '84%' }}></div></div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm font-bold text-muted-foreground mb-2"><span>Assignment Completion Rate</span> <span>92%</span></div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3"><div className="bg-emerald-500 h-3 rounded-full" style={{ width: '92%' }}></div></div>
                  </div>
                </div>
                <Button className="w-full mt-8 bg-slate-900 dark:bg-slate-800 text-white font-bold rounded-xl" onClick={() => navigate('/diagnostics')}>View Full Analytics</Button>
              </Card>

              <Card className="p-8 border-none shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 rounded-[2.5rem]">
                <h3 className="text-xl font-black text-foreground mb-6 flex items-center gap-2"><UserCheck className="text-emerald-500"/> Student Vivid Audits</h3>
                <div className="space-y-4">
                  {['Alice Smith', 'David Bole'].map((name, i) => (
                    <div key={i} className="p-4 border border-border rounded-2xl flex items-center justify-between hover:border-emerald-200 dark:hover:border-emerald-800 transition-colors bg-card">
                      <div className="flex items-center gap-3">
                        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`} className="w-10 h-10 rounded-full border border-border" />
                        <div><p className="font-bold text-foreground">{name}</p><p className="text-[10px] text-muted-foreground uppercase tracking-widest">Active Mentee</p></div>
                      </div>
                      <Button size="sm" variant="outline" className="font-bold border-border" onClick={() => navigate('/tutor/audit')}>Audit Progress</Button>
                    </div>
                  ))}
                </div>
              </Card>
           </div>
         </div>
       )}
     </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Grading Modal */}
      {gradingSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border w-full max-w-2xl rounded-[2rem] shadow-2xl p-8 max-h-[90vh] overflow-y-auto space-y-6 animate-in zoom-in-95 duration-200 text-left">
            <div className="flex justify-between items-center border-b border-border pb-4">
              <div>
                <h3 className="text-2xl font-black text-foreground">Grade Submission</h3>
                <p className="text-sm font-medium text-muted-foreground">Student: {gradingSubmission.studentName} ({gradingSubmission.studentEmail})</p>
              </div>
              <button onClick={() => setGradingSubmission(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-muted-foreground hover:text-foreground">
                <X size={20} />
              </button>
            </div>

            {/* Submission Content Section */}
            <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-2xl border border-border space-y-4 text-left">
              <h4 className="font-bold text-foreground text-lg">{gradingSubmission.title}</h4>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                Format: {gradingSubmission.type} | Total Points: {gradingSubmission.points || 100}
              </div>
              
              <div className="border-t border-border pt-4">
                <h5 className="font-bold text-sm text-muted-foreground mb-2">Student Response:</h5>
                {gradingSubmission.answers ? (
                  typeof gradingSubmission.answers === 'string' ? (
                    <p className="text-sm font-medium text-foreground whitespace-pre-wrap">{gradingSubmission.answers}</p>
                  ) : Array.isArray(gradingSubmission.answers) ? (
                    <div className="space-y-3">
                      {gradingSubmission.answers.map((ans: any, idx: number) => (
                        <div key={idx} className="p-3 bg-card border border-border rounded-xl text-sm">
                          <p className="font-bold text-foreground mb-1">Q{idx + 1}: {ans.question}</p>
                          <p className="text-slate-500 font-medium">Selected Answer: <span className="text-foreground font-semibold">{ans.selected}</span></p>
                          {ans.correct !== undefined && (
                            <p className="text-xs font-bold text-emerald-600 mt-1">Correct Answer: {ans.correct}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <pre className="text-xs font-mono bg-card p-4 rounded-xl border border-border text-foreground overflow-x-auto font-sans">
                      {JSON.stringify(gradingSubmission.answers, null, 2)}
                    </pre>
                  )
                ) : (
                  <p className="text-sm italic text-muted-foreground">No response content attached.</p>
                )}
              </div>
            </div>

            {/* Grading Form */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-muted-foreground mb-2">Score (Max {gradingSubmission.points || 100})</label>
                  <input 
                    type="number" 
                    max={gradingSubmission.points || 100}
                    min={0}
                    value={gradeScore}
                    onChange={(e) => setGradeScore(e.target.value)}
                    placeholder="e.g. 85"
                    className="w-full p-3 bg-slate-50 dark:bg-slate-900/50 border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium transition-colors"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-muted-foreground mb-2">Feedback & Comments</label>
                <textarea 
                  rows={4}
                  value={gradeFeedback}
                  onChange={(e) => setGradeFeedback(e.target.value)}
                  placeholder="Provide constructive feedback..."
                  className="w-full p-3 bg-slate-50 dark:bg-slate-900/50 border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium resize-none transition-colors"
                />
              </div>
            </div>

            <div className="flex justify-end gap-4 border-t border-border pt-4">
              <Button variant="ghost" onClick={() => setGradingSubmission(null)} className="font-bold text-muted-foreground">Cancel</Button>
              <Button 
                onClick={handleGradeSubmission} 
                disabled={submittingGrade}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 shadow-lg shadow-emerald-500/20"
              >
                {submittingGrade ? 'Submitting...' : 'Submit Grade'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MentorshipAssessment;
