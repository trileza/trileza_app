-- =============================================================================
-- TRILEZA — PROFILES MUST FOLLOW THEIR ACCOUNT
-- =============================================================================
--
-- Reported as "it says the user already exists, but I cleared the database".
-- Both halves were true at once:
--
--     auth.users : 0 rows
--     profiles   : 7 rows, every one orphaned
--
-- Deleting an account removed the auth user and left its profile behind,
-- because profiles has no foreign key to auth.users — only to tenants.
-- Nothing tied the two together, so nothing cleaned up.
--
-- The visible symptom is a signup that cannot be completed. Reproduced against
-- the live API: an address with an orphaned profile is refused with
--
--     409 AUTH_EMAIL_EXISTS  "User already exists"
--
-- while a fresh address signs up normally. The email is held hostage by a row
-- belonging to an account that no longer exists, and deleting users does not
-- release it, because the thing doing the blocking is not a user.
--
-- ── Why a trigger rather than a foreign key ──────────────────────────────
--
-- A FOREIGN KEY ... ON DELETE CASCADE would be the natural fix, but
-- profiles.id is TEXT and auth.users.id is UUID, and Postgres will not
-- reference across those types. Converting the column would mean converting
-- every table that points at it — this schema identifies users by text id
-- throughout, including in RLS policies that compare auth.uid()::text — and
-- that is a far larger change than the bug warrants.
--
-- A trigger on auth.users achieves the same guarantee without touching a
-- single type: the delete still cascades, it just does so in a statement
-- rather than a constraint.
--
-- =============================================================================


-- ── 1. Clear the orphans that already exist ──────────────────────────────
--
-- Only rows whose account is genuinely gone. A profile with a live auth user
-- is untouched, so this is safe to re-run.

DELETE FROM profiles p
 WHERE NOT EXISTS (
   SELECT 1 FROM auth.users u WHERE u.id::text = p.id
 );


-- ── 2. Keep them from accumulating again ─────────────────────────────────

/**
 * Removes a profile when its account is deleted.
 *
 * SECURITY DEFINER because the caller deleting an auth user is not
 * necessarily able to write to public.profiles, and the cleanup must not
 * depend on who performed the delete.
 */
CREATE OR REPLACE FUNCTION delete_profile_with_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM profiles WHERE id = OLD.id::text;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS delete_profile_with_auth_user_trigger ON auth.users;

CREATE TRIGGER delete_profile_with_auth_user_trigger
  AFTER DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION delete_profile_with_auth_user();


-- ── 3. A way to find any that slip through ───────────────────────────────

/**
 * Orphaned profiles, for anyone wondering why an address is refused.
 *
 * Should always return zero now. If it ever does not, something deleted an
 * auth user by a path that bypasses triggers, and that is worth knowing about
 * rather than discovering through a blocked signup.
 */
CREATE OR REPLACE FUNCTION orphaned_profiles()
RETURNS TABLE (profile_id TEXT, email TEXT, created_at TIMESTAMPTZ)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.email, p.created_at
    FROM profiles p
   WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id::text = p.id)
   ORDER BY p.created_at;
$$;

GRANT EXECUTE ON FUNCTION orphaned_profiles() TO authenticated;
