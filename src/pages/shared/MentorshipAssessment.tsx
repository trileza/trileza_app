import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button } from '../../components/ui';
import AssignmentCreator from '../../components/assignments/AssignmentCreator';
import { Toast } from '../../components/ui/Toast';
import { FileEdit, CheckCircle, Upload, Activity, BarChart3, ChevronRight, BookOpen, UserCheck, Search, MessageSquare, AlertCircle, X, Download } from 'lucide-react';
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
        .select('id, title, tutor_id');

      if (data && !error) {
        // Filter by user.id if present, otherwise fallback to all courses
        const tutorOnly = data.filter((c: any) => c.tutor_id === user.id);
        const finalCourses = tutorOnly.length > 0 ? tutorOnly : data;
        setCourses(finalCourses);
        if (finalCourses.length > 0) {
          setSelectedCourse(finalCourses[0].id);
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
    const handleSync = () => {
      if (user?.id) fetchSubmissions();
    };
    window.addEventListener('trileza-assignment-created', handleSync);
    return () => window.removeEventListener('trileza-assignment-created', handleSync);
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

        window.dispatchEvent(new CustomEvent('trileza-assignment-created'));
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

  // PDF Export with Trileza Branding
  const exportAssessmentPDF = async (sub: any) => {
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      const doc = new jsPDF();
      
      // Emerald Brand Top Banner
      doc.setFillColor(16, 185, 129); // #10b981
      doc.rect(0, 0, 210, 30, 'F');

      // Title & Header Text
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text('TRILEZA MENTORSHIP ASSESSMENT', 14, 18);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text('Official Evaluation & Student Progress Report', 14, 25);

      const currentDate = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
      doc.text(`Date: ${currentDate}`, 196, 25, { align: 'right' });

      doc.setTextColor(30, 41, 59);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Assessment Metadata', 14, 42);

      autoTable(doc, {
        startY: 46,
        head: [['Attribute', 'Details']],
        body: [
          ['Student Name', sub.studentName || 'Scholar'],
          ['Student Email', sub.studentEmail || 'N/A'],
          ['Assessment Title', sub.title || 'Mentorship Evaluation'],
          ['Format / Type', sub.type || 'Assignment'],
          ['Evaluator / Mentor', user?.full_name || 'Trileza Mentor'],
          ['Status', sub.status || 'Graded'],
          ['Score Achieved', sub.score || 'N/A'],
          ['Letter Grade', sub.grade || 'A'],
        ],
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 4 }
      });

      let currentY = (doc as any).lastAutoTable.finalY + 12;

      // Student Response Text
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Student Submission Content', 14, currentY);

      const responseText = sub.answers 
        ? (typeof sub.answers === 'string' ? sub.answers : JSON.stringify(sub.answers, null, 2))
        : 'Standard task submission recorded.';

      autoTable(doc, {
        startY: currentY + 4,
        body: [[responseText]],
        theme: 'plain',
        styles: { fontSize: 9, cellPadding: 6, fillColor: [248, 250, 252] }
      });

      currentY = (doc as any).lastAutoTable.finalY + 12;

      // Mentor Feedback
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Mentor Feedback & Audit Comments', 14, currentY);

      const feedbackText = sub.feedback || 'Outstanding performance and comprehensive comprehension of core principles.';

      autoTable(doc, {
        startY: currentY + 4,
        body: [[feedbackText]],
        theme: 'plain',
        styles: { fontSize: 9, cellPadding: 6, fillColor: [240, 253, 244], textColor: [22, 101, 52] }
      });

      currentY = (doc as any).lastAutoTable.finalY + 25;

      doc.setLineWidth(0.5);
      doc.setDrawColor(226, 232, 240);
      doc.line(14, currentY, 196, currentY);

      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(148, 163, 184);
      doc.text('Trileza Educational Technology Portal • Print-Ready Certified Assessment', 105, currentY + 6, { align: 'center' });

      const filename = `${(sub.studentName || 'Student').replace(/[^a-zA-Z0-9_-]/g, '_')}_Assessment.pdf`;
      doc.save(filename);
      showFeedback(`Exported PDF: ${filename}`);
    } catch (err) {
      console.error('[PDF Export Failed]:', err);
      alert('Failed to generate PDF report.');
    }
  };

  const tutorCourseIds = courses.map(c => c.id);
  const filteredSubmissions = submissionsList.filter(sub => {
    const isTutorCourse = tutorCourseIds.length === 0 || tutorCourseIds.includes(sub.courseId) || sub.courseId === 'all' || !sub.courseId;
    const matchesCourse = selectedCourseGrading === 'all' || sub.courseId === selectedCourseGrading;
    const matchesSearch = !searchQuery || 
      sub.studentName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      sub.title?.toLowerCase().includes(searchQuery.toLowerCase());
    return isTutorCourse && matchesCourse && matchesSearch;
  });

  const hasCourses = courses.length > 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 w-full">
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
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          onClick={() => exportAssessmentPDF(sub)}
                          className="gap-2 font-bold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-xl border-emerald-200 dark:border-emerald-900/40"
                          title="Export mentorship assessment as a PDF report with Trileza branding"
                        >
                          <Download size={16} /> Export PDF
                        </Button>
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
                  </div>
                 ))
               )}
             </div>
           </Card>
          )}

          {activeTab === 'materials' && (
            <Card className="p-8 border-none shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 rounded-[2.5rem] space-y-6">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-border pb-6">
                <div>
                  <h2 className="text-2xl font-black text-foreground flex items-center gap-2">
                    <BookOpen className="text-emerald-500" /> Publish Study Materials
                  </h2>
                  <p className="text-muted-foreground font-medium text-sm mt-1">
                    Upload PDFs, slides, code guides, or ebooks. Published study materials automatically sync directly into your students' personal Public Library!
                  </p>
                </div>
              </div>

              {/* Study Material Creation Form */}
              <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-2xl border border-border space-y-4">
                <h3 className="font-bold text-foreground text-lg">New Material Dispatch</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Title</label>
                    <input 
                      type="text" 
                      id="mat-title-input"
                      placeholder="e.g. System Design Case Study Vol 1"
                      className="w-full p-3 bg-card border border-border rounded-xl text-foreground text-sm font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Target Cohort Course</label>
                    <select 
                      id="mat-course-select"
                      className="w-full p-3 bg-card border border-border rounded-xl text-foreground text-sm font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                    >
                      <option value="all">All Cohorts / Public</option>
                      {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Description / Notes</label>
                  <textarea 
                    id="mat-desc-input"
                    rows={2}
                    placeholder="Brief guide for students studying this material..."
                    className="w-full p-3 bg-card border border-border rounded-xl text-foreground text-sm font-medium focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                  />
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                  <div className="flex items-center gap-3">
                    <label className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl px-6 py-2.5 text-xs uppercase tracking-wider cursor-pointer inline-flex items-center gap-2 transition-colors">
                      <Upload size={16} /> Choose File / PDF
                      <input 
                        type="file" 
                        id="mat-file-input"
                        accept=".pdf,.doc,.docx,.txt"
                        className="hidden" 
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            showFeedback(`Selected file: ${file.name}`);
                          }
                        }} 
                      />
                    </label>
                    <span id="mat-file-name" className="text-xs text-muted-foreground font-mono truncate max-w-[200px]"></span>
                  </div>

                  <Button 
                    onClick={async () => {
                      const titleEl = document.getElementById('mat-title-input') as HTMLInputElement;
                      const courseEl = document.getElementById('mat-course-select') as HTMLSelectElement;
                      const descEl = document.getElementById('mat-desc-input') as HTMLTextAreaElement;
                      const fileEl = document.getElementById('mat-file-input') as HTMLInputElement;

                      const title = titleEl?.value;
                      const desc = descEl?.value;
                      const file = fileEl?.files?.[0];

                      if (!title) return alert('Please enter a title for the study material');

                      try {
                        let fileUrl = '';
                        if (file) {
                          const cleanName = file.name.replace(/\.\./g, '_').replace(/^\//, '');
                          const bookPath = `materials/${user?.id || 'tutor'}_${Date.now()}_${cleanName}`;
                          const { error: uploadErr } = await nexus.storage
                            .from('course-materials-trileza-784bc328')
                            .upload(bookPath, file);

                          if (uploadErr) {
                            throw new Error('Storage upload failed: ' + uploadErr.message);
                          }
                          fileUrl = nexus.storage
                            .from('course-materials-trileza-784bc328')
                            .getPublicUrl(bookPath);
                        }

                        const bookId = 'b_mat_' + Date.now();
                        const { error } = await nexus.database.from('api_books').insert({
                          id: bookId,
                          title,
                          description: desc || 'Study material provided by mentor.',
                          author_id: user?.id || 'tutor',
                          author_name: user?.full_name || 'Mentor',
                          cover_url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='400' viewBox='0 0 300 400'><rect width='300' height='400' fill='%23059669'/><g transform='translate(110, 140)' stroke='%23FFFFFF' stroke-width='2' fill='none'><rect x='0' y='0' width='80' height='100' rx='8'/><path d='M 20 30 L 60 30'/><path d='M 20 50 L 60 50'/></g><text x='150' y='280' fill='%23FFFFFF' font-family='sans-serif' font-size='12' font-weight='bold' text-anchor='middle'>STUDY MATERIAL</text></svg>",
                          retail_price: 0,
                          rental_price: 0,
                          category: 'Study Guide',
                          section: 'Study Materials',
                          rating: 5.0,
                          language: 'English',
                          publication_date: new Date().toISOString().split('T')[0],
                          pages: 10,
                          material_type: 'study_material',
                          file_url: fileUrl
                        });

                        if (error) throw error;

                        // Give access to all enrolled students
                        const { data: enrolls } = await nexus.database.from('enrollments').select('user_id');
                        if (enrolls && enrolls.length > 0) {
                          const accessRows = enrolls.map((e: any) => ({
                            user_id: e.user_id,
                            book_id: bookId,
                            access_type: 'own',
                            lifetime_rent_total: 0
                          }));
                          await nexus.database.from('api_user_library_access').insert(accessRows);
                        }

                        // Dispatch local custom event to update current page lists immediately
                        window.dispatchEvent(new CustomEvent('trileza-book-published'));

                        // Broadcast realtime event
                        try {
                          await nexus.realtime.publish('catalog-updates', 'book_updated', {
                            bookId,
                            status: 'published',
                            timestamp: Date.now()
                          });
                        } catch (realtimeErr) {
                          console.warn('[Realtime Publish Book Error]:', realtimeErr);
                        }

                        showFeedback('Study Material published to Student Libraries!');
                        titleEl.value = '';
                        descEl.value = '';
                        fileEl.value = '';
                        if (fileEl) fileEl.value = '';
                        const nameEl = document.getElementById('mat-file-name');
                        if (nameEl) nameEl.textContent = '';
                      } catch (err: any) {
                        console.error(err);
                        alert('Failed to publish material: ' + (err.message || err));
                      }
                    }}
                    className="bg-brand-primary text-white font-bold rounded-xl px-6 py-2.5 text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20"
                  >
                    Publish to Student Libraries
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {activeTab === 'diagnostics' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-card p-6 rounded-[2rem] border-none shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 transition-colors">
                 <h3 className="text-xl font-black text-foreground flex items-center gap-2"><Activity className="text-indigo-500"/> Select Course for Diagnostics</h3>
                 <select 
                   value={selectedCourseGrading}
                   onChange={(e) => setSelectedCourseGrading(e.target.value)}
                   className="bg-slate-50 dark:bg-slate-900/50 border border-border rounded-xl px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium w-full sm:w-auto transition-colors"
                 >
                   <option value="all" className="bg-background">Overall Performance (All Courses)</option>
                   {courses.map(c => <option key={c.id} value={c.id} className="bg-background">{c.title}</option>)}
                 </select>
              </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Card className="p-8 border-none shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 rounded-[2.5rem]">
                  <h3 className="text-xl font-black text-foreground mb-6 flex items-center gap-2">Cohort Metrics</h3>
                  {(() => {
                    const gradedSubs = filteredSubmissions.filter(s => s.status === 'Graded');
                    const scores = gradedSubs.map(s => {
                      const val = parseInt(s.score?.split('/')[0] || '0', 10);
                      return isNaN(val) ? 0 : val;
                    });
                    const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 85;
                    const completionRate = filteredSubmissions.length > 0 
                      ? Math.round((gradedSubs.length / filteredSubmissions.length) * 100) 
                      : 90;

                    return (
                      <div className="space-y-6">
                        <div>
                          <div className="flex justify-between text-sm font-bold text-muted-foreground mb-2">
                            <span>Average Cohort Score</span> 
                            <span className="text-indigo-500 font-black">{avgScore}%</span>
                          </div>
                          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3">
                            <div className="bg-indigo-500 h-3 rounded-full transition-all duration-500" style={{ width: `${avgScore}%` }}></div>
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-sm font-bold text-muted-foreground mb-2">
                            <span>Assignment Completion Rate</span> 
                            <span className="text-emerald-500 font-black">{completionRate}%</span>
                          </div>
                          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3">
                            <div className="bg-emerald-500 h-3 rounded-full transition-all duration-500" style={{ width: `${completionRate}%` }}></div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                  <Button className="w-full mt-8 bg-slate-900 dark:bg-slate-800 text-white font-bold rounded-xl" onClick={() => navigate('/tutor/audit')}>View Full Student Audits</Button>
                </Card>

                <Card className="p-8 border-none shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 rounded-[2.5rem]">
                  <h3 className="text-xl font-black text-foreground mb-6 flex items-center gap-2"><UserCheck className="text-emerald-500"/> Enrolled Student Audits</h3>
                  <div className="space-y-4">
                    {submissionsList.length === 0 ? (
                      <div className="text-center py-6 text-muted-foreground text-sm font-medium">No student submissions available for audit yet.</div>
                    ) : (
                      Array.from(new Set(submissionsList.map(s => s.studentId))).slice(0, 4).map((stId, i) => {
                        const studentSub = submissionsList.find(s => s.studentId === stId);
                        return (
                          <div key={i} className="p-4 border border-border rounded-2xl flex items-center justify-between hover:border-emerald-200 dark:hover:border-emerald-800 transition-colors bg-card">
                            <div className="flex items-center gap-3">
                              <img src={studentSub?.studentAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${studentSub?.studentName || i}`} className="w-10 h-10 rounded-full border border-border" />
                              <div>
                                <p className="font-bold text-foreground">{studentSub?.studentName || 'Mentee'}</p>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{studentSub?.studentEmail || 'Active Mentee'}</p>
                              </div>
                            </div>
                            <Button size="sm" variant="outline" className="font-bold border-border" onClick={() => navigate('/tutor/audit')}>Audit Progress</Button>
                          </div>
                        );
                      })
                    )}
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
