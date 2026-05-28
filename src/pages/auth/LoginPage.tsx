import React, { useState } from 'react';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { Button, Card } from '../../components/ui';
import { LoadingOverlay } from '../../components/shared';
import { useAuthStore } from '../../store/authStore';
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
  BookOpen,
  Target,
  Globe
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../utils';

type AuthView = 'landing' | 'login' | 'signup' | 'verify';

const LoginPage = () => {
  const { signIn, signUp, loading } = useAuthStore();
  const [view, setView] = useState<AuthView>('landing');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

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
  const [avatarSeed, setAvatarSeed] = useState(`user-${Math.random()}`);
  
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

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    const fullName = `${surname} ${firstName} ${middleName}`.trim();
    const avatarUrl = avatarSeed.startsWith('data:') 
      ? avatarSeed 
      : `https://api.dicebear.com/7.x/avataaars/svg?seed=${avatarSeed}`;

    const metadata = {
      surname,
      firstName,
      middleName,
      phoneNumber,
      avatar_url: avatarUrl,
    };

    const { error, requireVerification } = await signUp(email, password, fullName, selectedRole, metadata);
    if (error) {
      setError(error);
    } else if (requireVerification) {
      localStorage.setItem('pending_registration', JSON.stringify({
        email,
        fullName,
        role: selectedRole,
        metadata
      }));
      
      setSuccessMsg(`Authentication code sent to ${email}`);
      setTimeout(() => {
        setSuccessMsg(null);
        setView('verify');
      }, 1500);
    } else {
      setSuccessMsg('Profile established! Redirecting...');
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const otp = verificationCode.join('');

    const pendingDataStr = localStorage.getItem('pending_registration');
    let registrationMetadata = null;
    if (pendingDataStr) {
      try {
        const data = JSON.parse(pendingDataStr);
        if (data.email === email) {
          registrationMetadata = data;
        }
      } catch (e) {
        console.error('Error parsing pending registration data', e);
      }
    }

    const { error } = await useAuthStore.getState().verifyEmail(email, otp, registrationMetadata);
    
    if (error) {
      setError(error);
    } else {
      localStorage.removeItem('pending_registration');
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
  if (view === 'login' || view === 'signup') {
    return (
      <div className="min-h-screen bg-[#FDFDFF] flex items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-indigo-50 rounded-full blur-[120px] -z-10" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-emerald-50 rounded-full blur-[120px] -z-10" />

        <header className="fixed top-0 left-0 w-full z-50 bg-white/40 backdrop-blur-2xl border-b border-white/20 px-6 md:px-12 py-5 flex items-center justify-between shadow-[0_4px_30px_rgba(0,0,0,0.03)]">
          <button 
            onClick={() => { setView('landing'); resetForm(); }} 
            className="flex items-center gap-3 group cursor-pointer"
          >
            <div className="w-20 h-20 flex items-center justify-center group-hover:scale-110 transition-all duration-500 group-hover:rotate-6">
              <img src="/logo.png" alt="Trileza Logo" className="w-full h-full object-contain scale-125 drop-shadow-md" onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://api.dicebear.com/7.x/initials/svg?seed=Tr&backgroundColor=059669';
              }} />
            </div>
            <span className="text-xl font-black text-slate-900 tracking-tight hidden sm:block">Trileza</span>
          </button>
          
          <button 
            onClick={() => { setView('landing'); resetForm(); }}
            className="flex items-center gap-2 text-slate-500 hover:text-emerald-600 transition-all text-sm font-bold bg-white/50 px-4 py-2 rounded-full border border-slate-200/50 hover:shadow-lg"
          >
            <ArrowLeft size={16} /> Back to Home
          </button>
        </header>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-2xl pt-24 pb-12"
        >
          <Card className="p-10 border-none shadow-[0_30px_60px_-15px_rgba(0,0,0,0.08)] bg-white/80 backdrop-blur-2xl rounded-[3rem] ring-1 ring-slate-200/50">
            <div className="text-center mb-10">
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">
                {view === 'login' ? 'Welcome Back' : 'Join Trileza'}
              </h1>
              <p className="text-slate-500 font-medium mt-2 text-sm">
                {view === 'login' 
                  ? 'Sign in to your elite learning dashboard' 
                  : 'Create your detailed professional profile'}
              </p>
            </div>

            <form onSubmit={view === 'login' ? handleLogin : handleSignUp} className="space-y-8">
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
                            setAvatarSeed(reader.result as string);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                    <img 
                      src={avatarSeed.startsWith('data:') ? avatarSeed : `https://api.dicebear.com/7.x/avataaars/svg?seed=${avatarSeed}`} 
                      className="w-24 h-24 rounded-full bg-slate-100 ring-4 ring-emerald-500/20 shadow-xl transition-all group-hover:scale-105 object-cover"
                      alt="Avatar Preview"
                    />
                    <div className="absolute bottom-0 right-0 p-2 rounded-full bg-emerald-600 text-white shadow-lg group-hover:bg-emerald-700 transition-colors z-0">
                      <Camera size={14} />
                    </div>
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Upload Profile Picture</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {view === 'signup' && (
                  <>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-500 uppercase tracking-[0.15em]">Surname</label>
                      <input 
                        type="text"
                        value={surname}
                        onChange={(e) => setSurname(e.target.value)}
                        placeholder="Last name"
                        required
                        className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-500 uppercase tracking-[0.15em]">First Name</label>
                      <input 
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="First name"
                        required
                        className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-500 uppercase tracking-[0.15em]">Middle Name</label>
                      <input 
                        type="text"
                        value={middleName}
                        onChange={(e) => setMiddleName(e.target.value)}
                        placeholder="Middle name"
                        className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-500 uppercase tracking-[0.15em]">Phone Number</label>
                      <div className="relative flex items-center bg-slate-50 rounded-2xl px-4 py-3 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all">
                        <Phone size={16} className="text-slate-400 mr-2 flex-shrink-0" />
                        <PhoneInput 
                          international
                          defaultCountry="NG"
                          value={phoneNumber}
                          onChange={setPhoneNumber}
                          className="w-full text-sm font-semibold text-slate-900 outline-none bg-transparent phone-input-override"
                        />
                      </div>
                    </div>
                  </>
                )}

                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-[0.15em]">Email Address</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-2xl text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-[0.15em] ml-4">Password</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full pl-12 pr-12 py-4 bg-slate-50 border-none rounded-2xl text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-4">
                {error && <p className="text-red-500 text-xs font-bold mb-4 text-center">{error}</p>}
                {successMsg && (
                  <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                    <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white">
                      <Mail size={14} />
                    </div>
                    <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">{successMsg}</p>
                  </div>
                )}
                <Button 
                  type="submit"
                  disabled={loading || !!successMsg}
                  className="w-full py-5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-emerald-500/20 transition-all border-none disabled:opacity-50"
                >
                  {loading ? 'Processing...' : (view === 'login' ? 'Establish Session' : 'Next \u2192')}
                </Button>
              </div>
            </form>

            <div className="text-center mt-8 pt-6 border-t border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {view === 'login' ? 'New to the network?' : 'Identity already exists?'}
                {' '}
                <button 
                  onClick={() => { setView(view === 'login' ? 'signup' : 'login'); setError(null); }} 
                  className="text-emerald-600 hover:text-emerald-800 transition-colors ml-2"
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
      <div className="min-h-screen bg-[#FDFDFF] flex items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-emerald-50 rounded-full blur-[120px] -z-10" />
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <Card className="p-10 border-none shadow-2xl bg-white/80 backdrop-blur-2xl rounded-[3rem] ring-1 ring-slate-200/50">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl">
                <ShieldCheck size={32} />
              </div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Verify Identity</h1>
              <p className="text-slate-500 font-medium mt-2 text-sm">Enter the code sent to {email}</p>
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
                    className="otp-input w-12 h-14 bg-slate-50 border-none rounded-xl text-center text-xl font-black text-emerald-600 outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  />
                ))}
              </div>

              {error && <p className="text-red-500 text-xs font-bold text-center">{error}</p>}
              
              <Button type="submit" disabled={loading} className="w-full py-5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-widest shadow-xl transition-all">
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
    <div className="min-h-screen bg-[#FDFDFF] flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-emerald-50 rounded-full blur-[120px] -z-10" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-emerald-50 rounded-full blur-[120px] -z-10" />

      <header className="fixed top-0 left-0 w-full z-50 bg-white/30 backdrop-blur-3xl border-b border-white/20 px-6 md:px-12 py-5 flex items-center justify-between shadow-[0_8px_32px_0_rgba(31,38,135,0.07)]">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3 group cursor-pointer" onClick={() => setView('landing')}>
            <div className="w-24 h-24 flex items-center justify-center group-hover:scale-110 transition-all duration-500 group-hover:rotate-12">
              <img src="/logo.png" alt="Trileza Logo" className="w-full h-full object-contain scale-125 drop-shadow-md" onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://api.dicebear.com/7.x/initials/svg?seed=Tr&backgroundColor=059669';
              }} />
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-black text-slate-900 tracking-tight leading-none">Trileza</span>
              <span className="text-[9px] font-black text-emerald-500 uppercase tracking-[0.3em] mt-1">LMS Engine</span>
            </div>
          </div>
        </div>

        <nav className="flex items-center gap-8">
          <div className="hidden lg:flex items-center gap-10 text-[10px] font-black text-slate-500 uppercase tracking-[0.25em]">
            <a href="#" className="hover:text-emerald-600 transition-all">Courses</a>
            <a href="#" className="hover:text-emerald-600 transition-all">Mentorship</a>
            <a href="#" className="hover:text-emerald-600 transition-all">Enterprise</a>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => setView('login')} className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-600 hover:text-emerald-600 transition-all px-4 py-2 hover:bg-white/50 rounded-xl">Login</button>
            <Button onClick={() => setView('signup')} className="bg-emerald-600 text-white hover:bg-emerald-700 text-[10px] font-black uppercase tracking-[0.25em] px-10 py-7 rounded-2xl shadow-[0_20px_40px_-10px_rgba(16,185,129,0.3)] transition-all hover:scale-105 active:scale-95 border-none">Join Elite</Button>
          </div>
        </nav>
      </header>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center z-10 pt-20"
      >
        <div className="lg:col-span-5 space-y-10 text-center lg:text-left">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-slate-100 shadow-sm mx-auto lg:mx-0">
               <Zap size={10} className="text-emerald-600" />
               <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Nexus Platform v4.0</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-black text-slate-900 leading-[1.05] tracking-tight">
              Professional <br/>
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 via-emerald-400 to-emerald-500">LMS Engine</span> <br/>
              <span className="text-slate-300">&</span> <span className="text-emerald-500">Growth</span>
            </h1>
            <p className="text-slate-600 text-xl font-medium leading-relaxed max-w-md mx-auto lg:mx-0">
              The high-fidelity ecosystem for creative technologists and industry leaders.
            </p>
          </div>
          <div className="flex items-center justify-center lg:justify-start gap-4">
             <Button onClick={() => setView('signup')} className="bg-slate-900 text-white px-10 py-6 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-all shadow-xl">Get Started &rarr;</Button>
             <button className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-emerald-600 transition-colors">Watch Demo</button>
          </div>
        </div>

        <div className="lg:col-span-7">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            {[
              { id: 'mentee', label: 'Mentee', icon: GraduationCap, color: 'from-emerald-600 to-emerald-500', desc: 'Join the academy & accelerate growth', badge: 'Enrolling Now' },
              { id: 'mentor', label: 'Mentor', icon: Award, color: 'from-emerald-600 to-teal-500', desc: 'Build your atelier & expand influence', badge: 'Alpha Batch' },
            ].map((role) => (
              <Card 
                key={role.id}
                onClick={() => { setSelectedRole(role.id as any); setView('signup'); }}
                className="group p-1 bg-white/40 backdrop-blur-3xl rounded-[3.5rem] border-white/50 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.06)] hover:shadow-[0_48px_80px_-20px_rgba(16,185,129,0.15)] transition-all duration-700 cursor-pointer overflow-hidden relative active:scale-95"
              >
                <div className="absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-5 transition-opacity duration-700 -z-10" />
                <div className="p-10">
                  <div className={cn(
                    "w-20 h-20 rounded-3xl flex items-center justify-center text-white shadow-2xl mb-8 group-hover:rotate-12 transition-all duration-700 group-hover:scale-110 bg-gradient-to-br",
                    role.color
                  )}>
                    <role.icon size={40} />
                  </div>
                  <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tight mb-4">{role.label}</h3>
                  <p className="text-sm font-bold text-slate-500 uppercase tracking-widest leading-relaxed">{role.desc}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default LoginPage;
