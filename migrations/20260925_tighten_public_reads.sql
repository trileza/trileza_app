-- =============================================================================
-- TRILEZA — TIGHTEN TWO PUBLIC READS
-- =============================================================================
--
-- From a sweep of every RLS policy in the schema. Most of what looked alarming
-- was not: 58 write policies have no explicit WITH CHECK, but Postgres applies
-- the USING expression as the WITH CHECK when one is absent on ALL and UPDATE
-- policies, so ownership cannot be reassigned. Verified both ways — the
-- documentation says so, and an attempt to move a todo_items row to another
-- user was refused with 42501.
--
-- Two policies were genuinely too open.
--
-- ── custom_roles ─────────────────────────────────────────────────────────
--
-- USING (true) for `public`, so an anonymous caller holding only the publishable
-- anon key read the entire permission model. Reproduced:
--
--     [{"name":"Internal Auditor","base_role":"admin",
--       "permissions":["delete_all_users","view_finance"]}]
--
-- That is a map of the admin surface: which roles exist, what each can do, and
-- therefore which account is worth attacking. No signed-out visitor needs it,
-- and no ordinary user does either — the app reads roles when rendering the
-- admin console, which only admins reach.
--
-- ── resource_bookings ────────────────────────────────────────────────────
--
-- Also USING (true) for `public`. Exposes who booked which room, when, and
-- why — an institution's internal timetable, readable from the open internet.
-- Bookings belong to a tenant; they should be visible inside it, not outside.
--
-- =============================================================================


-- ── Roles are visible to staff, not to the world ─────────────────────────
DROP POLICY IF EXISTS custom_roles_select ON custom_roles;

CREATE POLICY custom_roles_select ON custom_roles
  FOR SELECT TO authenticated
  USING (
    is_platform_admin()
    OR has_admin_role('user_manager')
    -- A tenant's own administrators need to see the roles they assign within
    -- their institution.
    OR (
      tenant_id IS NOT NULL
      AND tenant_id <> 'default-tenant'
      AND tenant_id = current_user_tenant_id()
    )
  );


-- ── Bookings are visible inside the tenant that made them ────────────────
DROP POLICY IF EXISTS bookings_select ON resource_bookings;

CREATE POLICY bookings_select ON resource_bookings
  FOR SELECT TO authenticated
  USING (
    booked_by = (SELECT auth.uid())::text
    OR is_platform_admin()
    -- Shared-marketplace bookings stay visible to signed-in users, since a
    -- room's availability is only useful if others can see it is taken.
    -- Institutional bookings are confined to their own tenant.
    OR tenant_id = 'default-tenant'
    OR tenant_id = current_user_tenant_id()
  );


-- =============================================================================
-- NOTES
-- =============================================================================
--
-- Deliberately left public, having checked each: likes, follows, post_likes,
-- post_comments, comments, api_comments, api_user_reviews, pricing_tiers,
-- mentorship_programs, curriculum_standards, standard_alignments. These are
-- the public face of the product — a signed-out visitor browsing the catalogue
-- sees reviews, comment counts and prices, and hiding them would break the
-- storefront for exactly the people it exists to attract.
--
-- scan_thresholds is readable by any authenticated user rather than `public`.
-- Knowing the thresholds does not help an author evade them: the scan runs on
-- upload regardless, and the scores come from the provider.
--
-- =============================================================================
