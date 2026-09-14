import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Award, 
  Shield, 
  Globe, 
  Sparkles, 
  Clock, 
  CheckCircle2, 
  ChevronRight, 
  Info,
  AlertCircle,
  UploadCloud,
  Trash2,
  Plus,
  Link2,
  X,
  Search
} from 'lucide-react';
import { Card, Button } from '../../components/ui';
import { PageHeader } from '../../components/shared';
import { cn } from '../../utils';
import { useAuthStore } from '../../store/authStore';
import { useSubscriptionStore } from '../../store/subscriptionStore';
import { motion, AnimatePresence } from 'framer-motion';
import { nexus } from '../../lib/nexus';
import { publishUserEvent } from '../../lib/services/realtimeEvents';

type OnboardingStep = 
  | 'welcome' 
  | 'account' 
  | 'identity' 
  | 'qualifications' 
  | 'preferences' 
  | 'review' 
  | 'finalizing'
  | 'submitted';

const EDUCATION_LEVELS = [
  'Bachelor\'s Degree',
  'Master\'s Degree',
  'Doctorate (Ph.D. / Ed.D.)',
  'Professional Certification',
  'Self-taught / Industry Expert'
];

const EXPERIENCE_YEARS = ['0-2 Years', '2-5 Years', '5-10 Years', '10+ Years'];

const COURSE_CATEGORIES = [
  'Software Development', 'Web Development', 'Mobile Development', 
  'Data Science', 'Machine Learning', 'AI & Deep Learning', 
  'Cloud Computing', 'Cybersecurity', 'DevOps', 'Blockchain', 
  'UI/UX Design', 'Digital Marketing', 'Product Management', 
  'Creative Coding', 'Sustainable Architecture', 'Executive Leadership', 
  'Graphic Design', 'Game Development', 'Entrepreneurship', 'Financial Literacy'
];

type CredentialEntry = {
  id: string;
  type: 'file' | 'text';
  value: string; // file name or text description
  fileObj?: File; // the actual file to upload later if needed
};

const PRICE_TIERS = [
  { tier: 'Free', price: '$0.00' },
  { tier: 'Tier A', price: '$19.99' },
  { tier: 'Tier B', price: '$49.99' },
  { tier: 'Tier C', price: '$99.99' },
  { tier: 'Tier D', price: '$199.99' }
];

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

const Onboarding = () => {
  const navigate = useNavigate();
  const { user, updateProfile, logout } = useAuthStore();
  
  const isFastTrack = user?.metadata?.mentee_onboarded === true;
  
  // Step Management
  const [step, setStep] = useState<OnboardingStep>('welcome');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const isRejected = user?.metadata?.mentor_application_status === 'rejected';
  const [direction, setDirection] = useState(1);
  const [socialConnected, setSocialConnected] = useState<string | null>(null);
  
  // Simulated OTP & File States
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [emailVerified, setEmailVerified] = useState(false);
  const [isVerifyingEmail, setIsVerifyingEmail] = useState(false);
  const [idFileUploaded, setIdFileUploaded] = useState<string | null>(null);
  // The control previously kept only a filename in state — nothing reached
  // storage or the database, so the reviewer had no document to verify.
  const [idDocument, setIdDocument] = useState<{ url: string; name: string; type: string } | null>(null);
  const [idUploading, setIdUploading] = useState(false);
  const [idUploadError, setIdUploadError] = useState<string | null>(null);
  // State for forms
  const [form, setForm] = useState({
    // Section 2: Personal Profile & Verification
    phoneNumber: '',
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
    
    // Section 8: Communications
    optInNewsletters: true,
    optInFeedback: true,
    optInPromotions: false,
    
    // Section 9: Quality audit
    meetsQualityCheck: false,
    hasFullRightsCheck: false
  });

  // Credentials State
  const [credentials, setCredentials] = useState<CredentialEntry[]>([]);
  const [expertiseSearch, setExpertiseSearch] = useState('');
  const [showExpertiseSuggestions, setShowExpertiseSuggestions] = useState(false);
  const filteredExpertise = COURSE_CATEGORIES.filter(c => c.toLowerCase().includes(expertiseSearch.toLowerCase()) && !form.expertiseAreas.includes(c));

  // Custom Date of Birth Selector States
  const [dobDay, setDobDay] = useState('');
  const [dobMonth, setDobMonth] = useState('');
  const [dobYear, setDobYear] = useState('');

  // CV / LinkedIn States
  const [cvFileName, setCvFileName] = useState<string | null>(null);
  const [linkedinError, setLinkedinError] = useState(false);

  // Sync custom DOB selectors to form.dob
  useEffect(() => {
    if (dobDay && dobMonth && dobYear) {
      setForm(prev => ({
        ...prev,
        dob: `${dobYear}-${dobMonth}-${dobDay}`
      }));
    }
  }, [dobDay, dobMonth, dobYear]);

  // Real-time LinkedIn Validation for Mentors
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

  // Someone who has already applied should see where they stand, not a blank
  // form that would fail on the unique constraint when they submitted it again.
  useEffect(() => {
    const status = user?.metadata?.mentor_application_status;
    if (status === 'pending') {
      setStep('submitted');
    }
  }, [user?.metadata?.mentor_application_status]);

  // Fast-track pre-population for Mentees becoming Mentors
  useEffect(() => {
    if (isFastTrack && user?.metadata?.onboarding_data) {
      const menteeProfile = user.metadata.onboarding_data.profile || {};
      const menteeBg = user.metadata.onboarding_data.learning_background || {};
      
      setForm(prev => ({
        ...prev,
        legalName: user.full_name,
        publicName: menteeProfile.display_name || user.full_name.split(' ')[0] || prev.publicName,
        linkedinUrl: menteeProfile.linkedin || prev.linkedinUrl,
        country: menteeProfile.country || prev.country,
        highestEducation: menteeBg.education_level || prev.highestEducation,
        yearsExp: menteeBg.years_exp || prev.yearsExp
      }));

      if (menteeProfile.dob) {
        const parts = menteeProfile.dob.split('-');
        if (parts.length === 3) {
          setDobYear(parts[0]);
          setDobMonth(parts[1]);
          setDobDay(parts[2]);
        }
      }
    }
  }, [isFastTrack, user]);

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
      if (!user) return;

      // mentor_applications has no unique constraint on user_id, so an open
      // application has to be detected here or a re-submit would queue a
      // duplicate for the review team.
      const { data: openApp } = await nexus.database
        .from('mentor_applications')
        .select('id, status')
        .eq('user_id', user.id)
        .in('status', ['pending', 'needs_info'])
        .maybeSingle();

      if (openApp) {
        setSubmitError('You already have an application in review. You will be notified once it has been assessed.');
        setStep('submitted');
        return;
      }

      // The application must actually reach the review queue. If this write
      // fails the applicant has to know, because nothing downstream will
      // happen without a row here.
      const { error: appError } = await nexus.database.from('mentor_applications').insert([{
        user_id: user.id,
        status: 'pending',
        qualifications: `${form.highestEducation || 'Degree'} | ${form.yearsExp || '0 Years'} | Motivation: ${form.teachingMotivation || 'None'}`,
        // The reviewer's ID check needs something to check against. These were
        // the missing half of checklist_id_verification.
        id_document_url: idDocument?.url || null,
        id_document_name: idDocument?.name || null,
        id_document_type: idDocument?.type || null,
        phone_number: form.phoneNumber || null,
        submitted_at: new Date().toISOString()
      }]);

      if (appError) {
        setSubmitError(
          /duplicate|unique/i.test(appError.message)
            ? 'You already have an application in review. You will be notified once it has been assessed.'
            : `Your application could not be submitted: ${appError.message}`
        );
        setStep('review');
        return;
      }

      // The applicant stays a mentee until an admin approves. Their answers are
      // parked in pending_mentor_data, which reviewMentor() promotes to
      // mentor_data on approval.
      const result = await updateProfile({
        metadata: {
          ...user?.metadata,
          mentor_onboarded: false,
          mentor_application_status: 'pending',
          mentor_applied_at: new Date().toISOString(),
          pending_mentor_data: {
            identity: {
              legalName: form.legalName,
              publicName: form.publicName,
              dob: form.dob,
              phoneNumber: form.phoneNumber,
              idDocument: idDocument || null,
              address: { street: form.streetAddress, city: form.city, postal: form.postalCode, country: form.country },
              taxId: form.taxId,
              socials: { linkedin: form.linkedinUrl, website: form.websiteUrl }
            },
            qualifications: {
              yearsExp: form.yearsExp,
              education: form.highestEducation,
              motivation: form.teachingMotivation,
              skills: form.expertiseAreas,
              credentials: credentials.map(c => ({ type: c.type, value: c.value }))
            },
            preferences: {
              newsletters: form.optInNewsletters,
              feedbackDigest: form.optInFeedback,
              promotions: form.optInPromotions
            }
          }
        }
      });

      // No role or tier switch here — that happens on approval.

      // Real-time broadcast to Admin console and dashboard
      publishUserEvent('mentor_application_submitted', {
        userId: user.id,
        legalName: form.legalName,
        qualifications: form.highestEducation,
        submittedAt: new Date().toISOString()
      });
      publishUserEvent('profile_updated', {
        userId: user.id,
        metadata: { mentor_application_status: 'pending' }
      });

      if (result.error) {
        setStep('review');
        return;
      }

      // Show the "in review" confirmation rather than a dashboard they cannot
      // use yet.
      setStep('submitted');
    } catch (err) {
      console.error(err);
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

  const StepIndicator = ({ current, total }: { current: number, total: number }) => null;

  const handleExitToPortal = () => {
    // Set synchronously, before navigating, so the onboarding gate in App.tsx
    // sees it on the very next render. Anything async here would lose the race
    // and the gate would redirect straight back.
    try {
      sessionStorage.setItem('trileza_mentor_onboarding_dismissed', '1');
    } catch {
      // Private mode or blocked storage — the hasApplied escape still covers
      // anyone who has actually submitted.
    }

    // Navigate first, always.
    //
    // This used to await updateProfile() before navigating. The nexus client is
    // configured with timeout: 0, so a request that never resolved left the
    // await pending forever and navigate() was never reached — the button did
    // nothing at all, and reported nothing. Cancelling out of a form must never
    // depend on a network round trip.
    navigate('/', { replace: true });

    // The exit timestamp is bookkeeping. Written in the background, allowed to
    // fail quietly. Nothing else is written here: leaving the form early must
    // not grant mentor status.
    if (user) {
      updateProfile(
        {
          metadata: {
            ...user.metadata,
            mentor_onboarding_exited_at: new Date().toISOString()
          }
        },
        true
      ).catch(e => console.warn('[Onboarding] Could not record exit timestamp:', e));
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex justify-center items-start p-4 relative py-12 md:py-20 overflow-y-auto">

      {/* Premium Dynamic Neon Backdrops */}
      <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-gradient-to-tr from-emerald-500/15 to-teal-500/10 rounded-full blur-[130px] pointer-events-none animate-pulse duration-[8000ms]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-gradient-to-tr from-indigo-500/15 to-purple-500/10 rounded-full blur-[130px] pointer-events-none animate-pulse duration-[10000ms]" />

      {/* Portrait column. Was max-w-5xl (1024px), which stretched a form of
          mostly single inputs across the whole display. */}
      <div className="max-w-2xl w-full relative z-10 mx-auto">
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
                  Mentor Application
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Empowering global learning, instruction & monetization</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleExitToPortal}
            className="text-xs font-bold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white px-3.5 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors cursor-pointer"
          >
            Cancel & Return
          </button>
        </div>

        <AnimatePresence custom={direction} mode="wait">

          {/* ── WELCOME ── */}
          {step === 'welcome' && (
            <motion.div 
              key="welcome" custom={direction} variants={variants} initial="enter" animate="center" exit="exit"
              className="text-center space-y-10"
            >
              <div className="space-y-6">
                <h1 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">
                  {isFastTrack ? (
                    <>Fast-Track to Mentor Onboarding & <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-emerald-400">Profile Creation</span></>
                  ) : (
                    <>Mentor Onboarding & <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-emerald-400">Profile Creation</span>.</>
                  )}
                </h1>
                <p className="text-lg text-slate-500 dark:text-slate-400 font-medium max-w-xl mx-auto leading-relaxed">
                  {isFastTrack
                    ? "As an approved Trileza Mentee, your personal credentials are pre-verified! Answer a few coaching qualifications, complete training, and let's set up your Mentor profile."
                    : "Join Trileza as an Elite Mentor. Let's verify your identity, qualify your professional certifications, complete orientation, and set up your mentor profile!"
                  }
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
                    <Award size={20} />
                  </div>
                  <h3 className="font-bold text-slate-800 dark:text-white text-sm">Expertise Mentoring</h3>
                  <p className="text-xs text-slate-400">Guide mentees using your specific domain knowledge and experience.</p>
                </div>
                <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 rounded-3xl text-center space-y-3 shadow-md">
                  <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center mx-auto">
                    <Globe size={20} />
                  </div>
                  <h3 className="font-bold text-slate-800 dark:text-white text-sm">Global Reach</h3>
                  <p className="text-xs text-slate-400">Connect with students and professionals from all over the world.</p>
                </div>
              </div>

              <Button 
                onClick={() => handleNext(isFastTrack ? 'identity' : 'account')}
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
              <PageHeader 
                title="Account Creation"
                description="Verify your active mentor identity and link optional social credentials."
                tag="SECTION 1"
                icon={Shield}
                className="!mb-4"
              />
              <StepIndicator current={1} total={9} />

              <Card className="p-8 md:p-10 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-[2.5rem] space-y-8 shadow-xl">
                {/* Social Login Options */}
                <div className="space-y-4">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-slate-200 ml-2">Link OAuth Platforms (Optional)</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {['Google', 'Facebook', 'Apple'].map(provider => (
                      <button 
                        key={provider}
                        type="button"
                        onClick={() => simulatedSocialConnect(provider)}
                        className={cn(
                          "flex items-center justify-center gap-3 py-4 px-6 rounded-2xl border font-bold text-sm transition-all cursor-pointer",
                          socialConnected === provider
                            ? "bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400"
                            : "bg-slate-50 hover:bg-slate-100 border-slate-300 dark:bg-slate-800/40 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                        )}
                      >
                        {socialConnected === provider ? provider + ' Linked' : 'Link ' + provider}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Account Type Notice */}
                <div className="p-6 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-3xl space-y-2">
                  <h4 className="font-bold text-slate-800 dark:text-white text-xs uppercase tracking-wider flex items-center gap-2">
                    <Info size={14} className="text-emerald-500" /> Unified Profile Structure
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                    At Trileza, **separate student and instructor accounts are the same.** You use one unified profile; your role credentials determine whether you have access to the Mentor Profile or the Mentee Profile. Progress variables remain seamlessly mapped.
                  </p>
                </div>

                {/* Navigation Buttons */}
                <div className="flex gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <Button variant="outline" onClick={() => handleBack('welcome')} className="flex-1 h-16 rounded-2xl border-slate-200 dark:border-slate-800 font-bold">Back</Button>
                  <Button 
                    onClick={() => handleNext('identity')} 
                    className="flex-[2] h-16 rounded-2xl bg-slate-950 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white font-black uppercase tracking-widest shadow-xl"
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
              <PageHeader 
                title="Profile & Identity (KYC)"
                description="Declare your payout-eligible legal details, residence parameters, and credentials to establish verified course publishing."
                tag="SECTION 2"
                icon={Shield}
                className="!mb-4"
              />
              <StepIndicator current={isFastTrack ? 1 : 2} total={isFastTrack ? 8 : 9} />

              <Card className="p-8 md:p-12 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-[3rem] space-y-8 shadow-xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Legal name */}
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-slate-100 ml-2">Full Legal Name (Required)</label>
                    <input 
                      type="text"
                      value={form.legalName}
                      onChange={e => setForm({...form, legalName: e.target.value})}
                      placeholder="e.g. David Ileza Adamu"
                      className="w-full h-16 bg-slate-50 dark:bg-slate-900/50 border border-slate-350 dark:border-slate-800 rounded-2xl px-6 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-inner"
                    />
                    <span className="text-[11px] text-slate-700 dark:text-slate-300 ml-2 block font-extrabold">For legal contracts and payout tax documents.</span>
                  </div>

                  {/* Public instructor name */}
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-slate-100 ml-2">Public Instructor Name (Required)</label>
                    <input 
                      type="text"
                      value={form.publicName}
                      onChange={e => setForm({...form, publicName: e.target.value})}
                      placeholder="e.g. Dr. David Ileza"
                      className="w-full h-16 bg-slate-50 dark:bg-slate-900/50 border border-slate-350 dark:border-slate-800 rounded-2xl px-6 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-inner"
                    />
                    <span className="text-[11px] text-slate-700 dark:text-slate-300 ml-2 block font-extrabold">Your visible public persona. Can differ from legal name.</span>
                  </div>

                  {/* Custom Date of Birth selectors */}
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-slate-100 ml-2">Date of Birth (Age Verification)</label>
                    <div className="grid grid-cols-3 gap-3">
                      {/* Month dropdown */}
                      <select
                        value={dobMonth}
                        onChange={e => setDobMonth(e.target.value)}
                        className="bg-slate-50 dark:bg-slate-900/50 border border-slate-350 dark:border-slate-800 rounded-2xl px-4 h-16 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all appearance-none cursor-pointer"
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
                        className="bg-slate-50 dark:bg-slate-900/50 border border-slate-350 dark:border-slate-800 rounded-2xl px-4 h-16 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all appearance-none cursor-pointer"
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
                        className="bg-slate-50 dark:bg-slate-900/50 border border-slate-350 dark:border-slate-800 rounded-2xl px-4 h-16 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all appearance-none cursor-pointer"
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
                    <label className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-slate-100 ml-2">Country / Region of Residence</label>
                    <select 
                      value={form.country}
                      onChange={e => setForm({...form, country: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-350 dark:border-slate-800 rounded-2xl px-6 h-16 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all appearance-none cursor-pointer"
                    >
                      {COUNTRY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                {/* Contact number — required for payout verification and for
                    the team to reach an applicant about their submission. */}
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-slate-100 ml-2">
                    Phone Number (Required)
                  </label>
                  <input
                    type="tel"
                    value={form.phoneNumber}
                    onChange={e => setForm({ ...form, phoneNumber: e.target.value })}
                    placeholder="+234 800 000 0000"
                    className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-350 dark:border-slate-800 rounded-2xl px-6 h-16 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                  <p className="text-xs font-bold text-slate-400 ml-2">
                    Used to verify payout details and to contact you about this application.
                  </p>
                </div>

                {/* ID Card Upload Card */}
                <div className="space-y-4">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-slate-100 ml-2">Government-Issued ID Verification</label>
                  <p className="text-xs font-bold text-slate-400 ml-2 -mt-2">
                    You can submit without this, but publishing stays locked until our team has verified your identity.
                  </p>
                  <div className="p-8 border-2 border-dashed border-emerald-500/30 dark:border-emerald-500/20 bg-slate-50/50 dark:bg-slate-950/50 rounded-[2rem] flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-16 h-16 rounded-2xl bg-white dark:bg-slate-900 shadow-md border border-slate-200 dark:border-slate-800 flex items-center justify-center text-emerald-500">
                      <UploadCloud size={28} />
                    </div>
                    <div className="space-y-1">
                      <h5 className="font-extrabold text-slate-900 dark:text-white text-sm">Upload Student Card, National ID or Institutional Badge</h5>
                      <p className="text-xs text-slate-700 dark:text-slate-300 font-semibold max-w-sm">Passport, driver's license, national identity card, or official institutional ID badge. Must be high-resolution PDF or JPEG.</p>
                    </div>
                    <label className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer shadow-lg shadow-emerald-500/25 transition-all active:scale-95">
                      {idUploading ? 'Uploading…' : idDocument ? 'Change Document' : 'Select ID File'}
                      <input 
                        type="file" 
                        accept=".pdf,image/*" 
                        className="hidden" 
                        disabled={idUploading}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;

                          setIdUploadError(null);
                          if (file.size > 10 * 1024 * 1024) {
                            setIdUploadError('That file is larger than 10 MB. Please upload a smaller scan or photo.');
                            return;
                          }

                          setIdUploading(true);
                          setIdFileUploaded(file.name);
                          try {
                            // Identity documents go to a private bucket. The
                            // reviewer opens them through a signed URL.
                            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
                            const path = `${user?.id || 'anon'}/${Date.now()}_${safeName}`;
                            const { error: upErr } = await nexus.storage
                              .from('mentor-kyc')
                              .upload(path, file);

                            if (upErr) throw new Error(upErr.message);

                            setIdDocument({ url: path, name: file.name, type: file.type || 'unknown' });
                          } catch (err: any) {
                            console.error('[Onboarding] ID upload failed:', err);
                            setIdUploadError(err?.message || 'That upload did not complete. You can try again, or submit without it.');
                            setIdFileUploaded(null);
                            setIdDocument(null);
                          } finally {
                            setIdUploading(false);
                          }
                        }}
                      />
                    </label>
                    {idDocument && !idUploading && (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 font-extrabold flex items-center gap-1.5">
                        <CheckCircle2 size={12} /> {idDocument.name} uploaded
                      </p>
                    )}
                    {idUploadError && (
                      <p className="text-xs text-rose-600 dark:text-rose-400 font-bold max-w-sm text-center">{idUploadError}</p>
                    )}
                  </div>
                </div>

                {/* Billing Address details */}
                <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-slate-100 ml-2">Mailing / Tax Address (Optional at Signup)</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div className="sm:col-span-3 space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-900 dark:text-slate-100 ml-2">Street Address</label>
                      <input 
                        type="text" 
                        value={form.streetAddress}
                        onChange={e => setForm({...form, streetAddress: e.target.value})}
                        placeholder="e.g. 15 Adetokunbo Ademola St"
                        className="w-full h-16 bg-slate-50 dark:bg-slate-900/50 border border-slate-350 dark:border-slate-800 rounded-2xl px-6 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-900 dark:text-slate-100 ml-2">City</label>
                      <input 
                        type="text" 
                        value={form.city}
                        onChange={e => setForm({...form, city: e.target.value})}
                        placeholder="e.g. Victoria Island"
                        className="w-full h-16 bg-slate-50 dark:bg-slate-900/50 border border-slate-350 dark:border-slate-800 rounded-2xl px-6 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-900 dark:text-slate-100 ml-2">Postal / ZIP Code</label>
                      <input 
                        type="text" 
                        value={form.postalCode}
                        onChange={e => setForm({...form, postalCode: e.target.value})}
                        placeholder="e.g. 101241"
                        className="w-full h-16 bg-slate-50 dark:bg-slate-900/50 border border-slate-350 dark:border-slate-800 rounded-2xl px-6 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-900 dark:text-slate-100 ml-2">Tax ID / TIN / SSN (Optional)</label>
                      <input 
                        type="text" 
                        value={form.taxId}
                        onChange={e => setForm({...form, taxId: e.target.value})}
                        placeholder="e.g. TIN-124567-X"
                        className="w-full h-16 bg-slate-50 dark:bg-slate-900/50 border border-slate-350 dark:border-slate-800 rounded-2xl px-6 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Profile Pic, Bio & Links */}
                <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-slate-100 ml-2">Public Biography & Links</h4>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-900 dark:text-slate-100 ml-2">Public Bio (Public-facing)</label>
                      <textarea 
                        value={form.publicBio}
                        onChange={e => setForm({...form, publicBio: e.target.value})}
                        placeholder="Write a brief summary of your expert background, teaching style, and primary credentials (optional at signup)..."
                        className="w-full h-24 bg-slate-50 dark:bg-slate-900/50 border border-slate-350 dark:border-slate-800 rounded-[1.5rem] px-6 py-4 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all resize-none"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      {/* LinkedIn input with real validation check */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-900 dark:text-slate-100 ml-2">LinkedIn URL (Optional)</label>
                        <div className="relative">
                          <Link2 size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500" />
                          <input 
                            type="url" 
                            value={form.linkedinUrl}
                            onChange={e => handleLinkedinChange(e.target.value)}
                            placeholder="https://linkedin.com/in/username"
                            className={cn(
                              "w-full h-16 bg-slate-50 dark:bg-slate-900/50 border rounded-2xl pl-12 pr-6 text-xs font-bold text-slate-900 dark:text-white outline-none transition-all",
                              linkedinError 
                                ? "border-amber-500 focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 text-amber-600"
                                : "border-slate-350 dark:border-slate-800 focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500"
                            )}
                          />
                        </div>
                        {linkedinError && (
                          <p className="text-[10px] text-amber-550 dark:text-amber-400 font-black ml-2 flex items-center gap-1 animate-pulse">
                            <AlertCircle size={12} /> Must be a valid LinkedIn link (e.g. https://linkedin.com/in/user)
                          </p>
                        )}
                      </div>

                      {/* Professional CV/Resume Upload option */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-900 dark:text-slate-100 ml-2">CV / Resume File (Optional)</label>
                        <div className="relative flex items-center">
                          <label className={cn(
                            "w-full h-16 bg-slate-50 dark:bg-slate-900/50 border border-slate-350 dark:border-slate-800 rounded-2xl px-6 flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer hover:bg-slate-100/50 transition-all",
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
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-900 dark:text-slate-100 ml-2">Personal Website / Portfolio</label>
                        <input 
                          type="url" 
                          value={form.websiteUrl}
                          onChange={e => setForm({...form, websiteUrl: e.target.value})}
                          placeholder="https://davidarch.io"
                          className="w-full h-16 bg-slate-50 dark:bg-slate-900/50 border border-slate-350 dark:border-slate-800 rounded-2xl px-6 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Navigation Buttons */}
                <div className="flex gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                  <Button variant="outline" onClick={() => handleBack(isFastTrack ? 'welcome' : 'account')} className="flex-1 h-16 rounded-2xl border-slate-350 dark:border-slate-800 font-extrabold text-sm text-slate-900 dark:text-white hover:bg-slate-50">Back</Button>
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
              <PageHeader 
                title="Expertise & Qualifications"
                description="Verify your background, education, and specific subject specialties."
                tag="SECTION 3"
                icon={Shield}
                className="!mb-4"
              />
              <StepIndicator current={isFastTrack ? 2 : 3} total={isFastTrack ? 8 : 9} />

              <Card className="p-8 md:p-10 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-[2.5rem] space-y-8 shadow-xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Years of Experience */}
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-slate-200 ml-2">Teaching / Operating Experience</label>
                    <select 
                      value={form.yearsExp}
                      onChange={e => setForm({...form, yearsExp: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-800 rounded-2xl px-6 py-4 text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all appearance-none cursor-pointer"
                    >
                      {EXPERIENCE_YEARS.map(exp => <option key={exp} value={exp}>{exp}</option>)}
                    </select>
                  </div>

                  {/* Highest Education */}
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-slate-200 ml-2">Highest Education Level</label>
                    <select 
                      value={form.highestEducation}
                      onChange={e => setForm({...form, highestEducation: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-800 rounded-2xl px-6 py-4 text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all appearance-none cursor-pointer"
                    >
                      <option value="">Select Education...</option>
                      {EDUCATION_LEVELS.map(edu => <option key={edu} value={edu}>{edu}</option>)}
                    </select>
                  </div>
                </div>

                {/* Multiple Credentials Upload / Entry */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-xs text-slate-800 dark:text-white">Credentials / Certificates</h4>
                      <p className="text-[10px] text-slate-400">Upload degrees or enter notable achievements.</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCredentials([...credentials, { id: Math.random().toString(36).substr(2, 9), type: 'text', value: '' }])}
                      className="h-8 text-[10px] font-bold uppercase tracking-wider border-slate-200 dark:border-slate-800"
                    >
                      <Plus size={14} className="mr-1" /> Add Credential
                    </Button>
                  </div>
                  
                  {credentials.map((cred, idx) => (
                    <div key={cred.id} className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-start gap-4">
                      <div className="flex-1 space-y-3">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const newCreds = [...credentials];
                              newCreds[idx].type = 'text';
                              setCredentials(newCreds);
                            }}
                            className={cn("px-3 py-1 text-[10px] font-bold rounded-lg transition-all", cred.type === 'text' ? "bg-emerald-100 text-emerald-700" : "bg-white text-slate-500 border border-slate-200")}
                          >
                            Text Entry
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const newCreds = [...credentials];
                              newCreds[idx].type = 'file';
                              setCredentials(newCreds);
                            }}
                            className={cn("px-3 py-1 text-[10px] font-bold rounded-lg transition-all", cred.type === 'file' ? "bg-emerald-100 text-emerald-700" : "bg-white text-slate-500 border border-slate-200")}
                          >
                            File Upload
                          </button>
                        </div>
                        
                        {cred.type === 'text' ? (
                          <input
                            type="text"
                            value={cred.value}
                            onChange={(e) => {
                              const newCreds = [...credentials];
                              newCreds[idx].value = e.target.value;
                              setCredentials(newCreds);
                            }}
                            placeholder="e.g., AWS Solutions Architect (2024)"
                            className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs outline-none focus:ring-2 focus:ring-emerald-500/20"
                          />
                        ) : (
                          <div className="flex items-center gap-3">
                            <label className="px-4 py-2 bg-slate-950 hover:bg-black text-white text-[10px] font-black uppercase tracking-wider rounded-xl cursor-pointer">
                              Choose File
                              <input 
                                type="file" 
                                accept=".pdf,image/*" 
                                className="hidden" 
                                onChange={(e) => {
                                  if (e.target.files?.[0]) {
                                    const newCreds = [...credentials];
                                    newCreds[idx].value = e.target.files[0].name;
                                    newCreds[idx].fileObj = e.target.files[0];
                                    setCredentials(newCreds);
                                  }
                                }}
                              />
                            </label>
                            <span className="text-xs text-slate-500 truncate max-w-[200px]">{cred.value || 'No file chosen'}</span>
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setCredentials(credentials.filter(c => c.id !== cred.id))}
                        className="text-slate-400 hover:text-rose-500 transition-colors p-2"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                  {credentials.length === 0 && (
                    <div className="text-center py-6 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                      <p className="text-xs text-slate-400 font-medium">No credentials added yet.</p>
                    </div>
                  )}
                </div>

                {/* Motivation to teach */}
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-2">Why is mentorship important to you? (Required)</label>
                  <textarea 
                    value={form.teachingMotivation}
                    onChange={e => setForm({...form, teachingMotivation: e.target.value})}
                    placeholder="Describe your passion for mentorship and what drives you to help others..."
                    className="w-full h-24 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-[1.5rem] px-6 py-4 text-xs font-semibold outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none"
                  />
                </div>

                {/* Expertise Specialties Choose list */}
                <div className="space-y-4 relative">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-2">Course Expertise (Pick at least 1)</label>
                  
                  {/* Selected Chips */}
                  {form.expertiseAreas.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {form.expertiseAreas.map(skill => (
                        <span key={skill} className="px-3 py-1.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-xs font-bold rounded-lg flex items-center gap-2">
                          {skill}
                          <button type="button" onClick={() => toggleExpertise(skill)} className="hover:text-emerald-900 dark:hover:text-emerald-200">
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="relative">
                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="text"
                      value={expertiseSearch}
                      onChange={(e) => { setExpertiseSearch(e.target.value); setShowExpertiseSuggestions(true); }}
                      onFocus={() => setShowExpertiseSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowExpertiseSuggestions(false), 200)}
                      placeholder="Type to search and add expertise areas..."
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                  
                  {showExpertiseSuggestions && expertiseSearch && filteredExpertise.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-h-48 overflow-y-auto">
                      {filteredExpertise.slice(0, 6).map(skill => (
                        <button
                          key={skill}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { toggleExpertise(skill); setExpertiseSearch(''); setShowExpertiseSuggestions(false); }}
                          className="w-full text-left px-5 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors first:rounded-t-2xl last:rounded-b-2xl"
                        >
                          {skill}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Navigation Buttons */}
                <div className="flex gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <Button variant="outline" onClick={() => handleBack('identity')} className="flex-1 h-16 rounded-2xl border-slate-200 dark:border-slate-800 font-bold">Back</Button>
                  <Button 
                    disabled={!form.highestEducation || !form.teachingMotivation || form.expertiseAreas.length === 0}
                    onClick={() => handleNext('preferences')} 
                    className="flex-[2] h-16 rounded-2xl bg-slate-950 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white font-black uppercase tracking-widest shadow-xl disabled:opacity-50"
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
              <PageHeader 
                title="Communication Preferences"
                description="Control what reports and platform analytics digests are delivered to your email."
                tag="SECTION 8"
                icon={Shield}
                className="!mb-4"
              />
              <StepIndicator current={isFastTrack ? 7 : 8} total={isFastTrack ? 8 : 9} />

              <Card className="p-8 md:p-10 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-[2.5rem] space-y-6 shadow-xl">
                
                {/* 1. Newsletter */}
                <label className="flex items-start gap-4 p-5 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-800 rounded-3xl cursor-pointer hover:bg-slate-100/50 transition-all">
                  <input 
                    type="checkbox" 
                    checked={form.optInNewsletters}
                    onChange={e => setForm({...form, optInNewsletters: e.target.checked})}
                    className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 mt-1"
                  />
                  <div>
                    <h4 className="font-bold text-sm text-slate-800 dark:text-white">Tutor Newsletter & Tips</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-1">Receive guidelines on platform changes, course marketing, and early feature access pools.</p>
                  </div>
                </label>

                {/* 2. Feedback summaries */}
                <label className="flex items-start gap-4 p-5 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-800 rounded-3xl cursor-pointer hover:bg-slate-100/50 transition-all">
                  <input 
                    type="checkbox" 
                    checked={form.optInFeedback}
                    onChange={e => setForm({...form, optInFeedback: e.target.checked})}
                    className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 mt-1"
                  />
                  <div>
                    <h4 className="font-bold text-sm text-slate-800 dark:text-white">Student Feedback & Metrics Summaries</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-1">Receive weekly summary indices regarding course star ratings, reviews, and coding exercise completion speeds.</p>
                  </div>
                </label>

                {/* 3. Platform promos */}
                <label className="flex items-start gap-4 p-5 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-800 rounded-3xl cursor-pointer hover:bg-slate-100/50 transition-all">
                  <input 
                    type="checkbox" 
                    checked={form.optInPromotions}
                    onChange={e => setForm({...form, optInPromotions: e.target.checked})}
                    className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 mt-1"
                  />
                  <div>
                    <h4 className="font-bold text-sm text-slate-800 dark:text-white">Platform Deals & Seasonal Promotions</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-1">Incorporate my course in seasonal discounts, black friday sales, and academy bundles.</p>
                  </div>
                </label>

                {/* Navigation Buttons */}
                <div className="flex gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <Button variant="outline" onClick={() => handleBack('qualifications')} className="flex-1 h-16 rounded-2xl border-slate-200 dark:border-slate-800 font-bold">Back</Button>
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
              <PageHeader 
                title="Submission & Audit Review"
                description="Perform a quality check assurance scan and launch your instructor request."
                tag="SECTION 9"
                icon={Shield}
                className="!mb-4"
              />
              <StepIndicator current={isFastTrack ? 8 : 9} total={isFastTrack ? 8 : 9} />

              <Card className="p-8 md:p-10 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-[2.5rem] space-y-6 shadow-xl">
                
                {/* Mentor Profile Recap */}
                <div className="flex items-center gap-6 pb-6 border-b border-slate-100 dark:border-slate-800">
                  <div className="w-14 h-14 bg-gradient-to-br from-emerald-600 to-emerald-400 rounded-xl flex items-center justify-center text-white font-black text-lg flex-shrink-0 shadow-lg">
                    {form.publicName ? form.publicName[0] : 'M'}
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white">{form.publicName || 'Mentor Name'}</h3>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">{form.yearsExp} • {form.highestEducation || 'No Education Specified'}</p>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold mt-1">
                      <Award size={12} /> Expertise: <span className="text-emerald-600 dark:text-emerald-400 font-black">{form.expertiseAreas.slice(0, 3).join(', ') || 'None selected'} {form.expertiseAreas.length > 3 ? '...' : ''}</span>
                    </div>
                  </div>
                </div>

                {/* Timeline info block */}
                <div className="p-6 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-2">
                  <h4 className="font-bold text-xs text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <Clock size={14} className="text-emerald-500" /> Expected Review Timeline
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                    Upon submission, your onboarding parameters and qualifications are sent to the Trileza Quality Review Team. **The verification process takes between 3 to 10 business days.** If changes are required, you will receive a diagnostic checklist directly in your inbox.
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

                {submitError && (
                  <div className="p-4 rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30">
                    <p className="text-sm font-semibold text-red-800 dark:text-red-200">{submitError}</p>
                  </div>
                )}

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
                  <div className="w-24 h-24 rounded-full flex items-center justify-center shadow-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                    <img src="/icon-192.png" alt="Trileza Logo" className="w-16 h-16 object-contain animate-pulse" />
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <h2 className="text-3xl font-black text-slate-800 dark:text-white">Submitting Onboarding Bundle</h2>
                <p className="text-lg text-slate-400 font-medium animate-pulse">Establishing provisional credentials in InsForge cluster...</p>
              </div>
            </div>
          )}

          {step === 'submitted' && (
            <div className="text-center space-y-8 py-16 min-h-[400px] flex flex-col items-center justify-center max-w-xl mx-auto">
              <div className="w-24 h-24 rounded-full bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center">
                <span className="text-5xl" role="img" aria-label="Submitted">📋</span>
              </div>
              <div className="space-y-3">
                <h2 className="text-3xl font-black text-slate-800 dark:text-white">
                  {isRejected ? 'Application not approved' : 'Application submitted'}
                </h2>
                {isRejected ? (
                  <>
                    <p className="text-base text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                      {user?.metadata?.rejection_reason || 'Your application was not approved on this occasion.'}
                    </p>
                    <p className="text-sm text-slate-400 font-semibold">
                      You can address the points above and apply again.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-base text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                      Your mentor application is with our review team. They check identity, qualifications
                      and teaching experience before a profile goes live on the marketplace.
                    </p>
                    <p className="text-sm text-slate-400 font-semibold">
                      You will be notified as soon as it has been assessed. Until then your account stays
                      a learner account, and you can keep using Trileza as normal.
                    </p>
                  </>
                )}
                {submitError && !isRejected && (
                  <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">{submitError}</p>
                )}
              </div>
              <div className="flex flex-wrap gap-3 justify-center">
                {isRejected && (
                  <button
                    onClick={() => { setSubmitError(null); setStep('welcome'); }}
                    className="h-14 px-8 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase text-xs tracking-widest shadow-xl shadow-emerald-600/20 transition-all cursor-pointer"
                  >
                    Apply again
                  </button>
                )}
                <button
                  onClick={() => navigate('/', { replace: true })}
                  className={`h-14 px-8 rounded-2xl font-black uppercase text-xs tracking-widest transition-all cursor-pointer ${
                    isRejected
                      ? 'border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xl shadow-emerald-600/20'
                  }`}
                >
                  Back to Trileza
                </button>
              </div>
            </div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
};

export default Onboarding;
