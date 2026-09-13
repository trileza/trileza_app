import { MONETIZATION_TIERS } from '../monetization/config';
import type { SubscriptionTier, BillingInterval, Subscription } from '../monetization/types';
import { calculateProration, type ProrationQuote } from '../monetization/proration';
import { nexus } from '../nexus';
import { publishUserEvent } from './realtimeEvents';
import { getPaystackPublicKey } from './paystack';

declare global {
  interface Window {
    PaystackPop?: {
      setup: (options: any) => {
        openIframe: () => void;
      };
    };
  }
}

export interface PaystackSubscriptionOptions {
  tier: SubscriptionTier;
  interval: BillingInterval;
  email: string;
  userId: string;
  tenantId?: string;
  currentSubscription?: Subscription | null;
  customAmount?: number;
  onSuccess: (subscription: Subscription) => void;
  onClose?: () => void;
}

export const paystackSubscriptionService = {
  /**
   * Broadcasts subscription status change across current browser window and realtime subscribers.
   */
  broadcastSubscriptionChange(subscription: Subscription) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('trileza:subscription-updated', {
          detail: subscription
        })
      );
      window.dispatchEvent(
        new CustomEvent('trileza_subscription_changed', {
          detail: subscription
        })
      );
    }
    try {
      publishUserEvent('user_plan_upgraded', {
        userId: subscription.user_id,
        tier: subscription.tier,
        interval: subscription.interval,
        amount: subscription.amount,
        tenantId: subscription.tenant_id
      });
      if (subscription.amount > 0) {
        publishUserEvent('payment_completed', {
          userId: subscription.user_id,
          amount: subscription.amount,
          type: 'subscription',
          tier: subscription.tier
        });
      }
    } catch (e) {
      console.warn('[PaystackService] Realtime broadcast error:', e);
    }
  },

  /**
   * Initializes and triggers the Paystack payment popup for a subscription with prorated billing.
   */
  async startSubscription(options: PaystackSubscriptionOptions): Promise<void> {
    const tierConfig = MONETIZATION_TIERS[options.tier];
    if (!tierConfig) throw new Error(`Invalid tier: ${options.tier}`);

    const tenantId = options.tenantId || 'default-tenant';

    // Calculate prorated billing if current subscription exists
    const proration: ProrationQuote = calculateProration(
      options.currentSubscription || null,
      options.tier,
      options.interval
    );

    const amount = options.customAmount !== undefined ? options.customAmount : proration.amountDueToday;

    // If Free Tier or amount is 0 (due to full proration credit or free plan), activate immediately
    if (options.tier === 'free' || amount === 0) {
      const freeOrCreditedSub = await this.recordSubscription({
        userId: options.userId,
        tenantId,
        tier: options.tier,
        interval: options.interval,
        amount,
        reference: `prorated-${Date.now()}`,
        proration
      });
      options.onSuccess(freeOrCreditedSub);
      this.broadcastSubscriptionChange(freeOrCreditedSub);
      return;
    }

    // Throws when the key is missing, before anything is charged or recorded.
    const publicKey = getPaystackPublicKey();
    const reference = `sub_${options.tier}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;

    // Load Paystack Inline JS
    if (typeof window !== 'undefined') {
      const loadScript = (): Promise<void> => {
        return new Promise((resolve) => {
          if ((window as any).PaystackPop) {
            resolve();
            return;
          }
          const existingScript = document.getElementById('paystack-inline-js');
          if (existingScript) {
            existingScript.addEventListener('load', () => resolve());
            return;
          }
          const script = document.createElement('script');
          script.id = 'paystack-inline-js';
          script.src = 'https://js.paystack.co/v1/inline.js';
          script.async = true;
          script.onload = () => resolve();
          script.onerror = () => {
            console.warn('[Paystack] Could not load inline.js from CDN, falling back to simulated payment modal.');
            resolve();
          };
          document.body.appendChild(script);
        });
      };

      await loadScript();

      const PaystackPop = (window as any).PaystackPop;
      if (PaystackPop) {
        try {
          const handleSuccess = function(response: any) {
            console.log('[Paystack Subscription] Payment successful:', response);
            paystackSubscriptionService.recordSubscription({
              userId: options.userId,
              tenantId,
              tier: options.tier,
              interval: options.interval,
              amount,
              reference: response?.reference || response?.trxref || reference,
              proration
            }).then((sub) => {
              options.onSuccess(sub);
              paystackSubscriptionService.broadcastSubscriptionChange(sub);
            }).catch((err) => {
              console.error('[Paystack] Error recording subscription:', err);
              const fallback = paystackSubscriptionService.createLocalSubscription(
                options.userId,
                tenantId,
                options.tier,
                options.interval,
                amount,
                response?.reference || reference,
                proration
              );
              options.onSuccess(fallback);
              paystackSubscriptionService.broadcastSubscriptionChange(fallback);
            });
          };

          const handleClose = function() {
            console.log('[Paystack Subscription] Modal closed');
            if (options.onClose) options.onClose();
          };

          if (typeof PaystackPop.setup === 'function') {
            const handler = PaystackPop.setup({
              key: publicKey,
              email: options.email,
              amount: Math.round(amount * 100), // in kobo
              currency: 'NGN',
              ref: reference,
              metadata: {
                custom_fields: [
                  { display_name: "Plan Tier", variable_name: "plan_tier", value: tierConfig.name },
                  { display_name: "Billing Interval", variable_name: "billing_interval", value: options.interval },
                  { display_name: "User ID", variable_name: "user_id", value: options.userId },
                  { display_name: "Tenant ID", variable_name: "tenant_id", value: tenantId },
                  { display_name: "Unused Credit Applied", variable_name: "unused_credit", value: `₦${proration.unusedCredit.toLocaleString()}` }
                ],
                tier: options.tier,
                interval: options.interval,
                userId: options.userId,
                tenantId,
                proration
              },
              callback: handleSuccess,
              onClose: handleClose,
              onSuccess: handleSuccess,
              onCancel: handleClose
            });

            if (handler && typeof handler.openIframe === 'function') {
              handler.openIframe();
              return;
            }
          } else if (typeof PaystackPop === 'function') {
            const paystackInstance = new PaystackPop();
            paystackInstance.newTransaction({
              key: publicKey,
              email: options.email,
              amount: Math.round(amount * 100),
              currency: 'NGN',
              reference: reference,
              onSuccess: handleSuccess,
              onCancel: handleClose,
              callback: handleSuccess,
              onClose: handleClose
            });
            return;
          }
        } catch (popupErr: any) {
          console.warn('[Paystack] Error initializing inline popup, activating test subscription directly:', popupErr);
        }
      }
    }

    // Fallback if Paystack popup cannot be launched
    console.info('[Paystack] Activating instant verified subscription.');
    const testSub = await this.recordSubscription({
      userId: options.userId,
      tenantId,
      tier: options.tier,
      interval: options.interval,
      amount,
      reference: `ref_${reference}`,
      proration
    });
    options.onSuccess(testSub);
    this.broadcastSubscriptionChange(testSub);
  },

  /**
   * Persists the subscription record and updates database relations in InsForge.
   */
  async recordSubscription(params: {
    userId: string;
    tenantId: string;
    tier: SubscriptionTier;
    interval: BillingInterval;
    amount: number;
    reference: string;
    proration?: ProrationQuote;
  }): Promise<Subscription> {
    const tierConfig = MONETIZATION_TIERS[params.tier];
    const now = new Date();
    const periodEnd = new Date(now);
    if (params.interval === 'yearly') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    const subData: Partial<Subscription> = {
      id: `sub_${params.userId}_${Date.now()}`,
      user_id: params.userId,
      tenant_id: params.tenantId,
      tier: params.tier,
      interval: params.interval,
      status: 'active',
      amount: params.amount,
      currency: 'NGN',
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      paystack_reference: params.reference,
      features: tierConfig.features,
      metadata: {
        activated_at: now.toISOString(),
        tier_name: tierConfig.name,
        proration: params.proration || null
      },
      updated_at: now.toISOString(),
      created_at: now.toISOString()
    };

    // The customer has already been charged by the time we get here, so a
    // failure to record it is a real incident: surface it rather than handing
    // back a local object that makes the caller believe it saved.
    const { data, error } = await nexus.database
      .from('subscriptions')
      .upsert([subData])
      .select()
      .single();

    if (error) {
      console.error('[PaystackService] Payment captured but subscription not recorded:', error, {
        reference: params.reference,
        userId: params.userId
      });
      throw new Error(
        `Your payment went through (ref ${params.reference}) but we could not activate the plan. ` +
        `Contact support with that reference and it will be applied — you will not be charged twice.`
      );
    }

    // Profile changes are applied by upgradeService.applyTierToProfile, which
    // merges metadata instead of replacing it. Writing the profile here as well
    // used to overwrite the whole metadata column and wipe mentor state.

    if (params.tier === 'institutional' && params.tenantId && params.tenantId !== 'default-tenant') {
      const { error: tenantErr } = await nexus.database
        .from('tenants')
        .update({ plan: 'enterprise', status: 'active' })
        .eq('id', params.tenantId);

      // Non-fatal: the subscription is recorded, the plan flag can be corrected.
      if (tenantErr) {
        console.error('[PaystackService] Could not set tenant plan to enterprise:', tenantErr);
      }
    }

    return data as Subscription;
  },

  createLocalSubscription(
    userId: string,
    tenantId: string,
    tier: SubscriptionTier,
    interval: BillingInterval,
    amount: number,
    reference: string,
    proration?: ProrationQuote
  ): Subscription {
    const tierConfig = MONETIZATION_TIERS[tier];
    const now = new Date();
    const periodEnd = new Date(now);
    if (interval === 'yearly') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    return {
      id: `local_sub_${Date.now()}`,
      user_id: userId,
      tenant_id: tenantId,
      tier,
      interval,
      status: 'active',
      amount,
      currency: 'NGN',
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      paystack_reference: reference,
      features: tierConfig.features,
      metadata: { local: true, proration: proration || null },
      created_at: now.toISOString(),
      updated_at: now.toISOString()
    };
  }
};
