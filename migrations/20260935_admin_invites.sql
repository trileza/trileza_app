-- =============================================================================
-- TRILEZA — THE MISSING admin_invites TABLE
-- =============================================================================
--
-- Reproduced against the live project:
--
--     GET /api/database/records/admin_invites
--     {"code":"42P01","message":"relation \"public.admin_invites\" does not exist"}
--
-- The table is typed in database.types.ts, written by three methods in
-- admin.ts (inviteAdmin, resendInvite, and the invite listing), and read by the
-- deployed admin-invites edge function, which GateAcceptInvite depends on.
-- None of it could ever have worked: every call failed at the database.
--
-- That is also why nobody can administer this platform. admin_users is empty,
-- and the only paths into it are an invitation — which was broken — or a
-- self-service request that an existing super admin must approve. With no
-- first admin, there was no way to appoint one.
--
-- Columns match database.types.ts exactly rather than being redesigned, so the
-- existing service and edge function work unchanged.
--
-- =============================================================================

CREATE TABLE IF NOT EXISTS admin_invites (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id   TEXT DEFAULT 'default-tenant',

  -- Who the invitation is for. Deliberately an email and not a user_id: an
  -- invitation must be able to precede the account, which is exactly the case
  -- when bootstrapping the first administrator.
  email       TEXT NOT NULL,
  roles       TEXT[] NOT NULL DEFAULT '{}',

  -- Null for a seeded invitation, since no admin existed to issue it.
  invited_by  TEXT,

  -- The bearer secret. Generated server-side; never chosen by a client.
  token       TEXT NOT NULL UNIQUE,

  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  status      TEXT NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','accepted','expired','revoked')),

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ
);

-- The edge function looks an invite up by token and status on every accept.
CREATE INDEX IF NOT EXISTS admin_invites_token_idx  ON admin_invites (token);
CREATE INDEX IF NOT EXISTS admin_invites_email_idx  ON admin_invites (lower(email), status);

-- One live invitation per address. A second invitation to the same person is
-- a resend, which rotates the token in place, not a new row — otherwise an
-- old token stays valid after being replaced.
CREATE UNIQUE INDEX IF NOT EXISTS admin_invites_one_pending_per_email
  ON admin_invites (lower(email))
  WHERE status = 'pending';

ALTER TABLE admin_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_invites_select ON admin_invites;
DROP POLICY IF EXISTS admin_invites_insert ON admin_invites;
DROP POLICY IF EXISTS admin_invites_update ON admin_invites;
DROP POLICY IF EXISTS admin_invites_delete ON admin_invites;

-- Only a super admin may see who has been invited. The token column is a
-- bearer credential: anyone who can read it can become an administrator, so
-- no broader read policy exists, and the anon role has none at all.
--
-- Acceptance does not go through these policies. The edge function holds the
-- service key, which is what lets an invitee — who is not yet an admin, and
-- so matches no policy here — redeem their own token.
CREATE POLICY admin_invites_select ON admin_invites
  FOR SELECT TO authenticated
  USING (has_admin_role('super_admin'));

CREATE POLICY admin_invites_insert ON admin_invites
  FOR INSERT TO authenticated
  WITH CHECK (has_admin_role('super_admin'));

CREATE POLICY admin_invites_update ON admin_invites
  FOR UPDATE TO authenticated
  USING (has_admin_role('super_admin'))
  WITH CHECK (has_admin_role('super_admin'));

CREATE POLICY admin_invites_delete ON admin_invites
  FOR DELETE TO authenticated
  USING (has_admin_role('super_admin'));


-- ── Issuing an invitation ────────────────────────────────────────────────

/**
 * Creates or refreshes an invitation, returning the token exactly once.
 *
 * The token is generated here rather than accepted from the caller, so a
 * client cannot choose a predictable one. A resend rotates it in place, which
 * invalidates the previous link — a replaced invitation must stop working.
 *
 * SECURITY DEFINER with the role check written out, because the bootstrap case
 * has no super admin to satisfy an RLS policy: p_allow_bootstrap is true only
 * when admin_users is empty, which can happen exactly once in a project's life.
 */
CREATE OR REPLACE FUNCTION issue_admin_invite(
  p_email TEXT,
  p_roles TEXT[],
  p_days  INTEGER DEFAULT 7
)
RETURNS TABLE (invite_id TEXT, token TEXT, expires_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token     TEXT;
  v_id        TEXT;
  v_expires   TIMESTAMPTZ;
  v_bootstrap BOOLEAN;
  v_caller    TEXT;
BEGIN
  v_caller := (SELECT auth.uid())::text;

  -- The one-time exception: a project with no administrators at all.
  SELECT NOT EXISTS (SELECT 1 FROM admin_users WHERE status = 'active')
    INTO v_bootstrap;

  IF NOT v_bootstrap AND NOT has_admin_role('super_admin') THEN
    RAISE EXCEPTION 'Only a super admin can invite administrators.';
  END IF;

  IF p_email IS NULL OR position('@' in p_email) = 0 THEN
    RAISE EXCEPTION 'A valid email address is required.';
  END IF;

  IF p_roles IS NULL OR array_length(p_roles, 1) IS NULL THEN
    RAISE EXCEPTION 'An invitation must grant at least one role.';
  END IF;

  -- 32 bytes of randomness, hex encoded. gen_random_bytes is from pgcrypto
  -- and is cryptographically secure, unlike random().
  v_token   := encode(gen_random_bytes(32), 'hex');
  v_expires := NOW() + (GREATEST(1, LEAST(p_days, 30)) || ' days')::INTERVAL;

  -- Rotate an existing pending invitation rather than adding a second one,
  -- so an superseded link stops working.
  UPDATE admin_invites
     SET roles      = p_roles,
         token      = v_token,
         expires_at = v_expires,
         invited_by = COALESCE(v_caller, invited_by),
         created_at = NOW()
   WHERE lower(email) = lower(p_email)
     AND status = 'pending'
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    INSERT INTO admin_invites (email, roles, invited_by, token, expires_at)
    VALUES (lower(p_email), p_roles, v_caller, v_token, v_expires)
    RETURNING id INTO v_id;
  END IF;

  RETURN QUERY SELECT v_id, v_token, v_expires;
END;
$$;

-- Not granted to anon. An unauthenticated caller must never mint an invite,
-- even during bootstrap — the seed runs with the service key.
GRANT EXECUTE ON FUNCTION issue_admin_invite(TEXT, TEXT[], INTEGER) TO authenticated;


-- ── Housekeeping ─────────────────────────────────────────────────────────

/**
 * Marks lapsed invitations expired.
 *
 * The edge function already expires one when it is presented after its date,
 * but an invitation nobody ever opens would otherwise sit 'pending' forever
 * and block a fresh invite to the same address through the unique index above.
 */
CREATE OR REPLACE FUNCTION expire_stale_admin_invites()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  WITH gone AS (
    UPDATE admin_invites
       SET status = 'expired'
     WHERE status = 'pending' AND expires_at <= NOW()
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_count FROM gone;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION expire_stale_admin_invites() TO authenticated;
-- A count the bootstrap script can read without holding an admin role, since
-- by definition there may be none. Returns a number and nothing else: no
-- identities, no emails.
CREATE OR REPLACE FUNCTION admin_count_active()
RETURNS TABLE (count BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::BIGINT FROM admin_users WHERE status = 'active';
$$;

GRANT EXECUTE ON FUNCTION admin_count_active() TO authenticated;
