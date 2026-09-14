import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui';
import { 
  BookOpen, 
  Users, 
  TrendingUp, 
  Sparkles, 
  Plus, 
  CheckCircle2, 
  Zap, 
  Mail, 
  Radio, 
  ChevronRight,
  Shield,
  Activity,
  Edit3
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useSubscriptionStore } from '../../store/subscriptionStore';
import { MONETIZATION_TIERS, formatNGN } from '../../lib/monetization/config';
import type { SubscriptionTier } from '../../lib/monetization/types';
import { UpgradeModal } from '../../components/subscription/UpgradeModal';
import { SubscriptionManagementModal } from '../../components/subscription/SubscriptionManagementModal';
import { courseService } from '../../lib/services/courses';
import type { Course } from '../../lib/database.types';
import { nexus } from '../../lib/nexus';

interface FreeMentorDashboardProps {
  activeTierView?: SubscriptionTier;
  onViewOverride?: (tier: SubscriptionTier) => void;
}

export const FreeMentorDashboard: React.FC<FreeMentorDashboardProps> = ({
  activeTierView = 'free',
  onViewOverride
}) => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { 
    tier, 
    interval,
    usage, 
    fetchSubscription, 
    openUpgradeModal, 
    canPublishCourse 
  } = useSubscriptionStore();

  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [menteesCount, setMenteesCount] = useState(0);
  const [isManageSubOpen, setIsManageSubOpen] = useState(false);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      fetchSubscription(user.id);
      loadDashboardData();
    }
  }, [user]);

  const loadDashboardData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // 1. Fetch mentor's courses
      const tutorCourses = await courseService.getTutorCourses(user.id);
      setCourses(tutorCourses);

      // 2. Fetch enrolled mentees count
      const { count } = await nexus.database
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('metadata->>assigned_mentor_id', user.id);
      setMenteesCount(count || 0);

      // 3. Construct real activity feed
      const activities = [];
      if (tutorCourses.length > 0) {
        activities.push({
          id: 'act-1',
          type: 'course',
          title: `Course Created: "${tutorCourses[0].title}"`,
          desc: `Status is currently ${tutorCourses[0].status}. Students can discover it in the library.`,
          time: new Date(tutorCourses[0].created_at || Date.now()).toLocaleDateString(),
          icon: BookOpen,
          color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40'
        });
      } else {
        activities.push({
          id: 'act-welcome',
          type: 'welcome',
          title: 'Welcome to Trileza Mentorship!',
          desc: 'Get started by creating your first curriculum blueprint below.',
          time: 'Today',
          icon: Sparkles,
          color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40'
        });
      }

      activities.push({
        id: 'act-profile',
        type: 'profile',
        title: 'Mentor Profile Active on Free Tier',
        desc: 'You can publish 1 course and enroll up to 50 students at ₦0 cost.',
        time: 'Active',
        icon: Shield,
        color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40'
      });

      setRecentActivities(activities);
    } catch (err) {
      console.error('[FreeMentorDashboard] Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const publishedCount = courses.filter(c => c.status === 'published').length;
  const maxCourses = 1;
  const isCourseQuotaFull = publishedCount >= maxCourses;

  const totalStudents = courses.reduce((sum, c) => sum + (c.enrolled_count || 0), menteesCount);
  const maxStudents = 50;
  const studentPercentage = Math.min(100, Math.round((totalStudents / maxStudents) * 100));

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
                alt={user?.full_name || 'Mentor'} 
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl border-2 sm:border-3 border-emerald-400/80 object-cover shadow-xl bg-slate-900"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=Mentor`;
                }}
              />
              <div className="absolute -bottom-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 bg-emerald-500 rounded-full border-2 border-[#062414] flex items-center justify-center shadow-md">
                <CheckCircle2 size={13} className="text-black stroke-[3]" />
              </div>
            </div>

            <div className="space-y-1.5">
              {/* 1. Name */}
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-white leading-tight">
                {user?.full_name || 'David Adamu Ileza'}
              </h1>
              
              {/* 2. Status then 3. Handle */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-black uppercase tracking-wider shadow-sm">
                  <Sparkles size={12} /> Free Mentor
                </span>
                <span className="text-xs sm:text-sm font-bold text-emerald-200/90">
                  {handleName}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Edit Profile Button */}
          <div className="flex items-center gap-3 shrink-0">
            <Button
              onClick={() => navigate('/profile/edit')}
              className="bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs px-5 h-10 rounded-2xl shadow-lg shadow-emerald-500/25 hover:scale-[1.02] transition-all flex items-center gap-1.5 cursor-pointer border-none"
            >
              <Edit3 size={14} /> Edit Profile
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsManageSubOpen(true)}
              className="border-emerald-500/40 text-emerald-100 hover:bg-emerald-800/40 text-xs font-bold h-10 px-4 rounded-2xl cursor-pointer"
            >
              Plan Details
            </Button>
          </div>
        </div>

        {/* Live Quota Bar inside Hero */}
        <div className="mt-6 pt-5 border-t border-emerald-500/20 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Course Limit Meter */}
          <div className="p-3.5 rounded-2xl bg-black/25 border border-emerald-500/20 flex flex-col justify-between space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-emerald-200">Course Publishing Quota:</span>
              <span className="font-mono font-black text-white">
                {publishedCount} of {maxCourses} Published ({isCourseQuotaFull ? '100% Used' : '0% Used'})
              </span>
            </div>
            <div className="w-full bg-emerald-950 h-2 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 ${isCourseQuotaFull ? 'bg-amber-400' : 'bg-emerald-400'}`} 
                style={{ width: `${(publishedCount / maxCourses) * 100}%` }}
              />
            </div>
          </div>

          {/* Student Limit Meter */}
          <div className="p-3.5 rounded-2xl bg-black/25 border border-emerald-500/20 flex flex-col justify-between space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-emerald-200">Student Capacity:</span>
              <span className="font-mono font-black text-white">
                {totalStudents} of {maxStudents} Students ({studentPercentage}%)
              </span>
            </div>
            <div className="w-full bg-emerald-950 h-2 rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-400 transition-all duration-500" 
                style={{ width: `${studentPercentage}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── 4 STATS CARDS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Stat 1: Published Courses */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Published Courses</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <BookOpen size={18} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 dark:text-white">{publishedCount}</span>
            <span className="text-xs font-bold text-slate-400">/ 1 Max</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {isCourseQuotaFull ? 'Limit reached (Upgrade for Unlimited)' : '1 slot available'}
          </p>
        </div>

        {/* Stat 2: Total Students */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Enrolled Students</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Users size={18} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 dark:text-white">{totalStudents}</span>
            <span className="text-xs font-bold text-slate-400">/ 50 Max</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Free tier cap ({50 - totalStudents} slots left)
          </p>
        </div>

        {/* Stat 3: Total Revenue */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Course Revenue</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 dark:text-white">₦0</span>
            <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded">Free Plan</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Earn sales revenue on Pro Tier
          </p>
        </div>

        {/* Stat 4: Support Level */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Support Desk</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Shield size={18} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">Standard</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Community & Knowledge Base
          </p>
        </div>
      </div>

      {/* ── UPGRADE PROMO BANNER (Subtle & Value-Driven) ── */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-emerald-500" />
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
              Ready to scale your teaching? Upgrade to Pro Mentor
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Unlock <strong>unlimited courses</strong>, up to <strong>500 students per course</strong>, <strong>automated certificate issuance</strong>, and direct <strong>course sales monetization</strong> for ₦10,000/month or ₦100,000/year.
          </p>
        </div>

        <Button
          onClick={() => openUpgradeModal('pro')}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs px-6 h-11 rounded-2xl shadow-md hover:scale-[1.02] transition-all shrink-0 cursor-pointer"
        >
          Upgrade to Pro (₦10k/mo) →
        </Button>
      </div>

      {/* ── TWO-COLUMN MAIN CONTENT: Courses + Activity Feed & Quick Actions ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column (2 Cols): Course Management */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                My Courses
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {publishedCount} of {maxCourses} course published on Free Mentor tier
              </p>
            </div>

            <Button
              onClick={() => {
                const check = canPublishCourse(publishedCount);
                if (!check.allowed) {
                  openUpgradeModal('pro');
                } else {
                  navigate('/tutor/courses/new');
                }
              }}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-5 h-10 rounded-2xl flex items-center gap-1.5 shadow-md cursor-pointer"
            >
              <Plus size={16} /> Create Course
            </Button>
          </div>

          {courses.length === 0 ? (
            <div className="p-10 text-center rounded-3xl border-2 border-dashed border-emerald-500/30 bg-emerald-50/5 dark:bg-slate-900 space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                <BookOpen size={28} />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  No courses created yet
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  Take the first step as an instructor. Use our visual course builder to organize modules, topics, and lecture materials.
                </p>
              </div>
              <Button
                onClick={() => navigate('/tutor/courses/new')}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-6 h-10 rounded-2xl shadow-md cursor-pointer"
              >
                + Create Your First Course
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {courses.map((course) => (
                <div 
                  key={course.id}
                  onClick={() => navigate(`/tutor/courses/${course.id}`)}
                  className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 cursor-pointer group"
                >
                  <div className="flex items-center gap-4">
                    <img 
                      src={course.thumbnail_url || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400'} 
                      alt={course.title}
                      className="w-16 h-16 rounded-2xl object-cover border border-slate-200 dark:border-slate-800"
                    />
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                        {course.category}
                      </span>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-emerald-600 transition-colors">
                        {course.title}
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {course.enrolled_count || 0} enrolled learners • Free Audit Mode
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] font-bold uppercase px-3 py-1 rounded-full ${
                      course.status === 'published'
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                    }`}>
                      {course.status}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs font-bold rounded-xl border-slate-300 dark:border-slate-700"
                    >
                      Edit Curriculum →
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column (1 Col): Quick Actions & Recent Activity Feed */}
        <div className="space-y-6">
          {/* Quick Actions Card */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Zap size={16} className="text-emerald-500" />
              Quick Actions
            </h3>

            <div className="space-y-2">
              <button
                onClick={() => {
                  const check = canPublishCourse(publishedCount);
                  if (!check.allowed) openUpgradeModal('pro');
                  else navigate('/tutor/courses/new');
                }}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 border border-slate-200 dark:border-slate-800 text-left transition-all group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <Plus size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">Create Course</p>
                    <p className="text-[10px] text-slate-400">1 free course slot</p>
                  </div>
                </div>
                <ChevronRight size={14} className="text-slate-400 group-hover:text-emerald-500" />
              </button>

              <button
                onClick={() => navigate('/live')}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 border border-slate-200 dark:border-slate-800 text-left transition-all group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <Radio size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">Live Studio</p>
                    <p className="text-[10px] text-slate-400">Host interactive class</p>
                  </div>
                </div>
                <ChevronRight size={14} className="text-slate-400 group-hover:text-emerald-500" />
              </button>

              <button
                onClick={() => navigate('/messages')}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 border border-slate-200 dark:border-slate-800 text-left transition-all group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <Mail size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">Direct Messages</p>
                    <p className="text-[10px] text-slate-400">Connect with mentees</p>
                  </div>
                </div>
                <ChevronRight size={14} className="text-slate-400 group-hover:text-emerald-500" />
              </button>
            </div>
          </div>

          {/* Activity Feed */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Activity size={16} className="text-emerald-500" />
              Recent Activity
            </h3>

            <div className="space-y-3">
              {recentActivities.map((act) => (
                <div key={act.id} className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60 flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-xl ${act.color} flex items-center justify-center shrink-0 mt-0.5`}>
                    <act.icon size={15} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white">{act.title}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug mt-0.5">{act.desc}</p>
                    <span className="text-[9px] font-mono text-slate-400 mt-1 block">{act.time}</span>
                  </div>
                </div>
              ))}
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

export default FreeMentorDashboard;
