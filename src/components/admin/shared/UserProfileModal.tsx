import React, { useEffect, useState, useMemo } from 'react';
import { nexus } from '../../../lib/nexus';
import { adminService } from '../../../lib/services/admin';
import { useAuthStore } from '../../../store/authStore';
import { generateProfilePDF } from '../hooks/usePrintableProfile';
import FileViewer from './FileViewer';
import ConfirmDialog from './ConfirmDialog';
import { formatDate } from '../../../utils';
import { formatDistanceToNow } from 'date-fns';
import {
  X, Users, ShieldCheck, AlertCircle, Activity, Download,
  FileText, BookOpen, Lock, Eye, Trash2,
  RotateCcw, ExternalLink, ChevronDown, ChevronUp
} from 'lucide-react';

interface UserProfileModalProps {
  profile: any;
  onClose: () => void;
  onRefresh: () => void;
}

const Section: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }> = ({
  title, icon, children, defaultOpen = true
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-200/70 rounded-2xl overflow-hidden bg-white">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-5 py-3.5 flex items-center justify-between gap-3 bg-slate-50/80 hover:bg-slate-100/80 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          {icon}
          <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">{title}</span>
        </div>
        {open ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
      </button>
      {open && <div className="p-5 border-t border-slate-100">{children}</div>}
    </div>
  );
};

const UserProfileModal: React.FC<UserProfileModalProps> = ({ profile, onClose, onRefresh }) => {
  const { user: currentUser } = useAuthStore();
  const [courses, setCourses] = useState<any[]>([]);
  const [books, setBooks] = useState<any[]>([]);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [mentees, setMentees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [suspensionReason, setSuspensionReason] = useState('');
  const [previewingDoc, setPreviewingDoc] = useState<{ name: string; url?: string } | null>(null);

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    variant: 'danger' | 'warning' | 'info';
    confirmLabel: string;
    action: () => Promise<void>;
  }>({ open: false, title: '', message: '', variant: 'danger', confirmLabel: 'Confirm', action: async () => {} });

  const isSuspended = profile?.metadata?.suspended === true;

  useEffect(() => {
    if (!profile?.id) return;
    const fetchRelated = async () => {
      setLoading(true);
      try {
        const [coursesRes, booksRes, enrollRes, logsRes, menteesRes] = await Promise.all([
          nexus.database.from('courses').select('id, title, status, created_at').eq('tutor_id', profile.id),
          nexus.database.from('api_books').select('id, title, status, created_at').eq('author_id', profile.id),
          // Keyed on user_id: enrollments has no `student_id` column, so this
          // returned nothing and the modal always showed zero enrolments.
          nexus.database.from('enrollments').select('id, item_id, course_id, item_title, created_at').eq('user_id', profile.id).limit(100),
          nexus.database.from('admin_audit_logs').select('*').or(`target_id.eq.${profile.id},admin_id.eq.${profile.id}`).order('created_at', { ascending: false }).limit(20),
          // Mentees are the learners enrolled in this mentor's courses. The
          // previous query matched `course_id` against the *mentor's* profile
          // id — never a course id — and embedded through a foreign key named
          // after the non-existent student_id column, so the mentee list was
          // permanently empty. Resolved in two steps below instead.
          Promise.resolve({ data: [] }),
        ]);
        const ownCourses = coursesRes.data || [];
        setCourses(ownCourses);
        setBooks(booksRes.data || []);
        setEnrollments(enrollRes.data || []);
        setAuditLogs(logsRes.data || []);
        setMentees(menteesRes.data || []);

        // Learners enrolled in this mentor's courses: find the courses first,
        // then the enrolments pointing at them. enrollments records the course
        // on item_id (checkout) or course_id (payment webhook), so both are
        // matched.
        const isMentor = profile.role === 'mentor' || profile.role === 'tutor';
        if (isMentor && ownCourses.length > 0) {
          const courseIds = ownCourses.map((c: any) => c.id);
          const idList = `(${courseIds.join(',')})`;
          const { data: enrolled } = await nexus.database
            .from('enrollments')
            .select('user_id, item_title')
            .or(`item_id.in.${idList},course_id.in.${idList}`)
            .limit(100);

          const learnerIds = Array.from(new Set((enrolled || []).map((e: any) => e.user_id).filter(Boolean)));
          if (learnerIds.length > 0) {
            const { data: learners } = await nexus.database
              .from('public_profiles')
              .select('id, full_name, avatar_url')
              .in('id', learnerIds);
            setMentees(learners || []);
          }
        }
      } catch (err) {
        console.error('[UserProfileModal] Fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchRelated();
  }, [profile?.id]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handleSuspend = () => {
    if (!suspensionReason.trim()) return;
    setConfirmDialog({
      open: true,
      title: isSuspended ? 'Restore User Account' : 'Suspend User Account',
      message: isSuspended
        ? `This will reactivate ${profile.full_name}'s account and restore full access.`
        : `This will suspend ${profile.full_name}'s account. They will lose access to all platform features.`,
      variant: isSuspended ? 'info' : 'warning',
      confirmLabel: isSuspended ? 'Restore Account' : 'Suspend Account',
      action: async () => {
        if (!currentUser?.id) return;
        setSubmitting(true);
        try {
          await adminService.setUserSuspension(
            profile.id,
            !isSuspended,
            currentUser.id,
            isSuspended ? 'Account restored by administrator' : suspensionReason
          );
          setSuspensionReason('');
          onRefresh();
          onClose();
        } catch (err) {
          console.error('Suspension error:', err);
        } finally {
          setSubmitting(false);
        }
      },
    });
  };

  const handleDelete = () => {
    setConfirmDialog({
      open: true,
      title: 'Permanently Delete User',
      message: `This will permanently delete ${profile.full_name}'s account and all associated data (enrollments, applications, admin roles). This action cannot be undone.`,
      variant: 'danger',
      confirmLabel: 'Delete Forever',
      action: async () => {
        if (!currentUser?.id) return;
        setSubmitting(true);
        try {
          await adminService.deleteUser(profile.id, currentUser.id);
          onRefresh();
          onClose();
        } catch (err) {
          console.error('Delete error:', err);
        } finally {
          setSubmitting(false);
        }
      },
    });
  };

  const handleDownloadPDF = () => {
    generateProfilePDF({
      fullName: profile.full_name,
      email: profile.email,
      role: profile.role,
      country: profile.country,
      bio: profile.bio || profile.metadata?.bio,
      avatarUrl: profile.avatar_url,
      userId: profile.id,
      joinDate: profile.created_at,
      status: isSuspended ? 'suspended' : 'active',
    });
  };

  const meta = profile?.metadata || {};
  const onboardData = meta?.onboarding_data;
  const credentials = meta?.pending_mentor_data?.qualifications?.credentials || onboardData?.credentials || [];

  const profileCompletion = useMemo(() => {
    let score = 30;
    if (profile.full_name) score += 15;
    if (profile.avatar_url) score += 15;
    if (profile.bio || meta?.bio) score += 15;
    if (profile.expertise || meta?.expertise) score += 15;
    if (meta?.qualifications) score += 10;
    return Math.min(score, 100);
  }, [profile]);

  return (
    <>
      <div className="fixed inset-0 z-[999] flex">
        {/* Backdrop */}
        <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={onClose} />

        {/* Panel */}
        <div className="relative ml-auto w-full max-w-2xl bg-white shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-300 overflow-hidden">
          {/* Sticky header */}
          <div className="px-6 py-4 border-b border-slate-200/80 bg-white shrink-0 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <img
                src={profile.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.id}`}
                className="w-14 h-14 rounded-2xl object-cover bg-slate-100 border-2 border-slate-200 shadow-sm"
                alt="Avatar"
              />
              <div className="min-w-0">
                <h2 className="text-lg font-extrabold text-slate-900 truncate leading-tight">{profile.full_name}</h2>
                <p className="text-xs text-slate-500 font-bold truncate mt-0.5">{profile.email}</p>
                <div className="flex gap-2 mt-1.5 flex-wrap">
                  <span className="px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-[9px] font-black text-indigo-700 uppercase tracking-wider">
                    {profile.role}
                  </span>
                  <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
                    isSuspended
                      ? 'bg-red-50 border border-red-200 text-red-700'
                      : 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                  }`}>
                    {isSuspended ? 'Suspended' : 'Active'}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-[9px] font-bold text-slate-500">
                    {profileCompletion}% Complete
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-all shrink-0"
            >
              <X size={18} />
            </button>
          </div>

          {/* Action bar */}
          <div className="px-6 py-3 border-b border-slate-100 bg-slate-50/50 shrink-0 flex flex-wrap gap-2">
            <button onClick={handleDownloadPDF} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold transition-all active:scale-95 shadow-sm">
              <Download size={12} /> Download PDF
            </button>
            <button
              onClick={() => {
                if (isSuspended) {
                  setSuspensionReason('Account restored');
                  handleSuspend();
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold transition-all active:scale-95 shadow-sm ${
                isSuspended
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
              disabled={!isSuspended}
            >
              <RotateCcw size={12} /> Restore
            </button>
            <button onClick={handleDelete} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold transition-all active:scale-95 shadow-sm">
              <Trash2 size={12} /> Delete
            </button>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-8 h-8 border-3 border-slate-200 border-t-emerald-600 rounded-full animate-spin" />
              </div>
            ) : (
              <>
                {/* Bio & Basic Info */}
                <Section title="Profile Information" icon={<Users size={14} className="text-indigo-600" />}>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Full Name</span>
                      <span className="font-bold text-slate-800 mt-0.5 block">{profile.full_name}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Email</span>
                      <span className="font-bold text-slate-800 mt-0.5 block">{profile.email}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Country</span>
                      <span className="font-bold text-slate-800 mt-0.5 block">{profile.country || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Joined</span>
                      <span className="font-bold text-slate-800 mt-0.5 block">{profile.created_at ? formatDate(profile.created_at) : 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Last Active</span>
                      <span className="font-bold text-slate-800 mt-0.5 block">
                        {profile.updated_at ? formatDistanceToNow(new Date(profile.updated_at), { addSuffix: true }) : 'Unknown'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Phone</span>
                      <span className="font-bold text-slate-800 mt-0.5 block">{profile.phone_number || 'N/A'}</span>
                    </div>
                  </div>
                  {profile.bio && (
                    <div className="mt-4">
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">Bio</span>
                      <p className="text-xs text-slate-600 font-medium leading-relaxed bg-slate-50 border border-slate-100 rounded-xl p-3">
                        {profile.bio}
                      </p>
                    </div>
                  )}
                  {profile.expertise && profile.expertise.length > 0 && (
                    <div className="mt-4">
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-2">Expertise</span>
                      <div className="flex flex-wrap gap-1.5">
                        {profile.expertise.map((e: any, i: number) => (
                          <span key={i} className="px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-[10px] font-bold text-indigo-700">
                            {e.desc || e.type}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </Section>

                {/* Credentials & Documents */}
                <Section title="Documents & Credentials" icon={<FileText size={14} className="text-amber-600" />} defaultOpen={credentials.length > 0}>
                  {credentials.length === 0 ? (
                    <p className="text-xs text-slate-400 font-medium italic">No uploaded documents or credentials found.</p>
                  ) : (
                    <ul className="space-y-2">
                      {credentials.map((cred: any, idx: number) => (
                        <li key={idx} className="flex items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200/60 rounded-xl">
                          <span className="font-bold text-xs text-slate-800 truncate max-w-[200px]" title={cred.value}>
                            📄 {cred.value} <span className="text-[9px] text-slate-400 font-normal">({cred.type})</span>
                          </span>
                          <div className="flex gap-1.5 shrink-0">
                            <button
                              onClick={() => setPreviewingDoc({ name: cred.value, url: cred.url })}
                              className="px-2.5 py-1.5 text-[10px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors flex items-center gap-1"
                            >
                              <Eye size={10} /> View
                            </button>
                            {cred.url && (
                              <a
                                href={cred.url}
                                target="_blank"
                                rel="noreferrer"
                                className="px-2.5 py-1.5 text-[10px] font-bold text-slate-600 bg-white hover:bg-slate-50 rounded-lg border border-slate-200 transition-colors flex items-center gap-1"
                              >
                                <ExternalLink size={10} /> Open
                              </a>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  {onboardData?.profile?.cv_uploaded && (
                    <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-800 truncate">📄 CV: {onboardData.profile.cv_uploaded}</span>
                      <button
                        onClick={() => setPreviewingDoc({ name: onboardData.profile.cv_uploaded })}
                        className="px-2.5 py-1.5 text-[10px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors flex items-center gap-1"
                      >
                        <Eye size={10} /> View
                      </button>
                    </div>
                  )}
                </Section>

                {/* Enrolled Courses */}
                <Section title={`Enrolled Courses (${enrollments.length})`} icon={<BookOpen size={14} className="text-emerald-600" />} defaultOpen={false}>
                  {enrollments.length === 0 ? (
                    <p className="text-xs text-slate-400 font-medium italic">No course enrollments.</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {enrollments.map((e: any) => (
                        <div key={e.id} className="flex justify-between items-center px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs">
                          <span className="font-bold text-slate-800 truncate">{e.item_title || e.course_id || e.item_id}</span>
                          <span className="text-[10px] text-slate-400 font-mono shrink-0">{e.created_at ? formatDate(e.created_at) : ''}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Section>

                {/* Created Courses (if mentor/tutor) */}
                {courses.length > 0 && (
                  <Section title={`Created Courses (${courses.length})`} icon={<BookOpen size={14} className="text-blue-600" />} defaultOpen={false}>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {courses.map((c: any) => (
                        <div key={c.id} className="flex justify-between items-center px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs">
                          <span className="font-bold text-slate-800 truncate">{c.title}</span>
                          <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${
                            c.status === 'published' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                            c.status === 'draft' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                            'bg-slate-100 text-slate-500 border border-slate-200'
                          }`}>{c.status}</span>
                        </div>
                      ))}
                    </div>
                  </Section>
                )}

                {/* Published Books */}
                {books.length > 0 && (
                  <Section title={`Published Books (${books.length})`} icon={<BookOpen size={14} className="text-purple-600" />} defaultOpen={false}>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {books.map((b: any) => (
                        <div key={b.id} className="flex justify-between items-center px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs">
                          <span className="font-bold text-slate-800 truncate">{b.title}</span>
                          <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${
                            b.status === 'published' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                            'bg-slate-100 text-slate-500 border border-slate-200'
                          }`}>{b.status}</span>
                        </div>
                      ))}
                    </div>
                  </Section>
                )}

                {/* Security & Verification */}
                <Section title="Security & Verification" icon={<ShieldCheck size={14} className="text-red-600" />} defaultOpen={false}>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div className="flex items-center gap-2">
                      {meta?.id_verified
                        ? <ShieldCheck size={14} className="text-emerald-500" />
                        : <AlertCircle size={14} className="text-amber-500" />}
                      <span className="font-bold text-slate-800">{meta?.id_verified ? 'ID Verified' : 'Unverified Identity'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">User ID</span>
                      <span className="font-mono text-slate-600 text-[10px] mt-0.5 block break-all">{profile.id}</span>
                    </div>
                  </div>

                  {/* Suspension controls */}
                  <div className="mt-4 p-4 bg-slate-50 border border-slate-200/60 rounded-xl space-y-3">
                    <p className="text-xs font-extrabold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                      <Lock size={12} className="text-slate-400" /> Account Control
                    </p>
                    <input
                      type="text"
                      placeholder={isSuspended ? 'Reason for restoration...' : 'Reason for suspension...'}
                      value={suspensionReason}
                      onChange={e => setSuspensionReason(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                    <button
                      onClick={handleSuspend}
                      disabled={!suspensionReason.trim() || submitting}
                      className={`w-full py-2.5 rounded-xl text-xs font-extrabold transition-all active:scale-[0.98] disabled:opacity-50 ${
                        isSuspended
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          : 'bg-amber-600 hover:bg-amber-700 text-white'
                      }`}
                    >
                      {isSuspended ? '✅ Restore Account' : '🚫 Suspend Account'}
                    </button>
                  </div>
                </Section>

                {/* Audit Trail */}
                <Section title={`Audit Trail (${auditLogs.length})`} icon={<Activity size={14} className="text-cyan-600" />} defaultOpen={false}>
                  {auditLogs.length === 0 ? (
                    <p className="text-xs text-slate-400 font-medium italic">No audit log records for this user.</p>
                  ) : (
                    <div className="space-y-2 max-h-56 overflow-y-auto">
                      {auditLogs.map((log: any) => (
                        <div key={log.id} className="pb-2 border-b border-slate-100 last:border-0 flex justify-between gap-4 text-xs">
                          <span className="text-slate-600 font-medium">
                            <span className="text-slate-400 font-mono text-[10px]">[{formatDate(log.created_at)}]</span>{' '}
                            <span className="font-bold text-slate-700">{log.action_type?.toUpperCase()}</span> — {log.reason}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </Section>
              </>
            )}
          </div>
        </div>
      </div>

      {/* File Viewer overlay */}
      {previewingDoc && (
        <FileViewer file={previewingDoc} onClose={() => setPreviewingDoc(null)} />
      )}

      {/* Confirm Dialog overlay */}
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
    </>
  );
};

export default React.memo(UserProfileModal);
