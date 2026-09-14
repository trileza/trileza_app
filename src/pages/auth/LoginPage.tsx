import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { Button, Card } from '../../components/ui';
import { LoadingOverlay } from '../../components/shared';
import { useAuthStore } from '../../store/authStore';
import { useSettingsStore } from '../../store/settingsStore';
import { nexus } from '../../lib/nexus';
import type { UserRole } from '../../store/authStore';
import { 
  GraduationCap, 
  Users,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowLeft,
  Loader2,
  Camera,
  AlertCircle,
  Sun,
  Moon,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../../utils';
import { PricingSection } from '../../components/pricing/PricingSection';

type AuthView = 'landing' | 'login' | 'signup' | 'verify' | 'forgot' | 'reset';

const LoginPage = () => {
  const navigate = useNavigate();
  const { signIn, signUp, loading } = useAuthStore();
  const { theme, updateSetting } = useSettingsStore();
  const [view, setView] = useState<AuthView>('landing');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Password reset. There was no way to recover an account at all: anyone who
  // forgot their password was permanently locked out, with no link anywhere in
  // the UI, even though the backend supported the whole flow.
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetBusy, setResetBusy] = useState(false);

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
  // Individuals always register as a mentee; mentor status is an upgrade
  // that goes through application and admin review. Held as a constant so no
  // code path can submit a different role at sign-up.
  const selectedRole: UserRole = 'mentee';

  // Unified Profile State
  const [username, setUsername] = useState('');
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

  // Fetch avatar on blur when email is entered during sign-in
  const handleEmailBlur = async () => {
    if (view === 'login' && email && email.includes('@')) {
      try {
        // A function that returns the avatar alone: signed-out visitors can no
        // longer read the profiles table.
        const { data } = await nexus.database.rpc('get_sign_in_avatar', {
          p_email: email.trim().toLowerCase()
        });

        if (typeof data === 'string' && data) {
          setSignInAvatarUrl(data);
        } else {
          setSignInAvatarUrl(null);
        }
      } catch (err) {
        setSignInAvatarUrl(null);
      }
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const rawUsername = username.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase().trim();
    if (rawUsername.length < 3) {
      setError('Username handle must be at least 3 characters (e.g. @ileza).');
      return;
    }
    const usernameHandle = `@${rawUsername}`;

    if (!surname.trim() || !firstName.trim()) {
      setError('Surname and First Name are strictly required.');
      return;
    }

    if (!phoneNumber) {
      setError('Phone number with country code is required.');
      return;
    }

    if (!avatarFile) {
      setError('Profile picture upload is mandatory to build an identity on Trileza.');
      return;
    }

    // Check username uniqueness in profiles table
    try {
      const { data: existingUser } = await nexus.database
        .from('public_profiles')
        .select('id')
        .eq('username', usernameHandle)
        .maybeSingle();

      if (existingUser) {
        setError(`The username "${usernameHandle}" is already taken. Please choose another handle.`);
        return;
      }
    } catch (err) {
      // Continue if profiles query passes
    }

    const fullName = [surname.trim(), firstName.trim(), middleName.trim()].filter(Boolean).join(' ');

    const metadata = {
      username: usernameHandle,
      surname: surname.trim(),
      first_name: firstName.trim(),
      middle_name: middleName.trim(),
      phone_number: phoneNumber,
      avatar_url: avatarFile,
      full_name: fullName
    };

    const { error } = await signUp(email, password, fullName, selectedRole, metadata);
    if (error) {
      setError(error);
    } else {
      setPendingRegistration({ email, role: selectedRole, metadata });
      setView('verify');
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const otp = verificationCode.join('');
    
    if (otp.length < 6) {
      setError('Please enter the complete 6-digit access code.');
      return;
    }

    let registrationMetadata = pendingRegistration?.metadata;

    if (!registrationMetadata) {
      const fullName = [surname.trim(), firstName.trim(), middleName.trim()].filter(Boolean).join(' ');
      const rawUsername = username.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase().trim();
      const usernameHandle = rawUsername ? `@${rawUsername}` : undefined;
      registrationMetadata = {
        username: usernameHandle,
        surname: surname.trim(),
        first_name: firstName.trim(),
        middle_name: middleName.trim(),
        phone_number: phoneNumber,
        avatar_url: avatarFile,
        full_name: fullName
      };
    }

    const { error } = await useAuthStore.getState().verifyEmail(email, otp, registrationMetadata);
    
    if (error) {
      setError(error);
    } else {
      setPendingRegistration(null);
      setSuccessMsg('Identity verified! Access established.');
    }
  };

  /**
   * Step 1 of password recovery: email a reset code.
   *
   * The response is deliberately identical whether or not the address has an
   * account. Saying "no account with that email" would let anyone test
   * addresses against the platform to discover who is registered.
   */
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const address = email.trim().toLowerCase();
    if (!address || !address.includes('@')) {
      setError('Enter the email address for your account.');
      return;
    }

    setResetBusy(true);
    try {
      await nexus.auth.sendResetPasswordEmail({ email: address });
      setSuccessMsg(`If an account exists for ${address}, a reset code is on its way.`);
      setView('reset');
    } catch (err: any) {
      console.error('[Auth] Could not send reset code:', err);
      setError('We could not send a reset code just now. Please try again shortly.');
    } finally {
      setResetBusy(false);
    }
  };

  /**
   * Step 2: exchange the emailed code for a token, then set the new password.
   */
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!resetCode.trim()) {
      setError('Enter the code from your email.');
      return;
    }
    if (newPassword.length < 6) {
      setError('Your new password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Those passwords do not match.');
      return;
    }

    setResetBusy(true);
    try {
      // Two steps: the emailed code is exchanged for a short-lived token,
      // and that token — not the code — authorises the password change.
      const { data: exchanged, error: exchangeErr } = await nexus.auth.exchangeResetPasswordToken({
        email: email.trim().toLowerCase(),
        code: resetCode.trim(),
      });

      if (exchangeErr || !exchanged?.token) {
        setError('That code is not valid or has expired. Request a new one.');
        return;
      }

      const { error: resetErr } = await nexus.auth.resetPassword({
        otp: exchanged.token,
        newPassword,
      });

      if (resetErr) {
        setError(resetErr.message || 'We could not reset your password. Please try again.');
        return;
      }

      setResetCode('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccessMsg('Password updated. Sign in with your new password.');
      setView('login');
    } catch (err: any) {
      console.error('[Auth] Password reset failed:', err);
      setError('We could not reset your password. Please try again.');
    } finally {
      setResetBusy(false);
    }
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setUsername('');
    setSurname('');
    setFirstName('');
    setMiddleName('');
    setPhoneNumber(undefined);
    setResetCode('');
    setNewPassword('');
    setConfirmPassword('');
    setError(null);
    setSuccessMsg(null);
  };

  const toggleTheme = () => {
    const isCurrentlyDark = document.documentElement.classList.contains('dark');
    const nextTheme = isCurrentlyDark ? 'light' : 'dark';
    updateSetting('theme', nextTheme);
  };

  // ─── AUTH FORM (Login/Signup) ─────────────────────────────────
  if (view === 'login' || view === 'signup') {
    return (
      <div className="min-h-screen bg-[#F8F8F8] dark:bg-[#000000] text-slate-900 dark:text-slate-100 flex items-center justify-center p-6 relative overflow-hidden font-sans transition-colors duration-300">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-emerald-500/10 dark:bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none -z-10" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-indigo-500/10 dark:bg-indigo-500/10 rounded-full blur-[140px] pointer-events-none -z-10" />

        <header className="fixed top-0 left-0 w-full z-50 bg-[#F8F8F8]/95 dark:bg-[#000000]/95 backdrop-blur-2xl border-b border-transparent px-6 md:px-12 py-4 pt-safe flex items-center justify-between shadow-xs dark:shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
          <button 
            onClick={() => { setView('landing'); resetForm(); }} 
            className="flex items-center gap-3 group cursor-pointer bg-transparent border-none outline-none"
          >
            <div className="w-12 h-12 flex items-center justify-center group-hover:scale-110 transition-all duration-300">
              <img 
                src="/icon-192.png" 
                alt="Trileza Logo" 
                className="w-full h-full object-contain scale-110 logo-white-dark transition-all" 
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://api.dicebear.com/7.x/initials/svg?seed=Tr&backgroundColor=059669';
                }} 
              />
            </div>
            <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tight hidden sm:block">Trileza</span>
          </button>
          
          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/15 transition-all cursor-pointer"
              title="Toggle Theme"
            >
              <Sun className="hidden dark:block w-4 h-4 text-amber-400" />
              <Moon className="block dark:hidden w-4 h-4 text-slate-700" />
            </button>

            <button 
              onClick={() => { setView('landing'); resetForm(); }}
              className="flex items-center gap-2 text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white transition-all text-sm font-bold bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 px-4 py-2 rounded-full border border-slate-200 dark:border-white/15 shadow-sm dark:shadow-lg cursor-pointer"
            >
              <ArrowLeft size={16} /> Back to Home
            </button>
          </div>
        </header>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "w-full transition-all duration-300 pt-16 sm:pt-20 pb-12",
            view === 'login' ? "max-w-[440px]" : "max-w-2xl"
          )}
        >
          <Card className={cn(
            "border border-slate-200 dark:border-emerald-900/40 shadow-2xl dark:shadow-[0_30px_70px_-15px_rgba(0,0,0,0.9)] bg-white dark:bg-[#0c1712] backdrop-blur-2xl ring-1 ring-slate-200/50 dark:ring-white/10 transition-all duration-300",
            view === 'login' ? "p-7 sm:p-9 rounded-[2rem]" : "p-8 sm:p-10 rounded-[3rem]"
          )}>
            {view === 'login' && (
              <div className="flex justify-center mb-5">
                <div className="relative group">
                  <div className="absolute -inset-1 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 opacity-30 blur-md" />
                  {signInAvatarUrl ? (
                    <img 
                      src={signInAvatarUrl} 
                      className="relative w-16 h-16 rounded-full border-3 border-slate-200 dark:border-[#162a20] shadow-xl object-cover bg-slate-100 dark:bg-slate-900 animate-in fade-in zoom-in duration-300"
                      alt="User Avatar"
                    />
                  ) : (
                    <div className="relative w-16 h-16 rounded-full border-3 border-slate-200 dark:border-[#162a20] bg-slate-100 dark:bg-[#122019] flex items-center justify-center text-slate-400 shadow-lg">
                      <User size={28} className="text-emerald-600 dark:text-emerald-400" />
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className={cn("text-center", view === 'login' ? "mb-6" : "mb-10")}>
              <h1 className={cn("font-black text-slate-900 dark:text-white tracking-tight", view === 'login' ? "text-2xl sm:text-3xl" : "text-3xl sm:text-4xl")}>
                {view === 'login' ? 'Welcome Back' : 'Join Trileza'}
              </h1>
              <p className="text-slate-600 dark:text-slate-400 font-medium mt-1.5 text-xs sm:text-sm">
                {view === 'login' 
                  ? 'Sign in to your elite learning dashboard' 
                  : 'Create your detailed professional profile'}
              </p>
            </div>

            <form onSubmit={view === 'login' ? handleLogin : handleSignUp} className={view === 'login' ? "space-y-4" : "space-y-7"}>
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
                        className="w-24 h-24 rounded-full bg-slate-100 dark:bg-[#122019] ring-4 ring-emerald-500/40 shadow-2xl transition-all group-hover:scale-105 object-cover"
                        alt="Avatar Preview"
                      />
                    ) : (
                      <div className="w-24 h-24 rounded-full bg-slate-100 dark:bg-[#122019] border-2 border-slate-300 dark:border-emerald-900/50 shadow-2xl transition-all group-hover:scale-105 flex items-center justify-center text-slate-400">
                        <User size={44} className="text-slate-400" />
                      </div>
                    )}
                    <div className="absolute bottom-0 right-0 p-2 rounded-full bg-emerald-500 text-white dark:text-slate-950 shadow-lg group-hover:bg-emerald-400 transition-colors z-0 font-bold">
                      <Camera size={15} />
                    </div>
                  </div>
                  <p className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest">
                    Upload Profile Picture <span className="text-rose-500 font-bold">*</span>
                  </p>
                </div>
              )}

              <div className={view === 'login' ? "space-y-4" : "grid grid-cols-1 md:grid-cols-2 gap-5"}>
                {view === 'signup' && (
                  <>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-[0.15em]">Surname</label>
                      <input 
                        type="text"
                        value={surname}
                        onChange={(e) => setSurname(e.target.value)}
                        placeholder="Last name"
                        required
                        className="w-full px-5 py-4 bg-slate-50 dark:bg-[#122019] border border-slate-200 dark:border-emerald-900/50 rounded-2xl text-sm font-semibold text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-[0.15em]">First Name</label>
                      <input 
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="First name"
                        required
                        className="w-full px-5 py-4 bg-slate-50 dark:bg-[#122019] border border-slate-200 dark:border-emerald-900/50 rounded-2xl text-sm font-semibold text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-[0.15em]">Middle Name</label>
                      <input 
                        type="text"
                        value={middleName}
                        onChange={(e) => setMiddleName(e.target.value)}
                        placeholder="Middle name"
                        className="w-full px-5 py-4 bg-slate-50 dark:bg-[#122019] border border-slate-200 dark:border-emerald-900/50 rounded-2xl text-sm font-semibold text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-[0.15em]">Phone Identity</label>
                      <div className="relative phone-input-container">
                        <PhoneInput
                          placeholder="Phone number"
                          value={phoneNumber}
                          onChange={setPhoneNumber}
                          defaultCountry="NG"
                          international
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-[0.15em] flex items-center justify-between">
                        <span>Username Handle</span>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold lowercase tracking-normal">for tagging & search</span>
                      </label>
                      <div className="relative">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400 dark:text-slate-500 select-none text-base">
                          @
                        </div>
                        <input 
                          type="text"
                          value={username.startsWith('@') ? username.slice(1) : username}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
                            setUsername(raw ? `@${raw}` : '');
                          }}
                          placeholder="ileza"
                          required
                          className="w-full px-5 py-4 pl-9 bg-slate-50 dark:bg-[#122019] border border-slate-200 dark:border-emerald-900/50 rounded-2xl text-sm font-semibold text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
                        />
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium ml-1">Must be unique (e.g. @ileza).</p>
                    </div>
                  </>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-[0.15em]">Email Identity</label>
                  <div className="relative">
                    <input 
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onBlur={handleEmailBlur}
                      placeholder="alex@trileza.com"
                      required
                      className="w-full px-4 py-3.5 pl-11 bg-slate-50 dark:bg-[#122019] border border-slate-200 dark:border-emerald-900/50 rounded-xl text-sm font-semibold text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
                    />
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={17} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-[0.15em]">Security Key</label>
                  <div className="relative">
                    <input 
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      required
                      className="w-full px-4 py-3.5 pl-11 pr-11 bg-slate-50 dark:bg-[#122019] border border-slate-200 dark:border-emerald-900/50 rounded-xl text-sm font-semibold text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
                    />
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={17} />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
                    >
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                  {view === 'login' && (
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => { setView('forgot'); setError(null); setSuccessMsg(null); }}
                        className="text-xs font-bold text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 transition-colors cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* No role selection at sign-up.
                *
                * An individual always registers as a mentee. Becoming a mentor
                * is an upgrade taken from the mentee dashboard, and it goes
                * through the mentor application and admin review — picking
                * "Mentor / Instructor" here skipped that vetting entirely.
                * Institutions register through /institution-signup instead. */}

              {error && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-xl flex items-center gap-2.5 text-rose-700 dark:text-rose-400 text-xs font-bold"
                >
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{error}</span>
                </motion.div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className={cn(
                  "w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:text-slate-950 font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-500/25 transition-all border-none cursor-pointer",
                  view === 'login' ? "py-4" : "py-5 rounded-2xl"
                )}
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="animate-spin" size={16} />
                    <span>Synchronizing...</span>
                  </div>
                ) : (
                  view === 'login' ? 'Authenticate Access' : 'Establish Profile'
                )}
              </Button>
            </form>

            <div className={cn("text-center border-t border-slate-200 dark:border-emerald-900/40", view === 'login' ? "mt-6 pt-5" : "mt-8 pt-6")}>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {view === 'login' ? 'New to the network?' : 'Identity already exists?'}
                {' '}
                <button 
                  onClick={() => { setView(view === 'login' ? 'signup' : 'login'); setError(null); }} 
                  className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-300 transition-colors ml-1.5 font-black cursor-pointer bg-transparent border-none"
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

  if (view === 'forgot' || view === 'reset') {
    const isRequest = view === 'forgot';
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#070c09] text-slate-900 dark:text-slate-100 flex items-center justify-center p-6 relative overflow-hidden font-sans transition-colors duration-300">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none -z-10" />
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <Card className="p-8 sm:p-10 border border-slate-200 dark:border-emerald-900/40 shadow-2xl bg-white dark:bg-[#0c1712] backdrop-blur-2xl rounded-[3rem] ring-1 ring-slate-200/50 dark:ring-white/10">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                {isRequest ? 'Reset Password' : 'Choose a New Password'}
              </h1>
              <p className="text-slate-600 dark:text-slate-400 font-medium mt-2 text-sm">
                {isRequest
                  ? 'We will email you a code to reset your password.'
                  : <>Enter the code sent to <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{email}</span> and pick a new password.</>}
              </p>
            </div>

            <form onSubmit={isRequest ? handleForgotPassword : handleResetPassword} className="space-y-5">
              {isRequest ? (
                <input
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-5 py-4 bg-slate-100/90 dark:bg-[#122019] border-2 border-slate-300 dark:border-emerald-900/80 focus:border-emerald-600 dark:focus:border-emerald-400 rounded-2xl text-sm font-medium text-slate-950 dark:text-white outline-none transition-all"
                />
              ) : (
                <>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value)}
                    placeholder="Reset code from your email"
                    className="w-full px-5 py-4 bg-slate-100/90 dark:bg-[#122019] border-2 border-slate-300 dark:border-emerald-900/80 focus:border-emerald-600 dark:focus:border-emerald-400 rounded-2xl text-center text-lg font-black tracking-widest text-slate-950 dark:text-emerald-300 outline-none transition-all"
                  />
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New password (min. 6 characters)"
                    className="w-full px-5 py-4 bg-slate-100/90 dark:bg-[#122019] border-2 border-slate-300 dark:border-emerald-900/80 focus:border-emerald-600 dark:focus:border-emerald-400 rounded-2xl text-sm font-medium text-slate-950 dark:text-white outline-none transition-all"
                  />
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="w-full px-5 py-4 bg-slate-100/90 dark:bg-[#122019] border-2 border-slate-300 dark:border-emerald-900/80 focus:border-emerald-600 dark:focus:border-emerald-400 rounded-2xl text-sm font-medium text-slate-950 dark:text-white outline-none transition-all"
                  />
                </>
              )}

              {error && <p className="text-rose-600 dark:text-rose-400 text-xs font-bold text-center bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 py-2.5 px-4 rounded-xl">{error}</p>}
              {successMsg && <p className="text-emerald-700 dark:text-emerald-400 text-xs font-bold text-center bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 py-2.5 px-4 rounded-xl">{successMsg}</p>}

              <Button type="submit" disabled={resetBusy} className="w-full py-5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:text-slate-950 font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-500/25 transition-all border-none cursor-pointer">
                {resetBusy ? 'Please wait...' : isRequest ? 'Send Reset Code' : 'Update Password'}
              </Button>

              <div className="flex items-center justify-between text-xs font-bold">
                <button
                  type="button"
                  onClick={() => { setView('login'); setError(null); setSuccessMsg(null); }}
                  className="text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 transition-colors cursor-pointer"
                >
                  Back to sign in
                </button>
                {!isRequest && (
                  <button
                    type="button"
                    onClick={() => { setView('forgot'); setError(null); setSuccessMsg(null); }}
                    className="text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 transition-colors cursor-pointer"
                  >
                    Send a new code
                  </button>
                )}
              </div>
            </form>
          </Card>
        </motion.div>
      </div>
    );
  }

  if (view === 'verify') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#070c09] text-slate-900 dark:text-slate-100 flex items-center justify-center p-6 relative overflow-hidden font-sans transition-colors duration-300">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none -z-10" />
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <Card className="p-8 sm:p-10 border border-slate-200 dark:border-emerald-900/40 shadow-2xl bg-white dark:bg-[#0c1712] backdrop-blur-2xl rounded-[3rem] ring-1 ring-slate-200/50 dark:ring-white/10">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Verify Identity</h1>
              <p className="text-slate-600 dark:text-slate-400 font-medium mt-2 text-sm">Enter the code sent to <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{email}</span></p>
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
                    className="otp-input w-12 h-14 sm:w-14 sm:h-16 bg-slate-100/90 hover:bg-white focus:bg-white dark:bg-[#122019] dark:focus:bg-[#162a20] border-2 border-slate-300 hover:border-slate-400 focus:border-emerald-600 dark:border-emerald-900/80 dark:hover:border-emerald-500/50 dark:focus:border-emerald-400 rounded-2xl text-center text-2xl font-black text-slate-950 dark:text-emerald-300 outline-none shadow-xs focus:shadow-md focus:ring-4 focus:ring-emerald-500/20 dark:focus:ring-emerald-500/30 transition-all cursor-text"
                  />
                ))}
              </div>

              {error && <p className="text-rose-600 dark:text-rose-400 text-xs font-bold text-center bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 py-2.5 px-4 rounded-xl">{error}</p>}
              
              <Button type="submit" disabled={loading} className="w-full py-5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:text-slate-950 font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-500/25 transition-all border-none cursor-pointer">
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
    <div className="landing-root-container w-full min-h-screen">
      <style dangerouslySetInnerHTML={{ __html: `
        :root, .light {
          --lp-bg: #F8F8F8;
          --lp-bg-subtle: #EFEFEF;
          --lp-card: #ffffff;
          --lp-card-hover: #f1f5f9;
          --lp-border: rgba(15, 23, 42, 0.08);
          --lp-border-accent: rgba(46, 125, 50, 0.4);
          --lp-text-title: #0f172a;
          --lp-text-body: #475569;
          --lp-text-muted: #64748b;
          --lp-accent-mint: #059669;
          --lp-nav-bg: #F8F8F8;
          --lp-nav-border: rgba(15, 23, 42, 0.06);
          --lp-nav-text: #475569;
          --lp-eyebrow-bg: #ecfdf5;
          --lp-eyebrow-border: rgba(46, 125, 50, 0.3);
          --lp-eyebrow-text: #059669;
          --lp-dots: rgba(0, 0, 0, 0.08);
          --lp-glow-1: rgba(250, 204, 21, 0.035);
          --lp-glow-2: rgba(245, 158, 11, 0.025);
          --lp-glow-illo: rgba(251, 191, 36, 0.04);
          --lp-btn-primary-bg: #43A047;
          --lp-btn-primary-text: #ffffff;
          --lp-btn-primary-hover: #059669;
          --lp-btn-sec-bg: #ffffff;
          --lp-btn-sec-border: rgba(15, 23, 42, 0.12);
          --lp-btn-sec-text: #0f172a;
          --lp-btn-sec-hover: #f1f5f9;
          --lp-pricing-featured-bg: #f0fdf4;
          --lp-chip-bg: rgba(255, 255, 255, 0.96);
          --lp-chip-border: rgba(15, 23, 42, 0.10);
          --lp-chip-text: #0f172a;
          --lp-app-band-bg: linear-gradient(135deg, #065f46 0%, #047857 50%, #064e3b 100%);
          --lp-footer-bg: #F8F8F8;
          --lp-footer-border: rgba(15, 23, 42, 0.08);
          --lp-footer-text: #64748b;
          --lp-illo-bg: #EFEFEF;
          --lp-illo-border: rgba(15, 23, 42, 0.08);
          --lp-illo-leaves1: #e2e8f0;
          --lp-illo-leaves2: #cbd5e1;
          --lp-illo-gears: #047857;
          --lp-illo-center: #ffffff;
          --lp-illo-card: #ffffff;
          --lp-illo-card-border: #cbd5e1;
        }

        .dark {
          --lp-bg: #000000;
          --lp-bg-subtle: #080c09;
          --lp-card: #0b120e;
          --lp-card-hover: #101a14;
          --lp-card-border: rgba(52, 211, 153, 0.14);
          --lp-border: rgba(52, 211, 153, 0.14);
          --lp-border-accent: rgba(52, 211, 153, 0.45);
          --lp-text-title: #ffffff;
          --lp-text-body: #cbd5e1;
          --lp-text-muted: #94a3b8;
          --lp-accent-mint: #34d399;
          --lp-nav-bg: #000000;
          --lp-nav-border: transparent;
          --lp-nav-text: #cbd5e1;
          --lp-eyebrow-bg: #0c1e15;
          --lp-eyebrow-border: rgba(52, 211, 153, 0.3);
          --lp-eyebrow-text: #34d399;
          --lp-dots: rgba(52, 211, 153, 0.12);
          --lp-glow-1: rgba(46, 125, 50, 0.12);
          --lp-glow-2: rgba(99, 102, 241, 0.10);
          --lp-glow-illo: rgba(46, 125, 50, 0.15);
          --lp-btn-primary-bg: #43A047;
          --lp-btn-primary-text: #020617;
          --lp-btn-primary-hover: #34d399;
          --lp-btn-sec-bg: rgba(255, 255, 255, 0.06);
          --lp-btn-sec-border: rgba(255, 255, 255, 0.14);
          --lp-btn-sec-text: #ffffff;
          --lp-btn-sec-hover: rgba(255, 255, 255, 0.12);
          --lp-pricing-featured-bg: #0a1f16;
          --lp-chip-bg: rgba(11, 18, 14, 0.94);
          --lp-chip-border: rgba(52, 211, 153, 0.28);
          --lp-chip-text: #ffffff;
          --lp-app-band-bg: linear-gradient(135deg, #07472e 0%, #09281a 50%, #05140d 100%);
          --lp-footer-bg: #000000;
          --lp-footer-border: rgba(255, 255, 255, 0.08);
          --lp-footer-text: #94a3b8;
          --lp-illo-bg: #0b2419;
          --lp-illo-border: rgba(52, 211, 153, 0.2);
          --lp-illo-leaves1: #144d32;
          --lp-illo-leaves2: #1e734c;
          --lp-illo-gears: #073522;
          --lp-illo-center: #051f14;
          --lp-illo-card: #08140e;
          --lp-illo-card-border: #1f4230;
        }

        .landing-root-container {
          background: var(--lp-bg);
          color: var(--lp-text-body);
          font-family: 'Inter', sans-serif;
          -webkit-font-smoothing: antialiased;
          overflow-x: hidden;
          transition: background-color 0.3s ease, color 0.3s ease;
        }
        .landing-root-container a { color: inherit; text-decoration: none; }
        .wrap { max-width: 1180px; margin: 0 auto; padding: 0 32px; }

        /* Ensure borders within landing page are visible */
        .landing-root-container .lp-bordered {
          border: 1px solid var(--lp-border) !important;
        }

        /* ---------- LOGO INVERSION ---------- */
        .dark .landing-root-container img[src*="logo.png"],
        .dark .logo-white-dark {
          filter: brightness(0) invert(1) drop-shadow(0 2px 8px rgba(255, 255, 255, 0.25)) !important;
        }

        /* ---------- NAV ---------- */
        .landing-root-container nav {
          display: flex; align-items: center; justify-content: space-between;
          padding: 18px 40px;
          border-bottom: 1px solid var(--lp-nav-border) !important;
          position: sticky; top: 0; background: var(--lp-nav-bg); backdrop-filter: blur(16px);
          z-index: 50;
          transition: all 0.3s ease;
        }
        .brand { display: flex; align-items: center; gap: 12px; }
        .brand-text .name { font-family: 'Outfit', sans-serif; font-weight: 800; font-size: 22px; letter-spacing: -0.04em; color: var(--lp-text-title); }
        .nav-links { display: flex; gap: 32px; font-size: 14px; font-weight: 600; color: var(--lp-nav-text); }
        .nav-links a:hover { color: var(--lp-text-title); }
        .nav-right { display: flex; align-items: center; gap: 16px; }

        /* ---------- HERO ---------- */
        .hero { position: relative; overflow: hidden; background: var(--lp-bg); transition: background 0.3s ease; }
        .grid-dots {
          position: absolute; inset: 0; z-index: 0;
          background-image: radial-gradient(circle, var(--lp-dots) 1.2px, transparent 1.2px);
          background-size: 28px 28px;
          mask-image: radial-gradient(ellipse 85% 75% at 30% 35%, black 35%, transparent 80%);
        }
        .hero-glow-1 {
          position: absolute; top: -150px; left: -100px; width: 500px; height: 500px;
          background: var(--lp-glow-1); border-radius: 50%; filter: blur(140px); pointer-events: none; z-index: 0;
        }
        .hero-glow-2 {
          position: absolute; bottom: -100px; right: -50px; width: 450px; height: 450px;
          background: var(--lp-glow-2); border-radius: 50%; filter: blur(140px); pointer-events: none; z-index: 0;
        }
        .hero-inner {
          max-width: 1200px; margin: 0 auto;
          display: grid; grid-template-columns: 1.05fr 0.95fr; align-items: center; gap: 32px;
          padding: 72px 40px 48px;
          position: relative; z-index: 2;
        }
        .eyebrow { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; color: var(--lp-eyebrow-text); background: var(--lp-eyebrow-bg); border: 1px solid var(--lp-eyebrow-border) !important; padding: 7px 16px; border-radius: 100px; margin-bottom: 22px; box-shadow: 0 4px 12px rgba(0,0,0,0.04); }
        .eyebrow .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--lp-eyebrow-text); box-shadow: 0 0 10px var(--lp-eyebrow-text); }
        h1 { font-weight: 800; font-size: clamp(36px,4.3vw,54px); line-height: 1.12; letter-spacing: -0.03em; color: var(--lp-text-title); max-width: 540px; text-align: left; }
        h1 .accent { color: var(--lp-accent-mint); position: relative; text-shadow: 0 0 24px rgba(52,211,153,0.35); }
        h1 .accent svg { position: absolute; left: 0; bottom: -8px; width: 100%; height: 14px; overflow: visible; }
        .hero-sub { max-width: 480px; margin: 20px 0 32px; font-size: 17px; line-height: 1.65; color: var(--lp-text-body); text-align: left; }
        .hero-ctas-desktop { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin-bottom: 24px; }
        .hero-ctas-mobile { display: none; }
        .btn-primary { display: inline-flex; align-items: center; gap: 8px; background: var(--lp-btn-primary-bg); color: var(--lp-btn-primary-text); font-size: 15px; font-weight: 800; padding: 14px 28px; border-radius: 12px; transition: all .2s ease; border: none; cursor: pointer; box-shadow: 0 10px 25px -4px rgba(46, 125, 50,0.45); }
        .btn-primary:hover { background: var(--lp-btn-primary-hover); transform: translateY(-2px); box-shadow: 0 14px 30px -4px rgba(52,211,153,0.55); }
        .btn-secondary { display: inline-flex; align-items: center; gap: 8px; background: var(--lp-btn-sec-bg); color: var(--lp-btn-sec-text); font-size: 15px; font-weight: 700; padding: 14px 24px; border-radius: 12px; border: 1px solid var(--lp-btn-sec-border) !important; backdrop-filter: blur(8px); cursor: pointer; transition: all .2s ease; box-shadow: 0 4px 12px rgba(0,0,0,0.04); }
        .btn-secondary:hover { background: var(--lp-btn-sec-hover); transform: translateY(-2px); border-color: var(--lp-border-accent) !important; }

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
          box-shadow: 0 4px 12px rgba(0,0,0,0.12);
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
        .illo-wrap { position: relative; z-index: 2; display: flex; align-items: center; justify-content: center; width: 100%; }
        .hero-illustration-img {
          width: 100%;
          max-width: 480px;
          height: auto;
          object-fit: contain;
          filter: drop-shadow(0 20px 40px rgba(0, 0, 0, 0.35));
          transition: transform 0.3s ease;
        }
        .hero-illustration-img:hover {
          transform: translateY(-4px) scale(1.02);
        }
        .float-chip {
          position: absolute; z-index: 3;
          background: var(--lp-chip-bg);
          border: 1px solid var(--lp-chip-border) !important;
          border-radius: 16px;
          padding: 12px 18px;
          box-shadow: 0 20px 40px rgba(0,0,0,0.08), 0 0 20px rgba(52, 211, 153, 0.10);
          backdrop-filter: blur(12px);
          display: flex; align-items: center; gap: 12px;
          animation: float 6s ease-in-out infinite;
        }
        .float-chip.chip-1 { top: 6%; left: -2%; animation-delay: 0s; }
        .float-chip.chip-2 { bottom: 8%; right: -4%; animation-delay: 2s; border-color: rgba(192, 132, 252, 0.3) !important; }
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        .chip-icon { width: 34px; height: 34px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 14px; }
        .chip-text .big { font-size: 14px; font-weight: 700; color: var(--lp-text-title); line-height: 1.15; text-align: left; }
        .chip-text .small { font-size: 11.5px; color: var(--lp-text-muted); text-align: left; font-weight: 500; }

        @media (max-width:900px){
          .hero-inner { grid-template-columns: 1fr; text-align: center; padding: 48px 24px 24px; }
          h1 { max-width: 100%; text-align: center; margin: 0 auto; }
          .hero-sub { margin-left: auto; margin-right: auto; text-align: center; }
          .hero-ctas-desktop { display: none; }
          .hero-ctas-mobile { display: flex; justify-content: center; align-items: center; gap: 14px; flex-wrap: wrap; margin-top: 32px; }
          .float-chip { display: none; }
          .hero-illustration-img { max-width: 320px; }
        }

        /* ---------- SECTION HEAD ---------- */
        .section-head { max-width: 650px; margin: 0 auto 48px; text-align: center; }
        .section-head h2 { font-weight: 800; font-size: clamp(28px,3.2vw,40px); line-height: 1.2; letter-spacing: -0.025em; color: var(--lp-text-title); }
        .section-head p { color: var(--lp-text-body); margin-top: 12px; font-size: 16px; line-height: 1.6; }
        .section-eyebrow { font-size: 12px; color: var(--lp-eyebrow-text); margin-bottom: 12px; display: inline-block; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; background: var(--lp-eyebrow-bg); border: 1px solid var(--lp-eyebrow-border) !important; padding: 5px 14px; border-radius: 100px; }

        /* ---------- TRUSTED BAND ---------- */
        .trusted-band {
          padding: 44px 0;
          background: var(--lp-bg-subtle);
          border-top: 1px solid var(--lp-border) !important;
          border-bottom: 1px solid var(--lp-border) !important;
          transition: background 0.3s ease, border-color 0.3s ease;
        }
        .trusted-label {
          font-size: 11.5px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--lp-accent-mint);
          margin-bottom: 22px;
          text-align: center;
        }
        .trusted-row {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: center;
          gap: 16px;
        }
        .trusted-pill {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          background: var(--lp-card);
          border: 1px solid var(--lp-border) !important;
          padding: 10px 20px;
          border-radius: 16px;
          font-size: 13.5px;
          font-weight: 700;
          color: var(--lp-text-title);
          box-shadow: 0 4px 14px rgba(0,0,0,0.03);
          transition: all 0.2s ease;
        }
        .trusted-pill:hover {
          transform: translateY(-2px);
          border-color: var(--lp-border-accent) !important;
          background: var(--lp-card-hover);
        }
        .trusted-tag {
          width: 32px;
          height: 32px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11.5px;
          font-weight: 900;
          border: 1px solid currentColor !important;
        }

        /* ---------- FEATURES ---------- */
        .features { padding: 90px 0 100px; background: var(--lp-bg); transition: background 0.3s ease; }
        .f-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
        .f-card {
          background: var(--lp-card);
          border: 1px solid var(--lp-border) !important;
          border-radius: 20px;
          padding: 28px;
          transition: all .25s ease;
          text-align: left;
          box-shadow: 0 10px 25px rgba(0,0,0,0.03);
        }
        .f-card:hover {
          background: var(--lp-card-hover);
          border-color: var(--lp-border-accent) !important;
          transform: translateY(-4px);
          box-shadow: 0 18px 40px rgba(0,0,0,0.06), 0 0 25px rgba(52,211,153,0.12);
        }
        .f-icon {
          width: 46px; height: 46px; border-radius: 13px;
          display: flex; align-items: center; justify-content: center;
          font-size: 20px; font-weight: bold; margin-bottom: 18px; color: #ffffff;
          box-shadow: 0 6px 16px rgba(0,0,0,0.15);
        }
        .f-card h3 { font-size: 18px; font-weight: 800; margin-bottom: 8px; color: var(--lp-text-title); letter-spacing: -0.01em; }
        .f-card p { font-size: 14px; line-height: 1.6; color: var(--lp-text-body); }
        @media (max-width: 860px) { .f-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 560px) { .f-grid { grid-template-columns: 1fr; } }

        /* ---------- FOR INSTITUTIONS SHOWCASE ---------- */
        .institutions-section {
          padding: 90px 0 100px;
          background: var(--lp-bg-subtle);
          border-top: 1px solid var(--lp-border) !important;
          border-bottom: 1px solid var(--lp-border) !important;
          transition: background 0.3s ease, border-color 0.3s ease;
        }
        .inst-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
        }
        .inst-card {
          background: var(--lp-card);
          border: 1px solid var(--lp-border) !important;
          border-radius: 24px;
          padding: 32px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          text-align: left;
          box-shadow: 0 10px 25px rgba(0,0,0,0.03);
          transition: all 0.25s ease;
        }
        .inst-card:hover {
          background: var(--lp-card-hover);
          border-color: var(--lp-border-accent) !important;
          transform: translateY(-4px);
          box-shadow: 0 18px 40px rgba(0,0,0,0.06), 0 0 25px rgba(52,211,153,0.12);
        }
        .inst-icon-wrap {
          width: 52px;
          height: 52px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
        }
        .inst-card h3 {
          font-size: 19px;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: var(--lp-text-title);
        }
        .inst-card p {
          font-size: 14px;
          line-height: 1.65;
          color: var(--lp-text-body);
        }
        @media (max-width: 860px) { .inst-grid { grid-template-columns: 1fr; } }

        /* ---------- INSTITUTIONAL PRICING TIERS ---------- */
        .pricing-section {
          padding: 90px 0 100px;
          background: var(--lp-bg);
          transition: background 0.3s ease;
        }
        .pricing-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 28px;
          align-items: stretch;
        }
        .pricing-card {
          background: var(--lp-card);
          border: 1px solid var(--lp-border) !important;
          border-radius: 24px;
          padding: 36px 30px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          text-align: left;
          box-shadow: 0 10px 25px rgba(0,0,0,0.03);
          transition: all 0.25s ease;
          position: relative;
        }
        .pricing-card:hover {
          border-color: var(--lp-border-accent) !important;
          transform: translateY(-4px);
          box-shadow: 0 18px 40px rgba(0,0,0,0.06), 0 0 25px rgba(52,211,153,0.12);
        }
        .pricing-card.featured {
          background: var(--lp-pricing-featured-bg);
          border: 2px solid var(--lp-accent-mint) !important;
          box-shadow: 0 20px 45px rgba(46, 125, 50, 0.15), 0 0 35px rgba(52, 211, 153, 0.18);
          transform: scale(1.02);
        }
        .pricing-card.featured:hover {
          transform: scale(1.02) translateY(-4px);
          box-shadow: 0 25px 55px rgba(46, 125, 50, 0.22), 0 0 45px rgba(52, 211, 153, 0.28);
        }
        .pricing-badge {
          position: absolute;
          top: -14px;
          right: 24px;
          background: var(--lp-accent-mint);
          color: #ffffff;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          padding: 5px 14px;
          border-radius: 100px;
          box-shadow: 0 4px 12px rgba(46, 125, 50, 0.4);
        }
        .dark .pricing-badge {
          color: #020617;
        }
        .pricing-name {
          font-size: 22px;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: var(--lp-text-title);
          margin-bottom: 6px;
        }
        .pricing-desc {
          font-size: 13.5px;
          color: var(--lp-text-muted);
          line-height: 1.5;
          min-height: 42px;
        }
        .pricing-price-wrap {
          margin: 20px 0 24px;
          display: flex;
          align-items: baseline;
          gap: 6px;
        }
        .pricing-amount {
          font-size: 42px;
          font-weight: 900;
          letter-spacing: -0.04em;
          color: var(--lp-text-title);
        }
        .pricing-card.featured .pricing-amount {
          color: var(--lp-accent-mint);
        }
        .pricing-interval {
          font-size: 14px;
          font-weight: 600;
          color: var(--lp-text-muted);
        }
        .pricing-features-list {
          list-style: none;
          padding: 20px 0 0;
          margin: 0;
          border-top: 1px solid var(--lp-border) !important;
          display: flex;
          flex-direction: column;
          gap: 14px;
          font-size: 14px;
          font-weight: 600;
          color: var(--lp-text-body);
        }
        .pricing-features-list li {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .pricing-check {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: rgba(46, 125, 50, 0.18);
          color: var(--lp-accent-mint);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 900;
          flex-shrink: 0;
        }
        .pricing-btn-primary {
          width: 100%;
          margin-top: 28px;
          background: var(--lp-btn-primary-bg);
          color: var(--lp-btn-primary-text);
          font-size: 14px;
          font-weight: 800;
          padding: 14px 20px;
          border-radius: 12px;
          border: none;
          cursor: pointer;
          box-shadow: 0 8px 20px rgba(46, 125, 50, 0.35);
          transition: all 0.2s ease;
        }
        .pricing-btn-primary:hover {
          background: var(--lp-btn-primary-hover);
          transform: translateY(-2px);
          box-shadow: 0 12px 26px rgba(46, 125, 50, 0.45);
        }
        .pricing-btn-secondary {
          width: 100%;
          margin-top: 28px;
          background: var(--lp-btn-sec-bg);
          color: var(--lp-btn-sec-text);
          border: 1px solid var(--lp-btn-sec-border) !important;
          font-size: 14px;
          font-weight: 700;
          padding: 14px 20px;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .pricing-btn-secondary:hover {
          background: var(--lp-btn-sec-hover);
          border-color: var(--lp-border-accent) !important;
          transform: translateY(-2px);
        }
        @media (max-width: 860px) {
          .pricing-grid { grid-template-columns: 1fr; }
          .pricing-card.featured { transform: none; }
          .pricing-card.featured:hover { transform: translateY(-4px); }
        }

        /* ---------- APP DOWNLOAD BAND ---------- */
        .app-band {
          margin: 0 32px 100px;
          background: var(--lp-app-band-bg);
          border: 1px solid rgba(52,211,153,0.35) !important;
          border-radius: 28px;
          padding: 56px;
          display: flex; align-items: center; justify-content: space-between;
          gap: 32px; flex-wrap: wrap;
          position: relative; overflow: hidden;
          text-align: left;
          box-shadow: 0 25px 60px -10px rgba(0, 0, 0, 0.25), 0 0 30px rgba(52, 211, 153, 0.15);
        }
        .app-band::before {
          content: ''; position: absolute; right: -40px; top: -60px;
          width: 220px; height: 220px; border-radius: 50%;
          border: 1px solid rgba(255,255,255,0.18) !important;
        }
        .app-band h2 { font-weight: 800; color: #ffffff; font-size: clamp(24px,2.8vw,32px); max-width: 440px; line-height: 1.25; position: relative; z-index: 2; }
        .app-band p { color: #d1fae5; margin-top: 10px; font-size: 15px; max-width: 420px; position: relative; z-index: 2; line-height: 1.55; }
        .app-band .store-row { position: relative; z-index: 2; }

        /* ---------- TESTIMONIALS ---------- */
        .testimonials {
          padding: 90px 0 100px;
          background: var(--lp-bg-subtle);
          border-top: 1px solid var(--lp-border) !important;
          border-bottom: 1px solid var(--lp-border) !important;
          transition: background 0.3s ease, border-color 0.3s ease;
        }
        .t-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; }
        .t-card {
          background: var(--lp-card);
          border: 1px solid var(--lp-border) !important;
          border-radius: 20px;
          padding: 28px;
          display: flex; flex-direction: column; gap: 18px; text-align: left;
          box-shadow: 0 10px 25px rgba(0,0,0,0.03);
          transition: border-color .2s ease, transform .2s ease, background 0.3s ease;
        }
        .t-card:hover {
          border-color: var(--lp-border-accent) !important;
          transform: translateY(-2px);
          background: var(--lp-card-hover);
        }
        .t-quote { font-size: 15px; line-height: 1.65; color: var(--lp-text-body); font-style: italic; }
        .t-person { display: flex; align-items: center; gap: 12px; }
        .t-avatar { width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; color: #ffffff; }
        .t-name { font-size: 14px; font-weight: 700; color: var(--lp-text-title); }
        .t-role { font-size: 12px; color: var(--lp-text-muted); font-weight: 500; }
        @media (max-width: 700px) { .t-grid { grid-template-columns: 1fr; } }

        /* ---------- FOOTER ---------- */
        footer { border-top: 1px solid var(--lp-footer-border) !important; padding: 48px 32px; background: var(--lp-footer-bg); transition: all 0.3s ease; }
        .footer-inner { max-width: 1180px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 20px; }
        .footer-links { display: flex; gap: 28px; font-size: 14px; color: var(--lp-footer-text); font-weight: 500; }
        .footer-links a:hover { color: var(--lp-text-title); }
        .footer-copy { font-size: 13px; color: var(--lp-text-muted); font-weight: 500; }
      ` }} />

      {/* ═══════════ NAVIGATION ═══════════ */}
      <nav>
        <div className="brand cursor-pointer" onClick={() => setView('landing')}>
          <div className="w-14 h-14 flex items-center justify-center">
            <img 
              src="/icon-192.png" 
              alt="Trileza Logo" 
              className="w-full h-full object-contain scale-110 logo-white-dark transition-all" 
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://api.dicebear.com/7.x/initials/svg?seed=Tr&backgroundColor=059669';
              }} 
            />
          </div>
          <div className="brand-text hidden sm:block"><div className="name">Trileza</div></div>
        </div>

        {/* Header Badges & Theme Toggle Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={toggleTheme}
            className="p-2 sm:p-2.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/15 transition-all cursor-pointer shadow-xs"
            title="Toggle theme (Light / Dark)"
          >
            <Sun className="hidden dark:block w-4 h-4 text-amber-400" />
            <Moon className="block dark:hidden w-4 h-4 text-slate-700" />
          </button>

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

      {/* ═══════════ HERO SECTION ═══════════ */}
      <section className="hero">
        <div className="grid-dots"></div>
        <div className="hero-glow-1"></div>
        <div className="hero-glow-2"></div>
        <div className="hero-inner">
          <div className="hero-copy">
            <div className="eyebrow"><span className="dot"></span>The learning platform for individuals and institutions</div>
            <h1>The hub of <span className="accent">unrestrained<svg viewBox="0 0 220 14" preserveAspectRatio="none"><path d="M2 9C40 2 90 2 110 7C130 12 180 4 218 9" stroke="var(--lp-accent-mint)" strokeWidth="2.8" fill="none" strokeLinecap="round"/></svg></span> impact</h1>
            <p className="hero-sub">A single platform for individual learners and institutions. Courses, books, mentors, and live classes — all from one clean, minimalist dashboard.</p>
            <div className="hero-ctas-desktop">
              <button className="btn-primary" onClick={() => { setView('signup'); }}>
                Get Started 
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <button className="btn-secondary" onClick={() => navigate('/institution-signup')}>
                🏢 For Institutions
              </button>
              <button className="btn-secondary" onClick={() => setView('login')}>Sign In</button>
            </div>
          </div>

          <div className="illo-wrap">
            <div className="float-chip chip-1">
              <div className="chip-icon font-bold" style={{ background: 'rgba(46, 125, 50,0.2)', color: 'var(--lp-accent-mint)' }}>✓</div>
              <div className="chip-text"><div className="big">Course completed</div><div className="small">UX Fundamentals</div></div>
            </div>
            <div className="float-chip chip-2">
              <div className="chip-icon font-bold" style={{ background: 'rgba(192,132,252,0.2)', color: '#c084fc' }}>●</div>
              <div className="chip-text"><div className="big">Live class in 10m</div><div className="small">with mentor Aisha</div></div>
            </div>

            <div className="relative flex items-center justify-center w-full">
              <div className="absolute inset-8 bg-yellow-400/[0.05] dark:bg-emerald-500/15 rounded-full blur-3xl -z-10 pointer-events-none transition-all duration-300" />
              <div className="absolute inset-14 bg-amber-300/[0.03] dark:bg-emerald-400/10 rounded-full blur-2xl -z-10 pointer-events-none" />
              <img 
                src="/hero-illustration.png" 
                alt="Trileza Platform - Empowering Learning and Growth" 
                className="hero-illustration-img w-full max-w-[480px] h-auto object-contain select-none"
              />
            </div>
          </div>

          {/* Mobile Hero CTAs */}
          <div className="hero-ctas-mobile">
            <button className="btn-primary" onClick={() => { setView('signup'); }}>
              Get Started 
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <button className="btn-secondary" onClick={() => navigate('/institution-signup')}>
              🏢 For Institutions
            </button>
            <button className="btn-secondary" onClick={() => setView('login')}>Sign In</button>
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
              <div className="f-icon" style={{ background: '#43A047', boxShadow: '0 8px 20px rgba(46, 125, 50,0.35)' }}>▶</div>
              <h3>Courses & Marketplace</h3>
              <p>Take structured courses at your own pace from verified mentors and partner institutions.</p>
            </div>
            <div className="f-card group">
              <div className="f-icon" style={{ background: '#38bdf8', boxShadow: '0 8px 20px rgba(56,189,248,0.35)' }}>▤</div>
              <h3>Public Library</h3>
              <p>Buy or borrow books straight from the platform's own comprehensive digital library.</p>
            </div>
            <div className="f-card group">
              <div className="f-icon" style={{ background: '#fb923c', boxShadow: '0 8px 20px rgba(251,146,60,0.35)' }}>◐</div>
              <h3>Mentorship</h3>
              <p>Connect with mentors, join mentorship programs, or apply to become an expert yourself.</p>
            </div>
            <div className="f-card group">
              <div className="f-icon" style={{ background: '#c084fc', boxShadow: '0 8px 20px rgba(192,132,252,0.35)' }}>●</div>
              <h3>Live Classes</h3>
              <p>Join or schedule live interactive sessions with mentors and instructors in real time.</p>
            </div>
            <div className="f-card group">
              <div className="f-icon" style={{ background: '#fb7185', boxShadow: '0 8px 20px rgba(251,113,133,0.35)' }}>✦</div>
              <h3>Community</h3>
              <p>Discuss, share highlights, and message peers directly — no need to leave the app.</p>
            </div>
            <div className="f-card group">
              <div className="f-icon" style={{ background: '#2dd4bf', boxShadow: '0 8px 20px rgba(45,212,191,0.35)' }}>▥</div>
              <h3>Minimalist Dashboard</h3>
              <p>Everything above, in one ultra-clean view built to stay out of your way.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ THREE-TIER MONETIZATION & PRICING ═══════════ */}
      <PricingSection id="pricing" showComparisonTable={true} />

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
                <div className="t-avatar" style={{ background: '#43A047' }}>JN</div>
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
                src="/icon-192.png" 
                alt="Trileza Logo" 
                className="w-full h-full object-contain scale-110 logo-white-dark transition-all" 
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
