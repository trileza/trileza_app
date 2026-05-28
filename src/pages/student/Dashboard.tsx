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
      <div className="bg-white rounded-[2.5rem] border border-slate-200/60 shadow-xl shadow-slate-200/40 p-8 md:p-12 relative overflow-hidden">
        {/* Subtle background element */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-slate-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 opacity-60" />
        
        <div className="relative z-10 flex flex-col lg:flex-row gap-10 lg:items-start">
          
          {/* Avatar Column */}
          <div className="shrink-0 flex flex-col items-center lg:items-start">
            <div className="relative">
              <div className="absolute -inset-1 rounded-3xl bg-slate-200 opacity-60 blur-sm" />
              <img 
                src={user?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.full_name || 'Student'}`} 
                alt="Profile" 
                className="relative w-40 h-40 rounded-[2rem] border-[6px] border-white shadow-xl object-cover bg-slate-100"
              />
            </div>

            <div className="mt-8 flex flex-col w-full gap-3">
              <Button 
                onClick={() => navigate('/settings')}
                variant="outline"
                className="w-full border-slate-200 text-slate-700 hover:bg-slate-50 font-bold rounded-xl h-12 bg-white shadow-sm flex justify-center items-center gap-2"
              >
                <Edit3 size={18} /> Edit Profile
              </Button>
            </div>
          </div>

          {/* Content Column */}
          <div className="flex-1 w-full flex flex-col h-full justify-between">
            
            {/* Header Info */}
            <div className="space-y-5 text-center lg:text-left mb-8">
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3">
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-black uppercase tracking-wider border border-emerald-200">
                  <Shield size={14} /> Verified Academic Node
                </span>
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-100 text-slate-600 text-xs font-bold border border-slate-200">
                  <GraduationCap size={14} /> Level {enrollments.length > 0 ? enrollments.length + 1 : 1} Mentee
                </span>
              </div>

              {isEditing ? (
                <div className="flex items-center justify-center lg:justify-start gap-2">
                  <input 
                    type="text" 
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="bg-white border-2 border-slate-300 text-slate-900 placeholder:text-slate-400 rounded-xl px-4 py-1.5 text-3xl font-black outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <button onClick={handleSaveProfile} className="p-2 bg-slate-900 text-white hover:bg-black rounded-xl transition-all shadow-md"><CheckCircle size={16}/></button>
                </div>
              ) : (
                <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight flex items-center justify-center lg:justify-start gap-3">
                  {user?.full_name || 'Academic Scholar'}
                  <button onClick={() => setIsEditing(true)} className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors text-slate-500" title="Edit Display Name">
                    <Edit2 size={16} />
                  </button>
                </h1>
              )}

              <p className="text-slate-600 font-medium text-lg leading-relaxed max-w-3xl mx-auto lg:mx-0">
                {user?.bio || 'Passionate about engineering systems, agentic frameworks, and high-performance cognitive design.'}
              </p>
              
              <p className="text-slate-700 text-sm font-bold">
                Account ID: <span className="text-slate-900 font-mono font-semibold">{user?.email}</span>
              </p>
            </div>

            {/* Mentee Analytics & Objectives - Grid */}
            <div className="pt-8 border-t border-slate-100 mt-auto">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-6 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500"></span>
                Mentee Analytics & Objectives
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 hover:border-emerald-200 transition-colors">
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-3">Active Courses</p>
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-white text-emerald-600 shadow-sm">
                      <BookOpen size={20} />
                    </div>
                    <h4 className="font-extrabold text-slate-900 text-2xl leading-snug">{enrollments.length}</h4>
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 hover:border-emerald-200 transition-colors">
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-3">Goal Streak</p>
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-white text-emerald-600 shadow-sm">
                      <TrendingUp size={20} />
                    </div>
                    <h4 className="font-extrabold text-slate-900 text-2xl leading-snug">7 Days</h4>
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 hover:border-emerald-200 transition-colors">
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-3">XP Points</p>
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-white text-emerald-600 shadow-sm">
                      <Award size={20} />
                    </div>
                    <h4 className="font-extrabold text-slate-900 text-2xl leading-snug">1,250</h4>
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
            <h2 className="text-sm font-bold text-slate-600 tracking-wider uppercase flex items-center gap-2">
              <Clock className="text-green-600" size={20} strokeWidth={2.5} /> Vital Course Progress
            </h2>
            {enrollments.length > 0 && (
              <Button 
                variant="ghost" 
                className="text-slate-700 hover:text-slate-950 font-bold text-sm uppercase tracking-wider"
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
                  className="p-6 border-2 border-slate-250/70 shadow-sm hover:shadow-md bg-white rounded-[2rem] hover:border-green-400 transition-all group cursor-pointer text-left"
                  onClick={() => navigate('/learning')}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-green-50 text-green-700 flex items-center justify-center group-hover:scale-105 transition-all shadow-inner border border-green-100">
                        <PlayCircle size={22} />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-base group-hover:text-green-705 transition-colors">
                          Module {(enrollment as any).current_module || 1} Syllabus Focus
                        </h4>
                        <p className="text-sm font-semibold text-slate-600 uppercase tracking-wider mt-0.5">
                          Progress: {enrollment.progress}% Complete
                        </p>
                      </div>
                    </div>
                    {/* Vibrant green Action Button */}
                    <Button 
                      size="sm" 
                      className="bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl text-sm uppercase tracking-wider px-5 border-none shadow-md shadow-green-600/10"
                    >
                      Resume Learning
                    </Button>
                  </div>
                  
                  {/* Progress Indicator - Green Highlight Line */}
                  <div className="mt-5 w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
                    <div 
                      className="bg-green-600 h-full rounded-full transition-all duration-1000 shadow-sm" 
                      style={{ width: `${enrollment.progress}%` }} 
                    />
                  </div>
                </Card>
              ))
            ) : (
              <div className="p-12 text-center bg-white border-2 border-slate-250/70 rounded-[2rem] space-y-4 shadow-sm">
                <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mx-auto text-green-700 shadow-inner border border-green-100">
                  <BookOpen size={20} />
                </div>
                <div className="space-y-1">
                  <p className="font-bold text-slate-900 text-lg">No Active Enrollments</p>
                  <p className="text-sm text-slate-600 font-medium max-w-xs mx-auto">Configure your digital career objectives and enroll in a course to begin tracking your analytics.</p>
                </div>
                <Button 
                  onClick={() => navigate('/library')} 
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white rounded-xl border-none shadow-lg shadow-green-600/15 font-bold"
                >
                  Explore Course Catalog
                </Button>
              </div>
            )}
          </div>
      </div>

      {/* ── 3. SECONDARY SECTION: MENTOR ── */}
      <div className="space-y-6">
          <h2 className="text-sm font-bold text-slate-600 tracking-wider uppercase flex items-center gap-2">
            <Users className="text-green-600" size={20} strokeWidth={2.5} /> Active Mentorship
          </h2>
          
          <Card className="bg-white border-2 border-slate-250/70 shadow-sm p-8 rounded-[2rem] flex flex-col sm:flex-row items-center gap-8 text-left transition-all duration-300 hover:border-green-400">
            <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=DrDoe" className="w-24 h-24 rounded-[2rem] border border-slate-200 bg-slate-55 shadow-inner" alt="Mentor" />
            <div className="flex-1 text-center sm:text-left">
              <h3 className="text-xs font-bold text-green-700 uppercase tracking-wider mb-1 flex items-center justify-center sm:justify-start gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" /> Your Assigned Mentor
              </h3>
              <h2 className="text-2xl font-black text-slate-900 mb-2">Dr. Emily Doe</h2>
              <p className="text-slate-600 font-medium mb-6 text-base leading-relaxed">Senior Frontend Architect. Guiding you through UI/UX & High-Fidelity App Design.</p>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4">
                 <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white font-black rounded-xl border-none shadow-md" onClick={() => navigate('/mentorship')}>
                   <Video size={14} className="mr-2"/> Join Session
                 </Button>
                 <Button size="sm" variant="outline" className="border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl font-bold bg-white" onClick={() => navigate('/messages')}>
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
