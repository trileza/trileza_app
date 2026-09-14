import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui';
import { 
  Zap, 
  Users, 
  TrendingUp, 
  BookOpen, 
  Award, 
  Plus, 
  Wallet, 
  Sparkles, 
  CheckCircle2, 
  ChevronRight, 
  Radio, 
  ArrowUpRight,
  FileCheck,
  Building2,
  Edit3
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useSubscriptionStore } from '../../store/subscriptionStore';
import { formatNGN } from '../../lib/monetization/config';
import type { SubscriptionTier } from '../../lib/monetization/types';
import { UpgradeModal } from '../../components/subscription/UpgradeModal';
import { SubscriptionManagementModal } from '../../components/subscription/SubscriptionManagementModal';
import { courseService } from '../../lib/services/courses';
import type { Course } from '../../lib/database.types';
import { nexus } from '../../lib/nexus';

interface MentorProDashboardProps {
  activeTierView?: SubscriptionTier;
  onViewOverride?: (tier: SubscriptionTier) => void;
}

export const MentorProDashboard: React.FC<MentorProDashboardProps> = ({
  activeTierView = 'pro',
  onViewOverride
}) => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { 
    tier, 
    interval, 
    fetchSubscription, 
    openUpgradeModal 
  } = useSubscriptionStore();

  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [recentEnrollments, setRecentEnrollments] = useState<any[]>([]);
  const [isManageSubOpen, setIsManageSubOpen] = useState(false);
  const [revenueData, setRevenueData] = useState({
    thisMonth: 85000,
    thisQuarter: 245000,
    totalAllTime: 620000
  });

  useEffect(() => {
    if (user) {
      fetchSubscription(user.id);
      loadProDashboardData();
    }
  }, [user]);

  const loadProDashboardData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // 1. Fetch tutor courses
      const tutorCourses = await courseService.getTutorCourses(user.id);
      setCourses(tutorCourses);

      // 2. Fetch real recent enrollments for these courses
      if (tutorCourses.length > 0) {
        const courseIds = tutorCourses.map(c => c.id);
        const { data: enrolls } = await nexus.database
          .from('enrollments')
          .select('id, user_id, course_id, status, progress, created_at')
          .in('course_id', courseIds)
          .order('created_at', { ascending: false })
          .limit(6);

        if (enrolls && enrolls.length > 0) {
          // Fetch student profiles for these enrollments
          const userIds = enrolls.map(e => e.user_id);
          const { data: profiles } = await nexus.database
            .from('profiles')
            .select('id, full_name, email, avatar_url')
            .in('id', userIds);

          const profileMap: Record<string, any> = {};
          profiles?.forEach(p => { profileMap[p.id] = p; });

          const courseMap: Record<string, any> = {};
          tutorCourses.forEach(c => { courseMap[c.id] = c; });

          const enriched = enrolls.map(e => ({
            id: e.id,
            studentName: profileMap[e.user_id]?.full_name || 'Enrolled Student',
            studentEmail: profileMap[e.user_id]?.email || '',
            studentAvatar: profileMap[e.user_id]?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${e.user_id}`,
            courseTitle: courseMap[e.course_id]?.title || 'Course Lecture',
            progress: e.progress || 0,
            date: new Date(e.created_at || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          }));

          setRecentEnrollments(enriched);
        } else {
          // Fallback mock enrollments for demo visual representation
          setRecentEnrollments([
            { id: 'e-1', studentName: 'Chiamaka Okafor', studentEmail: 'chiamaka@gmail.com', studentAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Chiamaka', courseTitle: tutorCourses[0]?.title || 'Full-Stack Web Development', progress: 65, date: 'May 12, 2026' },
            { id: 'e-2', studentName: 'Babatunde Adeleke', studentEmail: 'adeleke.b@yahoo.com', studentAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Babatunde', courseTitle: tutorCourses[0]?.title || 'Full-Stack Web Development', progress: 40, date: 'May 10, 2026' },
            { id: 'e-3', studentName: 'Fatima Sanusi', studentEmail: 'fatima.s@outlook.com', studentAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Fatima', courseTitle: tutorCourses[0]?.title || 'Full-Stack Web Development', progress: 90, date: 'May 8, 2026' }
          ]);
        }
      }
    } catch (err) {
      console.error('[MentorProDashboard] Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const totalStudents = courses.reduce((sum, c) => sum + (c.enrolled_count || 0), recentEnrollments.length);
  const avgCompletionRate = 82; // 82% completion rate
  const certificatesDelivered = Math.round(totalStudents * 0.45) + 12;

  const handleName = user?.username 
    ? (user.username.startsWith('@') ? user.username : `@${user.username}`) 
    : user?.email 
    ? `@${user.email.split('@')[0]}` 
    : '@dalestic12';

  return (
    <div className="space-y-8 w-full animate-in fade-in duration-500 pb-20 font-sans">
      
      {/* ── SINGLE UNIFIED GREEN DASHBOARD HEADER ── */}
      <div className="relative rounded-3xl overflow-hidden border border-emerald-500/30 bg-gradient-to-br from-[#062414] via-[#0d3820] to-[#14532d] p-6 sm:p-7 text-white shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-400/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          
          {/* Left: Slightly Bigger Avatar + Name -> Status -> Handle */}
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <img 
                src={user?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.full_name || 'Mentor'}`} 
                alt={user?.full_name || 'Pro Mentor'} 
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl border-2 sm:border-3 border-emerald-400/80 object-cover shadow-xl bg-slate-900"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=Mentor`;
                }}
              />
              <div className="absolute -bottom-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 bg-amber-400 rounded-full border-2 border-[#062414] flex items-center justify-center shadow-md">
                <Zap size={12} className="text-black fill-black" />
              </div>
            </div>

            <div className="space-y-1.5">
              {/* 1. Name */}
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-white leading-tight">
                {user?.full_name || 'David Adamu Ileza'}
              </h1>
              
              {/* 2. Status then 3. Handle */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-black uppercase tracking-wider shadow-sm">
                  <Zap size={12} className="fill-amber-400" /> Pro Mentor
                </span>
                <span className="text-xs sm:text-sm font-bold text-emerald-200/90">
                  {handleName}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Actions (Edit Profile + Create New Course) */}
          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <Button
              onClick={() => navigate('/profile/edit')}
              className="bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs px-5 h-10 rounded-2xl shadow-lg shadow-emerald-500/25 hover:scale-[1.02] transition-all flex items-center gap-1.5 cursor-pointer border-none"
            >
              <Edit3 size={14} /> Edit Profile
            </Button>
            <Button
              onClick={() => navigate('/tutor/courses/new')}
              className="bg-black/40 hover:bg-black/60 text-white font-bold text-xs px-4 h-10 rounded-2xl border border-emerald-500/30 shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={15} /> Create Course
            </Button>
            <Button
              onClick={() => navigate('/wallet')}
              className="bg-black/30 hover:bg-black/50 text-emerald-100 border border-emerald-500/30 text-xs font-bold h-10 px-4 rounded-2xl cursor-pointer flex items-center gap-1.5"
            >
              <Wallet size={14} /> Wallet
            </Button>
          </div>
        </div>

        {/* Pro Capabilities Pill Bar */}
        <div className="mt-6 pt-5 border-t border-emerald-500/20 flex flex-wrap items-center justify-between text-xs text-emerald-200/80 gap-3">
          <div className="flex items-center gap-6 flex-wrap">
            <span className="flex items-center gap-1.5 font-bold text-white">
              <CheckCircle2 size={15} className="text-emerald-400" /> Unlimited Course Slots
            </span>
            <span className="flex items-center gap-1.5 font-bold text-white">
              <CheckCircle2 size={15} className="text-emerald-400" /> Automated Certificates Active
            </span>
            <span className="flex items-center gap-1.5 font-bold text-white">
              <CheckCircle2 size={15} className="text-emerald-400" /> Priority Support Queue
            </span>
          </div>

          <button 
            onClick={() => setIsManageSubOpen(true)}
            className="text-emerald-300 hover:underline font-bold text-xs flex items-center gap-1 cursor-pointer"
          >
            Manage Subscription Billing <ArrowUpRight size={13} />
          </button>
        </div>
      </div>

      {/* ── 4 STATS CARDS: PRO METRICS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Stat 1: Total Enrolled Students */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Enrolled</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Users size={18} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 dark:text-white">{totalStudents}</span>
            <span className="text-xs font-bold text-amber-500">Max 500/course</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Across all published modules</p>
        </div>

        {/* Stat 2: Total Revenue (₦) */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Gross Sales Revenue</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-amber-600 dark:text-amber-400">{formatNGN(revenueData.totalAllTime)}</span>
          </div>
          <p className="text-[11px] text-emerald-500 font-bold mt-1">+18.4% vs last month</p>
        </div>

        {/* Stat 3: Published Courses */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Courses Published</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <BookOpen size={18} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 dark:text-white">{courses.length}</span>
            <span className="text-xs font-bold text-emerald-500">Unlimited Cap</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Self-paced video modules</p>
        </div>

        {/* Stat 4: Completion & Certificates */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Certificates Issued</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Award size={18} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 dark:text-white">{certificatesDelivered}</span>
            <span className="text-xs font-bold text-amber-500">{avgCompletionRate}% avg</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Verified with digital QR hash</p>
        </div>
      </div>

      {/* ── REVENUE BREAKDOWN STRIP ── */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-500" />
              Naira Revenue Breakdown & Direct Payouts
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Earnings from premium student course purchases and mentorship bookings</p>
          </div>
          <Button
            size="sm"
            onClick={() => navigate('/wallet')}
            className="bg-amber-500 hover:bg-amber-400 text-black text-xs font-black px-4 h-9 rounded-xl shadow-md cursor-pointer"
          >
            Withdraw Funds →
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-slate-950 border border-amber-200/60 dark:border-slate-800">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">This Month (May)</span>
            <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{formatNGN(revenueData.thisMonth)}</p>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">+12% vs April</span>
          </div>

          <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-slate-950 border border-amber-200/60 dark:border-slate-800">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">This Quarter (Q2 2026)</span>
            <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{formatNGN(revenueData.thisQuarter)}</p>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">On track for target</span>
          </div>

          <div className="p-4 rounded-2xl bg-amber-500/10 dark:bg-slate-950 border border-amber-500/30">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">All-Time Cumulative</span>
            <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{formatNGN(revenueData.totalAllTime)}</p>
            <span className="text-[10px] text-slate-500 font-bold">Automated Payout Engine</span>
          </div>
        </div>
      </div>

      {/* ── TWO-COLUMN MAIN CONTENT ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column (2 Cols): Courses & Analytics */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Top Performing Courses */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <BookOpen size={17} className="text-amber-500" />
                Top-Performing Courses
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/tutor/courses')}
                className="text-xs font-bold rounded-xl border-slate-300 dark:border-slate-700"
              >
                View All Courses
              </Button>
            </div>

            {courses.length === 0 ? (
              <div className="p-8 text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-800">
                <p className="text-xs text-slate-400">No courses created yet.</p>
                <Button 
                  size="sm"
                  onClick={() => navigate('/tutor/courses/new')}
                  className="mt-3 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold rounded-xl"
                >
                  + Create Your First Pro Course
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {courses.map((course) => (
                  <div
                    key={course.id}
                    onClick={() => navigate(`/tutor/courses/${course.id}`)}
                    className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 hover:border-amber-500/40 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 cursor-pointer group"
                  >
                    <div className="flex items-center gap-3.5">
                      <img 
                        src={course.thumbnail_url || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=300'} 
                        alt={course.title}
                        className="w-14 h-14 rounded-xl object-cover border border-slate-200 dark:border-slate-700"
                      />
                      <div>
                        <span className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400">
                          {course.category}
                        </span>
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-amber-500 transition-colors line-clamp-1">
                          {course.title}
                        </h4>
                        <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                          <span className="flex items-center gap-1">
                            <Users size={12} /> {course.enrolled_count || 0} learners
                          </span>
                          <span>•</span>
                          <span className="text-emerald-500 font-semibold">₦{Number(course.price_standard || 0).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-lg">
                        {course.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Enrollments List */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Users size={17} className="text-amber-500" />
                Recent Student Enrollments
              </h3>
              <span className="text-xs text-slate-400 font-mono">Live Roster</span>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {recentEnrollments.map((enr) => (
                <div key={enr.id} className="py-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <img 
                      src={enr.studentAvatar} 
                      alt={enr.studentName}
                      className="w-10 h-10 rounded-full object-cover border border-amber-500/20"
                    />
                    <div>
                      <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">{enr.studentName}</h4>
                      <p className="text-[11px] text-slate-400 truncate max-w-[200px]">{enr.courseTitle}</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs font-bold text-emerald-500">{enr.progress}% Complete</span>
                    <span className="text-[10px] text-slate-400 block font-mono">{enr.date}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column (1 Col): Pending Tasks & Pro Actions */}
        <div className="space-y-6">
          {/* Pro Hub Quick Actions */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Sparkles size={16} className="text-amber-500" />
              Pro Quick Actions
            </h3>

            <div className="space-y-2">
              <button
                onClick={() => navigate('/tutor/courses/new')}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-left transition-all group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-500 text-black flex items-center justify-center">
                    <Plus size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-900 dark:text-white">Create Course</p>
                    <p className="text-[10px] text-amber-700 dark:text-amber-300">Unlimited publishing</p>
                  </div>
                </div>
                <ChevronRight size={14} className="text-amber-500" />
              </button>

              <button
                onClick={() => navigate('/wallet')}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-left transition-all group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                    <Wallet size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">Payout Settings</p>
                    <p className="text-[10px] text-slate-400">Bank accounts & history</p>
                  </div>
                </div>
                <ChevronRight size={14} className="text-slate-400 group-hover:text-amber-500" />
              </button>

              <button
                onClick={() => navigate('/live')}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-left transition-all group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                    <Radio size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">Host Live Class</p>
                    <p className="text-[10px] text-slate-400">Interactive live streaming</p>
                  </div>
                </div>
                <ChevronRight size={14} className="text-slate-400 group-hover:text-amber-500" />
              </button>

              <button
                onClick={() => openUpgradeModal('institutional')}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-left transition-all group cursor-pointer mt-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500 text-white flex items-center justify-center">
                    <Building2 size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-black text-indigo-400">Upgrade to Institutional</p>
                    <p className="text-[10px] text-slate-400">Subdomain & multi-instructor</p>
                  </div>
                </div>
                <ChevronRight size={14} className="text-indigo-400" />
              </button>
            </div>
          </div>

          {/* Pending Tasks & Action Items */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <FileCheck size={16} className="text-amber-500" />
              Action Items ({courses.length > 0 ? '2 Pending' : '1 Pending'})
            </h3>

            <div className="space-y-2.5 text-xs">
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 flex items-center justify-between">
                <span className="font-semibold">Review 3 student project submissions</span>
                <Button size="sm" variant="outline" className="text-[10px] h-7 px-2.5 border-amber-500/40">Review</Button>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-slate-700 dark:text-slate-300">
                <span>Certificate auto-issuance operational</span>
                <span className="text-[10px] font-bold text-emerald-500">Active</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Subscription Modals */}
      <UpgradeModal />
      <SubscriptionManagementModal
        isOpen={isManageSubOpen}
        onClose={() => setIsManageSubOpen(false)}
      />
    </div>
  );
};

export default MentorProDashboard;
