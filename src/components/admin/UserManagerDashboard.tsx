import React, { useEffect, useState } from 'react';
import { adminService } from '../../lib/services/admin';
import type { MentorApplication } from '../../types/admin';
import { nexus } from '../../lib/nexus';
import { Card, Button } from '../ui';
import { useAuthStore } from '../../store/authStore';
import { 
  Users, 
  CheckSquare, 
  AlertCircle, 
  Video, 
  FileText, 
  ShieldAlert, 
  ShieldCheck,
  Search,
  CheckCircle2,
  RefreshCcw,
  Slash,
  Send,
  Lock,
  Eye,
  Activity,
  Download,
  Mail,
  UserCheck
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { formatDate } from '../../utils';

const UserManagerDashboard: React.FC = () => {
  const { user: currentUser } = useAuthStore();
  const [applications, setApplications] = useState<MentorApplication[]>([]);
  const [authorApplications, setAuthorApplications] = useState<any[]>([]);
  const [subApplicationsTab, setSubApplicationsTab] = useState<'mentor' | 'author'>('mentor');
  const [profiles, setProfiles] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [books, setBooks] = useState<any[]>([]);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Tab control: 'mentors' | 'mentees' | 'dual' | 'authors' | 'suspended' | 'applications'
  const [activeTab, setActiveTab] = useState<'mentors' | 'mentees' | 'dual' | 'authors' | 'suspended' | 'applications'>('mentors');

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Selected item state
  const [selectedApp, setSelectedApp] = useState<MentorApplication | null>(null);
  const [selectedAuthorApp, setSelectedAuthorApp] = useState<any | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<any | null>(null);

  // Messages / conversation history
  const [dmHistory, setDmHistory] = useState<any[]>([]);
  const [dmInputText, setDmInputText] = useState('');

  // Simulator overlays
  const [impersonatingUser, setImpersonatingUser] = useState<any | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);

  // Bulk actions selection states
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [bulkMessageText, setBulkMessageText] = useState('');

  // Mentor Checklist state
  const [mentorChecklist, setMentorChecklist] = useState({
    checklist_profile_completeness: false,
    checklist_id_verification: false,
    checklist_qualifications: false,
    checklist_intro_video: false
  });

  const [rejectionReason, setRejectionReason] = useState('');
  const [suspensionReason, setSuspensionReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [apps, authorApps, profsRes, coursesRes, booksRes, enrollRes, auditRes] = await Promise.all([
        adminService.getMentorApplications(),
        adminService.getAuthorApplications(),
        nexus.database.from('profiles').select('*').order('created_at', { ascending: false }),
        nexus.database.from('courses').select('*'),
        nexus.database.from('books').select('*'),
        nexus.database.from('enrollments').select('*'),
        nexus.database.from('admin_audit_logs').select('*').order('created_at', { ascending: false })
      ]);
      setApplications(apps);
      setAuthorApplications(authorApps);
      setProfiles(profsRes.data || []);
      setCourses(coursesRes.data || []);
      setBooks(booksRes.data || []);
      setEnrollments(enrollRes.data || []);
      setAuditLogs(auditRes.data || []);
    } catch (err) {
      console.error('[UM Fetch Error]:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSelectApp = (app: MentorApplication) => {
    setSelectedApp(app);
    setSelectedAuthorApp(null);
    setSelectedProfile(null);
    setMentorChecklist({
      checklist_profile_completeness: app.checklist_profile_completeness,
      checklist_id_verification: app.checklist_id_verification,
      checklist_qualifications: app.checklist_qualifications,
      checklist_intro_video: app.checklist_intro_video
    });
    setRejectionReason(app.rejection_reason || '');
  };

  const handleSelectAuthorApp = (app: any) => {
    setSelectedAuthorApp(app);
    setSelectedApp(null);
    setSelectedProfile(null);
    setRejectionReason(app.rejection_reason || '');
  };

  const handleSelectProfile = async (prof: any) => {
    setSelectedProfile(prof);
    setSelectedApp(null);
    setSelectedAuthorApp(null);
    setGeneratedPassword(null);
    setDmInputText('');
    setDmHistory([]);
    if (currentUser?.id) {
      try {
        const history = await adminService.getCreatorMessages(currentUser.id, prof.id);
        setDmHistory(history);
      } catch (err) {
        console.error('[Fetch DM History Error]:', err);
      }
    }
  };

  const submitMentorReview = async (status: 'approved' | 'rejected' | 'needs_info') => {
    if (!selectedApp || !currentUser?.id) return;
    setSubmitting(true);
    try {
      await adminService.reviewMentor(
        selectedApp.id,
        currentUser.id,
        status,
        mentorChecklist,
        rejectionReason,
        selectedApp.user_id
      );
      setSelectedApp(null);
      await fetchData();
      alert(`Mentor application successfully marked as ${status}!`);
    } catch (err) {
      alert('Failed to submit application decision: ' + err);
    } finally {
      setSubmitting(false);
    }
  };

  const submitAuthorReview = async (status: 'approved' | 'rejected' | 'needs_info') => {
    if (!selectedAuthorApp || !currentUser?.id) return;
    setSubmitting(true);
    try {
      await adminService.reviewAuthor(
        selectedAuthorApp.id,
        currentUser.id,
        status,
        rejectionReason,
        selectedAuthorApp.user_id
      );
      setSelectedAuthorApp(null);
      await fetchData();
      alert(`Author application successfully marked as ${status}!`);
    } catch (err) {
      alert('Failed to submit application decision: ' + err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleSuspension = async (profileId: string, suspend: boolean) => {
    if (!currentUser?.id) return;
    if (suspend && !suspensionReason.trim()) {
      alert('Please state a reason for suspending this account.');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await adminService.setUserSuspension(
        profileId,
        suspend,
        currentUser.id,
        suspend ? suspensionReason : 'Unban request processed by administrator'
      );
      if (error) throw error;
      setSuspensionReason('');
      setSelectedProfile(null);
      await fetchData();
      alert(suspend ? 'User account suspended!' : 'User account reactivated!');
    } catch (err) {
      alert('Failed to update suspension status: ' + err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendDm = async () => {
    if (!selectedProfile || !dmInputText.trim() || !currentUser?.id) return;
    try {
      const msg = await adminService.sendCreatorMessage(currentUser.id, selectedProfile.id, dmInputText);
      setDmHistory(prev => [...prev, msg]);
      setDmInputText('');
    } catch (err) {
      alert('Failed to send DM: ' + err);
    }
  };

  const handleResetPassword = () => {
    if (!selectedProfile) return;
    const tempPass = Math.random().toString(36).slice(-8).toUpperCase() + '@2026';
    setGeneratedPassword(tempPass);
    alert(`Reset link dispatched! Temporary bypass credential generated: ${tempPass}`);
  };

  // Bulk actions
  const handleBulkSuspend = async () => {
    if (selectedUserIds.length === 0 || !currentUser?.id) return;
    const reason = prompt("State reason for bulk suspension:");
    if (!reason) return;
    setSubmitting(true);
    try {
      await Promise.all(
        selectedUserIds.map(async (uId) => {
          await adminService.setUserSuspension(uId, true, currentUser.id, reason);
        })
      );
      setSelectedUserIds([]);
      setSelectedProfile(null);
      await fetchData();
      alert('Selected users suspended successfully!');
    } catch (err) {
      alert('Bulk suspension failed: ' + err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkMessage = async () => {
    if (selectedUserIds.length === 0 || !bulkMessageText.trim() || !currentUser?.id) return;
    setSubmitting(true);
    try {
      await Promise.all(
        selectedUserIds.map(async (uId) => {
          await adminService.sendCreatorMessage(currentUser.id, uId, bulkMessageText);
        })
      );
      setSelectedUserIds([]);
      setBulkMessageText('');
      alert('Bulk direct messages dispatched successfully!');
    } catch (err) {
      alert('Bulk messaging failed: ' + err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportCSV = () => {
    if (selectedUserIds.length === 0) return;
    const selectedProfiles = profiles.filter(p => selectedUserIds.includes(p.id));
    const headers = ["ID", "Full Name", "Email", "Role", "Join Date", "Status", "ID Verified"];
    const rows = selectedProfiles.map(u => [
      u.id,
      u.full_name,
      u.email,
      u.role,
      u.created_at,
      u.metadata?.suspended ? "Suspended" : "Active",
      u.metadata?.id_verified ? "Verified" : "Unverified"
    ]);
    const csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `user_registry_export_${Date.now()}.csv`);
    link.click();
  };

  // Helper metrics calculations
  const getEnrolledCount = (pId: string) => enrollments.filter(e => e.student_id === pId).length;
  const getTaughtCount = (pId: string) => courses.filter(c => c.tutor_id === pId).length;
  const getPublishedBooksCount = (pId: string) => books.filter(b => b.author_id === pId).length;
  const getProfileCompletion = (p: any) => {
    let score = 30;
    if (p.full_name) score += 15;
    if (p.avatar_url) score += 15;
    if (p.bio || p.metadata?.bio) score += 15;
    if (p.expertise || p.metadata?.expertise) score += 15;
    if (p.qualifications || p.metadata?.qualifications) score += 10;
    return Math.min(score, 100);
  };

  // Profile classification filters
  const getFilteredProfiles = () => {
    return profiles.filter(p => {
      const matchesSearch = 
        p.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.id?.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      const isSuspended = p.metadata?.suspended === true;
      const coursesCount = getTaughtCount(p.id);
      const enrollCount = getEnrolledCount(p.id);

      switch (activeTab) {
        case 'mentors':
          return !isSuspended && (p.role === 'mentor' || p.role === 'tutor');
        case 'mentees':
          return !isSuspended && (p.role === 'student' || p.role === 'mentee');
        case 'dual':
          return !isSuspended && (coursesCount > 0 && enrollCount > 0);
        case 'authors':
          return !isSuspended && (p.role === 'author' || getPublishedBooksCount(p.id) > 0);
        case 'suspended':
          return isSuspended;
        default:
          return true;
      }
    });
  };

  const currentProfileList = getFilteredProfiles();
  const pendingApps = applications.filter(a => a.status === 'pending');
  const pendingAuthorApps = authorApplications.filter(a => a.status === 'pending');

  return (
    <div className="space-y-8 animate-in fade-in duration-500 text-left">
      
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">User Directory & Auditing</h2>
          <p className="text-slate-550 font-bold text-xs mt-1">Audit onboarding credentials, inspect learning histories, reset access security, and simulate users.</p>
        </div>
        <Button onClick={fetchData} variant="outline" className="h-11 rounded-xl bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm flex items-center gap-2">
          <RefreshCcw size={14} className="text-green-600" /> Refresh Node
        </Button>
      </div>

      {/* ── Tabs Navigation ── */}
      <div className="flex gap-4 border-b border-slate-200 pb-2">
        {([
          { key: 'mentors', label: '🧑‍🏫 Mentors' },
          { key: 'mentees', label: '🎓 Mentees' },
          { key: 'dual', label: '🔄 Dual Users' },
          { key: 'authors', label: '📖 Authors' },
          { key: 'suspended', label: '🚫 Suspended' },
          { key: 'applications', label: '⏳ Pending Approvals' }
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setSelectedProfile(null); setSelectedApp(null); setSelectedAuthorApp(null); }}
            className={`px-4 py-2.5 rounded-t-xl font-bold text-xs tracking-wider uppercase transition-all flex items-center gap-2 ${
              activeTab === tab.key
                ? 'text-green-700 border-b-4 border-green-600 bg-green-50/40'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {tab.label}
            {tab.key === 'applications' && (pendingApps.length + pendingAuthorApps.length) > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-green-600 text-white animate-pulse">
                {pendingApps.length + pendingAuthorApps.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Grid Layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* ── Left Column: Registry List ── */}
        <div className="lg:col-span-2 space-y-6">
          
          {activeTab !== 'applications' ? (
            <div className="space-y-4">
              
              {/* Directory Filter controls */}
              <div className="flex gap-4 items-center justify-between">
                <h3 className="text-xs font-black text-slate-550 uppercase tracking-widest">User Directory Registry ({currentProfileList.length})</h3>
                
                <div className="relative w-64">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search name, email, or UUID..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full bg-white border border-slate-200 text-xs font-bold pl-9 pr-3 py-2 rounded-xl text-slate-850 outline-none focus:ring-2 focus:ring-green-550/10 shadow-sm"
                  />
                </div>
              </div>

              {/* Profiles list */}
              {loading ? (
                <Card className="p-12 text-center border-slate-200 bg-white">
                  <p className="text-slate-400 font-bold uppercase text-xs">Loading profile catalog...</p>
                </Card>
              ) : currentProfileList.length === 0 ? (
                <Card className="p-12 text-center border-slate-200 bg-white rounded-2xl shadow-sm">
                  <Users size={40} className="text-slate-300 mx-auto mb-4" />
                  <h4 className="font-extrabold text-slate-700 text-base">No Users Found</h4>
                  <p className="text-xs text-slate-400 mt-1">No profiles matched the active classification tab.</p>
                </Card>
              ) : (
                <div className="space-y-2">
                  {currentProfileList.map(p => {
                    const isSelected = selectedUserIds.includes(p.id);
                    const isSuspended = p.metadata?.suspended === true;
                    return (
                      <Card
                        key={p.id}
                        className={`p-4 bg-white border hover:border-indigo-300 transition-all rounded-2xl flex gap-4 shadow-sm items-center ${
                          selectedProfile?.id === p.id ? 'ring-2 ring-indigo-600 border-transparent bg-indigo-50/5' : 'border-slate-200/60'
                        } ${isSuspended ? 'border-red-200 bg-red-50/5' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedUserIds(prev => [...prev, p.id]);
                            } else {
                              setSelectedUserIds(prev => prev.filter(id => id !== p.id));
                            }
                          }}
                          className="w-4 h-4 text-indigo-650 border-slate-300 rounded focus:ring-indigo-550/20 cursor-pointer"
                        />
                        <div 
                          onClick={() => handleSelectProfile(p)}
                          className="flex gap-4 items-center flex-1 cursor-pointer min-w-0"
                        >
                          <img 
                            src={p.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.id}`} 
                            className="w-11 h-11 rounded-xl object-cover bg-slate-100 border border-slate-200" 
                            alt="Avatar" 
                          />
                          <div className="min-w-0 flex-1">
                            <h4 className="font-extrabold text-sm text-slate-900 truncate">{p.full_name}</h4>
                            <p className="text-[10px] text-slate-550 font-bold truncate mt-0.5">{p.email}</p>
                            <div className="flex gap-2 mt-2">
                              <span className="px-1.5 py-0.2 rounded bg-slate-100 border border-slate-200 text-[8px] font-black text-slate-500 uppercase tracking-widest">{p.role}</span>
                              {isSuspended && <span className="px-1.5 py-0.2 rounded bg-red-50 border border-red-200 text-[8px] font-black text-red-700 uppercase">Suspended</span>}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="block text-[8px] font-black text-slate-450 uppercase">Completion</span>
                            <span className="text-xs font-black text-slate-800">{getProfileCompletion(p)}%</span>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}

              {/* Bulk actions */}
              {selectedUserIds.length > 0 && (
                <Card className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-4 shadow-inner">
                  <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                    <span className="text-xs font-black text-slate-700 uppercase">{selectedUserIds.length} Users Selected</span>
                    <Button onClick={handleExportCSV} className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[10px] py-1 font-bold rounded-lg shadow-sm flex items-center gap-1">
                      <Download size={11} /> Export Selected to CSV
                    </Button>
                  </div>
                  <div className="flex flex-col md:flex-row gap-4 justify-between items-end">
                    <div className="flex-1 w-full text-left">
                      <input
                        type="text"
                        placeholder="Broadcast message text..."
                        value={bulkMessageText}
                        onChange={e => setBulkMessageText(e.target.value)}
                        className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 outline-none w-full shadow-sm"
                      />
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button onClick={handleBulkMessage} disabled={!bulkMessageText.trim()} className="bg-indigo-650 hover:bg-indigo-700 text-white text-[10px] py-2 font-black uppercase rounded-lg border-none shadow-sm flex items-center gap-1">
                        <Mail size={12} /> Message Selected
                      </Button>
                      <Button onClick={handleBulkSuspend} className="bg-red-650 hover:bg-red-750 text-white text-[10px] py-2 font-black uppercase rounded-lg border-none shadow-sm flex items-center gap-1">
                        <Slash size={12} /> Suspend Selected
                      </Button>
                    </div>
                  </div>
                </Card>
              )}

            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-black text-slate-550 uppercase tracking-widest">
                  Pending Onboarding Queue ({pendingApps.length + pendingAuthorApps.length})
                </h3>
              </div>

              {/* Sub-tabs selection */}
              <div className="flex gap-2 mb-4 bg-slate-100 p-1 rounded-xl w-fit">
                <button
                  onClick={() => { setSubApplicationsTab('mentor'); setSelectedAuthorApp(null); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    subApplicationsTab === 'mentor' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Mentor Apps ({pendingApps.length})
                </button>
                <button
                  onClick={() => { setSubApplicationsTab('author'); setSelectedApp(null); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    subApplicationsTab === 'author' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Author Apps ({pendingAuthorApps.length})
                </button>
              </div>

              {subApplicationsTab === 'mentor' ? (
                pendingApps.length === 0 ? (
                  <Card className="p-12 text-center border-slate-200 bg-white rounded-2xl shadow-sm">
                    <CheckCircle2 size={40} className="text-emerald-500 mx-auto mb-4 animate-bounce" />
                    <h4 className="font-extrabold text-slate-850 text-base">Mentor Queue Clear</h4>
                    <p className="text-xs text-slate-500 mt-1">There are no pending mentor applications.</p>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {pendingApps.map(app => (
                      <Card
                        key={app.id}
                        onClick={() => handleSelectApp(app)}
                        className={`p-4 bg-white border hover:border-green-300 transition-all rounded-2xl cursor-pointer text-left flex gap-4 shadow-sm ${
                          selectedApp?.id === app.id ? 'ring-2 ring-green-600 border-transparent bg-green-50/10' : 'border-slate-200/60'
                        }`}
                      >
                        <img 
                          src={app.applicant_avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${app.user_id}`} 
                          className="w-14 h-14 rounded-2xl object-cover bg-slate-100 border border-slate-200 shadow-sm" 
                          alt="Avatar" 
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex justify-between items-start">
                            <h4 className="font-extrabold text-sm text-slate-900 truncate">{app.applicant_name}</h4>
                            <span className="text-[9px] text-slate-400 font-mono shrink-0">
                              {formatDistanceToNow(new Date(app.submitted_at), { addSuffix: true })}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 font-bold truncate mt-1">Qualifications: {app.qualifications || 'No credentials uploaded'}</p>
                          <div className="flex gap-2 mt-3">
                            <span className="px-2 py-0.5 rounded bg-green-50 border border-green-200 text-[9px] font-black text-green-700 uppercase tracking-wider">Verification Audit Queue</span>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )
              ) : (
                pendingAuthorApps.length === 0 ? (
                  <Card className="p-12 text-center border-slate-200 bg-white rounded-2xl shadow-sm">
                    <CheckCircle2 size={40} className="text-emerald-500 mx-auto mb-4 animate-bounce" />
                    <h4 className="font-extrabold text-slate-850 text-base">Author Queue Clear</h4>
                    <p className="text-xs text-slate-500 mt-1">There are no pending author applications.</p>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {pendingAuthorApps.map(app => (
                      <Card
                        key={app.id}
                        onClick={() => handleSelectAuthorApp(app)}
                        className={`p-4 bg-white border hover:border-green-300 transition-all rounded-2xl cursor-pointer text-left flex gap-4 shadow-sm ${
                          selectedAuthorApp?.id === app.id ? 'ring-2 ring-green-600 border-transparent bg-green-50/10' : 'border-slate-200/60'
                        }`}
                      >
                        <img 
                          src={app.applicant_avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${app.user_id}`} 
                          className="w-14 h-14 rounded-2xl object-cover bg-slate-100 border border-slate-200 shadow-sm" 
                          alt="Avatar" 
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex justify-between items-start">
                            <h4 className="font-extrabold text-sm text-slate-900 truncate">{app.applicant_name}</h4>
                            <span className="text-[9px] text-slate-400 font-mono shrink-0">
                              {app.submitted_at ? formatDistanceToNow(new Date(app.submitted_at), { addSuffix: true }) : 'Recently'}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-550 font-bold truncate mt-1">Category: {app.category || 'General'}</p>
                          <p className="text-[10px] text-slate-500 font-semibold truncate">Email: {app.applicant_email}</p>
                          <div className="flex gap-2 mt-2">
                            <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-[9px] font-black text-emerald-700 uppercase tracking-wider">Author Registry Queue</span>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )
              )}
            </div>
          )}

        </div>

        {/* ── Right Column: Detail Inspection Panel ── */}
        <div className="space-y-6">
          <Card className="bg-white border border-slate-200/80 p-6 rounded-3xl sticky top-8 shadow-sm flex flex-col min-h-[480px]">
            {selectedProfile ? (
              <div className="space-y-5 flex-1 flex flex-col justify-between text-left">
                <div className="space-y-4 flex-1 flex flex-col">
                  
                  {/* Profile Header */}
                  <div className="flex gap-4">
                    <img 
                      src={selectedProfile.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedProfile.id}`} 
                      className="w-16 h-16 rounded-xl object-cover bg-slate-100 border border-slate-200 shadow-sm" 
                      alt="Avatar" 
                    />
                    <div>
                      <span className="text-[9px] font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200/60 uppercase">User Node</span>
                      <h4 className="font-extrabold text-base text-slate-900 mt-2 leading-snug">{selectedProfile.full_name}</h4>
                      <p className="text-[10px] text-slate-450 font-semibold mt-0.5">UUID: {selectedProfile.id}</p>
                    </div>
                  </div>

                  <hr className="border-slate-100" />

                  {/* Profile Statistics metrics */}
                  <div className="grid grid-cols-2 gap-3 text-center text-xs">
                    <div className="p-3 border border-slate-200 bg-slate-50 rounded-xl shadow-sm">
                      <span className="block text-[8px] font-black text-slate-450 uppercase">Taught / Enrolled</span>
                      <span className="text-sm font-black text-slate-800">{getTaughtCount(selectedProfile.id)} / {getEnrolledCount(selectedProfile.id)}</span>
                    </div>
                    <div className="p-3 border border-slate-200 bg-slate-50 rounded-xl shadow-sm">
                      <span className="block text-[8px] font-black text-slate-450 uppercase">Books Authored</span>
                      <span className="text-sm font-black text-slate-800">{getPublishedBooksCount(selectedProfile.id)}</span>
                    </div>
                    <div className="p-3 border border-slate-200 bg-slate-50 rounded-xl shadow-sm col-span-2">
                      <span className="block text-[8px] font-black text-slate-450 uppercase">ID Verification Status</span>
                      <span className="text-sm font-extrabold text-slate-800 flex items-center justify-center gap-1">
                        {selectedProfile.metadata?.id_verified ? <ShieldCheck size={14} className="text-emerald-500" /> : <AlertCircle size={14} className="text-amber-500" />}
                        {selectedProfile.metadata?.id_verified ? 'Verified ID Match' : 'Unverified Identity'}
                      </span>
                    </div>
                  </div>

                  {/* Interactive DM Box */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl shadow-inner space-y-2 flex-1 flex flex-col justify-between">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider">In-App Chat Log</p>
                    
                    <div className="flex-1 overflow-y-auto max-h-32 p-2 bg-white rounded-xl border border-slate-150 space-y-2 text-[10px]">
                      {dmHistory.length === 0 ? (
                        <span className="text-slate-400 italic block text-center mt-2">No messages exchanged.</span>
                      ) : (
                        dmHistory.map((msg, idx) => {
                          const isMe = msg.sender_id === currentUser?.id;
                          return (
                            <div key={idx} className={`p-2 rounded-lg border max-w-[85%] ${isMe ? 'bg-indigo-50 border-indigo-100 ml-auto text-indigo-950 font-bold' : 'bg-slate-50 border-slate-200 text-slate-800'}`}>
                              <p className="break-words">{msg.content}</p>
                            </div>
                          );
                        })
                      )}
                    </div>

                    <div className="flex gap-1">
                      <input
                        type="text"
                        placeholder="Type direct message..."
                        value={dmInputText}
                        onChange={e => setDmInputText(e.target.value)}
                        className="flex-1 bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800 outline-none"
                      />
                      <button onClick={handleSendDm} className="p-2 bg-indigo-650 hover:bg-indigo-700 text-white rounded-lg"><Send size={12} /></button>
                    </div>
                  </div>

                  {/* Password reset action */}
                  <div className="flex gap-2">
                    <Button
                      onClick={handleResetPassword}
                      className="flex-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-[10px] py-2.5 font-bold rounded-xl shadow-sm flex items-center justify-center gap-1.5"
                    >
                      <Lock size={12} className="text-indigo-600" /> Reset Password
                    </Button>
                    <Button
                      onClick={() => setImpersonatingUser(selectedProfile)}
                      className="flex-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-[10px] py-2.5 font-bold rounded-xl shadow-sm flex items-center justify-center gap-1.5"
                    >
                      <Eye size={12} className="text-green-600" /> Impersonate View
                    </Button>
                  </div>

                  {/* User Audit Log viewer */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-slate-550 uppercase tracking-widest flex items-center gap-1"><Activity size={12} className="text-indigo-600" /> User Audit Trail</p>
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl max-h-24 overflow-y-auto space-y-1 text-[9px] font-mono text-slate-500">
                      {auditLogs.filter(log => log.target_id === selectedProfile.id || log.admin_id === selectedProfile.id).length === 0 ? (
                        <span>No audit log records for this user node.</span>
                      ) : (
                        auditLogs.filter(log => log.target_id === selectedProfile.id || log.admin_id === selectedProfile.id).map(log => (
                          <div key={log.id} className="pb-1 border-b border-slate-200">
                            [{formatDate(log.created_at)}] {log.action_type.toUpperCase()} - {log.reason}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Account Restriction settings */}
                  {selectedProfile.metadata?.suspended ? (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl space-y-1 text-xs text-red-700 leading-relaxed font-bold">
                      <span>Reason: {selectedProfile.metadata.suspension_reason}</span>
                    </div>
                  ) : (
                    <textarea
                      placeholder="Reason for suspension..."
                      value={suspensionReason}
                      onChange={e => setSuspensionReason(e.target.value)}
                      className="bg-white border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 outline-none w-full min-h-[44px]"
                    />
                  )}

                </div>

                {/* Suspension Toggle action */}
                <div className="pt-4 border-t border-slate-100 mt-auto">
                  {selectedProfile.metadata?.suspended ? (
                    <Button
                      onClick={() => handleToggleSuspension(selectedProfile.id, false)}
                      disabled={submitting}
                      className="w-full h-12 rounded-xl bg-green-600 hover:bg-green-700 text-white font-black uppercase border-none shadow-sm flex items-center justify-center gap-1.5"
                    >
                      <ShieldCheck size={15} /> Reactivate Account Access
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handleToggleSuspension(selectedProfile.id, true)}
                      disabled={submitting || !suspensionReason.trim()}
                      className="w-full h-12 rounded-xl bg-red-600 hover:bg-red-750 text-white font-black uppercase border-none shadow-sm flex items-center justify-center gap-1.5"
                    >
                      <Slash size={15} /> Suspend Account Access
                    </Button>
                  )}
                </div>

              </div>
            ) : selectedApp ? (
              <div className="space-y-6 flex-1 flex flex-col justify-between text-left">
                <div className="space-y-5">
                  <div className="flex gap-4">
                    <img 
                      src={selectedApp.applicant_avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedApp.user_id}`} 
                      className="w-16 h-16 rounded-xl object-cover bg-slate-100 border border-slate-200 shadow-sm" 
                      alt="Avatar" 
                    />
                    <div>
                      <span className="text-[9px] font-black text-emerald-700 uppercase bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60">Audit Profile</span>
                      <h4 className="font-extrabold text-base text-slate-900 mt-2 leading-snug">{selectedApp.applicant_name}</h4>
                      <p className="text-[10px] text-slate-450 font-bold mt-1">Applicant ID: {selectedApp.user_id}</p>
                    </div>
                  </div>

                  <hr className="border-slate-100" />

                  {/* Intro video check */}
                  {selectedApp.video_url && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                        <Video size={13} className="text-green-600" /> Intro Video Player
                      </p>
                      <div className="relative aspect-video rounded-2xl overflow-hidden bg-slate-950 border border-slate-200 shadow-sm">
                        <video src={selectedApp.video_url} controls className="w-full h-full object-cover" />
                      </div>
                    </div>
                  )}

                  {/* Qualifications */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                      <FileText size={13} className="text-green-600" /> Credentials Uploaded
                    </p>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/60 text-xs text-slate-700 font-semibold leading-relaxed max-h-36 overflow-y-auto shadow-inner">
                      {selectedApp.qualifications || 'No qualifications stated.'}
                    </div>
                  </div>

                  {/* Checklist */}
                  <div className="space-y-3">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                      <CheckSquare size={13} /> Onboarding Checklist
                    </p>
                    <div className="space-y-2">
                      {[
                        { key: 'checklist_profile_completeness', label: 'Stellar profile avatar & bio summary' },
                        { key: 'checklist_id_verification', label: 'Government ID verification document match' },
                        { key: 'checklist_qualifications', label: 'Accreditation credentials audited' },
                        { key: 'checklist_intro_video', label: 'Sample intro video clear and professional' },
                      ].map(item => (
                        <label key={item.key} className="flex items-start gap-3 cursor-pointer group py-0.5">
                          <input 
                            type="checkbox"
                            checked={(mentorChecklist as any)[item.key]}
                            onChange={e => setMentorChecklist(prev => ({ ...prev, [item.key]: e.target.checked }))}
                            className="w-4 h-4 bg-white border-slate-300 text-green-600 rounded focus:ring-green-550/20 mt-0.5 cursor-pointer"
                          />
                          <span className="text-xs text-slate-600 group-hover:text-slate-900 transition-colors font-semibold">{item.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Rejection / Needs Info Notes */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      Action Notes / Rejection Justification
                    </label>
                    <textarea
                      placeholder="Input justification for decision. Detailed instructions are required for rejected or needs_info states..."
                      value={rejectionReason}
                      onChange={e => setRejectionReason(e.target.value)}
                      className="w-full bg-white border border-slate-200 text-xs rounded-xl p-3 text-slate-800 outline-none focus:ring-2 focus:ring-green-550/10 min-h-[80px]"
                    />
                  </div>
                </div>

                {/* Decision controls */}
                <div className="flex flex-col gap-2 pt-4 border-t border-slate-100 mt-auto">
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      onClick={() => submitMentorReview('approved')}
                      disabled={submitting}
                      className="h-11 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold border-none flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <ShieldCheck size={14} /> Approve Mentor
                    </Button>
                    <Button
                      onClick={() => submitMentorReview('needs_info')}
                      disabled={submitting}
                      className="h-11 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-250/60 text-amber-700 font-bold flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <RefreshCcw size={14} /> Needs Info
                    </Button>
                  </div>
                  <Button
                    onClick={() => submitMentorReview('rejected')}
                    disabled={submitting}
                    className="h-11 rounded-xl bg-red-50 hover:bg-red-100 border border-red-250/60 text-red-700 font-bold flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <Slash size={14} /> Reject Application
                  </Button>
                </div>
              </div>
            ) : selectedAuthorApp ? (
              <div className="space-y-6 flex-1 flex flex-col justify-between text-left">
                <div className="space-y-5">
                  <div className="flex gap-4">
                    <img 
                      src={selectedAuthorApp.applicant_avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedAuthorApp.user_id}`} 
                      className="w-16 h-16 rounded-xl object-cover bg-slate-100 border border-slate-200 shadow-sm" 
                      alt="Avatar" 
                    />
                    <div>
                      <span className="text-[9px] font-black text-emerald-700 uppercase bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60">Audit Author</span>
                      <h4 className="font-extrabold text-base text-slate-900 mt-2 leading-snug">{selectedAuthorApp.applicant_name}</h4>
                      <p className="text-[10px] text-slate-450 font-bold mt-1">Applicant ID: {selectedAuthorApp.user_id}</p>
                    </div>
                  </div>

                  <hr className="border-slate-100" />

                  {/* Author Pen Name & Category details */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                    <div>
                      <span className="block text-[8px] font-black text-slate-450 uppercase tracking-widest">Intended Pen Name</span>
                      <span className="text-sm font-bold text-slate-800">{selectedAuthorApp.pen_name}</span>
                    </div>
                    <div>
                      <span className="block text-[8px] font-black text-slate-450 uppercase tracking-widest">Publishing Category</span>
                      <span className="text-sm font-bold text-slate-800">{selectedAuthorApp.category}</span>
                    </div>
                  </div>

                  {/* Rejection / Needs Info Notes */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      Action Notes / Rejection Justification
                    </label>
                    <textarea
                      placeholder="Input justification for decision. Detailed instructions are required for rejected or needs_info states..."
                      value={rejectionReason}
                      onChange={e => setRejectionReason(e.target.value)}
                      className="w-full bg-white border border-slate-200 text-xs rounded-xl p-3 text-slate-800 outline-none focus:ring-2 focus:ring-green-550/10 min-h-[80px]"
                    />
                  </div>
                </div>

                {/* Decision controls */}
                <div className="flex flex-col gap-2 pt-4 border-t border-slate-100 mt-auto">
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      onClick={() => submitAuthorReview('approved')}
                      disabled={submitting}
                      className="h-11 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold border-none flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <ShieldCheck size={14} /> Approve Author
                    </Button>
                    <Button
                      onClick={() => submitAuthorReview('needs_info')}
                      disabled={submitting}
                      className="h-11 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-250/60 text-amber-700 font-bold flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <RefreshCcw size={14} /> Needs Info
                    </Button>
                  </div>
                  <Button
                    onClick={() => submitAuthorReview('rejected')}
                    disabled={submitting}
                    className="h-11 rounded-xl bg-red-50 hover:bg-red-100 border border-red-250/60 text-red-700 font-bold flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <Slash size={14} /> Reject Application
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-4">
                <div className="w-16 h-16 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 shadow-sm text-xl font-bold">
                  👥
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-700 text-sm">User Audit Panel</h4>
                  <p className="text-xs text-slate-400 mt-1.5 max-w-[200px] mx-auto leading-relaxed">
                    Select a user registry profile or onboarding application from the list to audit settings or apply blocks.
                  </p>
                </div>
              </div>
            )}
          </Card>
        </div>

      </div>

      {/* ── Impersonate Simulation Overlay ── */}
      {impersonatingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
          <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl p-6 text-left space-y-6">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-500 text-white animate-pulse">Platform impersonator Mode</span>
                <h4 className="font-black text-xl text-white mt-1">Viewing Environment as: {impersonatingUser.full_name}</h4>
              </div>
              <button onClick={() => setImpersonatingUser(null)} className="px-4 py-2 bg-slate-800 text-white font-bold text-xs rounded-xl hover:bg-slate-700 transition-all">✕ Close Session</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Profile card preview */}
              <div className="p-5 bg-slate-950 border border-slate-850 rounded-2xl space-y-4 text-center">
                <img 
                  src={impersonatingUser.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${impersonatingUser.id}`} 
                  className="w-20 h-20 rounded-full mx-auto border border-slate-800 bg-slate-900" 
                  alt="avatar" 
                />
                <div>
                  <h5 className="font-extrabold text-sm text-white">{impersonatingUser.full_name}</h5>
                  <p className="text-[10px] text-slate-500 font-bold">{impersonatingUser.email}</p>
                </div>
                <div className="p-3 bg-slate-900 border border-slate-850 rounded-xl text-xs space-y-2">
                  <div className="flex justify-between text-slate-400">
                    <span>Role Permissions:</span>
                    <span className="text-white font-bold uppercase">{impersonatingUser.role}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>ID verified:</span>
                    <span className="text-emerald-400 font-bold">{impersonatingUser.metadata?.id_verified ? 'Yes' : 'No'}</span>
                  </div>
                </div>
              </div>

              {/* Troubleshooting mock dashboard */}
              <div className="p-5 bg-slate-950 border border-slate-850 rounded-2xl md:col-span-2 space-y-4">
                <h5 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Activity size={14} className="text-rose-500 animate-pulse" /> Live Troubleshooting Diagnostics</h5>
                
                <div className="space-y-3 text-xs leading-relaxed text-slate-300">
                  <div className="p-3 bg-slate-900 border border-slate-850 rounded-xl space-y-1">
                    <p className="font-bold text-white">1. Enrolled Courses Staging Node</p>
                    <p className="text-slate-500 text-[10px]">Loaded {getEnrolledCount(impersonatingUser.id)} enrollments. DB read latency: 12ms. RLS filter verified.</p>
                  </div>
                  <div className="p-3 bg-slate-900 border border-slate-850 rounded-xl space-y-1">
                    <p className="font-bold text-white">2. Wallet Ledger Node</p>
                    <p className="text-slate-500 text-[10px]">Available balance check: OK. Deposit address checked. No locked payments.</p>
                  </div>
                  <div className="p-3 bg-slate-900 border border-slate-850 rounded-xl space-y-1">
                    <p className="font-bold text-white">3. Platform Communication Node</p>
                    <p className="text-slate-500 text-[10px]">Connected to websocket server. Active socket ID: ws_sim_88192.</p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default UserManagerDashboard;
