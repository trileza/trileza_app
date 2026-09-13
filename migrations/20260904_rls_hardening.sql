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
