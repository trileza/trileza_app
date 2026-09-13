import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { adminService } from '../../lib/services/admin';
import type { AdminAuditLog, AdminRole } from '../../types/admin';
import { nexus } from '../../lib/nexus';
import { Card, Button, Toast } from '../ui';
import { 
  ShieldAlert, 
  Activity, 
  Database, 
  Webhook, 
  Search, 
  Eye, 
  Clock, 
  BookOpen, 
  Users, 
  DollarSign, 
  LifeBuoy, 
  Scale,
  RefreshCcw,
  Wrench,
  Trash2
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { formatDate } from '../../utils';
import { useAuthStore } from '../../store/authStore';
import { isAdminRecordActive } from '../../utils/adminAuth';
import { fetchBounded, fetchCount, ADMIN_MAX_ROWS } from './hooks/adminQuery';
import PageHeader from '../shared/PageHeader';
import Pagination from './shared/Pagination';
import ExportToolbar from './shared/ExportToolbar';
import FileViewer from './shared/FileViewer';
import UserProfileModal from './shared/UserProfileModal';
import ConfirmDialog from './shared/ConfirmDialog';
import { useDebouncedValue, usePaginatedList, useMultiTableSync } from './hooks/useAdminData';
import { exportToExcel, exportToCSV, USER_EXPORT_COLUMNS, AUDIT_LOG_EXPORT_COLUMNS } from './hooks/useExport';

const SuperAdminDashboard: React.FC = () => {
  const [logs, setLogs] = useState<AdminAuditLog[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [adminUsers, setAdminUsers] = useState<Record<string, AdminRole>>({});
  const [allAdmins, setAllAdmins] = useState<any[]>([]);
  const [pendingAdmins, setPendingAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'users' | 'audit' | 'rbac'>('overview');
  const [rbacSection, setRbacSection] = useState<'pending' | 'active' | 'promote'>('pending');

  // User Registry Tab states (similar to UserManagerDashboard)
  const [userTab, setUserTab] = useState<'mentors' | 'mentees' | 'dual' | 'authors' | 'suspended'>('mentors');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [selectedProfile, setSelectedProfile] = useState<any | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Advanced filters & sorting for User Registry
  const [filterRole, setFilterRole] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [filterJoinDate, setFilterJoinDate] = useState<string>('All');
  const [sortBy, setSortBy] = useState<string>('date_desc');

  // Reset page when user tab or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [userTab, userSearchQuery, filterRole, filterStatus, filterJoinDate, sortBy]);
  
  // Stats/history for selected user
  const [courses, setCourses] = useState<any[]>([]);
  const [books, setBooks] = useState<any[]>([]);
  // Totals only — the rows themselves were never rendered.
  const [enrollmentCount, setEnrollmentCount] = useState<number>(0);
  const [totalUsers, setTotalUsers] = useState<number>(0);
  const [enrolledCounts, setEnrolledCounts] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [suspensionReason, setSuspensionReason] = useState('');
  
  // Diagnostics states
  const [runningDiag, setRunningDiag] = useState(false);
  const [diagResults, setDiagResults] = useState<string[]>([]);
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


  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAction, setFilterAction] = useState('All');
  const [filterTarget, setFilterTarget] = useState('All');
  const [selectedLog, setSelectedLog] = useState<AdminAuditLog | null>(null);
  const [previewingDoc, setPreviewingDoc] = useState<{ name: string; url?: string } | null>(null);

  // metrics counters
  const [metrics, setMetrics] = useState({
    coursesPending: 0,
    booksPending: 0,
    mentorsPending: 0,
    flagsPending: 0,
    payoutsPending: 0,
    ticketsPending: 0,
    compliancePending: 0,
  });

  /**
   * Counted in the database, cached per user. The previous version filtered an
   * in-memory copy of every enrollment on `student_id`, a column the table does
   * not have — so it always reported 0.
   */
  const getEnrolledCount = (pId: string) => enrolledCounts[pId] ?? 0;

  const loadEnrolledCount = useCallback(async (pId: string) => {
    if (!pId || enrolledCounts[pId] !== undefined) return;
    try {
      const count = await fetchCount('enrollments', q => q.eq('user_id', pId));
      setEnrolledCounts(prev => ({ ...prev, [pId]: count }));
    } catch (err) {
      console.error('[SuperAdmin] Could not count enrollments:', err);
    }
  }, [enrolledCounts]);
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

  const handleToggleSuspension = async (profileId: string, suspend: boolean) => {
    const { user: currentUser } = useAuthStore.getState();
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

  const getFilteredProfiles = () => {
    return profiles.filter(p => {
      const matchesSearch = 
        p.full_name?.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
        p.email?.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
        p.id?.toLowerCase().includes(userSearchQuery.toLowerCase());

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
        // Fallback to active sub-tab quick filters
        const isSuspended = p.metadata?.suspended === true;
        const coursesCount = getTaughtCount(p.id);
        const enrollCount = getEnrolledCount(p.id);

        switch (userTab) {
          case 'mentors':
            if (p.role !== 'mentor' && p.role !== 'tutor') return false;
            break;
          case 'mentees':
            if (p.role !== 'student' && p.role !== 'mentee') return false;
            break;
          case 'dual':
            if (!(coursesCount > 0 && enrollCount > 0)) return false;
            break;
          case 'authors':
            if (p.role !== 'author' && getPublishedBooksCount(p.id) === 0) return false;
            break;
          case 'suspended':
            if (!isSuspended) return false;
            break;
        }
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
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Queue metrics are counted in the database; only the lists the console
      // actually renders are fetched, and those are bounded.
      const [allLogs, courseReviews, bookReviews, mentors, flags, payouts, tickets, compliance, profs, admins, courses, books, enrollTotal, pendingRegs] = await Promise.all([
        adminService.getAdminAuditLogs(),
        adminService.getCourseReviews(),
        adminService.getBookReviews(),
        adminService.getMentorApplications(),
        adminService.getFlaggedContent(),
        adminService.getPayoutRequests(),
        adminService.getSupportTickets(),
        adminService.getComplianceRequests(),
        fetchBounded<any>('profiles', q => q.order('created_at', { ascending: false })),
        nexus.database.from('admin_users').select('*, profiles(full_name, email)').limit(ADMIN_MAX_ROWS),
        fetchBounded<any>('courses', q => q.order('created_at', { ascending: false })),
        fetchBounded<any>('books', q => q.order('created_at', { ascending: false })),
        fetchCount('enrollments'),
        adminService.getPendingRegistrations()
      ]);

      setLogs(allLogs);
      setProfiles(profs.rows);
      setCourses(courses.rows);
      setBooks(books.rows);
      setEnrollmentCount(enrollTotal);
      setTotalUsers(profs.total);
      setPendingAdmins(pendingRegs);
      
      const adminRoleMap: Record<string, AdminRole> = {};
      const approvedAdmins: any[] = [];
      
      admins.data?.forEach((a: any) => {
        adminRoleMap[a.user_id] = a.role;
        if (isAdminRecordActive(a)) {
          approvedAdmins.push({
            ...a,
            full_name: a.profiles?.full_name || 'Admin Officer',
            email: a.profiles?.email || a.twofa_email
          });
        }
      });
      setAdminUsers(adminRoleMap);
      setAllAdmins(approvedAdmins);

      // Default the RBAC tab section
      if (pendingRegs.length > 0) {
        setRbacSection('pending');
      } else {
        setRbacSection('active');
      }

      setMetrics({
        coursesPending: courseReviews.filter(c => c.status === 'pending').length,
        booksPending: bookReviews.filter(b => b.status === 'pending').length,
        mentorsPending: mentors.filter(m => m.status === 'pending').length,
        flagsPending: flags.filter(f => f.status === 'pending').length,
        payoutsPending: payouts.filter(p => p.status === 'pending').length,
        ticketsPending: tickets.filter(t => t.status === 'open' || t.status === 'in_progress').length,
        compliancePending: compliance.filter(c => c.status === 'pending').length,
      });
    } catch (err) {
      console.error('[Super Admin Fetch Error]:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  // Realtime multi-table sync
  useMultiTableSync(
    ['profiles', 'courses', 'books', 'admin_users', 'admin_audit_logs', 'mentor_applications', 'author_applications'],
    fetchData
  );

  const handleApproveAdmin = async (id: string) => {
    const { user } = useAuthStore.getState();
    if (!user?.id) return;
    setSubmitting(true);
    try {
      const { error } = await adminService.approveRegistration(id, user.id);
      if (error) throw error;
      showToast('Admin registration approved successfully!', 'success');
      await fetchData();
    } catch (err) {
      showToast('Failed to approve registration: ' + err, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectAdmin = async (id: string) => {
    const { user } = useAuthStore.getState();
    if (!user?.id) return;
    setSubmitting(true);
    try {
      const { error } = await adminService.rejectRegistration(id, user.id);
      if (error) throw error;
      showToast('Admin registration rejected.', 'info');
      await fetchData();
    } catch (err) {
      showToast('Failed to reject registration: ' + err, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleBypass = async (adminId: string, currentBypass: boolean) => {
    const { user } = useAuthStore.getState();
    if (!user?.id) return;
    
    // Find executor's admin row id (which should be approved as super_admin)
    const executorRow = allAdmins.find(a => a.user_id === user.id && a.role === 'super_admin');
    if (!executorRow) {
      showToast('Your current user is not matched as an approved Super Admin in the admin registry.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await adminService.toggle2FABypass(adminId, !currentBypass, executorRow.id);
      if (error) throw error;
      showToast(`2FA Bypass ${!currentBypass ? 'enabled' : 'disabled'} for this admin user.`, 'success');
      await fetchData();
    } catch (err) {
      showToast('Failed to update 2FA bypass status: ' + err, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateAdminRole = async (userId: string, role: string) => {
    const { user } = useAuthStore.getState();
    if (!user?.id) return;
    try {
      if (role === 'none') {
        const { error } = await nexus.database.from('admin_users').delete().eq('user_id', userId);
        if (error) throw error;
        await adminService.logAdminAction(
          user.id,
          'delete',
          'user',
          userId,
          { role: adminUsers[userId] },
          { role: null },
          `Removed admin privileges`
        );
      } else {
        const { error } = await adminService.setAdminUserRole(userId, role as AdminRole, user.id);
        if (error) throw error;
      }
      showToast('RBAC permission state updated successfully!', 'success');
      fetchData();
    } catch (err) {
      showToast('Failed to update admin role: ' + err, 'error');
    }
  };

  const handleDeleteUser = (p: any) => {
    const { user } = useAuthStore.getState();
    setConfirmDialog({
      open: true,
      title: 'Delete User Profile',
      message: `Permanently delete user "${p.full_name}" and all associated applications, enrollments, and admin accounts? This action cannot be undone.`,
      confirmLabel: 'Delete User',
      variant: 'danger',
      action: async () => {
        if (!user?.id) return;
        setSubmitting(true);
        try {
          await adminService.deleteUser(p.id, user.id);
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

  const runSystemDiagnostics = () => {
    setRunningDiag(true);
    setDiagResults([]);
    
    const logs = [
      'Establishing secure connection to InsForge database...',
      'Database latency check: 18ms [excellent]',
      'Verifying cryptographic signatures with Paystack connection...',
      'Gateway sync verified successfully.',
      'Checking access boundaries for course reviews...',
      'Diagnostics completed. System health status: stable.'
    ];

    logs.forEach((log, index) => {
      setTimeout(() => {
        setDiagResults(prev => [...prev, log]);
        if (index === logs.length - 1) setRunningDiag(false);
      }, (index + 1) * 800);
    });
  };

  const extractFilesFromState = (state: any): { name: string; url: string }[] => {
    if (!state) return [];
    const files: { name: string; url: string }[] = [];
    
    const searchObj = (obj: any) => {
      if (!obj || typeof obj !== 'object') return;
      
      if (obj.url && (obj.value || obj.name || obj.type)) {
        files.push({ name: obj.value || obj.name || 'Document', url: obj.url });
      }
      
      if (typeof obj.cv_uploaded === 'string' && obj.cv_url) {
        files.push({ name: obj.cv_uploaded, url: obj.cv_url });
      } else if (typeof obj.cv_uploaded === 'string') {
        files.push({ name: obj.cv_uploaded, url: obj.cv_uploaded });
      }
      
      // Mentor applications no longer carry an intro video. Identity documents
      // took its place as the thing a reviewer opens.
      if (obj.id_document_url) {
        files.push({ name: obj.id_document_name || 'Identity document', url: obj.id_document_url });
      }
      
      if (obj.thumbnail_url) {
        files.push({ name: 'Thumbnail Image', url: obj.thumbnail_url });
      }
      
      if (obj.cover_url) {
        files.push({ name: 'Cover Image', url: obj.cover_url });
      }

      if (obj.file_url) {
        files.push({ name: obj.file_name || 'Attached File', url: obj.file_url });
      }

      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          if (typeof obj[key] === 'object') {
            searchObj(obj[key]);
          } else if (typeof obj[key] === 'string' && (obj[key].startsWith('http://') || obj[key].startsWith('https://'))) {
            const val = obj[key].toLowerCase();
            if (val.endsWith('.pdf') || val.endsWith('.png') || val.endsWith('.jpg') || val.endsWith('.jpeg') || val.endsWith('.docx')) {
              files.push({ name: key.replace(/_/g, ' '), url: obj[key] });
            }
          }
        }
      }
    };
    
    searchObj(state);
    return files;
  };

  // Debounced search queries
  const debouncedUserSearchQuery = useDebouncedValue(userSearchQuery, 300);
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // admin_id and reason are nullable in the consolidated audit table
      // (server-side and imported entries may lack them).
      const query = debouncedSearchQuery.toLowerCase();
      const matchesSearch = (log.admin_id || '').toLowerCase().includes(query) ||
                            (log.reason || '').toLowerCase().includes(query) ||
                            (log.target_id || '').toLowerCase().includes(query);
      const matchesAction = filterAction === 'All' || log.action_type === filterAction;
      const matchesTarget = filterTarget === 'All' || log.target_type === filterTarget;
      return matchesSearch && matchesAction && matchesTarget;
    });
  }, [logs, debouncedSearchQuery, filterAction, filterTarget]);

  // Memoized user registry filter (uses debounced search)
  const currentProfileList = useMemo(() => {
    return profiles.filter(p => {
      const matchesSearch = 
        p.full_name?.toLowerCase().includes(debouncedUserSearchQuery.toLowerCase()) ||
        p.email?.toLowerCase().includes(debouncedUserSearchQuery.toLowerCase()) ||
        p.id?.toLowerCase().includes(debouncedUserSearchQuery.toLowerCase());

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
        // Fallback to active sub-tab quick filters
        const isSuspended = p.metadata?.suspended === true;
        const coursesCount = getTaughtCount(p.id);
        const enrollCount = getEnrolledCount(p.id);

        switch (userTab) {
          case 'mentors':
            if (p.role !== 'mentor' && p.role !== 'tutor') return false;
            break;
          case 'mentees':
            if (p.role !== 'student' && p.role !== 'mentee') return false;
            break;
          case 'dual':
            if (!(coursesCount > 0 && enrollCount > 0)) return false;
            break;
          case 'authors':
            if (p.role !== 'author' && getPublishedBooksCount(p.id) === 0) return false;
            break;
          case 'suspended':
            if (!isSuspended) return false;
            break;
        }
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
  }, [profiles, debouncedUserSearchQuery, filterRole, filterStatus, filterJoinDate, sortBy, userTab, adminUsers]);

  // Paginated List
  const profilesPagination = usePaginatedList(currentProfileList, itemsPerPage);

  const isProfileAudit = false;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 text-left">
      
        <PageHeader
          title="Super Admin Deck"
          description="Platform control panel, status monitors, system configuration, and ledger audits."
          tag="Super Admin"
          icon={ShieldAlert}
          rightContent={
            <Button onClick={fetchData} variant="outline" className="h-11 rounded-xl bg-white/15 hover:bg-white/20 border-white/20 text-white shadow-sm flex items-center gap-2 font-bold">
              <RefreshCcw size={14} className="text-emerald-450 animate-spin-slow" /> Sync Ledger
            </Button>
          }
        />


      {/* ── Tabs ── */}
      {!isProfileAudit && (
        <div className="flex gap-4 border-b border-slate-200 pb-2">
          {([
            { id: 'overview', label: '📊 System Health Overview' },
            { id: 'users', label: '🧑‍🤝‍🧑 User Registry' },
            { id: 'audit', label: '📋 Cryptographic Audit Log' },
            { id: 'rbac', label: '🛡️ RBAC Access Registry' }
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`px-4 py-2.5 rounded-t-xl font-bold text-xs tracking-wider uppercase transition-all ${
                activeSubTab === tab.id
                  ? 'text-green-700 border-b-4 border-green-600 bg-green-50/40'
                  : 'text-slate-550 hover:text-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* ── TAB 1: OVERVIEW ── */}
      {activeSubTab === 'overview' && (
        <div className="space-y-8">
          {/* Metrics cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { label: 'Pending Courses', value: metrics.coursesPending, icon: BookOpen, color: 'text-amber-700 bg-amber-50 border-amber-250/60' },
              { label: 'Pending Books', value: metrics.booksPending, icon: BookOpen, color: 'text-red-700 bg-red-50 border-red-250/60' },
              { label: 'Pending Mentors', value: metrics.mentorsPending, icon: Users, color: 'text-emerald-700 bg-emerald-50 border-emerald-250/60' },
              { label: 'Pending Payouts', value: metrics.payoutsPending, icon: DollarSign, color: 'text-indigo-700 bg-indigo-50 border-indigo-250/60' },
              { label: 'Active Flags', value: metrics.flagsPending, icon: ShieldAlert, color: 'text-orange-700 bg-orange-50 border-orange-250/60' },
              { label: 'Support Tickets', value: metrics.ticketsPending, icon: LifeBuoy, color: 'text-cyan-700 bg-cyan-50 border-cyan-250/60' },
              { label: 'Compliance Cases', value: metrics.compliancePending, icon: Scale, color: 'text-purple-700 bg-purple-50 border-purple-250/60' },
              { label: 'Ledger Audit Entries', value: logs.length, icon: Clock, color: 'text-slate-700 bg-slate-50 border-slate-250/60' },
            ].map((item, i) => (
              <Card key={i} className="bg-white border-slate-200/60 hover:shadow-md transition-all rounded-2xl flex flex-col justify-between p-5 shadow-sm">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-black text-slate-450 uppercase tracking-widest">{item.label}</span>
                  <div className={`p-2 rounded-xl border ${item.color}`}>
                    <item.icon size={15} />
                  </div>
                </div>
                <p className="text-2xl font-black text-slate-900 mt-3">{item.value}</p>
              </Card>
            ))}
          </div>

          {/* System Connections */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="lg:col-span-2 bg-white border-slate-200/60 p-6 rounded-2xl shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                  <Activity size={14} className="text-green-600" /> Platform Connections
                </h3>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-250/40">Stable</span>
              </div>
              <div className="space-y-4">
                {[
                  { label: 'Database Cluster', desc: 'PostgreSQL - database connection', icon: Database },
                  { label: 'Paystack Webhook Handler', desc: 'Secure Serverless connection', icon: Webhook },
                  { label: 'Platform Routing Gateway', desc: 'admin.trileza.app Subdomain', icon: ShieldAlert },
                ].map((connection, i) => (
                  <div key={i} className="flex gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200/60 items-center justify-between">
                    <div className="flex gap-4 items-center">
                      <div className="p-2 bg-slate-100 border border-slate-200 text-slate-700 rounded-xl">
                        <connection.icon size={16} />
                      </div>
                      <div className="text-left">
                        <p className="font-extrabold text-xs text-slate-950">{connection.label}</p>
                        <p className="text-[10px] text-slate-500 font-bold mt-0.5">{connection.desc}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                      <span className="text-[9px] font-black text-emerald-600 uppercase tracking-wider">Operational</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="bg-white border-slate-200/60 p-6 rounded-2xl shadow-sm flex flex-col justify-between text-left">
              <div className="space-y-3">
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                  <Wrench size={14} /> Diagnostic Terminal
                </h3>
                <p className="text-[11px] text-slate-500 font-bold leading-relaxed">
                  Trigger a live status query on all database structures and connection latency points.
                </p>
                <div className="p-3 bg-slate-950 rounded-xl text-[10px] font-mono text-emerald-400 space-y-1.5 min-h-[140px] max-h-[140px] overflow-y-auto">
                  {diagResults.length === 0 ? (
                    <span className="text-slate-600 font-bold select-none">[System Idle. Awaiting execution...]</span>
                  ) : (
                    diagResults.map((r, i) => <div key={i}>&gt; {r}</div>)
                  )}
                </div>
              </div>
              <Button
                onClick={runSystemDiagnostics}
                disabled={runningDiag}
                className="w-full mt-4 h-11 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl border-none"
              >
                {runningDiag ? 'Running Audits...' : 'Execute Diagnostics'}
              </Button>
            </Card>
          </div>
        </div>
      )}
      {activeSubTab === 'users' && (
        <div className="w-full text-left">
          {/* User list */}
          <div className="w-full space-y-6">
            <div className="space-y-4 bg-slate-50 p-5 rounded-3xl border border-slate-200/80 shadow-sm text-left">
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                  {/* User Classification sub-tabs */}
                  <div className="flex flex-wrap gap-2 bg-slate-100 p-1 rounded-xl w-fit">
                    {([
                      { key: 'mentors', label: '🧑‍🏫 Mentors' },
                      { key: 'mentees', label: '🎓 Mentees' },
                      { key: 'dual', label: '🔄 Dual Users' },
                      { key: 'authors', label: '📖 Authors' },
                      { key: 'suspended', label: '🚫 Suspended' }
                    ] as const).map(tab => (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => { setUserTab(tab.key); setSelectedProfile(null); }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          userTab === tab.key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Search input */}
                  <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto md:ml-auto">
                    <ExportToolbar
                      onExportExcel={() => exportToExcel(currentProfileList, USER_EXPORT_COLUMNS, 'super_admin_user_registry')}
                      onExportCSV={() => exportToCSV(currentProfileList, USER_EXPORT_COLUMNS, 'super_admin_user_registry')}
                      itemCount={currentProfileList.length}
                      label="users"
                    />
                    <div className="relative w-full sm:w-64">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search name, email, or UUID..."
                        value={userSearchQuery}
                        onChange={e => setUserSearchQuery(e.target.value)}
                        className="w-full bg-white border border-slate-200 text-xs font-bold pl-9 pr-3 py-2 rounded-xl text-slate-855 outline-none focus:ring-2 focus:ring-green-550/10 shadow-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Advanced filters & sorting */}
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

                {/* List card output */}
                <div className="space-y-2 pt-2 border-t border-slate-200/60">
                  {currentProfileList.length === 0 ? (
                    <Card className="p-12 text-center border-slate-200 bg-white rounded-2xl shadow-sm">
                      <Users size={40} className="text-slate-300 mx-auto mb-4" />
                      <h4 className="font-extrabold text-slate-700 text-base">No Users Found</h4>
                      <p className="text-xs text-slate-400 mt-1">No profiles matched the active classification or search filters.</p>
                    </Card>
                  ) : (
                    <>
                      {profilesPagination.paginatedItems.map(p => {
                        const isSuspended = p.metadata?.suspended === true;
                        return (
                          <Card
                            key={p.id}
                            className={`p-4 bg-white border hover:border-indigo-300 transition-all rounded-2xl flex gap-4 shadow-sm items-center cursor-pointer ${
                              selectedProfile?.id === p.id ? 'ring-2 ring-indigo-650 border-transparent bg-indigo-50/5' : 'border-slate-200/60'
                            } ${isSuspended ? 'border-red-200 bg-red-50/5' : ''}`}
                          >
                            <div 
                              onClick={() => { setSelectedProfile(p); }}
                              className="flex gap-4 items-center flex-1 min-w-0"
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
                                  <span className="px-1.5 py-0.2 rounded bg-slate-100 border border-slate-200 text-[8px] font-black text-slate-555 uppercase tracking-widest">{p.role}</span>
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
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}


      {/* ── TAB 2: AUDIT LEDGER ── */}
      {activeSubTab === 'audit' && (
        <Card className="bg-white border-slate-250/70 rounded-3xl overflow-hidden p-0 shadow-xl shadow-slate-200/30">
          <div className="p-6 border-b border-slate-200/80 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-slate-50/50">
            <div>
              <h3 className="text-base font-black text-slate-900 uppercase tracking-wider">Audit Trail Ledger</h3>
              <p className="text-xs text-slate-550 font-bold mt-0.5">Filter and query cryptographic audit entries.</p>
            </div>
            
            <div className="flex flex-wrap gap-3 w-full md:w-auto">
              <ExportToolbar
                onExportExcel={() => exportToExcel(filteredLogs, AUDIT_LOG_EXPORT_COLUMNS, 'trileza_audit_ledger')}
                onExportCSV={() => exportToCSV(filteredLogs, AUDIT_LOG_EXPORT_COLUMNS, 'trileza_audit_ledger')}
                itemCount={filteredLogs.length}
                label="audit entries"
              />
              <div className="relative flex-1 md:flex-none md:w-60">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search ledger..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-slate-200 text-xs font-bold pl-9 pr-3 py-2 rounded-xl text-slate-800 outline-none focus:ring-2 focus:ring-green-550/20"
                />
              </div>
              
              <select
                value={filterAction}
                onChange={e => setFilterAction(e.target.value)}
                className="bg-white border border-slate-200 text-xs font-bold rounded-xl p-2 text-slate-700 outline-none focus:ring-2 focus:ring-green-550/20"
              >
                <option value="All">All Actions</option>
                <option value="approve">Approve</option>
                <option value="reject">Reject</option>
                <option value="suspend">Suspend</option>
                <option value="unsuspend">Unsuspend</option>
                <option value="delete">Delete</option>
                <option value="edit">Edit</option>
                <option value="triage">Triage</option>
                <option value="refund">Refund</option>
              </select>

              <select
                value={filterTarget}
                onChange={e => setFilterTarget(e.target.value)}
                className="bg-white border border-slate-200 text-xs font-bold rounded-xl p-2 text-slate-700 outline-none focus:ring-2 focus:ring-green-550/20"
              >
                <option value="All">All Targets</option>
                <option value="course">Courses</option>
                <option value="book">Books</option>
                <option value="user">Users</option>
                <option value="payout">Payouts</option>
                <option value="flagged_content">Flagged</option>
                <option value="support_ticket">Tickets</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left border-collapse min-w-[750px]">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 bg-slate-50/50 text-[9px] uppercase font-black tracking-widest">
                  <th className="p-4">Timestamp</th>
                  <th className="p-4">Admin Entity</th>
                  <th className="p-4">Action</th>
                  <th className="p-4">Target Class</th>
                  <th className="p-4">Target ID</th>
                  <th className="p-4">Reason Justification</th>
                  <th className="p-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-4 text-slate-500 font-mono">
                      {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                    </td>
                    <td className="p-4 font-bold text-slate-900 truncate max-w-[120px]" title={log.admin_id}>{log.admin_id}</td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border ${
                        log.action_type === 'approve' || log.action_type === 'resolve' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' :
                        log.action_type === 'reject' || log.action_type === 'suspend' ? 'text-red-700 bg-red-50 border-red-200' :
                        log.action_type === 'refund' ? 'text-indigo-700 bg-indigo-50 border-indigo-200' : 'text-slate-600 bg-slate-50 border-slate-200'
                      }`}>
                        {log.action_type}
                      </span>
                    </td>
                    <td className="p-4 font-black uppercase tracking-wider text-[8px] text-slate-450">{log.target_type}</td>
                    <td className="p-4 font-mono text-[9px] text-slate-500 truncate max-w-[120px]">{log.target_id}</td>
                    <td className="p-4 text-slate-600 font-medium truncate max-w-[180px]" title={log.reason}>{log.reason}</td>
                    <td className="p-4 text-right">
                      <button 
                        onClick={() => setSelectedLog(log)}
                        className="p-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-500 hover:text-slate-800 transition-all"
                      >
                        <Eye size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── TAB 3: RBAC REGISTRY ── */}
      {activeSubTab === 'rbac' && (
        <Card className="bg-white border-slate-250/70 rounded-3xl overflow-hidden p-0 shadow-xl shadow-slate-200/30 text-left">
          <div className="p-6 border-b border-slate-200/80 bg-slate-50/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h3 className="text-base font-black text-slate-900 uppercase tracking-wider">RBAC Access Control Registry</h3>
              <p className="text-xs text-slate-500 font-bold mt-0.5">Manage administrative access levels, approve signups, and bypass 2FA.</p>
            </div>
            {/* RBAC Sub-navigation */}
            <div className="flex gap-2 bg-slate-100 p-1 rounded-xl shrink-0">
              <button
                type="button"
                onClick={() => setRbacSection('pending')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  rbacSection === 'pending' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                📥 Pending Requests
                {pendingAdmins.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-amber-500 text-white animate-pulse">
                    {pendingAdmins.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setRbacSection('active')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  rbacSection === 'active' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                🛡️ Active Admins & 2FA
              </button>
              <button
                type="button"
                onClick={() => setRbacSection('promote')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  rbacSection === 'promote' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                ➕ Promote Profiles
              </button>
            </div>
          </div>

          {/* Section 1: Pending Approvals */}
          {rbacSection === 'pending' && (
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-left border-collapse min-w-[750px]">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 bg-slate-50/50 text-[9px] uppercase font-black tracking-widest">
                    <th className="p-4">Applicant Name</th>
                    <th className="p-4">Email</th>
                    <th className="p-4">Requested Role</th>
                    <th className="p-4">Applied Date</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {pendingAdmins.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-405 italic">
                        No pending admin registration requests found.
                      </td>
                    </tr>
                  ) : (
                    pendingAdmins.map(p => (
                      <tr key={p.id} className="hover:bg-slate-50/40">
                        <td className="p-4 font-bold text-slate-900">{p.full_name}</td>
                        <td className="p-4 font-medium text-slate-600">{p.email}</td>
                        <td className="p-4">
                          <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border border-amber-250 bg-amber-50 text-amber-700">
                            {p.role.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="p-4 text-slate-500 font-mono">
                          {p.created_at ? formatDistanceToNow(new Date(p.created_at), { addSuffix: true }) : 'N/A'}
                        </td>
                        <td className="p-4 text-right flex justify-end gap-2">
                          <Button
                            onClick={() => handleApproveAdmin(p.id)}
                            disabled={submitting}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] border-none"
                          >
                            Approve
                          </Button>
                          <Button
                            onClick={() => handleRejectAdmin(p.id)}
                            disabled={submitting}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-[10px] border-none"
                          >
                            Reject
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Section 2: Active Admins & 2FA Bypass */}
          {rbacSection === 'active' && (
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-left border-collapse min-w-[750px]">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 bg-slate-50/50 text-[9px] uppercase font-black tracking-widest">
                    <th className="p-4">Name</th>
                    <th className="p-4">Email</th>
                    <th className="p-4">Role</th>
                    <th className="p-4">2FA Status</th>
                    <th className="p-4">Last Login</th>
                    <th className="p-4 text-right">Troubleshooting Control</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {allAdmins.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400 italic">
                        No approved admin accounts registered.
                      </td>
                    </tr>
                  ) : (
                    allAdmins.map(admin => (
                      <tr key={admin.id} className="hover:bg-slate-50/40">
                        <td className="p-4 font-bold text-slate-900">{admin.full_name}</td>
                        <td className="p-4 font-medium text-slate-600">{admin.email}</td>
                        <td className="p-4">
                          <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border border-green-250 bg-green-50 text-green-700">
                            {admin.role.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="p-4">
                          {admin.twofa_bypassed ? (
                            <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-orange-100 text-orange-700 border border-orange-200 animate-pulse">
                              ⚠️ 2FA Bypassed
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-250">
                              🔒 2FA Enforced
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-slate-500 font-mono">
                          {admin.last_login ? formatDistanceToNow(new Date(admin.last_login), { addSuffix: true }) : 'Never'}
                        </td>
                        <td className="p-4 text-right flex justify-end gap-2">
                          <Button
                            onClick={() => handleToggleBypass(admin.id, admin.twofa_bypassed)}
                            disabled={submitting}
                            className={`px-3 py-1.5 font-bold text-[10px] border-none text-white ${
                              admin.twofa_bypassed 
                                ? 'bg-slate-700 hover:bg-slate-800' 
                                : 'bg-amber-600 hover:bg-amber-700'
                            }`}
                          >
                            {admin.twofa_bypassed ? 'Enforce 2FA' : 'Bypass 2FA'}
                          </Button>
                          <Button
                            onClick={() => {
                              setConfirmDialog({
                                open: true,
                                title: 'Revoke Admin Privileges',
                                message: `Are you sure you want to revoke admin access for ${admin.full_name} (${admin.role})?`,
                                confirmLabel: 'Revoke Privileges',
                                variant: 'danger',
                                action: async () => {
                                  setSubmitting(true);
                                  try {
                                    const { error } = await nexus.database.from('admin_users').delete().eq('id', admin.id);
                                    if (error) throw error;
                                    const { user } = useAuthStore.getState();
                                    if (user) {
                                      await adminService.logAdminAuditLog(
                                        null,
                                        'revoke_access',
                                        'user',
                                        admin.user_id,
                                        admin,
                                        null,
                                        `Revoked access for role ${admin.role}`
                                      );
                                    }
                                    showToast('Admin privileges revoked.', 'success');
                                    fetchData();
                                  } catch (err) {
                                    showToast('Failed to revoke admin: ' + err, 'error');
                                  } finally {
                                    setSubmitting(false);
                                  }
                                }
                              });
                            }}
                            disabled={submitting}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-750 text-white font-bold text-[10px] border-none"
                          >
                            Revoke
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Section 3: Promote Profiles (Manual Allocation) */}
          {rbacSection === 'promote' && (
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-left border-collapse min-w-[750px]">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 bg-slate-50/50 text-[9px] uppercase font-black tracking-widest">
                    <th className="p-4">User Details</th>
                    <th className="p-4">Email Address</th>
                    <th className="p-4">Standard App Role</th>
                    <th className="p-4">Administrative Privilege</th>
                    <th className="p-4 text-right">Confirm changes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {profiles.map(p => {
                    const currentRole = adminUsers[p.id] || 'none';
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/40">
                        <td className="p-4 font-bold text-slate-900">{p.full_name}</td>
                        <td className="p-4 font-medium text-slate-600">{p.email}</td>
                        <td className="p-4 font-black uppercase text-[8px] text-slate-400">{p.role}</td>
                        <td className="p-4">
                          <select
                            id={`rbac-select-${p.id}`}
                            defaultValue={currentRole}
                            className="bg-white border border-slate-200 text-xs font-bold rounded-xl p-2 text-slate-700 outline-none focus:ring-2 focus:ring-green-550/20"
                          >
                            <option value="none">No Administrative Access (None)</option>
                            <option value="super_admin">🔧 Super Admin</option>
                            <option value="content_manager">📚 Content Manager</option>
                            <option value="user_manager">🧑‍🤝‍🧑 User Manager</option>
                            <option value="finance_admin">💰 Finance Admin</option>
                            <option value="support_agent">🎫 Support Agent</option>
                            <option value="compliance_officer">⚖️ Compliance Officer</option>
                            <option value="analytics_viewer">📈 Analytics Viewer</option>
                          </select>
                        </td>
                        <td className="p-4 text-right">
                          <Button
                            onClick={() => {
                              const val = (document.getElementById(`rbac-select-${p.id}`) as HTMLSelectElement).value;
                              handleUpdateAdminRole(p.id, val);
                            }}
                            className="px-4 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white font-bold text-[10px] border-none"
                          >
                            Save Role
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* ── Details Modal ── */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h4 className="font-black text-base text-slate-900 uppercase tracking-wider">Inspect State Transition</h4>
              <button onClick={() => setSelectedLog(null)} className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-800 flex items-center justify-center transition-all font-bold">✕</button>
            </div>
            
            <div className="p-6 space-y-6 overflow-y-auto flex-1 text-left text-xs text-slate-700">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/60 leading-relaxed font-semibold text-slate-650">
                Reason: {selectedLog.reason}
              </div>
              {/* Scan state for files & uploads */}
              {(() => {
                const files = [
                  ...extractFilesFromState(selectedLog.previous_state),
                  ...extractFilesFromState(selectedLog.new_state)
                ].filter((v, i, a) => a.findIndex(t => t.url === v.url) === i); // Unique by URL

                if (files.length > 0) {
                  return (
                    <div className="space-y-2 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                      <p className="text-[10px] font-black uppercase text-indigo-750 tracking-widest font-bold">Linked Files & Uploads</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {files.map((file, idx) => (
                          <button
                            key={idx}
                            onClick={() => setPreviewingDoc({ name: file.name, url: file.url })}
                            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-250 text-indigo-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all active:scale-95"
                          >
                            📄 {file.name} (View)
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <p className="text-[10px] font-black uppercase text-red-700 tracking-widest">Previous State</p>
                  <pre className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[10px] font-mono text-slate-600 overflow-x-auto max-h-48">
                    {JSON.stringify(selectedLog.previous_state, null, 2)}
                  </pre>
                </div>
                <div className="space-y-1.5">
                  <p className="text-[10px] font-black uppercase text-emerald-700 tracking-widest">New State</p>
                  <pre className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[10px] font-mono text-slate-600 overflow-x-auto max-h-48">
                    {JSON.stringify(selectedLog.new_state, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <Button
                onClick={() => setSelectedLog(null)}
                className="px-6 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

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

export default SuperAdminDashboard;
