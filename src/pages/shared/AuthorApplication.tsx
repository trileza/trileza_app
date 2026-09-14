import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ShieldCheck, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  ArrowRight, 
  PenTool, 
  FileCheck,
  CheckCircle,
  XCircle,
  HelpCircle
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { Card, Button } from '../../components/ui';
import PageHeader from '../../components/shared/PageHeader';

import { nexus } from '../../lib/nexus';
import { publishUserEvent } from '../../lib/services/realtimeEvents';

interface AuthorApplicationRecord {
  id: string;
  userId: string;
  userEmail: string;
  penName: string;
  category: string;
  agreedToTerms: boolean;
  status: 'pending' | 'approved' | 'denied';
  submittedAt: string;
  rejectionReason?: string;
}

const CATEGORIES = [
  'Academics & Spatial Design',
  'Systems & Architecture',
  'Elite Professional Growth',
  'Technology & Software',
  'Fiction & Literature',
  'Self-Help & Mindset'
];

interface AuthorApplicationProps {
  inline?: boolean;
  onClose?: () => void;
}

const AuthorApplication: React.FC<AuthorApplicationProps> = ({ inline = false, onClose }) => {
  const { user, updateProfile } = useAuthStore();
  const navigate = useNavigate();

  // Form State
  const [penName, setPenName] = useState(user?.full_name || '');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Application Pipeline State
  const [applications, setApplications] = useState<AuthorApplicationRecord[]>([]);
  const [currentApp, setCurrentApp] = useState<AuthorApplicationRecord | null>(null);
  const [isApplyingNew, setIsApplyingNew] = useState(false);

  // Fetch from database
  const fetchApplications = async () => {
    if (!user?.id) return;
    try {
      const { data, error: dbErr } = await nexus.database
        .from('author_applications')
        .select('*')
        .order('submitted_at', { ascending: false });

      if (data && !dbErr) {
        const appsList: AuthorApplicationRecord[] = data.map((d: any) => ({
          id: d.id,
          userId: d.user_id,
          userEmail: d.user_email,
          penName: d.pen_name,
          category: d.category,
          agreedToTerms: d.agreed_to_terms,
          status: d.status,
          submittedAt: d.submitted_at,
          rejectionReason: d.rejection_reason || undefined
        }));

        setApplications(appsList);
        const userApp = appsList.find(app => app.userId === user.id);
        setCurrentApp(userApp || null);
      }
    } catch (e) {
      console.error('[Error fetching applications from DB]:', e);
    }
  };

  // Initialize and load author applications
  useEffect(() => {
    fetchApplications();
  }, [user]);

  // Sync approval immediately if Admin approved the user metadata
  useEffect(() => {
    if (user?.metadata?.is_author && currentApp && currentApp.status !== 'approved') {
      // Auto-redirect to dashboard after a delay
      const timer = setTimeout(() => {
        if (inline && onClose) {
          onClose();
        } else {
          navigate('/author/dashboard');
        }
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [user, currentApp, navigate, inline, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError(null);

    if (!penName.trim()) {
      setError('Please provide a Pen Name or your Full Name.');
      return;
    }
    if (!agreed) {
      setError('You must agree to the platform publishing terms to proceed.');
      return;
    }

    setIsSubmitting(true);

    try {
      const appId = `app-${Date.now()}`;
      const { error: dbErr } = await nexus.database.from('author_applications').insert({
        id: appId,
        user_id: user.id,
        user_email: user.email,
        pen_name: penName.trim(),
        category: category,
        agreed_to_terms: true,
        status: 'pending',
        submitted_at: new Date().toISOString()
      });

      if (dbErr) throw dbErr;

      // Realtime event for immediate Super Admin & Content Manager sync
      publishUserEvent('author_application_submitted', {
        userId: user.id,
        userEmail: user.email,
        penName: penName.trim(),
        category,
        submittedAt: new Date().toISOString()
      });

      await fetchApplications();
      setIsApplyingNew(false);

      // Trigger standard visual notification
      const notificationEvent = new CustomEvent('show-notification', {
        detail: { message: 'Author application submitted successfully! Under review.', type: 'success' }
      });
      window.dispatchEvent(notificationEvent);
    } catch (err: any) {
      setError(err.message || 'An error occurred during submission.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReapply = async () => {
    if (!user) return;
    try {
      const { error: dbErr } = await nexus.database
        .from('author_applications')
        .delete()
        .eq('user_id', user.id);

      if (dbErr) throw dbErr;

      await fetchApplications();
      setAgreed(false);
    } catch (e: any) {
      setError(e.message || 'Failed to reset application.');
    }
  };

  return (
    <div className={inline ? "space-y-6 font-sans" : "container mx-auto px-4 pb-20 animate-in fade-in duration-500 space-y-8 font-sans"}>
      {!inline && (
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center p-2 shadow-sm">
            <img src="/icon-192.png" alt="Trileza Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <span className="font-extrabold text-lg text-slate-900 dark:text-white">Trileza Author Registry</span>
          </div>
        </div>
      )}
      {!inline && (
        <PageHeader 
          title={
            <span>
              Publisher <span className="text-emerald-500">Onboarding</span>
            </span>
          }
          description="Unlock your capabilities to author elite blueprints, curriculum structures, case studies, and resources."
          tag="Creative Registry"
          icon={PenTool}
        />
      )}

      {inline && (
        <div className="space-y-1 mb-2">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <PenTool size={20} className="text-emerald-500 animate-pulse" /> Creator Registry Onboarding
          </h2>
          <p className="text-sm font-medium text-slate-400">Unlock your capabilities to publish elite books, templates, and case studies.</p>
        </div>
      )}

      <div className={inline ? "w-full" : "max-w-2xl mx-auto"}>
        {/* CASE 1: APPROVED AUTHOR STATUS */}
        {currentApp?.status === 'approved' && (
          <Card className="p-10 border-none shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] rounded-[3rem] bg-white text-center space-y-8">
            <div className="mx-auto w-24 h-24 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500 shadow-md shadow-emerald-500/10">
              <ShieldCheck size={48} strokeWidth={2} />
            </div>
            <div className="space-y-3">
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">Publisher Account Active</h2>
              <p className="text-slate-500 font-medium text-lg max-w-lg mx-auto">
                Congratulations, **{currentApp.penName}**! You are an approved Author on Trileza.
              </p>
            </div>
            <div className="p-6 bg-slate-50 rounded-3xl inline-block text-left text-sm max-w-md mx-auto border border-slate-100 shadow-inner">
              <p className="font-bold text-slate-700 mb-2">Publishing Permissions Granted:</p>
              <ul className="space-y-2 text-slate-500 font-medium">
                <li className="flex items-center gap-2">
                  <CheckCircle size={14} className="text-emerald-500" /> Direct upload of e-books & case studies
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle size={14} className="text-emerald-500" /> Simulated royalties & distribution metrics
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle size={14} className="text-emerald-500" /> Integration inside the Public Library display
                </li>
              </ul>
            </div>
            <div>
              <Button 
                onClick={() => {
                  if (inline && onClose) {
                    onClose();
                  } else {
                    navigate('/author/dashboard');
                  }
                }}
                className="bg-brand-primary hover:bg-brand-primary-hover text-white border-none shadow-xl shadow-emerald-500/20 rounded-2xl h-14 px-8 font-black uppercase text-[10px] tracking-widest gap-2"
              >
                {inline ? 'Access Workspace Console' : 'Go to Author Dashboard'} <ArrowRight size={14} />
              </Button>
            </div>
          </Card>
        )}

        {/* CASE 2: PENDING REVIEW STATUS */}
        {currentApp?.status === 'pending' && !isApplyingNew && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="lg:col-span-2 p-10 border-none shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] rounded-[3rem] bg-white space-y-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-500 flex items-center justify-center shadow-inner">
                  <Clock size={24} />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">Application Pending Review</h3>
                  <p className="text-slate-400 font-medium text-sm">Submitted on {new Date(currentApp.submittedAt).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="space-y-6">
                <p className="text-slate-500 font-medium leading-relaxed">
                  Your request is being reviewed by a Trileza Administrator. This verification ensures our library maintains highest quality learning assets.
                </p>

                <div className="p-6 bg-slate-50/70 border border-slate-100 rounded-3xl space-y-4">
                  <h4 className="font-bold text-slate-800 text-base">Submitted Details:</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm font-medium">
                    <div>
                      <span className="text-slate-450 block text-xs font-black uppercase tracking-wider">Pen Name / Owner</span>
                      <span className="text-slate-700 font-bold">{currentApp.penName}</span>
                    </div>
                    <div>
                      <span className="text-slate-450 block text-xs font-black uppercase tracking-wider">Intended Category</span>
                      <span className="text-slate-700 font-bold">{currentApp.category}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* TIMELINE PROGRESS */}
              <div className="pt-6 border-t border-slate-100 space-y-6">
                <h4 className="font-black text-xs text-slate-400 uppercase tracking-widest">Verification Timeline</h4>
                <div className="relative pl-8 space-y-8 before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                  <div className="relative flex items-start gap-4">
                    <div className="absolute -left-8 w-7.5 h-7.5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/10 border-2 border-white z-10">
                      <CheckCircle2 size={14} />
                    </div>
                    <div>
                      <h5 className="font-bold text-slate-800">Form Submitted Successfully</h5>
                      <p className="text-xs text-slate-450 font-bold">Platform requirements verified & accepted</p>
                    </div>
                  </div>
                  <div className="relative flex items-start gap-4 animate-pulse">
                    <div className="absolute -left-8 w-7.5 h-7.5 rounded-full bg-orange-450 text-white flex items-center justify-center shadow-lg shadow-orange-500/15 border-2 border-white z-10">
                      <Clock size={14} />
                    </div>
                    <div>
                      <h5 className="font-bold text-slate-800">Under Administrator Review</h5>
                      <p className="text-xs text-slate-450 font-bold">Checking background, credentials & profile</p>
                    </div>
                  </div>
                  <div className="relative flex items-start gap-4">
                    <div className="absolute -left-8 w-7.5 h-7.5 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center border-2 border-white z-10">
                      <HelpCircle size={14} />
                    </div>
                    <div>
                      <h5 className="font-bold text-slate-400">Dashboard Provisioning</h5>
                      <p className="text-xs text-slate-400 font-medium">Automatic system profile configuration</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="pt-6 border-t border-slate-100 flex justify-end">
                <Button 
                  onClick={() => setIsApplyingNew(true)}
                  className="bg-brand-primary hover:bg-brand-primary-hover text-white border-none shadow-xl shadow-emerald-500/20 rounded-2xl h-14 px-8 font-black uppercase text-[10px] tracking-widest gap-2"
                >
                  <PenTool size={14} /> Submit Another Application
                </Button>
              </div>
            </Card>

            <div className="space-y-6">
              <Card className="p-8 border-none shadow-[0_24px_48px_-12px_rgba(0,0,0,0.05)] rounded-[2.5rem] bg-slate-900 text-white space-y-6 relative overflow-hidden animate-in zoom-in duration-500">
                <div className="relative z-10 space-y-6">
                  <h4 className="text-xl font-black tracking-tight">Need Quick Approval?</h4>
                  <p className="text-slate-350 text-xs font-medium leading-relaxed">
                    You are in the simulated interface! To test immediately, click the **Auto-Approve** button below to instantly activate your author privileges.
                  </p>
                  <Button 
                    onClick={async () => {
                      try {
                        // 1. Update application in DB to approved
                        await nexus.database
                          .from('author_applications')
                          .update({ status: 'approved' })
                          .eq('user_id', user.id);
                        
                        // 2. Update user profile metadata in Auth Store
                        const updatedMeta = { ...user.metadata, is_author: true };
                        await updateProfile({ metadata: updatedMeta });
                        
                        // 3. Reload application status
                        await fetchApplications();
                        
                        // 4. Trigger standard visual notification
                        const notificationEvent = new CustomEvent('show-notification', {
                          detail: { message: 'Author status auto-approved successfully!', type: 'success' }
                        });
                        window.dispatchEvent(notificationEvent);
                      } catch (e: any) {
                        alert('Failed to auto-approve: ' + e.message);
                      }
                    }}
                    className="w-full bg-emerald-400 hover:bg-emerald-500 text-slate-950 font-black py-3.5 rounded-2xl border-none shadow-lg text-[9px] uppercase tracking-widest transition-transform hover:scale-[1.02] flex items-center justify-center gap-2"
                  >
                    Auto-Approve Right Now (Dev Sim)
                  </Button>
                  <div className="pt-2">
                    <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl bg-white/10 text-emerald-400">
                      Simulation Mode
                    </span>
                  </div>
                </div>
                <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-[80px]" />
              </Card>
            </div>
          </div>
        )}

        {/* CASE 3: DENIED STATUS */}
        {currentApp?.status === 'denied' && !isApplyingNew && (
          <Card className="p-10 border-none shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] rounded-[3rem] bg-white space-y-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center shadow-inner">
                <XCircle size={24} />
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Application Denied</h3>
                <p className="text-slate-400 font-medium text-sm">Reviewed by Administrator</p>
              </div>
            </div>

            <div className="p-6 bg-rose-50/50 border border-rose-100 rounded-3xl space-y-3">
              <h4 className="font-bold text-rose-800 text-base flex items-center gap-2">
                <AlertTriangle size={18} /> Review Feedback:
              </h4>
              <p className="text-sm font-medium text-rose-700">
                {currentApp.rejectionReason || "Your application did not satisfy the platform's initial content policy. Please ensure your Pen Name matches your professional profile and re-submit."}
              </p>
            </div>

            <div className="pt-4 flex justify-start">
              <Button 
                onClick={handleReapply}
                className="bg-brand-primary hover:bg-brand-primary-hover text-white border-none shadow-xl shadow-emerald-500/20 rounded-2xl h-14 px-8 font-black uppercase text-[10px] tracking-widest"
              >
                Modify & Re-apply
              </Button>
            </div>
          </Card>
        )}

        {/* CASE 4: SUBMIT NEW APPLICATION */}
        {(!currentApp || isApplyingNew) && currentApp?.status !== 'approved' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="lg:col-span-2 p-10 border-none shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] rounded-[3rem] bg-white">
              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">Application Details</h3>
                  <p className="text-slate-450 font-medium text-sm">Provide basic details to establish your publisher account.</p>
                </div>

                {error && (
                  <div className="p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl text-sm font-medium flex items-center gap-3">
                    <AlertTriangle size={16} /> {error}
                  </div>
                )}

                <div className="space-y-6">
                  {/* Pen Name */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Author / Pen Name</label>
                    <input 
                      type="text" 
                      value={penName}
                      onChange={(e) => setPenName(e.target.value)}
                      placeholder="e.g. Dr. David Adamu"
                      className="w-full h-14 px-5 rounded-2xl bg-slate-50 border border-slate-200/60 focus:border-brand-primary focus:bg-white focus:outline-none text-slate-800 font-bold transition-all duration-300 shadow-sm"
                    />
                  </div>

                  {/* Intended Book Category */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Intended Book Category</label>
                    <select 
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full h-14 px-5 rounded-2xl bg-slate-50 border border-slate-200/60 focus:border-brand-primary focus:bg-white focus:outline-none text-slate-800 font-bold transition-all duration-300 shadow-sm appearance-none cursor-pointer"
                    >
                      {CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  {/* Terms checkbox */}
                  <div className="flex items-start gap-4 p-5 bg-slate-50/70 border border-slate-100 rounded-2xl shadow-inner">
                    <input 
                      type="checkbox" 
                      id="terms-checkbox"
                      checked={agreed}
                      onChange={(e) => setAgreed(e.target.checked)}
                      className="mt-1 w-5 h-5 rounded border-slate-200 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                    <label htmlFor="terms-checkbox" className="text-sm text-slate-550 font-medium leading-relaxed select-none cursor-pointer">
                      I agree to the **Trileza Creator Agreement** and **Content Publishing Guidelines**. I understand my works must be original, high-quality, and respect our intellectual policy (Strict Non-Downloadable DRM).
                    </label>
                  </div>
                </div>

                <div className="pt-4 flex justify-between">
                  {currentApp && isApplyingNew ? (
                    <Button 
                      type="button" 
                      onClick={() => setIsApplyingNew(false)}
                      variant="ghost"
                      className="h-14 px-8 font-black uppercase text-[10px] tracking-widest text-slate-500 hover:text-slate-700"
                    >
                      Cancel
                    </Button>
                  ) : <div />}
                  <Button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="bg-brand-primary hover:bg-brand-primary-hover text-white border-none shadow-xl shadow-emerald-500/20 rounded-2xl h-14 px-8 font-black uppercase text-[10px] tracking-widest gap-2"
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit Application'} <ArrowRight size={14} />
                  </Button>
                </div>
              </form>
            </Card>

            <div className="space-y-6">
              <Card className="p-8 border-none shadow-[0_24px_48px_-12px_rgba(0,0,0,0.05)] rounded-[2.5rem] bg-white space-y-6">
                <h4 className="text-lg font-black text-slate-900 tracking-tight">Publisher Policy</h4>
                <div className="space-y-4 text-sm font-medium text-slate-500">
                  <p className="leading-relaxed">
                    Trileza protects copyrights. Books uploaded here are protected by our advanced DRM wrapper.
                  </p>
                  <div className="flex gap-3 items-start text-xs font-bold text-slate-700">
                    <FileText className="text-emerald-500 shrink-0 mt-0.5" size={16} />
                    <span>No download support prevents piracy.</span>
                  </div>
                  <div className="flex gap-3 items-start text-xs font-bold text-slate-700">
                    <FileCheck className="text-emerald-500 shrink-0 mt-0.5" size={16} />
                    <span>Earn simulated royalties through mentor rentals.</span>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthorApplication;
