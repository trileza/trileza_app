import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { adminService } from '../../lib/services/admin';
import { useAuthStore } from '../../store/authStore';
import { generateBackupCodes } from '../../utils/secureRandom';
import { Mail, Lock, AlertTriangle, CheckCircle, Copy, Check } from 'lucide-react';

/**
 * Self-service admin application.
 *
 * The applicant signs in to the account the application is for, and the
 * database binds the request to that session. The previous version looked an
 * account up by email and filed an application for it, with a "verification
 * code" generated and checked in the browser — so anyone could apply on anyone
 * else's behalf.
 */
const GateRegister: React.FC = () => {
  const navigate = useNavigate();
  const { user, signIn } = useAuthStore();

  // Step state: 1 = Form, 2 = Show Backup Codes
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('role') || 'content_manager';
  });
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Backup codes state
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const rolesList = [
    { value: 'content_manager', label: 'Content Manager (Course/Book Review)' },
    { value: 'user_manager', label: 'User Manager (Profile Auditing/Suspensions)' },
    { value: 'finance_admin', label: 'Finance Admin (Payout processing)' },
    { value: 'support_agent', label: 'Support Agent (Helpdesk/Triage)' },
    { value: 'compliance_officer', label: 'Compliance Officer (DMCA/GDPR)' },
    { value: 'analytics_viewer', label: 'Analytics Viewer (Read-only reports)' }
  ];

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreeTerms) {
      setError('You must accept the Admin Terms and Conditions to proceed.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Signing in proves ownership of the account; InsForge only issues a
      // session for a verified email.
      if (!user) {
        if (!email.trim() || !password) {
          setError('Sign in with the LMS account you want to use for admin access.');
          setLoading(false);
          return;
        }
        const { error: signInError } = await signIn(email.trim(), password);
        if (signInError) {
          setError(signInError);
          setLoading(false);
          return;
        }
      }

      const generatedBackupCodes = generateBackupCodes(8);
      const res = await adminService.registerAdmin(role, generatedBackupCodes);

      if (res.error) {
        const errMsg = typeof res.error === 'object' ? (res.error as any).message || '' : String(res.error);
        const errCode = typeof res.error === 'object' ? (res.error as any).code : '';
        if (errCode === '23505' || errMsg.includes('already')) {
          setError('This account already holds or has requested admin access.');
        } else {
          setError(errMsg || 'Your application could not be submitted.');
        }
        setLoading(false);
        return;
      }

      setBackupCodes(generatedBackupCodes);
      setStep(2);
    } catch (err: any) {
      setError(err?.message || 'An error occurred while submitting your application.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCodes = () => {
    navigator.clipboard.writeText(backupCodes.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden select-none">
      {/* Background Orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Main Container */}
      <div className="max-w-md w-full z-10 space-y-8">
        <div className="text-center">
          <img src="/icon-192.png" alt="Trileza Logo" className="w-16 h-16 object-contain mx-auto mb-6 drop-shadow-md animate-pulse" />
          <h1 className="text-3xl font-black text-white uppercase tracking-wider">Admin Enrollment</h1>
          <p className="text-slate-400 text-sm mt-2">Apply for administrative access</p>
        </div>

        {/* Card Container */}
        <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/80 rounded-3xl p-8 shadow-2xl relative text-left">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-start gap-3 mb-6">
              <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-red-400 uppercase tracking-wider">Protocol Halted</p>
                <p className="text-xs text-red-200 mt-1 leading-relaxed">{error}</p>
              </div>
            </div>
          )}

          {step === 1 && (
            <form onSubmit={handleApply} className="space-y-6">
              {user ? (
                <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800/60 text-xs text-slate-400 leading-relaxed">
                  Applying as <strong className="text-slate-200">{user.email}</strong>. To apply with a different account, sign out first.
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                      LMS Account Email
                    </label>
                    <div className="relative">
                      <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="email"
                        required
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="admin@yourlms.com"
                        className="w-full h-12 bg-slate-950/60 border border-slate-800 rounded-xl pl-11 pr-4 text-sm text-white focus:outline-none focus:border-emerald-500 transition-all font-medium placeholder-slate-700"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                      Password
                    </label>
                    <div className="relative">
                      <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="password"
                        required
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Your LMS account password"
                        className="w-full h-12 bg-slate-950/60 border border-slate-800 rounded-xl pl-11 pr-4 text-sm text-white focus:outline-none focus:border-emerald-500 transition-all font-medium placeholder-slate-700"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                  Role Assignment Selection
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full h-12 bg-slate-950/60 border border-slate-800 rounded-xl px-4 text-sm text-white focus:outline-none focus:border-emerald-500 transition-all font-medium"
                >
                  {rolesList.map((r) => (
                    <option key={r.value} value={r.value} className="bg-slate-900 text-white">
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-start gap-3 bg-slate-950/40 p-4 rounded-xl border border-slate-800/60">
                <input
                  type="checkbox"
                  id="terms"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="mt-1 rounded accent-emerald-500"
                />
                <label htmlFor="terms" className="text-xs text-slate-400 leading-relaxed cursor-pointer select-none">
                  I accept the <strong>Trileza Administrative Code of Conduct</strong> and agree to handle all user and compliance data strictly according to regulations.
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-450 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-600/20 active:scale-[0.98] disabled:opacity-55 disabled:scale-100 flex items-center justify-center gap-2"
              >
                {loading ? 'Submitting Application...' : 'Submit Admin Application'}
              </button>
            </form>
          )}

          {step === 2 && (
            <div className="space-y-6 text-center">
              <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto text-xl">
                <CheckCircle size={24} />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-white uppercase tracking-wide">Backup Codes Generated</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Save these codes in a secure location. They allow access to your admin account if you lose email access. Each code can be used exactly once.
                </p>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 font-mono text-xs text-left grid grid-cols-2 gap-2 text-slate-300">
                {backupCodes.map((c) => (
                  <div key={c} className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                    <span>{c}</span>
                  </div>
                ))}
              </div>

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={handleCopyCodes}
                  className="flex-1 h-12 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 text-sm transition-all"
                >
                  {copied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                  <span>{copied ? 'Copied!' : 'Copy to Clipboard'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/signin')}
                  className="flex-1 h-12 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-450 text-white font-bold rounded-xl text-sm transition-all"
                >
                  Proceed to Login
                </button>
              </div>

              <p className="text-[10px] text-slate-500 italic mt-4">
                * Note: Your admin access is currently PENDING Super Admin approval. You will receive an email once approved.
              </p>
            </div>
          )}
        </div>

        {/* Footnote */}
        <div className="text-center">
          <Link to="/signin" className="text-xs text-slate-450 hover:text-white transition-colors">
            Return to Login Deck
          </Link>
        </div>
      </div>
    </div>
  );
};

export default GateRegister;
