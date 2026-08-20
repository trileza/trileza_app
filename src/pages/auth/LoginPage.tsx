import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { Button, Card } from '../../components/ui';
import { LoadingOverlay } from '../../components/shared';
import { useAuthStore } from '../../store/authStore';
import { nexus } from '../../lib/nexus';
import type { UserRole } from '../../store/authStore';
import { 
  GraduationCap, 
  UserCircle, 
  ShieldCheck, 
  LayoutDashboard,
  Award,
  Users,
  Zap,
  Sparkles,
  Search,
  PlayCircle,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowLeft,
  Loader2,
  Phone,
  Camera,
  Briefcase,
  Download,
  BookOpen,
  Target,
  Globe,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../utils';

type AuthView = 'landing' | 'login' | 'signup' | 'verify';

const LoginPage = () => {
  const navigate = useNavigate();
  const { signIn, signUp, loading } = useAuthStore();
  const [view, setView] = useState<AuthView>('landing');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Check for suspension query param on mount
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('suspended') === 'true') {
      const reason = params.get('reason') || 'N/A';
      setError(`Account Restrained: Your access has been suspended by the administrator. Reason: ${reason}`);
      setView('login'); // Switch view directly to login form
    }
  }, []);

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole>('mentee');

  // Unified Profile State
  const [surname, setSurname] = useState('');
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState<string | undefined>(undefined);
  const [avatarFile, setAvatarFile] = useState<string | null>(null);
  const [signInAvatarUrl, setSignInAvatarUrl] = useState<string | null>(null);
  const [pendingRegistration, setPendingRegistration] = useState<any | null>(null);
  
  const [verificationCode, setVerificationCode] = useState(['', '', '', '', '', '']);

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text').trim();
    const digits = pastedText.replace(/\D/g, '').split('').slice(0, 6);
    
    if (digits.length > 0) {
      const newCode = [...verificationCode];
      digits.forEach((digit, i) => {
        if (i < 6) newCode[i] = digit;
      });
      setVerificationCode(newCode);
      
      const nextIdx = Math.min(digits.length, 5);
      const inputs = document.querySelectorAll('.otp-input');
      (inputs[nextIdx] as HTMLInputElement)?.focus();
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const { error } = await signIn(email, password);
    if (error) setError(error);
  };

  // Dynamic sign-in avatar lookup by email
  React.useEffect(() => {
    if (view !== 'login' || !email || !email.includes('@')) {
      setSignInAvatarUrl(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const { data, error } = await nexus.database
          .from('profiles')
          .select('avatar_url')
          .eq('email', email.trim().toLowerCase())
          .order('created_at', { ascending: false })
          .limit(1);

        if (!error && data && data.length > 0 && data[0].avatar_url) {
          setSignInAvatarUrl(data[0].avatar_url);
        } else {
          setSignInAvatarUrl(null);
        }
      } catch (err) {
        console.error('Error fetching signin avatar:', err);
      }
    }, 400); // 400ms debounce

    return () => clearTimeout(timer);
  }, [email, view]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    console.log('[SignUp] handleSignUp triggered');

    try {
      if (!avatarFile) {
        setError('Profile photo is required. Please upload a photo to register.');
        return;
      }
      
      if (password.length < 6) {
        setError('Password must be at least 6 characters');
        return;
      }

      const fullName = `${surname} ${firstName} ${middleName}`.trim();
      const avatarUrl = avatarFile;

      const metadata = {
        surname,
        firstName,
        middleName,
        phoneNumber,
        avatar_url: avatarUrl,
      };

      console.log('[SignUp] Calling signUp store action with:', { email, fullName, metadata });
      const { error: signUpError, requireVerification } = await signUp(email, password, fullName, 'mentee', metadata);
      
      console.log('[SignUp] signUp store action result:', { signUpError, requireVerification });

      if (signUpError) {
        setError(signUpError);
      } else if (requireVerification) {
        setPendingRegistration({
          email,
          fullName,
          role: 'mentee',
          metadata
        });
        
        setSuccessMsg(`Authentication code sent to ${email}`);
        setTimeout(() => {
          setSuccessMsg(null);
          setView('verify');
        }, 1500);
      } else {
        setSuccessMsg('Profile established! Redirecting...');
      }
    } catch (err: any) {
      console.error('[SignUp] Exception in handleSignUp:', err);
      setError(err?.message || 'An unexpected error occurred during signup.');
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const otp = verificationCode.join('');

    const pendingData = pendingRegistration;
    let registrationMetadata = null;
    if (pendingData && pendingData.email === email) {
      registrationMetadata = pendingData;
    }

    const { error } = await useAuthStore.getState().verifyEmail(email, otp, registrationMetadata);
    
    if (error) {
      setError(error);
    } else {
      setPendingRegistration(null);
      setSuccessMsg('Identity verified! Access established.');
    }
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setSurname('');
    setFirstName('');
    setMiddleName('');
    setPhoneNumber(undefined);
    setSelectedRole('mentee');
    setError(null);
    setSuccessMsg(null);
  };

  // ─── AUTH FORM (Login/Signup) ─────────────────────────────────
  // ─── AUTH FORM (Login/Signup) ─────────────────────────────────
  if (view === 'login' || view === 'signup') {
    return (
      <div className="min-h-screen bg-[#070c09] text-slate-100 flex items-center justify-center p-6 relative overflow-hidden font-sans">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none -z-10" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-indigo-500/10 rounded-full blur-[140px] pointer-events-none -z-10" />

        <header className="fixed top-0 left-0 w-full z-50 bg-[#070c09]/80 backdrop-blur-2xl border-b border-white/10 px-6 md:px-12 py-4 pt-safe flex items-center justify-between shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
          <button 
            onClick={() => { setView('landing'); resetForm(); }} 
            className="flex items-center gap-3 group cursor-pointer bg-transparent border-none outline-none"
          >
            <div className="w-12 h-12 flex items-center justify-center group-hover:scale-110 transition-all duration-300">
              <img 
                src="/logo.png" 
                alt="Trileza Logo" 
                className="w-full h-full object-contain scale-110 logo-white-dark filter brightness-0 invert drop-shadow-[0_2px_10px_rgba(255,255,255,0.3)]" 
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://api.dicebear.com/7.x/initials/svg?seed=Tr&backgroundColor=059669';
                }} 
              />
            </div>
            <span className="text-2xl font-black text-white tracking-tight hidden sm:block">Trileza</span>
          </button>
          
          <button 
            onClick={() => { setView('landing'); resetForm(); }}
            className="flex items-center gap-2 text-slate-300 hover:text-white transition-all text-sm font-bold bg-white/10 hover:bg-white/15 px-4 py-2 rounded-full border border-white/15 hover:border-white/30 shadow-lg cursor-pointer"
          >
            <ArrowLeft size={16} /> Back to Home
          </button>
        </header>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-2xl pt-24 pb-12"
        >
          <Card className="p-8 sm:p-10 border border-emerald-900/40 shadow-[0_30px_70px_-15px_rgba(0,0,0,0.9)] bg-[#0c1712] backdrop-blur-2xl rounded-[3rem] ring-1 ring-white/10">
            {view === 'login' && (
              <div className="flex justify-center mb-6">
                <div className="relative group">
                  <div className="absolute -inset-1 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 opacity-30 blur-md" />
                  {signInAvatarUrl ? (
                    <img 
                      src={signInAvatarUrl} 
                      className="relative w-20 h-20 rounded-full border-4 border-[#162a20] shadow-2xl object-cover bg-slate-900 animate-in fade-in zoom-in duration-300"
                      alt="User Avatar"
                    />
                  ) : (
                    <div className="relative w-20 h-20 rounded-full border-4 border-[#162a20] bg-[#122019] flex items-center justify-center text-slate-400 shadow-xl">
                      <User size={36} className="text-emerald-400" />
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="text-center mb-10">
              <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                {view === 'login' ? 'Welcome Back' : 'Join Trileza'}
              </h1>
              <p className="text-slate-400 font-medium mt-2 text-sm sm:text-base">
                {view === 'login' 
                  ? 'Sign in to your elite learning dashboard' 
                  : 'Create your detailed professional profile'}
              </p>
            </div>

            <form onSubmit={view === 'login' ? handleLogin : handleSignUp} className="space-y-7">
              {view === 'signup' && (
                <div className="flex flex-col items-center gap-4">
                  <div className="relative group cursor-pointer">
                    <input 
                      type="file" 
                      accept="image/*"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setAvatarFile(reader.result as string);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                    {avatarFile ? (
                      <img 
                        src={avatarFile} 
                        className="w-24 h-24 rounded-full bg-[#122019] ring-4 ring-emerald-500/40 shadow-2xl transition-all group-hover:scale-105 object-cover"
                        alt="Avatar Preview"
                      />
                    ) : (
                      <div className="w-24 h-24 rounded-full bg-[#122019] border-2 border-emerald-900/50 shadow-2xl transition-all group-hover:scale-105 flex items-center justify-center text-slate-400">
                        <User size={44} className="text-slate-400" />
                      </div>
                    )}
                    <div className="absolute bottom-0 right-0 p-2 rounded-full bg-emerald-500 text-slate-950 shadow-lg group-hover:bg-emerald-400 transition-colors z-0 font-bold">
                      <Camera size={15} />
                    </div>
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Upload Profile Picture <span className="text-rose-400 font-bold">*</span>
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {view === 'signup' && (
                  <>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-300 uppercase tracking-[0.15em]">Surname</label>
                      <input 
                        type="text"
                        value={surname}
                        onChange={(e) => setSurname(e.target.value)}
                        placeholder="Last name"
                        required
                        className="w-full px-5 py-4 bg-[#122019] border border-emerald-900/50 rounded-2xl text-sm font-semibold text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-300 uppercase tracking-[0.15em]">First Name</label>
                      <input 
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="First name"
                        required
                        className="w-full px-5 py-4 bg-[#122019] border border-emerald-900/50 rounded-2xl text-sm font-semibold text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-300 uppercase tracking-[0.15em]">Middle Name</label>
                      <input 
                        type="text"
                        value={middleName}
                        onChange={(e) => setMiddleName(e.target.value)}
                        placeholder="Middle name"
                        className="w-full px-5 py-4 bg-[#122019] border border-emerald-900/50 rounded-2xl text-sm font-semibold text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-300 uppercase tracking-[0.15em]">Phone Number</label>
                      <div className="relative flex items-center bg-[#122019] border border-emerald-900/50 rounded-2xl px-4 py-3 focus-within:ring-2 focus-within:ring-emerald-500/30 focus-within:border-emerald-500 transition-all">
                        <Phone size={16} className="text-emerald-400 mr-2 flex-shrink-0" />
                        <PhoneInput 
                          international
                          defaultCountry="NG"
                          value={phoneNumber}
                          onChange={setPhoneNumber}
                          className="w-full text-sm font-semibold text-white outline-none bg-transparent phone-input-override"
                        />
                      </div>
                    </div>
                  </>
                )}

                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-black text-slate-300 uppercase tracking-[0.15em]">Email Address</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-400" />
                    <input 
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      className="w-full pl-12 pr-4 py-4 bg-[#122019] border border-emerald-900/50 rounded-2xl text-sm font-semibold text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-black text-slate-300 uppercase tracking-[0.15em]">Password</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-400" />
                    <input 
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full pl-12 pr-12 py-4 bg-[#122019] border border-emerald-900/50 rounded-2xl text-sm font-semibold text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors bg-transparent border-none cursor-pointer">
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-3">
                {error && (
                  error.startsWith('Account Restrained:') ? (
                    <div className="bg-rose-950/40 border border-rose-800/60 p-4 rounded-2xl flex items-start gap-3 text-left mb-4">
                      <AlertCircle className="text-rose-400 shrink-0 mt-0.5" size={18} />
                      <div>
                        <p className="text-xs font-black text-rose-300 uppercase tracking-wider">Account Restrained</p>
                        <p className="text-xs text-rose-200 mt-1 leading-relaxed font-semibold">
                          {error.replace('Account Restrained: ', '')}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-rose-400 text-xs font-bold mb-4 text-center bg-rose-950/30 border border-rose-900/40 py-2.5 px-4 rounded-xl">{error}</p>
                  )
                )}
                {successMsg && (
                  <div className="mb-4 p-4 bg-emerald-950/50 border border-emerald-500/40 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                    <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-slate-950 font-bold">
                      <Mail size={14} />
                    </div>
                    <p className="text-xs font-black text-emerald-300 uppercase tracking-widest">{successMsg}</p>
                  </div>
                )}
                <Button 
                  type="submit"
                  disabled={loading || !!successMsg}
                  className="w-full py-5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-emerald-500/30 transition-all border-none disabled:opacity-50 cursor-pointer"
                >
                  {loading ? 'Processing...' : (view === 'login' ? 'Sign In' : 'Next \u2192')}
                </Button>
              </div>
            </form>

            <div className="text-center mt-8 pt-6 border-t border-white/10">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                {view === 'login' ? 'New to the network?' : 'Identity already exists?'}
                {' '}
                <button 
                  onClick={() => { setView(view === 'login' ? 'signup' : 'login'); setError(null); }} 
                  className="text-emerald-400 hover:text-emerald-300 transition-colors ml-2 font-black cursor-pointer bg-transparent border-none"
                >
                  {view === 'login' ? 'Sign up for access' : 'Sign in here'}
                </button>
              </p>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  if (view === 'verify') {
    return (
      <div className="min-h-screen bg-[#070c09] text-slate-100 flex items-center justify-center p-6 relative overflow-hidden font-sans">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none -z-10" />
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <Card className="p-8 sm:p-10 border border-emerald-900/40 shadow-2xl shadow-black/90 bg-[#0c1712] backdrop-blur-2xl rounded-[3rem] ring-1 ring-white/10">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl">
                <ShieldCheck size={32} />
              </div>
              <h1 className="text-2xl font-black text-white tracking-tight">Verify Identity</h1>
              <p className="text-slate-400 font-medium mt-2 text-sm">Enter the code sent to <span className="text-emerald-400 font-semibold">{email}</span></p>
            </div>

            <form onSubmit={handleVerify} className="space-y-8">
              <div className="flex justify-between gap-2" onPaste={handlePaste}>
                {verificationCode.map((digit, idx) => (
                  <input
                    key={idx}
                    type="text"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => {
                      const newCode = [...verificationCode];
                      newCode[idx] = e.target.value.replace(/\D/g, '');
                      setVerificationCode(newCode);
                      if (e.target.value && idx < 5) {
                        const next = e.target.nextElementSibling as HTMLInputElement;
                        next?.focus();
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Backspace' && !digit && idx > 0) {
                        const prev = (e.target as HTMLInputElement).previousElementSibling as HTMLInputElement;
                        prev?.focus();
                      }
                    }}
                    className="otp-input w-12 h-14 bg-[#122019] border border-emerald-900/60 rounded-xl text-center text-xl font-black text-emerald-400 outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
                  />
                ))}
              </div>

              {error && <p className="text-rose-400 text-xs font-bold text-center bg-rose-950/30 border border-rose-900/40 py-2.5 px-4 rounded-xl">{error}</p>}
              
              <Button type="submit" disabled={loading} className="w-full py-5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-500/25 transition-all border-none cursor-pointer">
                {loading ? 'Verifying...' : 'Establish Profile'}
              </Button>
            </form>
          </Card>
        </motion.div>
      </div>
    );
  }

  // ─── LANDING PAGE ─────────────────
  return (
    <div className="landing-root-container w-full min-h-screen bg-[#070c09] text-white">
      <style dangerouslySetInnerHTML={{ __html: `
        :root{
          --ink:#ffffff;
          --bg-dark:#070c09;
          --bg-card:#0c1712;
          --bg-card-hover:#11221a;
          --gray-900:#f8fafc;
          --gray-600:#cbd5e1;
          --gray-400:#94a3b8;
          --gray-200:rgba(255,255,255,0.08);
          --gray-100:#0e1a14;
          --white:#ffffff;
          --emerald:#10b981;
          --emerald-deep:#059669;
          --mint:#34d399;
          --blue:#38bdf8;
          --orange:#fb923c;
          --purple:#c084fc;
          --pink:#fb7185;
          --teal:#2dd4bf;
          --shadow-sm:0 2px 8px rgba(0,0,0,0.5);
          --shadow-md:0 12px 32px rgba(0,0,0,0.7);
          --shadow-lg:0 24px 60px rgba(0,0,0,0.85);
        }
        .landing-root-container {
          background: #070c09;
          color: #f8fafc;
          font-family: 'Inter', sans-serif;
          -webkit-font-smoothing: antialiased;
          overflow-x: hidden;
        }
        .landing-root-container a { color: inherit; text-decoration: none; }
        .wrap { max-width: 1180px; margin: 0 auto; padding: 0 32px; }

        /* ---------- NAV ---------- */
        .landing-root-container nav {
          display: flex; align-items: center; justify-content: space-between;
          padding: 18px 40px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          position: sticky; top: 0; background: rgba(7,12,9,0.85); backdrop-filter: blur(16px);
          z-index: 50;
        }
        .brand { display: flex; align-items: center; gap: 12px; }
        .brand-text .name { font-family: 'Outfit', sans-serif; font-weight: 800; font-size: 22px; letter-spacing: -0.04em; color: #ffffff; }
        .nav-links { display: flex; gap: 32px; font-size: 14px; font-weight: 600; color: #cbd5e1; }
        .nav-links a:hover { color: #ffffff; }
        .nav-right { display: flex; align-items: center; gap: 16px; }
        .btn-ghost { font-size: 14px; font-weight: 600; color: #cbd5e1; background: transparent; border: none; cursor: pointer; transition: color .15s ease; }
        .btn-ghost:hover { color: #ffffff; }
        .btn-solid { font-size: 14px; font-weight: 700; color: #020617; background: #10b981; padding: 9px 18px; border-radius: 8px; transition: all .15s ease; border: none; cursor: pointer; box-shadow: 0 4px 12px rgba(16,185,129,0.3); }
        .btn-solid:hover { background: #34d399; transform: translateY(-1px); }

        /* ---------- HERO ---------- */
        .hero { position: relative; overflow: hidden; background: #070c09; }
        .grid-dots {
          position: absolute; inset: 0; z-index: 0;
          background-image: radial-gradient(circle, rgba(52,211,153,0.18) 1.2px, transparent 1.2px);
          background-size: 28px 28px;
          mask-image: radial-gradient(ellipse 75% 65% at 20% 35%, black 25%, transparent 75%);
        }
        .hero-glow-1 {
          position: absolute; top: -150px; left: -100px; width: 500px; height: 500px;
          background: rgba(16,185,129,0.12); border-radius: 50%; filter: blur(140px); pointer-events: none; z-index: 0;
        }
        .hero-glow-2 {
          position: absolute; bottom: -100px; right: -50px; width: 450px; height: 450px;
          background: rgba(99,102,241,0.1); border-radius: 50%; filter: blur(140px); pointer-events: none; z-index: 0;
        }
        .hero-inner {
          max-width: 1200px; margin: 0 auto;
          display: grid; grid-template-columns: 1.05fr 0.95fr; align-items: center; gap: 32px;
          padding: 72px 40px 40px;
          position: relative; z-index: 2;
        }
        .eyebrow { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; color: #34d399; background: #0c1e15; border: 1px solid rgba(52,211,153,0.3); padding: 7px 16px; border-radius: 100px; margin-bottom: 22px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
        .eyebrow .dot { width: 7px; height: 7px; border-radius: 50%; background: #34d399; box-shadow: 0 0 10px #34d399; }
        h1 { font-weight: 800; font-size: clamp(36px,4.3vw,54px); line-height: 1.12; letter-spacing: -0.03em; color: #ffffff; max-width: 540px; text-align: left; }
        h1 .accent { color: #34d399; position: relative; text-shadow: 0 0 24px rgba(52,211,153,0.35); }
        h1 .accent svg { position: absolute; left: 0; bottom: -8px; width: 100%; height: 14px; overflow: visible; }
        .hero-sub { max-width: 480px; margin: 20px 0 32px; font-size: 17px; line-height: 1.65; color: #cbd5e1; text-align: left; }
        .hero-ctas-desktop { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin-bottom: 24px; }
        .hero-ctas-mobile { display: none; }
        .btn-primary { display: inline-flex; align-items: center; gap: 8px; background: #10b981; color: #020617; font-size: 15px; font-weight: 800; padding: 14px 28px; border-radius: 12px; transition: all .2s ease; border: none; cursor: pointer; box-shadow: 0 10px 25px -4px rgba(16,185,129,0.45); }
        .btn-primary:hover { background: #34d399; transform: translateY(-2px); box-shadow: 0 14px 30px -4px rgba(52,211,153,0.55); }
        .btn-secondary { display: inline-flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.08); color: #ffffff; font-size: 15px; font-weight: 700; padding: 14px 24px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.2); backdrop-filter: blur(8px); cursor: pointer; transition: all .2s ease; }
        .btn-secondary:hover { background: rgba(255,255,255,0.15); border-color: rgba(255,255,255,0.35); transform: translateY(-2px); }

        /* store badges */
        .store-row { display: flex; gap: 12px; flex-wrap: wrap; }
        .store-badge {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          background: #000000 !important;
          color: #ffffff !important;
          border: 1px solid rgba(255,255,255,0.22) !important;
          padding: 10px 18px;
          border-radius: 10px;
          transition: transform .15s ease, background .15s ease, border-color .15s ease;
          text-decoration: none;
          box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        }
        .store-badge:hover {
          background: #111111 !important;
          border-color: rgba(255,255,255,0.5) !important;
          transform: translateY(-2px);
        }
        .store-badge .lines {
          line-height: 1.15;
          text-align: left;
          display: flex;
          flex-direction: column;
        }
        .store-badge .small {
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.02em;
          color: #cbd5e1;
        }
        .store-badge .big {
          font-size: 13.5px;
          font-weight: 800;
          letter-spacing: -0.01em;
          color: #ffffff;
        }

        .header-store-badge {
          padding: 7px 14px !important;
          border-radius: 8px !important;
          gap: 8px !important;
        }
        .header-store-badge .store-icon {
          width: 15px !important;
          height: 15px !important;
        }
        .header-store-badge .small {
          font-size: 7.5px !important;
        }
        .header-store-badge .big {
          font-size: 11.5px !important;
        }
        @media (max-width: 640px) {
          .header-store-badge {
            padding: 5px 9px !important;
            gap: 6px !important;
            border-radius: 6px !important;
          }
          .header-store-badge .store-icon {
            width: 12px !important;
            height: 12px !important;
          }
          .header-store-badge .small {
            font-size: 6.5px !important;
          }
          .header-store-badge .big {
            font-size: 9.5px !important;
          }
        }

        /* illustration */
        .illo-wrap { position: relative; z-index: 2; display: flex; align-items: center; justify-content: center; }
        .illo-wrap svg { width: 100%; max-width: 460px; height: auto; }
        .float-chip {
          position: absolute; z-index: 3;
          background: rgba(12, 23, 18, 0.94);
          border: 1px solid rgba(52, 211, 153, 0.28);
          border-radius: 16px;
          padding: 12px 18px;
          box-shadow: 0 20px 40px rgba(0,0,0,0.8), 0 0 20px rgba(52, 211, 153, 0.12);
          backdrop-filter: blur(12px);
          display: flex; align-items: center; gap: 12px;
          animation: float 6s ease-in-out infinite;
        }
        .float-chip.chip-1 { top: 6%; left: -2%; animation-delay: 0s; }
        .float-chip.chip-2 { bottom: 8%; right: -4%; animation-delay: 2s; border-color: rgba(192, 132, 252, 0.3); box-shadow: 0 20px 40px rgba(0,0,0,0.8), 0 0 20px rgba(192, 132, 252, 0.12); }
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        .chip-icon { width: 34px; height: 34px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 14px; }
        .chip-text .big { font-size: 14px; font-weight: 700; color: #ffffff; line-height: 1.15; text-align: left; }
        .chip-text .small { font-size: 11.5px; color: #94a3b8; text-align: left; font-weight: 500; }

        @media (max-width:900px){
          .hero-inner { grid-template-columns: 1fr; text-align: center; padding: 48px 24px 24px; }
          h1 { max-width: 100%; text-align: center; margin: 0 auto; }
          .hero-sub { margin-left: auto; margin-right: auto; text-align: center; }
          .hero-ctas-desktop { display: none; }
          .hero-ctas-mobile { display: flex; justify-content: center; align-items: center; gap: 14px; flex-wrap: wrap; margin-top: 32px; }
          .float-chip { display: none; }
          .illo-wrap svg { max-width: 330px; }
        }

        /* ---------- SECTION HEAD ---------- */
        .section-head { max-width: 600px; margin: 0 auto 48px; text-align: center; }
        .section-head h2 { font-weight: 800; font-size: clamp(28px,3.2vw,40px); line-height: 1.2; letter-spacing: -0.025em; color: #ffffff; }
        .section-head p { color: #cbd5e1; margin-top: 12px; font-size: 16px; line-height: 1.6; }
        .section-eyebrow { font-size: 12px; color: #34d399; margin-bottom: 12px; display: inline-block; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; background: #0c1e15; border: 1px solid rgba(52,211,153,0.3); padding: 5px 14px; border-radius: 100px; }

        /* ---------- FEATURES ---------- */
        .features { padding: 90px 0 100px; background: #070c09; }
        .f-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
        .f-card {
          background: #0c1712;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          padding: 28px;
          transition: all .25s ease;
          text-align: left;
          box-shadow: 0 10px 25px rgba(0,0,0,0.5);
        }
        .f-card:hover {
          background: #11221a;
          border-color: rgba(52, 211, 153, 0.4);
          transform: translateY(-4px);
          box-shadow: 0 18px 40px rgba(0,0,0,0.7), 0 0 25px rgba(52,211,153,0.1);
        }
        .f-icon {
          width: 46px; height: 46px; border-radius: 13px;
          display: flex; align-items: center; justify-content: center;
          font-size: 20px; font-weight: bold; margin-bottom: 18px; color: #ffffff;
          box-shadow: 0 6px 16px rgba(0,0,0,0.4);
        }
        .f-card h3 { font-size: 17.5px; font-weight: 700; margin-bottom: 8px; color: #ffffff; }
        .f-card p { font-size: 14px; line-height: 1.6; color: #cbd5e1; }
        @media (max-width: 860px) { .f-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 560px) { .f-grid { grid-template-columns: 1fr; } }

        /* ---------- APP DOWNLOAD BAND ---------- */
        .app-band {
          margin: 0 32px 100px;
          background: linear-gradient(135deg, #07472e 0%, #09281a 50%, #05140d 100%);
          border: 1px solid rgba(52,211,153,0.35);
          border-radius: 28px;
          padding: 56px;
          display: flex; align-items: center; justify-content: space-between;
          gap: 32px; flex-wrap: wrap;
          position: relative; overflow: hidden;
          text-align: left;
          box-shadow: 0 25px 60px -10px rgba(0, 0, 0, 0.8), 0 0 30px rgba(52, 211, 153, 0.15);
        }
        .app-band::before {
          content: ''; position: absolute; right: -40px; top: -60px;
          width: 220px; height: 220px; border-radius: 50%;
          border: 1px solid rgba(255,255,255,0.18);
        }
        .app-band h2 { font-weight: 800; color: #ffffff; font-size: clamp(24px,2.8vw,32px); max-width: 440px; line-height: 1.25; position: relative; z-index: 2; }
        .app-band p { color: #d1fae5; margin-top: 10px; font-size: 15px; max-width: 420px; position: relative; z-index: 2; line-height: 1.55; }
        .app-band .store-row { position: relative; z-index: 2; }

        /* ---------- TESTIMONIALS ---------- */
        .testimonials { padding: 0 0 100px; background: #070c09; }
        .t-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
        .t-card {
          background: #0c1712;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 20px;
          padding: 28px;
          display: flex; flex-direction: column; gap: 18px; text-align: left;
          box-shadow: 0 10px 25px rgba(0,0,0,0.5);
          transition: border-color .2s ease, transform .2s ease;
        }
        .t-card:hover {
          border-color: rgba(52,211,153,0.35);
          transform: translateY(-2px);
        }
        .t-quote { font-size: 15px; line-height: 1.65; color: #e2e8f0; font-style: italic; }
        .t-person { display: flex; align-items: center; gap: 12px; }
        .t-avatar { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; color: #ffffff; }
        .t-name { font-size: 14px; font-weight: 700; color: #ffffff; }
        .t-role { font-size: 12px; color: #94a3b8; font-weight: 500; }
        @media (max-width: 700px) { .t-grid { grid-template-columns: 1fr; } }

        /* ---------- FOOTER ---------- */
        footer { border-top: 1px solid rgba(255,255,255,0.08); padding: 48px 32px; background: #040705; }
        .footer-inner { max-width: 1180px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 20px; }
        .footer-links { display: flex; gap: 28px; font-size: 14px; color: #94a3b8; font-weight: 500; }
        .footer-links a:hover { color: #ffffff; }
        .footer-copy { font-size: 13px; color: #64748b; font-weight: 500; }
      ` }} />

      <nav>
        <div className="brand cursor-pointer" onClick={() => setView('landing')}>
          <div className="w-14 h-14 flex items-center justify-center">
            <img 
              src="/logo.png" 
              alt="Trileza Logo" 
              className="w-full h-full object-contain scale-110 logo-white-dark filter brightness-0 invert drop-shadow-[0_2px_10px_rgba(255,255,255,0.3)]" 
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://api.dicebear.com/7.x/initials/svg?seed=Tr&backgroundColor=059669';
              }} 
            />
          </div>
          <div className="brand-text hidden sm:block"><div className="name">Trileza</div></div>
        </div>

        {/* Header Store Badges - Clearly visible on both mobile and desktop */}
        <div className="flex items-center gap-2 sm:gap-3">
          <a className="store-badge header-store-badge" href="#">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="store-icon" style={{ marginRight: '2px' }}>
              <path d="M11.182.008C11.148-.03 9.923.023 8.857 1.18c-1.066 1.156-.902 2.482-.878 2.516s1.52.087 2.475-1.258.762-2.391.728-2.43m3.314 11.733c-.048-.096-2.325-1.234-2.113-3.422s1.675-2.789 1.698-2.854-.597-.79-1.254-1.157a3.7 3.7 0 0 0-1.563-.434c-.108-.003-.483-.095-1.254.116-.508.139-1.653.589-1.968.607-.316.018-1.256-.522-2.267-.665-.647-.125-1.333.131-1.824.328-.49.196-1.422.754-2.074 2.237-.652 1.482-.311 3.83-.067 4.56s.625 1.924 1.273 2.796c.576.984 1.34 1.667 1.659 1.899s1.219.386 1.843.067c.502-.308 1.408-.485 1.766-.472.357.013 1.061.154 1.782.539.571.197 1.111.115 1.652-.105.541-.221 1.324-1.059 2.238-2.758q.52-1.185.473-1.282"/>
            </svg>
            <span className="lines"><span className="small">Download on the</span><span className="big">App Store</span></span>
          </a>
          <a className="store-badge header-store-badge" href="#">
            <svg width="16" height="16" viewBox="0 0 466 512" className="store-icon" style={{ marginRight: '2px' }}>
              <g fillRule="nonzero">
                <path fill="#EA4335" d="M199.9 237.8 1.4 470.17c7.22 24.57 30.16 41.81 55.8 41.81 11.16 0 20.93-2.79 29.3-8.37l244.16-139.46L199.9 237.8z"/>
                <path fill="#FBBC04" d="m433.91 205.1-104.65-60-111.61 110.22 113.01 108.83 104.64-58.6c18.14-9.77 30.7-29.3 30.7-50.23-1.4-20.93-13.95-40.46-32.09-50.22z"/>
                <path fill="#34A853" d="M199.42 273.45 329.27 145.1 87.9 8.37C79.53 2.79 68.36 0 57.2 0 30.7 0 6.98 18.14 1.4 41.86l198.02 231.59z"/>
                <path fill="#4285F4" d="M1.39 41.86C0 46.04 0 51.63 0 57.2v397.64c0 5.57 0 9.76 1.4 15.34l216.27-214.86L1.39 41.86z"/>
              </g>
            </svg>
            <span className="lines"><span className="small">GET IT ON</span><span className="big">Google Play</span></span>
          </a>
        </div>
      </nav>

      <section className="hero">
        <div className="grid-dots"></div>
        <div className="hero-glow-1"></div>
        <div className="hero-glow-2"></div>
        <div className="hero-inner">
          <div className="hero-copy">
            <div className="eyebrow"><span className="dot"></span>The learning platform for individuals and institutions</div>
            <h1>The hub of <span className="accent">unrestrained<svg viewBox="0 0 220 14" preserveAspectRatio="none"><path d="M2 9C40 2 90 2 110 7C130 12 180 4 218 9" stroke="#34d399" strokeWidth="2.8" fill="none" strokeLinecap="round"/></svg></span> impact</h1>
            <p className="hero-sub">A single platform for individual learners and institutions. Courses, books, mentors, and live classes — all from one clean, minimalist dashboard.</p>
            <div className="hero-ctas-desktop">
              <button className="btn-primary" onClick={() => { setSelectedRole('mentee'); setView('signup'); }}>
                Get Started 
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <button className="btn-secondary" style={{ background: '#4f46e5', color: '#ffffff', borderColor: 'rgba(129,140,248,0.35)', boxShadow: '0 10px 25px -4px rgba(79,70,229,0.35)' }} onClick={() => navigate('/institution-signup')}>
                🏢 For Institutions
              </button>
              <button className="btn-secondary" onClick={() => setView('login')}>Sign In</button>
            </div>
          </div>

          <div className="illo-wrap">
            <div className="float-chip chip-1">
              <div className="chip-icon font-bold" style={{ background: 'rgba(16,185,129,0.2)', color: '#34d399' }}>✓</div>
              <div className="chip-text"><div className="big">Course completed</div><div className="small">UX Fundamentals</div></div>
            </div>
            <div className="float-chip chip-2">
              <div className="chip-icon font-bold" style={{ background: 'rgba(192,132,252,0.2)', color: '#c084fc' }}>●</div>
              <div className="chip-text"><div className="big">Live class in 10m</div><div className="small">with mentor Aisha</div></div>
            </div>

            <svg viewBox="0 0 520 600" xmlns="http://www.w3.org/2000/svg">
              <path d="M70,320 C60,150 190,50 330,58 C470,66 500,220 478,350 C456,480 320,565 175,548 C40,532 80,490 70,320 Z" fill="#0b2419" stroke="rgba(52,211,153,0.2)" strokeWidth="2"/>
              <g opacity="0.95">
                <path d="M40,560 C20,480 60,410 120,395 C110,460 100,510 60,560 Z" fill="#144d32"/>
                <path d="M75,560 C65,500 95,450 140,435 C135,485 125,525 95,560 Z" fill="#1e734c"/>
              </g>
              <g opacity="0.95">
                <path d="M480,540 C500,470 465,405 410,392 C418,455 428,500 462,540 Z" fill="#144d32"/>
                <path d="M448,548 C455,492 428,448 388,436 C392,483 400,518 424,548 Z" fill="#1e734c"/>
              </g>
              <g fill="#f59e0b" opacity="0.9">
                <path d="M100,120 l4,10 l10,4 l-10,4 l-4,10 l-4,-10 l-10,-4 l10,-4 Z"/>
                <path d="M440,150 l3,8 l8,3 l-8,3 l-3,8 l-3,-8 l-8,-3 l8,-3 Z"/>
              </g>
              <g transform="translate(260,455)">
                <g fill="#073522">
                  <rect x="-8" y="-118" width="16" height="24" rx="3"/>
                  <rect x="-8" y="94" width="16" height="24" rx="3"/>
                  <rect x="-118" y="-8" width="24" height="16" rx="3"/>
                  <rect x="94" y="-8" width="24" height="16" rx="3"/>
                  <g transform="rotate(45)"><rect x="-8" y="-118" width="16" height="24" rx="3"/><rect x="-8" y="94" width="16" height="24" rx="3"/><rect x="-118" y="-8" width="24" height="16" rx="3"/><rect x="94" y="-8" width="24" height="16" rx="3"/></g>
                  <g transform="rotate(22.5)"><rect x="-8" y="-118" width="16" height="24" rx="3"/><rect x="-8" y="94" width="16" height="24" rx="3"/><rect x="-118" y="-8" width="24" height="16" rx="3"/><rect x="94" y="-8" width="24" height="16" rx="3"/></g>
                  <g transform="rotate(67.5)"><rect x="-8" y="-118" width="16" height="24" rx="3"/><rect x="-8" y="94" width="16" height="24" rx="3"/><rect x="-118" y="-8" width="24" height="16" rx="3"/><rect x="94" y="-8" width="24" height="16" rx="3"/></g>
                </g>
                <circle r="100" fill="#10b981"/>
                <circle r="70" fill="#051f14"/>
                <circle r="30" fill="#f59e0b"/>
                <circle r="12" fill="#ffffff"/>
              </g>
              <g transform="translate(388,378)">
                <g fill="#073522">
                  <rect x="-5" y="-34" width="10" height="14" rx="2"/>
                  <rect x="-5" y="20" width="10" height="14" rx="2"/>
                  <rect x="-34" y="-5" width="14" height="10" rx="2"/>
                  <rect x="20" y="-5" width="14" height="10" rx="2"/>
                  <g transform="rotate(45)"><rect x="-5" y="-34" width="10" height="14" rx="2"/><rect x="-5" y="20" width="10" height="14" rx="2"/><rect x="-34" y="-5" width="14" height="10" rx="2"/><rect x="20" y="-5" width="14" height="10" rx="2"/></g>
                </g>
                <circle r="26" fill="#34d399"/>
                <circle r="9" fill="#03170e"/>
              </g>
              <g transform="translate(232,178)">
                <path d="M58,210 C50,250 46,270 50,300 L74,300 C76,268 80,246 84,212 Z" fill="#073522"/>
                <path d="M18,214 C16,252 18,272 26,300 L50,300 C48,266 50,244 46,214 Z" fill="#10b981"/>
                <rect x="46" y="296" width="32" height="14" rx="6" fill="#020617"/>
                <rect x="12" y="296" width="32" height="14" rx="6" fill="#020617"/>
                <path d="M4,90 C0,150 6,196 22,220 C46,236 78,234 98,214 C112,190 112,140 100,88 C86,64 22,62 4,90 Z" fill="#10b981"/>
                <path d="M55,86 C58,140 56,188 46,220 L60,220 C72,188 74,138 70,86 Z" fill="#0a5c40" opacity="0.6"/>
                <path d="M92,104 C114,108 128,124 130,150 C131,164 122,172 110,168 C104,150 98,130 88,116 Z" fill="#073522"/>
                <path d="M18,104 C-6,100 -22,84 -28,56 C-30,44 -20,38 -10,44 C-4,62 4,82 22,100 Z" fill="#10b981"/>
                <circle cx="-25" cy="42" r="11" fill="#f6d5b8"/>
                <circle cx="46" cy="46" r="34" fill="#f6d5b8"/>
                <path d="M14,40 C10,10 40,-8 66,4 C84,12 88,32 82,48 C78,34 70,28 60,26 C46,24 30,28 22,42 Z" fill="#111827"/>
                <g transform="translate(46,10) rotate(-6)">
                  <rect x="-34" y="4" width="68" height="9" rx="3" fill="#040d08"/>
                  <path d="M-40,8 L0,-14 L40,8 L0,26 Z" fill="#06150e"/>
                  <circle cx="0" cy="8" r="4" fill="#f59e0b"/>
                  <path d="M0,8 C6,20 6,32 0,40" stroke="#f59e0b" strokeWidth="2.4" fill="none"/>
                  <circle cx="0" cy="41" r="3.5" fill="#f59e0b"/>
                </g>
                <g stroke="#ffffff" strokeWidth="2.4" fill="none">
                  <circle cx="34" cy="50" r="9"/>
                  <circle cx="58" cy="50" r="9"/>
                  <line x1="43" y1="50" x2="49" y2="50"/>
                </g>
                <g transform="translate(-70,-6)">
                  <rect x="0" y="0" width="72" height="54" rx="10" fill="#08140e" stroke="#1f4230" strokeWidth="1.5"/>
                  <polyline points="8,38 22,26 34,32 50,14 64,20" stroke="#34d399" strokeWidth="2.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="64" cy="20" r="3.6" fill="#4ade80"/>
                </g>
              </g>
            </svg>
          </div>

          {/* Mobile Hero CTAs */}
          <div className="hero-ctas-mobile">
            <button className="btn-primary" onClick={() => { setSelectedRole('mentee'); setView('signup'); }}>
              Get Started 
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <button className="btn-secondary" style={{ background: '#4f46e5', color: '#ffffff', borderColor: 'rgba(129,140,248,0.35)' }} onClick={() => navigate('/institution-signup')}>
              🏢 For Institutions
            </button>
            <button className="btn-secondary" onClick={() => setView('login')}>Sign In</button>
          </div>
        </div>
      </section>

      {/* ═══════════ TRUSTED BY INSTITUTIONS BANNER ═══════════ */}
      <section className="py-12 bg-[#050a07] border-y border-white/10 text-slate-100">
        <div className="max-w-6xl mx-auto px-6 text-center space-y-6">
          <p className="text-xs font-mono font-bold uppercase tracking-widest text-[#34d399]">
            Trusted by universities, schools, and training providers
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10">
            <div className="flex items-center gap-3 font-bold text-sm tracking-tight text-slate-200 bg-[#0c1712] border border-white/10 px-5 py-2.5 rounded-2xl shadow-md">
              <span className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-black text-xs border border-indigo-500/30">MIT</span>
              Massachusetts Institute of Technology
            </div>
            <div className="flex items-center gap-3 font-bold text-sm tracking-tight text-slate-200 bg-[#0c1712] border border-white/10 px-5 py-2.5 rounded-2xl shadow-md">
              <span className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-black text-xs border border-emerald-500/30">OX</span>
              Oxford Professional Academy
            </div>
            <div className="flex items-center gap-3 font-bold text-sm tracking-tight text-slate-200 bg-[#0c1712] border border-white/10 px-5 py-2.5 rounded-2xl shadow-md">
              <span className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-300 flex items-center justify-center font-black text-xs border border-purple-500/30">TC</span>
              TechCorp Learning
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ WHAT'S INSIDE / FEATURES SECTION ═══════════ */}
      <section className="features" id="features">
        <div className="wrap">
          <div className="section-head">
            <span className="section-eyebrow">What's inside</span>
            <h2>Everything you need to learn and grow</h2>
            <p>A single platform for individual learners and institutions.</p>
          </div>
          <div className="f-grid">
            <div className="f-card group">
              <div className="f-icon" style={{ background: '#10b981', boxShadow: '0 8px 20px rgba(16,185,129,0.35)' }}>▶</div>
              <h3 className="group-hover:text-emerald-300 transition-colors">Courses & Marketplace</h3>
              <p>Take structured courses at your own pace from verified mentors and partner institutions.</p>
            </div>
            <div className="f-card group">
              <div className="f-icon" style={{ background: '#38bdf8', boxShadow: '0 8px 20px rgba(56,189,248,0.35)' }}>▤</div>
              <h3 className="group-hover:text-sky-300 transition-colors">Public Library</h3>
              <p>Buy or borrow books straight from the platform's own comprehensive digital library.</p>
            </div>
            <div className="f-card group">
              <div className="f-icon" style={{ background: '#fb923c', boxShadow: '0 8px 20px rgba(251,146,60,0.35)' }}>◐</div>
              <h3 className="group-hover:text-amber-300 transition-colors">Mentorship</h3>
              <p>Connect with mentors, join mentorship programs, or apply to become an expert yourself.</p>
            </div>
            <div className="f-card group">
              <div className="f-icon" style={{ background: '#c084fc', boxShadow: '0 8px 20px rgba(192,132,252,0.35)' }}>●</div>
              <h3 className="group-hover:text-purple-300 transition-colors">Live Classes</h3>
              <p>Join or schedule live interactive sessions with mentors and instructors in real time.</p>
            </div>
            <div className="f-card group">
              <div className="f-icon" style={{ background: '#fb7185', boxShadow: '0 8px 20px rgba(251,113,133,0.35)' }}>✦</div>
              <h3 className="group-hover:text-rose-300 transition-colors">Community</h3>
              <p>Discuss, share highlights, and message peers directly — no need to leave the app.</p>
            </div>
            <div className="f-card group">
              <div className="f-icon" style={{ background: '#2dd4bf', boxShadow: '0 8px 20px rgba(45,212,191,0.35)' }}>▥</div>
              <h3 className="group-hover:text-teal-300 transition-colors">Minimalist Dashboard</h3>
              <p>Everything above, in one ultra-clean dark view built to stay out of your way.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ FOR INSTITUTIONS FEATURE SHOWCASE ═══════════ */}
      <section className="py-20 bg-[#050907] text-slate-100 border-t border-white/10">
        <div className="max-w-6xl mx-auto px-6 space-y-12">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <span className="text-xs font-mono font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
              Enterprise Multi-Tenant Infrastructure
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white">For Institutions & Organizations</h2>
            <p className="text-slate-300 text-sm sm:text-base">
              Operate an independent, dedicated learning environment with data isolation, tenant management, and custom branding.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[#0c1712] border border-white/10 hover:border-indigo-500/40 rounded-3xl p-7 space-y-4 shadow-xl transition-all hover:bg-[#112019]">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 flex items-center justify-center font-bold text-xl">
                🔒
              </div>
              <h3 className="font-bold text-white text-lg">Isolated Tenant Environments</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Strict Row Level Security (RLS) policies ensure your institution's users, courses, and records are completely isolated.
              </p>
            </div>

            <div className="bg-[#0c1712] border border-white/10 hover:border-emerald-500/40 rounded-3xl p-7 space-y-4 shadow-xl transition-all hover:bg-[#112019]">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 flex items-center justify-center font-bold text-xl">
                🎨
              </div>
              <h3 className="font-bold text-white text-lg">Custom Branding & Domain</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Customize institution logos, primary colors, and map custom domain names (<code className="text-emerald-300 font-mono">lms.yourinstitution.edu</code>).
              </p>
            </div>

            <div className="bg-[#0c1712] border border-white/10 hover:border-purple-500/40 rounded-3xl p-7 space-y-4 shadow-xl transition-all hover:bg-[#112019]">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-500/30 text-purple-300 flex items-center justify-center font-bold text-xl">
                📥
              </div>
              <h3 className="font-bold text-white text-lg">User Management & Bulk CSV</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Manage roles (Tenant Admin, Instructor, Learner, Support Staff) and import batches of users instantly via CSV.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ INSTITUTIONAL PRICING TIERS ═══════════ */}
      <section className="py-20 bg-[#070c09] text-slate-100 border-t border-white/10">
        <div className="max-w-6xl mx-auto px-6 space-y-12">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <span className="text-xs font-mono font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
              Institutional Plans
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white">Transparent Pricing for Every Institution</h2>
            <p className="text-slate-300 text-sm sm:text-base">
              Scalable pricing plans for small academies, growing training providers, and enterprise universities.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[#0c1712] border border-white/10 rounded-3xl p-7 flex flex-col justify-between space-y-6 shadow-xl hover:border-slate-700 transition-all">
              <div className="space-y-4">
                <h3 className="font-bold text-white text-xl">Starter Tier</h3>
                <p className="text-sm text-slate-400">For small academies and specialized training programs.</p>
                <div className="pt-2">
                  <span className="text-4xl font-extrabold text-white">$149</span>
                  <span className="text-sm text-slate-400"> / month</span>
                </div>
                <ul className="text-sm text-slate-200 space-y-3 font-medium pt-4 border-t border-white/10">
                  <li className="flex items-center gap-2"><span className="text-[#34d399] font-bold">✓</span> Up to 2,000 Active Users</li>
                  <li className="flex items-center gap-2"><span className="text-[#34d399] font-bold">✓</span> Dedicated Subdomain</li>
                  <li className="flex items-center gap-2"><span className="text-[#34d399] font-bold">✓</span> RLS Data Isolation</li>
                  <li className="flex items-center gap-2"><span className="text-[#34d399] font-bold">✓</span> Standard Analytics</li>
                </ul>
              </div>
              <Button variant="outline" onClick={() => navigate('/institution-signup')} className="w-full border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10 py-3.5 rounded-2xl font-bold cursor-pointer">
                Start Starter Tier
              </Button>
            </div>

            <div className="bg-[#0e2118] border-2 border-emerald-500 rounded-3xl p-7 flex flex-col justify-between space-y-6 relative shadow-2xl shadow-emerald-500/15">
              <span className="absolute -top-3.5 right-6 bg-emerald-500 text-slate-950 text-[11px] uppercase font-black px-4 py-1 rounded-full shadow-lg">
                Most Popular
              </span>
              <div className="space-y-4">
                <h3 className="font-bold text-white text-xl">Growth Tier</h3>
                <p className="text-sm text-emerald-100/70">For expanding colleges and professional institutes.</p>
                <div className="pt-2">
                  <span className="text-4xl font-black text-emerald-400">$499</span>
                  <span className="text-sm text-emerald-200/60"> / month</span>
                </div>
                <ul className="text-sm text-slate-100 space-y-3 font-medium pt-4 border-t border-emerald-500/30">
                  <li className="flex items-center gap-2"><span className="text-emerald-300 font-bold">✓</span> Up to 10,000 Active Users</li>
                  <li className="flex items-center gap-2"><span className="text-emerald-300 font-bold">✓</span> Custom Domain Mapping</li>
                  <li className="flex items-center gap-2"><span className="text-emerald-300 font-bold">✓</span> Bulk CSV User Import</li>
                  <li className="flex items-center gap-2"><span className="text-emerald-300 font-bold">✓</span> Printable PDF Analytics Reports</li>
                </ul>
              </div>
              <Button variant="primary" onClick={() => navigate('/institution-signup')} className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-3.5 rounded-2xl shadow-lg shadow-emerald-500/30 cursor-pointer border-none">
                Start Growth Tier
              </Button>
            </div>

            <div className="bg-[#0c1712] border border-white/10 rounded-3xl p-7 flex flex-col justify-between space-y-6 shadow-xl hover:border-slate-700 transition-all">
              <div className="space-y-4">
                <h3 className="font-bold text-white text-xl">Enterprise Tier</h3>
                <p className="text-sm text-slate-400">For large universities and global enterprise teams.</p>
                <div className="pt-2">
                  <span className="text-4xl font-extrabold text-purple-400">$1,499</span>
                  <span className="text-sm text-slate-400"> / month</span>
                </div>
                <ul className="text-sm text-slate-200 space-y-3 font-medium pt-4 border-t border-white/10">
                  <li className="flex items-center gap-2"><span className="text-purple-400 font-bold">✓</span> Unlimited Active Users</li>
                  <li className="flex items-center gap-2"><span className="text-purple-400 font-bold">✓</span> Custom Course Hierarchy</li>
                  <li className="flex items-center gap-2"><span className="text-purple-400 font-bold">✓</span> Dedicated Account Specialist</li>
                  <li className="flex items-center gap-2"><span className="text-purple-400 font-bold">✓</span> 24/7 Priority SLA Support</li>
                </ul>
              </div>
              <Button variant="secondary" onClick={() => navigate('/institution-signup')} className="w-full bg-white/10 text-white hover:bg-white/20 border border-white/15 py-3.5 rounded-2xl font-bold cursor-pointer">
                Contact Enterprise
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ APP DOWNLOAD BAND ═══════════ */}
      <div className="wrap">
        <div className="app-band">
          <div>
            <h2>Take Trileza with you, everywhere.</h2>
            <p>Courses, live classes, books, and messages — right from your phone with instant synchronization.</p>
          </div>
          <div className="store-row">
            <a className="store-badge" href="#">
              <svg width="22" height="22" viewBox="0 0 16 16" fill="currentColor" style={{ marginRight: '2px' }}>
                <path d="M11.182.008C11.148-.03 9.923.023 8.857 1.18c-1.066 1.156-.902 2.482-.878 2.516s1.52.087 2.475-1.258.762-2.391.728-2.43m3.314 11.733c-.048-.096-2.325-1.234-2.113-3.422s1.675-2.789 1.698-2.854-.597-.79-1.254-1.157a3.7 3.7 0 0 0-1.563-.434c-.108-.003-.483-.095-1.254.116-.508.139-1.653.589-1.968.607-.316.018-1.256-.522-2.267-.665-.647-.125-1.333.131-1.824.328-.49.196-1.422.754-2.074 2.237-.652 1.482-.311 3.83-.067 4.56s.625 1.924 1.273 2.796c.576.984 1.34 1.667 1.659 1.899s1.219.386 1.843.067c.502-.308 1.408-.485 1.766-.472.357.013 1.061.154 1.782.539.571.197 1.111.115 1.652-.105.541-.221 1.324-1.059 2.238-2.758q.52-1.185.473-1.282"/>
              </svg>
              <span className="lines">
                <span className="small">Download on the</span>
                <span className="big">App Store</span>
              </span>
            </a>
            <a className="store-badge" href="#">
              <svg width="22" height="22" viewBox="0 0 466 512" style={{ marginRight: '2px' }}>
                <g fillRule="nonzero">
                  <path fill="#EA4335" d="M199.9 237.8 1.4 470.17c7.22 24.57 30.16 41.81 55.8 41.81 11.16 0 20.93-2.79 29.3-8.37l244.16-139.46L199.9 237.8z"/>
                  <path fill="#FBBC04" d="m433.91 205.1-104.65-60-111.61 110.22 113.01 108.83 104.64-58.6c18.14-9.77 30.7-29.3 30.7-50.23-1.4-20.93-13.95-40.46-32.09-50.22z"/>
                  <path fill="#34A853" d="M199.42 273.45 329.27 145.1 87.9 8.37C79.53 2.79 68.36 0 57.2 0 30.7 0 6.98 18.14 1.4 41.86l198.02 231.59z"/>
                  <path fill="#4285F4" d="M1.39 41.86C0 46.04 0 51.63 0 57.2v397.64c0 5.57 0 9.76 1.4 15.34l216.27-214.86L1.39 41.86z"/>
                </g>
              </svg>
              <span className="lines">
                <span className="small">GET IT ON</span>
                <span className="big">Google Play</span>
              </span>
            </a>
          </div>
        </div>
      </div>

      {/* ═══════════ TESTIMONIALS ═══════════ */}
      <section className="testimonials">
        <div className="wrap">
          <div className="section-head">
            <span className="section-eyebrow">From the community</span>
            <h2>People learning on Trileza</h2>
            <p>Empowering tens of thousands of minds across the globe.</p>
          </div>
          <div className="t-grid">
            <div className="t-card">
              <p className="t-quote">"Having courses, my mentor, and the community in one app means I actually keep going instead of losing my place across five different tools."</p>
              <div className="t-person">
                <div className="t-avatar" style={{ background: '#10b981' }}>JN</div>
                <div><div className="t-name">J. Nakamura</div><div className="t-role">Student</div></div>
              </div>
            </div>
            <div className="t-card">
              <p className="t-quote">"I applied to become a mentor and had my first live session scheduled the same week. It's the easiest, cleanest mentorship setup I've used."</p>
              <div className="t-person">
                <div className="t-avatar" style={{ background: '#a855f7' }}>AO</div>
                <div><div className="t-name">A. Okafor</div><div className="t-role">Mentor</div></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ FOOTER ═══════════ */}
      <footer>
        <div className="footer-inner">
          <div className="brand cursor-pointer" onClick={() => setView('landing')}>
            <div className="w-10 h-10 flex items-center justify-center">
              <img 
                src="/logo.png" 
                alt="Trileza Logo" 
                className="w-full h-full object-contain scale-110 logo-white-dark filter brightness-0 invert drop-shadow-[0_2px_10px_rgba(255,255,255,0.25)]" 
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://api.dicebear.com/7.x/initials/svg?seed=Tr&backgroundColor=059669';
                }} 
              />
            </div>
            <div className="brand-text"><div className="name">Trileza</div></div>
          </div>
          <div className="footer-links">
            <a href="#features">Courses</a>
            <a href="#features">Library</a>
            <a href="#features">Mentors</a>
            <a href="#">Privacy Policy</a>
            <a href="#">Terms of Service</a>
          </div>
          <div className="footer-copy">© 2026 Trileza Inc. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
};

export default LoginPage;

