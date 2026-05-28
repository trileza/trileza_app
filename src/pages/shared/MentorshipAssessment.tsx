import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button } from '../../components/ui';
import AssignmentCreator from '../../components/assignments/AssignmentCreator';
import { Toast } from '../../components/ui/Toast';
import { FileEdit, CheckCircle, Upload, Activity, BarChart3, ChevronRight, BookOpen, UserCheck, Search, MessageSquare, AlertCircle } from 'lucide-react';
import { PageHeader } from '../../components/shared';
import { cn } from '../../utils';

const MentorshipAssessment = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'create' | 'grade' | 'materials' | 'diagnostics'>('create');
  const [toast, setToast] = useState<{message: string, type: 'success' | 'info'} | null>(null);
  const showFeedback = (msg: string, type: 'success' | 'info' = 'success') => setToast({ message: msg, type });

  // Mock checking if courses exist for Task 4
  const hasCourses = true; // For prototype demo, we pretend they have courses
  const courses = [
    { id: 'c1', title: 'Advanced Agentic Coding' },
    { id: 'c2', title: 'AI Systems Architecture' },
    { id: 'c3', title: 'High-Fidelity UI Design' }
  ];
  
  const [selectedCourse, setSelectedCourse] = useState(courses[0].id);

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

             {hasCourses && <AssignmentCreator showFeedback={showFeedback} />}
           </Card>
         )}

          {activeTab === 'grade' && (
           <Card className="p-8 border-none shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 rounded-[2.5rem] space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
                <h2 className="text-2xl font-black text-foreground">Grade Submissions</h2>
                <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                  <select className="bg-slate-50 dark:bg-slate-900/50 border border-border rounded-xl px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium w-full sm:w-auto transition-colors">
                    <option className="bg-background">All Courses</option>
                    {courses.map(c => <option key={c.id} value={c.id} className="bg-background">{c.title}</option>)}
                  </select>
                  <div className="relative w-full sm:w-auto">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input type="text" placeholder="Search students..." className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-foreground placeholder:text-muted-foreground transition-colors" />
                  </div>
                </div>
              </div>
             
             <div className="space-y-4">
               {[
                 { name: 'Alice Smith', assignment: 'Architecture Review', status: 'Pending Grade', score: '-' },
                 { name: 'Michael Chen', assignment: 'Architecture Review', status: 'Graded', score: '92/100' },
                 { name: 'Sarah Jenkins', assignment: 'React Components', status: 'Pending Grade', score: '-' }
               ].map((sub, i) => (
                  <div key={i} className="p-5 border border-border rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-emerald-200 dark:hover:border-emerald-800 transition-colors bg-card">
                    <div className="flex items-center gap-4">
                      <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${sub.name}`} className="w-12 h-12 rounded-full border border-border" />
                      <div>
                        <h4 className="font-bold text-foreground">{sub.name}</h4>
                        <p className="text-xs text-muted-foreground font-medium">{sub.assignment}</p>
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
                        onClick={() => showFeedback(`Opening grading panel for ${sub.name}`)}
                      >
                        <MessageSquare size={16} /> {sub.status === 'Graded' ? 'Edit Grade' : 'Grade & Comment'}
                      </Button>
                    </div>
                  </div>
               ))}
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
    </div>
  );
};

export default MentorshipAssessment;
