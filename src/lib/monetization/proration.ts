import { MONETIZATION_TIERS } from './config';
import type { Subscription, SubscriptionTier, BillingInterval } from './types';

export interface ProrationQuote {
  currentTier: SubscriptionTier;
  targetTier: SubscriptionTier;
  currentInterval: BillingInterval;
  targetInterval: BillingInterval;
  oldPlanPrice: number;
  newPlanPrice: number;
  daysRemaining: number;
  totalDaysInPeriod: number;
  unusedCredit: number;
  amountDueToday: number;
  isUpgrade: boolean;
  isDowngrade: boolean;
  isIntervalChange: boolean;
  isImmediate: boolean;
  nextRenewalDate: string;
  formattedSummary: string;
}

/**
 * Calculates prorated billing amounts for switching between LMS subscription tiers or billing intervals.
 */
export function calculateProration(
  currentSub: Subscription | null,
  targetTier: SubscriptionTier,
  targetInterval: BillingInterval
): ProrationQuote {
  const currentTier = currentSub?.tier || 'free';
  const currentInterval = currentSub?.interval || 'monthly';

  const currentTierConfig = MONETIZATION_TIERS[currentTier] || MONETIZATION_TIERS.free;
  const targetTierConfig = MONETIZATION_TIERS[targetTier] || MONETIZATION_TIERS.free;

  const oldPlanPrice = currentSub?.amount ?? currentTierConfig.pricing[currentInterval];
  const newPlanPrice = targetTierConfig.pricing[targetInterval];

  const tierWeight: Record<SubscriptionTier, number> = {
    free: 0,
    pro: 1,
    institutional: 2
  };

  const isUpgrade = tierWeight[targetTier] > tierWeight[currentTier];
  const isDowngrade = tierWeight[targetTier] < tierWeight[currentTier];
  const isIntervalChange = currentTier === targetTier && currentInterval !== targetInterval;

  const now = new Date();
  let daysRemaining = 0;
  let totalDaysInPeriod = currentInterval === 'yearly' ? 365 : 30;

  if (currentSub?.current_period_end && currentSub.tier !== 'free') {
    const end = new Date(currentSub.current_period_end);
    const start = currentSub.current_period_start ? new Date(currentSub.current_period_start) : now;
    
    totalDaysInPeriod = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    const diffMs = end.getTime() - now.getTime();
    daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  }

  // Calculate unused credit from the current period
  let unusedCredit = 0;
  if (oldPlanPrice > 0 && daysRemaining > 0 && totalDaysInPeriod > 0) {
    const dailyRate = oldPlanPrice / totalDaysInPeriod;
    unusedCredit = Math.min(oldPlanPrice, Math.round(dailyRate * daysRemaining));
  }

  // Next renewal date
  const renewalDate = new Date(now);
  if (targetInterval === 'yearly') {
    renewalDate.setFullYear(renewalDate.getFullYear() + 1);
  } else {
    renewalDate.setMonth(renewalDate.getMonth() + 1);
  }

  let amountDueToday = newPlanPrice;
  let formattedSummary = '';

  if (targetTier === 'free') {
    amountDueToday = 0;
    formattedSummary = 'Your current plan will remain active until the end of your billing cycle, after which it will revert to Free.';
  } else if (isUpgrade) {
    amountDueToday = Math.max(0, newPlanPrice - unusedCredit);
    if (unusedCredit > 0) {
      formattedSummary = `Upgrading immediately. Applied ₦${unusedCredit.toLocaleString()} prorated credit from your unused days.`;
    } else {
      formattedSummary = `Upgrading to ${targetTierConfig.name}. Instant activation with immediate feature unlock.`;
    }
  } else if (isDowngrade) {
    amountDueToday = 0;
    formattedSummary = `Downgrade scheduled. You maintain access to ${currentTierConfig.name} until ${currentSub?.current_period_end ? new Date(currentSub.current_period_end).toLocaleDateString() : 'the end of current period'}, then transition to ${targetTierConfig.name}.`;
  } else if (isIntervalChange) {
    amountDueToday = Math.max(0, newPlanPrice - unusedCredit);
    formattedSummary = `Switched to ${targetInterval} billing. ₦${unusedCredit.toLocaleString()} credit applied.`;
  } else {
    amountDueToday = newPlanPrice;
    formattedSummary = `Renewing ${targetTierConfig.name} at ₦${newPlanPrice.toLocaleString()} / ${targetInterval}.`;
  }

  return {
    currentTier,
    targetTier,
    currentInterval,
    targetInterval,
    oldPlanPrice,
    newPlanPrice,
    daysRemaining,
    totalDaysInPeriod,
    unusedCredit,
    amountDueToday,
    isUpgrade,
    isDowngrade,
    isIntervalChange,
    isImmediate: isUpgrade || targetTier === 'free' || currentTier === 'free',
    nextRenewalDate: renewalDate.toISOString(),
    formattedSummary
  };
}
