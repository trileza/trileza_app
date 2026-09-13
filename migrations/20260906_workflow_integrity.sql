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
