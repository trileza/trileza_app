-- =============================================================================
-- TRILEZA — BASELINE: THE TABLES EVERY LATER MIGRATION ASSUMES
-- =============================================================================
--
-- Runs FIRST, before 20260812_multi_tenant_lms.sql.
--
-- WHY THIS EXISTS
-- ---------------
-- Every migration from 20260812 onward was written against a database where
-- `profiles`, `courses`, `admin_users` and friends already existed, because on
-- the original deployment they had been created by hand in the console rather
-- than by a migration. Nothing in the repository ever created them.
--
-- That was invisible until the schema was applied to a genuinely empty
-- database, where the very first migration fails with:
--
--     relation "profiles" does not exist
--
-- This file supplies that missing foundation: the minimum set of tables the
-- later migrations reference, in dependency order. It deliberately defines only
-- what is needed to make them run — column additions, constraints, indexes and
-- row-level security all arrive in the migrations that follow, which is where
-- they belong.
--
-- Everything is IF NOT EXISTS, so this is a no-op on a database that already
-- has these tables.
--
-- =============================================================================


-- --- 1. Tenants --------------------------------------------------------------
-- First, because nearly every other table carries tenant_id REFERENCES it.
-- 20260812 re-creates this identically and seeds the default tenant.

CREATE TABLE IF NOT EXISTS tenants (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name          TEXT NOT NULL,
  subdomain     TEXT UNIQUE NOT NULL,
  custom_domain TEXT UNIQUE,
  email         TEXT NOT NULL,
  status        TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'pending')),
  logo_url      TEXT,
  primary_color TEXT DEFAULT '#4f46e5',
  plan          TEXT DEFAULT 'starter' CHECK (plan IN ('starter', 'growth', 'enterprise')),
  settings      JSONB DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The marketplace tenant every non-institutional row belongs to. Inserted here
-- rather than later because foreign keys added in this file point at it.
INSERT INTO tenants (id, name, subdomain, custom_domain, email, status, primary_color, plan)
VALUES ('default-tenant', 'Trileza Main LMS', 'app', 'trileza.com',
        'admin@trileza.com', 'active', '#4f46e5', 'enterprise')
ON CONFLICT (id) DO NOTHING;


-- --- 2. Profiles -------------------------------------------------------------
-- The identity table. `id` matches the InsForge auth user id, so no default is
-- generated here: rows are created by the app with the auth id supplied.

CREATE TABLE IF NOT EXISTS profiles (
  id             TEXT PRIMARY KEY,
  email          TEXT,
  full_name      TEXT,
  username       TEXT,
  role           TEXT DEFAULT 'mentee',
  avatar_url     TEXT,
  bio            TEXT,
  country        TEXT,
  mentor_tier    TEXT,
  metadata       JSONB DEFAULT '{}'::jsonb,
  tenant_id      TEXT DEFAULT 'default-tenant' REFERENCES tenants(id) ON DELETE SET NULL,
  last_active_at TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- --- 3. Courses --------------------------------------------------------------

CREATE TABLE IF NOT EXISTS courses (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id           TEXT DEFAULT 'default-tenant' REFERENCES tenants(id) ON DELETE CASCADE,
  tutor_id            TEXT REFERENCES profiles(id) ON DELETE CASCADE,
  title               TEXT NOT NULL,
  description         TEXT,
  thumbnail_url       TEXT,
  trailer_url         TEXT,
  category            TEXT,
  price_standard      NUMERIC NOT NULL DEFAULT 0,
  price_elite         NUMERIC NOT NULL DEFAULT 0,
  rating              NUMERIC NOT NULL DEFAULT 0,
  enrolled_count      INTEGER NOT NULL DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'draft',
  language            TEXT,
  level               TEXT,
  duration            TEXT,
  tags                JSONB DEFAULT '[]'::jsonb,
  materials           JSONB DEFAULT '[]'::jsonb,
  curriculum          JSONB DEFAULT '[]'::jsonb,
  learning_objectives JSONB DEFAULT '[]'::jsonb,
  branding            JSONB,
  metadata            JSONB DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- --- 4. Enrollments ----------------------------------------------------------

CREATE TABLE IF NOT EXISTS enrollments (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id         TEXT DEFAULT 'default-tenant' REFERENCES tenants(id) ON DELETE CASCADE,
  user_id           TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
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


-- --- 5. Wallets and transactions ---------------------------------------------

CREATE TABLE IF NOT EXISTS wallets (
  id                       TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id                  TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tenant_id                TEXT DEFAULT 'default-tenant' REFERENCES tenants(id) ON DELETE CASCADE,
  paystack_subaccount_code TEXT,
  bank_details             JSONB,
  lifetime_earnings        NUMERIC NOT NULL DEFAULT 0,
  pending_settlement       NUMERIC NOT NULL DEFAULT 0,
  available_balance        NUMERIC NOT NULL DEFAULT 0,
  currency                 TEXT NOT NULL DEFAULT 'NGN',
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  wallet_id   TEXT NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  amount      NUMERIC NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('sale', 'payout', 'commission')),
  status      TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
  description TEXT,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- --- 6. Books ----------------------------------------------------------------
-- The marketplace-side book table the content console reviews against.

CREATE TABLE IF NOT EXISTS books (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id    TEXT DEFAULT 'default-tenant' REFERENCES tenants(id) ON DELETE CASCADE,
  author_id    TEXT REFERENCES profiles(id) ON DELETE SET NULL,
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


-- --- 7. Admin infrastructure -------------------------------------------------
-- `admin_users.id` has a generated default and `user_id` points at the profile.
-- 20260704's ALTER statements assume both columns, and request_admin_access()
-- in 20260913 branches on whether `id` has a default — it does here.

CREATE TABLE IF NOT EXISTS admin_users (
  id                   TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id              TEXT REFERENCES profiles(id) ON DELETE CASCADE,
  role                 TEXT,
  roles                JSONB DEFAULT '[]'::jsonb,
  permissions          JSONB DEFAULT '[]'::jsonb,
  status               TEXT DEFAULT 'active',
  suspended            BOOLEAN DEFAULT FALSE,
  onboarded            BOOLEAN DEFAULT FALSE,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  onboarding_step      TEXT,
  twofa_email          TEXT,
  twofa_enabled        BOOLEAN DEFAULT TRUE,
  twofa_bypassed       BOOLEAN DEFAULT FALSE,
  backup_codes         JSONB DEFAULT '[]'::jsonb,
  failed_attempts      INTEGER DEFAULT 0,
  lockout_until        TIMESTAMPTZ,
  last_login           TIMESTAMPTZ,
  tenant_id            TEXT DEFAULT 'default-tenant' REFERENCES tenants(id) ON DELETE CASCADE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The audit trail. 20260913 consolidates both audit tables onto this one.
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  admin_id       TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  admin_user_id  TEXT,
  action_type    TEXT NOT NULL,
  target_type    TEXT NOT NULL,
  target_id      TEXT NOT NULL,
  previous_state JSONB,
  new_state      JSONB,
  reason         TEXT,
  ip_address     TEXT,
  tenant_id      TEXT DEFAULT 'default-tenant' REFERENCES tenants(id) ON DELETE CASCADE
);


-- Admin session and second-factor tables. 20260904 secures these with RLS, so
-- they have to exist by then.
CREATE TABLE IF NOT EXISTS admin_sessions (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  admin_user_id TEXT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  token         TEXT NOT NULL UNIQUE,
  expires_at    TIMESTAMPTZ NOT NULL,
  ip_address    TEXT,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_2fa_codes (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  admin_user_id TEXT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  code          TEXT NOT NULL,
  used          BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- --- 8. Review and moderation queues -----------------------------------------

CREATE TABLE IF NOT EXISTS course_reviews (
  id                     TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  course_id              TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  submitted_by           TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content_manager_id     TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  status                 TEXT NOT NULL DEFAULT 'pending',
  checklist_title        BOOLEAN DEFAULT FALSE,
  checklist_description  BOOLEAN DEFAULT FALSE,
  checklist_curriculum   BOOLEAN DEFAULT FALSE,
  checklist_video        BOOLEAN DEFAULT FALSE,
  checklist_audio        BOOLEAN DEFAULT FALSE,
  checklist_thumbnail    BOOLEAN DEFAULT FALSE,
  checklist_no_copyright BOOLEAN DEFAULT FALSE,
  notes                  TEXT,
  submitted_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at            TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS book_reviews (
  id                     TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  book_id                TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  submitted_by           TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content_manager_id     TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  status                 TEXT NOT NULL DEFAULT 'pending',
  checklist_cover        BOOLEAN DEFAULT FALSE,
  checklist_description  BOOLEAN DEFAULT FALSE,
  checklist_readable     BOOLEAN DEFAULT FALSE,
  checklist_price        BOOLEAN DEFAULT FALSE,
  checklist_no_copyright BOOLEAN DEFAULT FALSE,
  notes                  TEXT,
  submitted_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at            TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS mentor_applications (
  id                             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id                        TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status                         TEXT NOT NULL DEFAULT 'pending',
  checklist_profile_completeness BOOLEAN DEFAULT FALSE,
  checklist_id_verification      BOOLEAN DEFAULT FALSE,
  checklist_qualifications       BOOLEAN DEFAULT FALSE,
  qualifications                 TEXT,
  rejection_reason               TEXT,
  reviewed_by                    TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  submitted_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at                    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS flagged_content (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  reporter_id      TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_type      TEXT NOT NULL,
  target_id        TEXT NOT NULL,
  reason           TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending',
  severity         TEXT NOT NULL DEFAULT 'medium',
  resolution_notes TEXT,
  resolved_by      TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  tenant_id        TEXT DEFAULT 'default-tenant' REFERENCES tenants(id) ON DELETE CASCADE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at      TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS payout_requests (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id      TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount       NUMERIC NOT NULL CHECK (amount > 0),
  status       TEXT NOT NULL DEFAULT 'pending',
  bank_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  reviewed_by  TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  reason       TEXT,
  tenant_id    TEXT DEFAULT 'default-tenant' REFERENCES tenants(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS support_tickets (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id     TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'open',
  priority    TEXT NOT NULL DEFAULT 'medium',
  assigned_to TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  replies     JSONB DEFAULT '[]'::jsonb,
  tenant_id   TEXT DEFAULT 'default-tenant' REFERENCES tenants(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at   TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS compliance_requests (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id          TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  type             TEXT NOT NULL,
  details          JSONB NOT NULL DEFAULT '{}'::jsonb,
  status           TEXT NOT NULL DEFAULT 'pending',
  resolution_notes TEXT,
  reviewed_by      TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at      TIMESTAMPTZ
);


-- =============================================================================
-- NOTES
-- =============================================================================
--
-- Deliberately minimal. Indexes, row-level security, tenant isolation and the
-- remaining ~30 tables are added by the migrations that follow, so that each
-- concern stays in the migration that owns it and this file only unblocks them.
--
-- =============================================================================
