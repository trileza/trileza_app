import React, { useState } from 'react';
import { useSubscriptionStore } from '../../store/subscriptionStore';
import { MONETIZATION_TIERS, formatNGN } from '../../lib/monetization/config';
import { TierBadge } from './FeatureGate';
import { 
  X, 
  CreditCard, 
  Calendar, 
  CheckCircle2, 
  ArrowUpRight,
  Shield,
  Clock,
  Zap,
  Building2,
} from 'lucide-react';
import { Button } from '../ui';

interface SubscriptionManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SubscriptionManagementModal: React.FC<SubscriptionManagementModalProps> = ({
  isOpen,
  onClose
}) => {
  const { 
    tier, 
    interval, 
    status, 
    activeSubscription, 
    cancelSubscription, 
    openUpgradeModal,
    isLoading 
  } = useSubscriptionStore();

  const [confirmCancel, setConfirmCancel] = useState(false);
  const tierConfig = MONETIZATION_TIERS[tier] || MONETIZATION_TIERS.free;

  if (!isOpen) return null;

  const currentPrice = tierConfig.pricing[interval || 'monthly'];
  const renewalDate = activeSubscription?.current_period_end
    ? new Date(activeSubscription.current_period_end).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })
    : 'N/A';

  const handleCancel = async () => {
    await cancelSubscription();
    setConfirmCancel(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-slate-100 font-sans">
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-extrabold text-white">Subscription & Billing Management</h3>
            <p className="text-xs text-slate-400">Manage your active LMS tier, proration credit, and billing renewal</p>
          </div>
        </div>

        {/* Active Plan Card */}
        <div className="p-5 rounded-2xl bg-slate-800/50 border border-slate-700/60 mb-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active LMS Plan</span>
              <div className="flex items-center gap-2">
                <h4 className="text-lg font-black text-white">{tierConfig.name}</h4>
                <TierBadge tier={tier} size="sm" />
              </div>
            </div>

            <div className="text-right">
              <span className="text-xl font-black text-emerald-400">
                {currentPrice === 0 ? 'Free (₦0)' : formatNGN(currentPrice)}
              </span>
              <span className="text-xs text-slate-400 block">
                / {interval === 'yearly' ? 'year' : 'month'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-700/50 text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <Clock className="w-4 h-4 text-emerald-400" />
              <span>Status: <strong className="text-emerald-400 uppercase font-black">{status}</strong></span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span>Next Renewal: <strong className="text-white">{renewalDate}</strong></span>
            </div>
          </div>
        </div>

        {/* Plan Features Included */}
        <div className="mb-6 space-y-2">
          <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Tier Capabilities:</h5>
          <ul className="space-y-2 text-xs text-slate-300 bg-slate-950/40 p-4 rounded-xl border border-slate-800">
            {tierConfig.highlights.map((item, idx) => (
              <li key={idx} className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <Button
            onClick={() => {
              onClose();
              openUpgradeModal(tier === 'free' ? 'pro' : 'institutional');
            }}
            className="w-full h-12 rounded-xl text-xs font-black bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Zap className="w-4 h-4" />
            {tier === 'institutional' ? 'Switch Billing Interval / Plan' : 'Upgrade Plan / Prorated Billing'}
            <ArrowUpRight className="w-4 h-4" />
          </Button>

          {tier === 'pro' && (
            <Button
              onClick={() => {
                onClose();
                openUpgradeModal('institutional');
              }}
              className="w-full h-12 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Building2 className="w-4 h-4" />
              Upgrade to Institutional Tier (₦50,000/mo)
              <ArrowUpRight className="w-4 h-4" />
            </Button>
          )}

          {tier !== 'free' && !confirmCancel && (
            <button
              onClick={() => setConfirmCancel(true)}
              className="w-full text-center text-xs text-rose-400 hover:text-rose-300 py-2 transition-colors cursor-pointer"
            >
              Cancel Subscription (Revert to Free)
            </button>
          )}

          {confirmCancel && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs space-y-2 text-center animate-in fade-in">
              <p>Are you sure you want to cancel your {tierConfig.name}? You will revert to the Free tier (1 course, 50 students) at the end of your billing cycle.</p>
              <div className="flex items-center justify-center gap-3 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirmCancel(false)}
                  className="border-slate-700 text-xs"
                >
                  Keep My Plan
                </Button>
                <Button
                  size="sm"
                  disabled={isLoading}
                  onClick={handleCancel}
                  className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold"
                >
                  Confirm Cancellation
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Security Note */}
        <div className="mt-6 pt-3 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-slate-400" />
          <span>PCI-DSS Level 1 Certified • Instant Automatic Sync</span>
        </div>

      </div>
    </div>
  );
};
