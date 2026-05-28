import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button } from '../../components/ui';
import { useAuthStore } from '../../store/authStore';
import { Toast } from '../../components/ui/Toast';
import { courseService } from '../../lib/services/courses';
import type { Course } from '../../lib/database.types';
import { 
  Shield, 
  MapPin, 
  Globe, 
  Linkedin, 
  Mail, 
  GraduationCap, 
  Briefcase, 
  BookOpen, 
  Plus, 
  Radio, 
  Clock, 
  ChevronRight, 
  ArrowRight,
  ExternalLink,
  Edit3
} from 'lucide-react';
import { cn } from '../../utils';

const MentorProfile = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'info'} | null>(null);
  const [showOverview, setShowOverview] = useState(false);

  // Fetch actual mentor courses
  useEffect(() => {
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
    }
  }, [user]);

  const showFeedback = (msg: string, type: 'success' | 'info' = 'success') => {
    setToast({ message: msg, type });
  };

  // Onboarding Data Extraction
  const mentorData = user?.metadata?.mentor_data || {};
  const identity = mentorData.identity || {};
  const qualifications = mentorData.qualifications || {};
  const socials = identity.socials || {};

  const fullName = identity.public_name || user?.full_name || 'Dr. Emily Doe';
  const bio = qualifications.motivation || user?.bio || 'Senior Mentor & Architect. Guiding the next generation of engineers through high-impact, real-world curriculum.';
  const country = identity.address?.country || 'Remote / Global';
  const linkedin = socials.linkedin || 'https://linkedin.com';
  const website = socials.website || user?.website || 'trileza.app';
  const education = qualifications.highest_education || qualifications.education || 'Doctorate (Ph.D. / Ed.D.)';
  const yearsExp = qualifications.years_exp || '10+ Years';
  const skills = qualifications.skills || ['System Architecture', 'Agentic Coding', 'UI/UX Design', 'Team Leadership', 'Scale & Performance'];

  // Formatting helper for onboarding date
  const onboardedDateStr = user?.metadata?.mentor_onboarded_at 
    ? new Date(user.metadata.mentor_onboarded_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : 'May 2026';

  // Mock pending schedules (simplified)
  const pendingSchedules = [
    { title: 'Live Code Review: Agentic Loops', time: 'Today, 2:00 PM', type: 'Live Mentorship' },
    { title: 'Q&A Session: Architecture Patterns', time: 'Tomorrow, 10:00 AM', type: 'Community Call' },
    { title: '1-on-1: Alice Smith', time: 'Wed, 4:30 PM', type: 'Private Session' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f8fafc] via-[#f1f5f9] to-[#f8fafc] py-6 px-4 sm:px-6 lg:px-8 text-slate-800 font-sans">
      <div className="max-w-6xl mx-auto space-y-10 animate-in fade-in duration-500 pb-20">
        
        {/* ═══════════════════════════════════════════════════════════════════
            1. COVER HEADER & MAIN HERO (COMPREHENSIVE LAYOUT)
            ═══════════════════════════════════════════════════════════════════ */}
        <div className="bg-white rounded-[2.5rem] border border-slate-200/60 shadow-xl shadow-slate-200/40 p-8 md:p-12 relative overflow-hidden">
          {/* Subtle background element */}
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-slate-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 opacity-60" />
          
          <div className="relative z-10 flex flex-col lg:flex-row gap-10 lg:items-start">
            
            {/* Avatar Column */}
            <div className="shrink-0 flex flex-col items-center lg:items-start">
              <div className="relative">
                <div className="absolute -inset-1 rounded-3xl bg-slate-200 opacity-60 blur-sm" />
                <img 
                  src={user?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${fullName}`} 
                  alt={fullName} 
                  className="relative w-40 h-40 rounded-[2rem] border-[6px] border-white shadow-xl object-cover bg-slate-100"
                />
                <span className="absolute bottom-1 right-1 w-8 h-8 bg-emerald-500 rounded-xl border-4 border-white shadow-md flex items-center justify-center">
                  <span className="w-2.5 h-2.5 bg-white rounded-full animate-ping" />
                </span>
              </div>

              <div className="mt-8 flex flex-col w-full gap-3">
                <Button 
                  onClick={() => navigate('/settings')}
                  variant="outline"
                  className="w-full border-slate-200 text-slate-700 hover:bg-slate-50 font-bold rounded-xl h-12 bg-white shadow-sm flex justify-center items-center gap-2"
                >
                  <Edit3 size={18} /> Edit Profile
                </Button>
                <Button 
                  onClick={() => navigate('/messages')}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl h-12 shadow-sm flex justify-center items-center gap-2"
                >
                  <Mail size={18} /> Messages
                </Button>
              </div>
            </div>

            {/* Content Column */}
            <div className="flex-1 w-full flex flex-col h-full justify-between">
              
              {/* Header Info */}
              <div className="space-y-5 text-center lg:text-left mb-8">
                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3">
                  <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-black uppercase tracking-wider border border-emerald-200">
                    <Shield size={14} /> Verified Expert Mentor
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-100 text-slate-600 text-xs font-bold border border-slate-200">
                    <Clock size={14} /> Joined {onboardedDateStr}
                  </span>
                </div>

                <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight">
                  {fullName}
                </h1>

                <p className="text-slate-600 font-medium text-lg leading-relaxed max-w-3xl mx-auto lg:mx-0">
                  {bio}
                </p>

                {/* Social/Links Bar */}
                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-2">
                  <a href={linkedin} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-slate-500 hover:text-[#0a66c2] transition-colors text-sm font-bold">
                    <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center"><Linkedin size={16} /></div>
                    LinkedIn
                  </a>
                  <a href={website} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-slate-500 hover:text-emerald-600 transition-colors text-sm font-bold">
                    <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center"><Globe size={16} /></div>
                    Website
                  </a>
                  <div className="flex items-center gap-2 text-slate-500 text-sm font-bold">
                    <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center"><MapPin size={16} /></div>
                    {country}
                  </div>
                </div>
              </div>

              {/* Application Qualifications - Always visible grid */}
              <div className="pt-8 border-t border-slate-100 mt-auto">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-6 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500"></span>
                  Verified Application Qualifications
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                  {/* Education */}
                  <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 hover:border-emerald-200 transition-colors">
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-3">Highest Education</p>
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-white text-emerald-600 shadow-sm">
                        <GraduationCap size={20} />
                      </div>
                      <h4 className="font-extrabold text-slate-900 text-sm leading-snug">{education}</h4>
                    </div>
                  </div>

                  {/* Experience */}
                  <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 hover:border-emerald-200 transition-colors">
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-3">Teaching Experience</p>
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-white text-emerald-600 shadow-sm">
                        <Briefcase size={20} />
                      </div>
                      <h4 className="font-extrabold text-slate-900 text-sm leading-snug">{yearsExp} of Focus</h4>
                    </div>
                  </div>

                  {/* Focus Areas */}
                  <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 hover:border-emerald-200 transition-colors md:col-span-3 lg:col-span-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-3">Focus Areas</p>
                    <div className="flex flex-wrap gap-2">
                      {skills.slice(0, 3).map((skill: string) => (
                        <span key={skill} className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-bold">
                          {skill}
                        </span>
                      ))}
                      {skills.length > 3 && (
                        <span className="px-3 py-1.5 rounded-xl bg-slate-200 text-slate-700 text-xs font-bold">
                          +{skills.length - 3}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            2. WORKSPACE & DASHBOARD INTEGRATION (COURSES + SCHEDULES)
            ═══════════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* LEFT: Curriculum Atelier (2 columns) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="text-lg font-black text-slate-900 uppercase tracking-wider flex items-center gap-2.5">
                  <span className="w-2.5 h-6 bg-[#16a34a] rounded-sm block" />
                  Curriculum Atelier
                </h2>
                <p className="text-slate-600 text-sm font-bold mt-1 ml-5">Your official course curriculum</p>
              </div>
              <Button 
                onClick={() => navigate('/tutor/courses/new')}
                className="bg-[#16a34a] hover:bg-[#15803d] text-white font-bold rounded-xl px-4 h-10 border-none shadow-lg shadow-green-600/15 flex items-center gap-1.5 transition-all"
              >
                <Plus size={16} /> New Course
              </Button>
            </div>

            {loadingCourses ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="h-44 bg-slate-100 rounded-2xl animate-pulse" />
                <div className="h-44 bg-slate-100 rounded-2xl animate-pulse" />
              </div>
            ) : courses.length === 0 ? (
              <div className="p-12 text-center rounded-[2rem] border-2 border-dashed border-[#bbf7d0] bg-gradient-to-br from-[#f0fdf4] to-white flex flex-col items-center">
                <div className="w-12 h-12 bg-[#dcfce7] rounded-xl flex items-center justify-center text-[#16a34a] mb-4">
                  <BookOpen size={24} />
                </div>
                <h3 className="text-lg font-black text-slate-900">No active courses yet</h3>
                <p className="text-slate-600 text-sm font-bold max-w-xs mt-1.5 leading-relaxed">
                  Start your journey as an educator by developing your first high-impact course.
                </p>
                <Button 
                  onClick={() => navigate('/tutor/courses/new')}
                  className="mt-5 bg-[#16a34a] hover:bg-[#15803d] text-white font-bold rounded-xl h-10 px-6 border-none"
                >
                  Create First Course
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {courses.map((course) => (
                  <div 
                    key={course.id}
                    onClick={() => navigate(`/tutor/courses/${course.id}`)}
                    className="group overflow-hidden rounded-2xl border border-slate-200/70 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer bg-white"
                  >
                    <div className="relative aspect-video bg-slate-50 overflow-hidden">
                      {course.thumbnail_url ? (
                        <img 
                          src={course.thumbnail_url} 
                          alt={course.title} 
                          className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500" 
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#166534] to-[#052e16]">
                          <BookOpen size={36} className="text-white/10" />
                        </div>
                      )}
                      <div className="absolute top-2 right-2">
                        <span className={cn(
                          "px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider text-white shadow-sm",
                          course.status === 'published' ? 'bg-[#16a34a]' : 'bg-amber-500'
                        )}>
                          {course.status}
                        </span>
                      </div>
                    </div>
                    <div className="p-4 space-y-1">
                      <h3 className="font-extrabold text-slate-900 text-base line-clamp-1 group-hover:text-[#16a34a] transition-colors leading-snug">
                        {course.title}
                      </h3>
                      <p className="text-slate-600 text-xs font-bold flex items-center gap-1.5">
                        <span>{course.enrolled_count || 0} Learners enrolled</span>
                        <span className="w-1 h-1 bg-slate-300 rounded-full" />
                        <span className="capitalize">{(course as any).level || 'All Levels'}</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT: Teaching Schedule (1 column) */}
          <div className="space-y-6">
            <div className="mb-2">
              <h2 className="text-lg font-black text-slate-900 uppercase tracking-wider flex items-center gap-2.5">
                <span className="w-2.5 h-6 bg-[#16a34a] rounded-sm block" />
                Teaching Schedule
              </h2>
              <p className="text-slate-600 text-sm font-bold mt-1 ml-5">Upcoming live mentorship slots</p>
            </div>

            <div className="space-y-3">
              {pendingSchedules.map((schedule, index) => (
                <div 
                  key={index} 
                  onClick={() => navigate('/live')}
                  className="p-4 rounded-2xl border border-slate-200/70 hover:border-[#16a34a] bg-white transition-all cursor-pointer group flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200/80 text-slate-500 flex items-center justify-center shrink-0 group-hover:bg-[#f0fdf4] group-hover:text-[#16a34a] transition-all">
                      <Clock size={18} />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-sm leading-snug group-hover:text-[#16a34a] transition-colors">
                        {schedule.title}
                      </h4>
                      <p className="text-xs text-slate-600 font-extrabold mt-0.5">
                        {schedule.time} • <span className="text-[#16a34a] font-black">{schedule.type}</span>
                      </p>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-slate-400 group-hover:text-[#16a34a] transition-colors shrink-0" />
                </div>
              ))}

              <div className="pt-2">
                <Button 
                  onClick={() => navigate('/live')}
                  variant="outline"
                  className="w-full border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl h-10 flex items-center justify-center gap-1 bg-white text-xs uppercase tracking-wider"
                >
                  Enter Studio Stage <ArrowRight size={14} />
                </Button>
              </div>
            </div>
          </div>

        </div>

      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default MentorProfile;
