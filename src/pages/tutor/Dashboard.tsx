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

import LibraryHighlights from '../../components/shared/LibraryHighlights';

const TutorDashboard = () => {
  const navigate = useNavigate();
  const { user, updateProfile } = useAuthStore();
  const [toast, setToast] = React.useState<{message: string, type: 'success' | 'info'} | null>(null);
  const [isEditing, setIsEditing] = React.useState(false);
  const [isExpanded, setIsExpanded] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [courses, setCourses] = React.useState<Course[]>([]);
  const [loadingCourses, setLoadingCourses] = React.useState(true);

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
    }
  }, [user]);

  const showFeedback = (msg: string, type: 'success' | 'info' = 'success') => {
    setToast({ message: msg, type });
  };
  
  const initialData = React.useMemo(() => ({
    name: user?.full_name || 'Dr. David Ileza',
    bio: user?.bio || 'Expert in Advanced Agentic Coding & AI Systems. Dedicated to empowering the next generation of engineers through practical, high-impact education.',
    avatar: user?.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=David',
    website: 'trileza.com/david',
    email: user?.email || 'david@trileza.com',
    expertise: [
      { id: Date.now() + 1, type: 'Industrial Background', desc: 'Lead AI Architect at Trileza Systems. Over 15 years of codebase management and agentic system design.', icon: 'briefcase' },
      { id: Date.now() + 2, type: 'Academic Pedigree', desc: 'PH.D. STANFORD UNIVERSITY • M.SC. MIT', icon: 'grad' }
    ]
  }), [user]);

  const [tutorData, setTutorData] = React.useState(initialData);

  const [editForm, setEditForm] = React.useState({
    name: initialData.name,
    bio: initialData.bio,
    avatar: initialData.avatar,
    website: initialData.website,
    expertise: initialData.expertise
  });

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setEditForm(prev => ({ ...prev, avatar: url }));
      showFeedback('Picture uploaded! Don\'t forget to save changes.');
    }
  };

  const addExpertise = () => {
    setEditForm(prev => ({
      ...prev,
      expertise: [...prev.expertise, { id: Date.now(), type: 'New Role', desc: 'Details about this role', icon: 'briefcase' }]
    }));
    setIsExpanded(true);
  };

  const removeExpertise = (id: number) => {
    setEditForm(prev => ({
      ...prev,
      expertise: prev.expertise.filter(e => e.id !== id)
    }));
  };

  const updateExpertise = (id: number, field: string, value: string) => {
    setEditForm(prev => ({
      ...prev,
      expertise: prev.expertise.map(e => e.id === id ? { ...e, [field]: value } : e)
    }));
  };

  const handleSave = async () => {
    if (user) {
      const { error } = await updateProfile({
        full_name: editForm.name,
        bio: editForm.bio,
        avatar_url: editForm.avatar,
        website: editForm.website,
        expertise: editForm.expertise,
      });
      if (error) {
        showFeedback('Failed to save: ' + error, 'info');
        return;
      }
    }
    setTutorData({
      ...tutorData,
      name: editForm.name,
      bio: editForm.bio,
      avatar: editForm.avatar,
      website: editForm.website,
      expertise: editForm.expertise
    });
    setIsEditing(false);
    showFeedback('Profile completely updated!');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-10 animate-in fade-in duration-700 pb-24">
      <LibraryHighlights />

      {/* ═══════════════════════════════════════════════════════════════════
          HERO PROFILE CARD — Social Media Style
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="rounded-3xl overflow-hidden shadow-2xl shadow-slate-300/40">
        
        {/* ── COVER BANNER ── */}
        <div className="relative h-52 md:h-64 overflow-hidden" style={{
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
          
          {/* Top bar */}
          <div className="absolute top-0 left-0 right-0 px-8 py-5 flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-white/70">
              <div className="w-8 h-8 rounded-lg bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/10">
                <Sparkles size={14} className="text-[#4ade80]" />
              </div>
              <span className="text-sm font-bold uppercase tracking-wider">Nexus Ecosystem</span>
            </div>
            <Button
              onClick={() => navigate('/live')}
              className="bg-white text-[#14532d] hover:bg-white/90 border-none rounded-full px-6 h-10 font-bold text-sm flex items-center gap-2 shadow-xl shadow-black/20 transition-all hover:scale-[1.02]"
            >
              <Radio size={15} className="text-[#16a34a]" /> Enter Live Stage
            </Button>
          </div>

          {/* Banner title */}
          <div className="absolute bottom-6 left-8 md:left-44 md:bottom-7">
            <h2 className="text-white text-3xl md:text-4xl font-black tracking-tight drop-shadow-lg">
              Mentor Command Center
            </h2>
          </div>
        </div>

        {/* ── PROFILE INFO BAR ── */}
        <div className="relative bg-white">
          {/* Avatar overlapping banner */}
          <div className="absolute -top-16 left-6 md:left-8 z-20">
            <div className="relative group">
              {/* Online ring */}
              <div className="absolute -inset-1.5 rounded-3xl bg-gradient-to-br from-[#22c55e] to-[#16a34a] opacity-80" />
              <div className="relative w-28 h-28 md:w-32 md:h-32 rounded-3xl border-[5px] border-white shadow-2xl overflow-hidden bg-slate-100">
                <img 
                  src={isEditing ? editForm.avatar : tutorData.avatar} 
                  alt={tutorData.name} 
                  className="w-full h-full object-cover"
                />
                {isEditing && (
                  <div 
                    className="absolute inset-0 bg-black/50 flex items-center justify-center cursor-pointer hover:bg-black/60 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Camera className="text-white" size={28} />
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                  </div>
                )}
              </div>
              {/* Verified badge */}
              {!isEditing && (
                <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-[#16a34a] rounded-xl border-[3px] border-white flex items-center justify-center shadow-lg">
                  <CheckCircle size={14} className="text-white" />
                </div>
              )}
            </div>
          </div>

          {/* Info + Actions */}
          <div className="pt-4 md:pt-5 pb-6 px-6 md:px-8 ml-0 md:ml-44">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mt-14 md:mt-0">
              {/* Left: Name + badge */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#dcfce7] text-[#166534] text-xs font-bold uppercase tracking-wider border border-[#bbf7d0]">
                    <CheckCircle size={11} /> Verified Mentor
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold uppercase tracking-wider">
                    <Star size={11} className="text-amber-500" /> 4.9 Rating
                  </span>
                </div>
                {isEditing ? (
                  <input 
                    type="text" 
                    value={editForm.name}
                    onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                    className="w-full text-2xl font-black p-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-green-500 bg-slate-50 text-slate-900"
                    placeholder="Full Name"
                  />
                ) : (
                  <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900">
                    {tutorData.name}
                  </h1>
                )}
                {isEditing ? (
                  <textarea 
                    value={editForm.bio}
                    onChange={(e) => setEditForm({...editForm, bio: e.target.value})}
                    className="w-full h-16 p-2 text-slate-600 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-green-500 bg-slate-50 resize-none text-sm"
                    placeholder="Your Bio"
                  />
                ) : (
                  <p className="text-slate-500 text-sm font-medium max-w-lg">
                    {tutorData.bio}
                  </p>
                )}
              </div>

              {/* Right: Action buttons */}
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                {isEditing ? (
                  <>
                    <Button 
                      onClick={handleSave}
                      className="bg-[#16a34a] hover:bg-[#15803d] text-white border-none rounded-full px-6 h-10 font-bold text-sm shadow-lg shadow-green-600/25"
                    >
                      Save Changes
                    </Button>
                    <Button 
                      variant="outline" 
                      className="border-slate-200 text-slate-600 rounded-full px-5 h-10 font-bold text-sm hover:bg-slate-50"
                      onClick={() => { setEditForm({ ...tutorData }); setIsEditing(false); }}
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      onClick={() => setIsEditing(true)} 
                      variant="outline"
                      className="border-slate-200 text-slate-700 rounded-full px-5 h-10 font-bold text-sm hover:bg-slate-50 flex items-center gap-2"
                    >
                      <Edit2 size={14} /> Edit Profile
                    </Button>
                    <Button
                      onClick={() => navigate('/portfolio')} 
                      className="bg-[#16a34a] hover:bg-[#15803d] text-white border-none rounded-full px-5 h-10 font-bold text-sm shadow-lg shadow-green-600/25 flex items-center gap-2"
                    >
                      <Globe size={14} /> Public Profile
                    </Button>
                    <Button
                      onClick={() => navigate('/messages')} 
                      variant="outline"
                      className="border-slate-200 text-slate-700 rounded-full px-5 h-10 font-bold text-sm hover:bg-slate-50 flex items-center gap-2"
                    >
                      <Mail size={14} /> Message
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>


      {/* ═══════════════════════════════════════════════════════════════════
          STATS ROW — Green Palette Gradient Cards
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Stat 1 */}
        <div className="relative overflow-hidden p-5 rounded-2xl bg-gradient-to-br from-[#f0fdf4] to-[#dcfce7] border border-[#bbf7d0]/50 group hover:shadow-lg transition-all cursor-default">
          <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full bg-[#bbf7d0]/40 blur-xl" />
          <div className="relative z-10">
            <div className="w-10 h-10 rounded-xl bg-[#bbf7d0] flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Users size={18} className="text-[#166534]" />
            </div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#15803d] mb-0.5">Total Mentees</p>
            <p className="text-3xl font-black text-[#14532d]">124</p>
          </div>
        </div>

        {/* Stat 2 */}
        <div className="relative overflow-hidden p-5 rounded-2xl bg-gradient-to-br from-[#dcfce7] to-[#bbf7d0] border border-[#86efac]/40 group hover:shadow-lg transition-all cursor-default">
          <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full bg-[#86efac]/40 blur-xl" />
          <div className="relative z-10">
            <div className="w-10 h-10 rounded-xl bg-[#86efac] flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Video size={18} className="text-[#14532d]" />
            </div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#166534] mb-0.5">Pending Sessions</p>
            <p className="text-3xl font-black text-[#14532d]">4</p>
          </div>
        </div>

        {/* Stat 3 */}
        <div className="relative overflow-hidden p-5 rounded-2xl bg-gradient-to-br from-[#f0fdf4] to-[#dcfce7] border border-[#bbf7d0]/50 group hover:shadow-lg transition-all cursor-default">
          <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full bg-[#bbf7d0]/40 blur-xl" />
          <div className="relative z-10">
            <div className="w-10 h-10 rounded-xl bg-[#bbf7d0] flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Target size={18} className="text-[#166534]" />
            </div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#15803d] mb-0.5">Cohort Score</p>
            <p className="text-3xl font-black text-[#14532d]">84%</p>
          </div>
        </div>

        {/* Stat 4 */}
        <div className="relative overflow-hidden p-5 rounded-2xl bg-gradient-to-br from-[#166534] to-[#14532d] border border-[#22c55e]/20 group hover:shadow-lg transition-all cursor-default">
          <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full bg-[#22c55e]/15 blur-xl" />
          <div className="relative z-10">
            <div className="w-10 h-10 rounded-xl bg-[#22c55e]/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <TrendingUp size={18} className="text-[#4ade80]" />
            </div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#86efac] mb-0.5">Revenue</p>
            <p className="text-3xl font-black text-white">$2.4k</p>
          </div>
        </div>
      </div>


      {/* ═══════════════════════════════════════════════════════════════════
          TWO-COLUMN: About + Sidebar
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── LEFT: About & Expertise (2 cols) ── */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-7 rounded-2xl border border-slate-200/60 shadow-lg bg-white">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#dcfce7] flex items-center justify-center">
                  <Briefcase size={15} className="text-[#16a34a]" />
                </div>
                About & Expertise
              </h3>
              {isEditing && (
                <Button size="sm" variant="ghost" className="text-[#16a34a] hover:bg-green-50 gap-1 font-bold" onClick={addExpertise}>
                  <Plus size={16} /> Add
                </Button>
              )}
            </div>

            {/* Bio */}
            {isEditing ? (
              <textarea 
                value={editForm.bio}
                onChange={(e) => setEditForm({...editForm, bio: e.target.value})}
                className="w-full h-24 p-3 text-slate-700 font-medium rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-green-500 bg-slate-50 resize-none mb-5"
                placeholder="Your Bio"
              />
            ) : (
              <p className="text-slate-600 text-base leading-relaxed mb-6 font-medium">{tutorData.bio}</p>
            )}

            {/* Expertise */}
            <div className={`space-y-3 transition-all duration-500 overflow-hidden ${isExpanded || isEditing ? 'max-h-[2000px]' : 'max-h-[260px]'}`}>
              {(isEditing ? editForm.expertise : tutorData.expertise).map((exp, i) => (
                <div key={exp.id} className={cn(
                  "flex items-start gap-4 p-5 rounded-2xl transition-all border group",
                  i % 2 === 0
                    ? "bg-[#f0fdf4] border-[#dcfce7] hover:border-[#86efac]"
                    : "bg-slate-50 border-slate-100 hover:border-slate-200"
                )}>
                  <div className={cn(
                    "p-3 rounded-xl shrink-0",
                    i % 2 === 0 ? "bg-[#bbf7d0] text-[#166534]" : "bg-slate-200 text-slate-600"
                  )}>
                    {exp.icon === 'grad' ? <GradIcon size={20} /> : <Briefcase size={20} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <div className="space-y-2 pr-8 relative">
                        <input 
                          type="text" value={exp.type}
                          onChange={(e) => updateExpertise(exp.id, 'type', e.target.value)}
                          className="w-full font-bold text-slate-900 text-base p-2 rounded-lg border border-slate-200 bg-white"
                          placeholder="Title"
                        />
                        <textarea 
                          value={exp.desc}
                          onChange={(e) => updateExpertise(exp.id, 'desc', e.target.value)}
                          className="w-full text-sm text-slate-600 leading-relaxed p-2 rounded-lg border border-slate-200 bg-white h-20 resize-none"
                          placeholder="Description"
                        />
                        <button className="absolute -right-2 top-2 p-2 text-slate-300 hover:text-red-500 transition-colors" onClick={() => removeExpertise(exp.id)}><Trash2 size={16}/></button>
                      </div>
                    ) : (
                      <>
                        <p className="font-bold text-slate-900 text-base">{exp.type}</p>
                        <p className="text-sm text-slate-500 mt-1 leading-relaxed">{exp.desc}</p>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Expand */}
            {!isEditing && tutorData.expertise.length > 2 && (
              <div className="pt-4 border-t border-slate-100 mt-4 text-center">
                <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-900 font-bold" onClick={() => setIsExpanded(!isExpanded)}>
                  {isExpanded ? <span className="flex items-center gap-1">Show Less <ChevronUp size={16} /></span> : <span className="flex items-center gap-1">Show All <ChevronDown size={16} /></span>}
                </Button>
              </div>
            )}

            {/* Save/Edit actions */}
            {!isEditing ? (
              <div className="flex gap-3 mt-6 pt-5 border-t border-slate-100">
                <Button 
                  variant="outline" 
                  className="border-slate-200 hover:bg-slate-50 text-slate-700 rounded-full px-6 h-10 font-bold flex items-center gap-2"
                  onClick={() => setIsEditing(true)}
                >
                  <Edit2 size={15} /> Edit Profile
                </Button>
                <Button 
                  className="bg-slate-900 hover:bg-slate-800 text-white border-none rounded-full px-6 h-10 font-bold flex items-center gap-2 shadow-md"
                  onClick={() => navigate('/messages')}
                >
                  <Mail size={15} /> Contact
                </Button>
              </div>
            ) : (
              <div className="flex gap-3 mt-6 pt-5 border-t border-slate-100">
                <Button onClick={handleSave} className="bg-[#16a34a] hover:bg-[#15803d] text-white border-none rounded-full px-6 h-10 font-bold shadow-lg shadow-green-600/20">
                  Save Changes
                </Button>
                <Button variant="outline" className="border-slate-200 text-slate-600 rounded-full px-5 h-10 font-bold hover:bg-slate-50" onClick={() => { setEditForm({ ...tutorData }); setIsEditing(false); }}>
                  Cancel
                </Button>
              </div>
            )}
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

          {/* Connect & Links — Green tinted */}
          <Card className="p-6 rounded-2xl bg-[#f0fdf4] border border-[#bbf7d0]/40 shadow-lg">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#166534] mb-4 flex items-center gap-2">
              <Globe size={14} className="text-[#16a34a]" /> Portfolio & Links
            </h3>
            <div className="space-y-2.5">
              {isEditing ? (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-white border border-[#dcfce7]">
                  <Globe size={15} className="text-[#16a34a] shrink-0" />
                  <input 
                    type="text" value={editForm.website}
                    onChange={(e) => setEditForm({...editForm, website: e.target.value})}
                    className="w-full text-sm font-bold text-slate-900 border-none bg-transparent outline-none"
                    placeholder="Website Link"
                  />
                </div>
              ) : (
                <button 
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-white hover:shadow-md border border-[#dcfce7] transition-all group text-left"
                  onClick={() => navigate('/portfolio')}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-[#dcfce7] flex items-center justify-center">
                      <Globe size={14} className="text-[#16a34a]" />
                    </div>
                    <span className="text-sm font-bold text-slate-700">{tutorData.website}</span>
                  </div>
                  <ExternalLink size={13} className="text-slate-300 group-hover:text-[#16a34a] transition-colors" />
                </button>
              )}
              <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-[#dcfce7]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#bbf7d0] flex items-center justify-center">
                    <Users size={14} className="text-[#15803d]" />
                  </div>
                  <span className="text-sm font-bold text-slate-800">12,850 Learners</span>
                </div>
                <CheckCircle size={13} className="text-[#22c55e]" />
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-[#dcfce7]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#dcfce7] flex items-center justify-center">
                    <Star size={14} className="text-[#16a34a]" />
                  </div>
                  <span className="text-sm font-bold text-slate-800">4.9 Avg Rating</span>
                </div>
                <span className="text-amber-400 text-xs">★★★★★</span>
              </div>
              {!isEditing && (
                <Button 
                  className="w-full rounded-xl h-10 mt-2 font-bold text-sm bg-[#166534] text-white hover:bg-[#14532d] border-none shadow-md"
                  onClick={() => navigate('/portfolio')}
                >
                  View Portfolio →
                </Button>
              )}
            </div>
          </Card>
        </div>
      </div>


      {/* ═══════════════════════════════════════════════════════════════════
          BECOME A MENTOR CTA
          ═══════════════════════════════════════════════════════════════════ */}
      {!user?.mentor_tier && (
        <div 
          className="relative overflow-hidden rounded-2xl p-8 cursor-pointer group transition-all duration-500 hover:shadow-xl"
          style={{ background: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 40%, #86efac 100%)' }}
          onClick={() => navigate('/mentor/onboarding')}
        >
          <div className="absolute top-0 right-0 w-48 h-48 bg-[#4ade80]/30 rounded-full blur-3xl" />
          <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
            <div className="w-16 h-16 bg-[#166534] rounded-2xl flex items-center justify-center text-white shadow-xl group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
              <Shield size={30} />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h3 className="text-2xl font-black text-[#14532d] mb-1 tracking-tight">Establish Your <span className="text-[#16a34a]">Mentor Node</span></h3>
              <p className="text-[#166534]/80 font-medium leading-relaxed">
                Join the Nexus mentorship ecosystem. Get tiered verification and unlock 1:1 and group sessions.
              </p>
            </div>
            <Button className="rounded-full h-12 px-8 font-bold text-sm bg-[#14532d] hover:bg-[#052e16] text-white border-none shadow-xl group-hover:translate-x-1 transition-all">
              Begin Verification →
            </Button>
          </div>
        </div>
      )}


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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-64 animate-pulse bg-slate-100 rounded-2xl" />
            ))}
          </div>
        ) : courses.length === 0 ? (
          <div className="p-16 text-center rounded-2xl border-2 border-dashed border-[#bbf7d0] bg-gradient-to-br from-[#f0fdf4] to-white">
            <div className="w-16 h-16 bg-[#dcfce7] rounded-2xl flex items-center justify-center mx-auto mb-5 text-[#16a34a]">
              <BookOpen size={28} />
            </div>
            <h3 className="text-xl font-bold text-slate-900">No courses yet</h3>
            <p className="text-slate-500 text-sm max-w-xs mx-auto mt-2 leading-relaxed">Start your journey as an educator by creating your first course.</p>
            <Button 
              className="mt-6 bg-[#16a34a] hover:bg-[#15803d] text-white border-none rounded-full px-8 h-10 font-bold text-sm shadow-lg shadow-green-600/20"
              onClick={() => navigate('/tutor/courses/new')}
            >
              Create First Course →
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {courses.map((course) => (
              <div 
                key={course.id} 
                className="group overflow-hidden rounded-2xl border border-slate-200/60 shadow-md hover:shadow-xl transition-all duration-500 cursor-pointer bg-white"
                onClick={() => navigate(`/tutor/courses/${course.id}`)}
              >
                <div className="relative aspect-video bg-slate-100 overflow-hidden">
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
                <div className="p-5">
                  <h3 className="font-bold text-slate-900 line-clamp-2 group-hover:text-[#16a34a] transition-colors">{course.title}</h3>
                  <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100 text-slate-400">
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
