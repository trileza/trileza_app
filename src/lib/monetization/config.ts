import type { SubscriptionTier, TierDefinition, TierFeatures } from './types';

export const FREE_TIER_FEATURES: TierFeatures = {
  max_courses: 1,
  max_students_per_course: 50,
  has_advanced_analytics: false,
  has_certificate_issuance: false,
  has_multi_instructor: false,
  has_custom_branding: false,
  has_custom_subdomain: false,
  has_bulk_enrollment: false,
  has_sla_support: false,
  support_level: 'standard'
};

export const PRO_TIER_FEATURES: TierFeatures = {
  max_courses: Infinity,
  max_students_per_course: 500,
  has_advanced_analytics: true,
  has_certificate_issuance: true,
  has_multi_instructor: false,
  has_custom_branding: false,
  has_custom_subdomain: false,
  has_bulk_enrollment: false,
  has_sla_support: false,
  support_level: 'priority'
};

export const INSTITUTIONAL_TIER_FEATURES: TierFeatures = {
  max_courses: Infinity,
  max_students_per_course: Infinity,
  has_advanced_analytics: true,
  has_certificate_issuance: true,
  has_multi_instructor: true,
  has_custom_branding: true,
  has_custom_subdomain: true,
  has_bulk_enrollment: true,
  has_sla_support: true,
  support_level: 'sla_backed'
};

export const MONETIZATION_TIERS: Record<SubscriptionTier, TierDefinition> = {
  free: {
    id: 'free',
    name: 'Free Mentor',
    badge: 'Starter Entry Point',
    tagline: 'For new instructors to test the platform at no cost.',
    pricing: {
      monthly: 0,
      yearly: 0
    },
    features: FREE_TIER_FEATURES,
    highlights: [
      'Publish up to 1 course',
      'Enroll up to 50 students',
      'Basic analytics & student engagement',
      'Standard community support'
    ],
    ctaLabel: 'Start Free Mentor'
  },
  pro: {
    id: 'pro',
    name: 'Mentor Pro',
    badge: 'Most Popular',
    tagline: 'For growing instructors and content creators.',
    pricing: {
      monthly: 10000,
      yearly: 100000 // Save ₦20,000 (2 months free)
    },
    features: PRO_TIER_FEATURES,
    highlights: [
      'Unlimited course publishing',
      'Up to 500 students per course',
      'Advanced analytics & completion funnels',
      'Automated certificate issuance',
      'Priority email & in-app support',
      'Earn revenue from course sales'
    ],
    ctaLabel: 'Start Mentor Pro',
    popular: true
  },
  institutional: {
    id: 'institutional',
    name: 'Institutional',
    badge: 'Schools & Universities',
    tagline: 'For schools, universities, and training providers.',
    pricing: {
      monthly: 50000,
      yearly: 500000 // Save ₦100,000 (2 months free)
    },
    features: INSTITUTIONAL_TIER_FEATURES,
    highlights: [
      'Everything in Mentor Pro + Unlimited students',
      'Multi-instructor support & role permissions',
      'Custom branding (logo, colors, domain)',
      'Subdomain (institution.trileza.com)',
      'Multi-tenant user management',
      'Bulk student enrollment via CSV',
      'Dedicated account manager & SLA-backed support'
    ],
    ctaLabel: 'Start Institutional'
  }
};

/**
 * Format currency in Nigerian Naira (NGN)
 */
export const formatNGN = (amount: number): string => {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0
  }).format(amount);
};
