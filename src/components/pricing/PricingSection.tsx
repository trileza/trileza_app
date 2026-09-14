import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSubscriptionStore } from '../../store/subscriptionStore';
import { useAuthStore, resolveActiveRole } from '../../store/authStore';
import { MONETIZATION_TIERS, formatNGN } from '../../lib/monetization/config';
import type { SubscriptionTier, BillingInterval } from '../../lib/monetization/types';
import { 
  Check, 
  X, 
  Sparkles, 
  Zap, 
  Building2, 
  Shield, 
  CreditCard, 
  ArrowDown,
  AlertTriangle
} from 'lucide-react';
import { Button } from '../ui';
import { UpgradeModal } from '../subscription/UpgradeModal';

interface PricingSectionProps {
  id?: string;
  className?: string;
  showComparisonTable?: boolean;
  onSelectTier?: (tier: SubscriptionTier) => void;
}

export const PricingSection: React.FC<PricingSectionProps> = ({
  id = 'pricing',
  className = '',
  showComparisonTable = true,
  onSelectTier
}) => {
  const navigate = useNavigate();
  const { user, activeRole } = useAuthStore();
  const { 
    tier: currentTier, 
    interval: currentInterval, 
    openUpgradeModal,
    startPaystackSubscription,
    downgradeToFreeMentor
  } = useSubscriptionStore();

  const [interval, setInterval] = useState<BillingInterval>('monthly');
  const [showDowngradeConfirm, setShowDowngradeConfirm] = useState(false);
  const [isDowngrading, setIsDowngrading] = useState(false);

  // Determine user's effective role and tier
  const currentRole = activeRole || resolveActiveRole(user) || 'mentee';
  const currentRoleLower = (currentRole as string)?.toLowerCase() || '';
  const isMenteeUser = currentRoleLower === 'mentee';
  
  const userTier = 
    (user?.mentor_tier as string) || 
    (user?.metadata?.mentor_tier as string) || 
    (user?.metadata?.subscription_tier as string) || 
    currentTier || 
    'free';

  const isInstitutionalUser = 
    currentRoleLower === 'management' || 
    currentRoleLower === 'staff' || 
    currentRoleLower === 'tenant_admin' || 
    currentRoleLower === 'institutional' ||
    userTier === 'institutional';

  const isProUser = !isInstitutionalUser && userTier === 'pro';
  const isFreeMentorUser = !isInstitutionalUser && !isProUser && !isMenteeUser;

  const effectiveTier: SubscriptionTier = isInstitutionalUser ? 'institutional' : isProUser ? 'pro' : 'free';

  const handleAction = (tierKey: SubscriptionTier) => {
    if (onSelectTier) {
      onSelectTier(tierKey);
      return;
    }

    if (!user) {
      if (tierKey === 'institutional') {
        navigate(`/checkout?plan=institutional&interval=${interval}`);
      } else if (tierKey === 'free') {
        navigate(`/login?intent=mentor_signup&redirect=/mentor/onboarding`);
      } else {
        navigate(`/login?intent=mentor_signup&redirect=/checkout?plan=${tierKey}&interval=${interval}`);
      }
      return;
    }

    if (tierKey === 'free') {
      navigate('/mentor/onboarding');
      return;
    }

    // Direct routing to the checkout payment page with selected interval
    navigate(`/checkout?plan=${tierKey}&interval=${interval}`);
  };

  const handleDowngrade = async () => {
    if (!user) return;
    setIsDowngrading(true);
    try {
      await downgradeToFreeMentor(user.id);
      setShowDowngradeConfirm(false);
      navigate('/');
    } catch (err) {
      console.error('Downgrade error:', err);
    } finally {
      setIsDowngrading(false);
    }
  };

  return (
    <section id={id} className={`py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto font-sans relative ${className}`}>

      {/* ── Section Header ── */}
      <div className="text-center max-w-3xl mx-auto mb-12">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/25 text-emerald-700 dark:text-emerald-400 text-xs font-black uppercase tracking-widest mb-3.5 shadow-sm">
          <Sparkles className="w-3.5 h-3.5" />
          Transparent Pricing • Non-Progressive Tiers
        </div>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-slate-900 dark:text-white">
          Choose Your Plan on Trileza
        </h2>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mt-3 leading-relaxed">
          From independent educators launching free courses to universities hosting thousands of students. Upgrade or switch plans anytime.
        </p>

        {/* ── Monthly / Yearly Interval Switcher ── */}
        <div className="inline-flex items-center gap-2 p-1.5 rounded-full bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 shadow-inner mt-6">
          <button
            type="button"
            onClick={() => setInterval('monthly')}
            className={`px-5 py-2 rounded-full text-xs font-black transition-all cursor-pointer ${
              interval === 'monthly'
                ? 'bg-emerald-600 dark:bg-emerald-500 text-white dark:text-black shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Monthly Billing
          </button>
          <button
            type="button"
            onClick={() => setInterval('yearly')}
            className={`px-5 py-2 rounded-full text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
              interval === 'yearly'
                ? 'bg-emerald-600 dark:bg-emerald-500 text-white dark:text-black shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>Annual Billing</span>
            <span className="bg-emerald-950 text-emerald-300 dark:bg-black dark:text-emerald-300 text-[10px] px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider">
              Save up to ₦100,000
            </span>
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          3-TIER PRICING CARDS GRID (Always Visible & Beautiful)
         ═══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch mb-16">
        
        {/* ── CARD 1: FREE MENTOR TIER ── */}
        <div className="rounded-3xl p-7 sm:p-8 flex flex-col justify-between border-2 transition-all duration-300 relative bg-white dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 hover:border-amber-500/50 shadow-md hover:shadow-xl">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                {MONETIZATION_TIERS.free.badge}
              </span>
            </div>

            <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-3 flex items-center gap-2">
              <Shield className="w-5 h-5 text-amber-500" />
              {MONETIZATION_TIERS.free.name}
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 min-h-[36px] leading-snug">
              {MONETIZATION_TIERS.free.tagline}
            </p>

            {/* Price tag */}
            <div className="flex items-baseline gap-1.5 my-6 pb-6 border-b border-slate-100 dark:border-slate-800">
              <span className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white">₦0</span>
              <span className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400">/ forever free</span>
            </div>

            {/* Feature List */}
            <ul className="space-y-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300 my-6">
              <li className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
                <span>Publish up to <strong>1 course</strong></span>
              </li>
              <li className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
                <span>Enroll up to <strong>50 students</strong></span>
              </li>
              <li className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
                <span>Basic analytics & student stats</span>
              </li>
              <li className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
                <span>Course Builder & digital wallet</span>
              </li>
              <li className="flex items-center gap-3 text-slate-400 dark:text-slate-500 line-through opacity-70">
                <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center shrink-0">
                  <X className="w-3.5 h-3.5" />
                </div>
                <span>Automated certificate issuance</span>
              </li>
              <li className="flex items-center gap-3 text-slate-400 dark:text-slate-500 line-through opacity-70">
                <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center shrink-0">
                  <X className="w-3.5 h-3.5" />
                </div>
                <span>Multi-instructor team access</span>
              </li>
            </ul>
          </div>

          <Button
            variant="outline"
            onClick={() => handleAction('free')}
            className="w-full h-12 rounded-2xl text-xs font-black uppercase tracking-wider mt-4 cursor-pointer transition-all bg-amber-500 hover:bg-amber-400 text-black border-none shadow-md shadow-amber-500/20 hover:scale-[1.02]"
          >
            Become a Free Mentor
          </Button>
        </div>

        {/* ── CARD 2: MENTOR PRO TIER (Featured) ── */}
        <div className="rounded-3xl p-7 sm:p-8 flex flex-col justify-between border-2 transition-all duration-300 relative bg-gradient-to-b from-emerald-500/[0.04] to-transparent dark:from-emerald-950/20 dark:to-slate-900 shadow-2xl border-emerald-500/80 hover:border-emerald-400 shadow-emerald-500/10">
          {/* Most Popular Floating Pill */}
          <div className="absolute -top-3.5 left-1/2 transform -translate-x-1/2 px-4 py-1 rounded-full bg-emerald-500 text-black text-[11px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/30">
            Most Popular
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                {MONETIZATION_TIERS.pro.badge}
              </span>
            </div>

            <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-3 flex items-center gap-2">
              <Zap className="w-5 h-5 text-emerald-500" />
              {MONETIZATION_TIERS.pro.name}
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 min-h-[36px] leading-snug">
              {MONETIZATION_TIERS.pro.tagline}
            </p>

            {/* Price tag */}
            <div className="flex items-baseline gap-1.5 my-6 pb-6 border-b border-emerald-500/20">
              <span className="text-4xl sm:text-5xl font-black text-emerald-600 dark:text-emerald-400">
                {formatNGN(MONETIZATION_TIERS.pro.pricing[interval])}
              </span>
              <span className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400">
                / {interval === 'yearly' ? 'year' : 'month'}
              </span>
            </div>

            {/* Feature List */}
            <ul className="space-y-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300 my-6">
              <li className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-emerald-500 text-black flex items-center justify-center shrink-0 shadow-sm">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
                <span><strong>Unlimited</strong> course publishing</span>
              </li>
              <li className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-emerald-500 text-black flex items-center justify-center shrink-0 shadow-sm">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
                <span>Up to <strong>500 students</strong> per course</span>
              </li>
              <li className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-emerald-500 text-black flex items-center justify-center shrink-0 shadow-sm">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
                <span><strong>Automated certificate issuance</strong></span>
              </li>
              <li className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-emerald-500 text-black flex items-center justify-center shrink-0 shadow-sm">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
                <span>Advanced completion & drop-off analytics</span>
              </li>
              <li className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-emerald-500 text-black flex items-center justify-center shrink-0 shadow-sm">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
                <span><strong>Earn revenue</strong> from course sales</span>
              </li>
              <li className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-emerald-500 text-black flex items-center justify-center shrink-0 shadow-sm">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
                <span>Priority email & in-app support queue</span>
              </li>
            </ul>
          </div>

          <Button
            onClick={() => handleAction('pro')}
            className="w-full h-12 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 mt-4 cursor-pointer bg-emerald-500 hover:bg-emerald-400 text-black shadow-xl shadow-emerald-500/25 hover:scale-[1.02]"
          >
            <CreditCard className="w-4 h-4" />
            Upgrade to Pro Mentor
          </Button>
        </div>

        {/* ── CARD 3: INSTITUTIONAL TIER (Enterprise) ── */}
        <div className="rounded-3xl p-7 sm:p-8 flex flex-col justify-between border-2 transition-all duration-300 relative bg-white dark:bg-slate-900/80 border-indigo-500/40 hover:border-indigo-500 shadow-md hover:shadow-xl">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30">
                {MONETIZATION_TIERS.institutional.badge}
              </span>
            </div>

            <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-3 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-indigo-500" />
              {MONETIZATION_TIERS.institutional.name}
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 min-h-[36px] leading-snug">
              {MONETIZATION_TIERS.institutional.tagline}
            </p>

            {/* Price tag */}
            <div className="flex items-baseline gap-1.5 my-6 pb-6 border-b border-indigo-500/20">
              <span className="text-4xl sm:text-5xl font-black text-indigo-600 dark:text-indigo-400">
                {formatNGN(MONETIZATION_TIERS.institutional.pricing[interval])}
              </span>
              <span className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400">
                / {interval === 'yearly' ? 'year' : 'month'}
              </span>
            </div>

            {/* Feature List */}
            <ul className="space-y-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300 my-6">
              <li className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-indigo-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
                <span><strong>Everything in Pro Mentor</strong> (Unlimited students)</span>
              </li>
              <li className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-indigo-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
                <span><strong>Multi-instructor</strong> support & role permissions</span>
              </li>
              <li className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-indigo-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
                <span>Custom branding (logo, colors, custom theme)</span>
              </li>
              <li className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-indigo-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
                <span>Dedicated subdomain (<strong>institution.trileza.com</strong>)</span>
              </li>
              <li className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-indigo-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
                <span>Multi-tenant user roster & <strong>bulk CSV import</strong></span>
              </li>
              <li className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-indigo-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
                <span><strong>Dedicated account manager</strong> & SLA support</span>
              </li>
            </ul>
          </div>

          <Button
            onClick={() => handleAction('institutional')}
            className="w-full h-12 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 mt-4 cursor-pointer bg-indigo-600 hover:bg-indigo-500 text-white shadow-xl shadow-indigo-600/25 hover:scale-[1.02]"
          >
            <Building2 className="w-4 h-4" />
            Upgrade to Institutional
          </Button>
        </div>

      </div>

      {/* ── Downgrade / Manage Subscription Bar for Paid Tiers ── */}
      {(isProUser || isInstitutionalUser) && (
        <div className="max-w-4xl mx-auto mb-16 rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-left">
            <ArrowDown className="w-5 h-5 text-slate-400 shrink-0" />
            <div>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Want to downgrade to Free Mentor?
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                You will retain Free Mentor capabilities (1 course, 50 students). No further charges will occur.
              </p>
            </div>
          </div>

          {!showDowngradeConfirm ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDowngradeConfirm(true)}
              className="text-xs font-bold border-slate-300 dark:border-slate-700 hover:border-red-500 hover:text-red-500 rounded-xl shrink-0 cursor-pointer"
            >
              Downgrade to Free
            </Button>
          ) : (
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-red-500 font-bold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                Confirm?
              </span>
              <Button
                size="sm"
                disabled={isDowngrading}
                onClick={handleDowngrade}
                className="text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl cursor-pointer"
              >
                {isDowngrading ? 'Downgrading...' : 'Yes, Downgrade'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDowngradeConfirm(false)}
                className="text-xs font-bold border-slate-300 dark:border-slate-700 rounded-xl cursor-pointer"
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── Detailed Comparison Matrix ── */}
      {showComparisonTable && (
        <div className="mt-16 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-10 shadow-xl">
          <div className="text-center max-w-xl mx-auto mb-8">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white">
              Feature-by-Feature Comparison
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Complete breakdown of permissions and infrastructure limits per plan.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200">
                  <th className="py-4 px-4 font-black">Plan Capabilities</th>
                  <th className="py-4 px-4 font-black text-center text-slate-600 dark:text-slate-400">Free Mentor (₦0)</th>
                  <th className="py-4 px-4 font-black text-center text-emerald-600 dark:text-emerald-400">Pro Mentor (₦10k/mo)</th>
                  <th className="py-4 px-4 font-black text-center text-indigo-600 dark:text-indigo-400">Institutional (₦50k/mo)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-slate-600 dark:text-slate-300">
                <tr>
                  <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">Published Course Limit</td>
                  <td className="py-3.5 px-4 text-center font-bold">1 Course</td>
                  <td className="py-3.5 px-4 text-center font-black text-emerald-500">Unlimited</td>
                  <td className="py-3.5 px-4 text-center font-black text-indigo-400">Unlimited</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">Student Enrollment Cap</td>
                  <td className="py-3.5 px-4 text-center font-bold">50 Students</td>
                  <td className="py-3.5 px-4 text-center font-bold">500 Students / course</td>
                  <td className="py-3.5 px-4 text-center font-black text-indigo-400">Unlimited Students</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">Course Monetization & Sales</td>
                  <td className="py-3.5 px-4 text-center text-slate-400"><X className="w-4 h-4 mx-auto text-slate-400" /></td>
                  <td className="py-3.5 px-4 text-center"><Check className="w-4 h-4 mx-auto text-emerald-500" /></td>
                  <td className="py-3.5 px-4 text-center"><Check className="w-4 h-4 mx-auto text-indigo-400" /></td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">Certificate Issuance</td>
                  <td className="py-3.5 px-4 text-center text-slate-400"><X className="w-4 h-4 mx-auto text-slate-400" /></td>
                  <td className="py-3.5 px-4 text-center"><Check className="w-4 h-4 mx-auto text-emerald-500" /></td>
                  <td className="py-3.5 px-4 text-center"><Check className="w-4 h-4 mx-auto text-indigo-400" /></td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">Advanced Analytics & Retention</td>
                  <td className="py-3.5 px-4 text-center text-slate-400">Basic only</td>
                  <td className="py-3.5 px-4 text-center"><Check className="w-4 h-4 mx-auto text-emerald-500" /></td>
                  <td className="py-3.5 px-4 text-center"><Check className="w-4 h-4 mx-auto text-indigo-400" /></td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">Multi-Instructor Support & Roles</td>
                  <td className="py-3.5 px-4 text-center text-slate-400"><X className="w-4 h-4 mx-auto text-slate-400" /></td>
                  <td className="py-3.5 px-4 text-center text-slate-400"><X className="w-4 h-4 mx-auto text-slate-400" /></td>
                  <td className="py-3.5 px-4 text-center font-black text-indigo-400">Unlimited Instructors</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">Custom Subdomain & Theme Branding</td>
                  <td className="py-3.5 px-4 text-center text-slate-400"><X className="w-4 h-4 mx-auto text-slate-400" /></td>
                  <td className="py-3.5 px-4 text-center text-slate-400"><X className="w-4 h-4 mx-auto text-slate-400" /></td>
                  <td className="py-3.5 px-4 text-center font-mono font-bold text-indigo-400">institution.trileza.com</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">Bulk CSV Student Enrollment</td>
                  <td className="py-3.5 px-4 text-center text-slate-400"><X className="w-4 h-4 mx-auto text-slate-400" /></td>
                  <td className="py-3.5 px-4 text-center text-slate-400"><X className="w-4 h-4 mx-auto text-slate-400" /></td>
                  <td className="py-3.5 px-4 text-center"><Check className="w-4 h-4 mx-auto text-indigo-400" /></td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">Support SLA & Dedicated Desk</td>
                  <td className="py-3.5 px-4 text-center font-medium">Standard</td>
                  <td className="py-3.5 px-4 text-center font-medium text-emerald-500">Priority Queue</td>
                  <td className="py-3.5 px-4 text-center font-bold text-indigo-400">1-Hour SLA + Dedicated Manager</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Upgrade Modal Hook */}
      <UpgradeModal />
    </section>
  );
};
export default PricingSection;
