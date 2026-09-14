import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui';
import { 
  BookOpen, 
  PlayCircle, 
  Clock, 
  Users, 
  Shield, 
  CheckCircle2, 
  Video, 
  Award, 
  Edit3, 
  MessageSquare, 
  Radio, 
  Flame, 
  ArrowRight, 
  Compass, 
  Check
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuthStore } from '../../store/authStore';
import { courseService } from '../../lib/services/courses';
import { enrollmentService } from '../../lib/services/enrollments';
import { cn } from '../../utils';
import type { Course, Enrollment } from '../../lib/database.types';
import LibraryHighlights from '../../components/shared/LibraryHighlights';
import TodoWidget from '../../components/shared/TodoWidget';
import { nexus } from '../../lib/nexus';
import { usePullToRefresh } from '../../utils/usePullToRefresh';
import { useMultiTableSync } from '../../components/admin/hooks/useAdminData';

const DEFAULT_COURSE_THUMBNAIL = 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=80';

export const StudentDashboard: React.FC = () => {
  const { user, updateProfile, setActiveRole } = useAuthStore();
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(user?.full_name || '');
  
  const [mentors, setMentors] = useState<any[]>([]);
  const [assignedMentor, setAssignedMentor] = useState<any | null>(null);
  const [assigning, setAssigning] = useState(false);

  const fetchDashboardData = async () => {
    try {
      const [coursesData, enrollmentsData] = await Promise.all([
        courseService.getAllCourses(),
        enrollmentService.getUserEnrollments(user!.id)
      ]);
      setCourses(coursesData);
      setEnrollments(enrollmentsData);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const { pullOffset, refreshing } = usePullToRefresh({
    onRefresh: fetchDashboardData
  });

  useEffect(() => {
    if (user) {
      fetchDashboardData();
      fetchMentorData();
    }
  }, [user]);

  // Real-time synchronization with profiles and mentor applications
  useMultiTableSync(
    ['profiles', 'mentor_applications', 'courses', 'enrollments'],
    () => {
      fetchDashboardData();
      fetchMentorData();
      useAuthStore.getState().syncProfile();
    }
  );

  const fetchMentorData = async () => {
    try {
      const { data: mentorsList, error } = await nexus.database
        .from('public_profiles')
        .select('*')
        .or('role.eq.mentor,role.eq.tutor');

      if (error) throw error;
      setMentors(mentorsList || []);

      const assignedId = user?.metadata?.assigned_mentor_id;
      if (assignedId && mentorsList) {
        const found = mentorsList.find((m: any) => m.id === assignedId);
        if (found) {
          setAssignedMentor(found);
        } else {
          const { data: individual } = await nexus.database
            .from('public_profiles')
            .select('*')
            .eq('id', assignedId)
            .maybeSingle();
          if (individual) {
            setAssignedMentor(individual);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching mentor data:', err);
    }
  };

  const handleSelectMentor = async (mentorId: string) => {
    if (assigning) return;
    setAssigning(true);
    try {
      const updatedMetadata = {
        ...user?.metadata,
        assigned_mentor_id: mentorId
      };
      const { error } = await updateProfile({
        metadata: updatedMetadata
      });
      if (!error) {
        const selected = mentors.find(m => m.id === mentorId);
        if (selected) {
          setAssignedMentor(selected);
        }
      }
    } catch (err) {
      console.error('Error assigning mentor:', err);
    } finally {
      setAssigning(false);
    }
  };

  const handleSaveProfile = async () => {
    const { error } = await updateProfile({ full_name: editName });
    if (!error) {
      setIsEditing(false);
    }
  };

  const getCourseThumbnail = (enrollment: Enrollment, courseMatch?: Course) => {
    if (enrollment.item_thumbnail && enrollment.item_thumbnail.trim() !== '') {
      return enrollment.item_thumbnail;
    }
    if (courseMatch?.thumbnail_url && courseMatch.thumbnail_url.trim() !== '') {
      return courseMatch.thumbnail_url;
    }
    return DEFAULT_COURSE_THUMBNAIL;
  };

  const completedCount = enrollments.filter(e => Number(e.progress) >= 100).length;
  const inProgressEnrollments = enrollments.filter(e => Number(e.progress) < 100);
  const activeCourse = inProgressEnrollments[0] || enrollments[0];
  const activeCourseMatch = activeCourse ? courses.find(c => c.id === activeCourse.item_id) : null;

  const streakDays = user?.metadata?.streak || 5;
  const xpPoints = user?.metadata?.xp || (enrollments.length * 250 + completedCount * 500 + 150);

  return (
    <div className="space-y-8 w-full animate-in fade-in duration-700 pb-24 font-sans relative">
      
      {/* ── Pull to Refresh Indicator ── */}
      {(pullOffset > 0 || refreshing) && (
        <div 
          className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full p-2.5 shadow-xl flex items-center justify-center pointer-events-none transition-transform duration-100"
          style={{ 
            transform: `translate(-50%, ${pullOffset}px) scale(${Math.min(1.2, pullOffset / 50)})`,
            opacity: Math.min(1, pullOffset / 40)
          }}
        >
          <div className={cn(
            "w-5 h-5 rounded-full border-2 border-emerald-500 border-t-transparent",
            refreshing && "animate-spin"
          )} />
        </div>
      )}

      {/* ── SINGLE UNIFIED GREEN DASHBOARD HEADER ── */}
      <div className="relative rounded-3xl overflow-hidden border border-emerald-500/30 bg-gradient-to-br from-[#062414] via-[#0d3820] to-[#14532d] p-6 sm:p-7 text-white shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-400/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          
          {/* Left: Slightly Bigger Avatar + Name + Handle + Tier Indicator */}
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <img 
                src={user?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.full_name || 'Student'}`} 
                alt={user?.full_name || 'Student'} 
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl border-2 sm:border-3 border-emerald-400/80 object-cover shadow-xl bg-slate-900"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=Student`;
                }}
              />
              <div className="absolute -bottom-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 bg-emerald-500 rounded-full border-2 border-[#062414] flex items-center justify-center shadow-md">
                <CheckCircle2 size={13} className="text-black stroke-[3]" />
              </div>
            </div>

            <div className="space-y-1.5">
              {/* 1. Name */}
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-white leading-tight">
                {user?.full_name || 'Student Learner'}
              </h1>

              {/* 2. Status then 3. Handle */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-black uppercase tracking-wider shadow-sm">
                  <Shield size={12} /> {(user?.role === 'mentor' || user?.role === 'tutor' || user?.metadata?.mentor_onboarded === true || user?.metadata?.mentor_application_status === 'approved') ? 'Verified Mentor' : 'Verified Mentee'}
                </span>
                <span className="text-xs sm:text-sm font-bold text-emerald-200/90">
                  {user?.username ? (user.username.startsWith('@') ? user.username : `@${user.username}`) : user?.email ? `@${user.email.split('@')[0]}` : '@dalestic12'}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Study Streak & Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-black/40 border border-emerald-500/30 text-xs text-white backdrop-blur-md font-bold">
              <Flame size={14} className="text-amber-400 fill-amber-400" />
              <span>{streakDays} Day Streak</span>
            </div>

            {(user?.role === 'mentor' || user?.role === 'tutor' || user?.metadata?.mentor_onboarded === true || user?.metadata?.mentor_application_status === 'approved') && (
              <Button
                onClick={() => setActiveRole('mentor')} 
                className="bg-amber-500 hover:bg-amber-400 text-black font-black text-xs px-4 sm:px-5 h-10 rounded-2xl shadow-lg shadow-amber-500/25 hover:scale-[1.02] transition-all flex items-center gap-1.5 cursor-pointer border-none"
              >
                <Shield size={14} /> Mentor Portal
              </Button>
            )}

            <Button
              onClick={() => navigate('/profile/edit')} 
              className="bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs px-4 sm:px-5 h-10 rounded-2xl shadow-lg shadow-emerald-500/25 hover:scale-[1.02] transition-all flex items-center gap-1.5 cursor-pointer border-none"
            >
              <Edit3 size={14} /> Edit Profile
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('/courses')} 
              className="border-emerald-500/40 text-emerald-100 hover:bg-emerald-800/40 text-xs font-bold h-10 px-4 rounded-2xl cursor-pointer flex items-center gap-1.5"
            >
              <Compass size={14} /> Explore Catalog
            </Button>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
           2. STATS OVERVIEW CARDS (4 METRICS)
           ═══════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Stat 1: Active Courses */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Enrolled Courses</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <BookOpen size={18} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 dark:text-white">{enrollments.length}</span>
            <span className="text-xs font-bold text-emerald-500">{inProgressEnrollments.length} Active</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Curriculums in progress</p>
        </div>

        {/* Stat 2: Study Streak */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Daily Streak</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-500 flex items-center justify-center">
              <Flame size={18} className="fill-amber-500" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 dark:text-white">{streakDays}</span>
            <span className="text-xs font-bold text-amber-500">Days Active</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Keep the momentum going!</p>
        </div>

        {/* Stat 3: XP Points */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">XP Points</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-500 flex items-center justify-center">
              <Award size={18} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-indigo-600 dark:text-indigo-400">{xpPoints.toLocaleString()}</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Level 2 Rank • Top 15%</p>
        </div>

        {/* Stat 4: Certificates */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Certificates</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 dark:text-white">{completedCount}</span>
            <span className="text-xs font-bold text-slate-400">Graduated</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Verifiable digital credentials</p>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
           3. CONTINUE LEARNING HERO + ACTIVE COURSES GRID
           ═══════════════════════════════════════════════════════════════════ */}
      <div className="space-y-6">
        
        {/* Section Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <PlayCircle className="text-emerald-500" size={20} />
              Continue Learning
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Pick up right where you left off in your enrolled courses
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/courses')}
            className="text-xs font-bold rounded-xl border-slate-300 dark:border-slate-700 flex items-center gap-1.5"
          >
            <span>All Courses</span>
            <ArrowRight size={13} />
          </Button>
        </div>

        {/* Featured Active Course Banner (If Enrolled) */}
        {activeCourse && (
          <div 
            onClick={() => navigate(`/learning?courseId=${activeCourse.item_id}`)}
            className="p-6 sm:p-7 rounded-3xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 cursor-pointer group hover:border-emerald-400 shadow-sm transition-all"
          >
            <div className="flex items-center gap-5 flex-1 min-w-0">
              <div className="relative w-28 h-20 sm:w-36 sm:h-24 rounded-2xl overflow-hidden shrink-0 bg-slate-950 border border-emerald-500/30 shadow-md">
                <img 
                  src={getCourseThumbnail(activeCourse, activeCourseMatch || undefined)} 
                  alt={activeCourse.item_title || 'Active Course'}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                  <div className="w-10 h-10 rounded-full bg-emerald-500 text-black flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <PlayCircle size={20} className="fill-black" />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 flex-1 min-w-0">
                <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25">
                  Currently Studying • {activeCourseMatch?.category || 'Technology'}
                </span>
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors truncate">
                  {activeCourseMatch?.title || activeCourse.item_title || 'Enrolled Course'}
                </h3>
                
                {/* Progress Bar */}
                <div className="space-y-1 max-w-md">
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-semibold">{activeCourse.progress}% Completed</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">Resume Lesson</span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${activeCourse.progress}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <Button
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/learning?courseId=${activeCourse.item_id}`);
              }}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs px-6 h-11 rounded-2xl shadow-lg shadow-emerald-600/25 shrink-0 cursor-pointer"
            >
              Resume Learning →
            </Button>
          </div>
        )}

        {/* All Enrolled Courses List / Grid */}
        {enrollments.length === 0 ? (
          <div className="p-10 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-4 shadow-sm">
            <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400">
              <BookOpen size={26} />
            </div>
            <div className="space-y-1 max-w-md mx-auto">
              <h3 className="font-black text-slate-900 dark:text-white text-base">No active course enrollments yet</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Start your journey by enrolling in accredited courses, masterclasses, and hands-on developer blueprints.
              </p>
            </div>
            <Button
              onClick={() => navigate('/courses')}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs px-6 h-11 rounded-2xl shadow-md cursor-pointer"
            >
              Browse Course Catalog →
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {enrollments.map((enr) => {
              const match = courses.find(c => c.id === enr.item_id);
              const thumb = getCourseThumbnail(enr, match);
              const title = match?.title || enr.item_title || 'Enrolled Course';

              return (
                <div 
                  key={enr.id}
                  onClick={() => navigate(`/learning?courseId=${enr.item_id}`)}
                  className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-emerald-500/40 transition-all flex flex-col justify-between cursor-pointer group space-y-4"
                >
                  <div className="space-y-3">
                    <div className="relative w-full h-40 rounded-2xl overflow-hidden bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <img 
                        src={thumb} 
                        alt={title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).src = DEFAULT_COURSE_THUMBNAIL; }}
                      />
                      <div className="absolute top-3 left-3 px-2.5 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-[10px] font-black uppercase text-emerald-300 border border-white/10">
                        {match?.category || 'Program'}
                      </div>
                      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <div className="w-10 h-10 rounded-full bg-emerald-500 text-black flex items-center justify-center shadow-lg">
                          <PlayCircle size={20} className="fill-black" />
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-emerald-500 transition-colors line-clamp-1">
                        {title}
                      </h4>
                      <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                        <Clock size={12} /> {match?.duration || 'Self-paced'}
                      </p>
                    </div>
                  </div>

                  {/* Progress Line */}
                  <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-500">{enr.progress}% Complete</span>
                      {Number(enr.progress) >= 100 ? (
                        <span className="text-emerald-500 font-bold flex items-center gap-1"><CheckCircle2 size={13} /> Completed</span>
                      ) : (
                        <span className="text-slate-400 font-bold">In Progress</span>
                      )}
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-emerald-500 h-full rounded-full"
                        style={{ width: `${enr.progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
           4. TWO-COLUMN: ACTIVE MENTORSHIP & LIVE CLASSROOMS
           ═══════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left (2 Cols): Dedicated Mentorship Hub */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Users className="text-emerald-500" size={20} />
            My Mentorship Circle
          </h2>

          {assignedMentor ? (
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-5 text-left group">
              <div className="relative shrink-0">
                <img 
                  src={assignedMentor.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${assignedMentor.full_name}`} 
                  alt={assignedMentor.full_name}
                  className="w-20 h-20 rounded-2xl object-cover border-2 border-emerald-500/40 shadow-md"
                />
                <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900 flex items-center justify-center">
                  <Check size={11} className="text-black stroke-[3]" />
                </span>
              </div>

              <div className="flex-1 space-y-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                  Assigned Industry Mentor
                </span>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  {assignedMentor.full_name}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                  {assignedMentor.bio || 'Senior instructor and technical mentor guiding your career path.'}
                </p>

                <div className="flex items-center gap-2.5 pt-2 flex-wrap">
                  <Button
                    size="sm"
                    onClick={() => navigate('/mentorship')}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 h-9 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md"
                  >
                    <Video size={13} /> Live Session
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate('/messages')}
                    className="border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold px-4 h-9 rounded-xl flex items-center gap-1.5 cursor-pointer"
                  >
                    <MessageSquare size={13} /> Direct Chat
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider">
                  Connect with a Mentor
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Select a certified industry expert to review your code and guide your weekly milestones.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {mentors.slice(0, 4).map((m: any) => (
                  <div key={m.id} className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <img src={m.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${m.full_name}`} alt={m.full_name} className="w-10 h-10 rounded-xl object-cover" />
                      <div className="min-w-0">
                        <h4 className="font-bold text-xs text-slate-900 dark:text-white truncate">{m.full_name}</h4>
                        <p className="text-[10px] text-emerald-500 font-semibold">{m.country || 'Verified Expert'}</p>
                      </div>
                    </div>
                    <Button 
                      size="sm"
                      onClick={() => handleSelectMentor(m.id)}
                      className="bg-emerald-600 text-white text-[10px] font-black h-8 px-2.5 rounded-lg shrink-0 cursor-pointer"
                    >
                      Connect
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right (1 Col): Live Studio & Quick Shortcuts */}
        <div className="space-y-4">
          <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Radio className="text-emerald-500" size={20} />
            Live Classroom
          </h2>

          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <Radio size={20} />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Live Workshop Studio</h3>
                <p className="text-[11px] text-slate-400">Join interactive broadcast rooms</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Participate in live instructor coding sessions, Q&A office hours, and group project workshops.
            </p>

            <Button
              onClick={() => navigate('/live')}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-10 rounded-2xl shadow-md cursor-pointer flex items-center justify-center gap-2"
            >
              <Radio size={14} /> Enter Live Studio
            </Button>
          </div>
        </div>

      </div>

      {/* ═══════════════════════════════════════════════════════════════════
           4b. OUTSTANDING WORK — merges your own tasks with assignments due
           ═══════════════════════════════════════════════════════════════════ */}
      <div className="pt-4">
        <TodoWidget />
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
           5. PUBLIC LIBRARY HIGHLIGHTS & RECOMMENDED READING
           ═══════════════════════════════════════════════════════════════════ */}
      <div className="pt-4">
        <LibraryHighlights />
      </div>

    </div>
  );
};

export default StudentDashboard;
