import React from 'react';
import { useSubscriptionStore } from '../../store/subscriptionStore';
import type { FeatureFlagKey, SubscriptionTier } from '../../lib/monetization/types';
import { Lock, Sparkles, Shield, ArrowUpRight } from 'lucide-react';
import { Button } from '../ui';

interface FeatureGateProps {
  feature: FeatureFlagKey;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showUpgradePrompt?: boolean;
  promptTitle?: string;
  promptDescription?: string;
}

export const FeatureGate: React.FC<FeatureGateProps> = ({
  feature,
  children,
  fallback,
  showUpgradePrompt = true,
  promptTitle,
  promptDescription
}) => {
  const { checkFeature, openUpgradeModal, tier } = useSubscriptionStore();
  const hasAccess = checkFeature(feature);

  if (hasAccess) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (!showUpgradePrompt) {
    return null;
  }

  const isInstitutionalFeature = [
    'has_multi_instructor',
    'has_custom_branding',
    'has_custom_subdomain',
    'has_bulk_enrollment',
    'has_sla_support'
  ].includes(feature);

  const targetTier = isInstitutionalFeature ? 'institutional' : 'pro';

  return (
    <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-slate-900/60 dark:bg-black/60 p-6 backdrop-blur-xl text-center shadow-xl">
      <div className="absolute top-0 right-0 transform translate-x-4 -translate-y-4 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
      
      <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto mb-3 border border-emerald-500/20 shadow-inner">
        <Lock className="w-6 h-6" />
      </div>

      <h4 className="text-base font-bold text-white mb-1">
        {promptTitle || (isInstitutionalFeature ? 'Institutional Plan Feature' : 'Pro Plan Feature')}
      </h4>

      <p className="text-xs text-slate-400 max-w-md mx-auto mb-4 leading-relaxed">
        {promptDescription || (
          isInstitutionalFeature 
            ? 'Unlock multi-instructor management, custom branding, subdomain integration, and bulk CSV enrollment with the Institutional tier.'
            : 'Upgrade to Trileza Pro to unlock unlimited courses, certificate issuance, and advanced performance analytics.'
        )}
      </p>

      <Button
        onClick={() => openUpgradeModal(targetTier)}
        className="bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs px-5 py-2.5 rounded-xl shadow-lg shadow-emerald-500/20 hover:scale-[1.02] transition-all inline-flex items-center gap-1.5"
      >
        <Sparkles className="w-3.5 h-3.5" />
        Upgrade to {targetTier === 'institutional' ? 'Institutional (₦50k/mo)' : 'Pro (₦10k/mo)'}
        <ArrowUpRight className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
};

export const TierBadge: React.FC<{ tier: SubscriptionTier; className?: string; size?: 'sm' | 'md' }> = ({
  tier,
  className = '',
  size = 'md'
}) => {
  const isSm = size === 'sm';

  if (tier === 'institutional') {
    return (
      <span className={`inline-flex items-center gap-1 font-extrabold uppercase tracking-wider rounded-full bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-pink-500/20 text-indigo-400 border border-indigo-500/30 ${isSm ? 'text-[9px] px-2 py-0.5' : 'text-[10px] px-2.5 py-1'} ${className}`}>
        <Shield className={isSm ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
        Institutional
      </span>
    );
  }

  if (tier === 'pro') {
    return (
      <span className={`inline-flex items-center gap-1 font-extrabold uppercase tracking-wider rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 ${isSm ? 'text-[9px] px-2 py-0.5' : 'text-[10px] px-2.5 py-1'} ${className}`}>
        <Sparkles className={isSm ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
        Pro Plan
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 font-bold uppercase tracking-wider rounded-full bg-slate-800/60 text-slate-400 border border-slate-700/60 ${isSm ? 'text-[9px] px-2 py-0.5' : 'text-[10px] px-2.5 py-1'} ${className}`}>
      Free Plan
    </span>
  );
};
