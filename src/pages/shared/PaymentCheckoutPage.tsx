import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  CheckCircle2, 
  Building2, 
  Zap, 
  Shield, 
  ArrowRight, 
  ArrowLeft, 
  Sparkles, 
  AlertCircle, 
  Globe, 
  Loader2,
  Check
} from 'lucide-react';
import { Button } from '../../components/ui';
import { useAuthStore } from '../../store/authStore';
import { useSubscriptionStore } from '../../store/subscriptionStore';
import { MONETIZATION_TIERS, formatNGN } from '../../lib/monetization/config';
import type { SubscriptionTier, BillingInterval } from '../../lib/monetization/types';
import { calculateProration } from '../../lib/monetization/proration';
import { paystackSubscriptionService } from '../../lib/services/paystackSubscription';
import { upgradeService, PLACEHOLDER_TENANT_ID } from '../../lib/services/upgrade';
import { FormShell } from '../../components/shared';

/** Stages of institutional checkout, rendered inside the form header. */
const CHECKOUT_STEPS = [
  { label: 'Organisation' },
  { label: 'Payment' },
  { label: 'Done' }
];
import type { Tenant } from '../../types';
import { buildTenantUrl } from '../../utils/tenant';

export const PaymentCheckoutPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { 
    tier: currentTier, 
    activeSubscription, 
    fetchSubscription 
  } = useSubscriptionStore();

  const queryPlan = (searchParams.get('plan') as SubscriptionTier) || 'pro';
  const queryInterval = (searchParams.get('interval') as BillingInterval) || 'monthly';

  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>(
    queryPlan === 'institutional' ? 'institutional' : 'pro'
  );
  const [interval, setInterval] = useState<BillingInterval>(
    queryInterval === 'yearly' ? 'yearly' : 'monthly'
  );

  // Flow step: 
  // 'form' (for institutional details) | 'payment' (ready to pay) | 'processing' | 'success'
  const [step, setStep] = useState<'form' | 'payment' | 'processing' | 'success'>(
    selectedTier === 'institutional' ? 'form' : 'payment'
  );

  // Institutional Form State
  const [instForm, setInstForm] = useState({
    institutionName: '',
    institutionType: 'University',
    adminEmail: user?.email || '',
    adminName: user?.full_name || '',
    phoneNumber: '',
    website: '',
    instructorsCount: '5 - 20',
    studentsCount: '100 - 500',
    subdomain: ''
  });

  const [subdomainState, setSubdomainState] = useState<{
    status: 'idle' | 'checking' | 'available' | 'taken';
    reason?: string;
  }>({ status: 'idle' });

  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{
    tierName: string;
    subdomain?: string;
    reference: string;
    amountPaid: number;
  } | null>(null);

  // Auto-sync user details if loaded late
  useEffect(() => {
    if (user) {
      setInstForm(prev => ({
        ...prev,
        adminEmail: prev.adminEmail || user.email || '',
        adminName: prev.adminName || user.full_name || ''
      }));
    }
  }, [user]);

  // Adjust step when tier changes
  const handleTierChange = (newTier: SubscriptionTier) => {
    setSelectedTier(newTier);
    if (newTier === 'institutional') {
      setStep('form');
    } else {
      setStep('payment');
    }
  };

  // Subdomain generation for institutional
  const handleNameChange = (name: string) => {
    const cleanSub = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 25);
    setInstForm(prev => ({
      ...prev,
      institutionName: name,
      subdomain: prev.subdomain ? prev.subdomain : cleanSub
    }));
  };

  const tierConfig = MONETIZATION_TIERS[selectedTier] || MONETIZATION_TIERS.pro;
  const basePrice = tierConfig.pricing[interval];

  // Proration calculation
  const proration = useMemo(() => {
    return calculateProration(activeSubscription, selectedTier, interval);
  }, [activeSubscription, selectedTier, interval]);

  const amountToPay = proration.amountDueToday;

  // Validate Institutional Form
  const validateForm = () => {
    const errs: { [key: string]: string } = {};
    if (!instForm.institutionName.trim()) errs.institutionName = 'Institution name is required';
    if (!instForm.adminEmail.trim() || !instForm.adminEmail.includes('@')) errs.adminEmail = 'Valid email is required';
    if (!instForm.adminName.trim()) errs.adminName = 'Admin name is required';
    if (!instForm.phoneNumber.trim()) errs.phoneNumber = 'Phone number is required';
    if (!instForm.subdomain.trim()) errs.subdomain = 'Choose a portal address';
    else if (subdomainState.status === 'taken') errs.subdomain = subdomainState.reason || 'That address is not available';

    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  /** Checks the portal address as soon as the field loses focus. */
  const checkSubdomainAvailability = async () => {
    const slug = instForm.subdomain.trim();
    if (!slug) { setSubdomainState({ status: 'idle' }); return; }

    setSubdomainState({ status: 'checking' });
    const result = await upgradeService.checkSubdomain(slug);
    setSubdomainState(
      result.available
        ? { status: 'available' }
        : { status: 'taken', reason: result.reason }
    );
  };

  const handleProceedFromForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setStep('payment');
  };

  // Launch Paystack Payment
  const handlePaystackPayment = async () => {
    setIsProcessingPayment(true);
    setPaymentError(null);

    const email = user?.email || instForm.adminEmail || 'customer@trileza.com';
    const userId = user?.id || `usr_${Date.now()}`;
    // An Institutional purchase is recorded against the placeholder tenant and
    // re-pointed when provisioning creates the real one. The previous
    // `t-${subdomain}` id named a tenant that did not exist yet, so the
    // subscription insert failed its foreign key after the customer had paid.
    const tenantId = selectedTier === 'institutional'
      ? PLACEHOLDER_TENANT_ID
      : ((user as any)?.tenant_id || PLACEHOLDER_TENANT_ID);

    try {
      // The portal address is verified before charging, so nobody pays for a
      // subdomain they cannot have.
      if (selectedTier === 'institutional') {
        const check = await upgradeService.checkSubdomain(instForm.subdomain);
        if (!check.available) {
          setPaymentError(check.reason || 'That portal address is not available.');
          setIsProcessingPayment(false);
          setStep('form');
          return;
        }
      }

      await paystackSubscriptionService.startSubscription({
        tier: selectedTier,
        interval,
        email,
        userId,
        tenantId,
        customAmount: amountToPay,
        onSuccess: async (sub) => {
          try {
            // The institution is created only now that payment has settled.
            // Creating it earlier left an orphaned tenant and a permanently
            // claimed subdomain whenever someone abandoned the popup.
            let createdTenant: Tenant | null = null;
            if (selectedTier === 'institutional') {
              createdTenant = await upgradeService.provisionInstitution({
                subscriptionId: sub.id,
                institutionName: instForm.institutionName,
                subdomain: instForm.subdomain,
                adminEmail: instForm.adminEmail,
                website: instForm.website
              });
            }

            // Merges metadata and never grants mentor status — a paid tier and
            // an approved mentor application are separate things.
            const mergedMetadata = await upgradeService.applyTierToProfile({
              userId,
              tier: selectedTier,
              interval,
              tenantId: createdTenant?.id,
              tenantSubdomain: createdTenant?.subdomain,
              institutionName: selectedTier === 'institutional' ? instForm.institutionName : undefined
            });

            useAuthStore.setState((state) => ({
              user: state.user ? { ...state.user, mentor_tier: selectedTier, metadata: mergedMetadata } : state.user
            }));

            if (selectedTier === 'institutional') {
              await useAuthStore.getState().setActiveRole('management');
            }
            useSubscriptionStore.getState().setLocalTier(selectedTier, interval);

            setSuccessData({
              tierName: tierConfig.name,
              subdomain: createdTenant?.subdomain,
              reference: sub.paystack_reference || `ref_${Date.now()}`,
              amountPaid: amountToPay
            });
            setStep('success');

            if (user?.id) {
              await fetchSubscription(user.id, createdTenant?.id || tenantId);
            }
          } catch (activationErr: any) {
            // Payment succeeded; activation did not. Say so precisely, with the
            // reference, rather than implying the charge failed.
            console.error('[PaymentCheckoutPage] Activation failed after payment:', activationErr);
            setPaymentError(activationErr?.message || 'Your payment went through but the plan could not be activated. Contact support.');
            setStep('payment');
          } finally {
            setIsProcessingPayment(false);
          }
        },
        onClose: () => {
          setIsProcessingPayment(false);
        }
      });
    } catch (err: any) {
      console.error('[PaymentCheckoutPage] Payment error:', err);
      setPaymentError(err?.message || 'Payment could not be completed. Please try again.');
      setIsProcessingPayment(false);
    }
  };

  // ═════════════════════════════════════════════════════════════════════════
  // ── CONFIRMATION SUCCESS VIEW
  // ═════════════════════════════════════════════════════════════════════════
  if (step === 'success' && successData) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex items-center justify-center p-4 sm:p-6 font-sans relative overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-gradient-to-tr from-emerald-500/20 to-teal-500/10 rounded-full blur-[130px] pointer-events-none" />
        <div className="max-w-xl w-full bg-white dark:bg-slate-900 border border-emerald-500/40 rounded-3xl p-6 sm:p-10 text-center shadow-2xl shadow-emerald-500/10 relative z-10 overflow-hidden animate-in zoom-in-95 duration-300">
          <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          
          {/* Animated Success Badge */}
          <div className="w-20 h-20 bg-emerald-500/20 border-2 border-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/20">
            <Check className="w-10 h-10 text-emerald-600 dark:text-emerald-400 stroke-[3]" />
          </div>

          <span className="inline-block px-3.5 py-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-xs font-black uppercase tracking-wider mb-2">
            Payment Verified
          </span>

          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight mb-2">
            Payment Successful!
          </h1>

          <p className="text-slate-600 dark:text-slate-300 text-sm sm:text-base font-semibold mb-6">
            Plan upgraded to: <span className="text-emerald-600 dark:text-emerald-400 font-bold">{successData.tierName}</span> ({interval === 'yearly' ? 'Annual Billing' : 'Monthly Billing'})
          </p>

          {/* Receipt Info Box */}
          <div className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 text-left text-xs space-y-2 mb-8">
            <div className="flex justify-between items-center py-1 border-b border-slate-200 dark:border-slate-800/80">
              <span className="text-slate-500 dark:text-slate-400">Transaction Reference:</span>
              <span className="font-mono text-slate-800 dark:text-slate-200 font-bold">{successData.reference}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-200 dark:border-slate-800/80">
              <span className="text-slate-500 dark:text-slate-400">Amount Paid:</span>
              <span className="font-bold text-slate-900 dark:text-white text-sm">{formatNGN(successData.amountPaid)}</span>
            </div>
            {successData.subdomain && (
              <div className="flex justify-between items-center py-1 border-b border-slate-200 dark:border-slate-800/80">
                <span className="text-slate-500 dark:text-slate-400">Institutional Subdomain:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">{successData.subdomain}.trileza.com</span>
              </div>
            )}
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-500 dark:text-slate-400">Status:</span>
              <span className="font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                <CheckCircle2 size={13} /> Active in Database
              </span>
            </div>
          </div>

          {/* Next Steps Box */}
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-500/20 text-left text-xs space-y-1.5 mb-8">
            <p className="font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles size={14} /> Next Steps
            </p>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
              {selectedTier === 'institutional'
                ? 'You are now provisioned as a Tenant Admin! You can invite faculty instructors, bulk enroll students via CSV, configure custom branding, and manage your institution.'
                : 'Your Pro Mentor creator privileges are active immediately. You can now publish unlimited courses, issue certificates, and access real-time creator analytics.'}
            </p>
          </div>

          {/* CTA: Go to Dashboard */}
          <Button
            onClick={() => {
              if (selectedTier === 'institutional') {
                navigate(successData.subdomain ? `/tenant-admin/${successData.subdomain}` : '/');
              } else {
                navigate('/');
              }
            }}
            className="w-full h-12 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-sm shadow-xl shadow-emerald-500/25 transition-all hover:scale-[1.01] flex items-center justify-center gap-2 cursor-pointer border-none"
          >
            Go to Dashboard <ArrowRight size={16} />
          </Button>
        </div>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════
  // ── MAIN CHECKOUT & UPGRADE FLOW
  // ═════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 py-10 px-4 sm:px-6 lg:px-8 font-sans relative overflow-hidden">
      
      {/* Premium Dynamic Neon Backdrops */}
      <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-gradient-to-tr from-emerald-500/15 to-teal-500/10 rounded-full blur-[130px] pointer-events-none animate-pulse duration-[8000ms]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-gradient-to-tr from-indigo-500/15 to-purple-500/10 rounded-full blur-[130px] pointer-events-none animate-pulse duration-[10000ms]" />

      <div className="max-w-4xl mx-auto space-y-8 relative z-10">
        
        {/* ── Header ──
             One band, not three. The brand strip is quiet; the page title is
             the first thing read; the two controls that change the price sit
             with it rather than in their own competing band below. */}
        <header className="space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-9 h-9 rounded-xl bg-surface dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center p-1.5 shrink-0">
                <img src="/icon-192.png" alt="" aria-hidden="true" className="w-full h-full object-contain" />
              </span>
              <span className="font-black text-slate-900 dark:text-white tracking-tight">Trileza</span>
            </div>

            <button
              onClick={() => navigate('/pricing')}
              className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer accent-ring"
            >
              <ArrowLeft size={15} aria-hidden="true" /> Back to pricing
            </button>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 pb-5 border-b border-slate-200 dark:border-slate-800">
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white text-balance">
                Complete your upgrade
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {tierConfig.name} · {interval === 'yearly' ? 'billed annually' : 'billed monthly'} · {formatNGN(amountToPay)}
              </p>
            </div>

            {/* Plan and billing cycle — the two things that change the figure above. */}
            <div className="flex flex-wrap items-center gap-2">
              <div
                role="group"
                aria-label="Choose a plan"
                className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold"
              >
                {([
                  { id: 'pro' as const, label: 'Pro Mentor', Icon: Zap },
                  { id: 'institutional' as const, label: 'Institutional', Icon: Building2 }
                ]).map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleTierChange(id)}
                    aria-pressed={selectedTier === id}
                    className={`px-3.5 py-2 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 accent-ring ${
                      selectedTier === id
                        ? 'bg-brand-primary text-white shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Icon size={13} aria-hidden="true" /> {label}
                  </button>
                ))}
              </div>

              <div
                role="group"
                aria-label="Choose a billing cycle"
                className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold"
              >
                {([
                  { id: 'monthly' as const, label: 'Monthly' },
                  { id: 'yearly' as const, label: 'Annual' }
                ]).map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setInterval(id)}
                    aria-pressed={interval === id}
                    className={`px-3.5 py-2 rounded-lg transition-all cursor-pointer flex items-center gap-2 accent-ring ${
                      interval === id
                        ? 'bg-brand-primary text-white shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {label}
                    {id === 'yearly' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-light text-brand-dark font-black">
                        Save {selectedTier === 'institutional' ? '₦100k' : '₦20k'}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </header>

        {/* ── STEP 1: INSTITUTIONAL FORM (IF INSTITUTIONAL TIER) ── */}
        {selectedTier === 'institutional' && step === 'form' && (
          <FormShell
            eyebrow="Multi-tenant setup"
            title="Set up your institution"
            description="Your dedicated portal and admin account are provisioned as soon as payment clears."
            icon={Building2}
            steps={CHECKOUT_STEPS}
            currentStep={1}
            className="animate-in fade-in duration-300"
          >
            <form onSubmit={handleProceedFromForm} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Institution Name */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Institution Name <span className="text-emerald-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Apex University"
                    value={instForm.institutionName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    className="w-full h-12 px-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm font-medium focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-1 focus:ring-emerald-500/50 focus:outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
                  />
                  {formErrors.institutionName && <p className="text-[11px] text-red-500 mt-1">{formErrors.institutionName}</p>}
                </div>

                {/* Institution Type */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Institution Type <span className="text-emerald-500">*</span>
                  </label>
                  <select
                    value={instForm.institutionType}
                    onChange={(e) => setInstForm(prev => ({ ...prev, institutionType: e.target.value }))}
                    className="w-full h-12 px-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm font-medium focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-1 focus:ring-emerald-500/50 focus:outline-none transition-all cursor-pointer"
                  >
                    <option value="University">University / Higher Education</option>
                    <option value="School">K-12 School / Academy</option>
                    <option value="Training Provider">Professional Training Provider</option>
                    <option value="Corporate">Corporate Academy / Enterprise</option>
                    <option value="Non-Profit">Non-Profit / NGO Institute</option>
                  </select>
                </div>

                {/* Admin Full Name */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Admin Full Name <span className="text-emerald-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dr. David Ileza"
                    value={instForm.adminName}
                    onChange={(e) => setInstForm(prev => ({ ...prev, adminName: e.target.value }))}
                    className="w-full h-12 px-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm font-medium focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-1 focus:ring-emerald-500/50 focus:outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
                  />
                  {formErrors.adminName && <p className="text-[11px] text-red-500 mt-1">{formErrors.adminName}</p>}
                </div>

                {/* Admin Email */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Admin Email Address <span className="text-emerald-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="admin@institution.edu"
                    value={instForm.adminEmail}
                    onChange={(e) => setInstForm(prev => ({ ...prev, adminEmail: e.target.value }))}
                    className="w-full h-12 px-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm font-medium focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-1 focus:ring-emerald-500/50 focus:outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
                  />
                  {formErrors.adminEmail && <p className="text-[11px] text-red-500 mt-1">{formErrors.adminEmail}</p>}
                </div>

                {/* Phone Number */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Phone Number <span className="text-emerald-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="+234 800 000 0000"
                    value={instForm.phoneNumber}
                    onChange={(e) => setInstForm(prev => ({ ...prev, phoneNumber: e.target.value }))}
                    className="w-full h-12 px-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm font-medium focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-1 focus:ring-emerald-500/50 focus:outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
                  />
                  {formErrors.phoneNumber && <p className="text-[11px] text-red-500 mt-1">{formErrors.phoneNumber}</p>}
                </div>

                {/* Website (Optional) */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Website (Optional)
                  </label>
                  <input
                    type="url"
                    placeholder="https://institution.edu"
                    value={instForm.website}
                    onChange={(e) => setInstForm(prev => ({ ...prev, website: e.target.value }))}
                    className="w-full h-12 px-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm font-medium focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-1 focus:ring-emerald-500/50 focus:outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
                  />
                </div>

                {/* Estimated Instructors */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Estimated Instructors / Faculty
                  </label>
                  <select
                    value={instForm.instructorsCount}
                    onChange={(e) => setInstForm(prev => ({ ...prev, instructorsCount: e.target.value }))}
                    className="w-full h-12 px-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm font-medium focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-1 focus:ring-emerald-500/50 focus:outline-none transition-all cursor-pointer"
                  >
                    <option value="1 - 5">1 - 5 Instructors</option>
                    <option value="5 - 20">5 - 20 Instructors</option>
                    <option value="20 - 50">20 - 50 Instructors</option>
                    <option value="50+">50+ Enterprise Faculty</option>
                  </select>
                </div>

                {/* Estimated Students */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Estimated Students / Learners
                  </label>
                  <select
                    value={instForm.studentsCount}
                    onChange={(e) => setInstForm(prev => ({ ...prev, studentsCount: e.target.value }))}
                    className="w-full h-12 px-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm font-medium focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-1 focus:ring-emerald-500/50 focus:outline-none transition-all cursor-pointer"
                  >
                    <option value="50 - 200">50 - 200 Students</option>
                    <option value="200 - 1,000">200 - 1,000 Students</option>
                    <option value="1,000 - 5,000">1,000 - 5,000 Students</option>
                    <option value="5,000+">5,000+ Students</option>
                  </select>
                </div>
              </div>

              {/* Portal address — editable, and checked before payment */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Portal Address <span className="text-emerald-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus-within:border-emerald-500 transition-all overflow-hidden">
                    <Globe size={16} className="ml-4 text-slate-400 flex-none" />
                    <input
                      type="text"
                      required
                      value={instForm.subdomain}
                      onChange={(e) => {
                        const slug = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
                        setInstForm(prev => ({ ...prev, subdomain: slug }));
                        setSubdomainState({ status: 'idle' });
                      }}
                      onBlur={checkSubdomainAvailability}
                      placeholder="apex-university"
                      className="flex-1 h-12 px-3 bg-transparent text-slate-900 dark:text-white text-xs sm:text-sm font-mono font-bold focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-600 min-w-0"
                    />
                    <span className="pr-4 text-xs sm:text-sm font-mono font-bold text-slate-400 flex-none">.trileza.com</span>
                  </div>
                </div>

                {subdomainState.status === 'checking' && (
                  <p className="text-[11px] text-slate-400 mt-1 font-semibold">Checking availability…</p>
                )}
                {subdomainState.status === 'available' && (
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-bold">
                    {instForm.subdomain}.trileza.com is available.
                  </p>
                )}
                {subdomainState.status === 'taken' && (
                  <p className="text-[11px] text-red-500 mt-1 font-bold">{subdomainState.reason}</p>
                )}
                {formErrors.subdomain && subdomainState.status === 'idle' && (
                  <p className="text-[11px] text-red-500 mt-1">{formErrors.subdomain}</p>
                )}
              </div>

              {/* Submit to Payment Button */}
              <div className="pt-4 flex justify-end">
                <Button
                  type="submit"
                  className="bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs sm:text-sm px-8 h-12 rounded-2xl shadow-xl shadow-emerald-500/25 flex items-center gap-2 cursor-pointer border-none transition-all hover:scale-[1.01]"
                >
                  Proceed to Payment ({formatNGN(amountToPay)}) <ArrowRight size={16} />
                </Button>
              </div>
            </form>
          </FormShell>
        )}

        {/* ── STEP 2: PAYMENT OVERVIEW & PAYSTACK DEMO CHECKOUT ── */}
        {(selectedTier === 'pro' || (selectedTier === 'institutional' && step === 'payment')) && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Left 2 Cols: Order Summary & Payment Action */}
            <div className="md:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/50 dark:shadow-none space-y-6">
              <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white">Payment Method & Checkout</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Pay securely with Debit/Credit Card, Bank Transfer, or USSD.
                </p>
              </div>

              {/* Secure Activation Badge */}
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-500/30 flex items-start gap-3 text-xs">
                <Shield className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-black text-emerald-900 dark:text-emerald-300 uppercase tracking-wider">Instant & Automated Activation</h4>
                  <p className="text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed font-medium">
                    Secure payment checkout with instant verification. All tier features and quotas will be unlocked immediately upon confirmation.
                  </p>
                </div>
              </div>

              {/* Customer Details Box */}
              <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-xs space-y-2">
                <h4 className="font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider text-[11px]">Subscriber Information</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700 dark:text-slate-300">
                  <div>
                    <span className="text-slate-400 dark:text-slate-500">Name: </span>
                    <strong className="text-slate-900 dark:text-white">{user?.full_name || instForm.adminName || 'LMS Creator'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-slate-500">Email: </span>
                    <strong className="text-slate-900 dark:text-white">{user?.email || instForm.adminEmail || 'creator@trileza.com'}</strong>
                  </div>
                </div>
              </div>

              {/* Error Display */}
              {paymentError && (
                <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-300 text-xs font-bold flex items-center gap-2">
                  <AlertCircle size={15} /> {paymentError}
                </div>
              )}

              {/* Pay Action Buttons */}
              <div className="pt-2 space-y-3">
                <Button
                  disabled={isProcessingPayment}
                  onClick={handlePaystackPayment}
                  className="w-full h-14 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-sm sm:text-base shadow-xl shadow-emerald-500/25 transition-all hover:scale-[1.01] flex items-center justify-center gap-2.5 cursor-pointer border-none"
                >
                  {isProcessingPayment ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Processing Payment...
                    </>
                  ) : (
                    <>
                      <Zap size={18} className="fill-black" />
                      Pay {formatNGN(amountToPay)}
                    </>
                  )}
                </Button>

                {selectedTier === 'institutional' && (
                  <button
                    type="button"
                    onClick={() => setStep('form')}
                    className="w-full text-center text-xs font-bold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer py-1"
                  >
                    ← Edit Institution Details
                  </button>
                )}
              </div>
            </div>

            {/* Right 1 Col: Summary Invoice */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xl shadow-slate-200/50 dark:shadow-none space-y-5 h-fit">
              <h3 className="font-extrabold text-slate-900 dark:text-white text-base">Order Summary</h3>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {selectedTier === 'institutional' ? <Building2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> : <Zap className="w-4 h-4 text-amber-500" />}
                    <span className="font-bold text-slate-900 dark:text-white text-xs">{tierConfig.name}</span>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {interval}
                  </span>
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  {tierConfig.tagline}
                </p>

                <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80 flex items-baseline justify-between">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Plan Rate</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">{formatNGN(basePrice)}</span>
                </div>

                {proration.unusedCredit > 0 && (
                  <div className="flex items-baseline justify-between text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                    <span>Proration Credit</span>
                    <span className="font-mono">- {formatNGN(proration.unusedCredit)}</span>
                  </div>
                )}
              </div>

              {/* Total Due */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-baseline justify-between">
                <div>
                  <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider block">Total Due Today</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">Renews at {formatNGN(basePrice)}/{interval === 'yearly' ? 'yr' : 'mo'}</span>
                </div>
                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                  {formatNGN(amountToPay)}
                </span>
              </div>

              {/* Features Included List */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
                <span className="text-[11px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">Features Unlocked:</span>
                <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                  {selectedTier === 'institutional' ? (
                    <>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 size={13} className="text-emerald-500 shrink-0" /> Multi-Instructor Faculty Support
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 size={13} className="text-emerald-500 shrink-0" /> Custom Subdomain & Branding
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 size={13} className="text-emerald-500 shrink-0" /> Bulk Student CSV Import
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 size={13} className="text-emerald-500 shrink-0" /> SLA & Dedicated Manager
                      </li>
                    </>
                  ) : (
                    <>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 size={13} className="text-emerald-500 shrink-0" /> Unlimited Course Slots
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 size={13} className="text-emerald-500 shrink-0" /> Up to 500 Students per Course
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 size={13} className="text-emerald-500 shrink-0" /> Automated Certificate Issuance
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 size={13} className="text-emerald-500 shrink-0" /> Priority Creator Support
                      </li>
                    </>
                  )}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentCheckoutPage;
