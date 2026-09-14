import React from 'react';
import { Card, Button } from '../../components/ui';
import { 
  Search, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  MoreVertical,
  BookOpen,
  Users,
  ChevronRight,
  ArrowLeft,
  Video,
  Loader2,
  Download,
  Mail
} from 'lucide-react';
import { cn } from '../../utils';
import { motion } from 'framer-motion';
import { nexus } from '../../lib/nexus';
import { useAuthStore } from '../../store/authStore';


const StudentAudit = () => {
  const [selectedCourse, setSelectedCourse] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState<'progress' | 'live-attendance'>('progress');
  const [liveSessions, setLiveSessions] = React.useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = React.useState(false);
  const [selectedSession, setSelectedSession] = React.useState<any | null>(null);
  const [attendanceRecords, setAttendanceRecords] = React.useState<any[]>([]);
  const [loadingAttendance, setLoadingAttendance] = React.useState(false);
  const [emailSending, setEmailSending] = React.useState(false);
  const [emailSent, setEmailSent] = React.useState(false);
  const { user } = useAuthStore();

  // Fetch live sessions
  React.useEffect(() => {
    if (activeTab === 'live-attendance') {
      const fetchSessions = async () => {
        setLoadingSessions(true);
        try {
          const { data, error } = await nexus.database
            .from('live_sessions')
            .select('*')
            .order('scheduled_at', { ascending: false });
          if (error) throw error;
          setLiveSessions(data || []);
        } catch (err) {
          console.error('[Audit] Failed to load live sessions:', err);
        } finally {
          setLoadingSessions(false);
        }
      };
      fetchSessions();
    }
  }, [activeTab]);

  // Fetch session participant attendance logs with contact info
  React.useEffect(() => {
    if (selectedSession) {
      const fetchAttendance = async () => {
        setLoadingAttendance(true);
        try {
          // Fetch session participants logs
          const { data: participantsData, error: participantsError } = await nexus.database
            .from('session_participants')
            .select('*')
            .eq('session_id', selectedSession.id)
            .order('joined_at', { ascending: true });

          if (participantsError) throw participantsError;

          const records = participantsData || [];
          const userIds = Array.from(new Set(records.map(p => p.user_id).filter(Boolean)));
          
          let profilesMap: Record<string, any> = {};
          if (userIds.length > 0) {
            const { data: profilesData, error: profilesError } = await nexus.database
              .from('profiles')
              .select('id, email')
              .in('id', userIds);
            
            if (!profilesError && profilesData) {
              profilesMap = profilesData.reduce((acc, p) => {
                acc[p.id] = p;
                return acc;
              }, {} as Record<string, any>);
            }
          }

          // Combine with email contact
          const combined = records.map(p => ({
            ...p,
            email: profilesMap[p.user_id]?.email || 'No email contact'
          }));

          setAttendanceRecords(combined);
        } catch (err) {
          console.error('[Audit] Failed to load attendance:', err);
        } finally {
          setLoadingAttendance(false);
        }
      };
      fetchAttendance();
    }
  }, [selectedSession]);

  const downloadCSV = () => {
    if (attendanceRecords.length === 0 || !selectedSession) return;
    
    const headers = ['Participant Name', 'Contact/Email', 'Role', 'Joined At', 'Left At', 'Duration (Seconds)'];
    const rows = attendanceRecords.map(r => [
      r.display_name,
      r.email,
      r.role,
      r.joined_at ? new Date(r.joined_at).toLocaleString() : 'N/A',
      r.left_at ? new Date(r.left_at).toLocaleString() : 'Active / Present',
      r.duration_seconds !== null && r.duration_seconds !== undefined ? r.duration_seconds : 'N/A'
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Attendance_Report_${selectedSession.title.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const emailReport = async () => {
    if (attendanceRecords.length === 0 || !selectedSession) return;
    if (!user?.email) {
      alert('Host email profile not found!');
      return;
    }
    
    setEmailSending(true);
    try {
      const sessionTitle = selectedSession.title;
      const sessionDate = new Date(selectedSession.scheduled_at).toLocaleDateString();
      
      const rowsHtml = attendanceRecords.map(r => {
        const joinTime = new Date(r.joined_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const leaveTime = r.left_at 
          ? new Date(r.left_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          : 'Active / Present';
        
        let durationText = 'N/A';
        if (r.duration_seconds !== undefined && r.duration_seconds !== null) {
          const mins = Math.floor(r.duration_seconds / 60);
          const secs = r.duration_seconds % 60;
          durationText = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
        } else if (!r.left_at) {
          durationText = 'In Progress';
        }

        return `
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px;">${r.display_name}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-family: monospace;">${r.email}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; text-transform: uppercase;">${r.role}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px;">${joinTime}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px;">${leaveTime}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: bold; text-align: right;">${durationText}</td>
          </tr>
        `;
      }).join('');

      const emailHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 24px; color: #1e293b; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 24px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <div style="text-align: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #f1f5f9;">
            <h1 style="font-size: 24px; font-weight: 800; color: #43A047; margin: 0;">Trileza Classroom</h1>
            <p style="font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.15em; margin-top: 4px; margin-bottom: 0;">Attendance Audit Report</p>
          </div>
          <div style="margin-bottom: 24px; font-size: 14px;">
            <p style="margin: 0 0 8px 0;"><strong>Class Topic:</strong> ${sessionTitle}</p>
            <p style="margin: 0 0 8px 0;"><strong>Host/Tutor:</strong> ${user?.full_name || 'Tutor'}</p>
            <p style="margin: 0 0 16px 0;"><strong>Session Date:</strong> ${sessionDate}</p>
          </div>
          <table style="width: 100%; border-collapse: collapse; text-align: left; margin-bottom: 24px;">
            <thead>
              <tr style="background-color: #f8fafc;">
                <th style="padding: 12px 10px; border-bottom: 2px solid #e2e8f0; font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase;">Participant</th>
                <th style="padding: 12px 10px; border-bottom: 2px solid #e2e8f0; font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase;">Contact/Email</th>
                <th style="padding: 12px 10px; border-bottom: 2px solid #e2e8f0; font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase;">Role</th>
                <th style="padding: 12px 10px; border-bottom: 2px solid #e2e8f0; font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase;">Joined At</th>
                <th style="padding: 12px 10px; border-bottom: 2px solid #e2e8f0; font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase;">Left At</th>
                <th style="padding: 12px 10px; border-bottom: 2px solid #e2e8f0; font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; text-align: right;">Stay Duration</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          <div style="text-align: center; margin-top: 40px; padding-top: 16px; border-top: 1px solid #f1f5f9; font-size: 11px; color: #94a3b8;">
            Sent automatically from your Trileza classroom workspace.
          </div>
        </div>
      `;

      const { error } = await nexus.emails.send({
        to: user.email,
        subject: `Attendance Audit: ${sessionTitle} (${sessionDate})`,
        html: emailHtml
      });

      if (error) throw error;

      setEmailSent(true);
      setTimeout(() => setEmailSent(false), 3000);
    } catch (err) {
      console.error('[Audit] Email report failed:', err);
      alert('Failed to send email. Please try again.');
    } finally {
      setEmailSending(false);
    }
  };

  const [dbStudents, setDbStudents] = React.useState<any[]>([]);

  // Fetch real enrolled students from database
  React.useEffect(() => {
    const fetchStudents = async () => {
      try {
        // Scoped to courses this tutor owns. It previously read every
        // enrollment and profile on the platform, so the roster showed other
        // tutors' students and the figures above it were wrong.
        const { data: myCourses } = await nexus.database
          .from('courses')
          .select('id, title')
          .eq('tutor_id', user?.id);

        const myCourseIds = (myCourses || []).map((c: any) => c.id);

        const { data: enrolls } = myCourseIds.length > 0
          ? await nexus.database
              .from('enrollments')
              .select('id, user_id, item_id, item_title, progress, status, last_accessed, amount')
              .in('item_id', myCourseIds)
          : { data: [] as any[] };

        const learnerIds = Array.from(new Set((enrolls || []).map((e: any) => e.user_id).filter(Boolean)));
        const { data: profiles } = learnerIds.length > 0
          ? await nexus.database
              .from('profiles')
              .select('id, full_name, avatar_url, last_active_at')
              .in('id', learnerIds)
          : { data: [] as any[] };

        if (enrolls && profiles) {
          const profilesMap = (profiles as any[]).reduce((acc: Record<string, any>, p: any) => {
            acc[p.id] = p;
            return acc;
          }, {} as Record<string, any>);

          const mapped = enrolls.map((e: any, idx: number) => {
            const prof = profilesMap[e.user_id] || {};
            const progressVal = Number(e.progress) || 0;
            return {
              id: e.id || idx,
              name: prof.full_name || e.item_title || 'Enrolled Mentee',
              course: e.item_title || 'Full-Stack Mentorship',
              progress: progressVal,
              lastActive: 'Active recently',
              status: progressVal >= 90 ? 'Completed' : progressVal >= 50 ? 'On Track' : 'Falling Behind',
              enrolled: '1,200',
              email: prof.email || 'No email'
            };
          });

          if (mapped.length > 0) {
            setDbStudents(mapped);
          }
        }
      } catch (err) {
        console.error('[Audit] Failed to load student audits:', err);
      }
    };
    fetchStudents();
  }, []);

  // Only real enrolled learners. This list used to fall back to four invented
  // students, which meant the "At Risk" counter reported on people who did not
  // exist.
  const students = dbStudents;

  const courses = Array.from(new Set(students.map(s => s.course)));
  const filteredStudents = students.filter(s => s.course === selectedCourse);

  const avgProgress = selectedCourse ? Math.round(filteredStudents.reduce((acc, s) => acc + s.progress, 0) / (filteredStudents.length || 1)) || 0 : 0;
  const atRiskCount = selectedCourse ? filteredStudents.filter(s => s.progress < 30).length : 0;
  const completionRate = selectedCourse ? Math.round((filteredStudents.filter(s => s.status === 'Completed').length / (filteredStudents.length || 1)) * 100) || 0 : 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 font-sans">
      {/* Global Premium Header */}
      <div className="mentor-hero flex flex-col md:flex-row md:items-center justify-between gap-6 p-8 md:p-12 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden mb-8">
        <div className="absolute -top-32 -left-32 w-80 h-80 bg-emerald-500 rounded-full blur-[100px] opacity-30 animate-pulse" />
        <div className="absolute right-0 bottom-0 w-80 h-80 bg-brand-primary rounded-full blur-[100px] opacity-20 translate-y-1/2 translate-x-1/3" />
        
        <div className="relative z-10">
          {selectedCourse && (
            <button 
              onClick={() => setSelectedCourse(null)}
              className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-widest mb-4 hover:text-emerald-300 transition-colors group bg-white/10 px-3 py-1.5 rounded-lg border border-white/20 w-max backdrop-blur-md cursor-pointer"
            >
              <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> Back to Catalog
            </button>
          )}
          {selectedSession && (
            <button 
              onClick={() => setSelectedSession(null)}
              className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-widest mb-4 hover:text-emerald-300 transition-colors group bg-white/10 px-3 py-1.5 rounded-lg border border-white/20 w-max backdrop-blur-md cursor-pointer"
            >
              <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> Back to Sessions
            </button>
          )}
          
          <div className="flex items-center gap-2 mb-3">
             <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-lg">
                {activeTab === 'progress' ? (
                  <Users className="text-emerald-400" size={20} />
                ) : (
                  <Video className="text-emerald-400" size={20} />
                )}
             </div>
             <span className="text-emerald-400 font-black tracking-[0.2em] uppercase text-xs">Analytics Center</span>
          </div>
          
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white">
            {selectedCourse ? selectedCourse : selectedSession ? selectedSession.title : activeTab === 'progress' ? 'Student Audit Catalog' : 'Live Class Attendance'}
          </h1>
          <p className="text-slate-400 font-medium max-w-xl text-lg mt-2 font-sans">
            {selectedCourse 
              ? `Real-time performance audit for ${filteredStudents.length} active students in this cohort.`
              : selectedSession 
              ? `Attendance logs for the live session hosted on ${new Date(selectedSession.scheduled_at).toLocaleDateString()}.`
              : activeTab === 'progress' 
              ? 'Direct oversight of mentee progression across all high-performance courses.'
              : 'Audit attendance logs, participation, and stay durations for live classroom broadcasts.'}
          </p>
        </div>
        
        {selectedCourse && (
          <div className="relative z-10 w-full md:w-auto">
            <div className="relative font-sans">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Search students..." 
                className="w-full md:w-64 pl-12 pr-4 py-3.5 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md text-white outline-none focus:ring-2 focus:ring-emerald-500/50 font-medium placeholder:text-slate-500 shadow-inner"
              />
            </div>
          </div>
        )}
      </div>

      {/* Tab Selector */}
      {!selectedCourse && !selectedSession && (
        <div className="flex gap-6 border-b border-slate-200 pb-px font-sans">
          <button
            onClick={() => setActiveTab('progress')}
            className={cn(
              "pb-4 font-black uppercase tracking-wider text-xs border-b-2 transition-all px-2 cursor-pointer bg-transparent border-none outline-none",
              activeTab === 'progress' 
                ? "border-emerald-500 text-emerald-600 font-black" 
                : "border-transparent text-slate-400 hover:text-slate-600 font-bold"
            )}
          >
            Course Progression
          </button>
          <button
            onClick={() => setActiveTab('live-attendance')}
            className={cn(
              "pb-4 font-black uppercase tracking-wider text-xs border-b-2 transition-all px-2 cursor-pointer bg-transparent border-none outline-none",
              activeTab === 'live-attendance' 
                ? "border-emerald-500 text-emerald-600 font-black" 
                : "border-transparent text-slate-400 hover:text-slate-600 font-bold"
            )}
          >
            Live Session Attendance
          </button>
        </div>
      )}

      {/* Progress Tab - Course List */}
      {activeTab === 'progress' && !selectedCourse && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 font-sans">
          {courses.map(course => {
            const courseStudents = students.filter(s => s.course === course);
            const courseCompletion = Math.round((courseStudents.filter(s => s.status === 'Completed').length / courseStudents.length) * 100);
            
            return (
              <Card 
                key={course}
                className="group p-6 overflow-hidden cursor-pointer hover:shadow-2xl hover:shadow-emerald-500/10 transition-all border-none ring-1 ring-slate-200 bg-white rounded-[2rem] flex flex-col justify-between"
                onClick={() => setSelectedCourse(course)}
              >
                <div>
                  <div className="flex justify-between items-start mb-6">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center ring-1 ring-emerald-100 group-hover:bg-emerald-500 group-hover:text-white transition-colors shadow-sm">
                      <BookOpen size={24} />
                    </div>
                    <div className="px-3 py-1.5 rounded-full bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest border border-slate-200">
                      Active
                    </div>
                  </div>
                  
                  <h3 className="text-2xl font-black text-slate-900 leading-tight mb-6">{course}</h3>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Learners</p>
                      <div className="flex items-center gap-2">
                         <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                         <p className="text-xl font-black text-slate-900 tracking-tight">{courseStudents[0].enrolled}</p>
                      </div>
                    </div>
                    <div className="space-y-0.5 text-right">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Yield</p>
                      <p className="text-xl font-black text-emerald-600">{courseCompletion}%</p>
                    </div>
                  </div>
                  
                  <div className="relative pt-1">
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${courseCompletion}%` }}
                        className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full" 
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-100 pt-5">
                     <div className="flex -space-x-2">
                        {[1,2,3].map(i => (
                           <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 ring-1 ring-slate-200" />
                        ))}
                        <div className="w-8 h-8 rounded-full border-2 border-white bg-emerald-500 flex items-center justify-center text-[10px] font-black text-white shadow-lg ring-1 ring-emerald-500/20">
                          +{courseStudents.length}
                        </div>
                     </div>
                     <button className="flex items-center gap-1.5 text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] group-hover:translate-x-1 transition-transform bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-100 cursor-pointer">
                        Detail <ChevronRight size={14} />
                     </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Progress Tab - Student List */}
      {activeTab === 'progress' && selectedCourse && (
        <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500 font-sans">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { label: 'Completion Rate', value: `${completionRate}%`, icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50' },
              { label: 'Avg. Progress', value: `${avgProgress}%`, icon: Users, color: 'text-brand-primary', bg: 'bg-emerald-50/50' },
              { label: 'At Risk Learners', value: atRiskCount, icon: AlertCircle, color: 'text-orange-500', bg: 'bg-orange-50' },
            ].map((stat, i) => (
              <Card key={i} className="border-none ring-1 ring-slate-100 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className={cn("p-4 rounded-2xl", stat.bg)}>
                    <stat.icon className={stat.color} size={28} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
                    <h3 className="text-3xl font-black mt-1 text-slate-900">{stat.value}</h3>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <Card className="overflow-hidden p-0 border-none shadow-2xl shadow-slate-200/50 ring-1 ring-slate-100 rounded-[2rem]">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50 border-b border-slate-100">
                  <tr>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Student</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Progression</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Last Pulse</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Intervention</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredStudents.map((student) => (
                    <tr key={student.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-brand-primary/10 text-brand-primary flex items-center justify-center font-black text-sm border border-brand-primary/5 font-sans">
                            {student.name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div>
                            <p className="font-black text-slate-900 text-sm leading-none mb-1">{student.name}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">ID: #TZ-0{student.id}202</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="w-full max-w-[140px] space-y-2">
                          <div className="flex justify-between text-[10px] font-black text-slate-600">
                            <span>{student.progress}%</span>
                            <TrendingUp size={12} className="text-brand-primary" />
                          </div>
                          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className={cn(
                                "h-full rounded-full transition-all duration-700",
                                student.progress === 100 ? "bg-emerald-600" : "bg-brand-primary"
                              )} 
                              style={{ width: `${student.progress}%` }} 
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <span className={cn(
                          "px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-[0.1em]",
                          student.status === 'Completed' ? "bg-brand-primary/10 text-brand-primary border border-brand-primary/10" :
                          student.status === 'On Track' ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
                          student.status === 'Falling Behind' ? "bg-orange-50 text-orange-600 border border-orange-100" :
                          "bg-red-50 text-red-600 border border-red-100"
                        )}>
                          {student.status}
                        </span>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-2">
                           <Clock size={14} className="text-slate-300" />
                           <span className="text-[11px] text-slate-500 font-bold">{student.lastActive}</span>
                        </div>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <Button variant="ghost" size="icon" className="hover:bg-brand-primary/5 hover:text-brand-primary">
                          <MoreVertical size={16} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-6 bg-slate-50/50 border-t border-slate-100 text-center">
              <button className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] hover:text-brand-primary transition-colors cursor-pointer bg-transparent border-none">Load Extended Audit Records</button>
            </div>
          </Card>
        </div>
      )}

      {/* Live Attendance Tab - Sessions List */}
      {activeTab === 'live-attendance' && !selectedSession && (
        <div className="space-y-6 font-sans">
          {loadingSessions ? (
            <div className="text-center py-10">
              <Loader2 className="animate-spin text-emerald-500 mx-auto mb-2" size={24} />
              <p className="text-xs text-slate-500 font-bold">Loading live sessions...</p>
            </div>
          ) : liveSessions.length === 0 ? (
            <Card className="p-8 text-center text-slate-500 font-bold border-none ring-1 ring-slate-100 shadow-sm rounded-[2rem]">
              No live classroom sessions found. Create a session in the Live Studio to get started!
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {liveSessions.map(session => (
                <Card 
                  key={session.id}
                  className="group p-6 overflow-hidden cursor-pointer hover:shadow-2xl hover:shadow-emerald-500/10 transition-all border-none ring-1 ring-slate-200 bg-white rounded-[2rem] flex flex-col justify-between"
                  onClick={() => setSelectedSession(session)}
                >
                  <div>
                    <div className="flex justify-between items-start mb-6">
                      <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center ring-1 ring-emerald-100 group-hover:bg-emerald-500 group-hover:text-white transition-colors shadow-sm">
                        <Video size={24} />
                      </div>
                      <div className={cn(
                        "px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border",
                        session.status === 'live' 
                          ? "bg-red-50 text-red-600 border-red-200 animate-pulse" 
                          : "bg-slate-50 text-slate-500 border-slate-200"
                      )}>
                        {session.status}
                      </div>
                    </div>
                    
                    <h3 className="text-2xl font-black text-slate-900 leading-tight mb-4">{session.title}</h3>
                    <p className="text-xs font-semibold text-slate-400 mb-6">
                      {new Date(session.scheduled_at).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-100 pt-5">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Session Audit
                    </span>
                    <button className="flex items-center gap-1.5 text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] group-hover:translate-x-1 transition-transform bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-100 cursor-pointer">
                      Audit Attendance <ChevronRight size={14} />
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Live Attendance Tab - Session Participant Details */}
      {activeTab === 'live-attendance' && selectedSession && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 font-sans">
          
          {/* Action Header Card */}
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-white border border-slate-200 p-6 rounded-[2rem] shadow-sm">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-emerald-600">Audit session</p>
              <h2 className="text-xl font-black text-slate-800 mt-1">{selectedSession.title}</h2>
              <p className="text-xs font-semibold text-slate-400 mt-1 font-sans">
                Hosted on {new Date(selectedSession.scheduled_at).toLocaleString()}
              </p>
            </div>
            
            {attendanceRecords.length > 0 && (
              <div className="flex items-center gap-3">
                <button
                  onClick={downloadCSV}
                  className="flex items-center justify-center gap-2 py-3 px-5 rounded-2xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-black uppercase tracking-wider cursor-pointer shadow-sm transition-all"
                >
                  <Download size={14} className="text-slate-500" />
                  Download CSV
                </button>
                <button
                  onClick={emailReport}
                  disabled={emailSending}
                  className="flex items-center justify-center gap-2 py-3 px-5 rounded-2xl bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-75 text-xs font-black uppercase tracking-wider cursor-pointer shadow-lg shadow-emerald-500/10 transition-all border-none"
                >
                  {emailSending ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Sending...
                    </>
                  ) : emailSent ? (
                    <>
                      <CheckCircle2 size={14} />
                      Sent to Mail!
                    </>
                  ) : (
                    <>
                      <Mail size={14} />
                      Email Report
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          <Card className="overflow-hidden p-0 border-none shadow-2xl shadow-slate-200/50 ring-1 ring-slate-100 rounded-[2rem]">
            {loadingAttendance ? (
              <div className="text-center py-20 bg-white">
                <Loader2 className="animate-spin text-emerald-500 mx-auto mb-2" size={24} />
                <p className="text-xs text-slate-500 font-bold">Loading attendance records...</p>
              </div>
            ) : attendanceRecords.length === 0 ? (
              <div className="p-12 text-center text-slate-500 font-bold bg-white">
                No participant records found for this session.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50/50 border-b border-slate-100">
                    <tr>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Participant</th>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Contact/Email</th>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Role</th>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Joined At</th>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Left At</th>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Stay Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {attendanceRecords.map((record) => {
                      const joinTime = new Date(record.joined_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                      const leaveTime = record.left_at 
                        ? new Date(record.left_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                        : 'Active / Present';

                      let durationText = 'N/A';
                      if (record.duration_seconds !== undefined && record.duration_seconds !== null) {
                        const mins = Math.floor(record.duration_seconds / 60);
                        const secs = record.duration_seconds % 60;
                        durationText = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
                      } else if (!record.left_at) {
                        durationText = 'In Progress';
                      }

                      return (
                        <tr key={record.id} className="hover:bg-slate-50/50 transition-colors group font-sans">
                          <td className="px-8 py-5">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-black text-xs border border-emerald-500/5">
                                {record.display_name.split(' ').map((n: string) => n[0]).join('')}
                              </div>
                              <div>
                                <p className="font-black text-slate-900 text-sm leading-none mb-1">{record.display_name}</p>
                                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">ID: #{record.user_id.substring(0, 8)}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-5">
                            <span className="text-xs text-slate-600 font-mono font-bold">{record.email}</span>
                          </td>
                          <td className="px-8 py-5">
                            <span className={cn(
                              "px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-[0.1em]",
                              record.role === 'teacher' ? "bg-purple-50 text-purple-600 border border-purple-100" :
                              record.role === 'moderator' ? "bg-blue-50 text-blue-600 border border-blue-100" :
                              "bg-emerald-50 text-emerald-600 border border-emerald-100"
                            )}>
                              {record.role}
                            </span>
                          </td>
                          <td className="px-8 py-5">
                            <span className="text-xs text-slate-600 font-semibold">{joinTime}</span>
                          </td>
                          <td className="px-8 py-5">
                            <span className={cn(
                              "text-xs font-semibold",
                              record.left_at ? "text-slate-600" : "text-emerald-500 font-bold animate-pulse"
                            )}>
                              {leaveTime}
                            </span>
                          </td>
                          <td className="px-8 py-5 text-right font-black text-slate-900 text-xs">
                            {durationText}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
};

const TrendingUp = (props: any) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
);

export default StudentAudit;
