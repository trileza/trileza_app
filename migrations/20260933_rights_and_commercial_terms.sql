-- =============================================================================
-- TRILEZA — RIGHTS DECLARATIONS, AND COMMERCIAL TERMS THE AUTHOR CHOOSES
-- =============================================================================
--
-- Two gaps against the Worthy of Note proposal, found by checking each P0
-- acceptance criterion (§45) against what the code actually does.
--
-- ── 1. No rights declaration (§11, §45) ──────────────────────────────────
--
-- The proposal requires an author to declare they hold the rights to
-- distribute, and requires the platform to "retain the accepted rights
-- declaration and agreement version associated with the book edition". §45
-- lists "Rights declarations are stored against the publication" as a launch
-- criterion.
--
-- api_books has a single `rights_statement` text column, defaulting to
-- 'World', which nobody ever sets and which records no agreement, no version
-- and no act of acceptance. A territory string is not a declaration: it does
-- not say who accepted what, when, or which terms they were shown.
--
-- Stored per book rather than amended in place, so the record of what was
-- agreed survives the author later changing their mind.
--
-- ── 2. The author could not set commercial terms (§3.1, §12, §22) ────────
--
-- api_books already carries allow_purchase, allow_mentor_gift, allow_borrow,
-- allow_borrow_to_own, borrow_days, borrow_credit_rate and rental_price, and
-- book_actions_for_user already honours the first three — verified against the
-- live function. But the publishing wizard sets none of them. Every book
-- therefore takes the defaults, and §3.1's "chooses whether purchase,
-- mentor-sponsored purchase, borrowing and borrow-to-own are available" is not
-- something an author can actually do.
--
-- Nothing is needed here for that: the columns exist and the logic reads them.
-- The fix is in the wizard. What this migration adds is the guard rail — a
-- book that allows nothing at all is not publishable, and borrow-to-own with
-- no borrowing is incoherent.
--
-- =============================================================================


-- ── Rights declarations ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rights_agreements (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id         TEXT DEFAULT 'default-tenant',
  book_id           TEXT NOT NULL REFERENCES api_books(id) ON DELETE CASCADE,
  -- Who accepted. Not necessarily the author of record: a publisher may
  -- accept on an author's behalf, and the proposal's §11 anticipates
  -- third-party publishing.
  accepted_by       TEXT NOT NULL,
  accepted_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Which terms they were shown. Terms change; a declaration that does not
  -- say which version was accepted proves nothing later.
  agreement_version TEXT NOT NULL,

  -- The declarations themselves (§11).
  owns_rights       BOOLEAN NOT NULL DEFAULT FALSE,
  grants_hosting    BOOLEAN NOT NULL DEFAULT FALSE,
  grants_display    BOOLEAN NOT NULL DEFAULT FALSE,
  grants_sale       BOOLEAN NOT NULL DEFAULT FALSE,
  grants_lending    BOOLEAN NOT NULL DEFAULT FALSE,
  grants_borrow_to_own BOOLEAN NOT NULL DEFAULT FALSE,

  -- Territory and copyright, kept here beside the grant rather than only on
  -- the book, so the agreement is self-contained.
  territory         TEXT NOT NULL DEFAULT 'World',
  copyright_holder  TEXT,
  copyright_year    INTEGER,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS rights_agreements_book_idx
  ON rights_agreements (book_id, accepted_at DESC);

ALTER TABLE rights_agreements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rights_agreements_select ON rights_agreements;
DROP POLICY IF EXISTS rights_agreements_insert ON rights_agreements;
DROP POLICY IF EXISTS rights_agreements_update ON rights_agreements;

-- Readable by the person who accepted, the book's author, and admins.
-- Nobody else: what an author agreed to is not public.
CREATE POLICY rights_agreements_select ON rights_agreements
  FOR SELECT TO authenticated
  USING (
    accepted_by = (SELECT auth.uid())::text
    OR EXISTS (
      SELECT 1 FROM api_books b
       WHERE b.id = rights_agreements.book_id
         AND b.author_id = (SELECT auth.uid())::text
    )
    OR is_platform_admin()
  );

CREATE POLICY rights_agreements_insert ON rights_agreements
  FOR INSERT TO authenticated
  WITH CHECK (accepted_by = (SELECT auth.uid())::text);

-- Deliberately no UPDATE policy. A declaration is a record of something that
-- happened; changing it after the fact would defeat its purpose. A new
-- agreement is a new row.


-- ── Commercial coherence ─────────────────────────────────────────────────

/**
 * Refuses commercial terms that cannot be honoured.
 *
 * These are not style preferences. A book offering nothing cannot be acquired
 * by anyone, and borrow-to-own without borrowing has no qualifying payment to
 * accumulate — both would present the reader with a page whose buttons all do
 * nothing, which §12's "should not display actions that a user role is not
 * allowed to initiate" exists to prevent.
 */
CREATE OR REPLACE FUNCTION check_commercial_terms()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'published'
     AND NOT COALESCE(NEW.allow_purchase, FALSE)
     AND NOT COALESCE(NEW.allow_mentor_gift, FALSE)
     AND NOT COALESCE(NEW.allow_borrow, FALSE) THEN
    RAISE EXCEPTION
      'This book offers no way to acquire it. Enable at least one of purchase, mentor gift or borrowing.';
  END IF;

  IF COALESCE(NEW.allow_borrow_to_own, FALSE) AND NOT COALESCE(NEW.allow_borrow, FALSE) THEN
    RAISE EXCEPTION
      'Borrow-to-own needs borrowing enabled: the credit comes from borrow payments.';
  END IF;

  -- §13 fixes the term at five days for this version, but the column exists so
  -- a later version can vary it. A nonsensical value is still refused.
  IF NEW.borrow_days IS NOT NULL AND (NEW.borrow_days < 1 OR NEW.borrow_days > 90) THEN
    RAISE EXCEPTION 'A borrowing term must be between 1 and 90 days.';
  END IF;

  IF NEW.borrow_credit_rate IS NOT NULL
     AND (NEW.borrow_credit_rate < 0 OR NEW.borrow_credit_rate > 1) THEN
    RAISE EXCEPTION 'Ownership credit must be between 0%% and 100%% of the borrow payment.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_commercial_terms_trigger ON api_books;
CREATE TRIGGER check_commercial_terms_trigger
  BEFORE INSERT OR UPDATE ON api_books
  FOR EACH ROW EXECUTE FUNCTION check_commercial_terms();


-- ── Has this book's rights been declared? ────────────────────────────────

/**
 * Used by the admin review screen (§23), which should show the rights
 * declaration alongside the metadata and validation report before a decision.
 */
CREATE OR REPLACE FUNCTION book_rights_summary(p_book_id TEXT)
RETURNS TABLE (
  declared          BOOLEAN,
  accepted_at       TIMESTAMPTZ,
  agreement_version TEXT,
  territory         TEXT,
  grants_lending    BOOLEAN,
  grants_borrow_to_own BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    TRUE,
    r.accepted_at,
    r.agreement_version,
    r.territory,
    r.grants_lending,
    r.grants_borrow_to_own
  FROM rights_agreements r
  WHERE r.book_id = p_book_id
  ORDER BY r.accepted_at DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION book_rights_summary(TEXT) TO authenticated;
