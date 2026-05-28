import React, { useState, useMemo } from 'react';
import { Card, Button } from '../../components/ui';
import { LoadingOverlay, PageHeader } from '../../components/shared';
import { useAuthStore } from '../../store/authStore';
import { useNavigate } from 'react-router-dom';
import { useCheckout } from '../../lib/services/paystack';
import { nexus } from '../../lib/nexus';
import {
  Search, Star, BookOpen, Users, Clock, Award, Filter,
  ChevronRight, X, CheckCircle2, XCircle, Heart,
  GraduationCap, Sparkles, TrendingUp, Play, Shield,
  CreditCard, Send, AlertCircle, Calendar, Globe,
  Layers, Zap, ArrowRight, BadgeCheck, Lock
} from 'lucide-react';
import { cn, formatCurrency } from '../../utils';
import { Toast } from '../../components/ui/Toast';
import { useCartStore } from '../../store/cartStore';

// ─── MOCK DATA ───────────────────────────────────────────────

interface CourseItem {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  category: string;
  rating: number;
  reviewCount: number;
  enrolledCount: number;
  tutorName: string;
  tutorId?: string;
  tutorSubaccount?: string;
  tutorAvatar: string;
  tutorVerified: boolean;
  pricing: { free: boolean; standard: number; elite: number };
  duration: string;
  modules: number;
  level: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
  learningObjectives: string[];
  featured?: boolean;
  tags: string[];
  language?: string;
  prerequisites?: string[];
  accessPeriod?: string;
  certificationAvailable?: boolean;
  refundPolicy?: string;
  borrowEnabled?: boolean;
}

interface MentorshipProgram {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  mentorName: string;
  mentorId?: string;
  mentorSubaccount?: string;
  mentorAvatar: string;
  mentorBio: string;
  mentorVerified: boolean;
  category: string;
  duration: string;
  maxMentees: number;
  currentMentees: number;
  pricing: { free: boolean; price: number };
  features: string[];
  rating: number;
  reviewCount: number;
  level: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
  cohortStart?: string;
}

interface ApplicationRecord {
  id: string;
  type: 'course' | 'mentorship';
  itemTitle: string;
  itemThumbnail: string;
  appliedAt: string;
  status: 'enrolled' | 'pending_payment' | 'sponsorship_pending' | 'sponsorship_approved' | 'sponsorship_rejected';
  tier?: string;
  amount?: number;
  sponsorMentor?: string;
}

interface SponsorshipRequest {
  id: string;
  menteeId: string;
  menteeName: string;
  menteeAvatar: string;
  courseId: string;
  courseTitle: string;
  courseThumbnail: string;
  amount: number;
  tier: string;
  message: string;
  requestedAt: string;
  status: 'pending' | 'accepted' | 'rejected';
}

const CATEGORIES = ['All', 'Software Engineering', 'AI & Machine Learning', 'UI/UX Design', 'Data Science', 'DevOps', 'Product Management', 'Cybersecurity', 'Mobile Development'];

// Mock data removed. Courses and mentorships are now fetched dynamically from the database.

const AVAILABLE_MENTORS = [
  { id: 'mentor1', name: 'Dr. Amina Hassan', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Amina', specialty: 'AI & Machine Learning' },
  { id: 'mentor2', name: 'Liam Okonkwo', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Liam', specialty: 'UI/UX Design' },
  { id: 'mentor3', name: 'Sarah Obi', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah', specialty: 'Software Engineering' },
  { id: 'mentor4', name: 'James Adeyemi', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=James', specialty: 'DevOps & Cloud' },
];

// ─── HELPER COMPONENTS ───────────────────────────────────────

const StarRating = ({ rating, count }: { rating: number; count: number }) => (
  <div className="flex items-center gap-1.5">
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} size={12} className={cn(i <= Math.floor(rating) ? 'text-amber-400 fill-amber-400' : 'text-slate-200')} />
      ))}
    </div>
    <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{rating.toFixed(1)}</span>
    <span className="text-[10px] text-slate-400">({count.toLocaleString()})</span>
  </div>
);

const LevelBadge = ({ level }: { level: string }) => {
  const colors: Record<string, string> = {
    'Beginner': 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/30',
    'Intermediate': 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/30',
    'Advanced': 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/30',
    'Expert': 'bg-red-50 text-red-700 border-red-100 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/30',
  };
  return (
    <span className={cn("px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border", colors[level] || colors['Beginner'])}>
      {level}
    </span>
  );
};

const PriceBadge = ({ course }: { course: CourseItem }) => {
  if (course.pricing.free) {
    return (
      <div className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-[10px] font-black uppercase tracking-wider">
        <Zap size={10} /> Free
      </div>
    );
  }
  return (
    <div className="text-right">
      <p className="text-sm font-black text-slate-900 dark:text-white">{formatCurrency(course.pricing.standard)}</p>
      <p className="text-[9px] text-slate-400 font-bold">Standard Tier</p>
    </div>
  );
};

// ─── MAIN COMPONENT ──────────────────────────────────────────

const Courses: React.FC = () => {
  const { user } = useAuthStore();
  const userCountry = user?.country || user?.metadata?.mentor_data?.identity?.address?.country;
  const navigate = useNavigate();
  const { addItem } = useCartStore();
  const [activeTab, setActiveTab] = useState<'courses' | 'mentorship' | 'applications'>('courses');
  const [coursesData, setCoursesData] = useState<CourseItem[]>([]);
  const [mentorshipData, setMentorshipData] = useState<MentorshipProgram[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoadingData(true);
        // Fetch courses, profiles, and wallets
        const { data: coursesRows } = await nexus.database.from('courses').select('*');
        const { data: profilesRows } = await nexus.database.from('profiles').select('*');
        const { data: walletsRows } = await nexus.database.from('wallets').select('*');
        const { data: mentorshipRows } = await nexus.database.from('mentorship_programs').select('*');

        const parseJsonArray = (val: any): string[] => {
          if (!val) return [];
          if (Array.isArray(val)) return val;
          if (typeof val === 'string') {
            try { return JSON.parse(val); } catch (e) { return []; }
          }
          return [];
        };

        const getRegionalPrice = (basePrice: number) => {
          if (!userCountry) return basePrice;
          const c = userCountry.trim().toLowerCase();
          if (c.includes('nigeria') || c === 'ng') {
            return basePrice;
          }
          // High cost of living areas scaled up
          if (c.includes('united states') || c.includes('us') || c.includes('united kingdom') || c.includes('uk') || c.includes('canada') || c.includes('europe') || c.includes('germany') || c.includes('france')) {
            return Math.round(basePrice * 1.5);
          }
          // PPP adjustment down
          return Math.round(basePrice * 0.85);
        };

        const mapProfileToCourse = (c: any): CourseItem => {
          const profile = profilesRows?.find(p => p.id === c.tutor_id);
          const wallet = walletsRows?.find(w => w.user_id === c.tutor_id);
          return {
            id: c.id,
            title: c.title,
            description: c.description || '',
            category: c.category || 'Uncategorized',
            rating: c.rating || 0,
            reviewCount: c.review_count || 0,
            enrolledCount: c.enrolled_count || 0,
            duration: c.duration || 'N/A',
            modules: c.modules || 0,
            level: c.level || 'Beginner',
            featured: c.featured || false,
            thumbnail: c.thumbnail_url || '',
            tutorName: profile?.full_name || 'Trileza Tutor',
            tutorId: c.tutor_id,
            tutorSubaccount: wallet?.paystack_subaccount_code,
            tutorAvatar: profile?.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Trileza',
            tutorVerified: profile?.mentor_tier === 'elite',
            pricing: { free: c.price_standard === 0, standard: getRegionalPrice(c.price_standard), elite: getRegionalPrice(c.price_elite) },
            learningObjectives: parseJsonArray(c.learning_objectives),
            tags: parseJsonArray(c.tags),
            language: c.language || 'English',
            prerequisites: parseJsonArray(c.prerequisites),
            accessPeriod: c.access_period || 'Lifetime',
            certificationAvailable: c.certification_available || false,
            refundPolicy: c.refund_policy || 'No refund policy specified.',
            borrowEnabled: c.borrow_enabled || false
          };
        };

        const mapProfileToMentorship = (m: any): MentorshipProgram => {
          const profile = profilesRows?.find(p => p.id === m.mentor_id);
          const wallet = walletsRows?.find(w => w.user_id === m.mentor_id);
          return {
            id: m.id,
            title: m.title,
            description: m.description || '',
            category: m.category || 'Uncategorized',
            rating: m.rating || 0,
            reviewCount: m.review_count || 0,
            duration: m.duration || 'N/A',
            level: m.level || 'Beginner',
            thumbnail: m.thumbnail_url || '',
            mentorName: profile?.full_name || 'Trileza Mentor',
            mentorId: m.mentor_id,
            mentorSubaccount: wallet?.paystack_subaccount_code,
            mentorAvatar: profile?.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Trileza',
            mentorVerified: profile?.mentor_tier === 'elite',
            mentorBio: profile?.bio || 'Experienced Trileza Mentor',
            pricing: { free: m.price === 0, price: getRegionalPrice(m.price) },
            maxMentees: m.max_mentees || 0,
            currentMentees: m.current_mentees || 0,
            cohortStart: m.cohort_start || '',
            features: parseJsonArray(m.features)
          };
        };

        if (coursesRows) setCoursesData(coursesRows.map(mapProfileToCourse));
        if (mentorshipRows) setMentorshipData(mentorshipRows.map(mapProfileToMentorship));
      } catch (e) {
        console.error('Failed to fetch data', e);
      } finally {
        setIsLoadingData(false);
      }
    };
    fetchData();
  }, []);

  const isMentor = user?.metadata?.mentor_onboarded === true;
  const isMentorOnly = isMentor && user?.metadata?.mentee_onboarded !== true;

  // Paystack Hook Integration
  const [paymentTarget, setPaymentTarget] = useState<{ title: string; amount: number; id: string; mentorId?: string; subaccount?: string } | null>(null);
  const [paymentTier, setPaymentTier] = useState<'standard' | 'elite'>('standard');

  const { pay } = useCheckout({
    email: user?.email || 'test@trileza.com',
    amount: paymentTarget?.amount || 0,
    subaccount: paymentTarget?.subaccount, // Enables split payments!
    metadata: {
      type: 'course_purchase',
      student_id: user?.id,
      course_id: paymentTarget?.id,
      mentor_id: paymentTarget?.mentorId,
    },
    onSuccess: (ref) => {
      handleConfirmPayment();
    },
    onClose: () => {
      // User closed the modal
    }
  });

  // State to intercept Mentor-only users to enroll as Mentees first
  const [mentorToMenteeCourse, setMentorToMenteeCourse] = useState<{ id: string; title: string } | null>(null);

  const checkMentorOnlyInterception = (item: { id: string; title: string }) => {
    if (isMentorOnly) {
      setMentorToMenteeCourse(item);
      return true;
    }
    return false;
  };

  // UI State
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<string>('All');
  const [showFreeOnly, setShowFreeOnly] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  // Modal State
  const [selectedCourse, setSelectedCourse] = useState<CourseItem | null>(null);
  const [selectedProgram, setSelectedProgram] = useState<MentorshipProgram | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showSponsorshipModal, setShowSponsorshipModal] = useState(false);

  // Sponsorship State
  const [sponsorMentorId, setSponsorMentorId] = useState('');
  const [sponsorMessage, setSponsorMessage] = useState('');

  // Application records
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);

  // Sponsorship requests (mentor view)
  const [sponsorshipRequests, setSponsorshipRequests] = useState<SponsorshipRequest[]>([]);

  const fetchUserSpecificData = async () => {
    if (!user?.id) return;
    try {
      // Fetch user enrollments/applications
      const { data: enrolls } = await nexus.database.from('enrollments').select('*').eq('user_id', user.id);
      if (enrolls) {
        setApplications(enrolls.map((e: any) => ({
          id: e.id,
          type: e.item_type,
          itemTitle: e.item_title,
          itemThumbnail: e.item_thumbnail || '',
          appliedAt: e.applied_at ? e.applied_at.split('T')[0] : '',
          status: e.status,
          tier: e.tier || undefined, 
          amount: e.amount ? Number(e.amount) : undefined,
          sponsorMentor: e.sponsor_mentor || undefined
        })));
      }

      // Fetch mentor incoming sponsorship requests
      if (isMentor) {
        const { data: sponsorships } = await nexus.database.from('sponsorship_requests').select('*').eq('mentor_id', user.id);
        if (sponsorships) {
          setSponsorshipRequests(sponsorships.map((s: any) => ({
            id: s.id,
            menteeId: s.mentee_id,
            menteeName: 'Mentee', // In a real app we would join with profiles to get the mentee name
            menteeAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Mentee',
            courseId: s.course_id,
            courseTitle: s.course_title,
            courseThumbnail: s.course_thumbnail || '',
            amount: s.amount ? Number(s.amount) : 0,
            tier: s.tier,
            message: s.message || '', 
            requestedAt: s.requested_at ? s.requested_at.split('T')[0] : '',
            status: s.status
          })));
        }
      }
    } catch (e) {
      console.error('Failed to fetch user specific data', e);
    }
  };

  React.useEffect(() => {
    fetchUserSpecificData();
    const handlePaymentSuccess = () => {
      fetchUserSpecificData();
    };
    window.addEventListener('trileza-payment-success', handlePaymentSuccess);
    return () => window.removeEventListener('trileza-payment-success', handlePaymentSuccess);
  }, [user?.id, isMentor]);

  // Favorites
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  const showFeedback = (msg: string, type: 'success' | 'info' = 'success') => setToast({ message: msg, type });

  // Filter Logic
  const filteredCourses = useMemo(() => {
    return coursesData.filter(course => {
      const matchesSearch = course.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            course.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            course.tutorName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = activeCategory === 'All' || course.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, activeCategory, coursesData]);

  const filteredMentorships = useMemo(() => {
    return mentorshipData.filter(program => {
      const matchesSearch = program.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            program.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            program.mentorName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = activeCategory === 'All' || program.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, activeCategory, mentorshipData]);

  const pendingSponsorships = sponsorshipRequests.filter(r => r.status === 'pending').length;

  // ─── HANDLERS ────────────────────────────────────────────────

  const handleEnrollFree = (course: CourseItem) => {
    if (checkMentorOnlyInterception(course)) return;
    addItem({
      id: course.id,
      type: 'course',
      title: course.title,
      thumbnail: course.thumbnail,
      price: 0,
      tier: 'standard',
      tutorName: course.tutorName,
      tutorId: course.tutorId,
      tutorSubaccount: course.tutorSubaccount
    }, user?.id || '');
    setSelectedCourse(null);
  };

  const handleEnrollProgram = (program: MentorshipProgram) => {
    if (checkMentorOnlyInterception(program)) return;
    addItem({
      id: program.id,
      type: 'mentorship',
      title: program.title,
      thumbnail: program.thumbnail,
      price: program.pricing.free ? 0 : program.pricing.price,
      tutorName: program.mentorName,
      tutorId: program.mentorId,
      tutorSubaccount: program.mentorSubaccount
    }, user?.id || '');
    setSelectedProgram(null);
  };

  const handlePayCourse = (tier: 'standard' | 'elite') => {
    if (!selectedCourse) return;
    if (checkMentorOnlyInterception(selectedCourse)) return;
    const amount = tier === 'standard' ? selectedCourse.pricing.standard : selectedCourse.pricing.elite;
    addItem({
      id: selectedCourse.id,
      type: 'course',
      title: selectedCourse.title,
      thumbnail: selectedCourse.thumbnail,
      price: amount,
      tier: tier,
      tutorName: selectedCourse.tutorName,
      tutorId: selectedCourse.tutorId,
      tutorSubaccount: selectedCourse.tutorSubaccount
    }, user?.id || '');
    setSelectedCourse(null);
  };

  const handleConfirmPayment = async () => {
    if (!paymentTarget || !user?.id) return;
    
    // Insert into DB
    await nexus.database.from('enrollments').insert({
      user_id: user.id,
      item_id: paymentTarget.id,
      item_type: 'course',
      item_title: paymentTarget.title,
      item_thumbnail: '',
      status: 'enrolled',
      tier: paymentTier === 'standard' ? 'Standard' : 'Elite',
      amount: paymentTarget.amount
    });

    await fetchUserSpecificData();
    setShowPaymentModal(false);
    setPaymentTarget(null);
    showFeedback(`Payment confirmed! You're now enrolled in "${paymentTarget.title}" 🎉`);
  };

  const handleRequestSponsorship = async () => {
    if (!selectedCourse || !sponsorMentorId || !user?.id) return;
    if (checkMentorOnlyInterception(selectedCourse)) return;
    const mentor = AVAILABLE_MENTORS.find(m => m.id === sponsorMentorId);
    const amount = paymentTier === 'standard' ? selectedCourse.pricing.standard : selectedCourse.pricing.elite;

    // Insert Application pending sponsorship
    await nexus.database.from('enrollments').insert({
      user_id: user.id,
      item_id: selectedCourse.id,
      item_type: 'course',
      item_title: selectedCourse.title,
      item_thumbnail: selectedCourse.thumbnail,
      status: 'sponsorship_pending',
      tier: paymentTier === 'standard' ? 'Standard' : 'Elite',
      amount,
      sponsor_mentor: mentor?.name
    });

    // Insert Sponsorship Request
    await nexus.database.from('sponsorship_requests').insert({
      mentee_id: user.id,
      mentor_id: sponsorMentorId, // Assuming sponsorMentorId is the actual profile ID
      course_id: selectedCourse.id,
      course_title: selectedCourse.title,
      course_thumbnail: selectedCourse.thumbnail,
      amount,
      tier: paymentTier === 'standard' ? 'Standard' : 'Elite',
      message: sponsorMessage,
      status: 'pending'
    });

    await fetchUserSpecificData();
    setShowSponsorshipModal(false);
    setSelectedCourse(null);
    setSponsorMentorId('');
    setSponsorMessage('');
    showFeedback(`Sponsorship request sent to ${mentor?.name}! 🙏`);
  };

  const handleSponsorshipAction = async (requestId: string, action: 'accepted' | 'rejected') => {
    const request = sponsorshipRequests.find(r => r.id === requestId);
    if (!request) return;
    
    // Update the DB
    await nexus.database.from('sponsorship_requests').update({ status: action }).eq('id', requestId);
    
    // Also update the mentee's application status
    const appStatus = action === 'accepted' ? 'sponsorship_approved' : 'sponsorship_rejected';
    await nexus.database.from('enrollments').update({ status: appStatus })
      .eq('user_id', request.menteeId).eq('item_id', request.courseId);

    await fetchUserSpecificData();
    if (action === 'accepted') {
      showFeedback(`Sponsorship approved for ${request.menteeName}! They can now access "${request.courseTitle}" 🎉`);
    } else {
      showFeedback(`Sponsorship request from ${request.menteeName} declined.`, 'info');
    }
  };

  const toggleFavorite = (id: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ─── HERO STATS ──────────────────────────────────────────────
  const totalCourses = coursesData.length + mentorshipData.length;
  const totalEnrolled = coursesData.reduce((sum, c) => sum + c.enrolledCount, 0);
  const totalMentors = new Set([...coursesData.map(c => c.tutorName), ...mentorshipData.map(p => p.mentorName)]).size;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 max-w-7xl mx-auto font-sans">

      {/* ═══════════ HERO BANNER ═══════════ */}
      <PageHeader 
        title={
          <>Level Up Your <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">Skills</span></>
        }
        description="Explore world-class courses and mentorship programs. Learn from verified industry experts, apply for free or paid tracks, and even request sponsorship from your mentors."
        tag="Courses & Programs"
        icon={Sparkles}
        rightContent={
          <div className="grid grid-cols-3 gap-4 lg:gap-6 w-full lg:w-auto shrink-0 mt-6 lg:mt-0">
            {[
              { label: 'Programs', value: totalCourses, icon: BookOpen, color: 'text-emerald-400 bg-emerald-500/10' },
              { label: 'Enrolled', value: `${(totalEnrolled / 1000).toFixed(1)}K`, icon: Users, color: 'text-indigo-400 bg-indigo-500/10' },
              { label: 'Mentors', value: totalMentors, icon: Award, color: 'text-amber-400 bg-amber-500/10' },
            ].map((stat, i) => (
              <div key={i} className="text-center lg:text-left bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4 lg:p-5">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mx-auto lg:mx-0 mb-2", stat.color)}>
                  <stat.icon size={18} />
                </div>
                <p className="text-2xl font-black text-white">{stat.value}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
              </div>
            ))}
          </div>
        }
      />

      {/* ═══════════ SEARCH & FILTER BAR ═══════════ */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="relative flex-1 max-w-lg w-full">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search courses, programs, or skills..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 h-13 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-semibold text-sm text-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm"
          />
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setShowFreeOnly(!showFreeOnly)}
            className={cn(
              "px-4 py-2.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-2",
              showFreeOnly
                ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-400"
                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
            )}
          >
            <Zap size={14} /> Free Only
          </button>

          <select
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value)}
            className="h-11 px-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-bold text-xs text-slate-600 dark:text-slate-400 focus:ring-2 focus:ring-emerald-500/20 transition-all"
          >
            <option value="All">All Levels</option>
            <option value="Beginner">Beginner</option>
            <option value="Intermediate">Intermediate</option>
            <option value="Advanced">Advanced</option>
            <option value="Expert">Expert</option>
          </select>
        </div>
      </div>

      {userCountry && !['nigeria', 'ng'].includes(userCountry.trim().toLowerCase()) && (
        <div className="p-5 bg-gradient-to-r from-emerald-500/10 to-indigo-500/10 border border-emerald-500/20 rounded-[2rem] flex items-center justify-between text-left gap-4 animate-in slide-in-from-top-4 duration-500 shadow-sm backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <Globe className="text-emerald-500 animate-[spin_10s_linear_infinite]" size={24} />
            </div>
            <div>
              <p className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                Purchasing Power Parity (PPP) Active <span className="text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/35">Synced</span>
              </p>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                All course & mentorship prices have been dynamically adjusted for your country: <span className="font-extrabold text-indigo-600 dark:text-indigo-400 underline">{userCountry}</span>.
              </p>
            </div>
          </div>
        </div>
      )}


      {/* ═══════════ TAB NAVIGATION ═══════════ */}
      <div className="flex gap-4 border-b border-slate-200 dark:border-slate-800 overflow-x-auto no-scrollbar pb-2">
        {([
          { id: 'courses', label: '📚 All Courses', count: filteredCourses.length },
          { id: 'mentorship', label: '🧑‍🏫 Mentorship Programs', count: filteredMentorships.length },
          { id: 'applications', label: '📋 My Applications', count: applications.length },
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-6 py-3 rounded-t-xl font-bold capitalize transition-colors whitespace-nowrap flex items-center gap-2",
              activeTab === tab.id
                ? "text-emerald-700 dark:text-emerald-400 border-b-4 border-emerald-600 bg-emerald-50 dark:bg-slate-900/40"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900/20"
            )}
          >
            {tab.label}
            <span className={cn(
              "px-2 py-0.5 rounded-full text-[10px] font-black",
              activeTab === tab.id ? "bg-emerald-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500"
            )}>
              {tab.count}
            </span>
          </button>
        ))}

        {/* Mentor: Sponsorship Requests Badge */}
        {isMentor && pendingSponsorships > 0 && activeTab !== 'applications' && (
          <button
            onClick={() => setActiveTab('applications')}
            className="ml-auto px-4 py-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 text-amber-700 dark:text-amber-400 rounded-xl text-xs font-black flex items-center gap-2 animate-pulse"
          >
            <AlertCircle size={14} /> {pendingSponsorships} Sponsorship Request{pendingSponsorships > 1 ? 's' : ''}
          </button>
        )}
      </div>

      {/* ═══════════ COURSES TAB ═══════════ */}
      {activeTab === 'courses' && (
        <div className="space-y-8 animate-in fade-in duration-500">
          {/* Featured Courses */}
          {filteredCourses.some(c => c.featured) && (
            <div className="space-y-4">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                <TrendingUp size={16} className="text-emerald-600" /> Featured & Trending
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {filteredCourses.filter(c => c.featured).map(course => (
                  <Card
                    key={course.id}
                    className="p-0 overflow-hidden border border-slate-100 dark:border-slate-850 shadow-lg hover:shadow-2xl rounded-[2rem] group transition-all duration-300 cursor-pointer bg-white dark:bg-slate-900/50 relative"
                    onClick={() => setSelectedCourse(course)}
                  >
                    <div className="absolute top-4 left-4 z-20 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[9px] font-black uppercase tracking-widest rounded-full flex items-center gap-1.5 shadow-lg">
                      <Sparkles size={10} /> Featured
                    </div>
                    <div className="h-48 overflow-hidden relative">
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent z-10" />
                      <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                      <div className="absolute bottom-4 left-4 right-4 z-20 flex items-end justify-between">
                        <div className="flex items-center gap-2">
                          <img src={course.tutorAvatar} alt={course.tutorName} className="w-8 h-8 rounded-full border-2 border-white shadow-lg bg-slate-200" />
                          <div>
                            <p className="text-white text-xs font-bold flex items-center gap-1">
                              {course.tutorName}
                              {course.tutorVerified && <BadgeCheck size={12} className="text-emerald-400" />}
                            </p>
                          </div>
                        </div>
                        <PriceBadge course={course} />
                      </div>
                    </div>
                    <div className="p-6 space-y-3 text-left">
                      <div className="flex items-center gap-2 flex-wrap">
                        <LevelBadge level={course.level} />
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 dark:bg-slate-850 px-2 py-1 rounded-md">{course.category}</span>
                      </div>
                      <h4 className="font-black text-lg text-slate-900 dark:text-white leading-snug group-hover:text-emerald-600 transition-colors">{course.title}</h4>
                      <p className="text-slate-500 dark:text-slate-400 text-xs font-medium leading-relaxed line-clamp-2">{course.description}</p>
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                        <StarRating rating={course.rating} count={course.reviewCount} />
                        <div className="flex items-center gap-4 text-[10px] text-slate-500 font-bold">
                          <span className="flex items-center gap-1"><Users size={12} className="text-emerald-500" /> {course.enrolledCount.toLocaleString()}</span>
                          <span className="flex items-center gap-1"><Clock size={12} /> {course.duration}</span>
                          <span className="flex items-center gap-1"><Layers size={12} /> {course.modules} modules</span>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* All Courses Grid */}
          <div className="space-y-4">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
              <BookOpen size={16} className="text-indigo-600" /> All Courses ({filteredCourses.length})
            </h3>

            {filteredCourses.length === 0 ? (
              <Card className="p-12 text-center border-none shadow-md rounded-[2rem]">
                <Search size={48} className="text-slate-200 mx-auto mb-4" />
                <h4 className="font-bold text-slate-900 dark:text-white text-lg mb-2">No courses found</h4>
                <p className="text-slate-500 text-sm">Try adjusting your search or filter criteria</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredCourses.filter(c => !c.featured).map(course => (
                  <Card
                    key={course.id}
                    className="p-0 overflow-hidden border border-slate-100 dark:border-slate-850 shadow-md hover:shadow-xl rounded-2xl group transition-all duration-300 cursor-pointer bg-white dark:bg-slate-900/50 hover:-translate-y-1"
                    onClick={() => setSelectedCourse(course)}
                  >
                    <div className="h-40 overflow-hidden relative">
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/40 to-transparent z-10" />
                      <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleFavorite(course.id); }}
                        className="absolute top-3 right-3 z-20 p-2 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-full hover:bg-white dark:hover:bg-slate-900 transition-colors shadow-md"
                      >
                        <Heart size={14} className={cn(favorites.has(course.id) ? "fill-red-500 text-red-500" : "text-slate-400")} />
                      </button>
                    </div>
                    <div className="p-5 space-y-3 text-left">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <LevelBadge level={course.level} />
                        </div>
                        {course.pricing.free ? (
                          <span className="px-2.5 py-1 bg-emerald-500 text-white rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1"><Zap size={8} /> Free</span>
                        ) : (
                          <span className="text-xs font-black text-slate-900 dark:text-white">{formatCurrency(course.pricing.standard)}</span>
                        )}
                      </div>
                      <h4 className="font-bold text-slate-900 dark:text-white leading-snug group-hover:text-emerald-600 transition-colors text-sm">{course.title}</h4>
                      <div className="flex items-center gap-2">
                        <img src={course.tutorAvatar} alt={course.tutorName} className="w-5 h-5 rounded-full bg-slate-200" />
                        <span className="text-[11px] text-slate-500 font-semibold flex items-center gap-1">
                          {course.tutorName}
                          {course.tutorVerified && <BadgeCheck size={10} className="text-emerald-500" />}
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                        <StarRating rating={course.rating} count={course.reviewCount} />
                        <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1"><Users size={10} /> {course.enrolledCount.toLocaleString()}</span>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════ MENTORSHIP PROGRAMS TAB ═══════════ */}
      {activeTab === 'mentorship' && (
        <div className="space-y-6 animate-in fade-in duration-500">
          {filteredMentorships.length === 0 ? (
            <Card className="p-12 text-center border-none shadow-md rounded-[2rem]">
              <GraduationCap size={48} className="text-slate-200 mx-auto mb-4" />
              <h4 className="font-bold text-slate-900 dark:text-white text-lg mb-2">No programs found</h4>
              <p className="text-slate-500 text-sm">Try adjusting your search or filters</p>
            </Card>
          ) : (
            <div className="space-y-6">
              {filteredMentorships.map(program => (
                <Card
                  key={program.id}
                  className="p-0 overflow-hidden border border-slate-100 dark:border-slate-850 shadow-lg hover:shadow-2xl rounded-[2rem] group transition-all duration-300 bg-white dark:bg-slate-900/50"
                >
                  <div className="flex flex-col lg:flex-row">
                    {/* Image Side */}
                    <div className="lg:w-80 h-56 lg:h-auto overflow-hidden relative shrink-0">
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent to-slate-950/20 z-10 hidden lg:block" />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/30 to-transparent z-10 lg:hidden" />
                      <img src={program.thumbnail} alt={program.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                      {program.cohortStart && (
                        <div className="absolute top-4 left-4 z-20 px-3 py-1.5 bg-slate-950/80 backdrop-blur-md text-white text-[9px] font-black uppercase tracking-wider rounded-full flex items-center gap-1.5 border border-slate-700">
                          <Calendar size={10} className="text-emerald-400" /> Starts {program.cohortStart}
                        </div>
                      )}
                    </div>

                    {/* Content Side */}
                    <div className="flex-1 p-6 lg:p-8 flex flex-col justify-between text-left">
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <LevelBadge level={program.level} />
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 dark:bg-slate-850 px-2 py-1 rounded-md">{program.category}</span>
                          {program.pricing.free && (
                            <span className="px-2.5 py-1 bg-emerald-500 text-white rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1"><Zap size={8} /> Free</span>
                          )}
                        </div>

                        <h3 className="font-black text-xl text-slate-900 dark:text-white leading-snug group-hover:text-emerald-600 transition-colors">{program.title}</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-xs font-medium leading-relaxed">{program.description}</p>

                        {/* Mentor Info */}
                        <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-850/40 rounded-2xl border border-slate-100 dark:border-slate-800">
                          <img src={program.mentorAvatar} alt={program.mentorName} className="w-12 h-12 rounded-xl bg-slate-200 shadow-md" />
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-1.5">
                              {program.mentorName}
                              {program.mentorVerified && <BadgeCheck size={14} className="text-emerald-500" />}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">{program.mentorBio}</p>
                          </div>
                        </div>

                        {/* Features List */}
                        <div className="grid grid-cols-2 gap-2">
                          {program.features.slice(0, 4).map((feature, i) => (
                            <div key={i} className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400 font-semibold">
                              <CheckCircle2 size={12} className="text-emerald-500 shrink-0" /> {feature}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Bottom Bar */}
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-5 mt-5 border-t border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-6">
                          <StarRating rating={program.rating} count={program.reviewCount} />
                          <span className="text-[10px] text-slate-500 font-bold flex items-center gap-1"><Clock size={12} /> {program.duration}</span>
                          <span className="text-[10px] text-slate-500 font-bold flex items-center gap-1"><Users size={12} /> {program.currentMentees}/{program.maxMentees} seats</span>
                        </div>
                        <div className="flex items-center gap-3 w-full sm:w-auto">
                          {!program.pricing.free && (
                            <p className="text-lg font-black text-slate-900 dark:text-white mr-2">{formatCurrency(program.pricing.price)}</p>
                          )}
                          <Button
                            onClick={() => {
                              if (program.currentMentees >= program.maxMentees) {
                                showFeedback('This program is currently full. Please check back later.', 'info');
                              } else {
                                setSelectedProgram(program);
                              }
                            }}
                            className={cn(
                              "flex-1 sm:flex-none rounded-xl font-black uppercase tracking-wider text-[10px] h-11 px-6 border-none transition-all",
                              program.currentMentees >= program.maxMentees
                                ? "bg-slate-200 dark:bg-slate-800 text-slate-500 cursor-not-allowed"
                                : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-500/10"
                            )}
                          >
                            {program.currentMentees >= program.maxMentees ? 'Full' : program.pricing.free ? 'Join Free' : 'Apply Now'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════ MY APPLICATIONS TAB ═══════════ */}
      {activeTab === 'applications' && (
        <div className="space-y-8 animate-in fade-in duration-500">

          {/* Mentor: Incoming Sponsorship Requests */}
          {isMentor && sponsorshipRequests.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                <CreditCard size={16} className="text-amber-600" /> Incoming Sponsorship Requests ({sponsorshipRequests.filter(r => r.status === 'pending').length} pending)
              </h3>

              <div className="space-y-4">
                {sponsorshipRequests.map(request => (
                  <Card
                    key={request.id}
                    className={cn(
                      "p-0 overflow-hidden border shadow-md rounded-2xl transition-all",
                      request.status === 'pending' ? 'border-amber-200 dark:border-amber-900/30 bg-white dark:bg-slate-900/50' :
                      request.status === 'accepted' ? 'border-emerald-200 dark:border-emerald-900/30 bg-emerald-50/30 dark:bg-emerald-950/10' :
                      'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 opacity-70'
                    )}
                  >
                    <div className="flex flex-col md:flex-row">
                      <div className="md:w-48 h-32 md:h-auto overflow-hidden shrink-0 relative">
                        <img src={request.courseThumbnail} alt={request.courseTitle} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 p-5 md:p-6 text-left">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                          <div className="flex-1 space-y-3">
                            <div className="flex items-center gap-3">
                              <img src={request.menteeAvatar} alt={request.menteeName} className="w-10 h-10 rounded-full border-2 border-slate-100 dark:border-slate-800 bg-slate-200" />
                              <div>
                                <p className="font-bold text-slate-900 dark:text-white text-sm">{request.menteeName}</p>
                                <p className="text-[10px] text-slate-400 font-bold">Requested {request.requestedAt}</p>
                              </div>
                              <span className={cn(
                                "px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ml-auto",
                                request.status === 'pending' ? 'bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30' :
                                request.status === 'accepted' ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30' :
                                'bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/30'
                              )}>
                                {request.status}
                              </span>
                            </div>

                            <div className="bg-slate-50 dark:bg-slate-850/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                              <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{request.courseTitle}</p>
                              <p className="text-[10px] text-slate-400 font-semibold">{request.tier} Tier • {formatCurrency(request.amount)}</p>
                            </div>

                            <div className="bg-indigo-50/50 dark:bg-indigo-950/10 p-3 rounded-xl border border-indigo-100/50 dark:border-indigo-900/20">
                              <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium italic">"{request.message}"</p>
                            </div>
                          </div>

                          {request.status === 'pending' && (
                            <div className="flex sm:flex-col gap-2 shrink-0">
                              <Button
                                onClick={() => handleSponsorshipAction(request.id, 'accepted')}
                                className="flex-1 sm:flex-none bg-emerald-600 text-white hover:bg-emerald-700 border-none rounded-xl font-bold text-xs h-10 px-5 shadow-lg shadow-emerald-500/10 flex items-center gap-1.5"
                              >
                                <CheckCircle2 size={14} /> Accept
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => handleSponsorshipAction(request.id, 'rejected')}
                                className="flex-1 sm:flex-none rounded-xl font-bold text-xs h-10 px-5 border-slate-200 dark:border-slate-700 flex items-center gap-1.5"
                              >
                                <XCircle size={14} /> Decline
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* My Enrollments & Applications */}
          <div className="space-y-4">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
              <GraduationCap size={16} className="text-indigo-600" /> My Enrollments & Applications
            </h3>

            {applications.length === 0 ? (
              <Card className="p-12 text-center border-none shadow-md rounded-[2rem]">
                <BookOpen size={48} className="text-slate-200 mx-auto mb-4" />
                <h4 className="font-bold text-slate-900 dark:text-white text-lg mb-2">No applications yet</h4>
                <p className="text-slate-500 text-sm mb-6">Start exploring courses and mentorship programs to begin your learning journey!</p>
                <Button onClick={() => setActiveTab('courses')} className="bg-emerald-600 text-white hover:bg-emerald-700 border-none rounded-xl font-bold">
                  Browse Courses
                </Button>
              </Card>
            ) : (
              <div className="space-y-3">
                {applications.map(app => (
                  <Card key={app.id} className="p-0 overflow-hidden border border-slate-100 dark:border-slate-850 shadow-sm hover:shadow-md rounded-2xl transition-all bg-white dark:bg-slate-900/50">
                    <div className="flex items-center gap-4 p-4 md:p-5">
                      {app.itemThumbnail && (
                        <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-slate-100">
                          <img src={app.itemThumbnail} alt={app.itemTitle} className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0 text-left">
                        <h4 className="font-bold text-slate-900 dark:text-white text-sm truncate">{app.itemTitle}</h4>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{app.type === 'course' ? '📚 Course' : '🧑‍🏫 Program'}</span>
                          {app.tier && <span className="text-[10px] text-slate-400 font-bold">• {app.tier}</span>}
                          {app.amount && <span className="text-[10px] text-slate-500 font-bold">• {formatCurrency(app.amount)}</span>}
                          <span className="text-[10px] text-slate-400">• Applied {app.appliedAt}</span>
                        </div>
                        {app.sponsorMentor && (
                          <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold mt-1 flex items-center gap-1">
                            <Shield size={10} /> Sponsor: {app.sponsorMentor}
                          </p>
                        )}
                      </div>
                      <span className={cn(
                        "px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest whitespace-nowrap shrink-0",
                        app.status === 'enrolled' ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30' :
                        app.status === 'pending_payment' ? 'bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30' :
                        app.status === 'sponsorship_pending' ? 'bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/30' :
                        app.status === 'sponsorship_approved' ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30' :
                        'bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/30'
                      )}>
                        {app.status === 'enrolled' ? '✅ Enrolled' :
                         app.status === 'pending_payment' ? '⏳ Pending Payment' :
                         app.status === 'sponsorship_pending' ? '🙏 Awaiting Sponsor' :
                         app.status === 'sponsorship_approved' ? '✅ Sponsored' :
                         '❌ Rejected'}
                      </span>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════ COURSE DETAIL MODAL ═══════════ */}
      {selectedCourse && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <Card className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-3xl border border-slate-100 dark:border-slate-800 overflow-hidden max-h-[90vh] flex flex-col text-left">
            {/* Modal Header with Image */}
            <div className="relative h-56 shrink-0 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/30 to-transparent z-10" />
              <img src={selectedCourse.thumbnail} alt={selectedCourse.title} className="w-full h-full object-cover" />
              <button
                onClick={() => setSelectedCourse(null)}
                className="absolute top-4 right-4 z-20 p-2.5 bg-slate-950/60 backdrop-blur-sm hover:bg-slate-950/80 rounded-xl text-white transition-all"
              >
                <X size={20} />
              </button>
              <div className="absolute bottom-4 left-6 right-6 z-20">
                <div className="flex items-center gap-2 mb-2">
                  <LevelBadge level={selectedCourse.level} />
                  <span className="text-[9px] font-bold text-white/70 uppercase tracking-wider bg-white/10 backdrop-blur-sm px-2 py-1 rounded-md">{selectedCourse.category}</span>
                </div>
                <h2 className="text-2xl font-black text-white">{selectedCourse.title}</h2>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
              {/* Tutor Info */}
              <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-850/40 rounded-2xl border border-slate-100 dark:border-slate-800">
                <img src={selectedCourse.tutorAvatar} alt={selectedCourse.tutorName} className="w-12 h-12 rounded-xl bg-slate-200 shadow-md" />
                <div className="flex-1">
                  <p className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-1.5">
                    {selectedCourse.tutorName}
                    {selectedCourse.tutorVerified && <BadgeCheck size={14} className="text-emerald-500" />}
                  </p>
                  <p className="text-[11px] text-slate-500 font-medium">Course Instructor</p>
                </div>
                <div className="text-right">
                  <StarRating rating={selectedCourse.rating} count={selectedCourse.reviewCount} />
                </div>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { icon: Users, label: 'Enrolled', value: selectedCourse.enrolledCount.toLocaleString(), color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30' },
                  { icon: Layers, label: 'Modules', value: selectedCourse.modules.toString(), color: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-950/30' },
                  { icon: Clock, label: 'Duration', value: selectedCourse.duration, color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/30' },
                ].map((stat, i) => (
                  <div key={i} className="text-center p-4 rounded-2xl bg-slate-50 dark:bg-slate-850/40 border border-slate-100 dark:border-slate-800">
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center mx-auto mb-2", stat.color)}>
                      <stat.icon size={16} />
                    </div>
                    <p className="text-sm font-black text-slate-900 dark:text-white">{stat.value}</p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{stat.label}</p>
                  </div>
                ))}
              </div>

              {/* Course Metadata Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 dark:bg-slate-850/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Language</p>
                  <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">{selectedCourse.language}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Access</p>
                  <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">{selectedCourse.accessPeriod}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Certificate</p>
                  <p className="text-sm font-bold text-slate-900 dark:text-white mt-1 flex items-center gap-1">
                    {selectedCourse.certificationAvailable ? <><CheckCircle2 size={14} className="text-emerald-500" /> Yes</> : <><X size={14} className="text-slate-400" /> No</>}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Borrow Option</p>
                  <p className="text-sm font-bold text-slate-900 dark:text-white mt-1 flex items-center gap-1">
                    {selectedCourse.borrowEnabled ? <><CheckCircle2 size={14} className="text-emerald-500" /> Yes</> : <><X size={14} className="text-slate-400" /> No</>}
                  </p>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">About this Course</h4>
                <p className="text-sm text-slate-600 dark:text-slate-300 font-medium leading-relaxed">{selectedCourse.description}</p>
              </div>

              {/* Learning Objectives */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">What You'll Learn</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {selectedCourse.learningObjectives.map((obj, i) => (
                    <div key={i} className="flex items-start gap-2.5 p-3 bg-emerald-50/50 dark:bg-emerald-950/10 rounded-xl border border-emerald-100/50 dark:border-emerald-900/20">
                      <CheckCircle2 size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                      <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">{obj}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Prerequisites */}
              {selectedCourse.prerequisites && selectedCourse.prerequisites.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Requirements</h4>
                  <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-300 font-medium space-y-1">
                    {selectedCourse.prerequisites.map((req, i) => (
                      <li key={i}>{req}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Tags */}
              <div className="flex flex-wrap gap-2">
                {selectedCourse.tags.map(tag => (
                  <span key={tag} className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg text-[10px] font-bold">#{tag}</span>
                ))}
              </div>

              {/* Refund Policy */}
              {selectedCourse.refundPolicy && (
                <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 rounded-xl">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 flex items-center gap-1.5 mb-1"><Shield size={12} /> Refund Policy</h4>
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{selectedCourse.refundPolicy}</p>
                </div>
              )}

              {/* Pricing Tiers */}
              {!selectedCourse.pricing.free && (
                <div className="space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Choose Your Plan</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Standard Tier */}
                    <div
                      className={cn(
                        "p-5 rounded-2xl border-2 cursor-pointer transition-all",
                        paymentTier === 'standard' ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/10 shadow-lg shadow-emerald-500/5" : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
                      )}
                      onClick={() => setPaymentTier('standard')}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">Standard</span>
                        <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center", paymentTier === 'standard' ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300')}>
                          {paymentTier === 'standard' && <CheckCircle2 size={12} className="text-white" />}
                        </div>
                      </div>
                      <p className="text-2xl font-black text-slate-900 dark:text-white">{formatCurrency(selectedCourse.pricing.standard)}</p>
                      <ul className="mt-3 space-y-1.5">
                        <li className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5"><CheckCircle2 size={10} className="text-emerald-500" /> Full course access</li>
                        <li className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5"><CheckCircle2 size={10} className="text-emerald-500" /> Community support</li>
                        <li className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5"><CheckCircle2 size={10} className="text-emerald-500" /> Certificate of completion</li>
                      </ul>
                    </div>

                    {/* Elite Tier */}
                    <div
                      className={cn(
                        "p-5 rounded-2xl border-2 cursor-pointer transition-all relative overflow-hidden",
                        paymentTier === 'elite' ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/10 shadow-lg shadow-indigo-500/5" : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
                      )}
                      onClick={() => setPaymentTier('elite')}
                    >
                      <div className="absolute top-0 right-0 px-3 py-1 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-[8px] font-black uppercase tracking-widest rounded-bl-xl">Best Value</div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">Elite</span>
                        <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center", paymentTier === 'elite' ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300')}>
                          {paymentTier === 'elite' && <CheckCircle2 size={12} className="text-white" />}
                        </div>
                      </div>
                      <p className="text-2xl font-black text-slate-900 dark:text-white">{formatCurrency(selectedCourse.pricing.elite)}</p>
                      <ul className="mt-3 space-y-1.5">
                        <li className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5"><CheckCircle2 size={10} className="text-indigo-500" /> Everything in Standard</li>
                        <li className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5"><CheckCircle2 size={10} className="text-indigo-500" /> 1-on-1 mentorship sessions</li>
                        <li className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5"><CheckCircle2 size={10} className="text-indigo-500" /> Career coaching & referrals</li>
                        <li className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5"><CheckCircle2 size={10} className="text-indigo-500" /> Verified certification</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 shrink-0">
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setSelectedCourse(null)}
                  className="flex-none rounded-2xl h-13 px-6 text-xs font-black uppercase tracking-widest border-slate-200 dark:border-slate-700"
                >
                  Close
                </Button>

                {selectedCourse.pricing.free ? (
                  <Button
                    onClick={() => handleEnrollFree(selectedCourse)}
                    className="flex-1 rounded-2xl h-13 font-black uppercase tracking-widest text-xs bg-emerald-600 text-white hover:bg-emerald-700 border-none shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-2"
                  >
                    <Play size={14} /> Enroll for Free
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={() => handlePayCourse(paymentTier)}
                      className="flex-1 rounded-2xl h-13 font-black uppercase tracking-widest text-xs bg-emerald-600 text-white hover:bg-emerald-700 border-none shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-2"
                    >
                      <CreditCard size={14} /> Pay & Enroll
                    </Button>
                    {!isMentor && (
                      <Button
                        onClick={() => {
                          setShowSponsorshipModal(true);
                        }}
                        variant="outline"
                        className="flex-none rounded-2xl h-13 px-5 text-xs font-black uppercase tracking-widest border-indigo-200 dark:border-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 flex items-center gap-2"
                      >
                        <Shield size={14} /> Request Sponsor
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ═══════════ MENTORSHIP PROGRAM DETAIL MODAL ═══════════ */}
      {selectedProgram && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <Card className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-2xl border border-slate-100 dark:border-slate-800 overflow-hidden max-h-[90vh] flex flex-col text-left">
            <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/40 shrink-0">
              <div className="flex items-center gap-3">
                <GraduationCap size={22} className="text-emerald-600" />
                <h2 className="text-xl font-black text-slate-900 dark:text-white">Apply to Program</h2>
              </div>
              <button onClick={() => setSelectedProgram(null)} className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 transition-all">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
              <div className="flex items-center gap-4">
                <img src={selectedProgram.thumbnail} alt={selectedProgram.title} className="w-20 h-20 rounded-2xl object-cover bg-slate-100 shadow-md" />
                <div>
                  <h3 className="font-black text-lg text-slate-900 dark:text-white">{selectedProgram.title}</h3>
                  <p className="text-xs text-slate-500 font-semibold mt-1 flex items-center gap-2">
                    <span className="flex items-center gap-1"><Clock size={12} /> {selectedProgram.duration}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1"><Users size={12} /> {selectedProgram.currentMentees}/{selectedProgram.maxMentees} seats</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-850/40 rounded-2xl border border-slate-100 dark:border-slate-800">
                <img src={selectedProgram.mentorAvatar} alt={selectedProgram.mentorName} className="w-12 h-12 rounded-xl bg-slate-200 shadow-md" />
                <div>
                  <p className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-1.5">
                    {selectedProgram.mentorName}
                    {selectedProgram.mentorVerified && <BadgeCheck size={14} className="text-emerald-500" />}
                  </p>
                  <p className="text-[11px] text-slate-500 font-medium">{selectedProgram.mentorBio}</p>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">What's Included</h4>
                <div className="grid grid-cols-1 gap-2">
                  {selectedProgram.features.map((feature, i) => (
                    <div key={i} className="flex items-center gap-2.5 p-3 bg-emerald-50/50 dark:bg-emerald-950/10 rounded-xl border border-emerald-100/50 dark:border-emerald-900/20">
                      <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                      <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              {!selectedProgram.pricing.free && (
                <div className="p-5 bg-gradient-to-r from-slate-50 to-emerald-50/50 dark:from-slate-850/40 dark:to-emerald-950/10 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Program Investment</p>
                  <p className="text-3xl font-black text-slate-900 dark:text-white">{formatCurrency(selectedProgram.pricing.price)}</p>
                  <p className="text-[10px] text-slate-400 font-bold mt-1">Full program duration • All features included</p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 shrink-0">
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setSelectedProgram(null)} className="flex-none rounded-2xl h-13 px-6 text-xs font-black uppercase tracking-widest border-slate-200 dark:border-slate-700">
                  Cancel
                </Button>
                <Button
                  onClick={() => handleEnrollProgram(selectedProgram)}
                  className="flex-1 rounded-2xl h-13 font-black uppercase tracking-widest text-xs bg-emerald-600 text-white hover:bg-emerald-700 border-none shadow-lg shadow-emerald-500/10"
                >
                  {selectedProgram.pricing.free ? '🎉 Join for Free' : `💳 Pay ${formatCurrency(selectedProgram.pricing.price)} & Join`}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ═══════════ PAYMENT CONFIRMATION MODAL ═══════════ */}
      {showPaymentModal && paymentTarget && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-[110] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <Card className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-md border border-slate-100 dark:border-slate-800 overflow-hidden text-left">
            <div className="p-8 border-b border-slate-100 dark:border-slate-800 text-center bg-slate-50/50 dark:bg-slate-950/40">
              <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-4">
                <CreditCard size={32} />
              </div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">Confirm Payment</h2>
              <p className="text-xs text-slate-400 font-bold mt-1">Secure checkout powered by Paystack</p>
            </div>

            <div className="p-8 space-y-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-850/40 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500 font-bold">Course</span>
                  <span className="text-xs text-slate-900 dark:text-white font-bold text-right max-w-[60%] truncate">{paymentTarget.title}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500 font-bold">Tier</span>
                  <span className="text-xs text-slate-900 dark:text-white font-bold capitalize">{paymentTier}</span>
                </div>
                <div className="h-px bg-slate-200 dark:bg-slate-800" />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-900 dark:text-white font-black">Total</span>
                  <span className="text-xl text-emerald-600 dark:text-emerald-400 font-black">{formatCurrency(paymentTarget.amount)}</span>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex gap-3">
              <Button variant="outline" onClick={() => { setShowPaymentModal(false); setPaymentTarget(null); }} className="flex-1 rounded-2xl h-13 text-xs font-black uppercase tracking-widest border-slate-200 dark:border-slate-700">
                Cancel
              </Button>
              <Button onClick={handleConfirmPayment} className="flex-1 rounded-2xl h-13 font-black uppercase tracking-widest text-xs bg-emerald-600 text-white hover:bg-emerald-700 border-none shadow-lg shadow-emerald-500/10">
                Confirm Payment 🔒
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ═══════════ SPONSORSHIP REQUEST MODAL ═══════════ */}
      {showSponsorshipModal && selectedCourse && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-[110] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <Card className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-lg border border-slate-100 dark:border-slate-800 overflow-hidden text-left">
            <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/40">
              <div className="flex items-center gap-3">
                <Shield size={22} className="text-indigo-600 animate-pulse" />
                <h2 className="text-xl font-black text-slate-900 dark:text-white">Request Sponsorship</h2>
              </div>
              <button onClick={() => { setShowSponsorshipModal(false); setSponsorMentorId(''); setSponsorMessage(''); }} className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 transition-all">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 md:p-8 space-y-6">
              {/* Course Summary */}
              <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-850/40 rounded-2xl border border-slate-100 dark:border-slate-800">
                <img src={selectedCourse.thumbnail} alt={selectedCourse.title} className="w-14 h-14 rounded-xl object-cover bg-slate-100" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-900 dark:text-white text-sm truncate">{selectedCourse.title}</p>
                  <p className="text-[10px] text-slate-400 font-bold">{paymentTier === 'standard' ? 'Standard' : 'Elite'} Tier • {formatCurrency(paymentTier === 'standard' ? selectedCourse.pricing.standard : selectedCourse.pricing.elite)}</p>
                </div>
              </div>

              {/* Select Mentor */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Select a Mentor to Sponsor You</label>
                <div className="space-y-2">
                  {AVAILABLE_MENTORS.map(mentor => (
                    <button
                      key={mentor.id}
                      type="button"
                      onClick={() => setSponsorMentorId(mentor.id)}
                      className={cn(
                        "w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left",
                        sponsorMentorId === mentor.id
                          ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/10 shadow-md"
                          : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                      )}
                    >
                      <img src={mentor.avatar} alt={mentor.name} className="w-10 h-10 rounded-full bg-slate-200" />
                      <div className="flex-1">
                        <p className="font-bold text-slate-900 dark:text-white text-sm">{mentor.name}</p>
                        <p className="text-[10px] text-slate-400 font-bold">{mentor.specialty}</p>
                      </div>
                      <div className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0",
                        sponsorMentorId === mentor.id ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300'
                      )}>
                        {sponsorMentorId === mentor.id && <CheckCircle2 size={12} className="text-white" />}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Personal Message */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Personal Message (Optional)</label>
                <textarea
                  placeholder="Tell your mentor why you'd like them to sponsor this course..."
                  value={sponsorMessage}
                  onChange={(e) => setSponsorMessage(e.target.value)}
                  rows={3}
                  className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 font-semibold text-sm text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
                />
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex gap-3">
              <Button variant="outline" onClick={() => { setShowSponsorshipModal(false); setSponsorMentorId(''); setSponsorMessage(''); }} className="flex-none rounded-2xl h-13 px-6 text-xs font-black uppercase tracking-widest border-slate-200 dark:border-slate-700">
                Cancel
              </Button>
              <Button
                onClick={handleRequestSponsorship}
                disabled={!sponsorMentorId}
                className="flex-1 rounded-2xl h-13 font-black uppercase tracking-widest text-xs bg-indigo-600 text-white hover:bg-indigo-700 border-none shadow-lg shadow-indigo-500/10 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Send size={14} /> Send Sponsorship Request
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ═══════════ MENTOR TO MENTEE ENROLLMENT INTERCEPT MODAL ═══════════ */}
      {mentorToMenteeCourse && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xl z-[120] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="absolute w-[350px] h-[350px] bg-gradient-to-tr from-emerald-500/20 to-teal-500/10 rounded-full blur-[100px] pointer-events-none" />
          
          <Card className="relative bg-slate-900/90 dark:bg-slate-950/90 border border-emerald-500/35 rounded-[3rem] shadow-[0_20px_50px_rgba(16,185,129,0.15)] w-full max-w-lg overflow-hidden text-center p-8 md:p-10 text-white">
            <div className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-12 animate-pulse pointer-events-none" />

            <div className="w-20 h-20 rounded-[2rem] bg-emerald-500/15 border-2 border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/10">
              <GraduationCap size={40} className="animate-bounce text-emerald-450" />
            </div>

            <h2 className="text-2xl md:text-3xl font-black tracking-tight leading-tight mb-3">
              Unlock Your <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-teal-300">Mentee Profile</span>
            </h2>

            <p className="text-slate-300 font-semibold text-sm leading-relaxed mb-6">
              To apply for <span className="text-emerald-400 font-bold">"{mentorToMenteeCourse.title}"</span>, you must enroll as a Mentee.
              <br /><br />
              Since you are already a verified Mentor, we will <span className="text-teal-400 font-bold">Fast-Track</span> your setup and skip personal ID verification, DOB, and security steps. You'll be ready in under 60 seconds!
            </p>

            {/* Quick Benefits Grid */}
            <div className="grid grid-cols-2 gap-3 mb-8 text-left">
              <div className="p-3 bg-white/5 rounded-xl border border-white/5 flex items-center gap-2">
                <CheckCircle2 className="text-emerald-450 shrink-0" size={14} />
                <span className="text-[11px] text-slate-300 font-bold">Details Pre-Filled</span>
              </div>
              <div className="p-3 bg-white/5 rounded-xl border border-white/5 flex items-center gap-2">
                <CheckCircle2 className="text-emerald-450 shrink-0" size={14} />
                <span className="text-[11px] text-slate-300 font-bold">KYC Verification Skipped</span>
              </div>
              <div className="p-3 bg-white/5 rounded-xl border border-white/5 flex items-center gap-2">
                <CheckCircle2 className="text-emerald-450 shrink-0" size={14} />
                <span className="text-[11px] text-slate-300 font-bold">Dual-Role Toggling</span>
              </div>
              <div className="p-3 bg-white/5 rounded-xl border border-white/5 flex items-center gap-2">
                <CheckCircle2 className="text-emerald-450 shrink-0" size={14} />
                <span className="text-[11px] text-slate-300 font-bold">Maintain Mentor Badges</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                variant="outline"
                onClick={() => setMentorToMenteeCourse(null)}
                className="border-slate-800 text-slate-400 hover:text-white hover:bg-slate-850 rounded-2xl h-14 font-bold flex-1"
              >
                Go Back
              </Button>
              <Button
                onClick={() => {
                  const courseId = mentorToMenteeCourse.id;
                  setMentorToMenteeCourse(null);
                  navigate(`/mentee/onboarding?courseId=${courseId}`);
                }}
                className="bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-600 hover:to-teal-500 text-slate-950 font-black uppercase tracking-wider text-xs rounded-2xl h-14 flex-1 shadow-lg shadow-emerald-500/20 active:scale-98 transition-all border-none flex items-center justify-center gap-2"
              >
                Fast-Track Setup <ArrowRight size={14} />
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default Courses;
