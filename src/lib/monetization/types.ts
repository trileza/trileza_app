export type SubscriptionTier = 'free' | 'pro' | 'institutional';
export type BillingInterval = 'monthly' | 'yearly';
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'incomplete';

export interface TierFeatures {
  max_courses: number; // 1 for free, Infinity for pro & institutional
  max_students_per_course: number; // 50 for free, 500 for pro, Infinity for institutional
  has_advanced_analytics: boolean;
  has_certificate_issuance: boolean;
  has_multi_instructor: boolean;
  has_custom_branding: boolean;
  has_custom_subdomain: boolean;
  has_bulk_enrollment: boolean;
  has_sla_support: boolean;
  support_level: 'standard' | 'priority' | 'sla_backed';
}

export interface TierPricing {
  monthly: number; // in NGN
  yearly: number;  // in NGN
}

export interface TierDefinition {
  id: SubscriptionTier;
  name: string;
  badge: string;
  tagline: string;
  pricing: TierPricing;
  features: TierFeatures;
  highlights: string[];
  ctaLabel: string;
  popular?: boolean;
}

export interface Subscription {
  id: string;
  user_id: string;
  tenant_id: string;
  tier: SubscriptionTier;
  interval: BillingInterval;
  status: SubscriptionStatus;
  amount: number;
  currency: string;
  current_period_start: string;
  current_period_end?: string;
  paystack_reference?: string;
  paystack_customer_code?: string;
  paystack_subscription_code?: string;
  paystack_plan_code?: string;
  features: TierFeatures;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionUsage {
  published_courses_count: number;
  total_students_enrolled: number;
  active_instructors_count?: number;
}

export type FeatureFlagKey = 
  | 'can_publish_course'
  | 'can_enroll_student'
  | 'has_advanced_analytics'
  | 'has_certificate_issuance'
  | 'has_multi_instructor'
  | 'has_custom_branding'
  | 'has_custom_subdomain'
  | 'has_bulk_enrollment'
  | 'has_sla_support';
