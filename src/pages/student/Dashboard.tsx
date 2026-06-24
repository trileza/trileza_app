import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button } from '../../components/ui';
import { 
  BookOpen, 
  PlayCircle, 
  Clock, 
  Users, 
  Shield,
  Edit2,
  Camera,
  CheckCircle,
  TrendingUp,
  Video,
  PlusCircle,
  Award,
  Globe,
  Linkedin,
  MapPin,
  Mail,
  GraduationCap,
  Briefcase,
  Edit3
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { courseService } from '../../lib/services/courses';
import { enrollmentService } from '../../lib/services/enrollments';
import { cn } from '../../utils';
import type { Course, Enrollment } from '../../lib/database.types';
import LibraryHighlights from '../../components/shared/LibraryHighlights';
import { LoadingOverlay } from '../../components/shared';

const StudentDashboard = () => {
  const { user, updateProfile } = useAuthStore();
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(user?.full_name || '');

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      const [coursesData, enrollmentsData] = await Promise.all([
        courseService.getAllCourses(),
        enrollmentService.getUserEnrollments(user!.id)
      ]);
      setCourses(coursesData.slice(0, 3));
      setEnrollments(enrollmentsData);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    const { error } = await updateProfile({ full_name: editName });
    if (!error) {
      setIsEditing(false);
    }
  };

  if (loading) {
    return <LoadingOverlay message="Synchronizing Dashboard" submessage="Retrieving your learning progress..." />;
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-12 max-w-7xl mx-auto animate-in fade-in duration-700 font-sans">
      
      {/* ── 1. COVER HEADER & MAIN HERO (COMPREHENSIVE LAYOUT) ── */}
      <div className="bg-slate-950 text-white rounded-[2.5rem] border border-slate-800/80 shadow-2xl p-8 md:p-12 relative overflow-hidden">
        {/* Glowing Neon Ambient Blobs inside the dark card */}
        <div className="absolute top-[-30%] right-[-10%] w-[450px] h-[450px] bg-emerald-500/10 rounded-full blur-[110px] pointer-events-none" />
        <div className="absolute bottom-[-30%] left-[-10%] w-[350px] h-[350px] bg-teal-500/10 rounded-full blur-[90px] pointer-events-none" />
        
        {/* Subtle grid pattern for developer console aesthetic */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
        
        <div className="relative z-10 flex flex-col lg:flex-row gap-10 lg:items-start">
          
          {/* Avatar Column */}
          <div className="shrink-0 flex flex-col items-center lg:items-start">
            <div className="relative group">
              {/* Glowing neon green ring behind avatar */}
              <div className="absolute -inset-1.5 rounded-[2.2rem] bg-gradient-to-tr from-emerald-500 to-teal-400 opacity-60 blur-md group-hover:opacity-85 transition-opacity duration-300" />
              <img 
                src={user?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.full_name || 'Student'}`} 
                alt="Profile" 
                className="relative w-40 h-40 rounded-[2rem] border-[4px] border-slate-950 shadow-2xl object-cover bg-slate-900"
              />
            </div>

            <div className="mt-8 flex flex-col w-full gap-3">
              <Button 
                onClick={() => navigate('/settings')}
                variant="outline"
                className="w-full border-slate-800 text-slate-200 hover:bg-slate-900 font-bold rounded-xl h-12 bg-slate-950 shadow-sm flex justify-center items-center gap-2 hover:border-slate-700 transition-all text-xs uppercase tracking-wider"
              >
                <Edit3 size={16} /> Edit Profile
              </Button>

              {user?.metadata?.mentor_application_status === 'pending' ? (
                <Button 
                  variant="outline"
                  className="w-full border-orange-500/30 text-orange-400 font-bold rounded-xl h-12 bg-orange-950/20 shadow-sm flex justify-center items-center gap-2 cursor-default text-xs uppercase tracking-wider"
                >
                  <Clock size={16} /> App Pending
                </Button>
              ) : !user?.metadata?.mentor_onboarded ? (
                <Button 
                  onClick={() => navigate('/mentor/onboarding')}
                  className="w-full border-none text-white font-black rounded-xl h-12 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-lg shadow-emerald-500/20 flex justify-center items-center gap-2 hover:scale-[1.02] active:scale-95 transition-all text-xs uppercase tracking-wider"
                >
                  <Award size={16} /> Become a Mentor
                </Button>
              ) : null}
            </div>
          </div>

          {/* Content Column */}
          <div className="flex-1 w-full flex flex-col h-full justify-between">
            
            {/* Header Info */}
            <div className="space-y-5 text-center lg:text-left mb-8">
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3">
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-black uppercase tracking-wider border border-emerald-500/25">
                  <Shield size={14} /> Verified Academic Node
                </span>
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-900 text-slate-300 text-xs font-bold border border-slate-800">
                  <GraduationCap size={14} /> Level {enrollments.length > 0 ? enrollments.length + 1 : 1} Mentee
                </span>
              </div>

              {isEditing ? (
                <div className="flex items-center justify-center lg:justify-start gap-2">
                  <input 
                    type="text" 
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="bg-slate-900 border-2 border-slate-750 text-white placeholder:text-slate-500 rounded-xl px-4 py-1.5 text-3xl font-black outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  />
                  <button onClick={handleSaveProfile} className="p-2 bg-emerald-500 text-slate-950 hover:bg-emerald-400 rounded-xl transition-all shadow-md"><CheckCircle size={16}/></button>
                </div>
              ) : (
                <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight flex items-center justify-center lg:justify-start gap-3">
                  {user?.full_name || 'Academic Scholar'}
                  <button onClick={() => setIsEditing(true)} className="p-1.5 bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors text-slate-400" title="Edit Display Name">
                    <Edit2 size={16} />
                  </button>
                </h1>
              )}

              <p className="text-slate-300 font-medium text-lg leading-relaxed max-w-3xl mx-auto lg:mx-0">
                {user?.bio || 'Passionate about engineering systems, agentic frameworks, and high-performance cognitive design.'}
              </p>
              
              <p className="text-slate-400 text-sm font-bold flex items-center justify-center lg:justify-start gap-2">
                Account ID: <span className="text-emerald-400 bg-slate-900/60 border border-slate-850 px-3 py-1 rounded-lg font-mono font-medium text-xs tracking-tight">{user?.email}</span>
              </p>
            </div>

            {/* Mentee Analytics & Objectives - Grid */}
            <div className="pt-8 border-t border-slate-850 mt-auto">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 animate-pulse"></span>
                Mentee Analytics & Objectives
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800/60 hover:border-emerald-500/30 transition-all hover:-translate-y-0.5 group">
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-3 group-hover:text-emerald-350 transition-colors">Active Courses</p>
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-slate-950 text-emerald-400 border border-slate-850 shadow-inner group-hover:scale-105 transition-transform">
                      <BookOpen size={20} />
                    </div>
                    <h4 className="font-extrabold text-white text-2xl leading-snug">{enrollments.length}</h4>
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800/60 hover:border-amber-500/30 transition-all hover:-translate-y-0.5 group">
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-400 mb-3 group-hover:text-amber-350 transition-colors">Goal Streak</p>
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-slate-950 text-amber-400 border border-slate-850 shadow-inner group-hover:scale-105 transition-transform">
                      <TrendingUp size={20} />
                    </div>
                    <h4 className="font-extrabold text-white text-2xl leading-snug">7 Days</h4>
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800/60 hover:border-indigo-500/30 transition-all hover:-translate-y-0.5 group">
                  <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-3 group-hover:text-indigo-350 transition-colors">XP Points</p>
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-slate-950 text-indigo-400 border border-slate-850 shadow-inner group-hover:scale-105 transition-transform">
                      <Award size={20} />
                    </div>
                    <h4 className="font-extrabold text-white text-2xl leading-snug">1,250</h4>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ── 2. VITAL INFO: COURSE PLAYER ── */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Clock className="text-emerald-500" size={18} strokeWidth={2.5} /> Vital Course Progress
            </h2>
            {enrollments.length > 0 && (
              <Button 
                variant="ghost" 
                className="text-slate-500 hover:text-slate-800 font-black text-xs uppercase tracking-widest"
                onClick={() => navigate('/learning')}
              >
                Open Player
              </Button>
            )}
          </div>

          <div className="space-y-4">
            {enrollments.length > 0 ? (
              enrollments.map((enrollment) => (
                <Card 
                  key={enrollment.id} 
                  className="p-6 border border-slate-200/60 shadow-sm hover:shadow-md bg-white rounded-[2rem] hover:border-emerald-400 transition-all group cursor-pointer text-left"
                  onClick={() => navigate('/learning')}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-all shadow-inner border border-emerald-100">
                        <PlayCircle size={22} />
                      </div>
                      <div>
                        <h4 className="font-black text-slate-900 text-base group-hover:text-emerald-600 transition-colors uppercase tracking-tight">
                          Module {(enrollment as any).current_module || 1} Syllabus Focus
                        </h4>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mt-0.5">
                          Progress: {enrollment.progress}% Complete
                        </p>
                      </div>
                    </div>
                    {/* Vibrant green Action Button */}
                    <Button 
                      size="sm" 
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs uppercase tracking-wider px-5 border-none shadow-md shadow-emerald-600/10 hover:scale-[1.02] transition-all"
                    >
                      Resume Learning
                    </Button>
                  </div>
                  
                  {/* Progress Indicator - Green Highlight Line */}
                  <div className="mt-5 w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200/50">
                    <div 
                      className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-1000 shadow-sm" 
                      style={{ width: `${enrollment.progress}%` }} 
                    />
                  </div>
                </Card>
              ))
            ) : (
              <div className="p-12 text-center bg-white border border-slate-200/60 rounded-[2.5rem] space-y-5 shadow-[0_15px_30px_rgba(0,0,0,0.02)] relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-50 rounded-full blur-3xl opacity-50 group-hover:opacity-85 transition-opacity" />
                <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto text-emerald-600 shadow-sm border border-emerald-100 group-hover:scale-105 transition-transform">
                  <BookOpen size={24} />
                </div>
                <div className="space-y-2 max-w-sm mx-auto">
                  <p className="font-black text-slate-900 text-lg uppercase tracking-tight">No Active Enrollments</p>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">Configure your digital career objectives and enroll in a course to begin tracking your analytics.</p>
                </div>
                <Button 
                  onClick={() => navigate('/library')} 
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl border-none shadow-lg shadow-emerald-500/15 font-black text-xs uppercase tracking-wider px-6 py-3.5 hover:scale-[1.02] active:scale-95 transition-all"
                >
                  Explore Course Catalog
                </Button>
              </div>
            )}
          </div>
      </div>

      {/* ── 3. SECONDARY SECTION: MENTOR ── */}
      <div className="space-y-6">
          <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Users className="text-emerald-500" size={18} strokeWidth={2.5} /> Active Mentorship
          </h2>
          
          <Card className="bg-white border border-slate-200/60 shadow-sm p-8 rounded-[2.5rem] flex flex-col sm:flex-row items-center gap-8 text-left transition-all duration-300 hover:border-emerald-400/40 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full blur-3xl opacity-30 group-hover:opacity-75 transition-opacity" />
            
            <div className="relative shrink-0">
              <div className="absolute -inset-1 rounded-[2.2rem] bg-gradient-to-tr from-emerald-500 to-teal-400 opacity-20 group-hover:opacity-60 blur-sm transition-all" />
              <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=DrDoe" className="relative w-24 h-24 rounded-[2rem] border border-slate-200 bg-slate-50 shadow-inner object-cover" alt="Mentor" />
            </div>
            
            <div className="flex-1 text-center sm:text-left z-10">
              <h3 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1 flex items-center justify-center sm:justify-start gap-2">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" /> Your Assigned Mentor
              </h3>
              <h2 className="text-2xl font-black text-slate-900 mb-1 tracking-tight">Dr. Emily Doe</h2>
              <p className="text-slate-500 font-medium mb-6 text-sm leading-relaxed max-w-xl">Senior Frontend Architect. Guiding you through UI/UX & High-Fidelity App Design.</p>
              
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
                 <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl border-none shadow-md text-xs uppercase tracking-wider py-3 px-5 hover:scale-[1.02] active:scale-95 transition-all" onClick={() => navigate('/mentorship')}>
                   <Video size={14} className="mr-2"/> Join Session
                 </Button>
                 <Button size="sm" variant="outline" className="border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl font-bold bg-white text-xs uppercase tracking-wider py-3 px-5" onClick={() => navigate('/messages')}>
                   Message
                 </Button>
              </div>
            </div>
          </Card>
      </div>

    </div>
  );
};

export default StudentDashboard;
