-- =============================================================================
-- TRILEZA LMS PRICING TIERS CATALOG & SYNCHRONIZATION
-- =============================================================================

CREATE TABLE IF NOT EXISTS pricing_tiers (
  id TEXT PRIMARY KEY, -- 'free', 'pro', 'institutional'
  name TEXT NOT NULL,
  badge TEXT NOT NULL,
  tagline TEXT NOT NULL,
  price_monthly NUMERIC NOT NULL DEFAULT 0,
  price_yearly NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'NGN',
  features JSONB NOT NULL,
  highlights TEXT[] NOT NULL,
  cta_label TEXT NOT NULL,
  is_popular BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS (Public read for all users)
ALTER TABLE pricing_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY pricing_tiers_read_policy ON pricing_tiers
  FOR SELECT USING (true);

CREATE POLICY pricing_tiers_admin_write_policy ON pricing_tiers
  FOR ALL USING (auth.role() = 'service_role' OR auth.jwt()->>'role' = 'super_admin');

-- Seed or Update the Three Exact Tiers
INSERT INTO pricing_tiers (id, name, badge, tagline, price_monthly, price_yearly, currency, features, highlights, cta_label, is_popular)
VALUES 
(
  'free',
  'Free Mentor',
  'Starter Entry Point',
  'For new instructors to test the platform at no cost.',
  0,
  0,
  'NGN',
  '{
    "max_courses": 1,
    "max_students_per_course": 50,
    "has_advanced_analytics": false,
    "has_certificate_issuance": false,
    "has_multi_instructor": false,
    "has_custom_branding": false,
    "has_custom_subdomain": false,
    "has_bulk_enrollment": false,
    "has_sla_support": false,
    "support_level": "standard"
  }'::jsonb,
  ARRAY[
    'Publish up to 1 course',
    'Enroll up to 50 students',
    'Basic analytics & student engagement',
    'Standard community support'
  ],
  'Start Free Mentor',
  FALSE
),
(
  'pro',
  'Mentor Pro',
  'Most Popular',
  'For growing instructors and content creators.',
  10000,
  100000,
  'NGN',
  '{
    "max_courses": 999999,
    "max_students_per_course": 500,
    "has_advanced_analytics": true,
    "has_certificate_issuance": true,
    "has_multi_instructor": false,
    "has_custom_branding": false,
    "has_custom_subdomain": false,
    "has_bulk_enrollment": false,
    "has_sla_support": false,
    "support_level": "priority"
  }'::jsonb,
  ARRAY[
    'Unlimited course publishing',
    'Up to 500 students per course',
    'Advanced analytics & completion funnels',
    'Automated certificate issuance',
    'Priority email & in-app support',
    'Earn revenue from course sales'
  ],
  'Start Mentor Pro',
  TRUE
),
(
  'institutional',
  'Institutional',
  'Schools & Universities',
  'For schools, universities, and training providers.',
  50000,
  500000,
  'NGN',
  '{
    "max_courses": 999999,
    "max_students_per_course": 999999,
    "has_advanced_analytics": true,
    "has_certificate_issuance": true,
    "has_multi_instructor": true,
    "has_custom_branding": true,
    "has_custom_subdomain": true,
    "has_bulk_enrollment": true,
    "has_sla_support": true,
    "support_level": "sla_backed"
  }'::jsonb,
  ARRAY[
    'Everything in Mentor Pro + Unlimited students',
    'Multi-instructor support & role permissions',
    'Custom branding (logo, colors, domain)',
    'Subdomain (institution.trileza.com)',
    'Multi-tenant user management',
    'Bulk student enrollment via CSV',
    'Dedicated account manager & SLA-backed support'
  ],
  'Start Institutional',
  FALSE
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  badge = EXCLUDED.badge,
  tagline = EXCLUDED.tagline,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  currency = EXCLUDED.currency,
  features = EXCLUDED.features,
  highlights = EXCLUDED.highlights,
  cta_label = EXCLUDED.cta_label,
  is_popular = EXCLUDED.is_popular,
  updated_at = NOW();
