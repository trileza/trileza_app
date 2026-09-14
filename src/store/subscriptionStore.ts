import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { 
  Subscription, 
  SubscriptionTier, 
  BillingInterval, 
  SubscriptionStatus, 
  SubscriptionUsage,
  FeatureFlagKey,
  TierDefinition
} from '../lib/monetization/types';
import { 
  MONETIZATION_TIERS, 
  FREE_TIER_FEATURES, 
} from '../lib/monetization/config';
import { paystackSubscriptionService } from '../lib/services/paystackSubscription';
import { calculateProration, type ProrationQuote } from '../lib/monetization/proration';
import { nexus } from '../lib/nexus';

interface SubscriptionState {
  activeSubscription: Subscription | null;
  tier: SubscriptionTier;
  interval: BillingInterval;
  status: SubscriptionStatus;
  usage: SubscriptionUsage;
  tiersCatalog: Record<SubscriptionTier, TierDefinition>;
  isLoading: boolean;
  isUpgradeModalOpen: boolean;
  upgradeModalTargetTier: SubscriptionTier | null;
  error: string | null;

  // Store Actions
  fetchPricingCatalog: () => Promise<void>;
  fetchSubscription: (userId: string, tenantId?: string) => Promise<void>;
  getProrationQuote: (targetTier: SubscriptionTier, targetInterval: BillingInterval) => ProrationQuote;
  startPaystackSubscription: (params: {
    tier: SubscriptionTier;
    interval: BillingInterval;
    email: string;
    userId: string;
    tenantId?: string;
    customAmount?: number;
    onSuccess?: (sub: Subscription) => void;
    onClose?: () => void;
  }) => Promise<void>;
  cancelSubscription: () => Promise<void>;
  downgradeToFreeMentor: (userId: string) => Promise<void>;
  syncUsage: (userId: string) => Promise<void>;
  setLocalTier: (tier: SubscriptionTier, interval?: BillingInterval) => void;
  /** Clears persisted plan state. Must run on sign-out. */
  resetSubscription: () => void;
  openUpgradeModal: (targetTier?: SubscriptionTier) => void;
  closeUpgradeModal: () => void;

  // Feature Gate Checkers
  canPublishCourse: (customCourseCount?: number) => { allowed: boolean; current: number; max: number; reason?: string };
  canEnrollStudent: (customStudentCount?: number) => { allowed: boolean; current: number; max: number; reason?: string };
  checkFeature: (feature: FeatureFlagKey) => boolean;
  isPro: () => boolean;
  isInstitutional: () => boolean;
  isFree: () => boolean;
}

const DEFAULT_FREE_SUBSCRIPTION: Subscription = {
  id: 'sub_default_free',
  user_id: '',
  tenant_id: 'default-tenant',
  tier: 'free',
  interval: 'monthly',
  status: 'active',
  amount: 0,
  currency: 'NGN',
  current_period_start: new Date().toISOString(),
  features: FREE_TIER_FEATURES,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

export const useSubscriptionStore = create<SubscriptionState>()(
  persist(
    (set, get) => ({
      activeSubscription: DEFAULT_FREE_SUBSCRIPTION,
      tier: 'free',
      interval: 'monthly',
      status: 'active',
      tiersCatalog: MONETIZATION_TIERS,
      usage: {
        published_courses_count: 0,
        total_students_enrolled: 0,
        active_instructors_count: 1
      },
      isLoading: false,
      isUpgradeModalOpen: false,
      upgradeModalTargetTier: null,
      error: null,

      fetchPricingCatalog: async () => {
        try {
          const { data, error } = await nexus.database
            .from('pricing_tiers')
            .select('*');

          if (!error && data && data.length > 0) {
            const updatedCatalog: Record<SubscriptionTier, TierDefinition> = { ...MONETIZATION_TIERS };
            data.forEach((row: any) => {
              const tierId = row.id as SubscriptionTier;
              if (tierId) {
                updatedCatalog[tierId] = {
                  id: tierId,
                  name: row.name || MONETIZATION_TIERS[tierId]?.name,
                  badge: row.badge || MONETIZATION_TIERS[tierId]?.badge,
                  tagline: row.tagline || MONETIZATION_TIERS[tierId]?.tagline,
                  pricing: {
                    monthly: Number(row.price_monthly ?? MONETIZATION_TIERS[tierId]?.pricing.monthly),
                    yearly: Number(row.price_yearly ?? MONETIZATION_TIERS[tierId]?.pricing.yearly)
                  },
                  features: row.features || MONETIZATION_TIERS[tierId]?.features,
                  highlights: row.highlights || MONETIZATION_TIERS[tierId]?.highlights,
                  ctaLabel: row.cta_label || MONETIZATION_TIERS[tierId]?.ctaLabel,
                  popular: row.is_popular
                };
              }
            });
            set({ tiersCatalog: updatedCatalog });
          }
        } catch (err) {
          console.warn('[SubscriptionStore] Catalog fetch fallback:', err);
        }
      },

      fetchSubscription: async (userId: string, tenantId = 'default-tenant') => {
        if (!userId) return;
        set({ isLoading: true, error: null });

        try {
          // 0. Sync dynamic pricing catalogue
          await get().fetchPricingCatalog();

          // 1. Fetch active subscription from DB
          const { data, error } = await nexus.database
            .from('subscriptions')
            .select('*')
            .eq('user_id', userId)
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          const catalog = get().tiersCatalog;

          if (!error && data) {
            const sub = data as Subscription;
            const tierConfig = catalog[sub.tier] || MONETIZATION_TIERS[sub.tier] || MONETIZATION_TIERS.free;
            set({
              activeSubscription: {
                ...sub,
                features: tierConfig.features
              },
              tier: sub.tier || 'free',
              interval: sub.interval || 'monthly',
              status: sub.status || 'active'
            });
          } else {
            // Check if profile metadata has tier info
            const { data: profile } = await nexus.database
              .from('profiles')
              .select('metadata, tenant_id')
              .eq('id', userId)
              .maybeSingle();

            if (profile?.metadata?.subscription_tier) {
              const metaTier = profile.metadata.subscription_tier as SubscriptionTier;
              const metaInterval = (profile.metadata.subscription_interval as BillingInterval) || 'monthly';
              const tierConfig = catalog[metaTier] || MONETIZATION_TIERS[metaTier] || MONETIZATION_TIERS.free;

              const fallbackSub: Subscription = {
                id: `meta_sub_${userId}`,
                user_id: userId,
                tenant_id: profile.tenant_id || tenantId,
                tier: metaTier,
                interval: metaInterval,
                status: 'active',
                amount: tierConfig.pricing[metaInterval],
                currency: 'NGN',
                current_period_start: new Date().toISOString(),
                features: tierConfig.features,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              };

              set({
                activeSubscription: fallbackSub,
                tier: metaTier,
                interval: metaInterval,
                status: 'active'
              });
            }
          }

          // 2. Sync usage stats (course count & enrollments)
          await get().syncUsage(userId);
        } catch (err: any) {
          console.error('[SubscriptionStore] Fetch error:', err);
          set({ error: err.message });
        } finally {
          set({ isLoading: false });
        }
      },

      getProrationQuote: (targetTier: SubscriptionTier, targetInterval: BillingInterval): ProrationQuote => {
        const { activeSubscription } = get();
        return calculateProration(activeSubscription, targetTier, targetInterval);
      },

      startPaystackSubscription: async ({ tier, interval, email, userId, tenantId = 'default-tenant', customAmount, onSuccess, onClose }) => {
        set({ isLoading: true, error: null });

        try {
          const { activeSubscription, tiersCatalog } = get();
          await paystackSubscriptionService.startSubscription({
            tier,
            interval,
            email,
            userId,
            tenantId,
            currentSubscription: activeSubscription,
            customAmount,
            onClose: () => {
              set({ isLoading: false });
              if (onClose) onClose();
            },
            onSuccess: (newSub) => {
              const tierConfig = tiersCatalog[newSub.tier] || MONETIZATION_TIERS[newSub.tier] || MONETIZATION_TIERS.free;
              const completeSub: Subscription = {
                ...newSub,
                features: tierConfig.features
              };

              set({
                activeSubscription: completeSub,
                tier: newSub.tier,
                interval: newSub.interval,
                status: 'active',
                isUpgradeModalOpen: false,
                isLoading: false
              });

              // Trigger custom event for instant sync
              paystackSubscriptionService.broadcastSubscriptionChange(completeSub);

              if (onSuccess) onSuccess(completeSub);
            }
          });
        } catch (err: any) {
          console.error('[SubscriptionStore] Paystack error:', err);
          set({ error: err.message, isLoading: false });
        }
      },

      cancelSubscription: async () => {
        const { activeSubscription } = get();
        if (!activeSubscription || activeSubscription.tier === 'free') return;

        set({ isLoading: true });
        try {
          await nexus.database
            .from('subscriptions')
            .update({ status: 'canceled', updated_at: new Date().toISOString() })
            .eq('id', activeSubscription.id);

          await nexus.database
            .from('profiles')
            .update({
              metadata: {
                subscription_tier: 'free',
                subscription_status: 'canceled'
              }
            })
            .eq('id', activeSubscription.user_id);

          const updatedSub: Subscription = {
            ...activeSubscription,
            tier: 'free',
            status: 'canceled',
            features: FREE_TIER_FEATURES
          };

          set({
            tier: 'free',
            status: 'canceled',
            activeSubscription: updatedSub
          });

          paystackSubscriptionService.broadcastSubscriptionChange(updatedSub);
        } catch (err: any) {
          console.error('[SubscriptionStore] Cancel error:', err);
        } finally {
          set({ isLoading: false });
        }
      },

      downgradeToFreeMentor: async (userId: string) => {
        if (!userId) return;
        set({ isLoading: true, error: null });

        try {
          // 1. Cancel existing paid subscription
          await get().cancelSubscription();

          // 2. Drop to the free tier.
          //
          // Metadata is read and merged rather than replaced — writing the
          // object wholesale wiped mentor_application_status, pending_mentor_data
          // and every other key for anyone who downgraded.
          //
          // Mentor status is also left untouched: a downgrade changes what the
          // account may do, not whether it was ever vetted.
          const { data: existingProfile } = await nexus.database
            .from('profiles')
            .select('metadata')
            .eq('id', userId)
            .maybeSingle();

          const { error: downgradeErr } = await nexus.database
            .from('profiles')
            .update({
              mentor_tier: 'free',
              metadata: {
                ...((existingProfile as any)?.metadata || {}),
                subscription_tier: 'free',
                subscription_status: 'active',
                subscription_updated_at: new Date().toISOString(),
                mentor_tier: 'free'
              }
            })
            .eq('id', userId);

          if (downgradeErr) {
            throw new Error(`Could not apply the downgrade: ${downgradeErr.message}`);
          }

          // 3. Set local state to free tier
          const freeSub: Subscription = {
            id: `downgrade_free_${Date.now()}`,
            user_id: userId,
            tenant_id: get().activeSubscription?.tenant_id || 'default-tenant',
            tier: 'free',
            interval: 'monthly',
            status: 'active',
            amount: 0,
            currency: 'NGN',
            current_period_start: new Date().toISOString(),
            features: FREE_TIER_FEATURES,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          set({
            activeSubscription: freeSub,
            tier: 'free',
            interval: 'monthly',
            status: 'active',
            isUpgradeModalOpen: false
          });

          paystackSubscriptionService.broadcastSubscriptionChange(freeSub);
          console.log('[SubscriptionStore] Downgraded to Free Mentor successfully');
        } catch (err: any) {
          console.error('[SubscriptionStore] Downgrade error:', err);
          set({ error: err.message });
        } finally {
          set({ isLoading: false });
        }
      },

      syncUsage: async (userId: string) => {
        if (!userId) return;
        try {
          // Count published courses
          const { count: courseCount } = await nexus.database
            .from('courses')
            .select('id', { count: 'exact', head: true })
            .eq('instructor_id', userId)
            .eq('status', 'published');

          // Count total students enrolled across all instructor courses
          const { data: tutorCourses } = await nexus.database
            .from('courses')
            .select('id')
            .eq('instructor_id', userId);

          let studentCount = 0;
          if (tutorCourses && tutorCourses.length > 0) {
            const courseIds = tutorCourses.map(c => c.id);
            const { count: enrollCount } = await nexus.database
              .from('enrollments')
              .select('id', { count: 'exact', head: true })
              .in('course_id', courseIds);
            studentCount = enrollCount || 0;
          }

          set({
            usage: {
              published_courses_count: courseCount || 0,
              total_students_enrolled: studentCount,
              active_instructors_count: 1
            }
          });
        } catch (err) {
          console.warn('[SubscriptionStore] Usage sync warning:', err);
        }
      },

      /**
       * Wipe plan state on sign-out.
       *
       * tier / activeSubscription / usage are persisted to localStorage, and
       * nothing cleared them. A free account signing in on a browser that had
       * previously held an Institutional session inherited that tier until the
       * network call resolved — with the paid features unlocked in the interim.
       */
      resetSubscription: () => {
        set({
          activeSubscription: DEFAULT_FREE_SUBSCRIPTION,
          tier: 'free',
          interval: 'monthly',
          status: 'active',
          usage: { published_courses_count: 0, total_students_enrolled: 0, active_instructors_count: 0 },
          isUpgradeModalOpen: false,
          upgradeModalTargetTier: null,
          error: null
        });
        try {
          localStorage.removeItem('trileza_subscription_store');
        } catch {
          // Private mode or blocked storage — in-memory reset above still holds.
        }
      },

      setLocalTier: (tier: SubscriptionTier, interval: BillingInterval = 'monthly') => {
        const catalog = get().tiersCatalog;
        const tierConfig = catalog[tier] || MONETIZATION_TIERS[tier] || MONETIZATION_TIERS.free;
        const sub: Subscription = {
          id: `local_${tier}_${Date.now()}`,
          user_id: get().activeSubscription?.user_id || '',
          tenant_id: get().activeSubscription?.tenant_id || 'default-tenant',
          tier,
          interval,
          status: 'active',
          amount: tierConfig.pricing[interval],
          currency: 'NGN',
          current_period_start: new Date().toISOString(),
          features: tierConfig.features,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        set({
          activeSubscription: sub,
          tier,
          interval,
          status: 'active',
          isUpgradeModalOpen: false
        });

        paystackSubscriptionService.broadcastSubscriptionChange(sub);
      },

      openUpgradeModal: (targetTier?: SubscriptionTier) => {
        set({
          isUpgradeModalOpen: true,
          upgradeModalTargetTier: targetTier || (get().tier === 'free' ? 'pro' : 'institutional')
        });
      },

      closeUpgradeModal: () => {
        set({
          isUpgradeModalOpen: false,
          upgradeModalTargetTier: null
        });
      },

      // ─── FEATURE CHECKERS ──────────────────────────────────────────
      canPublishCourse: (customCourseCount?: number) => {
        const { tier, usage, tiersCatalog } = get();
        const tierConfig = tiersCatalog[tier] || MONETIZATION_TIERS[tier] || MONETIZATION_TIERS.free;
        const count = customCourseCount !== undefined ? customCourseCount : usage.published_courses_count;
        const max = tierConfig.features.max_courses;

        if (count >= max && max !== Infinity) {
          return {
            allowed: false,
            current: count,
            max,
            reason: `Your ${tierConfig.name} plan allows up to ${max} published course. Upgrade to Pro Mentor for unlimited course publishing.`
          };
        }

        return { allowed: true, current: count, max };
      },

      canEnrollStudent: (customStudentCount?: number) => {
        const { tier, usage, tiersCatalog } = get();
        const tierConfig = tiersCatalog[tier] || MONETIZATION_TIERS[tier] || MONETIZATION_TIERS.free;
        const count = customStudentCount !== undefined ? customStudentCount : usage.total_students_enrolled;
        const max = tierConfig.features.max_students_per_course;

        if (count >= max && max !== Infinity) {
          return {
            allowed: false,
            current: count,
            max,
            reason: `Your ${tierConfig.name} plan allows up to ${max} students per course. Upgrade your plan to increase student capacity.`
          };
        }

        return { allowed: true, current: count, max };
      },

      checkFeature: (feature: FeatureFlagKey) => {
        const { tier, tiersCatalog } = get();
        const features = tiersCatalog[tier]?.features || MONETIZATION_TIERS[tier]?.features || FREE_TIER_FEATURES;

        switch (feature) {
          case 'can_publish_course':
            return get().canPublishCourse().allowed;
          case 'can_enroll_student':
            return get().canEnrollStudent().allowed;
          case 'has_advanced_analytics':
            return features.has_advanced_analytics;
          case 'has_certificate_issuance':
            return features.has_certificate_issuance;
          case 'has_multi_instructor':
            return features.has_multi_instructor;
          case 'has_custom_branding':
            return features.has_custom_branding;
          case 'has_custom_subdomain':
            return features.has_custom_subdomain;
          case 'has_bulk_enrollment':
            return features.has_bulk_enrollment;
          case 'has_sla_support':
            return features.has_sla_support;
          default:
            return false;
        }
      },

      isPro: () => {
        const { tier } = get();
        return tier === 'pro' || tier === 'institutional';
      },

      isInstitutional: () => {
        return get().tier === 'institutional';
      },

      isFree: () => {
        return get().tier === 'free';
      }
    }),
    {
      name: 'trileza_subscription_store',
      partialize: (state) => ({
        activeSubscription: state.activeSubscription,
        tier: state.tier,
        interval: state.interval,
        status: state.status,
        usage: state.usage
      })
    }
  )
);

const applySubscription = (updatedSub: Subscription) => {
  const catalog = useSubscriptionStore.getState().tiersCatalog;
  const tierConfig = catalog[updatedSub.tier] || MONETIZATION_TIERS[updatedSub.tier] || MONETIZATION_TIERS.free;
  useSubscriptionStore.setState({
    activeSubscription: {
      ...updatedSub,
      features: tierConfig.features
    },
    tier: updatedSub.tier,
    interval: updatedSub.interval,
    status: updatedSub.status
  });
};

// Global real-time listener for instant sync across components & tabs
if (typeof window !== 'undefined') {
  window.addEventListener('trileza:subscription-updated', (event: any) => {
    const updatedSub = event.detail as Subscription;
    if (updatedSub) {
      applySubscription(updatedSub);
      console.log('[SubscriptionStore] Instant Realtime Sync applied:', updatedSub.tier);
    }
  });

  // The window event above only fires in the tab that made the change. A plan
  // altered anywhere else — an admin console, a second device, the Paystack
  // webhook — reached this session only on a full reload, so paid features
  // stayed locked (or stayed unlocked after a downgrade) until then. The
  // user's own realtime channel closes that gap.
  let subscribedUserId: string | null = null;

  const attachPlanListener = async (userId: string) => {
    if (!userId || subscribedUserId === userId) return;
    subscribedUserId = userId;
    try {
      if (!nexus.realtime.isConnected) await nexus.realtime.connect();
      await nexus.realtime.subscribe(`user:${userId}`);
      nexus.realtime.on('user_plan_upgraded', () => {
        useSubscriptionStore.getState().fetchSubscription(userId);
      });
      nexus.realtime.on('subscription_changed', () => {
        useSubscriptionStore.getState().fetchSubscription(userId);
      });
    } catch (err) {
      console.warn('[SubscriptionStore] Could not attach plan listener:', err);
    }
  };

  window.addEventListener('trileza:auth-user-ready', (event: any) => {
    const userId = event?.detail?.userId;
    if (userId) attachPlanListener(userId);
  });
}
