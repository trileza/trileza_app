import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { adminService } from '../../lib/services/admin';
import type { MentorApplication } from '../../types/admin';
import { nexus } from '../../lib/nexus';
import { Card, Button, Toast } from '../ui';
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
  UserCheck,
  X,
  ExternalLink,
  Trash2
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { formatDate } from '../../utils';
import PageHeader from '../shared/PageHeader';
import StatusTabs from './shared/StatusTabs';
import Pagination from './shared/Pagination';
import ExportToolbar from './shared/ExportToolbar';
import FileViewer from './shared/FileViewer';
import UserProfileModal from './shared/UserProfileModal';
import ConfirmDialog from './shared/ConfirmDialog';
import { useDebouncedValue, usePaginatedList, useMultiTableSync } from './hooks/useAdminData';
import { exportToExcel, exportToCSV, USER_EXPORT_COLUMNS } from './hooks/useExport';
import { generateProfilePDF } from './hooks/usePrintableProfile';

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

  // Advanced filters & sorting
  const [filterRole, setFilterRole] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [filterJoinDate, setFilterJoinDate] = useState<string>('All');
  const [sortBy, setSortBy] = useState<string>('date_desc');
  const [adminUsers, setAdminUsers] = useState<Record<string, string>>({});

  // Selected item state
  const [selectedApp, setSelectedApp] = useState<MentorApplication | null>(null);
  const [selectedAuthorApp, setSelectedAuthorApp] = useState<any | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<any | null>(null);
  const [selectedAppProfile, setSelectedAppProfile] = useState<any | null>(null);
  const [viewingAppRecords, setViewingAppRecords] = useState<any | null>(null);
  const [previewingDoc, setPreviewingDoc] = useState<{ name: string; url?: string } | null>(null);

  // Messages / conversation history
  const [dmHistory, setDmHistory] = useState<any[]>([]);
  const [dmInputText, setDmInputText] = useState('');

  // Simulator overlays
  const [impersonatingUser, setImpersonatingUser] = useState<any | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);

  // Bulk actions selection states
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [bulkMessageText, setBulkMessageText] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Reset page when any filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchQuery, filterRole, filterStatus, filterJoinDate, sortBy]);

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

  const [toast, setToast] = useState<{ message: string; type?: 'success' | 'error' | 'info' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
  };

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    variant: 'danger' | 'warning' | 'info';
    action: () => Promise<void>;
  }>({ open: false, title: '', message: '', confirmLabel: 'Confirm', variant: 'danger', action: async () => {} });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [apps, authorApps, profsRes, coursesRes, booksRes, enrollRes, auditRes, adminsRes] = await Promise.all([
        adminService.getMentorApplications(),
        adminService.getAuthorApplications(),
        nexus.database.from('profiles').select('*').order('created_at', { ascending: false }),
        nexus.database.from('courses').select('*'),
        nexus.database.from('books').select('*'),
        nexus.database.from('enrollments').select('*'),
        nexus.database.from('admin_audit_logs').select('*').order('created_at', { ascending: false }),
        nexus.database.from('admin_users').select('*')
      ]);
      setApplications(apps);
      setAuthorApplications(authorApps);
      setProfiles(profsRes.data || []);
      setCourses(coursesRes.data || []);
      setBooks(booksRes.data || []);
      setEnrollments(enrollRes.data || []);
      setAuditLogs(auditRes.data || []);

      const adminRoleMap: Record<string, string> = {};
      adminsRes.data?.forEach((a: any) => {
        adminRoleMap[a.id] = a.role;
      });
      setAdminUsers(adminRoleMap);
    } catch (err) {
      console.error('[UM Fetch Error]:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  // Realtime subscription sync
  useMultiTableSync(
    ['profiles', 'mentor_applications', 'author_applications', 'courses', 'books', 'enrollments', 'admin_audit_logs'],
    fetchData
  );

  const handleSelectApp = async (app: MentorApplication) => {
    setSelectedApp(app);
    setSelectedAuthorApp(null);
    setSelectedProfile(null);
    setSelectedAppProfile(null);
    setMentorChecklist({
      checklist_profile_completeness: app.checklist_profile_completeness,
      checklist_id_verification: app.checklist_id_verification,
      checklist_qualifications: app.checklist_qualifications,
      checklist_intro_video: app.checklist_intro_video
    });
    setRejectionReason(app.rejection_reason || '');

    try {
      const { data, error } = await nexus.database
        .from('profiles')
        .select('*')
        .eq('id', app.user_id)
        .maybeSingle();
      if (!error && data) {
        setSelectedAppProfile(data);
      }
    } catch (err) {
      console.error('[Fetch App Profile Error]:', err);
    }
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
      showToast(`Mentor application successfully marked as ${status}!`, 'success');
    } catch (err) {
      showToast('Failed to submit application decision: ' + err, 'error');
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
      showToast(`Author application successfully marked as ${status}!`, 'success');
    } catch (err) {
      showToast('Failed to submit application decision: ' + err, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleSuspension = async (profileId: string, suspend: boolean) => {
    if (!currentUser?.id) return;
    if (suspend && !suspensionReason.trim()) {
      showToast('Please state a reason for suspending this account.', 'info');
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
      showToast(suspend ? 'User account suspended!' : 'User account reactivated!', 'success');
    } catch (err) {
      showToast('Failed to update suspension status: ' + err, 'error');
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
      showToast('Failed to send DM: ' + err, 'error');
    }
  };

  const handleResetPassword = () => {
    if (!selectedProfile) return;
    const tempPass = Math.random().toString(36).slice(-8).toUpperCase() + '@2026';
    setGeneratedPassword(tempPass);
    showToast(`Reset link dispatched! Temporary bypass credential generated: ${tempPass}`, 'success');
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
      showToast('Selected users suspended successfully!', 'success');
    } catch (err) {
      showToast('Bulk suspension failed: ' + err, 'error');
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
      showToast('Bulk direct messages dispatched successfully!', 'success');
    } catch (err) {
      showToast('Bulk messaging failed: ' + err, 'error');
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

  const handleDeleteUser = (p: any) => {
    setConfirmDialog({
      open: true,
      title: 'Delete User Profile',
      message: `Permanently delete user "${p.full_name}" and all associated applications, enrollments, and admin accounts? This action cannot be undone.`,
      confirmLabel: 'Delete User',
      variant: 'danger',
      action: async () => {
        if (!currentUser?.id) return;
        setSubmitting(true);
        try {
          await adminService.deleteUser(p.id, currentUser.id);
          showToast(`User "${p.full_name}" deleted successfully.`, 'success');
          await fetchData();
        } catch (err) {
          showToast('Failed to delete user: ' + err, 'error');
        } finally {
          setSubmitting(false);
        }
      },
    });
  };

  const handlePrintMentorProfile = () => {
    if (!selectedApp) return;
    const applicantProfileData = selectedAppProfile || profiles.find(p => p.id === selectedApp.user_id);
    const meta = applicantProfileData?.metadata ? getParsedMetadata(applicantProfileData.metadata) : null;
    const credentialsList = meta?.pending_mentor_data?.qualifications?.credentials || [];
    
    generateProfilePDF({
      fullName: applicantProfileData?.full_name || selectedApp.applicant_name || 'Mentor Applicant',
      email: applicantProfileData?.email || '',
      role: 'mentor',
      country: applicantProfileData?.country,
      bio: applicantProfileData?.bio || meta?.pending_mentor_data?.bio,
      avatarUrl: applicantProfileData?.avatar_url || selectedApp.applicant_avatar,
      userId: selectedApp.user_id,
      joinDate: applicantProfileData?.created_at,
      applicationType: 'mentor',
      applicationStatus: selectedApp.status,
      qualifications: {
        education: meta?.pending_mentor_data?.qualifications?.education || selectedApp.qualifications,
        yearsExp: meta?.pending_mentor_data?.qualifications?.years_exp,
        skills: meta?.pending_mentor_data?.qualifications?.skills || [],
        motivation: meta?.pending_mentor_data?.qualifications?.motivation || selectedApp.qualifications
      },
      identity: meta?.pending_mentor_data?.identity ? {
        legalName: meta.pending_mentor_data.identity.legal_name,
        publicName: meta.pending_mentor_data.identity.public_name,
        dob: meta.pending_mentor_data.identity.dob,
        address: meta.pending_mentor_data.identity.address,
        linkedin: meta.pending_mentor_data.identity.socials?.linkedin,
        website: meta.pending_mentor_data.identity.socials?.website
      } : undefined,
      credentials: credentialsList,
      checklist: {
        checklist_profile_completeness: selectedApp.checklist_profile_completeness,
        checklist_id_verification: selectedApp.checklist_id_verification,
        checklist_qualifications: selectedApp.checklist_qualifications,
        checklist_intro_video: selectedApp.checklist_intro_video
      },
      reviewNotes: selectedApp.rejection_reason || ''
    });
  };

  const handlePrintAuthorProfile = () => {
    if (!selectedAuthorApp) return;
    const applicantProfileData = profiles.find(p => p.id === selectedAuthorApp.user_id);
    
    generateProfilePDF({
      fullName: selectedAuthorApp.applicant_name || 'Author Applicant',
      email: selectedAuthorApp.applicant_email || '',
      role: 'author',
      country: applicantProfileData?.country,
      bio: applicantProfileData?.bio,
      avatarUrl: selectedAuthorApp.applicant_avatar,
      userId: selectedAuthorApp.user_id,
      joinDate: applicantProfileData?.created_at,
      applicationType: 'author',
      applicationStatus: selectedAuthorApp.status,
      penName: selectedAuthorApp.pen_name,
      category: selectedAuthorApp.category,
      reviewNotes: selectedAuthorApp.rejection_reason || ''
    });
  };

  // Debounced search query
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);

  // Profile classification filters
  const currentProfileList = useMemo(() => {
    return profiles.filter(p => {
      const matchesSearch = 
        p.full_name?.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        p.email?.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        p.id?.toLowerCase().includes(debouncedSearchQuery.toLowerCase());

      if (!matchesSearch) return false;

      // 1. Role filter
      if (filterRole !== 'All') {
        if (filterRole === 'Mentee') {
          if (p.role !== 'student' && p.role !== 'mentee') return false;
        } else if (filterRole === 'Mentor') {
          if (p.role !== 'mentor' && p.role !== 'tutor') return false;
        } else if (filterRole === 'Author') {
          const isAuthor = p.role === 'author' || getPublishedBooksCount(p.id) > 0;
          if (!isAuthor) return false;
        } else if (filterRole === 'Admin') {
          const isAdmin = !!adminUsers[p.id];
          if (!isAdmin) return false;
        }
      } else {
        // Fallback to active tab quick filters
        const isSuspended = p.metadata?.suspended === true;
        const coursesCount = getTaughtCount(p.id);
        const enrollCount = getEnrolledCount(p.id);

        if (activeTab === 'mentors' && p.role !== 'mentor' && p.role !== 'tutor') return false;
        if (activeTab === 'mentees' && p.role !== 'student' && p.role !== 'mentee') return false;
        if (activeTab === 'dual' && !(coursesCount > 0 && enrollCount > 0)) return false;
        if (activeTab === 'authors' && p.role !== 'author' && getPublishedBooksCount(p.id) === 0) return false;
        if (activeTab === 'suspended' && !isSuspended) return false;
      }

      // 2. Status filter
      const isSuspended = p.metadata?.suspended === true;
      if (filterStatus === 'Active' && isSuspended) return false;
      if (filterStatus === 'Suspended' && !isSuspended) return false;

      // 3. Date joined filter
      if (filterJoinDate !== 'All') {
        const joinDate = new Date(p.created_at || Date.now());
        const limitDays = Number(filterJoinDate);
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - limitDays);
        if (joinDate < cutoff) return false;
      }

      return true;
    }).sort((a, b) => {
      // 4. Sorting
      if (sortBy === 'name_asc') {
        return (a.full_name || '').localeCompare(b.full_name || '');
      } else if (sortBy === 'name_desc') {
        return (b.full_name || '').localeCompare(a.full_name || '');
      } else if (sortBy === 'date_desc') {
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      } else if (sortBy === 'date_asc') {
        return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
      }
      return 0;
    });
  }, [profiles, debouncedSearchQuery, filterRole, filterStatus, filterJoinDate, sortBy, activeTab, adminUsers]);

  // Paginated List
  const profilesPagination = usePaginatedList(currentProfileList, itemsPerPage);

  const pendingApps = applications.filter(a => a.status !== 'approved');
  const pendingAuthorApps = authorApplications.filter(a => a.status !== 'approved');

  const applicantProfile = selectedAppProfile || (selectedApp ? profiles.find(p => p.id === selectedApp.user_id) : null);
  
  const getParsedMetadata = (metadata: any) => {
    if (!metadata) return null;
    if (typeof metadata === 'object') return metadata;
    try {
      return JSON.parse(metadata);
    } catch (e) {
      console.error('Failed to parse metadata:', e);
      return null;
    }
  };

  const parsedMetadata = applicantProfile?.metadata ? getParsedMetadata(applicantProfile.metadata) : ((selectedApp as any)?.metadata ? getParsedMetadata((selectedApp as any).metadata) : null);
  const applicantName = applicantProfile?.full_name || selectedApp?.applicant_name || 'Mentor Applicant';
  const applicantAvatar = applicantProfile?.avatar_url || selectedApp?.applicant_avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedApp?.user_id}`;

  const hasSelection = !!(selectedApp || selectedAuthorApp);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 text-left">
      
      {hasSelection ? (
        <>
          {selectedApp && (
            <PageHeader
              title={`Mentor Onboarding: ${applicantName}`}
              description="Evaluate background check credentials, resume submission, and make final review decisions."
              tag="Mentor Application"
              icon={Users}
              rightContent={
                <Button 
                  onClick={() => { setSelectedApp(null); setSelectedAppProfile(null); }}
                  variant="outline"
                  className="h-10 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs"
                >
                  ← Back to Queue
                </Button>
              }
            />
          )}
          {selectedAuthorApp && (
            <PageHeader
              title={`Author Onboarding: ${selectedAuthorApp.applicant_name}`}
              description="Audit author portfolio details and make final approval decisions."
              tag="Author Application"
              icon={Users}
              rightContent={
                <Button 
                  onClick={() => setSelectedAuthorApp(null)}
                  variant="outline"
                  className="h-10 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs"
                >
                  ← Back to Queue
                </Button>
              }
            />
          )}
        </>
      ) : (
        <>
          <PageHeader
            title="User Directory & Auditing"
            description="Audit onboarding credentials, inspect learning histories, reset access security, and simulate users."
            tag="Registry"
            icon={Users}
            rightContent={
              <Button onClick={fetchData} variant="outline" className="h-11 rounded-xl bg-white/15 hover:bg-white/20 border-white/20 text-white shadow-sm flex items-center gap-2 font-bold">
                <RefreshCcw size={14} className="text-emerald-450" /> Refresh data
              </Button>
            }
          />

          {/* ── Tabs Navigation ── */}
          <StatusTabs
            tabs={[
              { key: 'mentors', label: 'Mentors', icon: '🧑‍🏫' },
              { key: 'mentees', label: 'Mentees', icon: '🎓' },
              { key: 'dual', label: 'Dual Users', icon: '🔄' },
              { key: 'authors', label: 'Authors', icon: '📖' },
              { key: 'suspended', label: 'Suspended', icon: '🚫' },
              { key: 'applications', label: 'Pending Approvals', icon: '⏳', count: pendingApps.length + pendingAuthorApps.length }
            ]}
            activeTab={activeTab}
            onTabChange={(key: any) => {
              setActiveTab(key);
              setSelectedProfile(null);
              setSelectedApp(null);
              setSelectedAuthorApp(null);
            }}
          />
        </>
      )}

      <div className={hasSelection ? "grid grid-cols-1 lg:grid-cols-4 gap-8" : "w-full"}>
        
        {/* ── Left Column: Registry List or Detailed View ── */}
        <div className={hasSelection ? "lg:col-span-3 space-y-6" : "w-full space-y-6"}>
          
          {selectedApp ? (
            /* ── DETAILED MENTOR APPLICATION RECORD VIEW ── */
            <Card className="bg-white border border-slate-200/80 p-6 rounded-3xl shadow-sm text-left">
              {/* Header Action Row */}
              <div className="flex justify-between items-center mb-6 no-print">
                <Button 
                  onClick={() => { setSelectedApp(null); setSelectedAppProfile(null); }}
                  variant="outline"
                  className="h-10 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs flex items-center gap-2"
                >
                  ← Back to Queue
                </Button>
                <Button
                  onClick={handlePrintMentorProfile}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-350 rounded-xl px-4 py-2 text-xs font-bold shadow-sm flex items-center gap-1.5"
                >
                  🖨️ Print Details
                </Button>
              </div>

              {/* Profile Header */}
              <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start border-b border-slate-100 pb-6 mb-6">
                <img 
                  src={applicantAvatar} 
                  className="w-20 h-20 rounded-2xl object-cover bg-slate-100 border border-slate-200 shadow-md" 
                  alt="Avatar" 
                />
                <div className="text-center sm:text-left space-y-1">
                  <span className="text-[10px] font-black text-emerald-700 uppercase bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-250/55">Audit Profile</span>
                  <h4 className="font-extrabold text-xl text-slate-900 mt-2 leading-none">{applicantName}</h4>
                  <p className="text-xs text-slate-550 font-bold mt-1">Applicant ID: <span className="font-mono text-slate-650">{selectedApp.user_id}</span></p>
                </div>
              </div>

              {/* Intro Video Player (No-Print) */}
              {selectedApp.video_url && (
                <div className="space-y-3 mb-6 no-print">
                  <p className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                    <Video size={14} className="text-green-600" /> Intro Video Player
                  </p>
                  <div className="relative aspect-video max-w-2xl rounded-2xl overflow-hidden bg-slate-950 border border-slate-200 shadow-md">
                    <video src={selectedApp.video_url} controls className="w-full h-full object-cover" />
                  </div>
                </div>
              )}

              {/* Grid Content Layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                
                {/* Col 1: Identity & Demographics */}
                <div className="space-y-4">
                  <h5 className="font-black text-xs text-slate-550 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center gap-1.5">
                    <Users size={14} className="text-green-600" /> Identity & Contact details
                  </h5>
                  
                  {parsedMetadata?.pending_mentor_data?.identity ? (
                    <div className="space-y-3 text-xs text-slate-700 leading-relaxed font-bold">
                      <p><span className="text-slate-400">Legal Name:</span> {parsedMetadata.pending_mentor_data.identity.legal_name || applicantName}</p>
                      <p><span className="text-slate-400">Public Name:</span> {parsedMetadata.pending_mentor_data.identity.public_name || 'N/A'}</p>
                      <p><span className="text-slate-400">DOB:</span> {parsedMetadata.pending_mentor_data.identity.dob || 'N/A'}</p>
                      <p>
                        <span className="text-slate-400">Address:</span>{' '}
                        {parsedMetadata.pending_mentor_data.identity.address
                          ? `${parsedMetadata.pending_mentor_data.identity.address.street || ''}, ${parsedMetadata.pending_mentor_data.identity.address.city || ''}, ${parsedMetadata.pending_mentor_data.identity.address.country || ''}`
                          : 'N/A'}
                      </p>
                      <p>
                        <span className="text-slate-400">LinkedIn Profile:</span>{' '}
                        {parsedMetadata.pending_mentor_data.identity.socials?.linkedin ? (
                          <a 
                            href={parsedMetadata.pending_mentor_data.identity.socials.linkedin.startsWith('http') ? parsedMetadata.pending_mentor_data.identity.socials.linkedin : `https://${parsedMetadata.pending_mentor_data.identity.socials.linkedin}`}
                            target="_blank" 
                            rel="noreferrer"
                            className="text-indigo-650 hover:underline font-bold inline-flex items-center gap-1"
                          >
                            LinkedIn <ExternalLink size={12} />
                          </a>
                        ) : 'N/A'}
                      </p>
                      <p>
                        <span className="text-slate-400">Personal Website:</span>{' '}
                        {parsedMetadata.pending_mentor_data.identity.socials?.website ? (
                          <a 
                            href={parsedMetadata.pending_mentor_data.identity.socials.website.startsWith('http') ? parsedMetadata.pending_mentor_data.identity.socials.website : `https://${parsedMetadata.pending_mentor_data.identity.socials.website}`}
                            target="_blank" 
                            rel="noreferrer"
                            className="text-indigo-650 hover:underline font-bold inline-flex items-center gap-1"
                          >
                            Website <ExternalLink size={12} />
                          </a>
                        ) : 'N/A'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3 text-xs text-slate-700 leading-relaxed font-bold">
                      <p><span className="text-slate-400">Applicant Name:</span> {applicantName}</p>
                      <p><span className="text-slate-400">User ID:</span> {selectedApp.user_id}</p>
                      <p className="text-slate-400 italic font-medium">No structured identity object attached to this registration data.</p>
                    </div>
                  )}
                </div>

                {/* Col 2: Qualifications & Credential Lists */}
                <div className="space-y-4">
                  <h5 className="font-black text-xs text-slate-555 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center gap-1.5">
                    <FileText size={14} className="text-green-600" /> Education & Qualifications
                  </h5>
                  
                  {parsedMetadata?.pending_mentor_data?.qualifications ? (
                    <div className="space-y-3 text-xs text-slate-700 leading-relaxed font-bold">
                      <p><span className="text-slate-400">Highest Degree:</span> {parsedMetadata.pending_mentor_data.qualifications.education || 'N/A'}</p>
                      <p><span className="text-slate-400">Years Experience:</span> {parsedMetadata.pending_mentor_data.qualifications.years_exp || 'N/A'} years</p>
                      <p><span className="text-slate-400">Course Specialty / Skills:</span> {(parsedMetadata.pending_mentor_data.qualifications.skills || []).join(', ') || 'N/A'}</p>
                      <p><span className="text-slate-400">Motivation Statement:</span></p>
                      <p className="p-3 bg-slate-50 border border-slate-200/60 rounded-xl italic text-slate-600 font-semibold">
                        "{parsedMetadata.pending_mentor_data.qualifications.motivation || 'N/A'}"
                      </p>
                      
                      {parsedMetadata.pending_mentor_data.qualifications.credentials?.length > 0 && (
                        <div className="mt-4 text-left">
                          <strong className="text-slate-500 text-[10px] uppercase tracking-wider">Uploaded Audit Credentials:</strong>
                          <ul className="space-y-2 mt-2">
                            {parsedMetadata.pending_mentor_data.qualifications.credentials.map((cred: any, idx: number) => (
                              <li key={idx} className="flex items-center justify-between gap-3 p-2 bg-slate-50 border border-slate-200/60 rounded-xl">
                                <span className="font-bold text-slate-850 truncate max-w-[180px]" title={cred.value}>
                                  📄 {cred.value} <span className="text-[9px] text-slate-400 font-normal">({cred.type})</span>
                                </span>
                                <button 
                                  onClick={() => setPreviewingDoc({ name: cred.value, url: cred.url })}
                                  className="px-2.5 py-1 text-[10px] font-black text-indigo-650 bg-indigo-50 hover:bg-indigo-100 rounded-md border border-indigo-200 transition-colors shrink-0"
                                >
                                  🔍 View
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3 text-xs text-slate-700">
                      <p><strong>Qualifications & Statement:</strong></p>
                      <p className="p-3.5 bg-slate-50 border border-slate-200/60 rounded-xl font-bold leading-relaxed">
                        {selectedApp.qualifications || 'No qualifications stated.'}
                      </p>
                    </div>
                  )}
                </div>

              </div>
            </Card>
          ) : selectedAuthorApp ? (
            /* ── DETAILED AUTHOR APPLICATION RECORD VIEW ── */
            <Card className="bg-white border border-slate-200/80 p-6 rounded-3xl shadow-sm text-left">
              {/* Header Action Row */}
              <div className="flex justify-between items-center mb-6 no-print">
                <Button 
                  onClick={() => setSelectedAuthorApp(null)}
                  variant="outline"
                  className="h-10 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs flex items-center gap-2"
                >
                  ← Back to Queue
                </Button>
                <Button
                  onClick={handlePrintAuthorProfile}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-350 rounded-xl px-4 py-2 text-xs font-bold shadow-sm flex items-center gap-1.5"
                >
                  🖨️ Print Details
                </Button>
              </div>

              {/* Profile Header */}
              <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start border-b border-slate-100 pb-6 mb-6">
                <img 
                  src={selectedAuthorApp.applicant_avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedAuthorApp.user_id}`} 
                  className="w-20 h-20 rounded-2xl object-cover bg-slate-100 border border-slate-200 shadow-md" 
                  alt="Avatar" 
                />
                <div className="text-center sm:text-left space-y-1">
                  <span className="text-[10px] font-black text-emerald-700 uppercase bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-250/55">Audit Author</span>
                  <h4 className="font-extrabold text-xl text-slate-900 mt-2 leading-none">{selectedAuthorApp.applicant_name}</h4>
                  <p className="text-xs text-slate-550 font-bold mt-1">Applicant ID: <span className="font-mono text-slate-650">{selectedAuthorApp.user_id}</span></p>
                </div>
              </div>

              {/* Author Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-xs text-slate-700">
                <div className="space-y-4">
                  <h5 className="font-black text-xs text-slate-550 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center gap-1.5">
                    <Users size={14} className="text-emerald-600" /> Author Profile details
                  </h5>
                  <p><strong>Applicant Email:</strong> {selectedAuthorApp.applicant_email}</p>
                  <p><strong>Intended Pen Name:</strong> {selectedAuthorApp.pen_name || 'N/A'}</p>
                  <p><strong>Publishing Category:</strong> {selectedAuthorApp.category || 'N/A'}</p>
                  <p><strong>Submitted Date:</strong> {selectedAuthorApp.submitted_at ? formatDate(selectedAuthorApp.submitted_at) : 'Recently'}</p>
                </div>
                
                <div className="space-y-4">
                  <h5 className="font-black text-xs text-slate-550 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center gap-1.5">
                    <FileText size={14} className="text-emerald-650" /> Supporting Info & Uploads
                  </h5>
                  <p className="text-slate-450 italic font-semibold leading-relaxed">No additional verification document uploads attached to this author registry record.</p>
                </div>
              </div>
            </Card>
          ) : activeTab !== 'applications' ? (
            /* ── STANDARD DIRECTORY LIST VIEW ── */
            <div className="space-y-4 bg-slate-50 p-5 rounded-3xl border border-slate-200/80 shadow-sm text-left">
              <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest text-left w-full md:w-auto">User Registry ({currentProfileList.length})</h3>
                
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
                  <ExportToolbar
                    onExportExcel={() => exportToExcel(currentProfileList, USER_EXPORT_COLUMNS, 'trileza_user_registry')}
                    onExportCSV={() => exportToCSV(currentProfileList, USER_EXPORT_COLUMNS, 'trileza_user_registry')}
                    itemCount={currentProfileList.length}
                    label="users"
                  />
                  <div className="relative w-full md:w-80">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search name, email, or ID..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full bg-white border border-slate-200 text-xs font-bold pl-9 pr-3 py-2.5 rounded-xl text-slate-855 outline-none focus:ring-2 focus:ring-green-550/10 shadow-sm text-left"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 items-center pt-2 border-t border-slate-200/60">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-slate-450 uppercase">Role</span>
                  <select
                    value={filterRole}
                    onChange={e => setFilterRole(e.target.value)}
                    className="bg-white border border-slate-200 text-xs font-bold rounded-xl px-3 py-2 outline-none text-slate-700 focus:ring-2 focus:ring-green-550/10 shadow-sm"
                  >
                    <option value="All">All Roles</option>
                    <option value="Mentee">Mentees</option>
                    <option value="Mentor">Mentors</option>
                    <option value="Author">Authors</option>
                    <option value="Admin">Admins</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-slate-450 uppercase">Status</span>
                  <select
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value)}
                    className="bg-white border border-slate-200 text-xs font-bold rounded-xl px-3 py-2 outline-none text-slate-700 focus:ring-2 focus:ring-green-550/10 shadow-sm"
                  >
                    <option value="All">All Statuses</option>
                    <option value="Active">Active</option>
                    <option value="Suspended">Suspended</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-slate-455 uppercase">Date Joined</span>
                  <select
                    value={filterJoinDate}
                    onChange={e => setFilterJoinDate(e.target.value)}
                    className="bg-white border border-slate-200 text-xs font-bold rounded-xl px-3 py-2 outline-none text-slate-700 focus:ring-2 focus:ring-green-550/10 shadow-sm"
                  >
                    <option value="All">All Time</option>
                    <option value="7">Last 7 days</option>
                    <option value="30">Last 30 days</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 md:ml-auto">
                  <span className="text-[10px] font-black text-slate-450 uppercase">Sort By</span>
                  <select
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value)}
                    className="bg-white border border-slate-200 text-xs font-bold rounded-xl px-3 py-2 outline-none text-slate-700 focus:ring-2 focus:ring-green-550/10 shadow-sm"
                  >
                    <option value="name_asc">Name A-Z</option>
                    <option value="name_desc">Name Z-A</option>
                    <option value="date_desc">Join Date Newest</option>
                    <option value="date_asc">Join Date Oldest</option>
                  </select>
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
                  {profilesPagination.paginatedItems.map(p => {
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
                          <div className="text-right shrink-0 mr-2">
                            <span className="block text-[8px] font-black text-slate-450 uppercase">Completion</span>
                            <span className="text-xs font-black text-slate-800">{getProfileCompletion(p)}%</span>
                          </div>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteUser(p); }}
                          className="p-2 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 hover:text-red-700 transition-all active:scale-95 shrink-0"
                          title="Delete user profile"
                        >
                          <Trash2 size={14} />
                        </button>
                      </Card>
                    );
                  })}
                  
                  <Pagination
                    currentPage={profilesPagination.currentPage}
                    totalPages={profilesPagination.totalPages}
                    totalItems={profilesPagination.totalItems}
                    startIndex={profilesPagination.totalItems === 0 ? 0 : profilesPagination.startIndex}
                    endIndex={profilesPagination.endIndex}
                    onPageChange={profilesPagination.goToPage}
                    onNext={profilesPagination.nextPage}
                    onPrev={profilesPagination.prevPage}
                  />
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
            /* ── STANDARD APPLICATIONS QUEUE VIEW ── */
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-black text-slate-555 uppercase tracking-widest">
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
                    <p className="text-xs text-slate-550 mt-1">There are no pending mentor applications.</p>
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
                          <div className="flex flex-wrap gap-2 mt-3">
                            <span className="px-2 py-0.5 rounded bg-green-50 border border-green-200 text-[9px] font-black text-green-700 uppercase tracking-wider">Verification Audit Queue</span>
                            {app.status === 'pending' && (
                              <span className="px-2 py-0.5 rounded bg-green-50 border border-green-200 text-[9px] font-black text-green-700 uppercase tracking-wider">Pending</span>
                            )}
                            {app.status === 'needs_info' && (
                              <span className="px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-[9px] font-black text-amber-700 uppercase tracking-wider">Needs Info</span>
                            )}
                            {app.status === 'rejected' && (
                              <span className="px-2 py-0.5 rounded bg-rose-50 border border-rose-200 text-[9px] font-black text-rose-700 uppercase tracking-wider">Declined</span>
                            )}
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
                    <p className="text-xs text-slate-555 mt-1">There are no pending author applications.</p>
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
                          <p className="text-[10px] text-slate-550 font-semibold truncate">Email: {app.applicant_email}</p>
                          <div className="flex flex-wrap gap-2 mt-2">
                            <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-[9px] font-black text-emerald-700 uppercase tracking-wider">Author Registry Queue</span>
                            {app.status === 'pending' && (
                              <span className="px-2 py-0.5 rounded bg-green-50 border border-green-200 text-[9px] font-black text-green-700 uppercase tracking-wider">Pending</span>
                            )}
                            {app.status === 'needs_info' && (
                              <span className="px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-[9px] font-black text-amber-700 uppercase tracking-wider">Needs Info</span>
                            )}
                            {(app.status === 'rejected' || app.status === 'denied') && (
                              <span className="px-2 py-0.5 rounded bg-rose-50 border border-rose-200 text-[9px] font-black text-rose-700 uppercase tracking-wider">Declined</span>
                            )}
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

              {/* ── Right Column: Auditor Action Panel ── */}
      {hasSelection && (
        <div className="space-y-6">
          <Card className="bg-white border border-slate-200/80 p-6 rounded-3xl sticky top-8 shadow-sm flex flex-col min-h-[480px]">
            {selectedProfile && (
              /* ── AUDITOR ACTIONS FOR SELECTED PROFILE ── */
              <div className="space-y-5 flex-1 flex flex-col justify-between text-left bg-white p-2">
                <div className="space-y-4 flex-1 flex flex-col">
                  {/* Action Panel Title */}
                  <div>
                    <span className="text-[9px] font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200/60 uppercase">Auditor Actions</span>
                    <h4 className="font-extrabold text-sm text-slate-900 mt-1 leading-snug">Registry Actions: {selectedProfile.full_name}</h4>
                  </div>

                  <hr className="border-slate-100" />

                  {/* Interactive DM Box */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl shadow-inner space-y-2 flex-1 flex flex-col justify-between min-h-[160px]">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider">In-App Chat Log</p>
                    
                    <div className="flex-1 overflow-y-auto max-h-32 p-2 bg-white rounded-xl border border-slate-150 space-y-2 text-[10px]">
                      {dmHistory.length === 0 ? (
                        <span className="text-slate-400 italic block text-center mt-2">No messages exchanged.</span>
                      ) : (
                        dmHistory.map((msg, idx) => {
                          const isMe = msg.sender_id === currentUser?.id;
                          return (
                            <div key={idx} className={`p-2 rounded-lg border max-w-[85%] ${isMe ? 'bg-indigo-50 border-indigo-100 ml-auto text-indigo-950 font-bold' : 'bg-slate-50 border-slate-200 text-slate-850'}`}>
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
                        className="flex-1 bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800 outline-none font-bold"
                      />
                      <button onClick={handleSendDm} className="p-2 bg-indigo-650 hover:bg-indigo-700 text-white rounded-lg"><Send size={12} /></button>
                    </div>
                  </div>

                  {/* Password reset & Impersonation */}
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
                      <Eye size={12} className="text-green-600" /> Impersonate
                    </Button>
                  </div>

                  {/* Account Restriction settings */}
                  {selectedProfile.metadata?.suspended ? (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl space-y-1 text-xs text-red-700 leading-relaxed font-bold">
                      <span>Suspended: {selectedProfile.metadata.suspension_reason}</span>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-555 uppercase tracking-wider">Suspension Notes</label>
                      <textarea
                        placeholder="Input reason for suspending access..."
                        value={suspensionReason}
                        onChange={e => setSuspensionReason(e.target.value)}
                        className="bg-white border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 outline-none w-full min-h-[50px] font-bold"
                      />
                    </div>
                  )}

                </div>

                {/* Suspension Toggle action */}
                <div className="pt-4 border-t border-slate-100 mt-auto">
                  {selectedProfile.metadata?.suspended ? (
                    <Button
                      onClick={() => handleToggleSuspension(selectedProfile.id, false)}
                      disabled={submitting}
                      className="w-full h-11 rounded-xl bg-green-600 hover:bg-green-700 text-white font-black uppercase border-none shadow-sm flex items-center justify-center gap-1.5"
                    >
                      <ShieldCheck size={15} /> Reactivate Account
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handleToggleSuspension(selectedProfile.id, true)}
                      disabled={submitting || !suspensionReason.trim()}
                      className="w-full h-11 rounded-xl bg-red-600 hover:bg-red-750 text-white font-black uppercase border-none shadow-sm flex items-center justify-center gap-1.5"
                    >
                      <Slash size={15} /> Suspend Account
                    </Button>
                  )}
                </div>

              </div>
            )}

            {selectedApp && (
              /* ── AUDITOR ACTIONS FOR MENTOR APPLICATION ── */
              <div className="space-y-6 flex-1 flex flex-col justify-between text-left bg-white p-2">
                <div className="space-y-5">
                  <div>
                    <span className="text-[9px] font-black text-emerald-700 uppercase bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60">Auditor Panel</span>
                    <h4 className="font-extrabold text-sm text-slate-900 mt-1 leading-snug">Mentor App: {applicantName}</h4>
                  </div>

                  <hr className="border-slate-100" />

                  {/* Checklist */}
                  <div className="space-y-3">
                    <p className="text-[10px] font-black text-slate-555 uppercase tracking-widest flex items-center gap-1.5">
                      <CheckSquare size={13} /> Onboarding Checklist
                    </p>
                    <div className="space-y-2 bg-slate-50 p-3 rounded-2xl border border-slate-200/50">
                      {[
                        { key: 'checklist_profile_completeness', label: 'Profile avatar & bio summary' },
                        { key: 'checklist_id_verification', label: 'Government ID matches records' },
                        { key: 'checklist_qualifications', label: 'Qualifications reviewed' },
                        { key: 'checklist_intro_video', label: 'Intro video is clear/professional' },
                      ].map(item => (
                        <label key={item.key} className="flex items-start gap-3 cursor-pointer group py-0.5">
                          <input 
                            type="checkbox"
                            checked={(mentorChecklist as any)[item.key]}
                            onChange={e => setMentorChecklist(prev => ({ ...prev, [item.key]: e.target.checked }))}
                            className="w-4 h-4 bg-white border-slate-300 text-green-600 rounded focus:ring-green-550/20 mt-0.5 cursor-pointer"
                          />
                          <span className="text-xs text-slate-655 group-hover:text-slate-900 transition-colors font-bold">{item.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Rejection / Needs Info Notes */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-555 uppercase tracking-widest">
                      Action Notes / Rejection Justification
                    </label>
                    <textarea
                      placeholder="Input justification for decision. Required for rejected/needs_info states..."
                      value={rejectionReason}
                      onChange={e => setRejectionReason(e.target.value)}
                      className="w-full bg-white border border-slate-200 text-xs rounded-xl p-3 text-slate-800 outline-none focus:ring-2 focus:ring-green-550/10 min-h-[80px] font-bold"
                    />
                  </div>
                </div>

                {/* Decision controls */}
                <div className="flex flex-col gap-2 pt-4 border-t border-slate-100 mt-auto">
                  <Button
                    onClick={() => setViewingAppRecords(selectedApp)}
                    className="h-11 rounded-xl bg-indigo-650 hover:bg-indigo-700 text-white font-bold border-none flex items-center justify-center gap-1.5 shadow-sm no-print w-full mb-1"
                  >
                    🔍 View Records
                  </Button>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      onClick={() => submitMentorReview('approved')}
                      loading={submitting}
                      className="h-11 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold border-none flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <ShieldCheck size={14} /> Accept
                    </Button>
                    <Button
                      onClick={() => submitMentorReview('needs_info')}
                      loading={submitting}
                      className="h-11 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-250/60 text-amber-700 font-bold flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <RefreshCcw size={14} /> Needs Info
                    </Button>
                  </div>
                  <Button
                    onClick={() => submitMentorReview('rejected')}
                    loading={submitting}
                    className="h-11 rounded-xl bg-red-50 hover:bg-red-100 border border-red-255 text-red-755 font-bold flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <Slash size={14} /> Reject Application
                  </Button>
                </div>
              </div>
            )}

            {selectedAuthorApp && (
              /* ── AUDITOR ACTIONS FOR AUTHOR APPLICATION ── */
              <div className="space-y-6 flex-1 flex flex-col justify-between text-left bg-white p-2">
                <div className="space-y-5">
                  <div>
                    <span className="text-[9px] font-black text-emerald-700 uppercase bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60">Auditor Panel</span>
                    <h4 className="font-extrabold text-sm text-slate-900 mt-1 leading-snug">Author App: {selectedAuthorApp.applicant_name}</h4>
                  </div>

                  <hr className="border-slate-100" />

                  {/* Rejection / Needs Info Notes */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-555 uppercase tracking-widest">
                      Action Notes / Rejection Justification
                    </label>
                    <textarea
                      placeholder="Input justification for decision. Required for rejected/needs_info states..."
                      value={rejectionReason}
                      onChange={e => setRejectionReason(e.target.value)}
                      className="w-full bg-white border border-slate-200 text-xs rounded-xl p-3 text-slate-800 outline-none focus:ring-2 focus:ring-green-550/10 min-h-[80px] font-bold"
                    />
                  </div>
                </div>

                {/* Decision controls */}
                <div className="flex flex-col gap-2 pt-4 border-t border-slate-100 mt-auto">
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      onClick={() => submitAuthorReview('approved')}
                      disabled={submitting}
                      className="h-11 rounded-xl bg-green-655 hover:bg-green-700 text-white font-bold border-none flex items-center justify-center gap-1.5 shadow-sm"
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
            )}

            {!selectedProfile && !selectedApp && !selectedAuthorApp && (
              /* ── NO SELECTION PLACEHOLDER ── */
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-4">
                <div className="w-16 h-16 rounded-full bg-slate-50 border border-slate-255 flex items-center justify-center text-slate-400 shadow-sm text-xl font-bold">
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
      )}
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
                    <p className="font-bold text-white">1. Enrolled courses staging connection</p>
                    <p className="text-slate-550 text-[10px]">Loaded {getEnrolledCount(impersonatingUser.id)} enrollments. Database read latency: 12ms. Access filter verified.</p>
                  </div>
                  <div className="p-3 bg-slate-900 border border-slate-850 rounded-xl space-y-1">
                    <p className="font-bold text-white">2. Wallet ledger connection</p>
                    <p className="text-slate-550 text-[10px]">Available balance check: OK. Deposit address checked. No locked payments.</p>
                  </div>
                  <div className="p-3 bg-slate-900 border border-slate-850 rounded-xl space-y-1">
                    <p className="font-bold text-white">3. Platform communication hub</p>
                    <p className="text-slate-550 text-[10px]">Connected to server. Active connection ID: ws_sim_88192.</p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ── View Records Modal ── */}
      {viewingAppRecords && (() => {
        const modalProfile = selectedAppProfile || profiles.find(p => p.id === viewingAppRecords.user_id);
        const modalMeta = modalProfile?.metadata ? getParsedMetadata(modalProfile.metadata) : (viewingAppRecords.metadata ? getParsedMetadata(viewingAppRecords.metadata) : null);
        const modalName = modalProfile?.full_name || viewingAppRecords.applicant_name || 'Mentor Applicant';
        const modalAvatar = modalProfile?.avatar_url || viewingAppRecords.applicant_avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${viewingAppRecords.user_id}`;
        
        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto printable-area print:bg-white print:p-0 print:static print:block">
            <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden print:max-h-none print:w-full print:border-none print:shadow-none print:rounded-none">
              
              {/* Modal Header */}
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 no-print">
                <div className="flex items-center gap-3">
                  <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 font-black text-[10px] uppercase rounded border border-emerald-200">Full Record Summary</span>
                  <span className="text-xs text-slate-500 font-bold">Applicant ID: {viewingAppRecords.user_id}</span>
                </div>
                <div className="flex items-center gap-2">
                  <ExportToolbar
                    onExportExcel={() => exportToExcel([viewingAppRecords], USER_EXPORT_COLUMNS, 'application_record')}
                    onDownloadPDF={() => {
                      const credentials = (modalMeta?.pending_mentor_data?.qualifications?.credentials || []).map((cred: any) => ({
                        type: cred.type,
                        value: cred.value,
                      }));
                      generateProfilePDF({
                        fullName: modalName,
                        email: modalProfile?.email || '',
                        role: modalProfile?.role || 'user',
                        country: modalMeta?.onboarding_data?.profile?.country || modalProfile?.country || '',
                        bio: modalProfile?.bio || modalMeta?.pending_mentor_data?.qualifications?.motivation || '',
                        avatarUrl: modalAvatar,
                        userId: viewingAppRecords.user_id,
                        joinDate: modalProfile?.created_at || '',
                        status: modalMeta?.suspended ? 'Suspended' : 'Active',
                        applicationType: viewingAppRecords.application_type || 'mentor',
                        applicationStatus: viewingAppRecords.status,
                        qualifications: {
                          education: modalMeta?.pending_mentor_data?.qualifications?.education,
                          yearsExp: modalMeta?.pending_mentor_data?.qualifications?.years_exp || modalMeta?.pending_mentor_data?.qualifications?.years_exp,
                          skills: modalMeta?.pending_mentor_data?.qualifications?.skills || [],
                          motivation: modalMeta?.pending_mentor_data?.qualifications?.motivation,
                        },
                        credentials: credentials,
                        checklist: {
                          checklist_profile_completeness: viewingAppRecords.checklist_profile_completeness,
                          checklist_id_verification: viewingAppRecords.checklist_id_verification,
                          checklist_qualifications: viewingAppRecords.checklist_qualifications,
                          checklist_intro_video: viewingAppRecords.checklist_intro_video,
                        },
                        reviewNotes: viewingAppRecords.rejection_reason || '',
                      });
                    }}
                    itemCount={1}
                    label="record"
                  />
                  <button
                    onClick={() => setViewingAppRecords(null)}
                    className="p-2 hover:bg-slate-200 rounded-xl text-slate-500 transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
              
              {/* Print Only Header */}
              <div className="hidden print:flex items-center justify-between p-6 border-b-2 border-slate-200 bg-white">
                <div>
                  <h1 className="text-xl font-black text-slate-900 tracking-tight uppercase">Trileza Platform — Mentor Application Audit Report</h1>
                  <p className="text-[10px] text-slate-500 mt-1">Generated on {new Date().toLocaleDateString()} | Applicant UUID: {viewingAppRecords.user_id}</p>
                </div>
                <div className="text-right">
                  <span className="px-3 py-1 bg-slate-100 border border-slate-300 text-[10px] font-black uppercase text-slate-700 rounded">Official Audit Document</span>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-8 overflow-y-auto space-y-8 flex-1">
                
                {/* Profile Card Header */}
                <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start border-b border-slate-150 pb-6">
                  <img
                    src={modalAvatar}
                    alt="Passport Photo"
                    className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover bg-slate-100 border border-slate-255/70 shadow-md"
                  />
                  <div className="text-center sm:text-left space-y-2 flex-1">
                    <h3 className="text-2xl font-black text-slate-900 leading-tight">{modalName}</h3>
                    <div className="flex flex-wrap justify-center sm:justify-start gap-2.5">
                      <span className="px-2 py-0.5 rounded bg-slate-105 text-[10px] font-bold text-slate-600 border border-slate-200">Email: {modalProfile?.email || 'N/A'}</span>
                      <span className="px-2 py-0.5 rounded bg-slate-105 text-[10px] font-bold text-slate-600 border border-slate-200">Role: {modalProfile?.role || 'N/A'}</span>
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-[10px] font-black text-emerald-700 border border-emerald-250/40 uppercase">Status: {viewingAppRecords.status}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium">Submitted At: {formatDate(viewingAppRecords.submitted_at)}</p>
                  </div>
                </div>

                {/* 3-Column Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  
                  {/* Col 1: Registration details */}
                  <div className="space-y-5 text-slate-700 text-left">
                    <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2">1. Registration Info</h4>
                    <div className="space-y-3 text-xs">
                      <div>
                        <span className="block text-[10px] font-bold text-slate-400 uppercase">Legal Name</span>
                        <span className="font-semibold text-slate-800">{modalMeta?.onboarding_data?.certificate?.legal_name || modalName}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-slate-400 uppercase">Date of Birth</span>
                        <span className="font-semibold text-slate-800">{modalMeta?.onboarding_data?.profile?.dob || modalMeta?.pending_mentor_data?.identity?.dob || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-slate-400 uppercase">Location / Country</span>
                        <span className="font-semibold text-slate-800">{modalMeta?.onboarding_data?.profile?.country || modalProfile?.country || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-slate-400 uppercase">Language Preference</span>
                        <span className="font-semibold text-slate-800">{modalMeta?.onboarding_data?.profile?.language || 'English'}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-slate-400 uppercase">Timezone</span>
                        <span className="font-semibold text-slate-800">{modalMeta?.onboarding_data?.profile?.timezone || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-slate-400 uppercase">Employment Status</span>
                        <span className="font-semibold text-slate-800">{modalMeta?.onboarding_data?.learning_background?.employment_status || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-slate-400 uppercase">Uploaded CV / Resume</span>
                        {modalMeta?.onboarding_data?.profile?.cv_uploaded ? (
                          <span className="font-bold text-emerald-600 flex items-center gap-1.5 mt-0.5">
                            📄 {modalMeta.onboarding_data.profile.cv_uploaded}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-semibold italic">Not uploaded</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Col 2: Mentor details */}
                  <div className="space-y-5 text-slate-700 text-left">
                    <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2">2. Application Address & Socials</h4>
                    <div className="space-y-3 text-xs">
                      <div>
                        <span className="block text-[10px] font-bold text-slate-400 uppercase">Public Mentor Name</span>
                        <span className="font-semibold text-slate-800">{modalMeta?.pending_mentor_data?.identity?.public_name || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-slate-400 uppercase">Tax ID / Security Code</span>
                        <span className="font-semibold text-slate-850 font-mono">{modalMeta?.pending_mentor_data?.identity?.tax_id || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-slate-400 uppercase">Residence Address</span>
                        {modalMeta?.pending_mentor_data?.identity?.address ? (
                          <span className="font-semibold text-slate-800 block leading-relaxed">
                            {modalMeta.pending_mentor_data.identity.address.street}<br/>
                            {modalMeta.pending_mentor_data.identity.address.city}, {modalMeta.pending_mentor_data.identity.address.postal}<br/>
                            {modalMeta.pending_mentor_data.identity.address.country}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">No address provided</span>
                        )}
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-slate-400 uppercase">LinkedIn Profile</span>
                        {modalMeta?.pending_mentor_data?.identity?.socials?.linkedin ? (
                          <a
                            href={modalMeta.pending_mentor_data.identity.socials.linkedin.startsWith('http') ? modalMeta.pending_mentor_data.identity.socials.linkedin : `https://${modalMeta.pending_mentor_data.identity.socials.linkedin}`}
                            target="_blank"
                            rel="noreferrer"
                            className="font-bold text-blue-600 hover:text-blue-800 underline flex items-center gap-1 mt-0.5 no-print"
                          >
                            LinkedIn <ExternalLink size={12} />
                          </a>
                        ) : (
                          <span className="text-slate-400 italic">None</span>
                        )}
                        <span className="hidden print:inline font-semibold text-slate-800">{modalMeta?.pending_mentor_data?.identity?.socials?.linkedin || ''}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-slate-400 uppercase">Personal Website</span>
                        {modalMeta?.pending_mentor_data?.identity?.socials?.website ? (
                          <a
                            href={modalMeta.pending_mentor_data.identity.socials.website.startsWith('http') ? modalMeta.pending_mentor_data.identity.socials.website : `https://${modalMeta.pending_mentor_data.identity.socials.website}`}
                            target="_blank"
                            rel="noreferrer"
                            className="font-bold text-blue-600 hover:text-blue-800 underline flex items-center gap-1 mt-0.5 no-print"
                          >
                            Website <ExternalLink size={12} />
                          </a>
                        ) : (
                          <span className="text-slate-400 italic">None</span>
                        )}
                        <span className="hidden print:inline font-semibold text-slate-800">{modalMeta?.pending_mentor_data?.identity?.socials?.website || ''}</span>
                      </div>
                    </div>
                  </div>

                  {/* Col 3: Qualifications & credentials */}
                  <div className="space-y-5 text-slate-700 text-left">
                    <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2">3. Qualifications & Docs</h4>
                    <div className="space-y-4 text-xs">
                      <div>
                        <span className="block text-[10px] font-bold text-slate-400 uppercase">Highest Education Level</span>
                        <span className="font-semibold text-slate-800">{modalMeta?.pending_mentor_data?.qualifications?.education || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-slate-400 uppercase">Years of Experience</span>
                        <span className="font-semibold text-slate-800">{modalMeta?.pending_mentor_data?.qualifications?.years_exp || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-slate-400 uppercase">Course Specialties</span>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {(modalMeta?.pending_mentor_data?.qualifications?.skills || []).map((skill: string) => (
                            <span key={skill} className="px-2 py-0.5 bg-slate-100 text-[10px] font-semibold text-slate-600 rounded">
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-slate-400 uppercase">Motivation for Mentoring</span>
                        <p className="font-semibold text-slate-700 mt-1 leading-relaxed italic bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          "{modalMeta?.pending_mentor_data?.qualifications?.motivation || 'N/A'}"
                        </p>
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-slate-400 uppercase">Uploaded Credentials / ID</span>
                        <ul className="space-y-1.5 mt-1.5">
                          {(modalMeta?.pending_mentor_data?.qualifications?.credentials || []).map((cred: any, idx: number) => (
                            <li key={idx} className="font-bold text-slate-800 flex items-center gap-1.5">
                              📄 {cred.value} <span className="text-[10px] text-slate-400 font-normal">({cred.type})</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>

                </div>

              </div>
              
              {/* Modal Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end no-print">
                <Button
                  onClick={() => setViewingAppRecords(null)}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-6"
                >
                  Close Record
                </Button>
              </div>

            </div>
          </div>
        );
      })()}

      {/* ── Document Previewer Modal Overlay ── */}
      {previewingDoc && (
        <FileViewer
          file={previewingDoc}
          onClose={() => setPreviewingDoc(null)}
        />
      )}

      {/* ── User Profile Detail Modal Overlay ── */}
      {selectedProfile && (
        <UserProfileModal
          profile={selectedProfile}
          onClose={() => setSelectedProfile(null)}
          onRefresh={fetchData}
        />
      )}

      {/* ── Confirm Dialog Overlay ── */}
      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
        confirmLabel={confirmDialog.confirmLabel}
        loading={submitting}
        onConfirm={async () => {
          await confirmDialog.action();
          setConfirmDialog(prev => ({ ...prev, open: false }));
        }}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
      />

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

    </div>
  );
};

export default UserManagerDashboard;
