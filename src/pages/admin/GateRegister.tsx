import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { adminService } from '../../lib/services/admin';
import { nexus } from '../../lib/nexus';
import { Shield, Mail, User, AlertTriangle, CheckCircle, Copy, Check } from 'lucide-react';

const GateRegister: React.FC = () => {
  const navigate = useNavigate();

  // Step state: 1 = Form, 2 = Verify Test Code, 3 = Show Backup Codes
  const [step, setStep] = useState(1);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('role') || 'content_manager';
  });
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Verification state
  const [testCode, setTestCode] = useState('');
  const [sentCode, setSentCode] = useState('');
  const [resolvedUserId, setResolvedUserId] = useState('');

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

  // Step 1: Validate email existence & send test verification code
  const handleInitiateVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) {
      setError('Please provide your name and email address.');
      return;
    }
    if (!agreeTerms) {
      setError('You must accept the Admin Terms and Conditions to proceed.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Find matching user in profiles
      const { data: profileList, error: profileErr } = await nexus.database
        .from('profiles')
        .select('id')
        .eq('email', email.trim())
        .limit(1);

      if (profileErr || !profileList || profileList.length === 0) {
        setError('Verification failed: No learning account found with this email. Admins must possess an existing LMS profile.');
        setLoading(false);
        return;
      }

      setResolvedUserId(profileList[0].id);

      // Generate a test code
      const generatedCode = Math.floor(100000 + Math.random() * 900000).toString();
      setSentCode(generatedCode);

      // Send email
      try {
        await nexus.emails.send({
          to: email.trim(),
          subject: 'Confirm Your Trileza Admin 2FA Setup',
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
              <h2 style="color: #0f172a; margin-bottom: 24px; text-align: center;">Confirm Admin Email</h2>
              <p>Hello ${fullName},</p>
              <p>We received an application to set up admin access for your email. To verify and complete the 2FA setup, use the code below:</p>
              <div style="font-size: 32px; font-weight: 800; letter-spacing: 6px; padding: 16px; background-color: #f1f5f9; color: #10b981; text-align: center; border-radius: 8px; margin: 20px 0;">
                ${generatedCode}
              </div>
              <p>This code confirms your email is active and links it to mandatory admin 2FA.</p>
              <p>If you did not request this, please ignore this email.</p>
              <p style="margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px; font-size: 12px; color: #64748b;">
                - Trileza Admin Team
              </p>
            </div>
          `
        });
        console.log(`[Test Code Sent]: Code is ${generatedCode}`);
      } catch (err) {
        console.warn('[Test Code Email Error - Fallback]:', err);
        console.log(`\n==========================================\n[TEST EMAIL FALLBACK]\nTo: ${email}\nCode: ${generatedCode}\n==========================================\n`);
        alert(`[DEV MODE FALLBACK]\nEmail delivery failed (SMTP not configured on backend).\n\nYour Admin Verification Code is:\n\n${generatedCode}\n\n(Use this code to proceed)`);
      }

      setStep(2);
    } catch (err: any) {
      setError(err?.message || 'An error occurred during security checks.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify test code and complete registration
  const handleVerifyAndRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (testCode.trim() !== sentCode) {
      setError('Invalid test code. Please check your email or console log.');
      return;
    }

    setLoading(true);
    setError(null);

    // Generate 8 backup codes
    const generatedBackupCodes = Array.from({ length: 8 }, () => {
      const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
      let code = '';
      for (let i = 0; i < 8; i++) {
        if (i === 4) code += '-';
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return code;
    });

    setBackupCodes(generatedBackupCodes);

    try {
      const res = await adminService.registerAdmin(resolvedUserId, email.trim(), role, generatedBackupCodes);
      if (res.error) {
        const errMsg = typeof res.error === 'object' ? res.error.message || '' : String(res.error);
        const errCode = typeof res.error === 'object' ? (res.error as any).code : '';
        if (errMsg.includes('duplicate key') || errCode === '23505') {
          setError(`You have already registered an application for the ${role.replace('_', ' ')} role.`);
        } else {
          setError(errMsg);
        }
        setLoading(false);
      } else {
        setStep(3);
      }
    } catch (err: any) {
      setError(err?.message || 'An error occurred while creating admin account.');
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
          <img src="/logo.png" alt="Trileza Logo" className="w-16 h-16 object-contain mx-auto mb-6 drop-shadow-md animate-pulse" />
          <h1 className="text-3xl font-black text-white uppercase tracking-wider">Admin Enrollment</h1>
          <p className="text-slate-400 text-sm mt-2">Initialize your administrative access</p>
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
            <form onSubmit={handleInitiateVerify} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                  Full Name
                </label>
                <div className="relative">
                  <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Dr. Amina Hassan"
                    className="w-full h-12 bg-slate-950/60 border border-slate-800 rounded-xl pl-11 pr-4 text-sm text-white focus:outline-none focus:border-emerald-500 transition-all font-medium placeholder-slate-700"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                  LMS Account Email
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@yourlms.com"
                    className="w-full h-12 bg-slate-950/60 border border-slate-800 rounded-xl pl-11 pr-4 text-sm text-white focus:outline-none focus:border-emerald-500 transition-all font-medium placeholder-slate-700"
                  />
                </div>
              </div>

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
                {loading ? 'Processing Ledger...' : 'Link Email & Setup 2FA'}
              </button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleVerifyAndRegister} className="space-y-6">
              <div className="text-center space-y-4">
                <p className="text-xs text-slate-400 leading-relaxed">
                  We sent a test 2FA verification code to confirm your email is valid. Enter it below to complete 2FA setup:
                </p>
                <input
                  type="text"
                  maxLength={6}
                  value={testCode}
                  onChange={(e) => setTestCode(e.target.value)}
                  placeholder="123456"
                  className="w-full h-14 bg-slate-950/80 border border-slate-800 rounded-xl text-center text-2xl font-mono tracking-widest text-white focus:outline-none focus:border-emerald-500 transition-all placeholder-slate-800"
                  disabled={loading}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-450 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-600/20 active:scale-[0.98] disabled:opacity-55 disabled:scale-100 flex items-center justify-center gap-2"
              >
                {loading ? 'Finalizing Profile...' : 'Confirm Test Code & Complete 2FA'}
              </button>

              <div className="p-4 bg-slate-900/20 border border-slate-800/50 rounded-2xl text-[11px] text-slate-500 leading-relaxed text-center font-mono">
                🚨 DEV NOTE: Look in your Console logs to retrieve the generated test code.
              </div>
            </form>
          )}

          {step === 3 && (
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
