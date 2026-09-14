import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  GraduationCap, 
  Award, 
  Shield, 
  BookOpen, 
  Sparkles, 
  HelpCircle, 
  CheckCircle2, 
  ChevronRight, 
  Camera,
  Info,
  AlertCircle,
  UploadCloud,
  Link2
} from 'lucide-react';
import { Card, Button } from '../../components/ui';
import { PageHeader } from '../../components/shared';
import { cn } from '../../utils';
import { useAuthStore } from '../../store/authStore';
import { motion, AnimatePresence } from 'framer-motion';

type OnboardingStep = 
  | 'welcome' 
  | 'account' 
  | 'profile' 
  | 'background' 
  | 'certificate' 
  | 'privacy' 
  | 'review' 
  | 'finalizing';

const COUNTRY_OPTIONS = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua & Barbuda", "Argentina", "Armenia", "Australia", "Austria",
  "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan",
  "Bolivia", "Bosnia & Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi", "Cabo Verde", "Cambodia",
  "Cameroon", "Canada", "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros", "Congo (Congo-Brazzaville)", "Costa Rica",
  "Croatia", "Cuba", "Cyprus", "Czechia (Czech Republic)", "Denmark", "Djibouti", "Dominica", "Dominican Republic", "Ecuador", "Egypt",
  "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia", "Fiji", "Finland", "France", "Gabon",
  "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana",
  "Haiti", "Honduras", "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel",
  "Italy", "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Kuwait", "Kyrgyzstan", "Laos",
  "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg", "Madagascar", "Malawi",
  "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova",
  "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar (formerly Burma)", "Namibia", "Nauru", "Nepal", "Netherlands",
  "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea", "North Macedonia", "Norway", "Oman", "Pakistan", "Palau",
  "Palestine State", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal", "Qatar", "Romania",
  "Russia", "Rwanda", "Saint Kitts & Nevis", "Saint Lucia", "Saint Vincent & the Grenadines", "Samoa", "San Marino", "Sao Tome & Principe", "Saudi Arabia", "Senegal",
  "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Korea",
  "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria", "Tajikistan", "Tanzania",
  "Thailand", "Timor-Leste", "Togo", "Tonga", "Trinidad & Tobago", "Tunisia", "Turkey", "Turkmenistan", "Tuvalu", "Uganda",
  "Ukraine", "United Arab Emirates", "United Kingdom", "United States", "Uruguay", "Uzbekistan", "Vanuatu", "Venezuela", "Vietnam", "Yemen",
  "Zambia", "Zimbabwe"
];

const TIMEZONES = [
  { name: 'GMT/UTC+1 (West Africa Time)', value: 'Africa/Lagos' },
  { name: 'GMT/UTC-5 (Eastern Standard Time)', value: 'America/New_York' },
  { name: 'GMT/UTC+0 (London/Greenwich)', value: 'Europe/London' },
  { name: 'GMT/UTC-8 (Pacific Standard Time)', value: 'America/Los_Angeles' },
  { name: 'GMT/UTC+5:30 (Indian Standard Time)', value: 'Asia/Kolkata' },
  { name: 'GMT/UTC+2 (South African Standard Time)', value: 'Africa/Johannesburg' }
];

const LANGUAGES = ['English', 'French', 'Spanish', 'German', 'Yoruba', 'Igbo', 'Hausa', 'Arabic'];

const EDUCATION_LEVELS = [
  'High School or Equivalent',
  'Associate/Diploma',
  'Bachelor\'s Degree',
  'Master\'s Degree',
  'Doctorate (Ph.D. / Ed.D.)',
  'Professional Certification',
  'Self-Taught Genius'
];

const EMPLOYMENT_STATUSES = [
  'Full-time Employed',
  'Part-time Employed',
  'Self-employed / Freelancer',
  'Student (Full-time / Part-time)',
  'Currently Unemployed',
  'Retired'
];

const INDUSTRIES = [
  'Technology & Software',
  'Architecture & Building Design',
  'Sustainability & Green Tech',
  'Design, UX & Creative Arts',
  'Finance & Venture Capital',
  'Healthcare & Life Sciences',
  'Education & Academics',
  'Engineering & Construction'
];

const STANDARDIZED_CAREERS = [
  "Software Engineer",
  "UI/UX Designer",
  "Product Manager",
  "Data Scientist",
  "DevOps Engineer",
  "Prompt Engineer",
  "AI Systems Architect",
  "Full-Stack Developer",
  "Frontend Architect",
  "Backend Developer",
  "Digital Marketer",
  "SEO Specialist",
  "Content Strategist",
  "Systems Administrator",
  "Cybersecurity Analyst",
  "Data Analyst",
  "Blockchain Developer",
  "Growth Hacker",
  "Cloud Solutions Architect"
];

const FREE_COURSES = [
  { id: 'aac-101', title: 'Advanced Agentic Coding', level: 'Intermediate', duration: '4 weeks', desc: 'Master agentic AI systems design using micro-agents and high-fidelity routing.' },
  { id: 'ais-202', title: 'AI Systems Architecture', level: 'Advanced', duration: '6 weeks', desc: 'Design scalable neural grid systems and secure backend vector databases.' },
  { id: 'hfd-303', title: 'High-Fidelity UI Design', level: 'Beginner', duration: '3 weeks', desc: 'Craft high-end premium web experiences with custom micro-animations and typography.' },
  { id: 'py-051', title: 'Introduction to Python & Automation', level: 'Beginner', duration: '2 weeks', desc: 'Learn core scripting, automation hooks, and local integration management.' }
];

const MenteeOnboarding = () => {
  const navigate = useNavigate();
  const { user, updateProfile, logout } = useAuthStore();
  
  // Check for pre-selected course from query params (e.g. from Mentor-to-Mentee enrollment intercept)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const courseId = params.get('courseId');
    if (courseId) {
      setForm(prev => ({ ...prev, selectedCourseId: courseId }));
    }
  }, []);
  
  const isFastTrack = user?.metadata?.mentor_onboarded === true;
  
  // Step Management
  const [step, setStep] = useState<OnboardingStep>('welcome');
  const [direction, setDirection] = useState(1);
  const [showDoBTooltip, setShowDoBTooltip] = useState(false);
  const [socialConnected, setSocialConnected] = useState<string | null>(null);
  
  // Digital Careers Autocomplete States
  const [careerSearch, setCareerSearch] = useState('');
  const [showCareerSuggestions, setShowCareerSuggestions] = useState(false);
  
  // Custom Date of Birth Selector States
  const [dobDay, setDobDay] = useState('');
  const [dobMonth, setDobMonth] = useState('');
  const [dobYear, setDobYear] = useState('');

  // CV / LinkedIn States
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [cvFileName, setCvFileName] = useState<string | null>(null);
  const [idFileUploaded, setIdFileUploaded] = useState<string | null>(null);
  const [linkedinError, setLinkedinError] = useState(false);

  // State for forms
  const [form, setForm] = useState({
    wantsTwoFactor: false,
    
    // Section 2: Personal Profile
    displayName: '',
    dob: '',
    country: 'Nigeria',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Lagos',
    language: 'English',
    avatarUrl: user?.avatar_url || '',
    
    // Section 3: Learning Background
    education: '',
    employment: '',
    jobTitle: '',
    industry: '',
    yearsExp: '0-2',
    learningReason: '',
    priorKnowledge: 'Beginner',
    
    // Section 4: Course Selection
    selectedCourseId: '',
    selectedTrack: 'audit',
    wantsFinancialAid: false,
    
    // Section 4b: Financial Aid sub-form
    aidIncome: '',
    aidEmploymentStatus: '',
    aidReasonWhy: '',
    aidReasonHow: '',
    
    // Section 5: Certificate legal name
    legalCertificateName: '',
    
    // Section 6: Communication & Privacy
    optInPromotions: true,
    optInReminders: true,
    optInShareData: false,
    optInSurveys: false,
    
    // Section 7: Final Steps
    agreeToTerms: false,
    confirmAge: false
  });

  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [emailVerified, setEmailVerified] = useState(false);
  const [isVerifyingEmail, setIsVerifyingEmail] = useState(false);

  // Combine custom Day/Month/Year dropdowns into the form's dob string
  useEffect(() => {
    if (dobDay && dobMonth && dobYear) {
      setForm(prev => ({
        ...prev,
        dob: `${dobYear}-${dobMonth}-${dobDay}`
      }));
    }
  }, [dobDay, dobMonth, dobYear]);

  // Sync default display name, legal name, and avatar when user profile is loaded
  useEffect(() => {
    if (user) {
      const userAvatar = user.avatar_url || (user.metadata as any)?.avatar_url || '';
      setForm(prev => ({
        ...prev,
        displayName: prev.displayName || user.full_name?.split(' ')[0] || user.full_name || '',
        legalCertificateName: prev.legalCertificateName || user.full_name || '',
        avatarUrl: prev.avatarUrl || userAvatar
      }));
    }
  }, [user]);

  // Fast-track pre-population for Mentors becoming Mentees
  useEffect(() => {
    if (isFastTrack && user?.metadata?.mentor_data) {
      const mentorData = user.metadata.mentor_data;
      setForm(prev => ({
        ...prev,
        yearsExp: mentorData.qualifications?.years_exp || prev.yearsExp,
        education: mentorData.qualifications?.education || prev.education,
        legalCertificateName: mentorData.identity?.legal_name || user.full_name,
        displayName: mentorData.identity?.public_name || user.full_name.split(' ')[0] || prev.displayName,
        country: mentorData.identity?.address?.country || prev.country
      }));
      // Auto-set shared contact details
      if (mentorData.identity?.socials?.linkedin) {
        setLinkedinUrl(mentorData.identity.socials.linkedin);
      }
    }
  }, [isFastTrack, user]);

  // Career tag input helpers
  const selectedCareers = form.industry ? form.industry.split(', ') : [];
  const filteredCareers = STANDARDIZED_CAREERS.filter(c => 
    c.toLowerCase().includes(careerSearch.toLowerCase()) && 
    !selectedCareers.includes(c)
  );

  const addCareer = (careerName: string) => {
    const trimmed = careerName.trim();
    if (!trimmed) return;
    const currentList = form.industry ? form.industry.split(', ') : [];
    if (!currentList.includes(trimmed)) {
      const newList = [...currentList, trimmed];
      setForm(prev => ({ ...prev, industry: newList.join(', ') }));
    }
    setCareerSearch('');
    setShowCareerSuggestions(false);
  };

  const removeCareer = (careerName: string) => {
    const currentList = form.industry ? form.industry.split(', ') : [];
    const newList = currentList.filter(c => c !== careerName);
    setForm(prev => ({ ...prev, industry: newList.join(', ') }));
  };

  const handleCareerKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (careerSearch.trim()) {
        addCareer(careerSearch.trim());
      }
    } else if (e.key === ',') {
      e.preventDefault();
      if (careerSearch.trim()) {
        addCareer(careerSearch.trim());
      }
    }
  };

  // Real-time LinkedIn Validation
  const handleLinkedinChange = (val: string) => {
    setLinkedinUrl(val);
    if (!val) {
      setLinkedinError(false);
      return;
    }
    const linkedinRegex = /^https:\/\/(www\.)?linkedin\.com\/in\/[A-Za-z0-9_-]+\/?$/;
    setLinkedinError(!linkedinRegex.test(val));
  };

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
      const selectedCourse = FREE_COURSES.find(c => c.id === form.selectedCourseId);
      
      const result = await updateProfile({
        metadata: {
          ...user?.metadata,
          mentee_onboarded: true,
          active_role: 'mentee',
          onboarded_at: new Date().toISOString(),
          onboarding_data: {
            account: {
              social_provider: socialConnected,
              two_factor_enabled: form.wantsTwoFactor
            },
            profile: {
              display_name: form.displayName,
              dob: form.dob,
              country: form.country,
              timezone: form.timezone,
              language: form.language,
              linkedin: linkedinUrl,
              cv_uploaded: cvFileName
            },
            learning_background: {
              education_level: form.education,
              employment_status: form.employment,
              job_title: form.jobTitle,
              industry: form.industry,
              years_exp: form.yearsExp,
              learning_reason: form.learningReason,
              prior_knowledge_level: form.priorKnowledge
            },
            course_selection: {
              course_id: form.selectedCourseId,
              course_title: selectedCourse?.title || '',
              track: form.selectedTrack,
              financial_aid: form.wantsFinancialAid ? {
                annual_income: form.aidIncome,
                employment_status: form.aidEmploymentStatus,
                why_applied: form.aidReasonWhy,
                how_will_help: form.aidReasonHow
              } : null
            },
            certificate: {
              legal_name: form.legalCertificateName
            },
            privacy: {
              opt_in_promotions: form.optInPromotions,
              opt_in_reminders: form.optInReminders,
              opt_in_share_data: form.optInShareData,
              opt_in_surveys: form.optInSurveys
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

  const variants = {
    enter: (dir: number) => ({
      scale: 0.96,
      y: 15,
      opacity: 0
    }),
    center: {
      scale: 1,
      y: 0,
      opacity: 1,
      transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] }
    },
    exit: (dir: number) => ({
      scale: 0.96,
      y: -15,
      opacity: 0,
      transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] }
    })
  };

  const StepIndicator = ({ current, total }: { current: number, total: number }) => (
    <div className="flex gap-2 mb-8 justify-center">
      {Array.from({ length: total }).map((_, i) => (
        <div 
          key={i} 
          className={cn(
            "h-2 rounded-full transition-all duration-500",
            i < current ? "w-8 bg-emerald-500 shadow-[0_0_8px_rgba(46, 125, 50,0.4)]" : i === current ? "w-12 bg-emerald-600 animate-pulse shadow-[0_0_12px_rgba(5,150,105,0.6)]" : "w-3 bg-slate-200 dark:bg-slate-800"
          )} 
          title={`Step ${i + 1}`}
        />
      ))}
    </div>
  );

  const handleExitToPortal = async () => {
    try {
      if (user) {
        await updateProfile({
          metadata: {
            ...user.metadata,
            mentee_onboarded: true
          }
        });
      }
    } catch (e) {
      console.warn('Exit to portal notice:', e);
    }
    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex justify-center items-start p-4 relative py-12 md:py-24 overflow-y-auto font-sans selection:bg-emerald-500/20">


      {/* Premium Dynamic Neon Backdrops */}
      <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] bg-gradient-to-tr from-emerald-500/15 to-teal-500/10 rounded-full blur-[130px] pointer-events-none animate-pulse duration-[8000ms]" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[60%] h-[60%] bg-gradient-to-tr from-indigo-500/15 to-purple-500/10 rounded-full blur-[130px] pointer-events-none animate-pulse duration-[10000ms]" />

      <div className="max-w-5xl w-full relative z-10 mx-auto">
        {/* Trileza App Logo Header */}
        <div className="flex items-center justify-between pb-8 mb-8 border-b border-slate-200/60 dark:border-slate-800/60">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center p-2 shadow-sm">
              <img src="/icon-192.png" alt="Trileza Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <div className="text-base font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                Trileza
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                  Academy Path
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Personalize your learning & academy journey</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleExitToPortal}
            className="text-xs font-bold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white px-3.5 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors cursor-pointer"
          >
            Exit to Portal
          </button>
        </div>

        <AnimatePresence custom={direction} mode="wait">
          
          {/* ── WELCOME STEP ── */}
          {step === 'welcome' && (
            <motion.div 
              key="welcome" custom={direction} variants={variants} initial="enter" animate="center" exit="exit"
              className="text-center space-y-12"
            >
              <div className="space-y-6">
                <h1 className="text-4xl md:text-6xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">
                  {isFastTrack ? (
                    <>Fast-Track to Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-400">Academy Path</span></>
                  ) : (
                    <>Welcome to Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-400">Academy Path</span>.</>
                  )}
                </h1>
                <p className="text-lg md:text-xl text-slate-500 dark:text-slate-400 font-medium max-w-xl mx-auto leading-relaxed">
                  {isFastTrack 
                    ? "As an approved Trileza Mentor, your account is already fully verified! We've skipped the profile setup—just answer a few quick questions about your learning goals to unlock your Mentee Dashboard."
                    : "Let's personalize your learning dashboard. In just a few steps, you'll secure your account, customize your learning tracks, and launch your first course."
                  }
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-2xl mx-auto">
                <div className="p-8 bg-white/60 dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200/50 dark:border-slate-800 rounded-[2rem] text-center space-y-4 hover:border-emerald-500/30 transition-all hover:scale-[1.02]">
                  <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mx-auto">
                    <BookOpen size={24} />
                  </div>
                  <h3 className="font-extrabold text-slate-800 dark:text-white text-base">Flexible Audits</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal">Access comprehensive lectures completely free of charge.</p>
                </div>
                <div className="p-8 bg-white/60 dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200/50 dark:border-slate-800 rounded-[2rem] text-center space-y-4 hover:border-emerald-500/30 transition-all hover:scale-[1.02]">
                  <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mx-auto">
                    <Award size={24} />
                  </div>
                  <h3 className="font-extrabold text-slate-800 dark:text-white text-base">Verified Credentials</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal">Unlock industry-grade certificates when you finish.</p>
                </div>
                <div className="p-8 bg-white/60 dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200/50 dark:border-slate-800 rounded-[2rem] text-center space-y-4 hover:border-emerald-500/30 transition-all hover:scale-[1.02]">
                  <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mx-auto">
                    <Shield size={24} />
                  </div>
                  <h3 className="font-extrabold text-slate-800 dark:text-white text-base">Secured Profile</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal">Control your privacy and share options with total clarity.</p>
                </div>
              </div>

              <Button 
                onClick={() => handleNext(isFastTrack ? 'background' : 'account')}
                className="h-16 px-16 bg-slate-900 hover:bg-black dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-[0.2em] rounded-[1.5rem] shadow-2xl hover:shadow-emerald-500/10 group transition-all"
              >
                Let's Get Started
                <ChevronRight className="ml-2 group-hover:translate-x-1.5 transition-transform" size={16} />
              </Button>
            </motion.div>
          )}

          {/* ── SECTION 1: ACCOUNT SECURITY ── */}
          {step === 'account' && (
            <motion.div 
              key="account" custom={direction} variants={variants} initial="enter" animate="center" exit="exit"
              className="space-y-6"
            >
              <PageHeader 
                title="Account Security"
                description="Verify credentials and configure social single-sign-on overlays."
                tag="SECTION 1"
                icon={Shield}
                className="!mb-4"
              />
              <StepIndicator current={1} total={6} />

              <Card className="p-8 md:p-12 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-[2.5rem] shadow-xl space-y-10">
                {/* Email and Optional Fields */}
                <div className="grid grid-cols-1 gap-6">
                  <div className="space-y-2">
                    <label className="flex items-center gap-4 p-6 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-800 rounded-3xl cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-900/80 transition-all">
                      <input 
                        type="checkbox" 
                        checked={form.wantsTwoFactor}
                        onChange={e => setForm({...form, wantsTwoFactor: e.target.checked})}
                        className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <div>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200 animate-pulse">Enable Two-Factor MFA Security Overlay</p>
                        <p className="text-xs text-slate-400 mt-0.5">Protect your student learning credentials on each session handshake.</p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Navigation Buttons */}
                <div className="flex gap-4 pt-6 border-t border-slate-100 dark:border-slate-800">
                  <Button variant="outline" onClick={() => handleBack('welcome')} className="flex-1 h-16 rounded-2xl border-slate-200 dark:border-slate-800 font-bold">Back</Button>
                  <Button 
                    onClick={() => handleNext('profile')} 
                    className="flex-[2] h-16 rounded-2xl bg-slate-950 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white font-black uppercase tracking-widest shadow-xl"
                  >
                    Continue to Profile
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}

          {/* ── SECTION 2: PERSONAL PROFILE & OPTIONAL CV/LINKEDIN ── */}
          {step === 'profile' && (
            <motion.div 
              key="profile" custom={direction} variants={variants} initial="enter" animate="center" exit="exit"
              className="space-y-6"
            >
              <PageHeader 
                title="Personal Profile"
                description="Establish your personal identifiers, custom birth selectors, and optional professional credentials."
                tag="SECTION 2"
                icon={Shield}
                className="!mb-4"
              />
              <StepIndicator current={2} total={6} />

              <Card className="p-8 md:p-12 bg-white/95 dark:bg-slate-950/90 backdrop-blur-2xl border-2 border-emerald-500/25 shadow-[0_20px_50px_rgba(46, 125, 50,0.15)] rounded-[3rem] space-y-8 ring-1 ring-black/[0.03]">
                {/* Upload or Generated Avatar */}
                <div className="flex flex-col sm:flex-row items-center gap-6 p-6 bg-slate-50 dark:bg-slate-900/50 border border-slate-350 dark:border-slate-850 rounded-3xl shadow-inner">
                  <div className="relative group">
                    <img 
                      src={form.avatarUrl || user?.avatar_url || (user?.metadata as any)?.avatar_url || (user?.metadata as any)?.pending_mentor_data?.identity?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${form.displayName || user?.full_name || 'seed'}`}
                      alt="Profile Avatar"
                      className="w-24 h-24 rounded-full bg-slate-200 dark:bg-slate-800 border-2 border-emerald-500 p-0.5 object-cover shadow-lg"
                    />
                    <label className="absolute bottom-0 right-0 p-2 rounded-full bg-emerald-600 text-white shadow-lg cursor-pointer hover:bg-emerald-700 transition-colors">
                      <Camera size={14} />
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setForm({...form, avatarUrl: reader.result as string});
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                  </div>
                  <div className="space-y-1 text-center sm:text-left">
                    <h4 className="font-black text-slate-900 dark:text-white text-base">Profile Photo (Optional)</h4>
                    <p className="text-xs text-slate-700 dark:text-slate-300 font-extrabold">Upload a professional headshot. Default is system-generated.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Full Name */}
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-slate-100 ml-2">Full Legal Name</label>
                    <input 
                      type="text"
                      value={user?.full_name || ''}
                      disabled
                      className="w-full h-16 bg-slate-100 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-850 rounded-2xl px-6 text-sm font-extrabold text-slate-500 dark:text-slate-400 outline-none cursor-not-allowed shadow-inner"
                    />
                  </div>

                  {/* Display Name */}
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-slate-100 ml-2">Display Name (Required)</label>
                    <input 
                      type="text"
                      value={form.displayName}
                      onChange={e => setForm({...form, displayName: e.target.value})}
                      placeholder="e.g. David"
                      required
                      className="w-full h-16 bg-slate-50 dark:bg-slate-900/50 border border-slate-350 dark:border-slate-800 rounded-2xl px-6 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-inner"
                    />
                  </div>

                  {/* CUSTOM PREMIUM DATE OF BIRTH DROPDOWNS (No native outdated date picker) */}
                  <div className="space-y-2 md:col-span-2 relative">
                    <div className="flex items-center justify-between ml-2">
                      <label className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-slate-100">Date of Birth (Required)</label>
                      <button 
                        type="button" 
                        onMouseEnter={() => setShowDoBTooltip(true)}
                        onMouseLeave={() => setShowDoBTooltip(false)}
                        onClick={() => setShowDoBTooltip(!showDoBTooltip)}
                        className="text-emerald-600 hover:text-emerald-500 transition-colors"
                      >
                        <HelpCircle size={14} />
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      {/* Month */}
                      <select
                        value={dobMonth}
                        onChange={e => setDobMonth(e.target.value)}
                        className="bg-slate-50 dark:bg-slate-900/50 border border-slate-350 dark:border-slate-800 rounded-2xl px-5 h-16 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all appearance-none cursor-pointer shadow-inner"
                      >
                        <option value="">Month</option>
                        {["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"].map(m => (
                          <option key={m} value={m}>{new Date(2000, parseInt(m) - 1).toLocaleString('default', { month: 'long' })}</option>
                        ))}
                      </select>

                      {/* Day */}
                      <select
                        value={dobDay}
                        onChange={e => setDobDay(e.target.value)}
                        className="bg-slate-50 dark:bg-slate-900/50 border border-slate-350 dark:border-slate-800 rounded-2xl px-5 h-16 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all appearance-none cursor-pointer shadow-inner"
                      >
                        <option value="">Day</option>
                        {Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0')).map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>

                      {/* Year */}
                      <select
                        value={dobYear}
                        onChange={e => setDobYear(e.target.value)}
                        className="bg-slate-50 dark:bg-slate-900/50 border border-slate-350 dark:border-slate-800 rounded-2xl px-5 h-16 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all appearance-none cursor-pointer shadow-inner"
                      >
                        <option value="">Year</option>
                        {Array.from({ length: 80 }, (_, i) => String(2022 - i)).map(y => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>

                    {/* Explanatory Tooltip Popover */}
                    <AnimatePresence>
                      {showDoBTooltip && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          className="absolute bottom-full left-0 right-0 mb-3 p-5 bg-slate-900 text-white text-xs rounded-2xl shadow-2xl z-20 border border-slate-800 leading-relaxed font-extrabold"
                        >
                          <p className="font-extrabold mb-1 flex items-center gap-1.5"><Sparkles size={14} className="text-emerald-400 animate-pulse" /> Why do we require your birth parameters?</p>
                          <p className="opacity-90">We audit ages to satisfy global COPPA academic data protection requirements and appropriately configure your localized study groups.</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Country Selection */}
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-slate-100 ml-2">Country / Region</label>
                    <select 
                      value={form.country}
                      onChange={e => setForm({...form, country: e.target.value})}
                      className="w-full h-16 bg-slate-50 dark:bg-slate-900/50 border border-slate-350 dark:border-slate-800 rounded-2xl px-6 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all appearance-none cursor-pointer shadow-inner"
                    >
                      {COUNTRY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  {/* Time Zone Selector */}
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-slate-100 ml-2">Preferred Time Zone</label>
                    <select 
                      value={form.timezone}
                      onChange={e => setForm({...form, timezone: e.target.value})}
                      className="w-full h-16 bg-slate-50 dark:bg-slate-900/50 border border-slate-350 dark:border-slate-800 rounded-2xl px-6 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all appearance-none cursor-pointer shadow-inner"
                    >
                      {TIMEZONES.map(t => <option key={t.value} value={t.value}>{t.name}</option>)}
                    </select>
                  </div>

                  {/* Language Selector */}
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-slate-100 ml-2">Preferred Language</label>
                    <select 
                      value={form.language}
                      onChange={e => setForm({...form, language: e.target.value})}
                      className="w-full h-16 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl px-6 text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all appearance-none cursor-pointer"
                    >
                      {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                </div>

                {/* OPTIONAL PROFESSIONAL LINKS: CV OR LINKEDIN LINK WITH REAL LINKEDIN VALIDATION */}
                <div className="space-y-6 pt-6 border-t border-slate-200 dark:border-slate-800">
                  <div className="space-y-1 ml-2">
                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-slate-100">Professional Credentials (Optional)</h4>
                    <p className="text-[11px] text-slate-700 dark:text-slate-300 font-extrabold">Attach an active LinkedIn URL or upload a CV document to complete fast-track verification.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {/* LinkedIn Link (Real Verification check) */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-900 dark:text-slate-100 ml-2">LinkedIn Profile Link</label>
                      <div className="relative">
                        <Link2 size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500 font-black" />
                        <input 
                          type="url" 
                          value={linkedinUrl}
                          onChange={e => handleLinkedinChange(e.target.value)}
                          placeholder="https://linkedin.com/in/username"
                          className={cn(
                            "w-full h-16 bg-slate-50 dark:bg-slate-900/50 border rounded-2xl pl-12 pr-6 text-xs font-bold text-slate-900 dark:text-white outline-none transition-all shadow-inner",
                            linkedinError 
                              ? "border-amber-500 focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 text-amber-600 font-bold"
                              : "border-slate-350 dark:border-slate-800 focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500"
                          )}
                        />
                      </div>
                      {linkedinError && (
                        <p className="text-[10px] text-amber-650 dark:text-amber-400 font-black ml-2 flex items-center gap-1 animate-pulse">
                          <AlertCircle size={12} /> Must be a valid LinkedIn link (e.g. https://linkedin.com/in/user)
                        </p>
                      )}
                    </div>

                    {/* CV file upload */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-900 dark:text-slate-100 ml-2">CV / Resume File</label>
                      <div className="relative flex items-center">
                        <label className={cn(
                          "w-full h-16 bg-slate-50 dark:bg-slate-900/50 border border-slate-350 dark:border-slate-800 rounded-2xl px-6 flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer hover:bg-slate-100/50 transition-all shadow-inner",
                          cvFileName && "border-emerald-500/40 bg-emerald-500/[0.02]"
                        )}>
                          <span className="truncate max-w-[80%] font-bold">{cvFileName || 'Upload CV / Resume (PDF)'}</span>
                          <UploadCloud size={18} className={cn(cvFileName ? "text-emerald-500" : "text-slate-500")} />
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
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-slate-200 hover:bg-slate-350 dark:bg-slate-800 text-[10px] font-bold flex items-center justify-center text-slate-500"
                            title="Remove CV"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* National or Institutional ID Upload */}
                <div className="space-y-4 pt-6 border-t border-slate-100 dark:border-slate-800">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-2">National or Institutional ID Verification (Required for Verified Certificates)</label>
                  <div className="p-8 border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 rounded-[2rem] flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-16 h-16 rounded-2xl bg-white dark:bg-slate-800 shadow-md flex items-center justify-center text-slate-400">
                      <UploadCloud size={28} />
                    </div>
                    <div className="space-y-1">
                      <h5 className="font-extrabold text-slate-800 dark:text-white text-sm">Upload Student Card, National ID or Institutional Badge</h5>
                      <p className="text-xs text-slate-400 max-w-sm">Requires clear photo showing full legal name matching your certificates.</p>
                    </div>
                    <label className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer shadow-lg shadow-emerald-500/10">
                      {idFileUploaded ? 'Change Document' : 'Upload ID File'}
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

                {/* Navigation Buttons */}
                <div className="flex gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                  <Button variant="outline" onClick={() => handleBack('account')} className="flex-1 h-16 rounded-2xl border-2 border-slate-350 dark:border-slate-800 font-extrabold text-sm text-slate-900 dark:text-white hover:bg-slate-50">Back</Button>
                  <Button 
                    disabled={!form.displayName || linkedinError}
                    onClick={() => handleNext('background')} 
                    className="flex-[2] h-16 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest shadow-xl disabled:opacity-50 transition-all active:scale-[0.98]"
                  >
                    Continue
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}

          {/* ── SECTION 3: LEARNING BACKGROUND ── */}
          {step === 'background' && (
            <motion.div 
              key="background" custom={direction} variants={variants} initial="enter" animate="center" exit="exit"
              className="space-y-6"
            >
              <PageHeader 
                title="Learning Background"
                description="Establish your professional footprint to customize course recommendations."
                tag="SECTION 3"
                icon={Shield}
                className="!mb-4"
              />
              <StepIndicator current={isFastTrack ? 1 : 3} total={isFastTrack ? 4 : 6} />

              <Card className="p-8 md:p-12 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-[2.5rem] shadow-xl space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Education level */}
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-slate-200 ml-2">Education Level</label>
                    <select 
                      value={form.education}
                      onChange={e => setForm({...form, education: e.target.value})}
                      required
                      className="w-full h-16 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-800 rounded-2xl px-6 text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all appearance-none cursor-pointer"
                    >
                      <option value="">Select Level...</option>
                      {EDUCATION_LEVELS.map(lvl => <option key={lvl} value={lvl}>{lvl}</option>)}
                    </select>
                  </div>

                  {/* Employment Status */}
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-slate-200 ml-2">Employment Status</label>
                    <select 
                      value={form.employment}
                      onChange={e => setForm({...form, employment: e.target.value})}
                      required
                      className="w-full h-16 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-800 rounded-2xl px-6 text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all appearance-none cursor-pointer"
                    >
                      <option value="">Select Status...</option>
                      {EMPLOYMENT_STATUSES.map(emp => <option key={emp} value={emp}>{emp}</option>)}
                    </select>
                  </div>

                  {/* Job Title */}
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-slate-200 ml-2">Current Job Title</label>
                    <input 
                      type="text" 
                      value={form.jobTitle}
                      onChange={e => setForm({...form, jobTitle: e.target.value})}
                      placeholder="e.g. Junior Systems Operator"
                      className="w-full h-16 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-800 rounded-2xl px-6 text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all"
                    />
                  </div>

                  {/* Primary Career / Industry */}
                  <div className="space-y-2 relative">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-slate-200 ml-2">Primary Careers / Industries</label>
                    <div className="relative">
                      <input 
                        type="text"
                        value={careerSearch}
                        onChange={e => {
                          setCareerSearch(e.target.value);
                          setShowCareerSuggestions(true);
                        }}
                        onFocus={() => setShowCareerSuggestions(true)}
                        onBlur={() => {
                          setTimeout(() => setShowCareerSuggestions(false), 200);
                        }}
                        onKeyDown={handleCareerKeyDown}
                        placeholder="Type any digital career (e.g. prompt engineer, UX designer) & press Enter..."
                        className="w-full h-16 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-800 rounded-2xl px-6 text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all"
                      />
                      
                      {/* Suggestion Dropdown */}
                      {showCareerSuggestions && (
                        <div className="absolute z-20 left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-h-60 overflow-y-auto overflow-x-hidden divide-y divide-slate-100 dark:divide-slate-800">
                          {filteredCareers.length > 0 ? (
                            filteredCareers.map(career => (
                              <button
                                key={career}
                                type="button"
                                onMouseDown={() => addCareer(career)}
                                className="w-full text-left px-6 py-4 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all flex justify-between items-center"
                              >
                                {career}
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">Suggest</span>
                              </button>
                            ))
                          ) : (
                            careerSearch.trim() && (
                              <button
                                type="button"
                                onMouseDown={() => addCareer(careerSearch)}
                                className="w-full text-left px-6 py-4 text-sm font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-all flex justify-between items-center"
                              >
                                <span>Add custom career: <strong className="font-extrabold">"{careerSearch.trim()}"</strong></span>
                                <span className="text-[10px] font-black uppercase tracking-wider text-white bg-emerald-500 px-2 py-1 rounded-md">New</span>
                              </button>
                            )
                          )}
                        </div>
                      )}
                    </div>

                    {/* Selected Tags Display */}
                    {selectedCareers.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-2">
                        {selectedCareers.map(career => (
                          <div 
                            key={career} 
                            className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/60 px-4 py-2 rounded-2xl text-xs font-bold text-emerald-700 dark:text-emerald-300 shadow-sm transition-all hover:scale-105"
                          >
                            {career}
                            <button
                              type="button"
                              onClick={() => removeCareer(career)}
                              className="text-emerald-500 hover:text-red-500 hover:scale-110 font-bold transition-all ml-1"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Years of Experience */}
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-slate-200 ml-2">Years of Work Experience</label>
                    <select 
                      value={form.yearsExp}
                      onChange={e => setForm({...form, yearsExp: e.target.value})}
                      className="w-full h-16 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-800 rounded-2xl px-6 text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all appearance-none cursor-pointer"
                    >
                      <option value="0-2">0 - 2 Years</option>
                      <option value="2-5">2 - 5 Years</option>
                      <option value="5-10">5 - 10 Years</option>
                      <option value="10+">10+ Years</option>
                    </select>
                  </div>

                  {/* Reason for learning */}
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-slate-200 ml-2">Primary Goal / Reason</label>
                    <select 
                      value={form.learningReason}
                      onChange={e => setForm({...form, learningReason: e.target.value})}
                      required
                      className="w-full h-16 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-800 rounded-2xl px-6 text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all appearance-none cursor-pointer"
                    >
                      <option value="">Select Reason...</option>
                      <option value="Career Transition">Career Transition / Retraining</option>
                      <option value="Upskilling">Upskilling / Professional Growth</option>
                      <option value="Personal Interest">Personal Interest / Hobby</option>
                      <option value="Academic Degree">University Course / Degree Prep</option>
                    </select>
                  </div>
                </div>

                {/* Prior Knowledge Level */}
                <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-slate-200 ml-2">Prior Subject Knowledge Level</label>
                  <div className="grid grid-cols-3 gap-4">
                    {['Beginner', 'Intermediate', 'Advanced'].map(lvl => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setForm({...form, priorKnowledge: lvl})}
                        className={cn(
                          "py-5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all border-2 cursor-pointer",
                          form.priorKnowledge === lvl
                            ? "bg-slate-950 dark:bg-emerald-600 text-white border-slate-950 dark:border-emerald-600 shadow-lg"
                            : "bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                        )}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Navigation Buttons */}
                <div className="flex gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <Button variant="outline" onClick={() => handleBack(isFastTrack ? 'welcome' : 'profile')} className="flex-1 h-16 rounded-2xl border-slate-200 dark:border-slate-800 font-bold">Back</Button>
                  <Button 
                    disabled={!form.education || !form.employment || !form.learningReason}
                    onClick={() => handleNext('certificate')} 
                    className="flex-[2] h-16 rounded-2xl bg-slate-950 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white font-black uppercase tracking-widest shadow-xl disabled:opacity-50"
                  >
                    Continue
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}

          {/* ── SECTION 4: CERTIFICATE POLICY ── */}
          {step === 'certificate' && (
            <motion.div 
              key="certificate" custom={direction} variants={variants} initial="enter" animate="center" exit="exit"
              className="space-y-6"
            >
              <PageHeader 
                title="Certificate Policy"
                description="Review parameters for earning verified Trileza graduation certificates."
                tag="SECTION 4"
                icon={Shield}
                className="!mb-4"
              />
              <StepIndicator current={isFastTrack ? 2 : 4} total={isFastTrack ? 4 : 6} />

              <Card className="p-8 md:p-12 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-[2.5rem] shadow-xl space-y-6">
                
                {/* Visual notice about free audit lacking certificate */}
                <div className="p-6 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-3xl space-y-4">
                  <div className="flex gap-3">
                    <Info className="text-emerald-500 flex-shrink-0" size={20} />
                    <div className="space-y-1">
                      <h4 className="font-extrabold text-xs text-slate-800 dark:text-white uppercase tracking-wider">Verifiable Credentials Allocation Policy</h4>
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                        If you enrolled via **Free Audit Track**, please note that **certificates are excluded.** If you decide you need a verified certificate later, you must either submit a financial aid waiver application or transition to the premium track.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Certificate Legal Name (Important) */}
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-slate-200 ml-2">Certificate Verifiable Legal Name (Required)</label>
                  <input 
                    type="text" 
                    value={form.legalCertificateName}
                    onChange={e => setForm({...form, legalCertificateName: e.target.value})}
                    placeholder="e.g. David Ileza Adamu"
                    className="w-full h-16 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-800 rounded-2xl px-6 text-sm font-semibold text-slate-900 dark:text-white outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all"
                  />
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium ml-2 block leading-normal">Must match your government identity document. This legal name is stamped into the verification system for certificate verifications.</span>
                </div>

                {/* Navigation Buttons */}
                <div className="flex gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <Button variant="outline" onClick={() => handleBack('background')} className="flex-1 h-16 rounded-2xl border-slate-200 dark:border-slate-800 font-bold">Back</Button>
                  <Button 
                    disabled={!form.legalCertificateName}
                    onClick={() => handleNext('privacy')} 
                    className="flex-[2] h-16 rounded-2xl bg-slate-950 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white font-black uppercase tracking-widest shadow-xl disabled:opacity-50"
                  >
                    Continue
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}

          {/* ── SECTION 5: PRIVACY & COMMUNICATIONS ── */}
          {step === 'privacy' && (
            <motion.div 
              key="privacy" custom={direction} variants={variants} initial="enter" animate="center" exit="exit"
              className="space-y-6"
            >
              <PageHeader 
                title="Privacy & Alerts"
                description="Control data sharing configurations and automated messaging alerts."
                tag="SECTION 5"
                icon={Shield}
                className="!mb-4"
              />
              <StepIndicator current={isFastTrack ? 3 : 5} total={isFastTrack ? 4 : 6} />

              <Card className="p-8 md:p-12 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-[2.5rem] shadow-xl space-y-6">
                
                {/* 1. Promotions */}
                <label className="flex items-start gap-4 p-5 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-800 rounded-3xl cursor-pointer hover:bg-slate-100/50 transition-all">
                  <input 
                    type="checkbox" 
                    checked={form.optInPromotions}
                    onChange={e => setForm({...form, optInPromotions: e.target.checked})}
                    className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 mt-1"
                  />
                  <div>
                    <h4 className="font-bold text-sm text-slate-800 dark:text-white">Promotional Cohort Campaigns</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-1">Send recommendations for newly verified micro-degree classes and exclusive pricing waivers.</p>
                  </div>
                </label>

                {/* 2. Reminders */}
                <label className="flex items-start gap-4 p-5 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-800 rounded-3xl cursor-pointer hover:bg-slate-100/50 transition-all">
                  <input 
                    type="checkbox" 
                    checked={form.optInReminders}
                    onChange={e => setForm({...form, optInReminders: e.target.checked})}
                    className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 mt-1"
                  />
                  <div>
                    <h4 className="font-bold text-sm text-slate-800 dark:text-white">Active Syllabus Reminders</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-1">Receive weekly progress checkpoints, cohort assignment schedules, and tutor session calendar syncs.</p>
                  </div>
                </label>

                {/* 3. Share data */}
                <label className="flex items-start gap-4 p-5 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-800 rounded-3xl cursor-pointer hover:bg-slate-100/50 transition-all">
                  <input 
                    type="checkbox" 
                    checked={form.optInShareData}
                    onChange={e => setForm({...form, optInShareData: e.target.checked})}
                    className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 mt-1"
                  />
                  <div>
                    <h4 className="font-bold text-sm text-slate-800 dark:text-white">Corporate Recruiting Sharing Pool</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-1">Allow Trileza to list my verified coding badges, resume/CV files, and contact details in directories shared with official organizational recruiters.</p>
                  </div>
                </label>

                {/* 4. Surveys */}
                <label className="flex items-start gap-4 p-5 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-800 rounded-3xl cursor-pointer hover:bg-slate-100/50 transition-all">
                  <input 
                    type="checkbox" 
                    checked={form.optInSurveys}
                    onChange={e => setForm({...form, optInSurveys: e.target.checked})}
                    className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 mt-1"
                  />
                  <div>
                    <h4 className="font-bold text-sm text-slate-800 dark:text-white">Pedagogy Surveys & Beta Pools</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-1">Incorporate my active panel feedback in platform beta tests and localized user research exercises.</p>
                  </div>
                </label>

                {/* Navigation Buttons */}
                <div className="flex gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <Button variant="outline" onClick={() => handleBack('certificate')} className="flex-1 h-16 rounded-2xl border-slate-200 dark:border-slate-800 font-bold">Back</Button>
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

          {/* ── SECTION 6: FINAL COMPLIANCE & REVIEW ── */}
          {step === 'review' && (
            <motion.div 
              key="review" custom={direction} variants={variants} initial="enter" animate="center" exit="exit"
              className="space-y-6"
            >
              <PageHeader 
                title="Terms & Submission"
                description="Verify COPPA compliance and submit your customized academy dashboard."
                tag="SECTION 6"
                icon={Shield}
                className="!mb-4"
              />
              <StepIndicator current={isFastTrack ? 4 : 6} total={isFastTrack ? 4 : 6} />

              <Card className="p-8 md:p-12 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-[2.5rem] shadow-xl space-y-6">
                
                {/* Visual recap card */}
                <div className="flex items-center gap-6 pb-6 border-b border-slate-100 dark:border-slate-800">
                  <div className="w-16 h-16 bg-gradient-to-tr from-emerald-600 to-teal-400 rounded-2xl flex items-center justify-center text-white font-black text-xl flex-shrink-0 shadow-lg">
                    {form.displayName ? form.displayName[0] : 'S'}
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white">Active Student: {form.displayName}</h3>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Country: {form.country} • Lang: {form.language}</p>
                  </div>
                </div>

                {/* COPPA Age Checkbox */}
                <label className="flex items-start gap-4 p-5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-3xl cursor-pointer hover:bg-slate-100/50 transition-all">
                  <input 
                    type="checkbox" 
                    checked={form.confirmAge}
                    onChange={e => setForm({...form, confirmAge: e.target.checked})}
                    className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 mt-0.5"
                  />
                  <div>
                    <h4 className="font-extrabold text-xs text-slate-800 dark:text-white uppercase tracking-wider">COPPA & Minimum Age Acknowledgment (Required)</h4>
                    <p className="text-xs text-slate-400 leading-relaxed mt-1">I verify that I am above 13 years of age, or have active parental consent to manage academic accounts inside the Trileza servers.</p>
                  </div>
                </label>

                {/* Platform Terms Checkbox */}
                <label className="flex items-start gap-4 p-5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-3xl cursor-pointer hover:bg-slate-100/50 transition-all">
                  <input 
                    type="checkbox" 
                    checked={form.agreeToTerms}
                    onChange={e => setForm({...form, agreeToTerms: e.target.checked})}
                    className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 mt-0.5"
                  />
                  <div>
                    <h4 className="font-extrabold text-xs text-slate-800 dark:text-white uppercase tracking-wider">Platform Terms of Service & Privacy Agreement (Required)</h4>
                    <p className="text-xs text-slate-400 leading-relaxed mt-1">I accept the Trileza Academy Terms of Service, Honor Code parameters, and agree to let the platform encrypt and index my metadata securely.</p>
                  </div>
                </label>

                {/* Navigation Buttons */}
                <div className="flex gap-4 pt-4">
                  <Button variant="outline" onClick={() => handleBack('privacy')} className="flex-1 h-16 rounded-2xl border-slate-200 dark:border-slate-800 font-bold">Edit</Button>
                  <Button 
                    disabled={!form.agreeToTerms || !form.confirmAge}
                    onClick={handleFinish} 
                    className="flex-[2] h-16 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest shadow-xl shadow-emerald-500/20 group"
                  >
                    Finish Onboarding
                    <Sparkles className="ml-2 group-hover:scale-110 transition-transform" size={14} />
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}

          {/* ── FINALIZING ── */}
          {step === 'finalizing' && (
            <div className="text-center space-y-12 py-20 min-h-[400px] flex flex-col items-center justify-center">
              <div className="relative w-44 h-44">
                <div className="absolute inset-0 rounded-full border-4 border-emerald-500/10 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-24 h-24 bg-slate-900 dark:bg-emerald-600 rounded-full flex items-center justify-center shadow-2xl">
                    <GraduationCap className="text-white animate-pulse" size={44} />
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <h2 className="text-3xl font-black text-slate-800 dark:text-white">Synchronizing Academy Profile</h2>
                <p className="text-lg text-slate-400 font-medium animate-pulse">Index mapping verified with InsForge server array...</p>
              </div>
            </div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
};

export default MenteeOnboarding;
