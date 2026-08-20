import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button } from '../../components/ui';
import { 
  Users, 
  Edit2,
  Globe,
  Mail,
  Briefcase,
  GraduationCap as GradIcon,
  ChevronRight,
  CheckCircle,
  Plus,
  Trash2,
  Camera,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Clock,
  Layout,
  Shield,
  Radio,
  Star,
  ExternalLink,
  Video,
  Award,
  TrendingUp,
  Sparkles,
  Zap,
  Target,
  BarChart3
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { Toast } from '../../components/ui/Toast';
import { courseService } from '../../lib/services/courses';
import type { Course } from '../../lib/database.types';
import { cn } from '../../utils';

const TutorDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [toast, setToast] = React.useState<{message: string, type: 'success' | 'info'} | null>(null);
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [courses, setCourses] = React.useState<Course[]>([]);
  const [loadingCourses, setLoadingCourses] = React.useState(true);
  const [menteeCount, setMenteeCount] = React.useState<number>(0);

  React.useEffect(() => {
    if (user) {
      const fetchCourses = async () => {
        try {
          const data = await courseService.getTutorCourses(user.id);
          setCourses(data);
        } catch (err) {
          console.error('Error fetching courses:', err);
        } finally {
          setLoadingCourses(false);
        }
      };
      fetchCourses();

      // Fetch real mentee count
      const fetchMenteeCount = async () => {
        try {
          const { count } = await (await import('../../lib/nexus')).nexus.database
            .from('profiles')
            .select('id', { count: 'exact', head: true })
            .eq('metadata->>assigned_mentor_id', user.id);
          setMenteeCount(count || 0);
        } catch (err) {
          console.error('[TutorDashboard] Failed to fetch mentee count:', err);
          // count stays 0
        }
      };
      fetchMenteeCount();
    }
  }, [user]);

  const showFeedback = (msg: string, type: 'success' | 'info' = 'success') => {
    setToast({ message: msg, type });
  };
  
  const initialData = React.useMemo(() => ({
    name: user?.full_name || '',
    bio: user?.bio || '',
    avatar: user?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.id || 'user'}`,
    website: (user as any)?.website || '',
    email: user?.email || '',
    expertise: (user as any)?.expertise || []
  }), [user]);

  const [tutorData, setTutorData] = React.useState(initialData);

  // Keep tutorData in sync when user data loads
  React.useEffect(() => {
    if (user) {
      const fresh = {
        name: user.full_name || '',
        bio: user.bio || '',
        avatar: user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`,
        website: (user as any)?.website || '',
        email: user.email || '',
        expertise: (user as any)?.expertise || []
      };
      setTutorData(fresh);
    }
  }, [user?.full_name, user?.bio, user?.avatar_url]);

  return (
    <div className="space-y-10 w-full animate-in fade-in duration-700 pb-24 font-sans relative">

      {/* ═══════════════════════════════════════════════════════════════════
          HERO PROFILE CARD — Social Media Style
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="rounded-3xl overflow-hidden shadow-2xl shadow-slate-300/40">
        
        {/* ── COVER BANNER ── */}
        <div className="relative h-40 sm:h-52 md:h-64 overflow-hidden" style={{
          background: 'linear-gradient(135deg, #052e16 0%, #14532d 25%, #166534 50%, #15803d 75%, #16a34a 100%)'
        }}>
          {/* Mesh / Organic SVG pattern */}
          <svg className="absolute inset-0 w-full h-full opacity-[0.07]" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
                <circle cx="30" cy="30" r="1.5" fill="white" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
          {/* Floating orbs */}
          <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-[#22c55e]/15 blur-3xl" />
          <div className="absolute -bottom-32 -left-20 w-80 h-80 rounded-full bg-[#4ade80]/10 blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-40 rounded-full bg-white/[0.03] blur-2xl rotate-12" />
          
          {/* Top bar — subtle ambient detail */}
          <div className="hidden md:flex absolute top-0 left-0 right-0 px-8 py-5 items-center justify-between pointer-events-none">
            <div className="flex items-center gap-2.5 text-white/70">
              <div className="w-8 h-8 rounded-lg bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/10">
                <Sparkles size={14} className="text-[#4ade80]" />
              </div>
              <span className="text-sm font-bold uppercase tracking-wider text-emerald-300">Trileza Mentor Platform</span>
            </div>
          </div>

          {/* Banner title — offset cleanly so avatar never blocks text */}
          <div className="absolute bottom-4 left-28 sm:bottom-6 sm:left-36 md:left-44 md:bottom-7">
            <h2 className="text-white text-xl sm:text-3xl md:text-4xl font-black tracking-tight drop-shadow-lg">
              Mentor Profile
            </h2>
          </div>
        </div>

        {/* ── PROFILE INFO BAR ── */}
        <div className="relative bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">
          {/* Avatar overlapping banner */}
          <div className="absolute -top-12 sm:-top-16 left-4 sm:left-6 md:left-8 z-20">
            <div className="relative group">
              {/* Online ring */}
              <div className="absolute -inset-1.5 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[#22c55e] to-[#16a34a] opacity-80" />
              <div className="relative w-20 h-20 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-2xl sm:rounded-3xl border-[4px] sm:border-[5px] border-white dark:border-slate-900 shadow-2xl overflow-hidden bg-slate-100 dark:bg-slate-800">
                <img 
                  src={tutorData.avatar} 
                  alt={tutorData.name} 
                  className="w-full h-full object-cover"
                />
              </div>
              {/* Verified badge */}
              <div className="absolute -bottom-1 -right-1 w-7 h-7 sm:w-8 sm:h-8 bg-[#16a34a] rounded-xl border-[3px] border-white dark:border-slate-900 flex items-center justify-center shadow-lg">
                <CheckCircle size={14} className="text-white" />
              </div>
            </div>
          </div>

          {/* Info + Actions */}
          <div className="pt-3 sm:pt-4 md:pt-5 pb-4 sm:pb-6 px-4 sm:px-6 md:px-8 ml-0 md:ml-44">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mt-10 sm:mt-14 md:mt-0">
              {/* Left: Name + badge */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#dcfce7] dark:bg-emerald-950/40 text-[#166534] dark:text-emerald-400 text-xs font-bold uppercase tracking-wider border border-[#bbf7d0] dark:border-emerald-800/40">
                    <CheckCircle size={11} /> Verified Mentor
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
                    <Award size={11} className="text-[#16a34a]" /> {courses.length} {courses.length === 1 ? 'Course' : 'Courses'}
                  </span>
                </div>
                <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                  {tutorData.name}
                </h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium max-w-lg">
                  {tutorData.bio}
                </p>
              </div>

              {/* Right: Action buttons */}
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <Button
                    onClick={() => navigate('/profile/edit')} 
                    variant="outline"
                    className="border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-full px-5 h-10 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
                  >
                    <Edit2 size={14} /> Edit Profile
                  </Button>
                  <Button
                    onClick={() => navigate('/portfolio')} 
                    className="bg-[#16a34a] hover:bg-[#15803d] text-white border-none rounded-full px-5 h-10 font-bold text-sm shadow-lg shadow-green-600/25 flex items-center gap-2 cursor-pointer"
                  >
                    <Globe size={14} /> Public Profile
                  </Button>
                  <Button
                    onClick={() => navigate('/messages')} 
                    variant="outline"
                    className="border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-full px-5 h-10 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
                  >
                    <Mail size={14} /> Message
                  </Button>
              </div>
            </div>
          </div>
        </div>
      </div>


      {/* ── STATS ROW ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {/* Stat 1: Real mentee count */}
        <div className="relative overflow-hidden p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-[#f0fdf4] to-[#dcfce7] dark:from-emerald-950/40 dark:to-emerald-900/30 border border-[#bbf7d0]/50 dark:border-emerald-800/40 group hover:shadow-lg transition-all cursor-pointer" onClick={() => navigate('/mentorship')}>
          <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full bg-[#bbf7d0]/40 dark:bg-emerald-800/20 blur-xl" />
          <div className="relative z-10">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#bbf7d0] dark:bg-emerald-800/60 flex items-center justify-center mb-2.5 sm:mb-3 group-hover:scale-110 transition-transform">
              <Users size={18} className="text-[#166534] dark:text-emerald-300" />
            </div>
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#15803d] dark:text-emerald-400 mb-0.5">My Mentees</p>
            <p className="text-2xl sm:text-3xl font-black text-[#14532d] dark:text-emerald-200">{menteeCount}</p>
          </div>
        </div>

        {/* Stat 2: Real course count */}
        <div className="relative overflow-hidden p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-[#dcfce7] to-[#bbf7d0] dark:from-emerald-900/30 dark:to-emerald-950/40 border border-[#86efac]/40 dark:border-emerald-800/40 group hover:shadow-lg transition-all cursor-pointer" onClick={() => navigate('/tutor/courses/new')}>
          <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full bg-[#86efac]/40 dark:bg-emerald-800/20 blur-xl" />
          <div className="relative z-10">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#86efac] dark:bg-emerald-800/60 flex items-center justify-center mb-2.5 sm:mb-3 group-hover:scale-110 transition-transform">
              <BookOpen size={18} className="text-[#14532d] dark:text-emerald-300" />
            </div>
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#166534] dark:text-emerald-400 mb-0.5">Published</p>
            <p className="text-2xl sm:text-3xl font-black text-[#14532d] dark:text-emerald-200">{courses.filter(c => c.status === 'published').length}</p>
          </div>
        </div>

        {/* Stat 3: Total enrolled learners across courses */}
        <div className="relative overflow-hidden p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-[#f0fdf4] to-[#dcfce7] dark:from-emerald-950/40 dark:to-emerald-900/30 border border-[#bbf7d0]/50 dark:border-emerald-800/40 group hover:shadow-lg transition-all cursor-default">
          <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full bg-[#bbf7d0]/40 dark:bg-emerald-800/20 blur-xl" />
          <div className="relative z-10">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#bbf7d0] dark:bg-emerald-800/60 flex items-center justify-center mb-2.5 sm:mb-3 group-hover:scale-110 transition-transform">
              <TrendingUp size={18} className="text-[#166534] dark:text-emerald-300" />
            </div>
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#15803d] dark:text-emerald-400 mb-0.5">Learners</p>
            <p className="text-2xl sm:text-3xl font-black text-[#14532d] dark:text-emerald-200">{courses.reduce((sum, c) => sum + (c.enrolled_count || 0), 0)}</p>
          </div>
        </div>

        {/* Stat 4: Total courses (all statuses) */}
        <div className="relative overflow-hidden p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-[#166534] to-[#14532d] dark:from-emerald-900 dark:to-emerald-950 border border-[#22c55e]/20 group hover:shadow-lg transition-all cursor-pointer" onClick={() => navigate('/wallet')}>
          <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full bg-[#22c55e]/15 blur-xl" />
          <div className="relative z-10">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#22c55e]/20 flex items-center justify-center mb-2.5 sm:mb-3 group-hover:scale-110 transition-transform">
              <Award size={18} className="text-[#4ade80]" />
            </div>
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#86efac] mb-0.5">All Courses</p>
            <p className="text-2xl sm:text-3xl font-black text-white">{courses.length}</p>
          </div>
        </div>
      </div>


      {/* ═══════════════════════════════════════════════════════════════════
          TWO-COLUMN: About + Sidebar
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── LEFT: About & Expertise ── */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-4 sm:p-7 rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-lg bg-white dark:bg-slate-900">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#dcfce7] dark:bg-emerald-950/50 flex items-center justify-center">
                  <Briefcase size={15} className="text-[#16a34a] dark:text-emerald-400" />
                </div>
                About & Expertise
              </h3>
            </div>

            {/* Bio */}
            {tutorData.bio ? (
              <p className="text-slate-600 dark:text-slate-300 text-sm sm:text-base leading-relaxed mb-6 font-medium">{tutorData.bio}</p>
            ) : (
              <p className="text-slate-400 dark:text-slate-500 text-sm italic mb-6">No bio added yet. Click <strong>Edit Profile</strong> to add your bio and describe your background.</p>
            )}

            {/* Expertise */}
            <div className={`space-y-3 transition-all duration-500 overflow-hidden ${isExpanded ? 'max-h-[2000px]' : 'max-h-[260px]'}`}>
              {tutorData.expertise.map((exp, i) => (
                <div key={exp.id} className={cn(
                  "flex items-start gap-3 sm:gap-4 p-4 sm:p-5 rounded-2xl transition-all border group",
                  i % 2 === 0
                    ? "bg-[#f0fdf4] dark:bg-emerald-950/20 border-[#dcfce7] dark:border-emerald-800/30 hover:border-[#86efac]"
                    : "bg-slate-50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800 hover:border-slate-200"
                )}>
                  <div className={cn(
                    "p-2.5 sm:p-3 rounded-xl shrink-0",
                    i % 2 === 0 ? "bg-[#bbf7d0] dark:bg-emerald-900/50 text-[#166534] dark:text-emerald-300" : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                  )}>
                    {exp.icon === 'grad' ? <GradIcon size={18} /> : <Briefcase size={18} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">{exp.type}</p>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{exp.desc}</p>
                  </div>
                </div>
              ))}
              {/* Empty state for expertise when not editing */}
              {tutorData.expertise.length === 0 && (
                <div className="text-center py-6 border border-dashed border-slate-200 rounded-2xl">
                  <Briefcase size={24} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-slate-400 text-sm font-medium">No expertise entries yet.</p>
                  <button
                    className="mt-2 text-[#16a34a] text-xs font-bold hover:underline cursor-pointer"
                    onClick={() => navigate('/profile/edit')}
                  >
                    + Add your background & credentials
                  </button>
                </div>
              )}
            </div>

            {/* Expand */}
            {tutorData.expertise.length > 2 && (
              <div className="pt-4 border-t border-slate-100 mt-4 text-center">
                <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-900 font-bold" onClick={() => setIsExpanded(!isExpanded)}>
                  {isExpanded ? <span className="flex items-center gap-1">Show Less <ChevronUp size={16} /></span> : <span className="flex items-center gap-1">Show All <ChevronDown size={16} /></span>}
                </Button>
              </div>
            )}

            {/* Save/Edit actions */}
            <div className="flex gap-3 mt-6 pt-5 border-t border-slate-100">
              <Button 
                variant="outline" 
                className="border-slate-200 hover:bg-slate-50 text-slate-700 rounded-full px-6 h-10 font-bold flex items-center gap-2 cursor-pointer"
                onClick={() => navigate('/profile/edit')}
              >
                <Edit2 size={15} /> Edit Profile
              </Button>
              <Button 
                className="bg-slate-900 hover:bg-slate-800 text-white border-none rounded-full px-6 h-10 font-bold flex items-center gap-2 shadow-md cursor-pointer"
                onClick={() => navigate('/messages')}
              >
                <Mail size={15} /> Contact
              </Button>
            </div>
          </Card>
        </div>

        {/* ── RIGHT SIDEBAR (1 col) ── */}
        <div className="space-y-6">

          {/* Quick Actions — Dark green */}
          <Card className="p-0 rounded-2xl overflow-hidden border-none shadow-xl">
            <div className="p-6 bg-gradient-to-br from-[#14532d] to-[#052e16] relative">
              <div className="absolute top-0 right-0 w-40 h-40 bg-[#22c55e]/10 rounded-full blur-3xl" />
              <div className="relative z-10">
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#86efac] mb-4 flex items-center gap-2">
                  <Zap size={14} /> Quick Actions
                </h3>
                <div className="space-y-2">
                  {[
                    { icon: Plus, label: 'Create Course', desc: 'Build new curriculum', path: '/tutor/courses/new' },
                    { icon: Radio, label: 'Go Live', desc: 'Start a live session', path: '/live' },
                    { icon: Award, label: 'Assess Students', desc: 'Grade & evaluate', path: '/mentorship-assessment' },
                    { icon: BarChart3, label: 'View Analytics', desc: 'Performance data', path: '/analytics' },
                  ].map((action) => (
                    <button
                      key={action.label}
                      onClick={() => navigate(action.path)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.06] transition-all text-left group"
                    >
                      <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                        <action.icon size={16} className="text-[#4ade80]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-bold text-sm truncate">{action.label}</p>
                        <p className="text-white/40 text-xs truncate">{action.desc}</p>
                      </div>
                      <ChevronRight size={14} className="text-white/20 group-hover:text-white/50 shrink-0 transition-colors" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          {/* Portfolio & Links */}
          <Card className="p-4 sm:p-6 rounded-2xl bg-[#f0fdf4] dark:bg-emerald-950/20 border border-[#bbf7d0]/40 dark:border-emerald-800/30 shadow-lg">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#166534] dark:text-emerald-400 mb-4 flex items-center gap-2">
              <Globe size={14} className="text-[#16a34a]" /> Portfolio & Links
            </h3>
            <div className="space-y-2.5">
              {tutorData.website && (
                <button 
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-900 hover:shadow-md border border-[#dcfce7] dark:border-emerald-800/30 transition-all group text-left cursor-pointer"
                  onClick={() => window.open(tutorData.website.startsWith('http') ? tutorData.website : `https://${tutorData.website}`, '_blank')}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-[#dcfce7] dark:bg-emerald-950/50 flex items-center justify-center">
                      <Globe size={14} className="text-[#16a34a] dark:text-emerald-400" />
                    </div>
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate max-w-[140px]">{tutorData.website}</span>
                  </div>
                  <ExternalLink size={13} className="text-slate-300 dark:text-slate-600 group-hover:text-[#16a34a] transition-colors" />
                </button>
              )}
              <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-900 border border-[#dcfce7] dark:border-emerald-800/30">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#bbf7d0] dark:bg-emerald-900/50 flex items-center justify-center">
                    <Users size={14} className="text-[#15803d] dark:text-emerald-300" />
                  </div>
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{courses.reduce((sum, c) => sum + (c.enrolled_count || 0), 0).toLocaleString()} Learners</span>
                </div>
                <CheckCircle size={13} className="text-[#22c55e]" />
              </div>
              <Button 
                className="w-full rounded-xl h-10 mt-2 font-bold text-sm bg-[#166534] dark:bg-emerald-600 text-white hover:bg-[#14532d] dark:hover:bg-emerald-500 border-none shadow-md cursor-pointer"
                onClick={() => navigate('/portfolio')}
              >
                View Portfolio →
              </Button>
            </div>
          </Card>
        </div>
      </div>





      {/* ═══════════════════════════════════════════════════════════════════
          MY COURSES
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">My Courses</h2>
            <p className="text-slate-500 text-sm font-medium mt-1">Manage and monitor your curriculum performance</p>
          </div>
          <Button 
            className="rounded-full px-6 h-10 bg-[#16a34a] hover:bg-[#15803d] text-white font-bold text-sm flex items-center gap-2 border-none shadow-lg shadow-green-600/20"
            onClick={() => navigate('/tutor/courses/new')}
          >
            <Plus size={16} /> New Course
          </Button>
        </div>

        {loadingCourses ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-5">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-64 animate-pulse bg-slate-100 dark:bg-slate-800 rounded-2xl" />
            ))}
          </div>
        ) : courses.length === 0 ? (
          <div className="p-8 sm:p-16 text-center rounded-2xl border-2 border-dashed border-[#bbf7d0] dark:border-emerald-800/40 bg-gradient-to-br from-[#f0fdf4] to-white dark:from-emerald-950/20 dark:to-slate-900">
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-[#dcfce7] dark:bg-emerald-950/50 rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-5 text-[#16a34a] dark:text-emerald-400">
              <BookOpen size={28} />
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">No courses yet</h3>
            <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm max-w-xs mx-auto mt-2 leading-relaxed">Start your journey as an educator by creating your first course.</p>
            <Button 
              className="mt-5 sm:mt-6 bg-[#16a34a] hover:bg-[#15803d] text-white border-none rounded-full px-6 sm:px-8 h-10 font-bold text-xs sm:text-sm shadow-lg shadow-green-600/20"
              onClick={() => navigate('/tutor/courses/new')}
            >
              Create First Course →
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-5">
            {courses.map((course) => (
              <div 
                key={course.id} 
                className="group overflow-hidden rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-md hover:shadow-xl transition-all duration-500 cursor-pointer bg-white dark:bg-slate-900"
                onClick={() => navigate(`/tutor/courses/${course.id}`)}
              >
                <div className="relative aspect-video bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  {course.thumbnail_url ? (
                    <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #166534, #14532d)' }}>
                      <Layout size={40} className="text-white/10" />
                    </div>
                  )}
                  <div className="absolute top-3 right-3">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider text-white shadow-lg backdrop-blur-sm",
                      course.status === 'published' ? 'bg-[#16a34a]/90' : 'bg-amber-500/90'
                    )}>
                      {course.status}
                    </span>
                  </div>
                </div>
                <div className="p-4 sm:p-5">
                  <h3 className="font-bold text-slate-900 dark:text-white line-clamp-2 group-hover:text-[#16a34a] dark:group-hover:text-emerald-400 transition-colors text-sm sm:text-base">{course.title}</h3>
                  <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <Users size={13} />
                      <span className="text-xs font-bold">{course.enrolled_count}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock size={13} />
                      <span className="text-xs font-bold">Draft</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default TutorDashboard;
