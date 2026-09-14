import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSubscriptionStore } from '../../store/subscriptionStore';
import { useAuthStore } from '../../store/authStore';
import { MONETIZATION_TIERS, formatNGN } from '../../lib/monetization/config';
import type { SubscriptionTier, BillingInterval } from '../../lib/monetization/types';
import { calculateProration } from '../../lib/monetization/proration';
import { 
  Check, 
  X, 
  Zap, 
  CreditCard, 
  ArrowRight,
  Loader2,
  Lock,
  AlertCircle,
} from 'lucide-react';
import { Button } from '../ui';
import { upgradeService, PLACEHOLDER_TENANT_ID } from '../../lib/services/upgrade';
import type { Tenant } from '../../types';

export const UpgradeModal: React.FC = () => {
  const navigate = useNavigate();
  const { 
    isUpgradeModalOpen, 
    upgradeModalTargetTier, 
    closeUpgradeModal, 
    tier: currentTier, 
    interval: currentInterval,
    activeSubscription,
    startPaystackSubscription,
    fetchSubscription
  } = useSubscriptionStore();

  const { user } = useAuthStore();
  const [interval, setInterval] = useState<BillingInterval>(currentInterval || 'monthly');
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>('pro');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{
    tierName: string;
    reference: string;
    subdomain?: string;
  } | null>(null);

  // Institutional Step: 'form' | 'payment'
  const [institutionalStep, setInstitutionalStep] = useState<'form' | 'payment'>('form');

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

  useEffect(() => {
    if (upgradeModalTargetTier) {
      setSelectedTier(upgradeModalTargetTier);
      setInstitutionalStep(upgradeModalTargetTier === 'institutional' ? 'form' : 'payment');
    }
  }, [upgradeModalTargetTier, isUpgradeModalOpen]);

  useEffect(() => {
    if (user) {
      setInstForm(prev => ({
        ...prev,
        adminEmail: prev.adminEmail || user.email || '',
        adminName: prev.adminName || user.full_name || ''
      }));
    }
  }, [user]);

  // Calculate proration quote dynamically for the selected target tier and interval
  const proration = useMemo(() => {
    return calculateProration(activeSubscription, selectedTier, interval);
  }, [activeSubscription, selectedTier, interval]);

  if (!isUpgradeModalOpen) return null;

  const targetTierConfig = MONETIZATION_TIERS[selectedTier] || MONETIZATION_TIERS.pro;
  const amountToPay = proration.amountDueToday;

  const handleInstitutionalFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!instForm.institutionName.trim() || !instForm.adminEmail.trim() || !instForm.adminName.trim() || !instForm.phoneNumber.trim()) {
      setErrorMessage('Please fill in all required institution fields.');
      return;
    }
    setErrorMessage(null);
    setInstitutionalStep('payment');
  };

  const handleSubscribe = async () => {
    setIsProcessing(true);
    setErrorMessage(null);

    const email = user?.email || instForm.adminEmail || 'creator@trileza.com';
    const userId = user?.id || `user_${Date.now()}`;
    // An Institutional purchase is recorded against the placeholder tenant and
    // re-pointed when provisioning creates the real one.
    const tenantId = selectedTier === 'institutional'
      ? PLACEHOLDER_TENANT_ID
      : ((user as any)?.tenant_id || PLACEHOLDER_TENANT_ID);

    try {
      // Verify the portal address before charging anyone for it.
      if (selectedTier === 'institutional') {
        const check = await upgradeService.checkSubdomain(instForm.subdomain);
        if (!check.available) {
          setErrorMessage(check.reason || 'That portal address is not available.');
          setIsProcessing(false);
          setInstitutionalStep('form');
          return;
        }
      }

      await startPaystackSubscription({
        tier: selectedTier,
        interval,
        email,
        userId,
        tenantId,
        customAmount: amountToPay,
        onSuccess: async (sub) => {
          try {
            // Provision only after the payment settles.
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
              tierName: targetTierConfig.name,
              reference: sub.paystack_reference || `ref_${Date.now()}`,
              subdomain: createdTenant?.subdomain
            });

            if (user?.id) {
              await fetchSubscription(user.id, createdTenant?.id || tenantId);
            }
          } catch (activationErr: any) {
            console.error('[UpgradeModal] Activation failed after payment:', activationErr);
            setErrorMessage(activationErr?.message || 'Your payment went through but the plan could not be activated. Contact support.');
          } finally {
            setIsProcessing(false);
          }
        },
        onClose: () => {
          setIsProcessing(false);
        }
      });
    } catch (err: any) {
      console.error('[UpgradeModal] Payment error:', err);
      setErrorMessage(err?.message || 'Payment failed. Please try again.');
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-y-auto max-h-[92vh] text-slate-100 font-sans">
        
        {/* Close Button */}
        <button 
          onClick={closeUpgradeModal}
          className="absolute top-5 right-5 p-2 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* ── SUCCESS VIEW ── */}
        {successData ? (
          <div className="text-center py-6 space-y-4 animate-in zoom-in-95">
            <div className="w-16 h-16 bg-emerald-500/20 border-2 border-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
              <Check className="w-8 h-8 text-emerald-400 stroke-[3]" />
            </div>
            <h3 className="text-2xl font-black text-white">Payment Successful!</h3>
            <p className="text-sm text-slate-300 font-medium">
              Plan upgraded to: <strong className="text-emerald-400">{successData.tierName}</strong>
            </p>
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-left text-xs space-y-1.5 text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-500">Reference:</span>
                <span className="font-mono font-bold text-white">{successData.reference}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status:</span>
                <span className="font-bold text-emerald-400">Active in Database</span>
              </div>
            </div>
            <Button
              onClick={() => {
                closeUpgradeModal();
                if (selectedTier === 'institutional' && successData.subdomain) {
                  navigate(`/tenant-admin/${successData.subdomain}`);
                } else {
                  navigate('/');
                }
              }}
              className="w-full h-11 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs shadow-lg shadow-emerald-500/25 cursor-pointer border-none"
            >
              Go to Dashboard <ArrowRight size={15} className="ml-1.5" />
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* Modal Header */}
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center p-1.5 shadow-sm">
                  <img src="/icon-192.png" alt="Trileza Logo" className="w-full h-full object-contain" />
                </div>
                <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
                  Trileza Upgrade Portal
                </span>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-black uppercase tracking-wider mb-2">
                <CreditCard className="w-3.5 h-3.5" />
                Direct Plan Upgrade
              </div>
              <h3 className="text-2xl font-black text-white tracking-tight">
                Upgrade to {targetTierConfig.name}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                {targetTierConfig.tagline}
              </p>
            </div>

            {/* Billing Interval Toggle */}
            <div className="flex items-center justify-between p-2 rounded-2xl bg-slate-950 border border-slate-800 text-xs">
              <span className="font-bold text-slate-300 pl-2">Billing Cycle:</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setInterval('monthly')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                    interval === 'monthly' ? 'bg-emerald-500 text-black shadow-md' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Monthly ({formatNGN(targetTierConfig.pricing.monthly)})
                </button>
                <button
                  type="button"
                  onClick={() => setInterval('yearly')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                    interval === 'yearly' ? 'bg-emerald-500 text-black shadow-md' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Yearly ({formatNGN(targetTierConfig.pricing.yearly)})
                </button>
              </div>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3 rounded-2xl bg-red-500/20 border border-red-500/30 text-red-300 text-xs font-bold flex items-center gap-2">
                <AlertCircle size={15} /> {errorMessage}
              </div>
            )}

            {/* ── INSTITUTIONAL FORM (IF INSTITUTIONAL TIER AND IN FORM STEP) ── */}
            {selectedTier === 'institutional' && institutionalStep === 'form' ? (
              <form onSubmit={handleInstitutionalFormSubmit} className="space-y-4 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block font-bold text-slate-300 mb-1">Institution Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Apex Academy"
                      value={instForm.institutionName}
                      onChange={(e) => {
                        const name = e.target.value;
                        const sub = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 25);
                        setInstForm(p => ({ ...p, institutionName: name, subdomain: sub }));
                      }}
                      className="w-full h-10 px-3 rounded-xl bg-slate-950 border border-slate-700 text-white focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-300 mb-1">Institution Type *</label>
                    <select
                      value={instForm.institutionType}
                      onChange={(e) => setInstForm(p => ({ ...p, institutionType: e.target.value }))}
                      className="w-full h-10 px-3 rounded-xl bg-slate-950 border border-slate-700 text-white focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="University">University</option>
                      <option value="School">School / Academy</option>
                      <option value="Training Provider">Training Provider</option>
                      <option value="Corporate">Corporate</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-300 mb-1">Admin Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="Admin Name"
                      value={instForm.adminName}
                      onChange={(e) => setInstForm(p => ({ ...p, adminName: e.target.value }))}
                      className="w-full h-10 px-3 rounded-xl bg-slate-950 border border-slate-700 text-white focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-300 mb-1">Admin Email *</label>
                    <input
                      type="email"
                      required
                      placeholder="admin@institution.edu"
                      value={instForm.adminEmail}
                      onChange={(e) => setInstForm(p => ({ ...p, adminEmail: e.target.value }))}
                      className="w-full h-10 px-3 rounded-xl bg-slate-950 border border-slate-700 text-white focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-bold text-slate-300 mb-1">Phone Number *</label>
                    <input
                      type="tel"
                      required
                      placeholder="+234 800 000 0000"
                      value={instForm.phoneNumber}
                      onChange={(e) => setInstForm(p => ({ ...p, phoneNumber: e.target.value }))}
                      className="w-full h-10 px-3 rounded-xl bg-slate-950 border border-slate-700 text-white focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">Step 1 of 2</span>
                  <Button
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-6 h-10 rounded-xl cursor-pointer"
                  >
                    Continue to Payment <ArrowRight size={14} className="ml-1.5" />
                  </Button>
                </div>
              </form>
            ) : (
              /* ── PAYMENT SUMMARY & ACTION ── */
              <div className="space-y-4 pt-1">
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-2">
                  <div className="flex justify-between items-center text-slate-400">
                    <span>Plan:</span>
                    <strong className="text-white font-mono">{targetTierConfig.name} ({interval})</strong>
                  </div>
                  <div className="flex justify-between items-center text-slate-400">
                    <span>Amount Due Today:</span>
                    <strong className="text-emerald-400 text-sm font-mono">{formatNGN(amountToPay)}</strong>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-emerald-950/30 border border-emerald-500/20 text-xs text-slate-300 flex items-center gap-2">
                  <Lock size={14} className="text-emerald-400 shrink-0" />
                  <span>256-Bit SSL Encrypted Checkout. Instant activation.</span>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  {selectedTier === 'institutional' && (
                    <Button
                      variant="outline"
                      type="button"
                      onClick={() => setInstitutionalStep('form')}
                      className="border-slate-700 text-slate-300 text-xs h-12 rounded-2xl px-4 cursor-pointer"
                    >
                      ← Back
                    </Button>
                  )}
                  <Button
                    disabled={isProcessing}
                    onClick={handleSubscribe}
                    className="flex-1 h-12 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs sm:text-sm shadow-xl shadow-emerald-500/25 flex items-center justify-center gap-2 cursor-pointer border-none"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 size={16} className="animate-spin" /> Processing Payment...
                      </>
                    ) : (
                      <>
                        <Zap size={16} className="fill-black" /> Pay {formatNGN(amountToPay)}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default UpgradeModal;
