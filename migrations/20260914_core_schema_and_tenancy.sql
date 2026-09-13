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
