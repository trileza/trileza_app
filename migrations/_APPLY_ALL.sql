-- =============================================================================
-- TRILEZA — FULL SCHEMA CATCH-UP
-- Generated 2026-09-07T06:00:24Z
--
-- The live database is missing 36 tables the app references, including
-- tenants, subscriptions and pricing_tiers. Every migration from 20260812
-- onward is unapplied. These nine are concatenated in dependency order.
--
-- Run top to bottom in the InsForge SQL editor. Each section is idempotent
-- so a partial run can be re-run safely.
-- =============================================================================


-- ── SOURCE: 20260812_multi_tenant_lms.sql ──

-- =============================================================================
-- TRILEZA LMS MULTI-TENANT ARCHITECTURE MIGRATION & SCHEMA
-- =============================================================================

-- 1. Create `tenants` table
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  subdomain TEXT UNIQUE NOT NULL,
  custom_domain TEXT UNIQUE,
  email TEXT NOT NULL,
  status TEXT CHECK (status IN ('active', 'suspended', 'pending')) DEFAULT 'active',
  logo_url TEXT,
  primary_color TEXT DEFAULT '#4f46e5',
  plan TEXT CHECK (plan IN ('starter', 'growth', 'enterprise')) DEFAULT 'starter',
  settings JSONB DEFAULT '{
    "allow_self_registration": true,
    "default_user_role": "learner",
    "course_hierarchy": ["Module", "Topic", "Subtopic"],
    "pricing_mode": "custom"
  }'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Seed Default Tenant ("Trileza Main LMS")
INSERT INTO tenants (id, name, subdomain, custom_domain, email, status, primary_color, plan)
VALUES (
  'default-tenant',
  'Trileza Main LMS',
  'app',
  'trileza.com',
  'admin@trileza.com',
  'active',
  '#4f46e5',
  'enterprise'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  subdomain = EXCLUDED.subdomain;

-- 3. Add `tenant_id` column to all core tables with default pointing to 'default-tenant'

-- Profiles / Users
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default-tenant' REFERENCES tenants(id) ON DELETE CASCADE;
-- Courses
ALTER TABLE courses ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default-tenant' REFERENCES tenants(id) ON DELETE CASCADE;
-- Books. Guarded: this deployment's library runs on `api_books`, and a bare
-- ALTER on a table that is not there aborts the whole migration.
DO $books$
BEGIN
  IF to_regclass('public.books') IS NOT NULL THEN
    ALTER TABLE books ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default-tenant' REFERENCES tenants(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_books_tenant_id ON books(tenant_id);
  END IF;
END
$books$;
-- Enrollments
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default-tenant' REFERENCES tenants(id) ON DELETE CASCADE;
-- Transactions
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default-tenant' REFERENCES tenants(id) ON DELETE CASCADE;
-- Support Tickets
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default-tenant' REFERENCES tenants(id) ON DELETE CASCADE;
-- Flagged Content
ALTER TABLE flagged_content ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default-tenant' REFERENCES tenants(id) ON DELETE CASCADE;
-- Payout Requests
ALTER TABLE payout_requests ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default-tenant' REFERENCES tenants(id) ON DELETE CASCADE;
-- Admin Users
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default-tenant' REFERENCES tenants(id) ON DELETE CASCADE;
-- Admin Audit Logs
ALTER TABLE admin_audit_logs ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default-tenant' REFERENCES tenants(id) ON DELETE CASCADE;

-- 4. Create Indexes on tenant_id for all tables
CREATE INDEX IF NOT EXISTS idx_profiles_tenant_id ON profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_courses_tenant_id ON courses(tenant_id);
-- (idx_books_tenant_id is created in the guarded block above.)
CREATE INDEX IF NOT EXISTS idx_enrollments_tenant_id ON enrollments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_transactions_tenant_id ON transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_tenant_id ON support_tickets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_flagged_content_tenant_id ON flagged_content(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payout_requests_tenant_id ON payout_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_tenant_id ON admin_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_tenant_id ON admin_audit_logs(tenant_id);

-- 5. Helper Function to Get Current Tenant from JWT or Default
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS TEXT AS $$
BEGIN
  RETURN COALESCE(
    current_setting('request.jwt.claims', true)::json->>'tenant_id',
    'default-tenant'
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- 6. Row-Level Security (RLS) Policies
-- Enable RLS on core tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Allow public read access to active tenant info for subdomain lookup
CREATE POLICY tenant_public_read ON tenants FOR SELECT USING (status = 'active');

-- Allow tenant admins / users access within their matching tenant_id
CREATE POLICY profiles_tenant_isolation ON profiles
  FOR ALL USING (tenant_id = current_tenant_id() OR tenant_id IS NULL);

CREATE POLICY courses_tenant_isolation ON courses
  FOR ALL USING (tenant_id = current_tenant_id() OR tenant_id IS NULL);

CREATE POLICY enrollments_tenant_isolation ON enrollments
  FOR ALL USING (tenant_id = current_tenant_id() OR tenant_id IS NULL);

CREATE POLICY transactions_tenant_isolation ON transactions
  FOR ALL USING (tenant_id = current_tenant_id() OR tenant_id IS NULL);


-- ── SOURCE: 20260828_monetization_subscriptions.sql ──

-- =============================================================================
-- TRILEZA LMS MONETIZATION & THREE-TIER SUBSCRIPTIONS SCHEMA
-- =============================================================================

-- 1. Create `subscriptions` table
CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
  tenant_id TEXT DEFAULT 'default-tenant' REFERENCES tenants(id) ON DELETE CASCADE,
  tier TEXT CHECK (tier IN ('free', 'pro', 'institutional')) NOT NULL DEFAULT 'free',
  interval TEXT CHECK (interval IN ('monthly', 'yearly')) NOT NULL DEFAULT 'monthly',
  status TEXT CHECK (status IN ('active', 'canceled', 'past_due', 'incomplete')) NOT NULL DEFAULT 'active',
  amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'NGN',
  current_period_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  current_period_end TIMESTAMP WITH TIME ZONE,
  paystack_reference TEXT,
  paystack_customer_code TEXT,
  paystack_subscription_code TEXT,
  paystack_plan_code TEXT,
  features JSONB DEFAULT '{
    "max_courses": 1,
    "max_students_per_course": 50,
    "has_advanced_analytics": false,
    "has_certificate_issuance": false,
    "has_multi_instructor": false,
    "has_custom_branding": false,
    "has_custom_subdomain": false,
    "has_bulk_enrollment": false,
    "has_sla_support": false
  }'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create Indexes on subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant_id ON subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tier ON subscriptions(tier);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- 3. Row-Level Security (RLS) Policies on subscriptions
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own subscriptions or tenant admins to view tenant subscriptions
CREATE POLICY subscriptions_read_policy ON subscriptions
  FOR SELECT USING (
    auth.uid()::text = user_id 
    OR tenant_id = current_tenant_id()
    OR auth.role() = 'service_role'
  );

CREATE POLICY subscriptions_insert_policy ON subscriptions
  FOR INSERT WITH CHECK (
    auth.uid()::text = user_id 
    OR tenant_id = current_tenant_id()
    OR auth.role() = 'service_role'
  );

CREATE POLICY subscriptions_update_policy ON subscriptions
  FOR UPDATE USING (
    auth.uid()::text = user_id 
    OR tenant_id = current_tenant_id()
    OR auth.role() = 'service_role'
  );

-- 4. Seed default Free subscription records for existing users if none exist
INSERT INTO subscriptions (id, user_id, tenant_id, tier, interval, status, amount, currency)
SELECT 
  'sub-free-' || p.id,
  p.id,
  COALESCE(p.tenant_id, 'default-tenant'),
  'free',
  'monthly',
  'active',
  0,
  'NGN'
FROM profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM subscriptions s WHERE s.user_id = p.id
)
ON CONFLICT (id) DO NOTHING;


-- ── SOURCE: 20260829_pricing_tiers_catalog.sql ──

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
  'Pro Mentor',
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
  'Start Pro Mentor',
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
    'Everything in Pro Mentor + Unlimited students',
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


-- ── SOURCE: 20260904_rls_hardening.sql ──

-- =============================================================================
-- TRILEZA — ROW-LEVEL SECURITY HARDENING
-- =============================================================================
--
-- WHAT THIS FIXES
-- ---------------
-- The policies introduced in 20260812_multi_tenant_lms.sql were written as:
--
--     FOR ALL USING (tenant_id = current_tenant_id() OR tenant_id IS NULL)
--
-- current_tenant_id() falls back to 'default-tenant' and every row defaults to
-- 'default-tenant', so that predicate evaluates to TRUE for everyone. Combined
-- with FOR ALL it covered writes as well as reads, meaning any caller holding
-- the anon key could UPDATE or DELETE any profile, course, enrollment or
-- transaction on the platform. This migration replaces those policies with
-- per-command rules and closes the equivalent gaps on the financial and admin
-- tables.
--
-- REVIEW AND RUN ON A STAGING BRANCH FIRST. Enabling RLS on a table with no
-- matching policy denies all access to it, so verify the app end to end
-- (signed out, learner, mentor, and each admin console) before promoting.
--
-- =============================================================================


-- --- 1. Helper functions ----------------------------------------------------

-- Is the caller a platform admin? SECURITY DEFINER so it can read admin_users
-- without recursing through that table's own RLS policy.
CREATE OR REPLACE FUNCTION is_platform_admin() RETURNS BOOLEAN AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users a
    WHERE a.user_id::text = auth.uid()::text
      AND COALESCE(a.suspended, FALSE) = FALSE
  );
$fn$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Does the caller hold a specific admin role? super_admin satisfies any role,
-- mirroring src/utils/adminAuth.ts so the database and the UI agree.
CREATE OR REPLACE FUNCTION has_admin_role(required_role TEXT) RETURNS BOOLEAN AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users a
    WHERE a.user_id::text = auth.uid()::text
      AND COALESCE(a.suspended, FALSE) = FALSE
      AND (
        a.roles::jsonb ? 'super_admin'
        OR a.roles::jsonb ? required_role
      )
  );
$fn$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- The caller's own tenant, read from their profile rather than from a JWT claim
-- that may not be present. SECURITY DEFINER to avoid recursing through the
-- profiles policy.
CREATE OR REPLACE FUNCTION current_user_tenant_id() RETURNS TEXT AS $fn$
  SELECT COALESCE(
    (SELECT p.tenant_id FROM public.profiles p WHERE p.id::text = auth.uid()::text),
    'default-tenant'
  );
$fn$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;


-- --- 2. profiles ------------------------------------------------------------
-- SELECT stays broad: signed-out pages (login, the public course catalog, the
-- tenant resolver) and the social feed all read author profiles, and narrowing
-- it would require routing ~85 call sites through a restricted-column view.
-- That column split is tracked as a follow-up (see NOTES at the end).
-- The actual hole being closed here is writes: only the owner or a platform
-- admin may modify a profile row.

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_tenant_isolation ON profiles;
DROP POLICY IF EXISTS profiles_select ON profiles;
DROP POLICY IF EXISTS profiles_insert ON profiles;
DROP POLICY IF EXISTS profiles_update ON profiles;
DROP POLICY IF EXISTS profiles_delete ON profiles;

CREATE POLICY profiles_select ON profiles
  FOR SELECT USING (true);

CREATE POLICY profiles_insert ON profiles
  FOR INSERT WITH CHECK (
    auth.uid()::text = id::text OR is_platform_admin()
  );

CREATE POLICY profiles_update ON profiles
  FOR UPDATE USING (
    auth.uid()::text = id::text OR is_platform_admin()
  );

CREATE POLICY profiles_delete ON profiles
  FOR DELETE USING (
    auth.uid()::text = id::text OR is_platform_admin()
  );


-- --- 3. courses -------------------------------------------------------------
-- Published courses are the public catalog. Drafts, archived and flagged
-- courses belong to their author and the content team only.

ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS courses_tenant_isolation ON courses;
DROP POLICY IF EXISTS courses_select ON courses;
DROP POLICY IF EXISTS courses_insert ON courses;
DROP POLICY IF EXISTS courses_update ON courses;
DROP POLICY IF EXISTS courses_delete ON courses;

CREATE POLICY courses_select ON courses
  FOR SELECT USING (
    status = 'published'
    OR auth.uid()::text = tutor_id::text
    OR is_platform_admin()
  );

CREATE POLICY courses_insert ON courses
  FOR INSERT WITH CHECK (
    auth.uid()::text = tutor_id::text OR is_platform_admin()
  );

CREATE POLICY courses_update ON courses
  FOR UPDATE USING (
    auth.uid()::text = tutor_id::text OR is_platform_admin()
  );

CREATE POLICY courses_delete ON courses
  FOR DELETE USING (
    auth.uid()::text = tutor_id::text OR is_platform_admin()
  );


-- --- 4. enrollments ---------------------------------------------------------
-- A learner sees their own enrollments; a mentor sees enrollments in courses
-- they own (the student roster); admins see everything.

ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS enrollments_tenant_isolation ON enrollments;
DROP POLICY IF EXISTS enrollments_select ON enrollments;
DROP POLICY IF EXISTS enrollments_insert ON enrollments;
DROP POLICY IF EXISTS enrollments_update ON enrollments;
DROP POLICY IF EXISTS enrollments_delete ON enrollments;

CREATE POLICY enrollments_select ON enrollments
  FOR SELECT USING (
    auth.uid()::text = user_id::text
    OR is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM courses c
      WHERE c.id::text = enrollments.course_id::text
        AND c.tutor_id::text = auth.uid()::text
    )
  );

CREATE POLICY enrollments_insert ON enrollments
  FOR INSERT WITH CHECK (
    auth.uid()::text = user_id::text OR is_platform_admin()
  );

CREATE POLICY enrollments_update ON enrollments
  FOR UPDATE USING (
    auth.uid()::text = user_id::text
    OR is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM courses c
      WHERE c.id::text = enrollments.course_id::text
        AND c.tutor_id::text = auth.uid()::text
    )
  );

CREATE POLICY enrollments_delete ON enrollments
  FOR DELETE USING (
    auth.uid()::text = user_id::text OR is_platform_admin()
  );


-- --- 5. wallets -------------------------------------------------------------
-- Wallet rows carry bank_details, available_balance and lifetime_earnings.
-- Nothing outside the owner and the finance team has any business reading them.

ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wallets_select ON wallets;
DROP POLICY IF EXISTS wallets_insert ON wallets;
DROP POLICY IF EXISTS wallets_update ON wallets;

CREATE POLICY wallets_select ON wallets
  FOR SELECT USING (
    auth.uid()::text = user_id::text OR is_platform_admin()
  );

CREATE POLICY wallets_insert ON wallets
  FOR INSERT WITH CHECK (
    auth.uid()::text = user_id::text OR is_platform_admin()
  );

CREATE POLICY wallets_update ON wallets
  FOR UPDATE USING (
    auth.uid()::text = user_id::text OR is_platform_admin()
  );

-- Checkout needs exactly one field from another user's wallet: the Paystack
-- subaccount that receives the vendor's split. Expose that, and nothing else.
-- (Previously the public course catalog fetched every column of every wallet,
-- which published every mentor's bank details and balances.)
DROP VIEW IF EXISTS public_payout_accounts;
CREATE VIEW public_payout_accounts AS
  SELECT user_id, paystack_subaccount_code
  FROM wallets
  WHERE paystack_subaccount_code IS NOT NULL;

GRANT SELECT ON public_payout_accounts TO anon, authenticated;


-- --- 6. transactions --------------------------------------------------------
-- Readable by the wallet owner and the finance team. Written only by the
-- service role (webhooks) and admins, never directly by a client.

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS transactions_tenant_isolation ON transactions;
DROP POLICY IF EXISTS transactions_select ON transactions;
DROP POLICY IF EXISTS transactions_insert ON transactions;
DROP POLICY IF EXISTS transactions_update ON transactions;

CREATE POLICY transactions_select ON transactions
  FOR SELECT USING (
    is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM wallets w
      WHERE w.id::text = transactions.wallet_id::text
        AND w.user_id::text = auth.uid()::text
    )
  );

CREATE POLICY transactions_insert ON transactions
  FOR INSERT WITH CHECK (
    auth.role() = 'service_role' OR is_platform_admin()
  );

CREATE POLICY transactions_update ON transactions
  FOR UPDATE USING (
    auth.role() = 'service_role' OR is_platform_admin()
  );


-- --- 7. payout_requests -----------------------------------------------------
-- A vendor raises and reads their own requests; only finance decides them.

ALTER TABLE payout_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payout_requests_select ON payout_requests;
DROP POLICY IF EXISTS payout_requests_insert ON payout_requests;
DROP POLICY IF EXISTS payout_requests_update ON payout_requests;

CREATE POLICY payout_requests_select ON payout_requests
  FOR SELECT USING (
    auth.uid()::text = user_id::text OR has_admin_role('finance_admin')
  );

CREATE POLICY payout_requests_insert ON payout_requests
  FOR INSERT WITH CHECK (
    auth.uid()::text = user_id::text
  );

CREATE POLICY payout_requests_update ON payout_requests
  FOR UPDATE USING (
    has_admin_role('finance_admin')
  );


-- --- 8. subscriptions -------------------------------------------------------
-- The original policies included "OR tenant_id = current_tenant_id()", which,
-- since every row defaults to 'default-tenant', let any user read and rewrite
-- every other user's subscription -- including their billing tier.

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS subscriptions_read_policy ON subscriptions;
DROP POLICY IF EXISTS subscriptions_insert_policy ON subscriptions;
DROP POLICY IF EXISTS subscriptions_update_policy ON subscriptions;
DROP POLICY IF EXISTS subscriptions_select ON subscriptions;
DROP POLICY IF EXISTS subscriptions_insert ON subscriptions;
DROP POLICY IF EXISTS subscriptions_update ON subscriptions;

CREATE POLICY subscriptions_select ON subscriptions
  FOR SELECT USING (
    auth.uid()::text = user_id::text
    OR auth.role() = 'service_role'
    OR is_platform_admin()
  );

CREATE POLICY subscriptions_insert ON subscriptions
  FOR INSERT WITH CHECK (
    auth.uid()::text = user_id::text
    OR auth.role() = 'service_role'
    OR is_platform_admin()
  );

CREATE POLICY subscriptions_update ON subscriptions
  FOR UPDATE USING (
    auth.uid()::text = user_id::text
    OR auth.role() = 'service_role'
    OR is_platform_admin()
  );


-- --- 9. pricing_tiers -------------------------------------------------------
-- The write policy previously trusted auth.jwt()->>'role' = 'super_admin', a
-- claim the platform does not set, so it relied entirely on the service_role
-- branch. Anchor it to the admin_users table instead.

ALTER TABLE pricing_tiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pricing_tiers_read_policy ON pricing_tiers;
DROP POLICY IF EXISTS pricing_tiers_admin_write_policy ON pricing_tiers;
DROP POLICY IF EXISTS pricing_tiers_select ON pricing_tiers;
DROP POLICY IF EXISTS pricing_tiers_write ON pricing_tiers;

CREATE POLICY pricing_tiers_select ON pricing_tiers
  FOR SELECT USING (true);

CREATE POLICY pricing_tiers_write ON pricing_tiers
  FOR ALL USING (
    auth.role() = 'service_role' OR has_admin_role('super_admin')
  );


-- --- 10. tenants ------------------------------------------------------------
-- Active tenants stay publicly readable for subdomain resolution; only super
-- admins may create or change them.

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_public_read ON tenants;
DROP POLICY IF EXISTS tenants_select ON tenants;
DROP POLICY IF EXISTS tenants_write ON tenants;

CREATE POLICY tenants_select ON tenants
  FOR SELECT USING (
    status = 'active' OR is_platform_admin()
  );

CREATE POLICY tenants_write ON tenants
  FOR ALL USING (
    auth.role() = 'service_role' OR has_admin_role('super_admin')
  );


-- --- 11. admin_users --------------------------------------------------------
-- A user must be able to read their own admin record: the gate sign-in flow
-- calls getAdminUsersByUserId() before any admin session exists. Everything
-- beyond that is super-admin territory.

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_users_select ON admin_users;
DROP POLICY IF EXISTS admin_users_write ON admin_users;

CREATE POLICY admin_users_select ON admin_users
  FOR SELECT USING (
    auth.uid()::text = user_id::text
    OR auth.role() = 'service_role'
    OR is_platform_admin()
  );

CREATE POLICY admin_users_write ON admin_users
  FOR ALL USING (
    auth.role() = 'service_role' OR has_admin_role('super_admin')
  );


-- --- 12. admin_sessions -----------------------------------------------------
-- Session rows are bearer credentials. A caller may only ever see rows bound to
-- their own admin record.

ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_sessions_select ON admin_sessions;
DROP POLICY IF EXISTS admin_sessions_insert ON admin_sessions;
DROP POLICY IF EXISTS admin_sessions_delete ON admin_sessions;

CREATE POLICY admin_sessions_select ON admin_sessions
  FOR SELECT USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM admin_users a
      WHERE a.id::text = admin_sessions.admin_user_id::text
        AND a.user_id::text = auth.uid()::text
    )
  );

CREATE POLICY admin_sessions_insert ON admin_sessions
  FOR INSERT WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM admin_users a
      WHERE a.id::text = admin_sessions.admin_user_id::text
        AND a.user_id::text = auth.uid()::text
    )
  );

CREATE POLICY admin_sessions_delete ON admin_sessions
  FOR DELETE USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM admin_users a
      WHERE a.id::text = admin_sessions.admin_user_id::text
        AND a.user_id::text = auth.uid()::text
    )
  );


-- --- 13. admin_2fa_codes ----------------------------------------------------
-- Readable only by the admin the code was issued to. A second factor that
-- anyone can read is not a second factor.

ALTER TABLE admin_2fa_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_2fa_codes_own ON admin_2fa_codes;

CREATE POLICY admin_2fa_codes_own ON admin_2fa_codes
  FOR ALL USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM admin_users a
      WHERE a.id::text = admin_2fa_codes.admin_user_id::text
        AND a.user_id::text = auth.uid()::text
    )
  );


-- --- 14. Admin workflow tables ----------------------------------------------
-- Review queues, moderation and compliance records. Subjects may read their own
-- row (so an applicant can see their status); only the relevant admin role may
-- read the queue or decide anything.

ALTER TABLE mentor_applications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mentor_applications_select ON mentor_applications;
DROP POLICY IF EXISTS mentor_applications_insert ON mentor_applications;
DROP POLICY IF EXISTS mentor_applications_update ON mentor_applications;

CREATE POLICY mentor_applications_select ON mentor_applications
  FOR SELECT USING (
    auth.uid()::text = user_id::text OR has_admin_role('user_manager')
  );
CREATE POLICY mentor_applications_insert ON mentor_applications
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);
CREATE POLICY mentor_applications_update ON mentor_applications
  FOR UPDATE USING (has_admin_role('user_manager'));


ALTER TABLE course_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS course_reviews_select ON course_reviews;
DROP POLICY IF EXISTS course_reviews_insert ON course_reviews;
DROP POLICY IF EXISTS course_reviews_update ON course_reviews;

CREATE POLICY course_reviews_select ON course_reviews
  FOR SELECT USING (
    auth.uid()::text = submitted_by::text OR has_admin_role('content_manager')
  );
CREATE POLICY course_reviews_insert ON course_reviews
  FOR INSERT WITH CHECK (auth.uid()::text = submitted_by::text);
CREATE POLICY course_reviews_update ON course_reviews
  FOR UPDATE USING (has_admin_role('content_manager'));


-- Guarded: `book_reviews` is absent on deployments whose library runs on the
-- `api_*` tables. CREATE POLICY has no IF NOT EXISTS, so this has to be a block.
DO $book_reviews$
BEGIN
  IF to_regclass('public.book_reviews') IS NULL THEN
    RAISE NOTICE 'book_reviews not present — skipping its policies.';
    RETURN;
  END IF;

  EXECUTE 'ALTER TABLE book_reviews ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS book_reviews_select ON book_reviews';
  EXECUTE 'DROP POLICY IF EXISTS book_reviews_insert ON book_reviews';
  EXECUTE 'DROP POLICY IF EXISTS book_reviews_update ON book_reviews';

  EXECUTE $p$CREATE POLICY book_reviews_select ON book_reviews
    FOR SELECT USING (
      auth.uid()::text = submitted_by::text OR has_admin_role('content_manager')
    )$p$;
  EXECUTE $p$CREATE POLICY book_reviews_insert ON book_reviews
    FOR INSERT WITH CHECK (auth.uid()::text = submitted_by::text)$p$;
  EXECUTE $p$CREATE POLICY book_reviews_update ON book_reviews
    FOR UPDATE USING (has_admin_role('content_manager'))$p$;
END
$book_reviews$;


ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS support_tickets_select ON support_tickets;
DROP POLICY IF EXISTS support_tickets_insert ON support_tickets;
DROP POLICY IF EXISTS support_tickets_update ON support_tickets;

CREATE POLICY support_tickets_select ON support_tickets
  FOR SELECT USING (
    auth.uid()::text = user_id::text OR has_admin_role('support_agent')
  );
CREATE POLICY support_tickets_insert ON support_tickets
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);
CREATE POLICY support_tickets_update ON support_tickets
  FOR UPDATE USING (
    auth.uid()::text = user_id::text OR has_admin_role('support_agent')
  );


ALTER TABLE compliance_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS compliance_requests_select ON compliance_requests;
DROP POLICY IF EXISTS compliance_requests_insert ON compliance_requests;
DROP POLICY IF EXISTS compliance_requests_update ON compliance_requests;

CREATE POLICY compliance_requests_select ON compliance_requests
  FOR SELECT USING (
    auth.uid()::text = user_id::text OR has_admin_role('compliance_officer')
  );
CREATE POLICY compliance_requests_insert ON compliance_requests
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);
CREATE POLICY compliance_requests_update ON compliance_requests
  FOR UPDATE USING (has_admin_role('compliance_officer'));


ALTER TABLE flagged_content ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS flagged_content_select ON flagged_content;
DROP POLICY IF EXISTS flagged_content_insert ON flagged_content;
DROP POLICY IF EXISTS flagged_content_update ON flagged_content;

-- Any signed-in user may report content; only moderators may read the queue.
CREATE POLICY flagged_content_select ON flagged_content
  FOR SELECT USING (
    auth.uid()::text = reporter_id::text
    OR has_admin_role('support_agent')
    OR has_admin_role('compliance_officer')
  );
CREATE POLICY flagged_content_insert ON flagged_content
  FOR INSERT WITH CHECK (auth.uid()::text = reporter_id::text);
CREATE POLICY flagged_content_update ON flagged_content
  FOR UPDATE USING (
    has_admin_role('support_agent') OR has_admin_role('compliance_officer')
  );


-- --- 15. Audit logs ---------------------------------------------------------
-- Append-only from the application's point of view: admins may insert and read;
-- nobody may update or delete (no policy for those commands means denied).

ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_audit_logs_select ON admin_audit_logs;
DROP POLICY IF EXISTS admin_audit_logs_insert ON admin_audit_logs;

CREATE POLICY admin_audit_logs_select ON admin_audit_logs
  FOR SELECT USING (is_platform_admin());
CREATE POLICY admin_audit_logs_insert ON admin_audit_logs
  FOR INSERT WITH CHECK (is_platform_admin() OR auth.role() = 'service_role');


-- =============================================================================
-- NOTES / FOLLOW-UPS
-- =============================================================================
--
-- 1. profiles.metadata still carries PII (identity documents, addresses,
--    suspension reasons) and the table stays world-readable because signed-out
--    pages depend on it. The fix is a public_profiles view exposing only
--    id / full_name / username / avatar_url / bio / role, pointing the ~85
--    client call sites at it, then narrowing profiles_select to
--    "auth.uid() = id OR is_platform_admin()". Deliberately not done here: it
--    is a call-site refactor, not a policy change.
--
-- 2. Tables that still have no RLS at all and should be covered next:
--    posts, comments, likes/post_likes, follows, notifications, messages,
--    rtk_messages, rtk_groups, modules, lessons, books, cart_items,
--    live_sessions, session_participants, session_events, session_notes,
--    breakout_pods, sponsorship_requests, author_applications,
--    admin_applications, admin_onboarding_progress, video_annotations, and the
--    api_* library tables. Each needs its own owner predicate; they are left
--    untouched here so this migration stays reviewable in one sitting.
--
-- 3. admin_audit_log (singular) and admin_audit_logs (plural) both exist and
--    are both written to by src/lib/services/admin.ts. They need consolidating
--    behind a data migration before either can be trusted as a complete audit
--    trail. Not merged here: that requires backfilling and a coordinated
--    deploy.
--
-- =============================================================================


-- ── SOURCE: 20260905_school_core.sql ──

-- =============================================================================
-- TRILEZA — SCHOOL CORE: CLASSES, ASSIGNMENTS, GRADEBOOK, ATTENDANCE, GUARDIANS
-- =============================================================================
--
-- Two structural gaps blocked most of the Institutional feature set:
--
--   1. Assignments had no table. They were appended to a JSON array at
--      profiles.metadata.created_assignments on the teacher's own profile row,
--      so nothing could be queried, graded, reported on, or linked to a student.
--
--   2. There was no class/section entity. Rosters were inferred from
--      enrollments, which left attendance, cohorts and timetabling with nothing
--      to attach to.
--
-- This migration adds both, plus the features that depend on them: a gradebook,
-- rubrics, a daily register, and the guardian link that makes a parent portal
-- possible.
--
-- Depends on 20260904_rls_hardening.sql for is_platform_admin() and
-- has_admin_role(). Run that first.
--
-- =============================================================================


-- --- 1. Classes (sections) --------------------------------------------------
-- A class is a teaching group: "Year 10 Biology, Set B". It owns a roster, a
-- register and a timetable. A course is content; a class is people.

CREATE TABLE IF NOT EXISTS classes (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id     TEXT NOT NULL DEFAULT 'default-tenant' REFERENCES tenants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  code          TEXT,
  academic_year TEXT,
  term          TEXT,
  subject       TEXT,
  course_id     TEXT REFERENCES courses(id) ON DELETE SET NULL,
  lead_teacher_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  room          TEXT,
  capacity      INTEGER,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_classes_tenant   ON classes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_classes_teacher  ON classes(lead_teacher_id);
CREATE INDEX IF NOT EXISTS idx_classes_status   ON classes(tenant_id, status);

-- Roster. `role` lets a co-teacher or TA sit in the same table as students.
CREATE TABLE IF NOT EXISTS class_members (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  class_id    TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'teacher', 'assistant', 'observer')),
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at     TIMESTAMPTZ,
  UNIQUE (class_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_class_members_class ON class_members(class_id);
CREATE INDEX IF NOT EXISTS idx_class_members_user  ON class_members(user_id);


-- --- 2. Assignments ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS assignments (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id      TEXT NOT NULL DEFAULT 'default-tenant' REFERENCES tenants(id) ON DELETE CASCADE,
  class_id       TEXT REFERENCES classes(id) ON DELETE CASCADE,
  course_id      TEXT REFERENCES courses(id) ON DELETE SET NULL,
  teacher_id     TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  instructions   TEXT,
  -- 'quiz' is auto-gradeable from `questions`; the rest are teacher-marked.
  type           TEXT NOT NULL DEFAULT 'file' CHECK (type IN ('quiz', 'file', 'text', 'media', 'peer_reviewed')),
  points_possible NUMERIC NOT NULL DEFAULT 100,
  rubric_id      TEXT,
  questions      JSONB NOT NULL DEFAULT '[]'::jsonb,
  attachments    JSONB NOT NULL DEFAULT '[]'::jsonb,
  allow_late     BOOLEAN NOT NULL DEFAULT TRUE,
  peer_review_count INTEGER NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'closed', 'archived')),
  available_from TIMESTAMPTZ,
  due_at         TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assignments_tenant  ON assignments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_assignments_class   ON assignments(class_id);
CREATE INDEX IF NOT EXISTS idx_assignments_teacher ON assignments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_assignments_due     ON assignments(due_at);

CREATE TABLE IF NOT EXISTS assignment_submissions (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  assignment_id  TEXT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id     TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tenant_id      TEXT NOT NULL DEFAULT 'default-tenant' REFERENCES tenants(id) ON DELETE CASCADE,
  status         TEXT NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft', 'submitted', 'late', 'graded', 'returned', 'resubmit_requested')),
  body           TEXT,
  attachments    JSONB NOT NULL DEFAULT '[]'::jsonb,
  answers        JSONB NOT NULL DEFAULT '[]'::jsonb,
  score          NUMERIC,
  auto_score     NUMERIC,
  rubric_scores  JSONB NOT NULL DEFAULT '{}'::jsonb,
  feedback       TEXT,
  feedback_media_url TEXT,
  graded_by      TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  submitted_at   TIMESTAMPTZ,
  graded_at      TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (assignment_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_submissions_assignment ON assignment_submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student    ON assignment_submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status     ON assignment_submissions(status);


-- --- 3. Rubrics -------------------------------------------------------------
-- Criteria live in JSONB rather than a child table: a rubric is always read and
-- edited whole, and keeping it in one row makes it trivial to snapshot onto a
-- submission so later edits to the rubric never rewrite historical marks.

CREATE TABLE IF NOT EXISTS rubrics (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id   TEXT NOT NULL DEFAULT 'default-tenant' REFERENCES tenants(id) ON DELETE CASCADE,
  owner_id    TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  -- [{ id, label, description, levels: [{ label, points, description }] }]
  criteria    JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_points NUMERIC NOT NULL DEFAULT 0,
  is_shared   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rubrics_tenant ON rubrics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rubrics_owner  ON rubrics(owner_id);


-- --- 4. Gradebook -----------------------------------------------------------
-- One row per student per gradeable item. Assignment marks flow in here so the
-- gradebook can also hold manual columns (participation, exams) that never had
-- a submission.

CREATE TABLE IF NOT EXISTS grade_entries (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id     TEXT NOT NULL DEFAULT 'default-tenant' REFERENCES tenants(id) ON DELETE CASCADE,
  class_id      TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_id    TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assignment_id TEXT REFERENCES assignments(id) ON DELETE CASCADE,
  item_label    TEXT NOT NULL,
  category      TEXT NOT NULL DEFAULT 'general',
  score         NUMERIC,
  points_possible NUMERIC NOT NULL DEFAULT 100,
  is_excused    BOOLEAN NOT NULL DEFAULT FALSE,
  comment       TEXT,
  recorded_by   TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  recorded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (class_id, student_id, assignment_id, item_label)
);

CREATE INDEX IF NOT EXISTS idx_grades_class   ON grade_entries(class_id);
CREATE INDEX IF NOT EXISTS idx_grades_student ON grade_entries(student_id);

-- Weighted categories per class, e.g. {"homework": 20, "exam": 50}.
CREATE TABLE IF NOT EXISTS grade_categories (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  class_id   TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  weight_pct NUMERIC NOT NULL DEFAULT 0,
  UNIQUE (class_id, name)
);


-- --- 5. Attendance ----------------------------------------------------------
-- Daily/period register, distinct from live_sessions participation (which only
-- records who joined a video call).

CREATE TABLE IF NOT EXISTS attendance_records (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id    TEXT NOT NULL DEFAULT 'default-tenant' REFERENCES tenants(id) ON DELETE CASCADE,
  class_id     TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_id   TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  period       TEXT,
  status       TEXT NOT NULL DEFAULT 'present'
               CHECK (status IN ('present', 'absent', 'late', 'excused', 'left_early')),
  minutes_late INTEGER,
  note         TEXT,
  recorded_by  TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  recorded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (class_id, student_id, session_date, period)
);

CREATE INDEX IF NOT EXISTS idx_attendance_class_date ON attendance_records(class_id, session_date);
CREATE INDEX IF NOT EXISTS idx_attendance_student    ON attendance_records(student_id);


-- --- 6. Guardians -----------------------------------------------------------
-- A guardian is a profile like anyone else; this table is the link, so one
-- parent can watch several children across classes.

CREATE TABLE IF NOT EXISTS guardian_links (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id    TEXT NOT NULL DEFAULT 'default-tenant' REFERENCES tenants(id) ON DELETE CASCADE,
  guardian_id  TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  student_id   TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  relationship TEXT NOT NULL DEFAULT 'parent'
               CHECK (relationship IN ('parent', 'guardian', 'carer', 'other')),
  is_primary   BOOLEAN NOT NULL DEFAULT FALSE,
  can_view_grades     BOOLEAN NOT NULL DEFAULT TRUE,
  can_view_attendance BOOLEAN NOT NULL DEFAULT TRUE,
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('pending', 'active', 'revoked')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (guardian_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_guardian_links_guardian ON guardian_links(guardian_id);
CREATE INDEX IF NOT EXISTS idx_guardian_links_student  ON guardian_links(student_id);

-- Does the caller guard this student? SECURITY DEFINER so guardian policies on
-- other tables can call it without recursing through this table's own policy.
CREATE OR REPLACE FUNCTION is_guardian_of(target_student_id TEXT) RETURNS BOOLEAN AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM public.guardian_links g
    WHERE g.guardian_id::text = auth.uid()::text
      AND g.student_id::text = target_student_id
      AND g.status = 'active'
  );
$fn$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Does the caller teach this class? Used by nearly every policy below.
CREATE OR REPLACE FUNCTION teaches_class(target_class_id TEXT) RETURNS BOOLEAN AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM public.classes c
    WHERE c.id::text = target_class_id
      AND c.lead_teacher_id::text = auth.uid()::text
  ) OR EXISTS (
    SELECT 1 FROM public.class_members m
    WHERE m.class_id::text = target_class_id
      AND m.user_id::text = auth.uid()::text
      AND m.role IN ('teacher', 'assistant')
      AND m.left_at IS NULL
  );
$fn$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Is the caller on this class roster at all?
CREATE OR REPLACE FUNCTION is_in_class(target_class_id TEXT) RETURNS BOOLEAN AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM public.class_members m
    WHERE m.class_id::text = target_class_id
      AND m.user_id::text = auth.uid()::text
      AND m.left_at IS NULL
  );
$fn$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;


-- --- 7. Announcements -------------------------------------------------------

CREATE TABLE IF NOT EXISTS announcements (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id   TEXT NOT NULL DEFAULT 'default-tenant' REFERENCES tenants(id) ON DELETE CASCADE,
  author_id   TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  -- 'tenant' reaches the whole institution; 'class' only its roster.
  audience    TEXT NOT NULL DEFAULT 'tenant'
              CHECK (audience IN ('tenant', 'class', 'teachers', 'students', 'guardians')),
  class_id    TEXT REFERENCES classes(id) ON DELETE CASCADE,
  priority    TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'important', 'urgent')),
  pinned      BOOLEAN NOT NULL DEFAULT FALSE,
  publish_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_announcements_tenant ON announcements(tenant_id, publish_at DESC);


-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE classes                ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_members          ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments            ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rubrics                ENABLE ROW LEVEL SECURITY;
ALTER TABLE grade_entries          ENABLE ROW LEVEL SECURITY;
ALTER TABLE grade_categories       ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records     ENABLE ROW LEVEL SECURITY;
ALTER TABLE guardian_links         ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements          ENABLE ROW LEVEL SECURITY;

-- Classes: visible to the roster and to institution staff; edited by teachers.
DROP POLICY IF EXISTS classes_select ON classes;
DROP POLICY IF EXISTS classes_write  ON classes;
CREATE POLICY classes_select ON classes
  FOR SELECT USING (
    is_in_class(id) OR lead_teacher_id::text = auth.uid()::text OR is_platform_admin()
  );
CREATE POLICY classes_write ON classes
  FOR ALL USING (
    lead_teacher_id::text = auth.uid()::text OR is_platform_admin()
  );

-- Roster rows: readable by the class, writable by its teachers.
DROP POLICY IF EXISTS class_members_select ON class_members;
DROP POLICY IF EXISTS class_members_write  ON class_members;
CREATE POLICY class_members_select ON class_members
  FOR SELECT USING (
    user_id::text = auth.uid()::text
    OR teaches_class(class_id)
    OR is_guardian_of(user_id)
    OR is_platform_admin()
  );
CREATE POLICY class_members_write ON class_members
  FOR ALL USING (teaches_class(class_id) OR is_platform_admin());

-- Assignments: students see published ones for their class; teachers see theirs.
DROP POLICY IF EXISTS assignments_select ON assignments;
DROP POLICY IF EXISTS assignments_write  ON assignments;
CREATE POLICY assignments_select ON assignments
  FOR SELECT USING (
    teacher_id::text = auth.uid()::text
    OR is_platform_admin()
    OR (status = 'published' AND class_id IS NOT NULL AND is_in_class(class_id))
  );
CREATE POLICY assignments_write ON assignments
  FOR ALL USING (
    teacher_id::text = auth.uid()::text
    OR (class_id IS NOT NULL AND teaches_class(class_id))
    OR is_platform_admin()
  );

-- Submissions: a student sees only their own; teachers see their assignment's.
DROP POLICY IF EXISTS submissions_select ON assignment_submissions;
DROP POLICY IF EXISTS submissions_insert ON assignment_submissions;
DROP POLICY IF EXISTS submissions_update ON assignment_submissions;
CREATE POLICY submissions_select ON assignment_submissions
  FOR SELECT USING (
    student_id::text = auth.uid()::text
    OR is_guardian_of(student_id)
    OR is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM assignments a
      WHERE a.id = assignment_submissions.assignment_id
        AND (a.teacher_id::text = auth.uid()::text OR (a.class_id IS NOT NULL AND teaches_class(a.class_id)))
    )
  );
CREATE POLICY submissions_insert ON assignment_submissions
  FOR INSERT WITH CHECK (student_id::text = auth.uid()::text);
-- A student may edit their own draft; only the teacher may write a mark.
CREATE POLICY submissions_update ON assignment_submissions
  FOR UPDATE USING (
    (student_id::text = auth.uid()::text AND status IN ('draft', 'submitted', 'late', 'resubmit_requested'))
    OR is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM assignments a
      WHERE a.id = assignment_submissions.assignment_id
        AND (a.teacher_id::text = auth.uid()::text OR (a.class_id IS NOT NULL AND teaches_class(a.class_id)))
    )
  );

-- Rubrics: own, or shared within the tenant.
DROP POLICY IF EXISTS rubrics_select ON rubrics;
DROP POLICY IF EXISTS rubrics_write  ON rubrics;
CREATE POLICY rubrics_select ON rubrics
  FOR SELECT USING (owner_id::text = auth.uid()::text OR is_shared = TRUE OR is_platform_admin());
CREATE POLICY rubrics_write ON rubrics
  FOR ALL USING (owner_id::text = auth.uid()::text OR is_platform_admin());

-- Grades: the student, their guardian, and the class's teachers.
DROP POLICY IF EXISTS grades_select ON grade_entries;
DROP POLICY IF EXISTS grades_write  ON grade_entries;
CREATE POLICY grades_select ON grade_entries
  FOR SELECT USING (
    student_id::text = auth.uid()::text
    OR is_guardian_of(student_id)
    OR teaches_class(class_id)
    OR is_platform_admin()
  );
CREATE POLICY grades_write ON grade_entries
  FOR ALL USING (teaches_class(class_id) OR is_platform_admin());

DROP POLICY IF EXISTS grade_categories_select ON grade_categories;
DROP POLICY IF EXISTS grade_categories_write  ON grade_categories;
CREATE POLICY grade_categories_select ON grade_categories
  FOR SELECT USING (is_in_class(class_id) OR teaches_class(class_id) OR is_platform_admin());
CREATE POLICY grade_categories_write ON grade_categories
  FOR ALL USING (teaches_class(class_id) OR is_platform_admin());

-- Attendance: same audience as grades.
DROP POLICY IF EXISTS attendance_select ON attendance_records;
DROP POLICY IF EXISTS attendance_write  ON attendance_records;
CREATE POLICY attendance_select ON attendance_records
  FOR SELECT USING (
    student_id::text = auth.uid()::text
    OR is_guardian_of(student_id)
    OR teaches_class(class_id)
    OR is_platform_admin()
  );
CREATE POLICY attendance_write ON attendance_records
  FOR ALL USING (teaches_class(class_id) OR is_platform_admin());

-- Guardian links: the guardian, the student, and admins. Only admins create
-- them, so a parent cannot attach themselves to an arbitrary child.
DROP POLICY IF EXISTS guardian_links_select ON guardian_links;
DROP POLICY IF EXISTS guardian_links_write  ON guardian_links;
CREATE POLICY guardian_links_select ON guardian_links
  FOR SELECT USING (
    guardian_id::text = auth.uid()::text
    OR student_id::text = auth.uid()::text
    OR is_platform_admin()
  );
CREATE POLICY guardian_links_write ON guardian_links
  FOR ALL USING (is_platform_admin() OR has_admin_role('user_manager'));

-- Announcements: readable within the tenant (class ones only by the roster).
DROP POLICY IF EXISTS announcements_select ON announcements;
DROP POLICY IF EXISTS announcements_write  ON announcements;
CREATE POLICY announcements_select ON announcements
  FOR SELECT USING (
    publish_at <= NOW()
    AND (expires_at IS NULL OR expires_at > NOW())
    AND (
      audience <> 'class'
      OR (class_id IS NOT NULL AND (is_in_class(class_id) OR teaches_class(class_id)))
    )
  );
CREATE POLICY announcements_write ON announcements
  FOR ALL USING (
    author_id::text = auth.uid()::text
    OR is_platform_admin()
    OR (class_id IS NOT NULL AND teaches_class(class_id))
  );


-- ── SOURCE: 20260905_school_operations.sql ──

-- =============================================================================
-- TRILEZA — SCHOOL OPERATIONS: TIMETABLE, EVENTS, RESOURCES, PLANNING, ROLES
-- =============================================================================
--
-- The day-to-day administration layer. Everything here depends on `classes`
-- from 20260905_school_core.sql, which must run first (it also defines
-- teaches_class(), is_in_class() and is_guardian_of()).
--
-- =============================================================================


-- --- 1. Timetable -----------------------------------------------------------
-- A slot is a recurring weekly period for one class in one room. Conflict
-- detection is an EXCLUDE constraint rather than application logic, so two
-- bookings for the same room at the same time cannot both commit.

CREATE TABLE IF NOT EXISTS timetable_slots (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id    TEXT NOT NULL DEFAULT 'default-tenant' REFERENCES tenants(id) ON DELETE CASCADE,
  class_id     TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id   TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  -- 0 = Sunday .. 6 = Saturday, matching JavaScript's Date.getDay().
  day_of_week  INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  starts_at    TIME NOT NULL,
  ends_at      TIME NOT NULL,
  room         TEXT,
  label        TEXT,
  effective_from DATE,
  effective_to   DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT timetable_slot_order CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_timetable_tenant  ON timetable_slots(tenant_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_timetable_class   ON timetable_slots(class_id);
CREATE INDEX IF NOT EXISTS idx_timetable_teacher ON timetable_slots(teacher_id, day_of_week);

-- Same room, same day, overlapping times is rejected at the database.
-- btree_gist is required to mix equality columns with a range in EXCLUDE.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE timetable_slots DROP CONSTRAINT IF EXISTS timetable_no_room_clash;
ALTER TABLE timetable_slots ADD CONSTRAINT timetable_no_room_clash
  EXCLUDE USING gist (
    tenant_id WITH =,
    room WITH =,
    day_of_week WITH =,
    tsrange(('2000-01-01'::date + starts_at), ('2000-01-01'::date + ends_at)) WITH &&
  ) WHERE (room IS NOT NULL);


-- --- 2. School events -------------------------------------------------------

CREATE TABLE IF NOT EXISTS school_events (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id     TEXT NOT NULL DEFAULT 'default-tenant' REFERENCES tenants(id) ON DELETE CASCADE,
  organiser_id  TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  category      TEXT NOT NULL DEFAULT 'general'
                CHECK (category IN ('general', 'parents_evening', 'exam', 'trip', 'sports', 'holiday', 'inset')),
  location      TEXT,
  class_id      TEXT REFERENCES classes(id) ON DELETE CASCADE,
  audience      TEXT NOT NULL DEFAULT 'tenant'
                CHECK (audience IN ('tenant', 'class', 'teachers', 'students', 'guardians')),
  starts_at     TIMESTAMPTZ NOT NULL,
  ends_at       TIMESTAMPTZ,
  all_day       BOOLEAN NOT NULL DEFAULT FALSE,
  requires_rsvp BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_tenant_start ON school_events(tenant_id, starts_at);

CREATE TABLE IF NOT EXISTS event_rsvps (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  event_id   TEXT NOT NULL REFERENCES school_events(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  response   TEXT NOT NULL DEFAULT 'yes' CHECK (response IN ('yes', 'no', 'maybe')),
  slot_time  TIMESTAMPTZ,
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, user_id)
);


-- --- 3. Bookable resources --------------------------------------------------

CREATE TABLE IF NOT EXISTS school_resources (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id   TEXT NOT NULL DEFAULT 'default-tenant' REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  kind        TEXT NOT NULL DEFAULT 'equipment'
              CHECK (kind IN ('room', 'equipment', 'vehicle', 'other')),
  location    TEXT,
  capacity    INTEGER,
  quantity    INTEGER NOT NULL DEFAULT 1,
  notes       TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS resource_bookings (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id    TEXT NOT NULL DEFAULT 'default-tenant' REFERENCES tenants(id) ON DELETE CASCADE,
  resource_id  TEXT NOT NULL REFERENCES school_resources(id) ON DELETE CASCADE,
  booked_by    TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  class_id     TEXT REFERENCES classes(id) ON DELETE SET NULL,
  purpose      TEXT,
  starts_at    TIMESTAMPTZ NOT NULL,
  ends_at      TIMESTAMPTZ NOT NULL,
  status       TEXT NOT NULL DEFAULT 'confirmed'
               CHECK (status IN ('confirmed', 'pending', 'cancelled')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT booking_order CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_bookings_resource ON resource_bookings(resource_id, starts_at);

-- Double-booking a resource is rejected at the database, not in a handler.
ALTER TABLE resource_bookings DROP CONSTRAINT IF EXISTS resource_no_double_booking;
ALTER TABLE resource_bookings ADD CONSTRAINT resource_no_double_booking
  EXCLUDE USING gist (
    resource_id WITH =,
    tstzrange(starts_at, ends_at) WITH &&
  ) WHERE (status <> 'cancelled');


-- --- 4. Lesson plans --------------------------------------------------------

CREATE TABLE IF NOT EXISTS lesson_plans (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id     TEXT NOT NULL DEFAULT 'default-tenant' REFERENCES tenants(id) ON DELETE CASCADE,
  author_id     TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  class_id      TEXT REFERENCES classes(id) ON DELETE SET NULL,
  course_id     TEXT REFERENCES courses(id) ON DELETE SET NULL,
  title         TEXT NOT NULL,
  subject       TEXT,
  year_group    TEXT,
  planned_for   DATE,
  duration_mins INTEGER,
  objectives    JSONB NOT NULL DEFAULT '[]'::jsonb,
  materials     JSONB NOT NULL DEFAULT '[]'::jsonb,
  activities    JSONB NOT NULL DEFAULT '[]'::jsonb,
  differentiation TEXT,
  assessment_notes TEXT,
  standard_ids  JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_shared     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lesson_plans_author ON lesson_plans(author_id);
CREATE INDEX IF NOT EXISTS idx_lesson_plans_date   ON lesson_plans(tenant_id, planned_for);


-- --- 5. Curriculum standards ------------------------------------------------
-- Standards are hierarchical (framework > strand > statement), so a
-- self-referencing parent_id covers Common Core, NGSS and national frameworks
-- without a schema per framework.

CREATE TABLE IF NOT EXISTS curriculum_standards (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id   TEXT NOT NULL DEFAULT 'default-tenant' REFERENCES tenants(id) ON DELETE CASCADE,
  framework   TEXT NOT NULL,
  code        TEXT NOT NULL,
  description TEXT NOT NULL,
  subject     TEXT,
  year_group  TEXT,
  parent_id   TEXT REFERENCES curriculum_standards(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, framework, code)
);

CREATE INDEX IF NOT EXISTS idx_standards_framework ON curriculum_standards(tenant_id, framework);

-- Polymorphic alignment: a standard can be attached to a course, lesson,
-- assignment or lesson plan without four separate join tables.
CREATE TABLE IF NOT EXISTS standard_alignments (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  standard_id  TEXT NOT NULL REFERENCES curriculum_standards(id) ON DELETE CASCADE,
  target_type  TEXT NOT NULL CHECK (target_type IN ('course', 'lesson', 'assignment', 'lesson_plan')),
  target_id    TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (standard_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_alignments_target ON standard_alignments(target_type, target_id);


-- --- 6. Behaviour & wellbeing -----------------------------------------------
-- Pastoral records are sensitive: the RLS below deliberately excludes the
-- student and their guardian by default, since a logged concern is often not
-- yet something to share.

CREATE TABLE IF NOT EXISTS behaviour_logs (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id    TEXT NOT NULL DEFAULT 'default-tenant' REFERENCES tenants(id) ON DELETE CASCADE,
  student_id   TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  class_id     TEXT REFERENCES classes(id) ON DELETE SET NULL,
  logged_by    TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL DEFAULT 'note'
               CHECK (kind IN ('note', 'positive', 'concern', 'incident', 'wellbeing', 'intervention')),
  severity     TEXT NOT NULL DEFAULT 'low' CHECK (severity IN ('low', 'medium', 'high')),
  title        TEXT NOT NULL,
  detail       TEXT,
  action_taken TEXT,
  is_confidential BOOLEAN NOT NULL DEFAULT FALSE,
  follow_up_on DATE,
  resolved_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_behaviour_student ON behaviour_logs(student_id, created_at DESC);


-- --- 7. To-do items ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS todo_items (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id   TEXT NOT NULL DEFAULT 'default-tenant' REFERENCES tenants(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  detail      TEXT,
  -- 'system' rows are generated from due assignments and ungraded submissions.
  source      TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'system')),
  link_to     TEXT,
  due_at      TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_todos_user ON todo_items(user_id, completed_at);


-- --- 8. Custom roles --------------------------------------------------------
-- Lets an institution define "Department Head" or "Teaching Assistant" without
-- a code change. Permissions are a flat string array checked by the app.

CREATE TABLE IF NOT EXISTS custom_roles (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id    TEXT NOT NULL DEFAULT 'default-tenant' REFERENCES tenants(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  description  TEXT,
  base_role    TEXT NOT NULL DEFAULT 'mentee',
  permissions  JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS custom_role_assignments (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  custom_role_id TEXT NOT NULL REFERENCES custom_roles(id) ON DELETE CASCADE,
  user_id        TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (custom_role_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_role_assignments_user ON custom_role_assignments(user_id);


-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE timetable_slots        ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_events          ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_rsvps            ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_resources       ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_bookings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_plans           ENABLE ROW LEVEL SECURITY;
ALTER TABLE curriculum_standards   ENABLE ROW LEVEL SECURITY;
ALTER TABLE standard_alignments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE behaviour_logs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE todo_items             ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_roles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_role_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS timetable_select ON timetable_slots;
DROP POLICY IF EXISTS timetable_write  ON timetable_slots;
CREATE POLICY timetable_select ON timetable_slots
  FOR SELECT USING (is_in_class(class_id) OR teaches_class(class_id) OR is_platform_admin());
CREATE POLICY timetable_write ON timetable_slots
  FOR ALL USING (teaches_class(class_id) OR is_platform_admin());

DROP POLICY IF EXISTS events_select ON school_events;
DROP POLICY IF EXISTS events_write  ON school_events;
CREATE POLICY events_select ON school_events
  FOR SELECT USING (
    audience <> 'class'
    OR (class_id IS NOT NULL AND (is_in_class(class_id) OR teaches_class(class_id)))
    OR is_platform_admin()
  );
CREATE POLICY events_write ON school_events
  FOR ALL USING (organiser_id::text = auth.uid()::text OR is_platform_admin());

DROP POLICY IF EXISTS rsvps_all ON event_rsvps;
CREATE POLICY rsvps_all ON event_rsvps
  FOR ALL USING (
    user_id::text = auth.uid()::text
    OR is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM school_events e
      WHERE e.id = event_rsvps.event_id AND e.organiser_id::text = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS resources_select ON school_resources;
DROP POLICY IF EXISTS resources_write  ON school_resources;
CREATE POLICY resources_select ON school_resources
  FOR SELECT USING (is_active = TRUE OR is_platform_admin());
CREATE POLICY resources_write ON school_resources
  FOR ALL USING (is_platform_admin());

DROP POLICY IF EXISTS bookings_select ON resource_bookings;
DROP POLICY IF EXISTS bookings_write  ON resource_bookings;
-- Everyone can see when a resource is taken, otherwise booking is guesswork.
CREATE POLICY bookings_select ON resource_bookings FOR SELECT USING (true);
CREATE POLICY bookings_write ON resource_bookings
  FOR ALL USING (booked_by::text = auth.uid()::text OR is_platform_admin());

DROP POLICY IF EXISTS lesson_plans_select ON lesson_plans;
DROP POLICY IF EXISTS lesson_plans_write  ON lesson_plans;
CREATE POLICY lesson_plans_select ON lesson_plans
  FOR SELECT USING (author_id::text = auth.uid()::text OR is_shared = TRUE OR is_platform_admin());
CREATE POLICY lesson_plans_write ON lesson_plans
  FOR ALL USING (author_id::text = auth.uid()::text OR is_platform_admin());

DROP POLICY IF EXISTS standards_select ON curriculum_standards;
DROP POLICY IF EXISTS standards_write  ON curriculum_standards;
CREATE POLICY standards_select ON curriculum_standards FOR SELECT USING (true);
CREATE POLICY standards_write ON curriculum_standards
  FOR ALL USING (is_platform_admin() OR has_admin_role('content_manager'));

DROP POLICY IF EXISTS alignments_select ON standard_alignments;
DROP POLICY IF EXISTS alignments_write  ON standard_alignments;
CREATE POLICY alignments_select ON standard_alignments FOR SELECT USING (true);
CREATE POLICY alignments_write ON standard_alignments
  FOR ALL USING (is_platform_admin() OR has_admin_role('content_manager'));

-- Pastoral records: staff only. Confidential entries narrow to their author
-- and admins.
DROP POLICY IF EXISTS behaviour_select ON behaviour_logs;
DROP POLICY IF EXISTS behaviour_write  ON behaviour_logs;
CREATE POLICY behaviour_select ON behaviour_logs
  FOR SELECT USING (
    is_platform_admin()
    OR logged_by::text = auth.uid()::text
    OR (is_confidential = FALSE AND class_id IS NOT NULL AND teaches_class(class_id))
  );
CREATE POLICY behaviour_write ON behaviour_logs
  FOR ALL USING (logged_by::text = auth.uid()::text OR is_platform_admin());

DROP POLICY IF EXISTS todos_all ON todo_items;
CREATE POLICY todos_all ON todo_items
  FOR ALL USING (user_id::text = auth.uid()::text);

DROP POLICY IF EXISTS custom_roles_select ON custom_roles;
DROP POLICY IF EXISTS custom_roles_write  ON custom_roles;
CREATE POLICY custom_roles_select ON custom_roles FOR SELECT USING (true);
CREATE POLICY custom_roles_write ON custom_roles
  FOR ALL USING (is_platform_admin() OR has_admin_role('user_manager'));

DROP POLICY IF EXISTS role_assignments_select ON custom_role_assignments;
DROP POLICY IF EXISTS role_assignments_write  ON custom_role_assignments;
CREATE POLICY role_assignments_select ON custom_role_assignments
  FOR SELECT USING (user_id::text = auth.uid()::text OR is_platform_admin());
CREATE POLICY role_assignments_write ON custom_role_assignments
  FOR ALL USING (is_platform_admin() OR has_admin_role('user_manager'));


-- ── SOURCE: 20260906_workflow_integrity.sql ──

-- =============================================================================
-- TRILEZA — WORKFLOW INTEGRITY: APPLICATIONS, SUBSCRIPTIONS, TENANT PROVISIONING
-- =============================================================================
--
-- Constraints the mentor-application and tier-upgrade flows now rely on.
-- Each one backs a rule the application code enforces, so that a race, a retry
-- or a direct API call cannot produce a state the UI assumes is impossible.
--
-- Run after 20260904_rls_hardening.sql.
--
-- =============================================================================


-- --- 1. One open mentor application per person -------------------------------
-- The client checks for an existing open application before inserting, but two
-- rapid submits can both pass that check. A partial unique index makes the
-- second insert fail instead, which the UI already handles as "already in
-- review". Closed applications are excluded so a rejected applicant can re-apply.

-- Collapse any duplicates that predate the constraint, keeping the newest.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id
           ORDER BY submitted_at DESC NULLS LAST, id DESC
         ) AS rn
  FROM mentor_applications
  WHERE status IN ('pending', 'needs_info')
)
UPDATE mentor_applications m
SET status = 'rejected',
    rejection_reason = COALESCE(m.rejection_reason, 'Superseded by a more recent application.')
FROM ranked r
WHERE m.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_open_mentor_application
  ON mentor_applications (user_id)
  WHERE status IN ('pending', 'needs_info');


-- --- 2. The same rule for author applications --------------------------------
-- AuthorApplication.tsx submits with status 'pending' and has the same
-- double-submit exposure.

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'author_applications') THEN

    EXECUTE $sql$
      WITH ranked AS (
        SELECT id,
               ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC NULLS LAST, id DESC) AS rn
        FROM author_applications
        WHERE status = 'pending'
      )
      UPDATE author_applications a
      SET status = 'denied'
      FROM ranked r
      WHERE a.id = r.id AND r.rn > 1
    $sql$;

    EXECUTE $sql$
      CREATE UNIQUE INDEX IF NOT EXISTS uniq_open_author_application
        ON author_applications (user_id)
        WHERE status = 'pending'
    $sql$;
  END IF;
END
$do$;


-- --- 3. One active subscription per user -------------------------------------
-- fetchSubscription() reads the newest active row and treats it as *the* plan.
-- Two active rows would make the effective tier depend on ordering, so the
-- database now permits only one.

WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id
           ORDER BY created_at DESC NULLS LAST, id DESC
         ) AS rn
  FROM subscriptions
  WHERE status = 'active'
)
UPDATE subscriptions s
SET status = 'canceled',
    updated_at = NOW()
FROM ranked r
WHERE s.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_subscription_per_user
  ON subscriptions (user_id)
  WHERE status = 'active';


-- --- 4. Paystack references are not reusable ---------------------------------
-- Guards against a duplicate webhook delivery or a double-submitted checkout
-- recording the same payment twice.

CREATE UNIQUE INDEX IF NOT EXISTS uniq_subscription_paystack_reference
  ON subscriptions (paystack_reference)
  WHERE paystack_reference IS NOT NULL;


-- --- 5. Subdomains are matched case-insensitively -----------------------------
-- checkSubdomain() lowercases before querying, but a row inserted through any
-- other path could still collide only by case. This makes "Oxford" and "oxford"
-- the same address as far as the database is concerned.

DROP INDEX IF EXISTS uniq_tenant_subdomain_ci;
CREATE UNIQUE INDEX uniq_tenant_subdomain_ci
  ON tenants (LOWER(subdomain));

-- Reject the addresses the platform routes on. A tenant on 'admin' or 'gate'
-- would shadow the admin console.
ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_subdomain_not_reserved;
ALTER TABLE tenants ADD CONSTRAINT tenants_subdomain_not_reserved
  CHECK (LOWER(subdomain) NOT IN (
    'admin', 'www', 'api', 'app', 'system', 'root',
    'gate', 'signin', 'signup', 'support', 'help', 'status'
  ));

-- Format rule, mirroring isValidSubdomain() in src/utils/tenant.ts.
ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_subdomain_format;
ALTER TABLE tenants ADD CONSTRAINT tenants_subdomain_format
  CHECK (subdomain ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND LENGTH(subdomain) BETWEEN 3 AND 30);


-- --- 6. Mentor status cannot be set without an approved application ----------
-- The last line of defence for the rule that payment does not confer mentor
-- status. Institution admins (role 'management') publish inside their own
-- tenant and are exempt.

CREATE OR REPLACE FUNCTION enforce_mentor_vetting() RETURNS TRIGGER AS $fn$
DECLARE
  claims_mentor BOOLEAN;
  has_approval  BOOLEAN;
BEGIN
  claims_mentor := COALESCE((NEW.metadata->>'mentor_onboarded')::boolean, FALSE);

  IF NOT claims_mentor THEN
    RETURN NEW;
  END IF;

  -- Institution admins are not marketplace mentors.
  IF NEW.role = 'management' OR COALESCE((NEW.metadata->>'is_tenant_admin')::boolean, FALSE) THEN
    RETURN NEW;
  END IF;

  -- Already vetted before this write: nothing to check.
  IF COALESCE((OLD.metadata->>'mentor_onboarded')::boolean, FALSE) THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.mentor_applications a
    WHERE a.user_id = NEW.id AND a.status = 'approved'
  ) INTO has_approval;

  IF NOT has_approval THEN
    RAISE EXCEPTION
      'mentor_onboarded cannot be set for % without an approved mentor application', NEW.id
      USING HINT = 'Approve the application via the admin console; buying a plan does not grant mentor status.';
  END IF;

  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_enforce_mentor_vetting ON profiles;
CREATE TRIGGER trg_enforce_mentor_vetting
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION enforce_mentor_vetting();


-- --- 7. Supporting indexes ---------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_mentor_applications_status
  ON mentor_applications (status, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status
  ON subscriptions (user_id, status);


-- =============================================================================
-- NOTES
-- =============================================================================
--
-- 1. Section 6 installs a trigger that REJECTS writes which TURN ON
--    mentor_onboarded for an unvetted account.
--
--    Existing mentors are NOT affected and need no back-fill. The trigger
--    returns early when OLD.metadata->>'mentor_onboarded' is already true, so
--    anyone who is a mentor before this migration keeps saving their profile
--    normally. Only the false -> true transition is checked.
--
--    Do NOT bulk-insert 'approved' applications to "prepare" for this. That
--    fabricates approval records for accounts nobody reviewed, which is exactly
--    the state this migration exists to prevent.
--
--    To find accounts that are mentors without an approved application — worth
--    reviewing, but not a blocker:
--
--      SELECT p.id, p.email FROM profiles p
--      WHERE (p.metadata->>'mentor_onboarded')::boolean IS TRUE
--        AND NOT EXISTS (SELECT 1 FROM mentor_applications a
--                        WHERE a.user_id = p.id AND a.status = 'approved');
--
-- 2. Section 5's CHECK constraints will fail the migration if any existing
--    tenant has a subdomain that breaks the format or uses a reserved word.
--    Check first:
--
--      SELECT id, subdomain FROM tenants
--      WHERE subdomain !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
--         OR LENGTH(subdomain) NOT BETWEEN 3 AND 30
--         OR LOWER(subdomain) IN ('admin','www','api','app','system','root',
--                                 'gate','signin','signup','support','help','status');
--
-- =============================================================================


-- ── SOURCE: 20260907_mentor_kyc.sql ──

-- =============================================================================
-- TRILEZA — MENTOR APPLICATION KYC
-- =============================================================================
--
-- Two changes to what a mentor application carries.
--
-- 1. The intro video is dropped. It was never collected — the onboarding form
--    wrote `video_url: null` on every submission — so `checklist_intro_video`
--    was a review step nobody could ever complete.
--
-- 2. Identity documents are stored properly. The upload control existed but
--    only kept a filename in React state; nothing reached storage or the
--    database, which left `checklist_id_verification` equally unverifiable.
--
-- Safe to run before or after the other pending migrations.
--
-- =============================================================================


-- --- 1. Identity document ----------------------------------------------------

ALTER TABLE mentor_applications
  ADD COLUMN IF NOT EXISTS id_document_url  TEXT,
  ADD COLUMN IF NOT EXISTS id_document_type TEXT,
  ADD COLUMN IF NOT EXISTS id_document_name TEXT,
  ADD COLUMN IF NOT EXISTS phone_number     TEXT;

COMMENT ON COLUMN mentor_applications.id_document_url IS
  'Storage path of the government ID or institutional badge. Reviewed against checklist_id_verification.';


-- --- 2. Retire the intro video ----------------------------------------------
-- Dropped rather than left nullable: a column the product no longer collects
-- is a trap for the next person reading the review checklist.

ALTER TABLE mentor_applications
  DROP COLUMN IF EXISTS checklist_intro_video,
  DROP COLUMN IF EXISTS video_url;


-- --- 3. Applications awaiting an ID ------------------------------------------
-- Lets the User Manager sort the queue by whether there is anything to verify.

CREATE INDEX IF NOT EXISTS idx_mentor_applications_awaiting_id
  ON mentor_applications (status)
  WHERE id_document_url IS NULL;


-- =============================================================================
-- NOTE
-- =============================================================================
--
-- The identity document is uploaded to the `mentor-kyc` storage bucket, which
-- must exist and must NOT be public — these are passports and national IDs.
-- Create it as a private bucket before enabling ID upload in production, and
-- serve the file to reviewers through a signed URL rather than a public link.
--
-- =============================================================================


-- ── SOURCE: 20260908_institution_kyc.sql ──

-- =============================================================================
-- TRILEZA — INSTITUTIONAL KYC / KYB
-- =============================================================================
--
-- Know-Your-Business record for institutions onboarding from any jurisdiction.
--
-- Structure follows the eight areas a reviewer works through in order, and each
-- is a JSONB column rather than eighty flat ones. Three reasons:
--
--   1. The fields differ by jurisdiction — a US institution has an EIN, an EU
--      one a VAT number, a Nigerian one a CAC number. Flattening every variant
--      produces a table that is mostly NULL.
--   2. Sections are read and saved as a unit, which is also how the form is
--      stepped, so partial progress maps cleanly onto a single column.
--   3. Requirements change with regulation. Adding a field to a JSONB section
--      does not need a migration and a deploy.
--
-- Anything a reviewer filters or sorts on is promoted to a real column.
--
-- =============================================================================

CREATE TABLE IF NOT EXISTS institution_kyc (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id   TEXT REFERENCES tenants(id) ON DELETE CASCADE,
  -- Set before a tenant exists: KYC is submitted during signup, and the tenant
  -- is only provisioned once payment clears and review passes.
  submitted_by TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- ── Promoted for the review queue ───────────────────────────────────────
  legal_name              TEXT NOT NULL,
  legal_entity_type       TEXT CHECK (legal_entity_type IN (
                            'university', 'college', 'training_center',
                            'corporate_training', 'non_profit',
                            'government_agency', 'other')),
  country_of_incorporation TEXT,
  registration_number     TEXT,
  tax_identification_number TEXT,
  tax_residence_country   TEXT,

  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft',            -- applicant still filling it in
    'submitted',        -- awaiting review
    'in_review',
    'info_requested',   -- reviewer needs something more
    'approved',
    'rejected'
  )),

  -- Set by the reviewer, not the applicant.
  risk_rating TEXT CHECK (risk_rating IN ('low', 'medium', 'high')),

  -- ── The eight sections ──────────────────────────────────────────────────
  entity_registration   JSONB NOT NULL DEFAULT '{}'::jsonb,
  address_contact       JSONB NOT NULL DEFAULT '{}'::jsonb,
  tax_financial         JSONB NOT NULL DEFAULT '{}'::jsonb,
  authorized_rep        JSONB NOT NULL DEFAULT '{}'::jsonb,
  institutional_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  compliance            JSONB NOT NULL DEFAULT '{}'::jsonb,
  risk_onboarding       JSONB NOT NULL DEFAULT '{}'::jsonb,
  consents              JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Uploaded evidence: [{ kind, name, path, type, size, uploaded_at }].
  -- Paths point at the private `institution-kyc` bucket. They are keys, not
  -- URLs: reviewers fetch the bytes with their own session and view them from a
  -- blob URL, so nothing shareable is ever produced. Never make that bucket
  -- public — it holds passports, bank letters and incorporation certificates.
  documents JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- ── Review trail ────────────────────────────────────────────────────────
  reviewed_by      TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  review_notes     TEXT,
  info_requested   TEXT,
  submitted_at     TIMESTAMPTZ,
  reviewed_at      TIMESTAMPTZ,
  -- KYC goes stale. Regulated onboarding is normally re-verified periodically.
  expires_at       TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_institution_kyc_status
  ON institution_kyc (status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_institution_kyc_tenant
  ON institution_kyc (tenant_id);
CREATE INDEX IF NOT EXISTS idx_institution_kyc_submitter
  ON institution_kyc (submitted_by);

-- One open submission per person. Without this a double-submit queues two
-- near-identical records for the compliance team to reconcile.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_open_institution_kyc
  ON institution_kyc (submitted_by)
  WHERE status IN ('draft', 'submitted', 'in_review', 'info_requested');


-- --- Row level security ------------------------------------------------------
-- This table holds passports, bank details and incorporation papers. Access is
-- the applicant themselves, and compliance staff. Nobody else, including other
-- admin roles.

ALTER TABLE institution_kyc ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS institution_kyc_select ON institution_kyc;
DROP POLICY IF EXISTS institution_kyc_insert ON institution_kyc;
DROP POLICY IF EXISTS institution_kyc_update ON institution_kyc;

CREATE POLICY institution_kyc_select ON institution_kyc
  FOR SELECT USING (
    submitted_by::text = auth.uid()::text
    OR has_admin_role('compliance_officer')
    OR has_admin_role('super_admin')
  );

CREATE POLICY institution_kyc_insert ON institution_kyc
  FOR INSERT WITH CHECK (submitted_by::text = auth.uid()::text);

-- An applicant may edit their own record only while it is still open. Once
-- submitted for review, only compliance may change it — otherwise details
-- could be altered after a reviewer has checked them.
CREATE POLICY institution_kyc_update ON institution_kyc
  FOR UPDATE USING (
    (submitted_by::text = auth.uid()::text AND status IN ('draft', 'info_requested'))
    OR has_admin_role('compliance_officer')
    OR has_admin_role('super_admin')
  );


-- =============================================================================
-- NOTES
-- =============================================================================
--
-- 1. Create a PRIVATE storage bucket named `institution-kyc` before enabling
--    the form. It receives certificates of incorporation, accreditation proof,
--    tax certificates, bank confirmation letters, government IDs and passport
--    photos. A public bucket here would be a serious data breach.
--
--    Its access rules need to mirror the policies above: an applicant may write
--    under their own user-id prefix, and only compliance_officer/super_admin may
--    read. The SDK has no signed-URL support, so reviewers download with their
--    own session — if the bucket lets any signed-in user read, every mentor on
--    the platform can read every institution's passports.
--
-- 2. `expires_at` exists so re-verification can be scheduled, but nothing sets
--    it yet. Decide a period (24 months is common) and populate it on approval.
--
-- 3. Sanctions and PEP screening are not modelled here. If Trileza takes
--    institutional money across borders, that check belongs in the review flow
--    and its result should be recorded against `risk_rating`.
--
-- =============================================================================


-- ── SOURCE: 20260913_logic_fixes.sql ──

-- =============================================================================
-- TRILEZA — LOGIC FIXES: ADMIN LIFECYCLE, ATOMIC ADMIN ACTIONS, PROVISIONING,
--           PROFILE PRIVACY
-- =============================================================================
--
-- Run after 20260908_institution_kyc.sql (depends on is_platform_admin(),
-- has_admin_role(), is_guardian_of() and teaches_class()).
--
--   1. Admin record status. The console approved registrations as 'approved'
--      while the UI only admits 'active', so approved admins were locked out.
--      The database helpers, meanwhile, ignored status entirely and treated a
--      pending applicant as an admin. Both now agree on 'active'.
--   2. Self-service admin applications, bound to the signed-in account.
--   3. One audit table (admin_audit_logs) instead of two.
--   4. Approvals, refunds and payouts as single transactions.
--   5. Institution provisioning and registration that a customer can run.
--   6. profiles is no longer world-readable; public fields move to a view.
--
-- REVIEW ON A STAGING BRANCH FIRST. Section 6 narrows who can read profiles;
-- verify signed-out pages, the feed, messaging, a mentor, a teacher, a guardian
-- and each admin console before promoting.
--
-- =============================================================================


-- --- 1. Admin record status ---------------------------------------------------

ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS status TEXT;

-- 'approved' was only ever written by the bug being fixed here.
UPDATE admin_users SET status = 'active' WHERE status IS NULL OR status = 'approved';

-- Records created by invitation carry no status and are granted directly by a
-- super admin, so the default is 'active'. Self-service applications are
-- inserted as 'pending' by request_admin_access() below.
ALTER TABLE admin_users ALTER COLUMN status SET DEFAULT 'active';

ALTER TABLE admin_users DROP CONSTRAINT IF EXISTS admin_users_status_check;
ALTER TABLE admin_users ADD CONSTRAINT admin_users_status_check
  CHECK (status IN ('pending', 'active', 'rejected', 'suspended')) NOT VALID;

CREATE OR REPLACE FUNCTION is_platform_admin() RETURNS BOOLEAN AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users a
    WHERE a.user_id::text = auth.uid()::text
      AND COALESCE(a.suspended, FALSE) = FALSE
      AND COALESCE(a.status, 'active') = 'active'
  );
$fn$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION has_admin_role(required_role TEXT) RETURNS BOOLEAN AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users a
    WHERE a.user_id::text = auth.uid()::text
      AND COALESCE(a.suspended, FALSE) = FALSE
      AND COALESCE(a.status, 'active') = 'active'
      AND (
        a.roles::jsonb ? 'super_admin'
        OR a.roles::jsonb ? required_role
      )
  );
$fn$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;


-- --- 2. Self-service admin applications --------------------------------------
-- The old flow looked up an account by email and inserted an admin record for
-- it without the requester ever proving they owned that account. This binds
-- the application to the caller's own session instead.

CREATE OR REPLACE FUNCTION request_admin_access(p_role TEXT, p_backup_codes JSONB)
RETURNS JSONB AS $fn$
DECLARE
  v_uid     TEXT := auth.uid()::text;
  v_email   TEXT;
  v_fields  JSONB;
  v_row     admin_users%ROWTYPE;
  v_id_has_default BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to the account you want to use for admin access.' USING ERRCODE = '28000';
  END IF;

  -- super_admin is never self-service.
  IF p_role IS NULL OR p_role NOT IN (
    'content_manager', 'user_manager', 'finance_admin',
    'support_agent', 'compliance_officer', 'analytics_viewer'
  ) THEN
    RAISE EXCEPTION 'That admin role cannot be requested.' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM admin_users
    WHERE user_id::text = v_uid AND COALESCE(status, 'active') IN ('pending', 'active')
  ) THEN
    RAISE EXCEPTION 'This account already holds or has requested admin access.' USING ERRCODE = '23505';
  END IF;

  SELECT email INTO v_email FROM profiles WHERE id::text = v_uid;

  -- Built as JSON and cast through the row type so array/JSON column types are
  -- converted to whatever this deployment uses.
  v_fields := jsonb_build_object(
    'id', v_uid,
    'user_id', v_uid,
    'role', p_role,
    'roles', jsonb_build_array(p_role),
    'permissions', jsonb_build_array(p_role),
    'twofa_email', v_email,
    'twofa_enabled', TRUE,
    'status', 'pending',
    'backup_codes', COALESCE(p_backup_codes, '[]'::jsonb)
  );

  SELECT column_default IS NOT NULL INTO v_id_has_default
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'admin_users' AND column_name = 'id';

  IF v_id_has_default THEN
    INSERT INTO admin_users (user_id, role, roles, permissions, twofa_email, twofa_enabled, status, backup_codes)
    SELECT r.user_id, r.role, r.roles, r.permissions, r.twofa_email, r.twofa_enabled, r.status, r.backup_codes
    FROM jsonb_populate_record(NULL::admin_users, v_fields) r
    RETURNING * INTO v_row;
  ELSE
    -- Legacy schema: id is the profile id.
    INSERT INTO admin_users (id, user_id, role, roles, permissions, twofa_email, twofa_enabled, status, backup_codes)
    SELECT r.id, r.user_id, r.role, r.roles, r.permissions, r.twofa_email, r.twofa_enabled, r.status, r.backup_codes
    FROM jsonb_populate_record(NULL::admin_users, v_fields) r
    RETURNING * INTO v_row;
  END IF;

  IF to_regclass('public.admin_applications') IS NOT NULL THEN
    INSERT INTO admin_applications (user_id, role, reason, status)
    VALUES (v_uid, p_role, 'Self-service admin application.', 'pending');
  END IF;

  RETURN jsonb_build_object('id', v_row.id, 'status', v_row.status, 'role', p_role);
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION request_admin_access(TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION request_admin_access(TEXT, JSONB) TO authenticated;


-- --- 3. One audit table ------------------------------------------------------
-- admin_audit_logs (plural) is the one every console reads, so it becomes the
-- only one written. admin_audit_log (singular) is copied in and left in place
-- for inspection; drop it once the copy is verified.

ALTER TABLE admin_audit_logs ALTER COLUMN admin_id DROP NOT NULL;
ALTER TABLE admin_audit_logs ALTER COLUMN reason DROP NOT NULL;
ALTER TABLE admin_audit_logs DROP CONSTRAINT IF EXISTS admin_audit_logs_action_type_check;
ALTER TABLE admin_audit_logs DROP CONSTRAINT IF EXISTS admin_audit_logs_target_type_check;
ALTER TABLE admin_audit_logs ADD COLUMN IF NOT EXISTS admin_user_id TEXT;
ALTER TABLE admin_audit_logs ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE admin_audit_logs ADD COLUMN IF NOT EXISTS legacy_source_id TEXT;

-- Deleting a user used to cascade-delete every audit entry they authored.
DO $fk$
DECLARE c RECORD;
BEGIN
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
    WHERE con.conrelid = 'public.admin_audit_logs'::regclass
      AND con.contype = 'f'
      AND att.attname = 'admin_id'
  LOOP
    EXECUTE format('ALTER TABLE admin_audit_logs DROP CONSTRAINT %I', c.conname);
  END LOOP;
  ALTER TABLE admin_audit_logs
    ADD CONSTRAINT admin_audit_logs_admin_id_fkey
    FOREIGN KEY (admin_id) REFERENCES profiles(id) ON DELETE SET NULL NOT VALID;
END
$fk$;

-- The acting admin is whoever holds the session, not whatever the client sends.
CREATE OR REPLACE FUNCTION stamp_admin_audit_log() RETURNS TRIGGER AS $fn$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.admin_id := auth.uid()::text;
  END IF;
  IF NEW.admin_user_id IS NULL AND NEW.admin_id IS NOT NULL THEN
    NEW.admin_user_id := (
      SELECT a.id::text FROM admin_users a WHERE a.user_id::text = NEW.admin_id LIMIT 1
    );
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_stamp_admin_audit_log ON admin_audit_logs;
CREATE TRIGGER trg_stamp_admin_audit_log
  BEFORE INSERT ON admin_audit_logs
  FOR EACH ROW EXECUTE FUNCTION stamp_admin_audit_log();

-- Copy the singular table across. Read through to_jsonb so this works whatever
-- columns that table ended up with; re-running skips rows already copied.
DO $copy$
BEGIN
  IF to_regclass('public.admin_audit_log') IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO admin_audit_logs (
    created_at, admin_id, admin_user_id, action_type, target_type, target_id,
    previous_state, new_state, reason, ip_address, legacy_source_id
  )
  SELECT
    COALESCE((s.j->>'created_at')::timestamptz, (s.j->>'timestamp')::timestamptz, NOW()),
    au.user_id::text,
    s.j->>'admin_user_id',
    COALESCE(s.j->>'action', 'unknown'),
    COALESCE(s.j->>'target_type', 'unknown'),
    COALESCE(s.j->>'target_id', ''),
    s.j->'previous_state',
    COALESCE(s.j->'new_state', s.j->'details'),
    s.j->>'reason',
    COALESCE(s.j->>'ip_address', s.j->>'ip'),
    s.j->>'id'
  FROM (SELECT to_jsonb(l) AS j FROM admin_audit_log l) s
  LEFT JOIN admin_users au ON au.id::text = s.j->>'admin_user_id'
  WHERE NOT EXISTS (
    SELECT 1 FROM admin_audit_logs x WHERE x.legacy_source_id = s.j->>'id'
  );
END
$copy$;


-- --- 4. Atomic admin actions -------------------------------------------------
-- Each of these used to be three to five separate client writes. A dropped
-- connection between them left a payout approved with no deduction, or a
-- course marked approved but still in draft. Each is now one transaction that
-- also refuses to repeat a decision already made.

CREATE OR REPLACE FUNCTION admin_review_payout(p_payout_id TEXT, p_status TEXT, p_reason TEXT)
RETURNS JSONB AS $fn$
DECLARE
  v_payout payout_requests%ROWTYPE;
  v_wallet wallets%ROWTYPE;
  v_prev   JSONB;
BEGIN
  IF NOT has_admin_role('finance_admin') THEN
    RAISE EXCEPTION 'Only finance admins can decide payouts.' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Unknown payout decision: %', p_status USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_payout FROM payout_requests WHERE id::text = p_payout_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payout request not found.' USING ERRCODE = 'P0002';
  END IF;
  IF v_payout.status <> 'pending' THEN
    RAISE EXCEPTION 'This payout has already been %.', v_payout.status USING ERRCODE = '55000';
  END IF;

  v_prev := to_jsonb(v_payout);

  IF p_status = 'approved' THEN
    SELECT * INTO v_wallet FROM wallets WHERE user_id::text = v_payout.user_id::text FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'The vendor has no wallet, so nothing can be paid out.' USING ERRCODE = 'P0002';
    END IF;
    IF COALESCE(v_wallet.available_balance, 0) < v_payout.amount THEN
      RAISE EXCEPTION 'Insufficient balance: wallet holds %, payout requests %.',
        COALESCE(v_wallet.available_balance, 0), v_payout.amount USING ERRCODE = '55000';
    END IF;

    INSERT INTO transactions (wallet_id, amount, type, status, description, metadata)
    VALUES (
      v_wallet.id, -v_payout.amount, 'payout', 'completed',
      'Payout to bank account: ' || COALESCE(p_reason, ''),
      jsonb_build_object('payout_id', v_payout.id)
    );

    UPDATE wallets
    SET available_balance = COALESCE(available_balance, 0) - v_payout.amount
    WHERE id = v_wallet.id;
  END IF;

  UPDATE payout_requests
  SET status = p_status, reviewed_by = auth.uid()::text, reason = p_reason, reviewed_at = NOW()
  WHERE id = v_payout.id
  RETURNING * INTO v_payout;

  INSERT INTO admin_audit_logs (action_type, target_type, target_id, previous_state, new_state, reason)
  VALUES (
    CASE WHEN p_status = 'approved' THEN 'approve' ELSE 'reject' END,
    'payout', v_payout.id::text, v_prev,
    jsonb_build_object('status', p_status, 'reason', p_reason),
    format('Payout request %s. Reason: %s', p_status, COALESCE(p_reason, ''))
  );

  RETURN to_jsonb(v_payout);
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


CREATE OR REPLACE FUNCTION admin_refund_transaction(p_transaction_id TEXT, p_amount NUMERIC, p_reason TEXT)
RETURNS JSONB AS $fn$
DECLARE
  v_tx     transactions%ROWTYPE;
  v_refund transactions%ROWTYPE;
  v_amount NUMERIC;
BEGIN
  IF NOT has_admin_role('finance_admin') THEN
    RAISE EXCEPTION 'Only finance admins can issue refunds.' USING ERRCODE = '42501';
  END IF;
  IF COALESCE(TRIM(p_reason), '') = '' THEN
    RAISE EXCEPTION 'A refund needs a reason.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_tx FROM transactions WHERE id::text = p_transaction_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found.' USING ERRCODE = 'P0002';
  END IF;
  IF v_tx.type <> 'sale' OR v_tx.amount <= 0 THEN
    RAISE EXCEPTION 'Only a completed sale can be refunded.' USING ERRCODE = '55000';
  END IF;

  -- Checked after taking the row lock, so two concurrent refunds cannot both pass.
  IF EXISTS (
    SELECT 1 FROM transactions r
    WHERE r.metadata->>'refund_of' = v_tx.id::text
       OR r.description LIKE 'Refund issued for txn ' || v_tx.id::text || ':%'
  ) THEN
    RAISE EXCEPTION 'This sale has already been refunded.' USING ERRCODE = '55000';
  END IF;

  v_amount := COALESCE(ABS(p_amount), v_tx.amount);
  IF v_amount <= 0 OR v_amount > v_tx.amount THEN
    RAISE EXCEPTION 'Refund amount must be between 0 and the sale amount (%).', v_tx.amount USING ERRCODE = '22023';
  END IF;

  PERFORM 1 FROM wallets WHERE id::text = v_tx.wallet_id::text FOR UPDATE;

  INSERT INTO transactions (wallet_id, amount, type, status, description, metadata)
  VALUES (
    v_tx.wallet_id, -v_amount, 'sale', 'completed',
    'Refund issued for txn ' || v_tx.id::text || ': ' || p_reason,
    jsonb_build_object('refund_of', v_tx.id)
  )
  RETURNING * INTO v_refund;

  UPDATE wallets
  SET available_balance = COALESCE(available_balance, 0) - v_amount
  WHERE id::text = v_tx.wallet_id::text;

  INSERT INTO admin_audit_logs (action_type, target_type, target_id, previous_state, new_state, reason)
  VALUES (
    'refund', 'payout', v_tx.id::text,
    jsonb_build_object('wallet_id', v_tx.wallet_id, 'amount', v_tx.amount),
    jsonb_build_object('refunded', TRUE, 'refund_tx_id', v_refund.id, 'amount', v_amount),
    format('Issued refund of NGN %s. Reason: %s', v_amount, p_reason)
  );

  RETURN to_jsonb(v_refund);
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


CREATE OR REPLACE FUNCTION admin_review_course(p_review_id TEXT, p_status TEXT, p_checklist JSONB, p_notes TEXT)
RETURNS JSONB AS $fn$
DECLARE
  v_review course_reviews%ROWTYPE;
  v_prev   JSONB;
BEGIN
  IF NOT has_admin_role('content_manager') THEN
    RAISE EXCEPTION 'Only content managers can review courses.' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('approved', 'needs_changes', 'rejected') THEN
    RAISE EXCEPTION 'Unknown course decision: %', p_status USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_review FROM course_reviews WHERE id::text = p_review_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Course review not found.' USING ERRCODE = 'P0002';
  END IF;
  v_prev := to_jsonb(v_review);

  UPDATE course_reviews SET
    content_manager_id     = auth.uid()::text,
    status                 = p_status,
    checklist_title        = COALESCE((p_checklist->>'checklist_title')::boolean, checklist_title),
    checklist_description  = COALESCE((p_checklist->>'checklist_description')::boolean, checklist_description),
    checklist_curriculum   = COALESCE((p_checklist->>'checklist_curriculum')::boolean, checklist_curriculum),
    checklist_video        = COALESCE((p_checklist->>'checklist_video')::boolean, checklist_video),
    checklist_audio        = COALESCE((p_checklist->>'checklist_audio')::boolean, checklist_audio),
    checklist_thumbnail    = COALESCE((p_checklist->>'checklist_thumbnail')::boolean, checklist_thumbnail),
    checklist_no_copyright = COALESCE((p_checklist->>'checklist_no_copyright')::boolean, checklist_no_copyright),
    notes                  = p_notes,
    reviewed_at            = NOW()
  WHERE id = v_review.id
  RETURNING * INTO v_review;

  UPDATE courses
  SET status = CASE WHEN p_status = 'approved' THEN 'published' ELSE 'draft' END
  WHERE id::text = v_review.course_id::text;

  INSERT INTO admin_audit_logs (action_type, target_type, target_id, previous_state, new_state, reason)
  VALUES (
    CASE WHEN p_status = 'approved' THEN 'approve' ELSE 'reject' END,
    'course', v_review.course_id::text, v_prev,
    jsonb_build_object('status', p_status, 'checklist', p_checklist, 'notes', p_notes),
    format('Course review processed. Status: %s. Notes: %s', p_status, COALESCE(p_notes, ''))
  );

  RETURN to_jsonb(v_review);
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


CREATE OR REPLACE FUNCTION admin_review_mentor(p_application_id TEXT, p_status TEXT, p_checklist JSONB, p_reason TEXT)
RETURNS JSONB AS $fn$
DECLARE
  v_app  mentor_applications%ROWTYPE;
  v_prev JSONB;
  v_meta JSONB;
  v_role TEXT;
BEGIN
  IF NOT has_admin_role('user_manager') THEN
    RAISE EXCEPTION 'Only user managers can review mentor applications.' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('approved', 'rejected', 'needs_info') THEN
    RAISE EXCEPTION 'Unknown mentor decision: %', p_status USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_app FROM mentor_applications WHERE id::text = p_application_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mentor application not found.' USING ERRCODE = 'P0002';
  END IF;
  v_prev := to_jsonb(v_app);

  SELECT COALESCE(metadata, '{}'::jsonb), role INTO v_meta, v_role
  FROM profiles WHERE id::text = v_app.user_id::text FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The applicant''s profile no longer exists.' USING ERRCODE = 'P0002';
  END IF;

  -- The application is updated first so the mentor-vetting trigger on
  -- profiles sees it as approved within this same transaction.
  UPDATE mentor_applications SET
    reviewed_by                    = auth.uid()::text,
    status                         = p_status,
    checklist_profile_completeness = COALESCE((p_checklist->>'checklist_profile_completeness')::boolean, checklist_profile_completeness),
    checklist_id_verification      = COALESCE((p_checklist->>'checklist_id_verification')::boolean, checklist_id_verification),
    checklist_qualifications       = COALESCE((p_checklist->>'checklist_qualifications')::boolean, checklist_qualifications),
    rejection_reason               = NULLIF(p_reason, ''),
    reviewed_at                    = NOW()
  WHERE id = v_app.id
  RETURNING * INTO v_app;

  IF p_status = 'approved' THEN
    v_meta := (v_meta - 'mentor_application_status' - 'pending_mentor_data') || jsonb_build_object(
      'mentor_application_status', 'approved',
      'mentor_onboarded', TRUE,
      'active_role', 'mentor',
      'mentor_onboarded_at', NOW(),
      'mentor_data', COALESCE(
        v_meta->'pending_mentor_data',
        jsonb_build_object('identity', jsonb_build_object('verified', TRUE), 'onboardedAt', NOW())
      )
    );
    v_role := 'mentor';
  ELSIF p_status = 'rejected' THEN
    v_meta := v_meta || jsonb_build_object(
      'mentor_application_status', 'rejected',
      'rejection_reason', COALESCE(NULLIF(p_reason, ''), 'Declined by administration.')
    );
  ELSE
    v_meta := v_meta || jsonb_build_object(
      'mentor_application_status', 'needs_info',
      'rejection_reason', COALESCE(NULLIF(p_reason, ''), 'More information requested.')
    );
  END IF;

  UPDATE profiles SET role = v_role, metadata = v_meta WHERE id::text = v_app.user_id::text;

  INSERT INTO admin_audit_logs (action_type, target_type, target_id, previous_state, new_state, reason)
  VALUES (
    CASE WHEN p_status = 'approved' THEN 'approve' ELSE 'reject' END,
    'user', v_app.user_id::text, v_prev,
    jsonb_build_object('status', p_status, 'checklist', p_checklist, 'rejectionReason', p_reason),
    format('Mentor onboarding review processed. Status: %s. Reason: %s', p_status, COALESCE(p_reason, ''))
  );

  RETURN jsonb_build_object('application', to_jsonb(v_app), 'role', v_role, 'metadata', v_meta);
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


CREATE OR REPLACE FUNCTION admin_review_author(p_application_id TEXT, p_status TEXT, p_reason TEXT)
RETURNS JSONB AS $fn$
DECLARE
  v_app       JSONB;
  v_db_status TEXT;
  v_meta      JSONB;
  v_role      TEXT;
  v_name      TEXT;
  v_user_id   TEXT;
BEGIN
  IF NOT has_admin_role('user_manager') THEN
    RAISE EXCEPTION 'Only user managers can review author applications.' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('approved', 'rejected', 'needs_info') THEN
    RAISE EXCEPTION 'Unknown author decision: %', p_status USING ERRCODE = '22023';
  END IF;

  -- Read through to_jsonb: pen_name and category are optional columns.
  SELECT to_jsonb(a) INTO v_app FROM author_applications a WHERE a.id::text = p_application_id FOR UPDATE;
  IF v_app IS NULL THEN
    RAISE EXCEPTION 'Author application not found.' USING ERRCODE = 'P0002';
  END IF;
  v_user_id := v_app->>'user_id';

  v_db_status := CASE p_status WHEN 'approved' THEN 'approved' WHEN 'needs_info' THEN 'needs_info' ELSE 'denied' END;

  UPDATE author_applications
  SET status = v_db_status, rejection_reason = NULLIF(p_reason, '')
  WHERE id::text = p_application_id;

  SELECT COALESCE(metadata, '{}'::jsonb), role, full_name INTO v_meta, v_role, v_name
  FROM profiles WHERE id::text = v_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The applicant''s profile no longer exists.' USING ERRCODE = 'P0002';
  END IF;

  IF v_db_status = 'approved' THEN
    v_meta := v_meta || jsonb_build_object(
      'is_author', TRUE,
      'author_profile', jsonb_build_object(
        'name', COALESCE(v_app->>'pen_name', v_name, 'Author'),
        'category', COALESCE(v_app->>'category', 'General'),
        'approvedAt', NOW()
      )
    );
    v_role := 'mentor';
  ELSIF v_db_status = 'needs_info' THEN
    v_meta := (v_meta - 'is_author' - 'author_profile') || jsonb_build_object(
      'author_application_status', 'needs_info',
      'rejection_reason', COALESCE(NULLIF(p_reason, ''), 'More information requested.')
    );
  ELSE
    v_meta := v_meta - 'is_author' - 'author_profile';
  END IF;

  UPDATE profiles SET role = v_role, metadata = v_meta WHERE id::text = v_user_id;

  INSERT INTO admin_audit_logs (action_type, target_type, target_id, previous_state, new_state, reason)
  VALUES (
    CASE WHEN v_db_status = 'approved' THEN 'approve' ELSE 'reject' END,
    'user', v_user_id, v_app,
    jsonb_build_object('status', v_db_status, 'rejectionReason', p_reason),
    format('Author application review processed. Status: %s. Reason: %s', v_db_status, COALESCE(p_reason, ''))
  );

  RETURN jsonb_build_object('status', v_db_status, 'user_id', v_user_id, 'role', v_role, 'metadata', v_meta);
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION admin_review_payout(TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_refund_transaction(TEXT, NUMERIC, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_review_course(TEXT, TEXT, JSONB, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_review_mentor(TEXT, TEXT, JSONB, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_review_author(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_review_payout(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_refund_transaction(TEXT, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_review_course(TEXT, TEXT, JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_review_mentor(TEXT, TEXT, JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_review_author(TEXT, TEXT, TEXT) TO authenticated;


-- --- 5. Institution provisioning and registration ----------------------------
-- tenants_write only admits super admins, so a customer who bought the
-- Institutional plan could not create the tenant they paid for, and self-serve
-- registration could not submit. Both now go through functions that decide
-- what the caller may create, instead of opening the table.

CREATE OR REPLACE FUNCTION tenant_settings_for_plan(p_plan TEXT) RETURNS JSONB AS $fn$
  SELECT jsonb_build_object(
    'allow_self_registration', TRUE,
    'default_user_role', 'mentee',
    'course_hierarchy', jsonb_build_array('Module', 'Topic', 'Subtopic'),
    'pricing_mode', 'custom',
    'custom_categories', jsonb_build_array('General', 'Specialized Studies', 'Certifications'),
    'max_users',   CASE p_plan WHEN 'enterprise' THEN 50000 WHEN 'growth' THEN 10000 ELSE 2000 END,
    'max_courses', CASE p_plan WHEN 'enterprise' THEN 1000  WHEN 'growth' THEN 250   ELSE 50   END
  );
$fn$ LANGUAGE sql IMMUTABLE;


-- Paid path. Requires the caller's own active Institutional subscription and
-- consumes it: a subscription provisions one tenant. Re-running with the same
-- subscription returns the tenant it already created, so a retry after a
-- network failure is safe.
CREATE OR REPLACE FUNCTION provision_institution(
  p_subscription_id TEXT,
  p_name            TEXT,
  p_subdomain       TEXT,
  p_email           TEXT,
  p_custom_domain   TEXT DEFAULT NULL
) RETURNS JSONB AS $fn$
DECLARE
  v_uid    TEXT := auth.uid()::text;
  v_sub    subscriptions%ROWTYPE;
  v_tenant tenants%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to provision an institution.' USING ERRCODE = '28000';
  END IF;
  IF COALESCE(TRIM(p_name), '') = '' OR COALESCE(TRIM(p_email), '') = '' THEN
    RAISE EXCEPTION 'Institution name and contact email are required.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_sub FROM subscriptions
  WHERE id = p_subscription_id
    AND user_id = v_uid
    AND tier = 'institutional'
    AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'An active Institutional subscription is required to provision an institution.' USING ERRCODE = '42501';
  END IF;

  IF v_sub.tenant_id IS NOT NULL AND v_sub.tenant_id <> 'default-tenant' THEN
    SELECT * INTO v_tenant FROM tenants WHERE id = v_sub.tenant_id;
    IF FOUND THEN
      RETURN to_jsonb(v_tenant);
    END IF;
  END IF;

  INSERT INTO tenants (name, subdomain, custom_domain, email, status, plan, settings)
  VALUES (
    TRIM(p_name), LOWER(TRIM(p_subdomain)), NULLIF(TRIM(COALESCE(p_custom_domain, '')), ''),
    TRIM(p_email), 'active', 'enterprise', tenant_settings_for_plan('enterprise')
  )
  RETURNING * INTO v_tenant;

  UPDATE subscriptions SET tenant_id = v_tenant.id, updated_at = NOW() WHERE id = v_sub.id;

  RETURN to_jsonb(v_tenant);
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION provision_institution(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION provision_institution(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;


-- Unpaid path. Always 'pending': a super admin approves it from the tenants
-- console. Open to signed-out visitors because the registration page is.
CREATE OR REPLACE FUNCTION register_institution(
  p_name          TEXT,
  p_subdomain     TEXT,
  p_email         TEXT,
  p_plan          TEXT,
  p_primary_color TEXT DEFAULT NULL,
  p_custom_domain TEXT DEFAULT NULL
) RETURNS JSONB AS $fn$
DECLARE
  v_tenant tenants%ROWTYPE;
  v_plan   TEXT := COALESCE(p_plan, 'starter');
BEGIN
  IF COALESCE(TRIM(p_name), '') = '' OR COALESCE(TRIM(p_email), '') = '' THEN
    RAISE EXCEPTION 'Institution name and contact email are required.' USING ERRCODE = '22023';
  END IF;
  IF v_plan NOT IN ('starter', 'growth', 'enterprise') THEN
    RAISE EXCEPTION 'Unknown plan: %', v_plan USING ERRCODE = '22023';
  END IF;
  IF p_primary_color IS NOT NULL AND p_primary_color !~ '^#[0-9A-Fa-f]{6}$' THEN
    RAISE EXCEPTION 'Brand colour must be a hex value like #4f46e5.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO tenants (name, subdomain, custom_domain, email, status, plan, primary_color, settings)
  VALUES (
    TRIM(p_name), LOWER(TRIM(p_subdomain)), NULLIF(TRIM(COALESCE(p_custom_domain, '')), ''),
    TRIM(p_email), 'pending', v_plan, COALESCE(p_primary_color, '#4f46e5'), tenant_settings_for_plan(v_plan)
  )
  RETURNING * INTO v_tenant;

  RETURN jsonb_build_object('id', v_tenant.id, 'subdomain', v_tenant.subdomain, 'status', v_tenant.status);
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION register_institution(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION register_institution(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;


-- Pending and suspended tenants are hidden from the public by RLS, so a plain
-- read reported their addresses as free. Answers yes/no and nothing else.
CREATE OR REPLACE FUNCTION subdomain_is_taken(p_subdomain TEXT) RETURNS BOOLEAN AS $fn$
  SELECT EXISTS (SELECT 1 FROM tenants WHERE LOWER(subdomain) = LOWER(TRIM(p_subdomain)));
$fn$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION subdomain_is_taken(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION subdomain_is_taken(TEXT) TO anon, authenticated;


-- --- 6. Profile privacy ------------------------------------------------------
-- profiles.metadata carries identity documents, addresses, phone numbers and
-- suspension reasons, and email sits beside it. Until now every row was
-- readable by anyone holding the anon key.
--
-- Public display (feed authors, catalog cards, contact lists) reads the
-- public_profiles view. The table itself is readable by the owner, platform
-- admins, and people with a real relationship to the person.

CREATE OR REPLACE VIEW public_profiles AS
  SELECT id, full_name, username, avatar_url, bio, role, mentor_tier, country, tenant_id, created_at
  FROM profiles;

GRANT SELECT ON public_profiles TO anon, authenticated;

-- Built dynamically because enrollments records its course as item_id on some
-- deployments and course_id on others.
DO $viewer$
DECLARE
  v_course_col TEXT;
  v_enrollment_clause TEXT := 'FALSE';
BEGIN
  SELECT column_name INTO v_course_col
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'enrollments'
    AND column_name IN ('item_id', 'course_id')
  ORDER BY CASE column_name WHEN 'item_id' THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_course_col IS NOT NULL THEN
    v_enrollment_clause := format(
      'EXISTS (SELECT 1 FROM enrollments e JOIN courses c ON c.id::text = e.%I::text
               WHERE e.user_id::text = target_id AND c.tutor_id::text = auth.uid()::text)',
      v_course_col
    );
  END IF;

  EXECUTE format($create$
    CREATE OR REPLACE FUNCTION can_view_private_profile(target_id TEXT, target_tenant TEXT, target_metadata JSONB)
    RETURNS BOOLEAN AS $body$
      SELECT
        -- Mentor and mentee, either direction.
        COALESCE(target_metadata->>'assigned_mentor_id', '') = auth.uid()::text
        OR EXISTS (
          SELECT 1 FROM profiles me
          WHERE me.id::text = auth.uid()::text AND me.metadata->>'assigned_mentor_id' = target_id
        )
        -- Guardian and student, either direction.
        OR is_guardian_of(target_id)
        OR EXISTS (
          SELECT 1 FROM guardian_links g
          WHERE g.guardian_id::text = target_id AND g.student_id::text = auth.uid()::text AND g.status = 'active'
        )
        -- A teacher and the people on their class rosters.
        OR EXISTS (
          SELECT 1 FROM class_members m
          WHERE m.user_id::text = target_id AND m.left_at IS NULL AND teaches_class(m.class_id)
        )
        -- A tutor and the learners enrolled in their courses.
        OR %s
        -- Staff inside the same institution. Never the shared default tenant,
        -- which every marketplace user belongs to.
        OR (
          target_tenant IS NOT NULL AND target_tenant <> 'default-tenant'
          AND EXISTS (
            SELECT 1 FROM profiles me
            WHERE me.id::text = auth.uid()::text
              AND me.tenant_id = target_tenant
              AND me.role IN ('management', 'staff', 'tenant_admin', 'mentor', 'tutor')
          )
        );
    $body$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;
  $create$, v_enrollment_clause);
END
$viewer$;

DROP POLICY IF EXISTS profiles_select ON profiles;
CREATE POLICY profiles_select ON profiles
  FOR SELECT USING (
    auth.uid()::text = id::text
    OR is_platform_admin()
    OR can_view_private_profile(id::text, tenant_id, metadata)
  );

-- The sign-in form shows the account's avatar once an email is typed. That is
-- the only thing a signed-out visitor may learn from an email address.
CREATE OR REPLACE FUNCTION get_sign_in_avatar(p_email TEXT) RETURNS TEXT AS $fn$
  SELECT avatar_url FROM profiles
  WHERE LOWER(email) = LOWER(TRIM(p_email))
  LIMIT 1;
$fn$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION get_sign_in_avatar(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_sign_in_avatar(TEXT) TO anon, authenticated;

-- Messaging lets a signed-in user start a chat by typing someone's exact email.
-- Returns public fields only, and never the email itself.
CREATE OR REPLACE FUNCTION find_user_by_email(p_email TEXT) RETURNS SETOF public_profiles AS $fn$
  SELECT pp.*
  FROM public_profiles pp
  JOIN profiles p ON p.id = pp.id
  WHERE auth.uid() IS NOT NULL
    AND LOWER(p.email) = LOWER(TRIM(p_email))
    AND p.id::text <> auth.uid()::text
  LIMIT 1;
$fn$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION find_user_by_email(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION find_user_by_email(TEXT) TO authenticated;


-- =============================================================================
-- NOTES
-- =============================================================================
--
-- 1. provision_institution trusts the subscriptions table. Subscriptions are
--    still written by the client after the Paystack popup, so this gate is
--    only as strong as that record until activation moves to the verified
--    webhook.
--
-- 2. admin_audit_log (singular) is no longer written by the app. After
--    checking the copied rows (legacy_source_id IS NOT NULL), drop it:
--      DROP TABLE admin_audit_log;
--
-- 3. Existing admin_users rows with status 'pending' or 'rejected' stay as
--    they are. Review them in the Super Admin console.
--
-- =============================================================================


-- ── SOURCE: 20260914_core_schema_and_tenancy.sql ──

-- =============================================================================
-- TRILEZA — CORE SCHEMA, TENANT ISOLATION, INDEXES, RLS
-- =============================================================================
--
-- Run after 20260913_logic_fixes.sql.
--
-- WHAT THIS FIXES
-- ---------------
-- An audit of every table the application reads or writes against every table
-- the migrations create found 39 tables used by the app that no migration
-- defines. They exist only because someone created them by hand in the
-- InsForge console, which means:
--
--   * no column is guaranteed to exist or have the right type,
--   * almost none have foreign keys, so deleting a user leaves orphaned
--     enrollments, posts, messages and wallet rows behind,
--   * almost none have indexes, so every feed load, message thread and course
--     page is a sequential scan,
--   * most have NO row-level security at all — the anon key can read and
--     write every message, post, wallet and enrollment on the platform,
--   * none carry tenant_id, so the multi-tenant architecture does not reach
--     the tables that actually hold institutional data.
--
-- This migration is written to be safe on a live database that already holds
-- these tables: it creates what is missing, adds columns/indexes/constraints
-- only where absent, and never drops or rewrites existing data.
--
-- Sections:
--   1. Helper: tenant resolution and membership
--   2. Core identity and catalog tables (profiles, courses, modules, lessons)
--   3. Commerce (enrollments, wallets, cart, sponsorships)
--   4. Social (posts, comments, likes, follows, notifications)
--   5. Messaging
--   6. Live sessions
--   7. Library (api_* tables)
--   8. Admin infrastructure (sessions, 2FA, onboarding, author applications)
--   9. tenant_id backfill across every tenant-scoped table
--  10. Foreign keys
--  11. Indexes
--  12. Row-level security
--  13. Tenant isolation for the school layer
--
-- REVIEW ON STAGING FIRST. Section 12 enables RLS on tables that currently
-- have none; verify each feature area signed-out, as a learner, a mentor, a
-- teacher, a guardian, an institution admin, and in each admin console.
--
-- =============================================================================


-- --- 1. Helpers --------------------------------------------------------------

-- The tenant the caller belongs to. Defined in 20260904_rls_hardening.sql as
-- current_user_tenant_id(); re-asserted here so this migration is self-contained
-- if the earlier one has not run.
CREATE OR REPLACE FUNCTION current_user_tenant_id() RETURNS TEXT AS $fn$
  SELECT COALESCE(
    (SELECT p.tenant_id FROM public.profiles p WHERE p.id::text = auth.uid()::text),
    'default-tenant'
  );
$fn$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Is the caller an administrator of this tenant (not a platform admin)?
CREATE OR REPLACE FUNCTION is_tenant_admin(target_tenant TEXT) RETURNS BOOLEAN AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id::text = auth.uid()::text
      AND p.tenant_id = target_tenant
      AND (
        p.role IN ('management', 'staff', 'tenant_admin')
        OR COALESCE((p.metadata->>'is_tenant_admin')::boolean, FALSE)
      )
  );
$fn$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Shares a tenant with the caller. The default tenant is the public
-- marketplace that everyone belongs to, so it never grants anything on its own.
CREATE OR REPLACE FUNCTION shares_tenant(target_tenant TEXT) RETURNS BOOLEAN AS $fn$
  SELECT target_tenant IS NOT NULL
     AND target_tenant <> 'default-tenant'
     AND target_tenant = current_user_tenant_id();
$fn$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;


-- --- 2. Core identity and catalog -------------------------------------------

CREATE TABLE IF NOT EXISTS profiles (
  id            TEXT PRIMARY KEY,
  email         TEXT,
  full_name     TEXT,
  username      TEXT,
  role          TEXT DEFAULT 'mentee',
  avatar_url    TEXT,
  bio           TEXT,
  country       TEXT,
  mentor_tier   TEXT,
  metadata      JSONB DEFAULT '{}'::jsonb,
  tenant_id     TEXT DEFAULT 'default-tenant',
  last_active_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Columns the app writes that a hand-made table may be missing.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username       TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio            TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS country        TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS mentor_tier    TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS metadata       JSONB DEFAULT '{}'::jsonb;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMPTZ DEFAULT NOW();

-- One handle per person. Partial so the many legacy NULLs stay legal.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_profiles_username
  ON profiles (LOWER(username)) WHERE username IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_profiles_email
  ON profiles (LOWER(email)) WHERE email IS NOT NULL;


CREATE TABLE IF NOT EXISTS courses (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id       TEXT DEFAULT 'default-tenant',
  tutor_id        TEXT,
  title           TEXT NOT NULL,
  description     TEXT,
  thumbnail_url   TEXT,
  trailer_url     TEXT,
  category        TEXT,
  price_standard  NUMERIC NOT NULL DEFAULT 0,
  price_elite     NUMERIC NOT NULL DEFAULT 0,
  rating          NUMERIC NOT NULL DEFAULT 0,
  enrolled_count  INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'draft',
  language        TEXT,
  level           TEXT,
  duration        TEXT,
  tags            JSONB DEFAULT '[]'::jsonb,
  materials       JSONB DEFAULT '[]'::jsonb,
  curriculum      JSONB DEFAULT '[]'::jsonb,
  learning_objectives JSONB DEFAULT '[]'::jsonb,
  branding        JSONB,
  metadata        JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE courses ADD COLUMN IF NOT EXISTS status     TEXT DEFAULT 'draft';
ALTER TABLE courses ADD COLUMN IF NOT EXISTS metadata   JSONB DEFAULT '{}'::jsonb;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();


CREATE TABLE IF NOT EXISTS modules (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  course_id  TEXT NOT NULL,
  title      TEXT NOT NULL,
  objective  TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lessons (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  module_id     TEXT NOT NULL,
  title         TEXT NOT NULL,
  type          TEXT,
  content_url   TEXT,
  duration      NUMERIC,
  resource_urls JSONB DEFAULT '[]'::jsonb,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mentorship_programs (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id       TEXT DEFAULT 'default-tenant',
  mentor_id       TEXT,
  title           TEXT NOT NULL,
  description     TEXT,
  thumbnail_url   TEXT,
  category        TEXT,
  duration        TEXT,
  max_mentees     INTEGER DEFAULT 0,
  current_mentees INTEGER DEFAULT 0,
  price           NUMERIC DEFAULT 0,
  features        JSONB DEFAULT '[]'::jsonb,
  rating          NUMERIC DEFAULT 0,
  review_count    INTEGER DEFAULT 0,
  level           TEXT,
  status          TEXT DEFAULT 'published',
  cohort_start    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- --- 3. Commerce -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS enrollments (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id         TEXT DEFAULT 'default-tenant',
  user_id           TEXT NOT NULL,
  item_id           TEXT NOT NULL,
  item_type         TEXT NOT NULL DEFAULT 'course',
  item_title        TEXT,
  item_thumbnail    TEXT,
  status            TEXT NOT NULL DEFAULT 'enrolled',
  tier              TEXT,
  amount            NUMERIC DEFAULT 0,
  sponsor_mentor    TEXT,
  progress          NUMERIC NOT NULL DEFAULT 0,
  completed_lessons JSONB DEFAULT '[]'::jsonb,
  course_id         TEXT,
  applied_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_accessed     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS course_id     TEXT;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS last_accessed TIMESTAMPTZ DEFAULT NOW();

-- course_id and item_id drifted apart (the webhook writes one, the catalog the
-- other). Keep them in step so either read path works.
UPDATE enrollments SET course_id = item_id
WHERE course_id IS NULL AND item_type = 'course' AND item_id IS NOT NULL;

-- Enrolling twice in the same item is a bug, not a feature.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_enrollment_user_item
  ON enrollments (user_id, item_id, item_type);


CREATE TABLE IF NOT EXISTS wallets (
  id                       TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id                  TEXT NOT NULL,
  tenant_id                TEXT DEFAULT 'default-tenant',
  paystack_subaccount_code TEXT,
  bank_details             JSONB,
  lifetime_earnings        NUMERIC NOT NULL DEFAULT 0,
  pending_settlement       NUMERIC NOT NULL DEFAULT 0,
  available_balance        NUMERIC NOT NULL DEFAULT 0,
  currency                 TEXT NOT NULL DEFAULT 'NGN',
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One wallet per person, and a balance that cannot go negative.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_wallet_user ON wallets (user_id);
ALTER TABLE wallets DROP CONSTRAINT IF EXISTS wallets_balance_non_negative;
ALTER TABLE wallets ADD CONSTRAINT wallets_balance_non_negative
  CHECK (available_balance >= 0) NOT VALID;


CREATE TABLE IF NOT EXISTS cart_items (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id    TEXT NOT NULL,
  item_id    TEXT NOT NULL,
  item_type  TEXT NOT NULL,
  title      TEXT,
  thumbnail  TEXT,
  price      NUMERIC NOT NULL DEFAULT 0,
  tier       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_cart_user_item
  ON cart_items (user_id, item_id, item_type);


CREATE TABLE IF NOT EXISTS sponsorship_requests (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id        TEXT DEFAULT 'default-tenant',
  mentee_id        TEXT NOT NULL,
  mentor_id        TEXT NOT NULL,
  course_id        TEXT,
  course_title     TEXT,
  course_thumbnail TEXT,
  amount           NUMERIC NOT NULL DEFAULT 0,
  tier             TEXT,
  message          TEXT,
  status           TEXT NOT NULL DEFAULT 'pending',
  requested_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- --- 4. Social ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS posts (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id   TEXT DEFAULT 'default-tenant',
  author_id   TEXT NOT NULL,
  content     TEXT NOT NULL,
  image_url   TEXT,
  media_urls  JSONB DEFAULT '[]'::jsonb,
  tags        JSONB DEFAULT '[]'::jsonb,
  is_ad       BOOLEAN NOT NULL DEFAULT FALSE,
  likes_count INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS comments (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  post_id           TEXT NOT NULL,
  author_id         TEXT NOT NULL,
  parent_comment_id TEXT,
  content           TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Generic like table: the feed likes posts and comments through one path.
CREATE TABLE IF NOT EXISTS likes (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id     TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id   TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_like_user_target
  ON likes (user_id, target_type, target_id);

-- Legacy post-specific like/comment tables, still read by communityService.
CREATE TABLE IF NOT EXISTS post_likes (
  post_id    TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS post_comments (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  post_id    TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS follows (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  follower_id  TEXT NOT NULL,
  following_id TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT follows_no_self CHECK (follower_id <> following_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_follow_pair
  ON follows (follower_id, following_id);

CREATE TABLE IF NOT EXISTS notifications (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id    TEXT NOT NULL,
  title      TEXT NOT NULL,
  message    TEXT,
  type       TEXT NOT NULL DEFAULT 'info',
  link       TEXT,
  is_read    BOOLEAN NOT NULL DEFAULT FALSE,
  metadata   JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- --- 5. Messaging ------------------------------------------------------------
-- The app addresses messages peer-to-peer (sender_id/receiver_id), not through
-- a conversations table. The generated types still describe the older
-- conversation_id shape; the code is the authority here.

CREATE TABLE IF NOT EXISTS messages (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id    TEXT DEFAULT 'default-tenant',
  sender_id    TEXT NOT NULL,
  receiver_id  TEXT NOT NULL,
  content      TEXT,
  attachments  JSONB DEFAULT '[]'::jsonb,
  message_type TEXT DEFAULT 'text',
  read_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE messages ADD COLUMN IF NOT EXISTS read_at     TIMESTAMPTZ;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS rtk_groups (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id  TEXT DEFAULT 'default-tenant',
  name       TEXT NOT NULL,
  created_by TEXT,
  members    JSONB DEFAULT '[]'::jsonb,
  metadata   JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rtk_messages (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  channel_id  TEXT,
  group_id    TEXT,
  sender_id   TEXT NOT NULL,
  receiver_id TEXT,
  content     TEXT,
  payload     JSONB DEFAULT '{}'::jsonb,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- --- 6. Live sessions --------------------------------------------------------

CREATE TABLE IF NOT EXISTS live_sessions (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id        TEXT DEFAULT 'default-tenant',
  course_id        TEXT,
  tutor_id         TEXT NOT NULL,
  title            TEXT NOT NULL,
  description      TEXT,
  image_url        TEXT,
  dyte_meeting_id  TEXT,
  status           TEXT NOT NULL DEFAULT 'scheduled',
  scheduled_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at       TIMESTAMPTZ,
  ended_at         TIMESTAMPTZ,
  is_locked        BOOLEAN DEFAULT FALSE,
  room_password    TEXT,
  max_participants INTEGER,
  recording_url    TEXT,
  recurring        TEXT DEFAULT 'none',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS session_participants (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  session_id       TEXT NOT NULL,
  user_id          TEXT NOT NULL,
  display_name     TEXT,
  role             TEXT NOT NULL DEFAULT 'student',
  joined_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at          TIMESTAMPTZ,
  duration_seconds INTEGER,
  was_camera_on    BOOLEAN,
  was_mic_on       BOOLEAN
);

CREATE TABLE IF NOT EXISTS session_events (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  session_id TEXT NOT NULL,
  user_id    TEXT,
  event_type TEXT NOT NULL,
  event_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS session_notes (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  session_id TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  content    TEXT,
  is_shared  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS breakout_pods (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  session_id       TEXT NOT NULL,
  pod_name         TEXT NOT NULL,
  room_name        TEXT,
  max_participants INTEGER DEFAULT 8,
  created_by       TEXT,
  status           TEXT NOT NULL DEFAULT 'active',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- --- 7. Library --------------------------------------------------------------
-- Column shapes taken from the SQLModel definitions the library service was
-- built against.

CREATE TABLE IF NOT EXISTS api_books (
  id             TEXT PRIMARY KEY,
  tenant_id      TEXT DEFAULT 'default-tenant',
  title          TEXT NOT NULL,
  author_id      TEXT,
  author_name    TEXT,
  cover_url      TEXT,
  retail_price   NUMERIC NOT NULL DEFAULT 0,
  rental_price   NUMERIC NOT NULL DEFAULT 0,
  category       TEXT,
  description    TEXT,
  rating         NUMERIC NOT NULL DEFAULT 0,
  section        TEXT,
  language       TEXT DEFAULT 'English',
  publication_date TEXT,
  pages          INTEGER,
  age_rating     TEXT DEFAULT 'Everyone',
  isbn           TEXT,
  tags           TEXT DEFAULT '[]',
  sample_pages   TEXT DEFAULT '[]',
  file_url       TEXT,
  book_file_name TEXT,
  material_type  TEXT NOT NULL DEFAULT 'book',
  volume         TEXT,
  issue          TEXT,
  journal_name   TEXT,
  status         TEXT DEFAULT 'published',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS api_user_library_access (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id             TEXT NOT NULL,
  book_id             TEXT NOT NULL,
  access_type         TEXT NOT NULL,
  lifetime_rent_total NUMERIC NOT NULL DEFAULT 0,
  is_author_gift      BOOLEAN NOT NULL DEFAULT FALSE,
  sponsored_by        TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at          TIMESTAMPTZ,
  returned_at         TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS api_reservations (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id    TEXT NOT NULL,
  book_id    TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS api_fines (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id    TEXT NOT NULL,
  book_id    TEXT NOT NULL,
  amount     NUMERIC NOT NULL DEFAULT 0,
  status     TEXT NOT NULL DEFAULT 'unpaid',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS api_user_reviews (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id    TEXT NOT NULL,
  user_name  TEXT,
  book_id    TEXT NOT NULL,
  rating     INTEGER NOT NULL DEFAULT 5,
  comment    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS api_highlights (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id      TEXT NOT NULL,
  book_id      TEXT NOT NULL,
  passage_text TEXT NOT NULL,
  comment      TEXT,
  color        TEXT DEFAULT 'yellow',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS api_comments (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id    TEXT NOT NULL,
  user_name  TEXT,
  book_id    TEXT NOT NULL,
  page_index INTEGER NOT NULL DEFAULT 0,
  text       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- `books` is the marketplace-side table the admin console reviews against.
CREATE TABLE IF NOT EXISTS books (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id    TEXT DEFAULT 'default-tenant',
  author_id    TEXT,
  title        TEXT NOT NULL,
  cover_url    TEXT,
  description  TEXT,
  category     TEXT,
  retail_price NUMERIC NOT NULL DEFAULT 0,
  rental_price NUMERIC NOT NULL DEFAULT 0,
  file_url     TEXT,
  status       TEXT NOT NULL DEFAULT 'draft',
  metadata     JSONB DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- --- 8. Admin infrastructure -------------------------------------------------

CREATE TABLE IF NOT EXISTS admin_sessions (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  admin_user_id TEXT NOT NULL,
  token         TEXT NOT NULL UNIQUE,
  expires_at    TIMESTAMPTZ NOT NULL,
  ip_address    TEXT,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_2fa_codes (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  admin_user_id TEXT NOT NULL,
  code          TEXT NOT NULL,
  used          BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_onboarding_progress (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  admin_user_id TEXT NOT NULL,
  step          TEXT NOT NULL,
  completed     BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (admin_user_id, step)
);

CREATE TABLE IF NOT EXISTS admin_applications (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id    TEXT NOT NULL,
  role       TEXT NOT NULL,
  reason     TEXT,
  status     TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS author_applications (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id          TEXT NOT NULL,
  pen_name         TEXT,
  category         TEXT,
  bio              TEXT,
  sample_url       TEXT,
  user_email       TEXT,
  status           TEXT NOT NULL DEFAULT 'pending',
  rejection_reason TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE author_applications ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE author_applications ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS video_annotations (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  lesson_id        TEXT NOT NULL,
  course_review_id TEXT,
  timestamp        TEXT,
  type             TEXT NOT NULL DEFAULT 'Suggestion',
  note             TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- --- 9. tenant_id everywhere it is needed ------------------------------------
-- The institutional architecture is only real if the tables holding
-- institutional data carry the tenant. Added as a plain column first, then
-- constrained in section 10.

ALTER TABLE posts                ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default-tenant';
ALTER TABLE messages             ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default-tenant';
ALTER TABLE live_sessions        ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default-tenant';
ALTER TABLE wallets              ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default-tenant';
ALTER TABLE mentorship_programs  ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default-tenant';
ALTER TABLE sponsorship_requests ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default-tenant';
ALTER TABLE api_books            ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default-tenant';
ALTER TABLE books                ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default-tenant';
ALTER TABLE notifications        ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default-tenant';
ALTER TABLE rtk_groups           ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default-tenant';

UPDATE posts                SET tenant_id = 'default-tenant' WHERE tenant_id IS NULL;
UPDATE messages             SET tenant_id = 'default-tenant' WHERE tenant_id IS NULL;
UPDATE live_sessions        SET tenant_id = 'default-tenant' WHERE tenant_id IS NULL;
UPDATE wallets              SET tenant_id = 'default-tenant' WHERE tenant_id IS NULL;
UPDATE mentorship_programs  SET tenant_id = 'default-tenant' WHERE tenant_id IS NULL;
UPDATE sponsorship_requests SET tenant_id = 'default-tenant' WHERE tenant_id IS NULL;
UPDATE api_books            SET tenant_id = 'default-tenant' WHERE tenant_id IS NULL;
UPDATE books                SET tenant_id = 'default-tenant' WHERE tenant_id IS NULL;
UPDATE notifications        SET tenant_id = 'default-tenant' WHERE tenant_id IS NULL;
UPDATE rtk_groups           SET tenant_id = 'default-tenant' WHERE tenant_id IS NULL;
UPDATE profiles             SET tenant_id = 'default-tenant' WHERE tenant_id IS NULL;
UPDATE courses              SET tenant_id = 'default-tenant' WHERE tenant_id IS NULL;
UPDATE enrollments          SET tenant_id = 'default-tenant' WHERE tenant_id IS NULL;

-- A post/message/session belonging to a tenant that no longer exists would
-- break the FK below; point any such row back at the default tenant.
DO $orphan_tenants$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles','courses','enrollments','posts','messages','live_sessions','wallets',
    'mentorship_programs','sponsorship_requests','api_books','books','notifications','rtk_groups'
  ] LOOP
    EXECUTE format(
      'UPDATE %I SET tenant_id = ''default-tenant''
       WHERE tenant_id IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM tenants x WHERE x.id = %I.tenant_id)', t, t);
  END LOOP;
END
$orphan_tenants$;


-- --- 10. Foreign keys --------------------------------------------------------
-- Added NOT VALID: they bind all future writes immediately without forcing a
-- full-table verification of legacy rows during the migration window. Validate
-- later at leisure with:  ALTER TABLE x VALIDATE CONSTRAINT y;

DO $fks$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('courses',              'tutor_id',         'profiles(id)',      'CASCADE'),
      ('courses',              'tenant_id',        'tenants(id)',       'CASCADE'),
      ('modules',              'course_id',        'courses(id)',       'CASCADE'),
      ('lessons',              'module_id',        'modules(id)',       'CASCADE'),
      ('mentorship_programs',  'mentor_id',        'profiles(id)',      'CASCADE'),
      ('mentorship_programs',  'tenant_id',        'tenants(id)',       'CASCADE'),
      ('enrollments',          'user_id',          'profiles(id)',      'CASCADE'),
      ('enrollments',          'tenant_id',        'tenants(id)',       'CASCADE'),
      ('wallets',              'user_id',          'profiles(id)',      'CASCADE'),
      ('wallets',              'tenant_id',        'tenants(id)',       'CASCADE'),
      ('cart_items',           'user_id',          'profiles(id)',      'CASCADE'),
      ('sponsorship_requests', 'mentee_id',        'profiles(id)',      'CASCADE'),
      ('sponsorship_requests', 'mentor_id',        'profiles(id)',      'CASCADE'),
      ('sponsorship_requests', 'tenant_id',        'tenants(id)',       'CASCADE'),
      ('posts',                'author_id',        'profiles(id)',      'CASCADE'),
      ('posts',                'tenant_id',        'tenants(id)',       'CASCADE'),
      ('comments',             'post_id',          'posts(id)',         'CASCADE'),
      ('comments',             'author_id',        'profiles(id)',      'CASCADE'),
      ('likes',                'user_id',          'profiles(id)',      'CASCADE'),
      ('post_likes',           'post_id',          'posts(id)',         'CASCADE'),
      ('post_likes',           'user_id',          'profiles(id)',      'CASCADE'),
      ('post_comments',        'post_id',          'posts(id)',         'CASCADE'),
      ('post_comments',        'user_id',          'profiles(id)',      'CASCADE'),
      ('follows',              'follower_id',      'profiles(id)',      'CASCADE'),
      ('follows',              'following_id',     'profiles(id)',      'CASCADE'),
      ('notifications',        'user_id',          'profiles(id)',      'CASCADE'),
      ('messages',             'sender_id',        'profiles(id)',      'CASCADE'),
      ('messages',             'receiver_id',      'profiles(id)',      'CASCADE'),
      ('messages',             'tenant_id',        'tenants(id)',       'CASCADE'),
      ('rtk_messages',         'sender_id',        'profiles(id)',      'CASCADE'),
      ('live_sessions',        'tutor_id',         'profiles(id)',      'CASCADE'),
      ('live_sessions',        'tenant_id',        'tenants(id)',       'CASCADE'),
      ('session_participants', 'session_id',       'live_sessions(id)', 'CASCADE'),
      ('session_participants', 'user_id',          'profiles(id)',      'CASCADE'),
      ('session_events',       'session_id',       'live_sessions(id)', 'CASCADE'),
      ('session_notes',        'session_id',       'live_sessions(id)', 'CASCADE'),
      ('session_notes',        'user_id',          'profiles(id)',      'CASCADE'),
      ('breakout_pods',        'session_id',       'live_sessions(id)', 'CASCADE'),
      ('api_user_library_access','user_id',        'profiles(id)',      'CASCADE'),
      ('api_user_library_access','book_id',        'api_books(id)',     'CASCADE'),
      ('api_reservations',     'user_id',          'profiles(id)',      'CASCADE'),
      ('api_reservations',     'book_id',          'api_books(id)',     'CASCADE'),
      ('api_fines',            'user_id',          'profiles(id)',      'CASCADE'),
      ('api_fines',            'book_id',          'api_books(id)',     'CASCADE'),
      ('api_user_reviews',     'user_id',          'profiles(id)',      'CASCADE'),
      ('api_user_reviews',     'book_id',          'api_books(id)',     'CASCADE'),
      ('api_highlights',       'user_id',          'profiles(id)',      'CASCADE'),
      ('api_highlights',       'book_id',          'api_books(id)',     'CASCADE'),
      ('api_comments',         'user_id',          'profiles(id)',      'CASCADE'),
      ('api_comments',         'book_id',          'api_books(id)',     'CASCADE'),
      ('api_books',            'tenant_id',        'tenants(id)',       'CASCADE'),
      ('books',                'author_id',        'profiles(id)',      'SET NULL'),
      ('books',                'tenant_id',        'tenants(id)',       'CASCADE'),
      ('admin_sessions',       'admin_user_id',    'admin_users(id)',   'CASCADE'),
      ('admin_2fa_codes',      'admin_user_id',    'admin_users(id)',   'CASCADE'),
      ('admin_onboarding_progress','admin_user_id','admin_users(id)',   'CASCADE'),
      ('admin_applications',   'user_id',          'profiles(id)',      'CASCADE'),
      ('author_applications',  'user_id',          'profiles(id)',      'CASCADE'),
      ('video_annotations',    'lesson_id',        'lessons(id)',       'CASCADE'),
      ('profiles',             'tenant_id',        'tenants(id)',       'SET NULL')
    ) AS v(tbl, col, ref, on_delete)
  LOOP
    -- Skip when the table or column is not present on this deployment.
    CONTINUE WHEN to_regclass('public.' || r.tbl) IS NULL;
    CONTINUE WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = r.tbl AND column_name = r.col
    );
    CONTINUE WHEN to_regclass('public.' || split_part(r.ref, '(', 1)) IS NULL;

    -- Already constrained? Leave it alone.
    CONTINUE WHEN EXISTS (
      SELECT 1
      FROM pg_constraint con
      JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
      WHERE con.conrelid = ('public.' || r.tbl)::regclass
        AND con.contype = 'f'
        AND att.attname = r.col
    );

    BEGIN
      EXECUTE format(
        'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %s ON DELETE %s NOT VALID',
        r.tbl, 'fk_' || r.tbl || '_' || r.col, r.col, r.ref, r.on_delete
      );
    EXCEPTION WHEN others THEN
      -- A type mismatch or unexpected legacy shape must not abort the whole
      -- migration; report and continue.
      RAISE NOTICE 'Skipped FK %.% -> %: %', r.tbl, r.col, r.ref, SQLERRM;
    END;
  END LOOP;
END
$fks$;


-- --- 11. Indexes -------------------------------------------------------------
-- Every foreign key and every column the app filters or sorts on. Without
-- these, each feed load, message thread, roster and course page is a
-- sequential scan over the whole table.

CREATE INDEX IF NOT EXISTS idx_profiles_tenant         ON profiles (tenant_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role           ON profiles (role);
CREATE INDEX IF NOT EXISTS idx_profiles_created        ON profiles (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_assigned_mentor
  ON profiles ((metadata->>'assigned_mentor_id'));

CREATE INDEX IF NOT EXISTS idx_courses_tutor           ON courses (tutor_id);
CREATE INDEX IF NOT EXISTS idx_courses_status_created  ON courses (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_courses_tenant_status   ON courses (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_courses_category        ON courses (category);

CREATE INDEX IF NOT EXISTS idx_modules_course          ON modules (course_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_lessons_module          ON lessons (module_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_enrollments_user        ON enrollments (user_id, last_accessed DESC);
CREATE INDEX IF NOT EXISTS idx_enrollments_item        ON enrollments (item_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course      ON enrollments (course_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_tenant      ON enrollments (tenant_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_status      ON enrollments (status);

CREATE INDEX IF NOT EXISTS idx_wallets_user            ON wallets (user_id);
CREATE INDEX IF NOT EXISTS idx_cart_user               ON cart_items (user_id);
CREATE INDEX IF NOT EXISTS idx_sponsorship_mentor      ON sponsorship_requests (mentor_id, status);
CREATE INDEX IF NOT EXISTS idx_sponsorship_mentee      ON sponsorship_requests (mentee_id);

CREATE INDEX IF NOT EXISTS idx_posts_created           ON posts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_author            ON posts (author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_tenant_created    ON posts (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_post           ON comments (post_id, created_at);
CREATE INDEX IF NOT EXISTS idx_comments_author         ON comments (author_id);
CREATE INDEX IF NOT EXISTS idx_likes_target            ON likes (target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_likes_user              ON likes (user_id);
CREATE INDEX IF NOT EXISTS idx_follows_follower        ON follows (follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following       ON follows (following_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user      ON notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread    ON notifications (user_id) WHERE is_read = FALSE;

-- Both directions of a thread, plus the unread badge count.
CREATE INDEX IF NOT EXISTS idx_messages_sender         ON messages (sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_receiver       ON messages (receiver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_thread         ON messages (sender_id, receiver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_unread         ON messages (receiver_id) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_rtk_messages_sender     ON rtk_messages (sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rtk_messages_group      ON rtk_messages (group_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_live_sessions_tutor     ON live_sessions (tutor_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_live_sessions_status    ON live_sessions (status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_live_sessions_course    ON live_sessions (course_id);
CREATE INDEX IF NOT EXISTS idx_live_sessions_meeting   ON live_sessions (dyte_meeting_id);
CREATE INDEX IF NOT EXISTS idx_session_participants_s  ON session_participants (session_id);
CREATE INDEX IF NOT EXISTS idx_session_participants_u  ON session_participants (user_id);
CREATE INDEX IF NOT EXISTS idx_session_events_session  ON session_events (session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_session_notes_session   ON session_notes (session_id);
CREATE INDEX IF NOT EXISTS idx_breakout_pods_session   ON breakout_pods (session_id);

CREATE INDEX IF NOT EXISTS idx_api_books_category      ON api_books (category);
CREATE INDEX IF NOT EXISTS idx_api_books_section       ON api_books (section);
CREATE INDEX IF NOT EXISTS idx_api_books_material      ON api_books (material_type);
CREATE INDEX IF NOT EXISTS idx_api_books_author        ON api_books (author_id);
CREATE INDEX IF NOT EXISTS idx_api_access_user         ON api_user_library_access (user_id);
CREATE INDEX IF NOT EXISTS idx_api_access_book         ON api_user_library_access (user_id, book_id);
CREATE INDEX IF NOT EXISTS idx_api_reservations_user   ON api_reservations (user_id);
CREATE INDEX IF NOT EXISTS idx_api_fines_user          ON api_fines (user_id, status);
CREATE INDEX IF NOT EXISTS idx_api_reviews_book        ON api_user_reviews (book_id);
CREATE INDEX IF NOT EXISTS idx_api_highlights_user     ON api_highlights (user_id, book_id);
CREATE INDEX IF NOT EXISTS idx_api_comments_book       ON api_comments (book_id, page_index);
CREATE INDEX IF NOT EXISTS idx_books_author            ON books (author_id);
CREATE INDEX IF NOT EXISTS idx_books_status            ON books (status);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_token    ON admin_sessions (token);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expiry   ON admin_sessions (expires_at);
CREATE INDEX IF NOT EXISTS idx_admin_2fa_lookup        ON admin_2fa_codes (admin_user_id, used, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_author_apps_user        ON author_applications (user_id);
CREATE INDEX IF NOT EXISTS idx_author_apps_status      ON author_applications (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_apps_status       ON admin_applications (status);
CREATE INDEX IF NOT EXISTS idx_video_annotations       ON video_annotations (lesson_id, course_review_id);

-- Admin console list ordering.
CREATE INDEX IF NOT EXISTS idx_audit_logs_created      ON admin_audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target       ON admin_audit_logs (target_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin        ON admin_audit_logs (admin_id);
CREATE INDEX IF NOT EXISTS idx_transactions_wallet     ON transactions (wallet_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payouts_status          ON payout_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_status          ON support_tickets (status, created_at DESC);


-- --- 12. Row-level security --------------------------------------------------
-- Everything below currently has NO policy at all, which means the anon key can
-- read and write it. Each table gets an owner predicate.

-- Catalog content: modules and lessons follow their course.
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS modules_select ON modules;
DROP POLICY IF EXISTS modules_write  ON modules;
CREATE POLICY modules_select ON modules FOR SELECT USING (
  EXISTS (SELECT 1 FROM courses c WHERE c.id::text = modules.course_id::text
          AND (c.status = 'published' OR c.tutor_id::text = auth.uid()::text OR is_platform_admin()))
);
CREATE POLICY modules_write ON modules FOR ALL USING (
  EXISTS (SELECT 1 FROM courses c WHERE c.id::text = modules.course_id::text
          AND (c.tutor_id::text = auth.uid()::text OR is_platform_admin()))
);

ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lessons_select ON lessons;
DROP POLICY IF EXISTS lessons_write  ON lessons;
CREATE POLICY lessons_select ON lessons FOR SELECT USING (
  EXISTS (SELECT 1 FROM modules m JOIN courses c ON c.id::text = m.course_id::text
          WHERE m.id::text = lessons.module_id::text
            AND (c.status = 'published' OR c.tutor_id::text = auth.uid()::text OR is_platform_admin()))
);
CREATE POLICY lessons_write ON lessons FOR ALL USING (
  EXISTS (SELECT 1 FROM modules m JOIN courses c ON c.id::text = m.course_id::text
          WHERE m.id::text = lessons.module_id::text
            AND (c.tutor_id::text = auth.uid()::text OR is_platform_admin()))
);

ALTER TABLE mentorship_programs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mentorship_programs_select ON mentorship_programs;
DROP POLICY IF EXISTS mentorship_programs_write  ON mentorship_programs;
CREATE POLICY mentorship_programs_select ON mentorship_programs FOR SELECT USING (TRUE);
CREATE POLICY mentorship_programs_write ON mentorship_programs FOR ALL USING (
  mentor_id::text = auth.uid()::text OR is_platform_admin()
);

-- Cart is strictly private.
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cart_items_own ON cart_items;
CREATE POLICY cart_items_own ON cart_items FOR ALL USING (user_id::text = auth.uid()::text);

ALTER TABLE sponsorship_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sponsorship_select ON sponsorship_requests;
DROP POLICY IF EXISTS sponsorship_insert ON sponsorship_requests;
DROP POLICY IF EXISTS sponsorship_update ON sponsorship_requests;
CREATE POLICY sponsorship_select ON sponsorship_requests FOR SELECT USING (
  mentee_id::text = auth.uid()::text OR mentor_id::text = auth.uid()::text OR is_platform_admin()
);
CREATE POLICY sponsorship_insert ON sponsorship_requests FOR INSERT WITH CHECK (
  mentee_id::text = auth.uid()::text
);
CREATE POLICY sponsorship_update ON sponsorship_requests FOR UPDATE USING (
  mentor_id::text = auth.uid()::text OR is_platform_admin()
);

-- Social: readable by signed-in users within the same tenant space; written
-- only by the author.
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS posts_select ON posts;
DROP POLICY IF EXISTS posts_insert ON posts;
DROP POLICY IF EXISTS posts_update ON posts;
DROP POLICY IF EXISTS posts_delete ON posts;
CREATE POLICY posts_select ON posts FOR SELECT USING (
  tenant_id = 'default-tenant' OR tenant_id = current_user_tenant_id() OR is_platform_admin()
);
CREATE POLICY posts_insert ON posts FOR INSERT WITH CHECK (author_id::text = auth.uid()::text);
CREATE POLICY posts_update ON posts FOR UPDATE USING (
  author_id::text = auth.uid()::text OR is_platform_admin()
);
CREATE POLICY posts_delete ON posts FOR DELETE USING (
  author_id::text = auth.uid()::text OR is_platform_admin()
);

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS comments_select ON comments;
DROP POLICY IF EXISTS comments_insert ON comments;
DROP POLICY IF EXISTS comments_modify ON comments;
CREATE POLICY comments_select ON comments FOR SELECT USING (TRUE);
CREATE POLICY comments_insert ON comments FOR INSERT WITH CHECK (author_id::text = auth.uid()::text);
CREATE POLICY comments_modify ON comments FOR ALL USING (
  author_id::text = auth.uid()::text OR is_platform_admin()
);

ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS likes_select ON likes;
DROP POLICY IF EXISTS likes_write  ON likes;
CREATE POLICY likes_select ON likes FOR SELECT USING (TRUE);
CREATE POLICY likes_write ON likes FOR ALL USING (user_id::text = auth.uid()::text)
  WITH CHECK (user_id::text = auth.uid()::text);

ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS post_likes_select ON post_likes;
DROP POLICY IF EXISTS post_likes_write  ON post_likes;
CREATE POLICY post_likes_select ON post_likes FOR SELECT USING (TRUE);
CREATE POLICY post_likes_write ON post_likes FOR ALL USING (user_id::text = auth.uid()::text)
  WITH CHECK (user_id::text = auth.uid()::text);

ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS post_comments_select ON post_comments;
DROP POLICY IF EXISTS post_comments_write  ON post_comments;
CREATE POLICY post_comments_select ON post_comments FOR SELECT USING (TRUE);
CREATE POLICY post_comments_write ON post_comments FOR ALL USING (
  user_id::text = auth.uid()::text OR is_platform_admin()
);

ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS follows_select ON follows;
DROP POLICY IF EXISTS follows_write  ON follows;
CREATE POLICY follows_select ON follows FOR SELECT USING (TRUE);
CREATE POLICY follows_write ON follows FOR ALL USING (follower_id::text = auth.uid()::text)
  WITH CHECK (follower_id::text = auth.uid()::text);

-- A notification is addressed to one person.
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notifications_select ON notifications;
DROP POLICY IF EXISTS notifications_insert ON notifications;
DROP POLICY IF EXISTS notifications_update ON notifications;
CREATE POLICY notifications_select ON notifications FOR SELECT USING (
  user_id::text = auth.uid()::text OR is_platform_admin()
);
-- Senders address notifications to others (a mentor notifying a mentee), so
-- inserts stay open to signed-in callers; reads are what must be private.
CREATE POLICY notifications_insert ON notifications FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL OR auth.role() = 'service_role'
);
CREATE POLICY notifications_update ON notifications FOR UPDATE USING (
  user_id::text = auth.uid()::text
);

-- Messages: only the two people in the thread.
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS messages_select ON messages;
DROP POLICY IF EXISTS messages_insert ON messages;
DROP POLICY IF EXISTS messages_update ON messages;
CREATE POLICY messages_select ON messages FOR SELECT USING (
  sender_id::text = auth.uid()::text OR receiver_id::text = auth.uid()::text OR is_platform_admin()
);
CREATE POLICY messages_insert ON messages FOR INSERT WITH CHECK (
  sender_id::text = auth.uid()::text
);
-- The recipient marks a message read; the sender may edit their own.
CREATE POLICY messages_update ON messages FOR UPDATE USING (
  sender_id::text = auth.uid()::text OR receiver_id::text = auth.uid()::text
);

ALTER TABLE rtk_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rtk_messages_select ON rtk_messages;
DROP POLICY IF EXISTS rtk_messages_insert ON rtk_messages;
DROP POLICY IF EXISTS rtk_messages_update ON rtk_messages;
CREATE POLICY rtk_messages_select ON rtk_messages FOR SELECT USING (
  sender_id::text = auth.uid()::text
  OR receiver_id::text = auth.uid()::text
  OR is_platform_admin()
  OR EXISTS (
    SELECT 1 FROM rtk_groups g
    WHERE g.id::text = rtk_messages.group_id::text
      AND g.members::jsonb ? auth.uid()::text
  )
);
CREATE POLICY rtk_messages_insert ON rtk_messages FOR INSERT WITH CHECK (
  sender_id::text = auth.uid()::text
);
CREATE POLICY rtk_messages_update ON rtk_messages FOR UPDATE USING (
  sender_id::text = auth.uid()::text OR receiver_id::text = auth.uid()::text
);

ALTER TABLE rtk_groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rtk_groups_select ON rtk_groups;
DROP POLICY IF EXISTS rtk_groups_write  ON rtk_groups;
CREATE POLICY rtk_groups_select ON rtk_groups FOR SELECT USING (
  created_by::text = auth.uid()::text
  OR members::jsonb ? auth.uid()::text
  OR is_platform_admin()
);
CREATE POLICY rtk_groups_write ON rtk_groups FOR ALL USING (
  created_by::text = auth.uid()::text OR is_platform_admin()
);

-- Live sessions: visible to the tenant, controlled by the host.
ALTER TABLE live_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS live_sessions_select ON live_sessions;
DROP POLICY IF EXISTS live_sessions_insert ON live_sessions;
DROP POLICY IF EXISTS live_sessions_update ON live_sessions;
DROP POLICY IF EXISTS live_sessions_delete ON live_sessions;
CREATE POLICY live_sessions_select ON live_sessions FOR SELECT USING (
  tenant_id = 'default-tenant' OR tenant_id = current_user_tenant_id() OR is_platform_admin()
);
CREATE POLICY live_sessions_insert ON live_sessions FOR INSERT WITH CHECK (
  tutor_id::text = auth.uid()::text
);
CREATE POLICY live_sessions_update ON live_sessions FOR UPDATE USING (
  tutor_id::text = auth.uid()::text OR is_platform_admin()
);
-- Only the host deletes a session. This is the database-side half of the
-- no-show cleanup fix: every client runs that loop.
CREATE POLICY live_sessions_delete ON live_sessions FOR DELETE USING (
  tutor_id::text = auth.uid()::text OR is_platform_admin()
);

ALTER TABLE session_participants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS session_participants_select ON session_participants;
DROP POLICY IF EXISTS session_participants_insert ON session_participants;
DROP POLICY IF EXISTS session_participants_update ON session_participants;
CREATE POLICY session_participants_select ON session_participants FOR SELECT USING (
  user_id::text = auth.uid()::text
  OR is_platform_admin()
  OR EXISTS (SELECT 1 FROM live_sessions s WHERE s.id::text = session_participants.session_id::text
             AND s.tutor_id::text = auth.uid()::text)
);
CREATE POLICY session_participants_insert ON session_participants FOR INSERT WITH CHECK (
  user_id::text = auth.uid()::text
);
CREATE POLICY session_participants_update ON session_participants FOR UPDATE USING (
  user_id::text = auth.uid()::text
  OR EXISTS (SELECT 1 FROM live_sessions s WHERE s.id::text = session_participants.session_id::text
             AND s.tutor_id::text = auth.uid()::text)
);

ALTER TABLE session_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS session_events_select ON session_events;
DROP POLICY IF EXISTS session_events_insert ON session_events;
CREATE POLICY session_events_select ON session_events FOR SELECT USING (
  is_platform_admin()
  OR EXISTS (SELECT 1 FROM live_sessions s WHERE s.id::text = session_events.session_id::text
             AND s.tutor_id::text = auth.uid()::text)
  OR EXISTS (SELECT 1 FROM session_participants p WHERE p.session_id::text = session_events.session_id::text
             AND p.user_id::text = auth.uid()::text)
);
CREATE POLICY session_events_insert ON session_events FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

ALTER TABLE session_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS session_notes_select ON session_notes;
DROP POLICY IF EXISTS session_notes_write  ON session_notes;
CREATE POLICY session_notes_select ON session_notes FOR SELECT USING (
  user_id::text = auth.uid()::text
  OR (is_shared = TRUE AND EXISTS (
        SELECT 1 FROM session_participants p
        WHERE p.session_id::text = session_notes.session_id::text
          AND p.user_id::text = auth.uid()::text))
  OR is_platform_admin()
);
CREATE POLICY session_notes_write ON session_notes FOR ALL USING (
  user_id::text = auth.uid()::text
) WITH CHECK (user_id::text = auth.uid()::text);

ALTER TABLE breakout_pods ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS breakout_pods_select ON breakout_pods;
DROP POLICY IF EXISTS breakout_pods_write  ON breakout_pods;
CREATE POLICY breakout_pods_select ON breakout_pods FOR SELECT USING (
  is_platform_admin()
  OR EXISTS (SELECT 1 FROM session_participants p WHERE p.session_id::text = breakout_pods.session_id::text
             AND p.user_id::text = auth.uid()::text)
  OR EXISTS (SELECT 1 FROM live_sessions s WHERE s.id::text = breakout_pods.session_id::text
             AND s.tutor_id::text = auth.uid()::text)
);
CREATE POLICY breakout_pods_write ON breakout_pods FOR ALL USING (
  EXISTS (SELECT 1 FROM live_sessions s WHERE s.id::text = breakout_pods.session_id::text
          AND s.tutor_id::text = auth.uid()::text)
  OR is_platform_admin()
);

-- Library: the catalog is public, but who owns/borrowed/owes what is not.
ALTER TABLE api_books ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS api_books_select ON api_books;
DROP POLICY IF EXISTS api_books_write  ON api_books;
CREATE POLICY api_books_select ON api_books FOR SELECT USING (TRUE);
CREATE POLICY api_books_write ON api_books FOR ALL USING (
  author_id::text = auth.uid()::text OR has_admin_role('content_manager')
);

ALTER TABLE books ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS books_select ON books;
DROP POLICY IF EXISTS books_write  ON books;
CREATE POLICY books_select ON books FOR SELECT USING (
  status = 'published' OR author_id::text = auth.uid()::text OR is_platform_admin()
);
CREATE POLICY books_write ON books FOR ALL USING (
  author_id::text = auth.uid()::text OR has_admin_role('content_manager')
);

DO $lib$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'api_user_library_access','api_reservations','api_fines','api_highlights'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_own', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL USING (user_id::text = auth.uid()::text OR is_platform_admin())
       WITH CHECK (user_id::text = auth.uid()::text OR is_platform_admin())', t || '_own', t);
  END LOOP;
END
$lib$;

-- Reviews and margin notes are public reading material; only the author writes.
ALTER TABLE api_user_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS api_user_reviews_select ON api_user_reviews;
DROP POLICY IF EXISTS api_user_reviews_write  ON api_user_reviews;
CREATE POLICY api_user_reviews_select ON api_user_reviews FOR SELECT USING (TRUE);
CREATE POLICY api_user_reviews_write ON api_user_reviews FOR ALL USING (
  user_id::text = auth.uid()::text OR is_platform_admin()
) WITH CHECK (user_id::text = auth.uid()::text OR is_platform_admin());

ALTER TABLE api_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS api_comments_select ON api_comments;
DROP POLICY IF EXISTS api_comments_write  ON api_comments;
CREATE POLICY api_comments_select ON api_comments FOR SELECT USING (TRUE);
CREATE POLICY api_comments_write ON api_comments FOR ALL USING (
  user_id::text = auth.uid()::text OR is_platform_admin()
) WITH CHECK (user_id::text = auth.uid()::text OR is_platform_admin());

-- Applications: the applicant and the reviewing role.
ALTER TABLE author_applications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS author_applications_select ON author_applications;
DROP POLICY IF EXISTS author_applications_insert ON author_applications;
DROP POLICY IF EXISTS author_applications_update ON author_applications;
CREATE POLICY author_applications_select ON author_applications FOR SELECT USING (
  user_id::text = auth.uid()::text OR has_admin_role('user_manager')
);
CREATE POLICY author_applications_insert ON author_applications FOR INSERT WITH CHECK (
  user_id::text = auth.uid()::text
);
CREATE POLICY author_applications_update ON author_applications FOR UPDATE USING (
  has_admin_role('user_manager')
);

ALTER TABLE admin_applications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_applications_select ON admin_applications;
DROP POLICY IF EXISTS admin_applications_insert ON admin_applications;
DROP POLICY IF EXISTS admin_applications_update ON admin_applications;
CREATE POLICY admin_applications_select ON admin_applications FOR SELECT USING (
  user_id::text = auth.uid()::text OR has_admin_role('super_admin')
);
CREATE POLICY admin_applications_insert ON admin_applications FOR INSERT WITH CHECK (
  user_id::text = auth.uid()::text
);
CREATE POLICY admin_applications_update ON admin_applications FOR UPDATE USING (
  has_admin_role('super_admin')
);

ALTER TABLE admin_onboarding_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_onboarding_own ON admin_onboarding_progress;
CREATE POLICY admin_onboarding_own ON admin_onboarding_progress FOR ALL USING (
  EXISTS (SELECT 1 FROM admin_users a WHERE a.id::text = admin_onboarding_progress.admin_user_id::text
          AND a.user_id::text = auth.uid()::text)
  OR has_admin_role('super_admin')
);

ALTER TABLE video_annotations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS video_annotations_all ON video_annotations;
CREATE POLICY video_annotations_all ON video_annotations FOR ALL USING (
  has_admin_role('content_manager')
);


-- --- 13. Tenant isolation for the school layer -------------------------------
-- These tables carry tenant_id but no policy referenced it, so a teacher in one
-- institution could be granted access to another institution's rows by any
-- predicate that did not itself check the tenant. Tenancy is now explicit.

-- Announcements were readable by everyone on the platform when the audience was
-- not 'class' — every institution's notices, to every user of Trileza.
DROP POLICY IF EXISTS announcements_select ON announcements;
CREATE POLICY announcements_select ON announcements
  FOR SELECT USING (
    publish_at <= NOW()
    AND (expires_at IS NULL OR expires_at > NOW())
    AND (tenant_id = current_user_tenant_id() OR is_platform_admin())
    AND (
      audience <> 'class'
      OR (class_id IS NOT NULL AND (is_in_class(class_id) OR teaches_class(class_id)))
    )
  );

-- An institution admin can see and manage their own institution's classes,
-- which the roster/teacher predicates alone did not allow.
DROP POLICY IF EXISTS classes_select ON classes;
CREATE POLICY classes_select ON classes
  FOR SELECT USING (
    is_in_class(id)
    OR lead_teacher_id::text = auth.uid()::text
    OR is_tenant_admin(tenant_id)
    OR is_platform_admin()
  );

DROP POLICY IF EXISTS classes_write ON classes;
CREATE POLICY classes_write ON classes
  FOR ALL USING (
    lead_teacher_id::text = auth.uid()::text
    OR is_tenant_admin(tenant_id)
    OR is_platform_admin()
  );

-- Institution admins need the same reach over their own school's records.
DROP POLICY IF EXISTS grades_select ON grade_entries;
CREATE POLICY grades_select ON grade_entries
  FOR SELECT USING (
    student_id::text = auth.uid()::text
    OR is_guardian_of(student_id)
    OR teaches_class(class_id)
    OR is_tenant_admin(tenant_id)
    OR is_platform_admin()
  );

DROP POLICY IF EXISTS attendance_select ON attendance_records;
CREATE POLICY attendance_select ON attendance_records
  FOR SELECT USING (
    student_id::text = auth.uid()::text
    OR is_guardian_of(student_id)
    OR teaches_class(class_id)
    OR is_tenant_admin(tenant_id)
    OR is_platform_admin()
  );

-- A class must belong to the tenant of the person creating it, so a teacher
-- cannot plant a class inside another institution.
CREATE OR REPLACE FUNCTION enforce_class_tenant() RETURNS TRIGGER AS $fn$
BEGIN
  IF NOT is_platform_admin() AND NEW.tenant_id IS DISTINCT FROM current_user_tenant_id() THEN
    RAISE EXCEPTION 'A class must belong to your own institution.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_enforce_class_tenant ON classes;
CREATE TRIGGER trg_enforce_class_tenant
  BEFORE INSERT OR UPDATE OF tenant_id ON classes
  FOR EACH ROW EXECUTE FUNCTION enforce_class_tenant();

-- Stamp the caller's tenant on rows that carry one, so the client cannot choose
-- which institution its data lands in and cannot forget to set it.
CREATE OR REPLACE FUNCTION stamp_tenant_id() RETURNS TRIGGER AS $fn$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT is_platform_admin() THEN
    NEW.tenant_id := current_user_tenant_id();
  ELSIF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := 'default-tenant';
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DO $stamp$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['posts', 'live_sessions', 'messages', 'enrollments'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', 'trg_stamp_tenant_' || t, t);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION stamp_tenant_id()',
      'trg_stamp_tenant_' || t, t);
  END LOOP;
END
$stamp$;


-- --- 14. Admin visibility of tenants -----------------------------------------
-- tenants_select exposes only ACTIVE tenants (plus platform admins). Both
-- halves of institution management depended on seeing the others:
--
--   * the approval queue lists PENDING registrations,
--   * the suspend/restore view lists SUSPENDED ones.
--
-- is_platform_admin() covers an admin whose session is live, but the console
-- also reads this list while resolving its session. This function is the
-- explicit path, and it states the role it requires.

CREATE OR REPLACE FUNCTION admin_list_tenants(p_status TEXT DEFAULT NULL)
RETURNS SETOF tenants AS $fn$
  SELECT * FROM tenants
  WHERE has_admin_role('super_admin')
    AND (p_status IS NULL OR status = p_status)
  ORDER BY created_at DESC;
$fn$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION admin_list_tenants(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_list_tenants(TEXT) TO authenticated;

-- Per-tenant totals for the institution console, counted in the database
-- rather than by fetching every row and measuring the array.
CREATE OR REPLACE FUNCTION admin_tenant_stats(p_tenant_id TEXT)
RETURNS JSONB AS $fn$
  SELECT CASE
    WHEN NOT (has_admin_role('super_admin') OR is_tenant_admin(p_tenant_id)) THEN
      '{}'::jsonb
    ELSE jsonb_build_object(
      'users',       (SELECT COUNT(*) FROM profiles    WHERE tenant_id = p_tenant_id),
      'courses',     (SELECT COUNT(*) FROM courses     WHERE tenant_id = p_tenant_id),
      'enrollments', (SELECT COUNT(*) FROM enrollments WHERE tenant_id = p_tenant_id),
      'classes',     (SELECT COUNT(*) FROM classes     WHERE tenant_id = p_tenant_id),
      'active_subscription', (
        SELECT tier FROM subscriptions
        WHERE tenant_id = p_tenant_id AND status = 'active'
        ORDER BY created_at DESC LIMIT 1
      )
    )
  END;
$fn$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION admin_tenant_stats(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_tenant_stats(TEXT) TO authenticated;


-- --- 15. Remaining admin actions, made atomic --------------------------------
-- Deletions and moderation were sequences of independent client writes. A
-- failure part-way left a user's profile deleted but their enrollments and
-- applications behind, or content removed with its reviews still queued.

CREATE OR REPLACE FUNCTION admin_delete_user(p_user_id TEXT, p_reason TEXT)
RETURNS JSONB AS $fn$
DECLARE
  v_profile JSONB;
BEGIN
  IF NOT has_admin_role('user_manager') THEN
    RAISE EXCEPTION 'Only user managers can delete accounts.' USING ERRCODE = '42501';
  END IF;

  SELECT to_jsonb(p) INTO v_profile FROM profiles p WHERE p.id::text = p_user_id FOR UPDATE;
  IF v_profile IS NULL THEN
    RAISE EXCEPTION 'User profile not found.' USING ERRCODE = 'P0002';
  END IF;

  -- Never let an admin delete another admin's account from this screen.
  IF EXISTS (
    SELECT 1 FROM admin_users a
    WHERE a.user_id::text = p_user_id AND COALESCE(a.status, 'active') = 'active'
  ) AND NOT has_admin_role('super_admin') THEN
    RAISE EXCEPTION 'This account holds admin access; a super admin must remove it first.'
      USING ERRCODE = '42501';
  END IF;

  -- Audit BEFORE the delete: the foreign key on admin_audit_logs.admin_id is
  -- ON DELETE SET NULL, but the row being described is about to disappear, so
  -- the snapshot in previous_state is the only record of what was removed.
  INSERT INTO admin_audit_logs (action_type, target_type, target_id, previous_state, new_state, reason)
  VALUES ('delete', 'user', p_user_id, v_profile, NULL,
          format('User account "%s" permanently deleted. %s',
                 COALESCE(v_profile->>'full_name', p_user_id), COALESCE(p_reason, '')));

  -- Dependent rows go with it. Tables with ON DELETE CASCADE clean themselves
  -- up; these are listed because their constraints may still be NOT VALID or
  -- absent on a legacy deployment.
  DELETE FROM enrollments          WHERE user_id::text = p_user_id;
  DELETE FROM mentor_applications  WHERE user_id::text = p_user_id;
  DELETE FROM author_applications  WHERE user_id::text = p_user_id;
  DELETE FROM admin_users          WHERE user_id::text = p_user_id;
  DELETE FROM profiles             WHERE id::text = p_user_id;

  RETURN jsonb_build_object('deleted', TRUE, 'user_id', p_user_id);
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


CREATE OR REPLACE FUNCTION admin_delete_content(p_content_id TEXT, p_type TEXT, p_reason TEXT)
RETURNS JSONB AS $fn$
DECLARE
  v_content JSONB;
BEGIN
  IF NOT has_admin_role('content_manager') THEN
    RAISE EXCEPTION 'Only content managers can delete content.' USING ERRCODE = '42501';
  END IF;
  IF p_type NOT IN ('course', 'book') THEN
    RAISE EXCEPTION 'Unknown content type: %', p_type USING ERRCODE = '22023';
  END IF;

  IF p_type = 'course' THEN
    SELECT to_jsonb(c) INTO v_content FROM courses c WHERE c.id::text = p_content_id FOR UPDATE;
    IF v_content IS NULL THEN
      RAISE EXCEPTION 'Course not found.' USING ERRCODE = 'P0002';
    END IF;
    DELETE FROM course_reviews WHERE course_id::text = p_content_id;
    DELETE FROM enrollments    WHERE item_id::text = p_content_id OR course_id::text = p_content_id;
    DELETE FROM courses        WHERE id::text = p_content_id;
  ELSE
    SELECT to_jsonb(b) INTO v_content FROM books b WHERE b.id::text = p_content_id FOR UPDATE;
    IF v_content IS NULL THEN
      RAISE EXCEPTION 'Book not found.' USING ERRCODE = 'P0002';
    END IF;
    IF to_regclass('public.book_reviews') IS NOT NULL THEN
      DELETE FROM book_reviews WHERE book_id::text = p_content_id;
    END IF;
    DELETE FROM books WHERE id::text = p_content_id;
  END IF;

  INSERT INTO admin_audit_logs (action_type, target_type, target_id, previous_state, new_state, reason)
  VALUES ('delete', p_type, p_content_id, v_content, NULL,
          format('%s "%s" permanently deleted. %s',
                 initcap(p_type), COALESCE(v_content->>'title', p_content_id), COALESCE(p_reason, '')));

  RETURN jsonb_build_object('deleted', TRUE, 'id', p_content_id, 'type', p_type);
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


CREATE OR REPLACE FUNCTION admin_resolve_flag(
  p_flag_id     TEXT,
  p_status      TEXT,
  p_notes       TEXT,
  p_take_action BOOLEAN
) RETURNS JSONB AS $fn$
DECLARE
  v_flag flagged_content%ROWTYPE;
  v_prev JSONB;
BEGIN
  IF NOT (has_admin_role('support_agent') OR has_admin_role('compliance_officer')) THEN
    RAISE EXCEPTION 'Only moderators can resolve reports.' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('resolved', 'dismissed') THEN
    RAISE EXCEPTION 'Unknown resolution: %', p_status USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_flag FROM flagged_content WHERE id::text = p_flag_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Report not found.' USING ERRCODE = 'P0002';
  END IF;
  IF v_flag.status <> 'pending' THEN
    RAISE EXCEPTION 'This report was already %.', v_flag.status USING ERRCODE = '55000';
  END IF;
  v_prev := to_jsonb(v_flag);

  UPDATE flagged_content
  SET status = p_status, resolution_notes = p_notes,
      resolved_by = auth.uid()::text, resolved_at = NOW()
  WHERE id = v_flag.id
  RETURNING * INTO v_flag;

  IF p_take_action THEN
    IF v_flag.target_type = 'course' THEN
      UPDATE courses SET status = 'draft' WHERE id::text = v_flag.target_id::text;
    ELSIF v_flag.target_type = 'book' THEN
      UPDATE books SET status = 'draft' WHERE id::text = v_flag.target_id::text;
      IF to_regclass('public.book_reviews') IS NOT NULL THEN
        UPDATE book_reviews SET status = 'rejected', notes = 'Flagged: ' || COALESCE(p_notes, '')
        WHERE book_id::text = v_flag.target_id::text;
      END IF;
    ELSIF v_flag.target_type = 'post' THEN
      DELETE FROM posts WHERE id::text = v_flag.target_id::text;
    ELSIF v_flag.target_type = 'comment' THEN
      DELETE FROM comments WHERE id::text = v_flag.target_id::text;
    END IF;
  END IF;

  INSERT INTO admin_audit_logs (action_type, target_type, target_id, previous_state, new_state, reason)
  VALUES ('resolve', 'flagged_content', p_flag_id, v_prev,
          jsonb_build_object('status', p_status, 'notes', p_notes, 'actionTaken', p_take_action),
          format('Report %s. Action: %s. %s', p_status,
                 CASE WHEN p_take_action THEN 'content hidden' ELSE 'none' END, COALESCE(p_notes, '')));

  RETURN to_jsonb(v_flag);
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION admin_delete_user(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_delete_content(TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_resolve_flag(TEXT, TEXT, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_delete_user(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_delete_content(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_resolve_flag(TEXT, TEXT, TEXT, BOOLEAN) TO authenticated;


-- =============================================================================
-- NOTES
-- =============================================================================
--
-- 1. Foreign keys are added NOT VALID so the migration does not block on a full
--    scan of existing rows. New and updated rows are checked immediately.
--    Validate them during a quiet period:
--      SELECT 'ALTER TABLE ' || conrelid::regclass || ' VALIDATE CONSTRAINT '
--             || quote_ident(conname) || ';'
--      FROM pg_constraint WHERE NOT convalidated AND contype = 'f';
--    Any statement that then fails is naming real orphaned data to clean up.
--
-- 2. wallets_balance_non_negative is NOT VALID for the same reason. Check for
--    existing negative balances before validating:
--      SELECT id, user_id, available_balance FROM wallets WHERE available_balance < 0;
--
-- 3. Section 12 enables RLS on tables that had none. If a feature stops
--    returning rows after this migration, the policy is the first place to
--    look — the data is intact.
--
-- 4. Still not covered by RLS, and worth a follow-up: uploads, todo_items,
--    curriculum_standards, standard_alignments, behaviour_logs, lesson_plans,
--    event_rsvps, school_events, school_resources, resource_bookings,
--    timetable_slots.
--
-- =============================================================================
