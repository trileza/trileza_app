import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button } from '../../components/ui';
import { useAuthStore } from '../../store/authStore';
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

const MentorDashboard = ({ showFeedback }: any) => {
  const { user } = useAuthStore();
  const navigate = useNavigate();

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
              {user?.bio || 'Senior Mentor & Architect. Your expert command center is fully synchronized and ready.'}
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
            onClick={() => navigate('/mentor/profile')}
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
            <div><p className="text-slate-500 font-black uppercase tracking-wider text-xs">Total Mentees</p><h2 className="text-3xl font-black text-slate-900">124</h2></div>
         </Card>
         <Card className="p-6 border-2 border-slate-250/70 shadow-sm rounded-[2.5rem] flex items-center gap-6 bg-white text-slate-900">
            <div className="w-14 h-14 rounded-2xl bg-green-50 text-green-700 flex items-center justify-center shrink-0 border border-green-150 shadow-inner"><Video size={24}/></div>
            <div><p className="text-slate-500 font-black uppercase tracking-wider text-xs">Pending Schedules</p><h2 className="text-3xl font-black text-slate-900">4</h2></div>
         </Card>
         <Card className="p-6 border-2 border-slate-250/70 shadow-sm rounded-[2.5rem] flex items-center gap-6 bg-white text-slate-900">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 border border-slate-200 shadow-inner"><BrainCircuit size={24}/></div>
            <div><p className="text-slate-500 font-black uppercase tracking-wider text-xs">Avg Cohort Score</p><h2 className="text-3xl font-black text-slate-900">84%</h2></div>
         </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Cohorts Per Course */}
        <Card className="p-8 border-2 border-slate-250/70 shadow-sm rounded-[2.5rem] bg-white text-slate-900">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-black text-slate-900">Course Cohorts</h3>
          </div>
          <div className="space-y-4">
            {[
              { course: 'Advanced Agentic Coding', cohorts: ['Alpha Group', 'Beta Stream'], mentees: 45 },
              { course: 'AI Systems Architecture', cohorts: ['Weekend Fast-track'], mentees: 22 },
              { course: 'High-Fidelity UI Design', cohorts: ['Evening Cohort', 'Morning Cohort'], mentees: 57 }
            ].map((item, i) => (
              <div key={i} className="p-5 border-2 border-slate-200/80 rounded-2xl hover:border-green-400 transition-all cursor-pointer group bg-slate-50">
                <h4 className="font-black text-slate-900 text-lg group-hover:text-green-705 transition-colors">{item.course}</h4>
                <div className="flex items-center justify-between mt-3">
                  <div className="flex gap-2">
                    {item.cohorts.map((cohort, idx) => (
                      <span key={idx} className="px-3 py-1 bg-white text-slate-700 text-[10px] font-black uppercase tracking-widest rounded-lg border border-slate-250">{cohort}</span>
                    ))}
                  </div>
                  <span className="text-xs font-black text-slate-500"><Users size={14} className="inline mr-1"/> {item.mentees}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Pending Teaching Schedule */}
        <Card className="p-8 border-2 border-slate-250/70 shadow-sm rounded-[2.5rem] bg-white text-slate-900">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-black text-slate-900">Pending Schedules</h3>
            <Button size="sm" variant="outline" className="font-black text-xs border-slate-250 text-slate-600 hover:bg-slate-50 bg-white">View Calendar</Button>
          </div>
          <div className="space-y-4">
            {[
              { title: 'Live Code Review: Agentic Loops', time: 'Today, 2:00 PM', type: 'Live Mentorship' },
              { title: 'Q&A Session: Architecture Patterns', time: 'Tomorrow, 10:00 AM', type: 'Community Call' },
              { title: '1-on-1: Alice Smith', time: 'Wed, 4:30 PM', type: 'Private Session' },
              { title: 'Sprint Planning: Beta Stream', time: 'Fri, 1:00 PM', type: 'Live Mentorship' }
            ].map((schedule, i) => (
              <div key={i} className="p-5 border-2 border-slate-200/80 rounded-2xl flex items-center justify-between hover:bg-slate-100 transition-colors cursor-pointer group bg-slate-50 hover:border-green-400">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-white border border-slate-250 text-slate-600 flex items-center justify-center group-hover:bg-green-50 group-hover:text-green-700 transition-all shadow-sm">
                    <Video size={20} />
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900">{schedule.title}</h4>
                    <p className="text-xs text-slate-600 font-extrabold mt-1">{schedule.time} • <span className="text-green-600 font-black">{schedule.type}</span></p>
                  </div>
                </div>
                <Button size="sm" className="bg-slate-900 hover:bg-black text-white font-bold px-4 border-none" onClick={() => navigate('/live')}>Join</Button>
              </div>
            ))}
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
          {[
            { id: 'c1', title: 'Advanced Agentic Coding', students: 120, status: 'published' },
            { id: 'c2', title: 'AI Systems Architecture', students: 85, status: 'published' },
            { id: 'c3', title: 'High-Fidelity UI Design', students: 45, status: 'draft' },
          ].map((course) => (
            <Card 
              key={course.id} 
              className="p-6 border-2 border-slate-250/80 shadow-sm bg-white rounded-[2.5rem] hover:shadow-md hover:border-green-400 transition-all cursor-pointer group"
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
              <h4 className="font-black text-slate-900 group-hover:text-green-700 transition-colors">{course.title}</h4>
              <p className="text-[10px] font-black text-slate-550 uppercase tracking-widest mt-2">{course.students} Active Students</p>
            </Card>
          ))}
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
  const navigate = useNavigate();
  const goalProgress = 65;

  return (
    <div className="space-y-10 animate-in fade-in duration-500 text-left font-sans">
      {/* Top Banner / Active Mentor Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 bg-white border-2 border-slate-250/70 shadow-sm p-8 rounded-[2.5rem] text-slate-900 relative overflow-hidden flex flex-col md:flex-row items-center gap-8 hover:border-green-400 transition-all duration-300">
          <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=DrDoe" className="w-32 h-32 rounded-[2rem] border-2 border-slate-250 bg-slate-100 shadow-sm object-cover" alt="Mentor" />
          <div className="relative z-10 flex-1 text-center md:text-left">
            <h3 className="text-xs font-black text-green-705 uppercase tracking-widest mb-1 flex items-center justify-center md:justify-start gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-ping" /> Your Active Mentor
            </h3>
            <h2 className="text-3xl font-black mb-2 text-slate-900">Dr. Emily Doe</h2>
            <p className="text-slate-700 font-extrabold mb-6 text-sm leading-relaxed">Senior Frontend Architect & Open Source Contributor. Guiding you through the UI/UX Mastery track.</p>
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
        
        <Card className="bg-white border-2 border-slate-250/70 shadow-sm p-8 rounded-[2.5rem] relative overflow-hidden flex flex-col justify-center text-slate-900 hover:border-green-400 transition-all duration-300">
          <h3 className="text-slate-900 font-black mb-4 flex items-center gap-2"><CheckCircle2 className="text-green-600" /> Action Items</h3>
          <div className="space-y-3 relative z-10">
            <div className="bg-slate-50 p-4 rounded-xl border-2 border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between group hover:border-green-300 transition-colors gap-3">
               <div>
                 <p className="text-slate-900 font-black text-sm">Submit Architecture Review</p>
                 <p className="text-slate-600 text-xs mt-0.5 font-extrabold">Due in 2 days</p>
               </div>
               <Button size="sm" className="bg-slate-900 hover:bg-black text-white font-black border-none rounded-lg w-full sm:w-auto px-4" onClick={() => navigate('/assignments')}>Start</Button>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border-2 border-slate-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between group hover:border-green-300 transition-colors gap-3">
               <div>
                 <p className="text-slate-900 font-black text-sm">Read "Clean Code" Ch. 3</p>
                 <p className="text-slate-600 text-xs mt-0.5 font-extrabold">Mentor Recommended</p>
               </div>
               <Button size="sm" className="bg-slate-900 hover:bg-black text-white font-black border-none rounded-lg w-full sm:w-auto px-4" onClick={() => navigate('/library')}>View</Button>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-2 border-slate-250/70 bg-white shadow-sm rounded-[2.5rem] p-8 text-slate-900 hover:border-green-400 transition-all duration-300">
            <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
              <MapPin className="text-green-600" /> Mentorship Milestone Roadmap
            </h3>
            
            <div className="relative pl-8 space-y-8 before:absolute before:inset-y-2 before:left-[11px] before:w-0.5 before:bg-slate-250 before:rounded-full">
              <div className="relative flex items-start gap-4">
                <span className="absolute -left-[35px] w-6 h-6 bg-green-50 text-green-700 rounded-full border-4 border-white flex items-center justify-center shadow-md border-green-200"><CheckCircle2 size={12} className="text-green-700" /></span>
                <div className="flex-1 bg-slate-50 p-6 rounded-2xl border-2 border-slate-200/80">
                  <h4 className="font-black text-slate-900 text-lg">Foundation Analysis</h4>
                  <p className="text-slate-700 font-extrabold text-sm mt-1">Review existing codebase and identify anti-patterns.</p>
                  <div className="mt-4 flex items-center gap-2 text-xs font-black text-green-800 bg-green-100 w-max px-3 py-1.5 rounded-lg border border-green-200"><CheckCircle2 size={14}/> Verified by Mentor</div>
                </div>
              </div>

              <div className="relative flex items-start gap-4">
                <span className="absolute -left-[35px] w-6 h-6 bg-green-600 rounded-full border-4 border-white z-10 shadow-md shadow-green-500/25 animate-pulse" />
                <div className="flex-1 bg-slate-50 p-6 rounded-2xl border-2 border-green-300 shadow-md shadow-green-600/5 relative overflow-hidden">
                  <div className="relative z-10">
                    <h4 className="font-black text-slate-800 text-lg">Build the Pipeline</h4>
                    <p className="text-slate-655 font-bold text-sm mt-1">Implement the CI/CD integration with GitHub Actions.</p>
                    <Button size="sm" className="mt-4 bg-green-600 hover:bg-green-700 text-white font-black border-none px-5 py-2 shadow-lg shadow-green-600/15 rounded-xl" onClick={() => navigate('/assignments')}>Submit for Review</Button>
                  </div>
                </div>
              </div>

              <div className="relative flex items-start gap-4 opacity-50">
                <span className="absolute -left-[35px] w-6 h-6 bg-slate-200 rounded-full border-4 border-white z-10" />
                <div className="flex-1 bg-slate-50 p-6 rounded-2xl border-2 border-slate-200/80">
                  <h4 className="font-black text-slate-905 text-lg">Deployment & Scale</h4>
                  <p className="text-slate-700 font-extrabold text-sm mt-1">Optimize Docker containers for production environments.</p>
                  <div className="mt-4 flex items-center gap-2 text-xs font-black text-slate-500"><Lock size={14}/> Locked until Pipeline is verified</div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-2 border-slate-250/70 shadow-sm bg-white text-slate-900 rounded-[2.5rem] p-8 text-center hover:border-green-400 transition-all duration-300">
            <h3 className="font-black text-slate-905 text-lg mb-6">Mentorship Completion</h3>
            
            <div className="w-40 h-40 mx-auto relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={[{ value: goalProgress }, { value: 100 - goalProgress }]} dataKey="value" cx="50%" cy="50%" innerRadius={60} outerRadius={70} startAngle={90} endAngle={-270} stroke="none">
                    <Cell fill="#16a34a" />
                    <Cell fill="rgba(0,0,0,0.08)" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute text-4xl font-black text-slate-900">{goalProgress}%</div>
            </div>
          </Card>

          <Card className="border-2 border-slate-250/70 bg-white shadow-sm rounded-[2.5rem] p-8 text-slate-900 text-left hover:border-green-400 transition-all duration-300">
            <h3 className="font-black text-slate-905 mb-6 flex items-center gap-2"><Award className="text-green-600"/> Skill Badges</h3>
            <div className="flex flex-wrap gap-3">
              <div className="bg-slate-55 border-2 border-slate-200 px-4 py-3 rounded-xl flex items-center gap-2 hover:border-green-300 transition-colors">
                <Award size={18} className="text-green-650" />
                <span className="font-black text-sm text-slate-800">Clean Code Ninja</span>
              </div>
              <div className="bg-slate-55 border-2 border-slate-200 px-4 py-3 rounded-xl flex items-center gap-2 opacity-50 grayscale">
                <Award size={18} className="text-slate-500" />
                <span className="font-black text-sm text-slate-600">Design Master</span>
              </div>
            </div>
            <p className="text-xs text-slate-655 font-bold mt-6 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-200">Badges are awarded natively through Mentor verifications and display on your public profile automatically.</p>
          </Card>
        </div>
      </div>
    </div>
  );
};

const Mentorship = () => {
  const { user, activeRole } = useAuthStore();
  const activeRoleDerived = activeRole || user?.role;
  const [activeTab, setActiveTab] = useState<'dashboard' | 'live'>('dashboard');
  const [toast, setToast] = useState<{message: string, type: 'success' | 'info'} | null>(null);

  const showFeedback = (msg: string, type: 'success' | 'info' = 'success') => setToast({ message: msg, type });

  const activeRoleIsMentee = activeRoleDerived === 'mentee';

  return (
    <div className="min-h-screen text-slate-900 transition-all duration-500 font-sans bg-transparent">
      <div className="space-y-10 animate-in fade-in duration-500 pb-20 max-w-7xl mx-auto p-4 sm:p-6 md:p-8">
        {/* Global Header (Relaxed, borderless and minimalist) */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-6 border-b-2 border-slate-300/60 text-left">
          <div className="space-y-1">
            <div className="flex items-center gap-2 mb-2">
              <BrainCircuit className="text-green-600 animate-pulse" size={24} />
              <span className="font-black tracking-[0.2em] uppercase text-xs text-green-700">Nexus Ecosystem</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-black tracking-tight text-slate-900">{(activeRoleDerived === 'mentor' || activeRoleDerived === 'tutor') ? 'Mentor Command Center' : 'Mentorship Growth Engine'}</h1>
          </div>
          
          {/* Dashboard tabs switcher: borderless selector */}
          <div className="flex items-center gap-4 shrink-0 pt-2 md:pt-0">
            {activeTab !== 'live' ? (
              <Button className="font-black bg-slate-900 hover:bg-black border-none rounded-xl py-5 px-7 flex items-center gap-2 shadow-sm text-white" onClick={() => setActiveTab('live')}>
                <Video size={18} /> Enter Live Stage
              </Button>
            ) : (
              <Button className="font-black bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-700 flex items-center gap-2" onClick={() => setActiveTab('dashboard')}>
                <ArrowLeft size={16} /> Exit Live Room
              </Button>
            )}
          </div>
        </div>

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
