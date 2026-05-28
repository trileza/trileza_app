import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  GraduationCap, 
  User, 
  Briefcase, 
  Award, 
  Shield, 
  Globe, 
  Lock, 
  Mail, 
  BookOpen, 
  Sparkles, 
  MapPin, 
  Clock, 
  HelpCircle, 
  CheckCircle2, 
  ChevronRight, 
  ChevronLeft, 
  Camera,
  FileText,
  Info,
  AlertCircle,
  Video,
  UploadCloud,
  DollarSign,
  Tag,
  Users2,
  Trash2,
  Plus,
  Play,
  Link2
} from 'lucide-react';
import { Card, Button } from '../../components/ui';
import { cn } from '../../utils';
import { useAuthStore } from '../../store/authStore';
import { motion, AnimatePresence } from 'framer-motion';

type OnboardingStep = 
  | 'welcome' 
  | 'account' 
  | 'identity' 
  | 'qualifications' 
  | 'training' 
  | 'course_setup' 
  | 'curriculum' 
  | 'pricing' 
  | 'preferences' 
  | 'review' 
  | 'finalizing';

const EDUCATION_LEVELS = [
  'Bachelor\'s Degree',
  'Master\'s Degree',
  'Doctorate (Ph.D. / Ed.D.)',
  'Professional Certification',
  'Self-taught / Industry Expert'
];

const INDUSTRIES = [
  'Technology & Software Engineering',
  'Architecture & Spatial Design',
  'Sustainability & Green Tech',
  'UI/UX & Interactive Media',
  'Finance, Venture Capital & Business',
  'Education & Cognitive Science'
];

const EXPERIENCE_YEARS = ['0-2 Years', '2-5 Years', '5-10 Years', '10+ Years'];

const COURSE_CATEGORIES = [
  'Software Development',
  'Creative Coding',
  'UI/UX Design',
  'Sustainable Architecture',
  'AI & Machine Learning',
  'Executive Leadership'
];

const PRICE_TIERS = [
  { tier: 'Free', price: '$0.00' },
  { tier: 'Tier A', price: '$19.99' },
  { tier: 'Tier B', price: '$49.99' },
  { tier: 'Tier C', price: '$99.99' },
  { tier: 'Tier D', price: '$199.99' }
];

const TutorOnboarding = () => {
  const navigate = useNavigate();
  const { user, updateProfile } = useAuthStore();
  
  // Step Management
  const [step, setStep] = useState<OnboardingStep>('welcome');
  const [direction, setDirection] = useState(1);
  const [socialConnected, setSocialConnected] = useState<string | null>(null);
  
  // Simulated OTP & File States
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [emailVerified, setEmailVerified] = useState(false);
  const [isVerifyingEmail, setIsVerifyingEmail] = useState(false);
  const [idFileUploaded, setIdFileUploaded] = useState<string | null>(null);
  const [certUploaded, setCertUploaded] = useState<string | null>(null);
  const [promoVideoUploaded, setPromoVideoUploaded] = useState<string | null>(null);
  const [thumbnailUploaded, setThumbnailUploaded] = useState<string | null>(null);

  // Custom Date of Birth Selector States
  const [dobDay, setDobDay] = useState('');
  const [dobMonth, setDobMonth] = useState('');
  const [dobYear, setDobYear] = useState('');

  // CV / LinkedIn States
  const [cvFileName, setCvFileName] = useState<string | null>(null);
  const [linkedinError, setLinkedinError] = useState(false);

  // Dynamic learning objectives state
  const [objectives, setObjectives] = useState<string[]>(['', '', '']);
  
  // Orientation Checklist
  const [orientationModules, setOrientationModules] = useState({
    videoStandards: false,
    pedagogy: false,
    copyright: false
  });

  // State for forms
  const [form, setForm] = useState({
    // Section 2: Personal Profile & Verification
    legalName: '',
    publicName: '',
    dob: '',
    country: 'Nigeria',
    streetAddress: '',
    city: '',
    postalCode: '',
    taxId: '',
    publicBio: '',
    linkedinUrl: '',
    websiteUrl: '',
    avatarUrl: user?.avatar_url || '',
    
    // Section 3: Qualifications
    yearsExp: '5-10 Years',
    highestEducation: '',
    teachingMotivation: '',
    expertiseAreas: [] as string[],
    
    // Section 5: Course Setup
    courseTitle: '',
    courseSubtitle: '',
    courseCategory: '',
    courseTarget: '',
    courseLevel: 'All Levels',
    coursePrereqs: '',
    courseDescription: '',
    courseLanguage: 'English',
    hasPracticeTests: false,
    hasCodingEx: false,
    
    // Section 6: Curriculum Copyright Check
    curriculumConfirmedOriginal: false,
    
    // Section 7: Pricing & Distribution
    courseFreeTrack: 'paid', // free, paid
    selectedPriceTier: 'Tier A',
    couponCode: '',
    couponDiscount: '20',
    distributionOption: 'marketplace', // marketplace, enterprise-only
    
    // Section 8: Communications
    optInNewsletters: true,
    optInFeedback: true,
    optInPromotions: false,
    
    // Section 9: Quality audit
    meetsQualityCheck: false,
    hasFullRightsCheck: false
  });

  // Sync custom DOB selectors to form.dob
  useEffect(() => {
    if (dobDay && dobMonth && dobYear) {
      setForm(prev => ({
        ...prev,
        dob: `${dobYear}-${dobMonth}-${dobDay}`
      }));
    }
  }, [dobDay, dobMonth, dobYear]);

  // Real-time LinkedIn Validation for Tutors
  const handleLinkedinChange = (val: string) => {
    setForm(prev => ({ ...prev, linkedinUrl: val }));
    if (!val) {
      setLinkedinError(false);
      return;
    }
    const linkedinRegex = /^https:\/\/(www\.)?linkedin\.com\/in\/[A-Za-z0-9_-]+\/?$/;
    setLinkedinError(!linkedinRegex.test(val));
  };

  useEffect(() => {
    if (user && !form.legalName) {
      setForm(prev => ({
        ...prev,
        legalName: user.full_name,
        publicName: user.full_name
      }));
    }
  }, [user]);

  const handleNext = (nextStep: OnboardingStep) => {
    setDirection(1);
    setStep(nextStep);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBack = (prevStep: OnboardingStep) => {
    setDirection(-1);
    setStep(prevStep);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFinish = async () => {
    setStep('finalizing');
    
    try {
      const result = await updateProfile({
        mentor_tier: 'provisional', // Gives provisional access pending audit
        metadata: {
          ...user?.metadata,
          tutor_onboarded: true,
          tutor_onboarded_at: new Date().toISOString(),
          tutor_data: {
            identity: {
              legal_name: form.legalName,
              public_name: form.publicName,
              dob: form.dob,
              address: { street: form.streetAddress, city: form.city, postal: form.postalCode, country: form.country },
              tax_id: form.taxId,
              socials: { linkedin: form.linkedinUrl, website: form.websiteUrl }
            },
            qualifications: {
              years_exp: form.yearsExp,
              education: form.highestEducation,
              motivation: form.teachingMotivation,
              skills: form.expertiseAreas
            },
            course_setup: {
              title: form.courseTitle,
              subtitle: form.courseSubtitle,
              category: form.courseCategory,
              level: form.courseLevel,
              target: form.courseTarget,
              objectives: objectives.filter(Boolean),
              prerequisites: form.coursePrereqs,
              description: form.courseDescription,
              language: form.courseLanguage
            },
            pricing: {
              track: form.courseFreeTrack,
              tier: form.selectedPriceTier,
              coupon: form.couponCode ? { code: form.couponCode, discount: form.couponDiscount } : null,
              distribution: form.distributionOption
            },
            preferences: {
              newsletters: form.optInNewsletters,
              feedback_digest: form.optInFeedback,
              marketing_inclusion: form.optInPromotions
            }
          }
        }
      });

      if (result.error) {
        setStep('review');
        return;
      }

      setTimeout(() => navigate('/', { replace: true }), 2000);
    } catch (err) {
      setStep('review');
    }
  };

  const verifyOTP = () => {
    setIsVerifyingEmail(true);
    setTimeout(() => {
      setIsVerifyingEmail(false);
      setEmailVerified(true);
    }, 1500);
  };

  const simulatedSocialConnect = (provider: string) => {
    setSocialConnected(provider);
  };

  const toggleExpertise = (skill: string) => {
    const active = form.expertiseAreas.includes(skill)
      ? form.expertiseAreas.filter(s => s !== skill)
      : [...form.expertiseAreas, skill];
    setForm({...form, expertiseAreas: active});
  };

  const variants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 60 : -60,
      opacity: 0
    }),
    center: {
      x: 0,
      opacity: 1
    },
    exit: (dir: number) => ({
      x: dir < 0 ? 60 : -60,
      opacity: 0
    })
  };

  const StepIndicator = ({ current, total }: { current: number, total: number }) => (
    <div className="flex gap-1.5 mb-8 justify-center">
      {Array.from({ length: total }).map((_, i) => (
        <div 
          key={i} 
          className={cn(
            "h-1.5 rounded-full transition-all duration-500",
            i < current ? "w-5 bg-emerald-500" : i === current ? "w-8 bg-emerald-600 animate-pulse" : "w-2.5 bg-slate-200 dark:bg-slate-800"
          )} 
          title={`Step ${i + 1}`}
        />
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex justify-center items-start p-4 relative py-12 md:py-20 overflow-y-auto">
      {/* Premium Backdrops */}
      <div className="absolute top-[-10%] left-[-5%] w-[50%] h-[50%] bg-emerald-500/5 rounded-full blur-[120px] dark:bg-emerald-500/10 pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[50%] h-[50%] bg-indigo-500/5 rounded-full blur-[120px] dark:bg-indigo-500/10 pointer-events-none" />

      <div className="max-w-3xl w-full relative z-10 mx-auto">
        <AnimatePresence custom={direction} mode="wait">

          {/* ── WELCOME ── */}
          {step === 'welcome' && (
            <motion.div 
              key="welcome" custom={direction} variants={variants} initial="enter" animate="center" exit="exit"
              className="text-center space-y-10"
            >
              <div className="space-y-6">
                <div className="w-24 h-24 bg-gradient-to-tr from-emerald-600 to-emerald-400 rounded-[2rem] flex items-center justify-center mx-auto shadow-2xl shadow-emerald-500/20 group">
                  <Award size={44} className="text-white group-hover:scale-110 transition-transform duration-500" />
                </div>
                <h1 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">
                  Tutor Onboarding & <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-emerald-400">Course Launch</span>.
                </h1>
                <p className="text-lg text-slate-500 dark:text-slate-400 font-medium max-w-xl mx-auto leading-relaxed">
                  Join Trileza as an Elite Instructor. Let\'s verify your identity, qualify your professional certifications, complete orientation, and set up your debut course curriculum!
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-2xl mx-auto">
                <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 rounded-3xl text-center space-y-3 shadow-md">
                  <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center mx-auto">
                    <Shield size={20} />
                  </div>
                  <h3 className="font-bold text-slate-800 dark:text-white text-sm">Verified Profile</h3>
                  <p className="text-xs text-slate-400">Fulfill KYC and regulatory audit specifications for payouts.</p>
                </div>
                <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 rounded-3xl text-center space-y-3 shadow-md">
                  <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center mx-auto">
                    <BookOpen size={20} />
                  </div>
                  <h3 className="font-bold text-slate-800 dark:text-white text-sm">Curriculum Builder</h3>
                  <p className="text-xs text-slate-400">Organize high-resolution video lectures and downloadable coding units.</p>
                </div>
                <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 rounded-3xl text-center space-y-3 shadow-md">
                  <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center mx-auto">
                    <DollarSign size={20} />
                  </div>
                  <h3 className="font-bold text-slate-800 dark:text-white text-sm">Sovereign Earnings</h3>
                  <p className="text-xs text-slate-400">Receive 70% revenue share on premium tiers or set free marketplace hooks.</p>
                </div>
              </div>

              <Button 
                onClick={() => handleNext('account')}
                className="h-16 px-12 bg-slate-900 hover:bg-black dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-[0.2em] rounded-[1.5rem] shadow-xl group transition-all"
              >
                Start Onboarding
                <ChevronRight className="ml-2 group-hover:translate-x-1 transition-transform" size={16} />
              </Button>
            </motion.div>
          )}

          {/* ── SECTION 1: ACCOUNT CREATION ── */}
          {step === 'account' && (
            <motion.div 
              key="account" custom={direction} variants={variants} initial="enter" animate="center" exit="exit"
              className="space-y-6"
            >
              <StepIndicator current={1} total={9} />
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-wider">Section 1</span>
                  <h2 className="text-3xl font-black text-slate-800 dark:text-white">Account Creation</h2>
                </div>
                <p className="text-slate-400 font-medium">Verify your active instructor identity and link optional social credentials.</p>
              </div>

              <Card className="p-8 md:p-10 bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl border-slate-200/50 dark:border-slate-800/50 rounded-[2.5rem] space-y-8">
                {/* Social Login Options */}
                <div className="space-y-4">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-2">Link OAuth Platforms (Optional)</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {['Google', 'Facebook', 'Apple'].map(provider => (
                      <button 
                        key={provider}
                        type="button"
                        onClick={() => simulatedSocialConnect(provider)}
                        className={cn(
                          "flex items-center justify-center gap-3 py-4 px-6 rounded-2xl border font-bold text-sm transition-all",
                          socialConnected === provider
                            ? "bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400"
                            : "bg-slate-50 hover:bg-slate-100 border-slate-200 dark:bg-slate-800/40 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                        )}
                      >
                        {socialConnected === provider ? provider + ' Linked' : 'Link ' + provider}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Email Verification Banner */}
                <div className="p-6 bg-slate-50 dark:bg-slate-800/30 border border-slate-200/50 dark:border-slate-800 rounded-3xl space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                      <Mail size={20} />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-bold text-slate-800 dark:text-white">Active Session Verification</h4>
                      <p className="text-xs text-slate-400">Perform an OTP security clearance to verify this active email node.</p>
                      <span className="text-[10px] bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-500 font-mono inline-block mt-1">Active: {user?.email}</span>
                    </div>
                  </div>

                  {!emailVerified ? (
                    <div className="space-y-4 pt-2">
                      <div className="flex gap-2 justify-center">
                        {otpCode.map((digit, idx) => (
                          <input
                            key={idx}
                            type="text"
                            maxLength={1}
                            placeholder="•"
                            value={digit}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, '');
                              const nextCode = [...otpCode];
                              nextCode[idx] = val;
                              setOtpCode(nextCode);
                              if (val && idx < 5) {
                                document.getElementById(`otp-${idx + 1}`)?.focus();
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Backspace' && !digit && idx > 0) {
                                document.getElementById(`otp-${idx - 1}`)?.focus();
                              }
                            }}
                            id={`otp-${idx}`}
                            className="w-12 h-14 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-center text-xl font-bold text-emerald-600 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                          />
                        ))}
                      </div>

                      <div className="flex items-center justify-between pt-2">
                        <span className="text-[10px] font-black uppercase text-amber-500 tracking-wider flex items-center gap-1">
                          <AlertCircle size={12} /> Verification Code Required
                        </span>
                        <button 
                          type="button"
                          onClick={verifyOTP}
                          disabled={otpCode.join('').length < 6 || isVerifyingEmail}
                          className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider disabled:opacity-40 transition-all"
                        >
                          {isVerifyingEmail ? 'Processing...' : 'Verify Email Code'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-emerald-500/5 border border-emerald-500/30 rounded-2xl flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 size={20} className="flex-shrink-0" />
                      <div className="text-xs">
                        <p className="font-bold">Active Instructor Verified!</p>
                        <p className="opacity-80">Security synchronization established successfully with InsForge key node.</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Account Type Notice */}
                <div className="p-6 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-2">
                  <h4 className="font-bold text-slate-800 dark:text-white text-xs uppercase tracking-wider flex items-center gap-2">
                    <Info size={14} className="text-emerald-500" /> Unified Profile Structure
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                    At Trileza, **separate student and instructor accounts are the same.** You use one unified profile; your role credentials determine whether you have access to the Mentor command center or the Mentee dashboard. Progress variables remain seamlessly mapped.
                  </p>
                </div>

                {/* Navigation Buttons */}
                <div className="flex gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <Button variant="outline" onClick={() => handleBack('welcome')} className="flex-1 h-16 rounded-2xl border-slate-200 dark:border-slate-800 font-bold">Back</Button>
                  <Button 
                    disabled={!emailVerified}
                    onClick={() => handleNext('identity')} 
                    className="flex-[2] h-16 rounded-2xl bg-slate-950 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white font-black uppercase tracking-widest shadow-xl disabled:opacity-50"
                  >
                    Continue
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}

          {/* ── SECTION 2: PERSONAL PROFILE & IDENTITY VERIFICATION ── */}
          {step === 'identity' && (
            <motion.div 
              key="identity" custom={direction} variants={variants} initial="enter" animate="center" exit="exit"
              className="space-y-6"
            >
              <StepIndicator current={2} total={9} />
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-wider">Section 2</span>
                  <h2 className="text-3xl font-black text-slate-800 dark:text-white">Profile & Identity (KYC)</h2>
                </div>
                <p className="text-slate-400 font-medium">Declare payout-eligible legal names, tax IDs, addresses, and ID cards.</p>
              </div>

              <Card className="p-8 md:p-10 bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl border-slate-200/50 dark:border-slate-800/50 rounded-[2.5rem] space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Legal name */}
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-2">Full Legal Name (Required)</label>
                    <input 
                      type="text"
                      value={form.legalName}
                      onChange={e => setForm({...form, legalName: e.target.value})}
                      placeholder="e.g. David Ileza Adamu"
                      className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl px-6 py-4 text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    />
                    <span className="text-[9px] text-slate-400 ml-2 block">For legal contracts and payout tax documents.</span>
                  </div>

                  {/* Public instructor name */}
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-2">Public Instructor Name (Required)</label>
                    <input 
                      type="text"
                      value={form.publicName}
                      onChange={e => setForm({...form, publicName: e.target.value})}
                      placeholder="e.g. Dr. David Ileza"
                      className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl px-6 py-4 text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    />
                    <span className="text-[9px] text-slate-400 ml-2 block">Your visible public persona. Can differ from legal name.</span>
                  </div>

                  {/* Custom Date of Birth selectors */}
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-2">Date of Birth (Age Verification)</label>
                    <div className="grid grid-cols-3 gap-3">
                      {/* Month dropdown */}
                      <select
                        value={dobMonth}
                        onChange={e => setDobMonth(e.target.value)}
                        className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 h-16 text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all appearance-none cursor-pointer"
                      >
                        <option value="">Month</option>
                        {["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"].map(m => (
                          <option key={m} value={m}>{new Date(2000, parseInt(m) - 1).toLocaleString('default', { month: 'long' })}</option>
                        ))}
                      </select>

                      {/* Day dropdown */}
                      <select
                        value={dobDay}
                        onChange={e => setDobDay(e.target.value)}
                        className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 h-16 text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all appearance-none cursor-pointer"
                      >
                        <option value="">Day</option>
                        {Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0')).map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>

                      {/* Year dropdown */}
                      <select
                        value={dobYear}
                        onChange={e => setDobYear(e.target.value)}
                        className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 h-16 text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all appearance-none cursor-pointer"
                      >
                        <option value="">Year</option>
                        {Array.from({ length: 80 }, (_, i) => String(2022 - i)).map(y => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Country */}
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-2">Country / Region of Residence</label>
                    <select 
                      value={form.country}
                      onChange={e => setForm({...form, country: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl px-6 py-4 text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all appearance-none cursor-pointer"
                    >
                      <option value="Nigeria">Nigeria</option>
                      <option value="United States">United States</option>
                      <option value="United Kingdom">United Kingdom</option>
                      <option value="Canada">Canada</option>
                    </select>
                  </div>
                </div>

                {/* ID Card Upload Card (Mandatory for Payouts) */}
                <div className="space-y-4">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-2">Government-Issued ID Verification (Required for Payouts)</label>
                  <div className="p-8 border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 rounded-[2rem] flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-800 shadow flex items-center justify-center text-slate-400">
                      <UploadCloud size={24} />
                    </div>
                    <div className="space-y-1">
                      <h5 className="font-bold text-slate-800 dark:text-white text-sm">Upload Official ID Document</h5>
                      <p className="text-xs text-slate-400 max-w-sm">Passport, driver\'s license, or national identity card. Must be high-resolution PDF or JPEG.</p>
                    </div>
                    <label className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer shadow-md">
                      {idFileUploaded ? 'Change Document' : 'Select ID File'}
                      <input 
                        type="file" 
                        accept=".pdf,image/*" 
                        className="hidden" 
                        onChange={(e) => {
                          if (e.target.files?.[0]) setIdFileUploaded(e.target.files[0].name);
                        }}
                      />
                    </label>
                    {idFileUploaded && (
                      <p className="text-xs text-emerald-500 font-bold flex items-center gap-1.5"><CheckCircle2 size={12} /> {idFileUploaded} attached</p>
                    )}
                  </div>
                </div>

                {/* Billing Address details */}
                <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 ml-2">Mailing / Tax Address</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div className="sm:col-span-3 space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 ml-2">Street Address</label>
                      <input 
                        type="text" 
                        value={form.streetAddress}
                        onChange={e => setForm({...form, streetAddress: e.target.value})}
                        placeholder="e.g. 15 Adetokunbo Ademola St"
                        className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl px-6 py-4 text-xs font-semibold outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 ml-2">City</label>
                      <input 
                        type="text" 
                        value={form.city}
                        onChange={e => setForm({...form, city: e.target.value})}
                        placeholder="e.g. Victoria Island"
                        className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl px-6 py-4 text-xs font-semibold outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 ml-2">Postal / ZIP Code</label>
                      <input 
                        type="text" 
                        value={form.postalCode}
                        onChange={e => setForm({...form, postalCode: e.target.value})}
                        placeholder="e.g. 101241"
                        className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl px-6 py-4 text-xs font-semibold outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 ml-2">Tax ID / TIN / SSN (Optional now)</label>
                      <input 
                        type="text" 
                        value={form.taxId}
                        onChange={e => setForm({...form, taxId: e.target.value})}
                        placeholder="e.g. TIN-124567-X"
                        className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl px-6 py-4 text-xs font-semibold outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Profile Pic, Bio & Links */}
                <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 ml-2">Public Biography & Links</h4>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 ml-2">Public Bio (Public-facing)</label>
                      <textarea 
                        value={form.publicBio}
                        onChange={e => setForm({...form, publicBio: e.target.value})}
                        placeholder="Write a brief summary of your expert background, teaching style, and primary credentials (min 50 chars)..."
                        className="w-full h-24 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-[1.5rem] px-6 py-4 text-xs font-semibold outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none"
                      />
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      {/* LinkedIn input with real validation check */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 ml-2">LinkedIn URL</label>
                        <div className="relative">
                          <Link2 size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input 
                            type="url" 
                            value={form.linkedinUrl}
                            onChange={e => handleLinkedinChange(e.target.value)}
                            placeholder="https://linkedin.com/in/username"
                            className={cn(
                              "w-full h-16 bg-slate-50 dark:bg-slate-900/50 border rounded-2xl pl-12 pr-6 text-xs font-semibold outline-none transition-all",
                              linkedinError 
                                ? "border-amber-500 focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 text-amber-600"
                                : "border-slate-200 dark:border-slate-800 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500"
                            )}
                          />
                        </div>
                        {linkedinError && (
                          <p className="text-[10px] text-amber-500 font-bold ml-2 flex items-center gap-1 animate-pulse">
                            <AlertCircle size={12} /> Must be a valid LinkedIn link (e.g. https://linkedin.com/in/user)
                          </p>
                        )}
                      </div>

                      {/* Professional CV/Resume Upload option */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 ml-2">CV / Resume File</label>
                        <div className="relative flex items-center">
                          <label className={cn(
                            "w-full h-16 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl px-6 flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 cursor-pointer hover:bg-slate-100/50 transition-all",
                            cvFileName && "border-emerald-500/40 bg-emerald-500/[0.02]"
                          )}>
                            <span className="truncate max-w-[80%]">{cvFileName || 'Upload CV / Resume (PDF)'}</span>
                            <UploadCloud size={18} className={cn(cvFileName ? "text-emerald-500" : "text-slate-400")} />
                            <input 
                              type="file" 
                              accept=".pdf,.doc,.docx"
                              className="hidden" 
                              onChange={(e) => {
                                if (e.target.files?.[0]) setCvFileName(e.target.files[0].name);
                              }}
                            />
                          </label>
                          {cvFileName && (
                            <button 
                              type="button" 
                              onClick={() => setCvFileName(null)}
                              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 text-[10px] font-bold flex items-center justify-center text-slate-500"
                              title="Remove CV"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Portfolio website */}
                      <div className="sm:col-span-2 space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 ml-2">Personal Website / Portfolio</label>
                        <input 
                          type="url" 
                          value={form.websiteUrl}
                          onChange={e => setForm({...form, websiteUrl: e.target.value})}
                          placeholder="https://davidarch.io"
                          className="w-full h-16 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl px-6 text-xs font-semibold outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all"
                        />
                      </div>
                    </div>                    </div>
                  </div>
                </div>

                {/* Navigation Buttons */}
                <div className="flex gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                  <Button variant="outline" onClick={() => handleBack('account')} className="flex-1 h-16 rounded-2xl border-2 border-slate-350 dark:border-slate-800 font-extrabold text-sm text-slate-900 dark:text-white hover:bg-slate-50">Back</Button>
                  <Button 
                    disabled={!form.legalName || !form.publicName || linkedinError}
                    onClick={() => handleNext('qualifications')} 
                    className="flex-[2] h-16 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest shadow-xl disabled:opacity-50 transition-all active:scale-[0.98]"
                  >
                    Continue
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}

          {/* ── SECTION 3: EXPERTISE & QUALIFICATION VERIFICATION ── */}
          {step === 'qualifications' && (
            <motion.div 
              key="qualifications" custom={direction} variants={variants} initial="enter" animate="center" exit="exit"
              className="space-y-6"
            >
              <StepIndicator current={3} total={9} />
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-wider">Section 3</span>
                  <h2 className="text-3xl font-black text-slate-800 dark:text-white">Expertise & Qualifications</h2>
                </div>
                <p className="text-slate-400 font-medium">Verify your background, education, and specific subject specialties.</p>
              </div>

              <Card className="p-8 md:p-10 bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl border-slate-200/50 dark:border-slate-800/50 rounded-[2.5rem] space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Years of Experience */}
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-2">Teaching / Operating Experience</label>
                    <select 
                      value={form.yearsExp}
                      onChange={e => setForm({...form, yearsExp: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl px-6 py-4 text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all appearance-none cursor-pointer"
                    >
                      {EXPERIENCE_YEARS.map(exp => <option key={exp} value={exp}>{exp}</option>)}
                    </select>
                  </div>

                  {/* Highest Education */}
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-2">Highest Education Level</label>
                    <select 
                      value={form.highestEducation}
                      onChange={e => setForm({...form, highestEducation: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl px-6 py-4 text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all appearance-none cursor-pointer"
                    >
                      <option value="">Select Education...</option>
                      {EDUCATION_LEVELS.map(edu => <option key={edu} value={edu}>{edu}</option>)}
                    </select>
                  </div>
                </div>

                {/* Upload Degree Certificate */}
                {form.highestEducation && (
                  <div className="p-6 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-xs text-slate-800 dark:text-white">Credentials / Certificates Upload</h4>
                      <p className="text-[10px] text-slate-400">Upload degrees, diplomas, or recognized vendor certifications.</p>
                    </div>
                    <label className="px-5 py-2.5 bg-slate-950 dark:bg-slate-800 hover:bg-black text-white text-[10px] font-black uppercase tracking-wider rounded-xl cursor-pointer shadow-sm">
                      {certUploaded ? 'Change Document' : 'Upload File'}
                      <input 
                        type="file" 
                        accept=".pdf,image/*" 
                        className="hidden" 
                        onChange={(e) => {
                          if (e.target.files?.[0]) setCertUploaded(e.target.files[0].name);
                        }}
                      />
                    </label>
                  </div>
                )}

                {/* Motivation to teach */}
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-2">Why do you want to teach on Trileza? (Required)</label>
                  <textarea 
                    value={form.teachingMotivation}
                    onChange={e => setForm({...form, teachingMotivation: e.target.value})}
                    placeholder="Describe your passion for mentorship, your course architecture objectives, and what sets your curriculum apart..."
                    className="w-full h-24 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-[1.5rem] px-6 py-4 text-xs font-semibold outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none"
                  />
                </div>

                {/* Expertise Specialties Choose list */}
                <div className="space-y-4">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-2">Choose Subject Expertise Areas (Pick at least 1)</label>
                  <div className="flex flex-wrap gap-2.5">
                    {COURSE_CATEGORIES.map(skill => {
                      const selected = form.expertiseAreas.includes(skill);
                      return (
                        <button
                          key={skill}
                          type="button"
                          onClick={() => toggleExpertise(skill)}
                          className={cn(
                            "px-4 py-2 text-xs font-bold rounded-xl border-2 transition-all",
                            selected
                              ? "bg-emerald-600 text-white border-emerald-600 shadow-md"
                              : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-800 text-slate-500"
                          )}
                        >
                          {skill}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Navigation Buttons */}
                <div className="flex gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <Button variant="outline" onClick={() => handleBack('identity')} className="flex-1 h-16 rounded-2xl border-slate-200 dark:border-slate-800 font-bold">Back</Button>
                  <Button 
                    disabled={!form.highestEducation || !form.teachingMotivation || form.expertiseAreas.length === 0}
                    onClick={() => handleNext('training')} 
                    className="flex-[2] h-16 rounded-2xl bg-slate-950 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white font-black uppercase tracking-widest shadow-xl disabled:opacity-50"
                  >
                    Continue
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}

          {/* ── SECTION 4: PLATFORM ONBOARDING & TRAINING ── */}
          {step === 'training' && (
            <motion.div 
              key="training" custom={direction} variants={variants} initial="enter" animate="center" exit="exit"
              className="space-y-6"
            >
              <StepIndicator current={4} total={9} />
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-wider">Section 4</span>
                  <h2 className="text-3xl font-black text-slate-800 dark:text-white">Platform Onboarding & Training</h2>
                </div>
                <p className="text-slate-400 font-medium">Complete orientation tutorials and review copyright and commission structures.</p>
              </div>

              <Card className="p-8 md:p-10 bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl border-slate-200/50 dark:border-slate-800/50 rounded-[2.5rem] space-y-8">
                
                {/* Simulated Orientation/Course Creation tutorials */}
                <div className="space-y-4">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 ml-2">Mandatory Orientation Chapters</h4>
                  <div className="space-y-3">
                    
                    {/* Chapter 1 */}
                    <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                          <Play size={14} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200">1. Trileza Studio Visual & Sound Standards</p>
                          <p className="text-[10px] text-slate-400">Duration: 4 mins • Guidelines for microphone sync & 1080p outputs.</p>
                        </div>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => setOrientationModules({...orientationModules, videoStandards: !orientationModules.videoStandards})}
                        className={cn(
                          "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border-2 transition-all",
                          orientationModules.videoStandards
                            ? "bg-emerald-600 text-white border-emerald-600"
                            : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800"
                        )}
                      >
                        {orientationModules.videoStandards ? 'Watched' : 'Mark Watched'}
                      </button>
                    </div>

                    {/* Chapter 2 */}
                    <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                          <Play size={14} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200">2. Active Pedagogy & Grading Metrics</p>
                          <p className="text-[10px] text-slate-400">Duration: 6 mins • How to design high-engagement coding challenges.</p>
                        </div>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => setOrientationModules({...orientationModules, pedagogy: !orientationModules.pedagogy})}
                        className={cn(
                          "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border-2 transition-all",
                          orientationModules.pedagogy
                            ? "bg-emerald-600 text-white border-emerald-600"
                            : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800"
                        )}
                      >
                        {orientationModules.pedagogy ? 'Watched' : 'Mark Watched'}
                      </button>
                    </div>

                    {/* Chapter 3 */}
                    <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                          <Play size={14} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200">3. Copyright Laws & Plagiarism Audits</p>
                          <p className="text-[10px] text-slate-400">Duration: 3 mins • Reviewing strict original work regulations.</p>
                        </div>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => setOrientationModules({...orientationModules, copyright: !orientationModules.copyright})}
                        className={cn(
                          "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border-2 transition-all",
                          orientationModules.copyright
                            ? "bg-emerald-600 text-white border-emerald-600"
                            : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800"
                        )}
                      >
                        {orientationModules.copyright ? 'Watched' : 'Mark Watched'}
                      </button>
                    </div>

                  </div>
                </div>

                {/* Revenue Share Graphic model */}
                <div className="p-6 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-4">
                  <h4 className="font-bold text-xs text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <DollarSign size={14} className="text-emerald-500" /> Revenue Share Configuration
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    By submitting your credentials, you acknowledge the Trileza premium revenue share allocation:
                  </p>
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl">
                      <p className="text-xs text-slate-400 uppercase font-black tracking-wider">Instructor Share</p>
                      <h3 className="text-3xl font-black text-emerald-500">70%</h3>
                      <p className="text-[9px] text-slate-400 mt-1">Paid on all premium courses</p>
                    </div>
                    <div className="p-4 bg-slate-200/20 dark:bg-slate-800/40 border border-slate-300/30 rounded-2xl">
                      <p className="text-xs text-slate-400 uppercase font-black tracking-wider">Trileza Service fee</p>
                      <h3 className="text-3xl font-black text-slate-700 dark:text-slate-300">30%</h3>
                      <p className="text-[9px] text-slate-400 mt-1">Hosting, billing, server scale</p>
                    </div>
                  </div>
                </div>

                {/* Navigation Buttons */}
                <div className="flex gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <Button variant="outline" onClick={() => handleBack('qualifications')} className="flex-1 h-16 rounded-2xl border-slate-200 dark:border-slate-800 font-bold">Back</Button>
                  <Button 
                    disabled={!orientationModules.videoStandards || !orientationModules.pedagogy || !orientationModules.copyright}
                    onClick={() => handleNext('course_setup')} 
                    className="flex-[2] h-16 rounded-2xl bg-slate-950 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white font-black uppercase tracking-widest shadow-xl disabled:opacity-50"
                  >
                    Continue
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}

          {/* ── SECTION 5: COURSE CREATION PROCESS ── */}
          {step === 'course_setup' && (
            <motion.div 
              key="course_setup" custom={direction} variants={variants} initial="enter" animate="center" exit="exit"
              className="space-y-6"
            >
              <StepIndicator current={5} total={9} />
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-wider">Section 5</span>
                  <h2 className="text-3xl font-black text-slate-800 dark:text-white">Initial Course Setup</h2>
                </div>
                <p className="text-slate-400 font-medium">Initialize the core configuration and descriptive index tags for your initial course.</p>
              </div>

              <Card className="p-8 md:p-10 bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl border-slate-200/50 dark:border-slate-800/50 rounded-[2.5rem] space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Title */}
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-2">Course Title (Required)</label>
                    <input 
                      type="text" 
                      value={form.courseTitle}
                      onChange={e => setForm({...form, courseTitle: e.target.value})}
                      placeholder="e.g. Advanced Agentic Design Systems"
                      className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl px-6 py-4 text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    />
                  </div>

                  {/* Subtitle */}
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-2">Course Subtitle (Required)</label>
                    <input 
                      type="text" 
                      value={form.courseSubtitle}
                      onChange={e => setForm({...form, courseSubtitle: e.target.value})}
                      placeholder="e.g. Build robust reactive AI architectures"
                      className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl px-6 py-4 text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    />
                  </div>

                  {/* Category */}
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-2">Course Category</label>
                    <select 
                      value={form.courseCategory}
                      onChange={e => setForm({...form, courseCategory: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl px-6 py-4 text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all appearance-none cursor-pointer"
                    >
                      <option value="">Select Category...</option>
                      {COURSE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>

                  {/* Level */}
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-2">Course Difficulty Level</label>
                    <select 
                      value={form.courseLevel}
                      onChange={e => setForm({...form, courseLevel: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl px-6 py-4 text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all appearance-none cursor-pointer"
                    >
                      <option value="Beginner">Beginner</option>
                      <option value="Intermediate">Intermediate</option>
                      <option value="Advanced">Advanced</option>
                      <option value="All Levels">All Levels / General Path</option>
                    </select>
                  </div>

                  {/* Target Audience */}
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-2">Target Audience (Required)</label>
                    <input 
                      type="text" 
                      value={form.courseTarget}
                      onChange={e => setForm({...form, courseTarget: e.target.value})}
                      placeholder="e.g. Junior software developers seeking neural system architecture"
                      className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl px-6 py-4 text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    />
                  </div>

                  {/* Prerequisites */}
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-2">Prerequisites (Required)</label>
                    <input 
                      type="text" 
                      value={form.coursePrereqs}
                      onChange={e => setForm({...form, coursePrereqs: e.target.value})}
                      placeholder="e.g. Intermediate python, fundamental data flow concepts"
                      className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl px-6 py-4 text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    />
                  </div>
                </div>

                {/* Learning objectives (3 - 5 objectives) */}
                <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between ml-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Learning Objectives (Define 3-5)</label>
                    {objectives.length < 5 && (
                      <button 
                        type="button" 
                        onClick={() => setObjectives([...objectives, ''])}
                        className="text-xs text-emerald-600 font-black uppercase tracking-wider flex items-center gap-1 hover:text-emerald-700"
                      >
                        <Plus size={14} /> Add Objective
                      </button>
                    )}
                  </div>
                  <div className="space-y-3">
                    {objectives.map((obj, index) => (
                      <div key={index} className="flex gap-3">
                        <input 
                          type="text"
                          value={obj}
                          onChange={(e) => {
                            const newObjs = [...objectives];
                            newObjs[index] = e.target.value;
                            setObjectives(newObjs);
                          }}
                          placeholder={`Objective ${index + 1}: e.g. Design stateful micro-agents`}
                          className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl px-6 py-4 text-xs font-semibold outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
                        />
                        {objectives.length > 3 && (
                          <button 
                            type="button" 
                            onClick={() => setObjectives(objectives.filter((_, i) => i !== index))}
                            className="text-red-500 hover:text-red-700 transition-colors"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Long description */}
                <div className="space-y-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-2">Long-form Course Description (Required)</label>
                  <textarea 
                    value={form.courseDescription}
                    onChange={e => setForm({...form, courseDescription: e.target.value})}
                    placeholder="Enter an extensive comprehensive description detailing syllabus modules, project requirements, and output variables..."
                    className="w-full h-32 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-[1.5rem] px-6 py-4 text-xs font-semibold outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none"
                  />
                </div>

                {/* Promo video & Thumbnail uploads */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <div className="p-6 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl text-center space-y-3">
                    <div className="w-10 h-10 bg-white dark:bg-slate-800 shadow rounded-xl flex items-center justify-center mx-auto text-slate-400">
                      <Video size={18} />
                    </div>
                    <div>
                      <h5 className="font-bold text-xs text-slate-800 dark:text-white">Promotional Video</h5>
                      <p className="text-[9px] text-slate-400">Max 50MB, MP4/MOV format.</p>
                    </div>
                    <label className="inline-block px-4 py-2 bg-slate-950 dark:bg-slate-800 hover:bg-black text-white text-[9px] font-black uppercase tracking-wider rounded-xl cursor-pointer">
                      {promoVideoUploaded ? 'Change Video' : 'Select Video'}
                      <input 
                        type="file" 
                        accept="video/*" 
                        className="hidden" 
                        onChange={e => { if (e.target.files?.[0]) setPromoVideoUploaded(e.target.files[0].name); }}
                      />
                    </label>
                    {promoVideoUploaded && <p className="text-[10px] text-emerald-500 font-bold">{promoVideoUploaded}</p>}
                  </div>

                  <div className="p-6 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl text-center space-y-3">
                    <div className="w-10 h-10 bg-white dark:bg-slate-800 shadow rounded-xl flex items-center justify-center mx-auto text-slate-400">
                      <Camera size={18} />
                    </div>
                    <div>
                      <h5 className="font-bold text-xs text-slate-800 dark:text-white">Course Thumbnail</h5>
                      <p className="text-[9px] text-slate-400">1280x720px, max 5MB (PNG/JPG).</p>
                    </div>
                    <label className="inline-block px-4 py-2 bg-slate-950 dark:bg-slate-800 hover:bg-black text-white text-[9px] font-black uppercase tracking-wider rounded-xl cursor-pointer">
                      {thumbnailUploaded ? 'Change Image' : 'Select Image'}
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={e => { if (e.target.files?.[0]) setThumbnailUploaded(e.target.files[0].name); }}
                      />
                    </label>
                    {thumbnailUploaded && <p className="text-[10px] text-emerald-500 font-bold">{thumbnailUploaded}</p>}
                  </div>
                </div>

                {/* Deliverable Checkboxes */}
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <label className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={form.hasPracticeTests}
                      onChange={e => setForm({...form, hasPracticeTests: e.target.checked})}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wide">Practice Assignments</span>
                  </label>

                  <label className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={form.hasCodingEx}
                      onChange={e => setForm({...form, hasCodingEx: e.target.checked})}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wide">Coding Exercises</span>
                  </label>
                </div>

                {/* Navigation Buttons */}
                <div className="flex gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <Button variant="outline" onClick={() => handleBack('training')} className="flex-1 h-16 rounded-2xl border-slate-200 dark:border-slate-800 font-bold">Back</Button>
                  <Button 
                    disabled={
                      !form.courseTitle || 
                      !form.courseSubtitle || 
                      !form.courseCategory || 
                      !form.courseTarget || 
                      !form.coursePrereqs || 
                      !form.courseDescription ||
                      objectives.filter(Boolean).length < 3
                    }
                    onClick={() => handleNext('curriculum')} 
                    className="flex-[2] h-16 rounded-2xl bg-slate-950 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white font-black uppercase tracking-widest shadow-xl disabled:opacity-50"
                  >
                    Continue
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}

          {/* ── SECTION 6: CURRICULUM & CONTENT UPLOAD ── */}
          {step === 'curriculum' && (
            <motion.div 
              key="curriculum" custom={direction} variants={variants} initial="enter" animate="center" exit="exit"
              className="space-y-6"
            >
              <StepIndicator current={6} total={9} />
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-wider">Section 6</span>
                  <h2 className="text-3xl font-black text-slate-800 dark:text-white">Curriculum & Video Upload</h2>
                </div>
                <p className="text-slate-400 font-medium">Construct syllabus chapters and commit original authorship guarantees.</p>
              </div>

              <Card className="p-8 md:p-10 bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl border-slate-200/50 dark:border-slate-800/50 rounded-[2.5rem] space-y-6">
                
                {/* Visual drag & drop Curriculum builder mockup */}
                <div className="space-y-4">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 ml-2">Active Syllabus Grid</h4>
                  <div className="p-6 border-2 border-slate-200 dark:border-slate-800 rounded-3xl bg-slate-50/50 dark:bg-slate-900/50 space-y-4">
                    
                    {/* Section 1 */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider bg-slate-900 dark:bg-slate-800 text-white px-3 py-1 rounded-lg">Section 1: Initial Architecture</span>
                        <span className="text-[10px] text-slate-400 font-semibold">1 Lecture</span>
                      </div>
                      
                      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-between">
                        <div className="flex items-center gap-3 text-slate-800 dark:text-slate-200">
                          <Video size={16} className="text-emerald-500" />
                          <div>
                            <p className="text-xs font-bold">1.1 Project Structure Setup & InsForge Config</p>
                            <p className="text-[9px] text-slate-400">Video: setup_module.mp4 (Ready) • Manual Closed Captions attached</p>
                          </div>
                        </div>
                        <span className="text-[9px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded font-black uppercase">Verified</span>
                      </div>
                    </div>

                    {/* Drag-and-drop / Add Section buttons */}
                    <div className="flex gap-4">
                      <button type="button" className="flex-1 py-3 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 text-[10px] font-black uppercase tracking-wider text-slate-400 hover:text-emerald-500 rounded-2xl transition-all">
                        + Add Section Unit
                      </button>
                      <button type="button" className="flex-1 py-3 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 text-[10px] font-black uppercase tracking-wider text-slate-400 hover:text-emerald-500 rounded-2xl transition-all">
                        + Add Lecture Item
                      </button>
                    </div>

                  </div>
                </div>

                {/* Video resolutions limit card */}
                <div className="p-6 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-2">
                  <h4 className="font-bold text-xs text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <Info size={14} className="text-emerald-500" /> Lecture Media Requirements
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed font-medium">
                    All committed video uploads must comply with our strict encoding regulations: **MP4 format, 1080p minimum resolution, H.264 video codec, and max 2GB file size limit per lecture.**
                  </p>
                </div>

                {/* Original content declaration switch */}
                <label className="flex items-start gap-4 p-5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-3xl cursor-pointer hover:bg-slate-100/50 transition-all">
                  <input 
                    type="checkbox" 
                    checked={form.curriculumConfirmedOriginal}
                    onChange={e => setForm({...form, curriculumConfirmedOriginal: e.target.checked})}
                    className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 mt-1"
                  />
                  <div>
                    <h4 className="font-bold text-sm text-slate-800 dark:text-white">Copyright & Originality Attestation (Required)</h4>
                    <p className="text-xs text-slate-400 leading-relaxed mt-1">I guarantee that all course curricula, slide decks, coding units, and video streams represent my original work, or that I possess appropriate reprint/resale licensing credentials.</p>
                  </div>
                </label>

                {/* Navigation Buttons */}
                <div className="flex gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <Button variant="outline" onClick={() => handleBack('course_setup')} className="flex-1 h-16 rounded-2xl border-slate-200 dark:border-slate-800 font-bold">Back</Button>
                  <Button 
                    disabled={!form.curriculumConfirmedOriginal}
                    onClick={() => handleNext('pricing')} 
                    className="flex-[2] h-16 rounded-2xl bg-slate-950 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white font-black uppercase tracking-widest shadow-xl disabled:opacity-50"
                  >
                    Continue
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}

          {/* ── SECTION 7: PRICING & DISTRIBUTION ── */}
          {step === 'pricing' && (
            <motion.div 
              key="pricing" custom={direction} variants={variants} initial="enter" animate="center" exit="exit"
              className="space-y-6"
            >
              <StepIndicator current={7} total={9} />
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-wider">Section 7</span>
                  <h2 className="text-3xl font-black text-slate-800 dark:text-white">Pricing & Marketplace</h2>
                </div>
                <p className="text-slate-400 font-medium">Declare your price margins, generate coupons, and choose distribution networks.</p>
              </div>

              <Card className="p-8 md:p-10 bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl border-slate-200/50 dark:border-slate-800/50 rounded-[2.5rem] space-y-6">
                
                {/* Free vs Paid Toggle */}
                <div className="grid grid-cols-2 gap-4">
                  {['free', 'paid'].map(track => (
                    <button
                      key={track}
                      type="button"
                      onClick={() => setForm({...form, courseFreeTrack: track})}
                      className={cn(
                        "py-5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all border-2",
                        form.courseFreeTrack === track
                          ? "bg-slate-950 dark:bg-slate-800 text-white border-slate-950 dark:border-slate-800 shadow-lg"
                          : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-100"
                      )}
                    >
                      {track === 'free' ? 'Free Course Track' : 'Paid Course Track'}
                    </button>
                  ))}
                </div>

                {/* Paid courses: pricing tiers selector */}
                {form.courseFreeTrack === 'paid' && (
                  <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-2">Choose Course Price Tier</label>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      {PRICE_TIERS.filter(p => p.tier !== 'Free').map(p => (
                        <button
                          key={p.tier}
                          type="button"
                          onClick={() => setForm({...form, selectedPriceTier: p.tier})}
                          className={cn(
                            "py-4 rounded-xl border text-center transition-all flex flex-col justify-center items-center",
                            form.selectedPriceTier === p.tier
                              ? "bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400 font-bold"
                              : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300"
                          )}
                        >
                          <span className="text-[9px] uppercase tracking-wider opacity-75">{p.tier}</span>
                          <span className="text-sm font-black mt-0.5">{p.price}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Optional Coupon creation */}
                <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 ml-2">Configure Promotional Coupons (Optional)</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 ml-2">Coupon Code</label>
                      <div className="relative">
                        <Tag size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input 
                          type="text" 
                          value={form.couponCode}
                          onChange={e => setForm({...form, couponCode: e.target.value.toUpperCase()})}
                          placeholder="e.g. EARLYBIRD-AI"
                          className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl pl-12 pr-6 py-4 text-xs font-semibold outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 ml-2">Discount Percentage</label>
                      <select
                        value={form.couponDiscount}
                        onChange={e => setForm({...form, couponDiscount: e.target.value})}
                        className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl px-6 py-4 text-xs font-semibold outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all appearance-none cursor-pointer"
                      >
                        <option value="10">10% Off</option>
                        <option value="20">20% Off</option>
                        <option value="50">50% Off</option>
                        <option value="100">100% Free Access Link</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Distribution option (marketplace vs enterprise) */}
                <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-2">Target Course Distribution</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      { id: 'marketplace', title: 'Trileza Public Marketplace', desc: 'Available for global direct student subscriptions.' },
                      { id: 'enterprise-only', title: 'Trileza for Enterprise', desc: 'Restricted to corporate sub-organizations.' }
                    ].map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setForm({...form, distributionOption: opt.id})}
                        className={cn(
                          "p-5 rounded-2xl border-2 text-left transition-all flex flex-col justify-center",
                          form.distributionOption === opt.id
                            ? "bg-emerald-500/5 border-emerald-500 dark:border-emerald-400"
                            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                        )}
                      >
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">{opt.title}</span>
                        <span className="text-[9px] text-slate-400 mt-1 leading-normal">{opt.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Navigation Buttons */}
                <div className="flex gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <Button variant="outline" onClick={() => handleBack('curriculum')} className="flex-1 h-16 rounded-2xl border-slate-200 dark:border-slate-800 font-bold">Back</Button>
                  <Button 
                    onClick={() => handleNext('preferences')} 
                    className="flex-[2] h-16 rounded-2xl bg-slate-950 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white font-black uppercase tracking-widest shadow-xl"
                  >
                    Continue
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}

          {/* ── SECTION 8: COMMUNICATION & PREFERENCES ── */}
          {step === 'preferences' && (
            <motion.div 
              key="preferences" custom={direction} variants={variants} initial="enter" animate="center" exit="exit"
              className="space-y-6"
            >
              <StepIndicator current={8} total={9} />
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-wider">Section 8</span>
                  <h2 className="text-3xl font-black text-slate-800 dark:text-white">Communication Preferences</h2>
                </div>
                <p className="text-slate-400 font-medium">Control what reports and platform analytics digests are delivered to your email.</p>
              </div>

              <Card className="p-8 md:p-10 bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl border-slate-200/50 dark:border-slate-800/50 rounded-[2.5rem] space-y-6">
                
                {/* 1. Newsletter */}
                <label className="flex items-start gap-4 p-5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-3xl cursor-pointer hover:bg-slate-100/50 transition-all">
                  <input 
                    type="checkbox" 
                    checked={form.optInNewsletters}
                    onChange={e => setForm({...form, optInNewsletters: e.target.checked})}
                    className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 mt-1"
                  />
                  <div>
                    <h4 className="font-bold text-sm text-slate-800 dark:text-white">Tutor Newsletter & Tips</h4>
                    <p className="text-xs text-slate-400 leading-relaxed mt-1">Receive guidelines on platform changes, course marketing, and early feature access pools.</p>
                  </div>
                </label>

                {/* 2. Feedback summaries */}
                <label className="flex items-start gap-4 p-5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-3xl cursor-pointer hover:bg-slate-100/50 transition-all">
                  <input 
                    type="checkbox" 
                    checked={form.optInFeedback}
                    onChange={e => setForm({...form, optInFeedback: e.target.checked})}
                    className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 mt-1"
                  />
                  <div>
                    <h4 className="font-bold text-sm text-slate-800 dark:text-white">Student Feedback & Metrics Summaries</h4>
                    <p className="text-xs text-slate-400 leading-relaxed mt-1">Receive weekly summary indices regarding course star ratings, reviews, and coding exercise completion speeds.</p>
                  </div>
                </label>

                {/* 3. Platform promos */}
                <label className="flex items-start gap-4 p-5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-3xl cursor-pointer hover:bg-slate-100/50 transition-all">
                  <input 
                    type="checkbox" 
                    checked={form.optInPromotions}
                    onChange={e => setForm({...form, optInPromotions: e.target.checked})}
                    className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 mt-1"
                  />
                  <div>
                    <h4 className="font-bold text-sm text-slate-800 dark:text-white">Platform Deals & Seasonal Promotions</h4>
                    <p className="text-xs text-slate-400 leading-relaxed mt-1">Incorporate my course in seasonal discounts, black friday sales, and academy bundles.</p>
                  </div>
                </label>

                {/* Navigation Buttons */}
                <div className="flex gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <Button variant="outline" onClick={() => handleBack('pricing')} className="flex-1 h-16 rounded-2xl border-slate-200 dark:border-slate-800 font-bold">Back</Button>
                  <Button 
                    onClick={() => handleNext('review')} 
                    className="flex-[2] h-16 rounded-2xl bg-slate-950 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white font-black uppercase tracking-widest shadow-xl"
                  >
                    Continue
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}

          {/* ── SECTION 9: SUBMISSION & AUDIT REVIEW ── */}
          {step === 'review' && (
            <motion.div 
              key="review" custom={direction} variants={variants} initial="enter" animate="center" exit="exit"
              className="space-y-6"
            >
              <StepIndicator current={9} total={9} />
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-wider">Section 9</span>
                  <h2 className="text-3xl font-black text-slate-800 dark:text-white">Submission & Audit Review</h2>
                </div>
                <p className="text-slate-400 font-medium">Perform a quality check assurance scan and launch your instructor request.</p>
              </div>

              <Card className="p-8 md:p-10 bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl border-slate-200/50 dark:border-slate-800/50 rounded-[2.5rem] space-y-6">
                
                {/* Course parameters visual recap */}
                <div className="flex items-center gap-6 pb-6 border-b border-slate-100 dark:border-slate-800">
                  <div className="w-14 h-14 bg-gradient-to-br from-emerald-600 to-emerald-400 rounded-xl flex items-center justify-center text-white font-black text-lg flex-shrink-0 shadow-lg">
                    {form.courseTitle ? form.courseTitle[0] : 'C'}
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white">{form.courseTitle || 'Debut Course Title'}</h3>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">{form.courseCategory} • Level: {form.courseLevel}</p>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold mt-1">
                      <Users2 size={12} /> Instructor: <span className="text-emerald-600 dark:text-emerald-400 font-black">{form.publicName}</span>
                    </div>
                  </div>
                </div>

                {/* Timeline info block */}
                <div className="p-6 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-2">
                  <h4 className="font-bold text-xs text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <Clock size={14} className="text-emerald-500" /> Expected Review Timeline
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                    Upon submission, your onboarding parameters and initial course blueprint are sent to the Trileza Quality Review Team. **The verification process takes between 3 to 10 business days.** If changes are required, you will receive a diagnostic checklist directly in your inbox.
                  </p>
                </div>

                {/* Quality checkboxes */}
                <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <label className="flex items-start gap-4 p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl cursor-pointer hover:bg-slate-100/50 transition-all">
                    <input 
                      type="checkbox" 
                      checked={form.meetsQualityCheck}
                      onChange={e => setForm({...form, meetsQualityCheck: e.target.checked})}
                      className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 mt-0.5"
                    />
                    <div>
                      <h4 className="font-bold text-xs text-slate-800 dark:text-white">I confirm my course meets quality standards</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">I verify that the visual stream resolution, microphone synchronization, and pedagogy parameters match Trileza orientation guidelines.</p>
                    </div>
                  </label>

                  <label className="flex items-start gap-4 p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl cursor-pointer hover:bg-slate-100/50 transition-all">
                    <input 
                      type="checkbox" 
                      checked={form.hasFullRightsCheck}
                      onChange={e => setForm({...form, hasFullRightsCheck: e.target.checked})}
                      className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 mt-0.5"
                    />
                    <div>
                      <h4 className="font-bold text-xs text-slate-800 dark:text-white">I confirm I have the rights to all content</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">I guarantee that no part of the slides, code segments, or video tracks violates active trademark or intellectual property laws.</p>
                    </div>
                  </label>
                </div>

                {/* Final Buttons */}
                <div className="flex gap-4 pt-4">
                  <Button variant="outline" onClick={() => handleBack('preferences')} className="flex-1 h-16 rounded-2xl border-slate-200 dark:border-slate-800 font-bold">Edit</Button>
                  <Button 
                    disabled={!form.meetsQualityCheck || !form.hasFullRightsCheck}
                    onClick={handleFinish} 
                    className="flex-[2] h-16 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest shadow-xl shadow-emerald-500/20 group"
                  >
                    Submit for Review
                    <Sparkles className="ml-2 group-hover:scale-110 transition-transform" size={14} />
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}

          {/* ── FINALIZING ── */}
          {step === 'finalizing' && (
            <div className="text-center space-y-12 py-20 min-h-[400px] flex flex-col items-center justify-center">
              <div className="relative w-40 h-40">
                <div className="absolute inset-0 rounded-full border-4 border-emerald-500/10 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-20 h-20 bg-slate-900 dark:bg-emerald-600 rounded-full flex items-center justify-center shadow-2xl">
                    <Award className="text-white animate-pulse" size={36} />
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <h2 className="text-3xl font-black text-slate-800 dark:text-white">Submitting Onboarding Bundle</h2>
                <p className="text-lg text-slate-400 font-medium animate-pulse">Establishing provisional credentials in InsForge cluster...</p>
              </div>
            </div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
};

export default TutorOnboarding;
