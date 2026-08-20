import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button } from '../../components/ui';
import { 
  BookOpen, 
  PlayCircle, 
  Clock, 
  Users, 
  Shield,
  ShieldAlert,
  Edit2,
  CheckCircle,
  TrendingUp,
  Video,
  Award,
  GraduationCap,
  Edit3,
  Sparkles,
  MessageSquare
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { courseService } from '../../lib/services/courses';
import { enrollmentService } from '../../lib/services/enrollments';
import { cn } from '../../utils';
import type { Course, Enrollment } from '../../lib/database.types';
import LibraryHighlights from '../../components/shared/LibraryHighlights';
import { nexus } from '../../lib/nexus';
import { usePullToRefresh } from '../../utils/usePullToRefresh';

const DEFAULT_COURSE_THUMBNAIL = 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=80';

const StudentDashboard = () => {
  const { user, updateProfile } = useAuthStore();
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

  const fetchMentorData = async () => {
    try {
      const { data: mentorsList, error } = await nexus.database
        .from('profiles')
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
            .from('profiles')
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

  return (
    <div className="space-y-8 w-full animate-in fade-in duration-700 pb-24 font-sans relative">
      {/* Pull to Refresh Indicator */}
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

      {/* Mentor Application Status Notices */}
      {user?.metadata?.mentor_application_status === 'pending' && (
        <div className="bg-amber-500/10 border border-amber-500/20 p-4 sm:p-5 rounded-2xl flex items-start gap-4 text-left shadow-lg shadow-amber-500/5 animate-pulse">
          <ShieldAlert className="text-amber-500 shrink-0 mt-0.5" size={22} />
          <div>
            <h3 className="text-xs font-black text-amber-500 tracking-wider uppercase">Mentor Application Under Review</h3>
            <p className="text-xs text-amber-900/80 dark:text-amber-200 mt-1 leading-relaxed font-medium">
              Thank you for applying to be a mentor! Your application has been submitted successfully and is currently under review by our administration team. 
              We will notify you as soon as your account has been approved and onboarded.
            </p>
          </div>
        </div>
      )}

      {user?.metadata?.mentor_application_status === 'needs_info' && (
        <div className="bg-amber-500/10 border border-amber-500/20 p-4 sm:p-5 rounded-2xl flex items-start gap-4 text-left shadow-lg shadow-amber-500/5">
          <ShieldAlert className="text-amber-500 shrink-0 mt-0.5" size={22} />
          <div className="flex-1">
            <h3 className="text-xs font-black text-amber-500 tracking-wider uppercase">Revision Required: Mentor Application Needs Information</h3>
            <p className="text-xs text-amber-900/80 dark:text-amber-200 mt-1 leading-relaxed font-medium">
              The administration team has requested additional details to complete your verification audit.
            </p>
            {user.metadata.rejection_reason && (
              <p className="text-xs bg-amber-500/5 border border-amber-500/10 p-3 rounded-xl mt-2 italic text-slate-700 dark:text-amber-100 font-medium">
                Feedback: "{user.metadata.rejection_reason}"
              </p>
            )}
            <Button
              onClick={() => navigate('/mentor/onboarding')}
              className="mt-3 bg-amber-500 hover:bg-amber-600 text-white font-bold text-[10px] uppercase tracking-wider px-4 py-2 rounded-xl border-none shadow-sm cursor-pointer"
            >
              Edit & Resubmit Application
            </Button>
          </div>
        </div>
      )}

      {(user?.metadata?.mentor_application_status === 'rejected' || user?.metadata?.mentor_application_status === 'denied') && (
        <div className="bg-rose-500/10 border border-rose-500/20 p-4 sm:p-5 rounded-2xl flex items-start gap-4 text-left shadow-lg shadow-rose-500/5">
          <ShieldAlert className="text-rose-500 shrink-0 mt-0.5" size={22} />
          <div className="flex-1">
            <h3 className="text-xs font-black text-rose-500 tracking-wider uppercase">Mentor Application Declined</h3>
            <p className="text-xs text-rose-900/80 dark:text-rose-250 mt-1 leading-relaxed font-medium">
              Unfortunately, your application to join the mentorship registry has been declined at this time.
            </p>
            {user.metadata.rejection_reason && (
              <p className="text-xs bg-rose-500/5 border border-rose-500/10 p-3 rounded-xl mt-2 italic text-slate-750 dark:text-rose-100 font-medium">
                Reason: "{user.metadata.rejection_reason}"
              </p>
            )}
            <Button
              onClick={() => navigate('/mentor/onboarding')}
              className="mt-3 bg-rose-500 hover:bg-rose-600 text-white font-bold text-[10px] uppercase tracking-wider px-4 py-2 rounded-xl border-none shadow-sm cursor-pointer"
            >
              Re-apply as Mentor
            </Button>
          </div>
        </div>
      )}
      
      {/* ═══════════════════════════════════════════════════════════════════
           HERO PROFILE CARD — Mentee Header (Matching Mentor Header Proportions)
           ═══════════════════════════════════════════════════════════════════ */}
      <div className="rounded-3xl overflow-hidden border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl shadow-slate-200/50 dark:shadow-none">
        
        {/* ── COVER BANNER (Matching Mentor Height: h-28 sm:h-36 md:h-44) ── */}
        <div className="relative h-28 sm:h-36 md:h-44 overflow-hidden" style={{
          background: 'linear-gradient(135deg, #011620 0%, #012735 25%, #022635 50%, #033c52 75%, #044b66 100%)'
        }}>
          {/* Subtle mesh pattern */}
          <svg className="absolute inset-0 w-full h-full opacity-[0.07]" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid-student" width="60" height="60" patternUnits="userSpaceOnUse">
                <circle cx="30" cy="30" r="1.5" fill="white" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid-student)" />
          </svg>
          {/* Floating glowing orbs */}
          <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-[#22c55e]/15 blur-3xl" />
          <div className="absolute -bottom-32 -left-20 w-80 h-80 rounded-full bg-[#4ade80]/10 blur-3xl" />
          
          {/* Top platform bar */}
          <div className="hidden md:flex absolute top-0 left-0 right-0 px-6 py-3 items-center justify-between">
            <div className="flex items-center gap-2 text-white/70">
              <div className="w-7 h-7 rounded-lg bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/10">
                <Sparkles size={13} className="text-[#4ade80]" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">Trileza Learning Platform</span>
            </div>
          </div>

          {/* Banner title — offset cleanly matching mentor profile layout */}
          <div className="absolute bottom-3 left-24 sm:bottom-5 sm:left-36 md:left-44 md:bottom-6">
            <h2 className="text-white text-lg sm:text-2xl md:text-3xl font-black tracking-tight drop-shadow-lg">
              Mentee Profile
            </h2>
          </div>
        </div>

        {/* ── PROFILE INFO BAR ── */}
        <div className="relative bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 pt-2 pb-5 px-4 sm:px-6">
          {/* Avatar overlapping banner (Matching Mentor Proportions) */}
          <div className="absolute -top-10 sm:-top-14 md:-top-16 left-4 sm:left-6 md:left-8 z-20">
            <div className="relative group">
              <div className="absolute -inset-1 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[#22c55e] to-[#16a34a] opacity-80" />
              <div className="relative w-18 h-18 sm:w-26 sm:h-26 md:w-32 md:h-32 rounded-2xl sm:rounded-3xl border-[4px] sm:border-[5px] border-white dark:border-slate-900 shadow-2xl overflow-hidden bg-slate-100 dark:bg-slate-800">
                <img 
                  src={user?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.full_name || 'Student'}`} 
                  alt={user?.full_name || 'Student'} 
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 sm:w-7 sm:h-7 bg-emerald-600 rounded-xl border-[3px] border-white dark:border-slate-900 flex items-center justify-center shadow-lg">
                <CheckCircle size={12} className="text-white" />
              </div>
            </div>
          </div>

          {/* Info + Actions */}
          <div className="pt-3 sm:pt-4 md:pt-5 pb-2 px-2 sm:px-4 ml-0 md:ml-44">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mt-8 sm:mt-12 md:mt-0">
              {/* Name + Badges + Bio */}
              <div className="space-y-1.5 text-left">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider border border-emerald-200/60 dark:border-emerald-800/40">
                    <Shield size={11} /> Verified Mentee
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold uppercase tracking-wider border border-slate-200/60 dark:border-slate-700/60">
                    <GraduationCap size={11} className="text-emerald-500" /> Level {enrollments.length > 0 ? enrollments.length + 1 : 1}
                  </span>
                </div>
              
              {isEditing ? (
                <div className="flex items-center gap-2 pt-1">
                  <input 
                    type="text" 
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3 py-1 text-lg sm:text-xl font-black outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  />
                  <button onClick={handleSaveProfile} className="p-2 bg-emerald-600 text-white hover:bg-emerald-500 rounded-xl transition-all shadow-md cursor-pointer"><CheckCircle size={14}/></button>
                </div>
              ) : (
                <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                  {user?.full_name || user?.email?.split('@')[0] || 'Set your name'}
                  <button onClick={() => setIsEditing(true)} className="p-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors text-slate-400 cursor-pointer" title="Edit Display Name">
                    <Edit2 size={12} />
                  </button>
                </h1>
              )}

              {user?.bio ? (
                <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm font-medium max-w-xl line-clamp-2">
                  {user.bio}
                </p>
              ) : (
                <p className="text-slate-400 dark:text-slate-500 text-xs font-medium italic">
                  No bio description provided yet. Click edit profile to add one.
                </p>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 shrink-0 flex-wrap pt-1 md:pt-0">
              <Button
                onClick={() => navigate('/profile/edit')} 
                variant="outline"
                className="border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-full px-4 h-9 font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer"
              >
                <Edit3 size={13} /> Edit Profile
              </Button>
              
              {!user?.metadata?.mentor_onboarded && !user?.metadata?.mentor_application_status && (
                <Button 
                  onClick={() => navigate('/mentor/onboarding')}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white border-none rounded-full px-4 h-9 font-bold text-xs shadow-md shadow-emerald-600/20 flex items-center gap-1.5 cursor-pointer"
                >
                  <Shield size={13} /> Apply as Mentor
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>

      {/* ── MENTEE ANALYTICS & OBJECTIVES CARDS (Standalone Sleek Row) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:border-emerald-500/40 transition-all group">
          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-2">Active Courses</p>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40 group-hover:scale-105 transition-transform">
              <BookOpen size={18} />
            </div>
            <h4 className="font-black text-slate-900 dark:text-white text-2xl">{enrollments.length}</h4>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:border-amber-500/40 transition-all group">
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 mb-2">Goal Streak</p>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/40 group-hover:scale-105 transition-transform">
              <TrendingUp size={18} />
            </div>
            <h4 className="font-black text-slate-900 dark:text-white text-2xl">{user?.metadata?.streak || 0} Days</h4>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:border-indigo-500/40 transition-all group">
          <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-2">XP Points</p>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40 group-hover:scale-105 transition-transform">
              <Award size={18} />
            </div>
            <h4 className="font-black text-slate-900 dark:text-white text-2xl">{user?.metadata?.xp || 0}</h4>
          </div>
        </div>
      </div>

      {/* ── 2. VITAL COURSE PROGRESS (With Visible Course Thumbnails) ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Clock className="text-emerald-500" size={16} /> Vital Course Progress
          </h2>
          {enrollments.length > 0 && (
            <Button 
              variant="ghost" 
              className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white font-black text-xs uppercase tracking-widest cursor-pointer"
              onClick={() => navigate(`/learning?courseId=${enrollments[0].item_id}`)}
            >
              Open Player
            </Button>
          )}
        </div>

        <div className="space-y-3">
          {enrollments.length > 0 ? (
            enrollments.map((enrollment) => {
              const courseMatch = courses.find(c => c.id === enrollment.item_id);
              const thumbnail = getCourseThumbnail(enrollment, courseMatch);
              const title = courseMatch?.title || enrollment.item_title || `Course ${enrollment.item_id?.slice(0, 8) ?? ''}`;
              
              return (
                <Card 
                  key={enrollment.id} 
                  className="p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md bg-white dark:bg-slate-900 rounded-2xl hover:border-emerald-500/40 transition-all group cursor-pointer text-left"
                  onClick={() => navigate(`/learning?courseId=${enrollment.item_id}`)}
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1 min-w-0 w-full sm:w-auto">
                      {/* Visible Course Thumbnail Image */}
                      <div className="relative w-24 h-16 sm:w-32 sm:h-20 rounded-xl overflow-hidden shrink-0 bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
                        <img 
                          src={thumbnail} 
                          alt={title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = DEFAULT_COURSE_THUMBNAIL;
                          }}
                        />
                        <div className="absolute inset-0 bg-slate-950/20 group-hover:bg-slate-950/40 transition-colors flex items-center justify-center">
                          <div className="w-8 h-8 rounded-full bg-emerald-600/90 text-white flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                            <PlayCircle size={16} />
                          </div>
                        </div>
                      </div>

                      {/* Course Metadata */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-[10px] font-black uppercase tracking-wider border border-emerald-100 dark:border-emerald-900/40">
                            {courseMatch?.category || 'Enrolled Course'}
                          </span>
                          {courseMatch?.level && (
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                              {courseMatch.level}
                            </span>
                          )}
                        </div>
                        <h4 className="font-extrabold text-slate-900 dark:text-white text-sm sm:text-base group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors truncate">
                          {title}
                        </h4>
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
                          <span>Progress: <strong className="text-emerald-600 dark:text-emerald-400 font-extrabold">{enrollment.progress}%</strong></span>
                          {enrollment.completed_lessons && enrollment.completed_lessons.length > 0 && (
                            <>
                              <span>•</span>
                              <span>{enrollment.completed_lessons.length} lessons completed</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action Button */}
                    <Button 
                      size="sm" 
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/learning?courseId=${enrollment.item_id}`);
                      }}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-xs uppercase tracking-wider px-4 py-2 border-none shadow-md shadow-emerald-600/20 hover:scale-[1.02] transition-all cursor-pointer shrink-0 self-stretch sm:self-auto flex items-center justify-center gap-1.5"
                    >
                      <PlayCircle size={14} /> Resume Learning
                    </Button>
                  </div>
                  
                  {/* Progress Line */}
                  <div className="mt-3 w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden border border-slate-200/50 dark:border-slate-700/50">
                    <div 
                      className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-1000 shadow-sm" 
                      style={{ width: `${enrollment.progress}%` }} 
                    />
                  </div>
                </Card>
              );
            })
          ) : (
            <div className="p-8 text-center bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl space-y-4 shadow-sm relative overflow-hidden group">
              <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40">
                <BookOpen size={22} />
              </div>
              <div className="space-y-1 max-w-sm mx-auto">
                <p className="font-black text-slate-900 dark:text-white text-base uppercase tracking-tight">No Active Enrollments</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">Explore our course catalog to start learning and tracking your career objectives.</p>
              </div>
              <Button 
                onClick={() => navigate('/library')} 
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl border-none shadow-md shadow-emerald-600/20 font-black text-xs uppercase tracking-wider px-5 py-2.5 hover:scale-[1.02] transition-all cursor-pointer"
              >
                Explore Course Catalog
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* ── 3. ACTIVE MENTORSHIP ── */}
      <div className="space-y-4">
        <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
          <Users className="text-emerald-500" size={16} /> Active Mentorship
        </h2>
        
        {assignedMentor ? (
          <Card className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm p-6 rounded-3xl flex flex-col sm:flex-row items-center gap-6 text-left transition-all hover:border-emerald-500/40 relative overflow-hidden group">
            <div className="relative shrink-0">
              <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 opacity-30 group-hover:opacity-60 blur-sm transition-all" />
              <img 
                src={assignedMentor.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${assignedMentor.full_name}`} 
                className="relative w-20 h-20 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 shadow-inner object-cover" 
                alt="Mentor" 
              />
            </div>
            
            <div className="flex-1 text-center sm:text-left z-10 space-y-1">
              <h3 className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest flex items-center justify-center sm:justify-start gap-1.5">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" /> Your Assigned Mentor
              </h3>
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">{assignedMentor.full_name}</h2>
              <p className="text-slate-500 dark:text-slate-400 font-medium text-xs leading-relaxed max-w-xl line-clamp-2">
                {assignedMentor.bio || 'Verified Professional Mentor'}
              </p>
              
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-2">
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl border-none shadow-md text-xs uppercase tracking-wider py-2 px-4 hover:scale-[1.02] transition-all cursor-pointer flex items-center gap-1.5" onClick={() => navigate('/mentorship')}>
                  <Video size={13} /> Join Session
                </Button>
                <Button size="sm" variant="outline" className="border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl font-bold bg-white dark:bg-slate-900 text-xs uppercase tracking-wider py-2 px-4 cursor-pointer flex items-center gap-1.5" onClick={() => navigate('/messages')}>
                  <MessageSquare size={13} /> Message
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 rounded-3xl space-y-4">
            <div className="text-left space-y-1">
              <h3 className="font-black text-slate-900 dark:text-white text-base uppercase tracking-tight">Select an Elite Mentor</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium max-w-xl">Choose your dedicated industry advisor to guide your coursework, code reviews, and career strategy.</p>
            </div>

            {mentors.length === 0 ? (
              <p className="text-xs text-slate-400 font-bold italic">No certified mentors are currently online. Please check back shortly.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {mentors.map((m: any) => (
                  <div key={m.id} className="p-4 border border-slate-200/80 dark:border-slate-800 rounded-2xl flex items-start gap-3 hover:border-emerald-500/40 transition-all bg-slate-50/50 dark:bg-slate-800/40">
                    <img 
                      src={m.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${m.full_name}`} 
                      className="w-12 h-12 rounded-xl border border-slate-200 dark:border-slate-700 object-cover bg-white dark:bg-slate-800 shrink-0" 
                      alt={m.full_name} 
                    />
                    <div className="flex-1 min-w-0 text-left">
                      <h4 className="font-extrabold text-slate-900 dark:text-white text-sm truncate">{m.full_name}</h4>
                      <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-black uppercase tracking-wider mt-0.5">{m.country || 'Global / Remote'}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">{m.bio || 'Verified Professional Mentor'}</p>
                      <Button 
                        size="sm" 
                        disabled={assigning}
                        onClick={() => handleSelectMentor(m.id)}
                        className="mt-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-lg text-[10px] uppercase tracking-wider py-1.5 px-3 border-none cursor-pointer"
                      >
                        Select Mentor
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 4. LIBRARY HIGHLIGHTS & RECOMMENDED LEARNING ── */}
      <div className="pt-2">
        <LibraryHighlights />
      </div>

    </div>
  );
};

export default StudentDashboard;
