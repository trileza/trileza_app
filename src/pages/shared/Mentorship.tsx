import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button } from '../../components/ui';
import { useAuthStore, resolveActiveRole } from '../../store/authStore';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie
} from 'recharts';
import { 
  Users, Shield, PlusCircle, Video, PlayCircle, 
  CheckCircle2, AlertCircle, FileText, BrainCircuit,
  Award, Lock, ArrowLeft, MapPin, Plus, MicOff, Mic
} from 'lucide-react';
import { cn } from '../../utils';
import { Toast } from '../../components/ui/Toast';
import { PageHeader } from '../../components/shared';
import { nexus } from '../../lib/nexus';
import { enrollmentService } from '../../lib/services/enrollments';
import { courseService } from '../../lib/services/courses';

const MentorDashboard = ({ showFeedback }: any) => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [menteesCount, setMenteesCount] = useState(0);
  const [courses, setCourses] = useState<any[]>([]);
  const [pendingSessions, setPendingSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const loadMentorData = async () => {
      if (!user) return;
      setLoading(true);
      try {
        // 1. Fetch real mentees count from profiles table
        const { count, error: menteesError } = await nexus.database
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('metadata->>assigned_mentor_id', user.id);
        
        if (!menteesError && active) {
          setMenteesCount(count || 0);
        }

        // 2. Fetch tutor's courses
        const tutorCourses = await courseService.getTutorCourses(user.id);
        if (active) {
          setCourses(tutorCourses || []);
        }

        // 3. Fetch scheduled live sessions for this tutor/mentor
        const { data: sessions, error: sessionsError } = await nexus.database
          .from('live_sessions')
          .select('*')
          .eq('tutor_id', user.id)
          .gte('scheduled_at', new Date().toISOString())
          .order('scheduled_at', { ascending: true });
        
        if (!sessionsError && sessions && active) {
          setPendingSessions(sessions);
        }
      } catch (err) {
        console.error("Error loading mentor dashboard:", err);
      } finally {
        if (active) setLoading(false);
      }
    };
    loadMentorData();
    return () => { active = false; };
  }, [user]);

  const avgScore = menteesCount > 0 ? "84%" : "N/A";

  return (
    <div className="space-y-10 animate-in fade-in duration-500 text-left font-sans">
      {/* ── 1. RELAXED & MINIMALIST MENTOR HEADER (NO BOX CONTAINER) ── */}
      <div className="flex flex-col lg:flex-row items-center lg:items-start justify-between gap-8 pb-6 border-b border-slate-300/60">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left w-full lg:w-auto">
          <div className="relative shrink-0">
            <div className="absolute -inset-0.5 bg-green-500 rounded-[2rem] blur opacity-25 transition duration-500"></div>
            <img 
              src={user?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.full_name || 'Mentor'}`} 
              alt="Profile" 
              className="relative w-24 h-24 rounded-[2rem] border-2 border-slate-350 bg-white shadow-sm object-cover" 
            />
          </div>

          <div className="space-y-3 text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-green-100 border border-green-300 text-green-800 text-[10px] font-black uppercase tracking-widest">
              <Shield size={10} className="text-green-850" /> Verified Official Mentor
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">
              Welcome back, {user?.full_name || 'Mentor'}! 💼
            </h1>
            <p className="text-slate-700 font-extrabold text-sm max-w-xl leading-relaxed">
              {user?.bio || 'Verified Educator. Your mentor profile is fully synchronized and ready.'}
            </p>
          </div>
        </div>

        {/* Right Zone: Profile Quick Actions */}
        <div className="flex flex-wrap gap-3 w-full lg:w-auto justify-center lg:justify-end shrink-0 pt-2">
          <Button 
            className="bg-slate-900 hover:bg-black text-white font-black rounded-xl px-5 h-11 shadow-sm border-none transition-all flex items-center gap-2"
            onClick={() => navigate('/community?startPod=true')}
          >
            <PlusCircle size={16} /> Start Pod
          </Button>
          <Button 
            className="bg-green-600 hover:bg-green-700 text-white font-black rounded-xl px-5 h-11 shadow-lg shadow-green-600/15 border-none transition-all"
            onClick={() => navigate('/profile')}
          >
            Public Profile
          </Button>
          <Button 
            variant="outline"
            className="border-slate-350 text-slate-700 hover:bg-slate-50 rounded-xl font-extrabold px-5 h-11 bg-white"
            onClick={() => navigate('/settings')}
          >
            Settings
          </Button>
        </div>
      </div>

      {/* Mentor Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <Card className="p-6 border-2 border-slate-250/70 shadow-sm rounded-[2.5rem] flex items-center gap-6 bg-white text-slate-900">
            <div className="w-14 h-14 rounded-2xl bg-green-50 text-green-700 flex items-center justify-center shrink-0 border border-green-150 shadow-inner"><Users size={24}/></div>
            <div><p className="text-slate-500 font-black uppercase tracking-wider text-xs">Total Mentees</p><h2 className="text-3xl font-black text-slate-900">{menteesCount}</h2></div>
         </Card>
         <Card className="p-6 border-2 border-slate-250/70 shadow-sm rounded-[2.5rem] flex items-center gap-6 bg-white text-slate-900">
            <div className="w-14 h-14 rounded-2xl bg-green-50 text-green-700 flex items-center justify-center shrink-0 border border-green-150 shadow-inner"><Video size={24}/></div>
            <div><p className="text-slate-500 font-black uppercase tracking-wider text-xs">Pending Schedules</p><h2 className="text-3xl font-black text-slate-900">{pendingSessions.length}</h2></div>
         </Card>
         <Card className="p-6 border-2 border-slate-250/70 shadow-sm rounded-[2.5rem] flex items-center gap-6 bg-white text-slate-900">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 border border-slate-200 shadow-inner"><BrainCircuit size={24}/></div>
            <div><p className="text-slate-500 font-black uppercase tracking-wider text-xs">Avg Cohort Score</p><h2 className="text-3xl font-black text-slate-900">{avgScore}</h2></div>
         </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Cohorts Per Course */}
        <Card className="p-8 border-2 border-slate-250/70 shadow-sm rounded-[2.5rem] bg-white text-slate-900">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-black text-slate-900">Course Cohorts</h3>
          </div>
          <div className="space-y-4">
            {courses.length === 0 ? (
              <div className="text-center py-10 bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
                <Users size={24} className="mx-auto text-slate-300 mb-2" />
                <p className="text-slate-500 text-xs font-black uppercase tracking-wider">No Active Cohorts</p>
                <p className="text-slate-400 text-[10px] mt-1 px-4">You have no active student cohorts. Publish a course and enroll students to start mentorship cohorts.</p>
              </div>
            ) : (
              courses.map((item, i) => (
                <div key={item.id} className="p-5 border-2 border-slate-200/80 rounded-2xl bg-slate-50">
                  <h4 className="font-black text-slate-900 text-lg">{item.title}</h4>
                  <div className="flex items-center justify-between mt-3">
                    <span className="px-3 py-1 bg-white text-slate-700 text-[10px] font-black uppercase tracking-widest rounded-lg border border-slate-250">Active Track</span>
                    <span className="text-xs font-black text-slate-500"><Users size={14} className="inline mr-1"/> {item.enrolled_count || 0} Learners</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Pending Teaching Schedule */}
        <Card className="p-8 border-2 border-slate-250/70 shadow-sm rounded-[2.5rem] bg-white text-slate-900">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-black text-slate-900">Pending Schedules</h3>
            <Button size="sm" variant="outline" className="font-black text-xs border-slate-250 text-slate-600 hover:bg-slate-50 bg-white" onClick={() => navigate('/live')}>View Live Room</Button>
          </div>
          <div className="space-y-4">
            {pendingSessions.length === 0 ? (
              <div className="text-center py-10 bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
                <Video size={24} className="mx-auto text-slate-350 mb-2" />
                <p className="text-slate-500 text-xs font-black uppercase tracking-wider">No Sessions Scheduled</p>
                <p className="text-slate-400 text-[10px] mt-1 px-4">No upcoming live classes or mentor sessions scheduled. Initiate a live room to invite your mentees.</p>
              </div>
            ) : (
              pendingSessions.map((session, i) => (
                <div key={session.id || i} className="p-5 border-2 border-slate-200/80 rounded-2xl flex items-center justify-between hover:bg-slate-100 transition-colors cursor-pointer group bg-slate-50 hover:border-green-400">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-white border border-slate-250 text-slate-655 flex items-center justify-center group-hover:bg-green-50 group-hover:text-green-700 transition-all shadow-sm">
                      <Video size={20} />
                    </div>
                    <div>
                      <h4 className="font-black text-slate-900">{session.title}</h4>
                      <p className="text-xs text-slate-600 font-extrabold mt-1">
                        {new Date(session.scheduled_at).toLocaleString()} • <span className="text-green-600 font-black">{session.room_id ? 'Live Room' : 'Interactive Session'}</span>
                      </p>
                    </div>
                  </div>
                  <Button size="sm" className="bg-slate-900 hover:bg-black text-white font-bold px-4 border-none" onClick={() => navigate('/live')}>Join</Button>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Curriculum Atelier (Merged from Tutor) */}
      <section className="mt-12 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">Curriculum Atelier</h2>
            <p className="text-slate-500 text-sm font-black">Build and manage your professional courses</p>
          </div>
          <Button 
            className="rounded-xl px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-black flex items-center gap-2 border-none shadow-lg shadow-green-600/15"
            onClick={() => navigate('/tutor/courses/new')}
          >
            <Plus size={18} /> Create New Course
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {courses.length === 0 ? (
            <div className="col-span-full text-center py-12 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2.5rem]">
              <FileText size={32} className="mx-auto text-slate-350 mb-3" />
              <h4 className="font-black text-slate-800 text-sm uppercase tracking-wider">No Courses Created</h4>
              <p className="text-slate-500 text-xs mt-1 max-w-sm mx-auto px-6">You haven't built any courses yet. Launch the course builder to publish lessons, quizzes, and live classrooms.</p>
            </div>
          ) : (
            courses.map((course) => (
              <Card 
                key={course.id} 
                className="p-6 border-2 border-slate-250/80 shadow-sm bg-white rounded-[2.5rem] hover:shadow-md hover:border-green-400 transition-all cursor-pointer group text-left"
                onClick={() => navigate(`/tutor/courses/${course.id}`)}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-150 flex items-center justify-center text-slate-500 group-hover:bg-green-50 group-hover:text-green-700 transition-all">
                    <FileText size={24} />
                  </div>
                  <span className={cn(
                    "px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest text-white border-none",
                    course.status === 'published' ? 'bg-green-600' : 'bg-amber-500'
                  )}>
                    {course.status}
                  </span>
                </div>
                <h4 className="font-black text-slate-900 group-hover:text-green-750 transition-colors line-clamp-1">{course.title}</h4>
                <p className="text-[10px] font-black text-slate-550 uppercase tracking-widest mt-2">{course.enrolled_count || 0} enrolled learners</p>
              </Card>
            ))
          )}
        </div>
      </section>
    </div>
  );
};

const LiveMentorshipWorkspace = ({ isCoach, showFeedback }: any) => {
  return (
    <Card className="min-h-[700px] border-2 border-slate-250/80 shadow-sm rounded-[2.5rem] p-0 flex flex-col bg-white overflow-hidden relative text-left animate-in fade-in duration-300">
      {/* Session AI Background Hook */}
      <div className="absolute top-4 left-4 bg-green-50 border border-green-200 text-green-800 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full z-10 flex items-center gap-2">
        <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-ping" /> AI Recording Session Recap
      </div>

      <div className="flex-1 flex p-4 gap-4 h-full bg-slate-50">
        {/* Main Stage (WebRTC / Canvas) */}
        <div className="flex-1 bg-slate-900 rounded-2xl flex flex-col border border-slate-800 relative group overflow-hidden shadow-inner">
          <div className="absolute inset-0 flex items-center justify-center text-slate-800 opacity-20 pointer-events-none">
            <Plus size={300} className="rotate-45" />
          </div>
          
          <div className="flex-1 flex flex-col items-center justify-center z-10 relative">
            <p className="text-white/50 font-black mb-4">Collaborative Canvas & Screen Stage</p>
            {isCoach && (
              <div className="flex gap-4">
                <Button className="bg-green-600 hover:bg-green-700 border-none rounded-xl font-black text-white px-5">Start Whiteboard</Button>
                <Button className="bg-slate-800 hover:bg-slate-700 border-none rounded-xl font-black text-white px-5">Share Screen</Button>
              </div>
            )}
            {!isCoach && (
              <div className="text-center">
                <p className="text-slate-400 mb-4 font-bold">You are in viewer mode. Mentor controls the stage.</p>
                <Button variant="outline" className="border-green-600/30 text-green-400 hover:bg-green-900/30 font-black" onClick={() => showFeedback('Requested Stage Access from Mentor')}>Request Stage Access</Button>
              </div>
            )}
          </div>

          <div className="h-20 bg-slate-950/90 backdrop-blur-md border-t border-slate-850 shrink-0 flex items-center justify-center gap-4 relative z-20">
            <button className="p-3 bg-rose-500/20 text-rose-500 hover:bg-rose-500/30 rounded-xl transition-colors"><MicOff size={20}/></button>
            {isCoach && <button className="p-3 bg-white/10 text-white hover:bg-white/20 rounded-xl transition-colors" title="Force Unmute Student"><Mic size={20}/></button>}
            <button className="p-3 bg-white/10 text-white hover:bg-white/20 rounded-xl transition-colors"><Video size={20}/></button>
            <button className="px-6 py-3 bg-rose-600 text-white font-black rounded-xl transition-colors hover:bg-rose-500" onClick={() => showFeedback('Ending session. AI Recap will be posted to the feed.')}>Leave Room</button>
          </div>
        </div>

        {/* Sidebar / Participants */}
        <div className="w-72 bg-white rounded-2xl border-2 border-slate-250/70 overflow-y-auto hidden lg:block shadow-sm">
          <div className="p-4 border-b-2 border-slate-150 bg-slate-50 rounded-t-2xl">
            <h3 className="text-slate-905 font-black text-sm">Stage Participants</h3>
            <p className="text-[10px] text-slate-500 font-bold mt-0.5">Realtime session state active.</p>
          </div>
          <div className="p-2 space-y-2">
            {[1,2,3].map((s,i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-150 group">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-200" />
                  <div>
                    <p className="text-xs font-black text-slate-800">{i===0?'Dr. Doe (Mentor)':'Student '+s}</p>
                    <p className="text-[9px] text-green-700 font-black">{i===0?'Presenting':'Listening'}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
};

// ─── MENTEE DASHBOARD (LIGHT MINIMALIST THEME) ───
const MenteeDashboard = ({ showFeedback }: any) => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [mentor, setMentor] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [enrollments, setEnrollments] = useState<any[]>([]);

  useEffect(() => {
    let active = true;
    const loadMenteeData = async () => {
      if (!user) return;
      setLoading(true);
      try {
        // 1. Fetch assigned mentor profile if exists
        const assignedMentorId = user.metadata?.assigned_mentor_id;
        if (assignedMentorId) {
          const { data: mentorProfile, error } = await nexus.database
            .from('profiles')
            .select('*')
            .eq('id', assignedMentorId)
            .maybeSingle();
          if (!error && mentorProfile && active) {
            setMentor(mentorProfile);
          }
        }
        
        // 2. Fetch user's course enrollments
        const enrollList = await enrollmentService.getUserEnrollments(user.id);
        if (active) {
          setEnrollments(enrollList || []);
        }
      } catch (err) {
        console.error("Error loading mentee dashboard:", err);
      } finally {
        if (active) setLoading(false);
      }
    };
    loadMenteeData();
    return () => { active = false; };
  }, [user]);

  const goalProgress = enrollments.length > 0
    ? Math.round(enrollments.reduce((sum, e) => sum + (e.progress || 0), 0) / enrollments.length)
    : 0;

  const actionItems = user?.metadata?.action_items || [];
  const milestones = user?.metadata?.milestones || [];
  const badges = user?.metadata?.badges || [];

  return (
    <div className="space-y-10 animate-in fade-in duration-500 text-left font-sans">
      {/* Top Banner / Active Mentor Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {mentor ? (
          <Card className="lg:col-span-2 bg-white border-2 border-slate-250/70 shadow-sm p-8 rounded-[2.5rem] text-slate-900 relative overflow-hidden flex flex-col md:flex-row items-center gap-8 hover:border-green-400 transition-all duration-300">
            <img 
              src={mentor.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${mentor.full_name}`} 
              className="w-32 h-32 rounded-[2rem] border-2 border-slate-250 bg-slate-100 shadow-sm object-cover" 
              alt="Mentor" 
            />
            <div className="relative z-10 flex-1 text-center md:text-left">
              <h3 className="text-xs font-black text-green-705 uppercase tracking-widest mb-1 flex items-center justify-center md:justify-start gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-ping" /> Your Active Mentor
              </h3>
              <h2 className="text-3xl font-black mb-2 text-slate-900">{mentor.full_name}</h2>
              <p className="text-slate-700 font-bold mb-6 text-sm leading-relaxed max-w-xl">{mentor.bio || 'Verified Trileza Mentor.'}</p>
              <div className="flex flex-col sm:flex-row justify-center md:justify-start gap-3">
                 <Button className="bg-green-600 hover:bg-green-700 text-white font-black rounded-xl border-none shadow-lg shadow-green-600/15 px-5 py-3 text-xs uppercase flex items-center justify-center gap-2" onClick={() => navigate('/live')}>
                   <Video size={16} className="mr-1"/> Join Next Session
                 </Button>
                 <Button variant="outline" className="border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl font-extrabold bg-white px-5 py-3" onClick={() => navigate('/messages')}>
                   Message Mentor
                 </Button>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="lg:col-span-2 bg-white border-2 border-slate-250/70 shadow-sm p-8 rounded-[2.5rem] text-slate-900 relative overflow-hidden flex flex-col md:flex-row items-center gap-8 hover:border-green-400 transition-all duration-300">
            <div className="w-32 h-32 rounded-[2rem] border-2 border-slate-200 bg-slate-50 flex items-center justify-center text-slate-350">
               <BrainCircuit size={48} className="stroke-[1.5]" />
            </div>
            <div className="relative z-10 flex-1 text-center md:text-left">
              <h3 className="text-xs font-black text-amber-600 uppercase tracking-widest mb-1 flex items-center justify-center md:justify-start gap-2">
                ⚠️ Mentorship Inactive
              </h3>
              <h2 className="text-3xl font-black mb-2 text-slate-900">Select a Mentor</h2>
              <p className="text-slate-700 font-extrabold mb-6 text-sm leading-relaxed max-w-xl">
                You do not have an active mentor assigned to your profile yet. Connect with verified industry leaders to start your customized training pathway.
              </p>
              <div className="flex flex-col sm:flex-row justify-center md:justify-start gap-3">
                 <Button className="bg-green-600 hover:bg-green-700 text-white font-black rounded-xl border-none shadow-lg shadow-green-600/15 px-5 py-3 text-xs uppercase" onClick={() => navigate('/profile')}>
                   Find a Mentor
                 </Button>
              </div>
            </div>
          </Card>
        )}
        
        <Card className="bg-white border-2 border-slate-250/70 shadow-sm p-8 rounded-[2.5rem] relative overflow-hidden flex flex-col justify-center text-slate-900 hover:border-green-400 transition-all duration-300">
          <h3 className="text-slate-900 font-black mb-4 flex items-center gap-2"><CheckCircle2 className="text-green-600" /> Action Items</h3>
          <div className="space-y-3 relative z-10">
            {actionItems.length === 0 ? (
              <div className="text-center py-6 bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
                <CheckCircle2 size={24} className="mx-auto text-slate-350 mb-2" />
                <p className="text-slate-500 text-xs font-black uppercase tracking-wider">No Action Items</p>
                <p className="text-slate-400 text-[10px] mt-1 px-4">Your mentor has not assigned any custom action items yet.</p>
              </div>
            ) : (
              actionItems.map((item: any, i: number) => (
                <div key={i} className="bg-slate-50 p-4 rounded-xl border-2 border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between group hover:border-green-300 transition-colors gap-3">
                   <div>
                     <p className="text-slate-900 font-black text-sm">{item.title}</p>
                     <p className="text-slate-605 text-xs mt-0.5 font-extrabold">{item.due || 'Recommended'}</p>
                   </div>
                   <Button size="sm" className="bg-slate-900 hover:bg-black text-white font-black border-none rounded-lg w-full sm:w-auto px-4" onClick={() => navigate(item.link || '/assignments')}>Go</Button>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-2 border-slate-250/70 bg-white shadow-sm rounded-[2.5rem] p-8 text-slate-900 hover:border-green-400 transition-all duration-300">
            <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
              <MapPin className="text-green-600" /> Mentorship Milestone Roadmap
            </h3>
            
            {milestones.length === 0 ? (
              <div className="text-center py-12 bg-slate-55 border-2 border-dashed border-slate-200 rounded-2xl">
                <MapPin size={32} className="mx-auto text-slate-300 mb-3" />
                <h4 className="font-black text-slate-800 text-sm uppercase tracking-wider">Learning Roadmap Empty</h4>
                <p className="text-slate-655 text-xs mt-1 max-w-sm mx-auto px-6">Once your active mentor verifies your tracks, they will establish milestone indicators to guide your study.</p>
              </div>
            ) : (
              <div className="relative pl-8 space-y-8 before:absolute before:inset-y-2 before:left-[11px] before:w-0.5 before:bg-slate-250 before:rounded-full">
                {milestones.map((milestone: any, i: number) => {
                  const isCompleted = milestone.status === 'completed';
                  const isActive = milestone.status === 'active';
                  return (
                    <div key={i} className={cn("relative flex items-start gap-4", !isCompleted && !isActive && "opacity-50")}>
                      {isCompleted ? (
                        <span className="absolute -left-[35px] w-6 h-6 bg-green-50 text-green-700 rounded-full border-4 border-white flex items-center justify-center shadow-md border-green-200"><CheckCircle2 size={12} className="text-green-700" /></span>
                      ) : isActive ? (
                        <span className="absolute -left-[35px] w-6 h-6 bg-green-600 rounded-full border-4 border-white z-10 shadow-md shadow-green-500/25 animate-pulse" />
                      ) : (
                        <span className="absolute -left-[35px] w-6 h-6 bg-slate-200 rounded-full border-4 border-white z-10" />
                      )}
                      <div className={cn("flex-1 bg-slate-50 p-6 rounded-2xl border-2", isActive ? "border-green-300 shadow-md shadow-green-600/5" : "border-slate-200/80")}>
                        <h4 className="font-black text-slate-900 text-lg">{milestone.title}</h4>
                        <p className="text-slate-700 font-extrabold text-sm mt-1">{milestone.description}</p>
                        {isCompleted ? (
                          <div className="mt-4 flex items-center gap-2 text-xs font-black text-green-800 bg-green-100 w-max px-3 py-1.5 rounded-lg border border-green-200"><CheckCircle2 size={14}/> Verified by Mentor</div>
                        ) : isActive ? (
                          <Button size="sm" className="mt-4 bg-green-600 hover:bg-green-700 text-white font-black border-none px-5 py-2 shadow-lg shadow-green-600/15 rounded-xl" onClick={() => navigate('/assignments')}>Submit for Review</Button>
                        ) : (
                          <div className="mt-4 flex items-center gap-2 text-xs font-black text-slate-500"><Lock size={14}/> Locked until previous milestones verified</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-2 border-slate-250/70 shadow-sm bg-white text-slate-900 rounded-[2.5rem] p-8 text-center hover:border-green-400 transition-all duration-300">
            <h3 className="font-black text-slate-905 text-lg mb-6">Mentorship Completion</h3>
            
            <div className="w-40 h-40 mx-auto relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={[{ value: goalProgress || 1 }, { value: 100 - (goalProgress || 1) }]} dataKey="value" cx="50%" cy="50%" innerRadius={60} outerRadius={70} startAngle={90} endAngle={-270} stroke="none">
                    <Cell fill={goalProgress > 0 ? "#16a34a" : "rgba(0,0,0,0.08)"} />
                    <Cell fill="rgba(0,0,0,0.08)" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute text-4xl font-black text-slate-900">{goalProgress}%</div>
            </div>
          </Card>

          <Card className="border-2 border-slate-250/70 bg-white shadow-sm rounded-[2.5rem] p-8 text-slate-900 text-left hover:border-green-400 transition-all duration-300">
            <h3 className="font-black text-slate-905 mb-6 flex items-center gap-2"><Award className="text-green-600"/> Skill Badges</h3>
            {badges.length === 0 ? (
              <div className="bg-slate-50 border-2 border-dashed border-slate-200 p-6 rounded-2xl text-center">
                <Award size={24} className="mx-auto text-slate-350 mb-2" />
                <p className="text-slate-500 text-xs font-black uppercase tracking-wider">No Badges Yet</p>
                <p className="text-slate-400 text-[9px] mt-1 leading-relaxed">Milestone verifications will unlock official skill badges automatically.</p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                {badges.map((badge: any, i: number) => (
                  <div key={i} className="bg-slate-55 border-2 border-slate-200 px-4 py-3 rounded-xl flex items-center gap-2 hover:border-green-300 transition-colors">
                    <Award size={18} className="text-green-650" />
                    <span className="font-black text-sm text-slate-800">{badge.title}</span>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-slate-655 font-bold mt-6 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-200">Badges are awarded natively through Mentor verifications and display on your public profile automatically.</p>
          </Card>
        </div>
      </div>
    </div>
  );
};

const Mentorship = () => {
  const { user, activeRole } = useAuthStore();
  const activeRoleDerived = activeRole || resolveActiveRole(user) || 'mentee';
  const [activeTab, setActiveTab] = useState<'dashboard' | 'live'>('dashboard');
  const [toast, setToast] = useState<{message: string, type: 'success' | 'info'} | null>(null);

  const showFeedback = (msg: string, type: 'success' | 'info' = 'success') => setToast({ message: msg, type });

  const activeRoleIsMentee = activeRoleDerived === 'mentee';

  return (
    <div className="min-h-screen text-slate-900 transition-all duration-500 font-sans bg-transparent">
      <div className="space-y-10 animate-in fade-in duration-500 pb-20 w-full">
        {/* Global Header */}
        {!activeRoleIsMentee ? (
          <PageHeader 
            title="Mentor Profile"
            description="Review your cohort progress, manage active assignments, and run live mentor sessions."
            tag="TRILEZA PLATFORM"
            icon={BrainCircuit}
            rightContent={
              activeTab !== 'live' ? (
                <Button className="font-black bg-[#16a34a] hover:bg-[#15803d] border-none rounded-xl py-3 px-6 flex items-center gap-2 shadow-lg shadow-green-600/25 text-white" onClick={() => setActiveTab('live')}>
                  <Video size={18} /> Join Live Room
                </Button>
              ) : (
                <Button className="font-black bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-700 flex items-center gap-2" onClick={() => setActiveTab('dashboard')}>
                  <ArrowLeft size={16} /> Exit Live Room
                </Button>
              )
            }
          />
        ) : (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-6 border-b-2 border-slate-300/60 text-left">
            <div className="space-y-1">
              <div className="flex items-center gap-2 mb-2">
                <BrainCircuit className="text-green-600 animate-pulse" size={24} />
                <span className="font-black tracking-[0.2em] uppercase text-xs text-green-700">Trileza Platform</span>
              </div>
              <h1 className="text-3xl md:text-5xl font-black tracking-tight text-slate-900">Mentorship Growth Engine</h1>
            </div>
            
            {/* Dashboard tabs switcher: borderless selector */}
            <div className="flex items-center gap-4 shrink-0 pt-2 md:pt-0">
              {activeTab !== 'live' ? (
                <Button className="font-black bg-slate-900 hover:bg-black border-none rounded-xl py-5 px-7 flex items-center gap-2 shadow-sm text-white" onClick={() => setActiveTab('live')}>
                  <Video size={18} /> Join Live Room
                </Button>
              ) : (
                <Button className="font-black bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-700 flex items-center gap-2" onClick={() => setActiveTab('dashboard')}>
                  <ArrowLeft size={16} /> Exit Live Room
                </Button>
              )}
            </div>
          </div>
        )}

        {activeTab === 'dashboard' && (
          (activeRoleDerived === 'mentor' || activeRoleDerived === 'tutor') ? <MentorDashboard showFeedback={showFeedback} /> : <MenteeDashboard showFeedback={showFeedback} />
        )}

        {activeTab === 'live' && (
          <LiveMentorshipWorkspace isCoach={activeRoleDerived === 'mentor'} showFeedback={showFeedback} />
        )}

        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    </div>
  );
};

export default Mentorship;
