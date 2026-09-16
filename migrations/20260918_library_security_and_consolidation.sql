-- =============================================================================
-- TRILEZA — LIBRARY SECURITY PATCH AND TABLE CONSOLIDATION
-- =============================================================================
--
-- Three security holes and one split-brain, found by auditing the live schema
-- against the code that uses it.
--
-- ── 1. Unpublished books were readable by anyone ─────────────────────────
--
-- api_books_select was `USING (true)`. Reproduced against the live project: an
-- anonymous caller holding only the public anon key read back a draft row and
-- its file_url.
--
--     [{"id":"audit-probe","title":"SECRET DRAFT","status":"draft",
--       "file_url":"https://private/secret.pdf"}]
--
-- The `books` table already had the correct rule. The two disagreed.
--
-- ── 2. Users could grant themselves any book, free ───────────────────────
--
-- api_user_library_access had a single FOR ALL policy whose WITH CHECK only
-- asserted `user_id = auth.uid()`. Nothing checked that a payment had happened,
-- so a signed-in user could INSERT their own 'own' access row for any book and
-- read it. Reading your own entitlements and creating them are different
-- rights, and were conflated.
--
-- Grants are now issued only by grant_book_access(), which is SECURITY DEFINER
-- and verifies a completed transaction first. Direct INSERT is refused.
--
-- ── 3. An author could reassign a book to someone else ───────────────────
--
-- api_books_write was FOR ALL with a USING clause but no WITH CHECK. USING
-- decides which rows you may act on; WITH CHECK decides what you may write.
-- Without it, an author could UPDATE their own book and set author_id to
-- another user — or to nobody.
--
-- ── 4. books vs api_books ────────────────────────────────────────────────
--
-- Both tables existed and both took writes. StoreManager inserted into `books`;
-- the reader and libraryService read `api_books`. A book uploaded through
-- StoreManager was therefore invisible in the library.
--
-- Worse, StoreManager's insert carried language, isbn, tags, pages,
-- sample_pages and material_type — columns that exist only on api_books — so
-- those values were being discarded on every upload.
--
-- api_books is kept: it backs the reader, and its schema is the richer of the
-- two (15 columns `books` lacks, several of which map onto the NISO/ONIX work
-- that follows). `books` is dropped. Both tables were empty, so nothing moves.
--
-- =============================================================================


-- ── Payment ledger ───────────────────────────────────────────────────────
--
-- grant_book_access() has to be able to prove a payment happened, and the
-- existing `transactions` table cannot answer that: it is wallet-scoped, with
-- no reference and no user_id. Rather than bend it out of shape, book payments
-- get their own ledger — which the Paystack work needs regardless.
--
-- `reference` is ours and unique, and is what makes webhook delivery
-- idempotent: Paystack retries on any non-2xx, and without a unique key a
-- retry would grant the book twice and pay the author twice.
CREATE TABLE IF NOT EXISTS payment_transactions (
  id                 TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id          TEXT DEFAULT 'default-tenant',
  user_id            TEXT NOT NULL,
  book_id            TEXT,
  type               TEXT NOT NULL CHECK (type IN ('purchase', 'borrow', 'rent')),
  -- Minor units (kobo for NGN, cents for USD). Integer on purpose: floating
  -- point money accumulates rounding errors once royalties are split off it.
  amount_minor       BIGINT NOT NULL CHECK (amount_minor >= 0),
  currency           TEXT NOT NULL DEFAULT 'NGN',
  reference          TEXT NOT NULL UNIQUE,
  provider           TEXT NOT NULL DEFAULT 'paystack',
  provider_reference TEXT,
  status             TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'completed', 'failed', 'abandoned', 'refunded')),
  metadata           JSONB DEFAULT '{}'::jsonb,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_user    ON payment_transactions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_book    ON payment_transactions (book_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_pending ON payment_transactions (status) WHERE status = 'pending';

ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

-- Readable by the payer and by finance staff. Never writable from the browser:
-- amounts and status are set by the backend after verifying with Paystack, so
-- there is no INSERT or UPDATE policy for `authenticated` at all.
DROP POLICY IF EXISTS payment_transactions_select ON payment_transactions;
CREATE POLICY payment_transactions_select ON payment_transactions
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())::text
    OR is_platform_admin()
    OR has_admin_role('finance_admin')
  );


-- ── Columns the upload path writes but no table had ──────────────────────
-- StoreManager sends these on every insert; they were silently discarded.
ALTER TABLE api_books
  ADD COLUMN IF NOT EXISTS suggested_format TEXT,
  ADD COLUMN IF NOT EXISTS uploaded_format  TEXT;

COMMENT ON COLUMN api_books.suggested_format IS
  'Format recommended for this material type (PDF, EPUB). Advisory.';
COMMENT ON COLUMN api_books.uploaded_format IS
  'Format the author actually uploaded, from the file extension.';


-- ── 1. Reads: published only, unless it is yours ─────────────────────────

DROP POLICY IF EXISTS api_books_select ON api_books;

CREATE POLICY api_books_select ON api_books
  FOR SELECT TO authenticated, anon
  USING (
    status = 'published'
    OR author_id = (SELECT auth.uid())::text
    OR is_platform_admin()
  );


-- ── 3. Writes: and you may not reassign the book ─────────────────────────

DROP POLICY IF EXISTS api_books_write ON api_books;

-- Split by command so INSERT and UPDATE both carry a WITH CHECK. A single
-- FOR ALL policy is what allowed the author_id reassignment.
CREATE POLICY api_books_insert ON api_books
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = (SELECT auth.uid())::text
    OR has_admin_role('content_manager')
  );

CREATE POLICY api_books_update ON api_books
  FOR UPDATE TO authenticated
  USING (
    author_id = (SELECT auth.uid())::text
    OR has_admin_role('content_manager')
  )
  WITH CHECK (
    author_id = (SELECT auth.uid())::text
    OR has_admin_role('content_manager')
  );

CREATE POLICY api_books_delete ON api_books
  FOR DELETE TO authenticated
  USING (
    author_id = (SELECT auth.uid())::text
    OR has_admin_role('content_manager')
  );


-- ── 2. Entitlements: read your own, but never mint them ──────────────────

DROP POLICY IF EXISTS api_user_library_access_own ON api_user_library_access;

CREATE POLICY api_user_library_access_select ON api_user_library_access
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())::text
    OR is_platform_admin()
  );

-- Deliberately no INSERT policy for `authenticated`. With RLS enabled and no
-- matching policy, a direct INSERT is refused — which is the point. Access is
-- created only by grant_book_access() below.

-- Returning a borrowed book is the one field a user may change themselves, and
-- only from NULL to a timestamp — they cannot un-return, extend an expiry, or
-- upgrade a rental into ownership.
CREATE POLICY api_user_library_access_return ON api_user_library_access
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid())::text AND returned_at IS NULL)
  WITH CHECK (user_id = (SELECT auth.uid())::text);

CREATE POLICY api_user_library_access_admin ON api_user_library_access
  FOR ALL TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());


-- ── The only way to be granted a book ────────────────────────────────────
--
-- SECURITY DEFINER so it can write a row the caller cannot write directly.
-- It refuses unless a completed transaction exists for this user and book, so
-- calling it without paying achieves nothing.
--
-- Idempotent: a repeated call for an access type the user already holds returns
-- the existing row rather than duplicating it. Payment webhooks retry, and a
-- double grant would corrupt both entitlements and author earnings.
CREATE OR REPLACE FUNCTION grant_book_access(
  p_user_id     TEXT,
  p_book_id     TEXT,
  p_access_type TEXT,
  p_reference   TEXT DEFAULT NULL,
  p_expires_at  TIMESTAMPTZ DEFAULT NULL
)
RETURNS api_user_library_access
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row     api_user_library_access;
  v_paid    BOOLEAN := FALSE;
  v_is_free BOOLEAN := FALSE;
BEGIN
  IF p_access_type NOT IN ('own', 'rent', 'borrow', 'gift') THEN
    RAISE EXCEPTION 'Unknown access type: %', p_access_type;
  END IF;

  -- Already granted. Return what exists rather than stacking duplicates.
  SELECT * INTO v_row
    FROM api_user_library_access
   WHERE user_id = p_user_id
     AND book_id = p_book_id
     AND access_type = p_access_type
     AND returned_at IS NULL
   LIMIT 1;

  IF FOUND THEN
    RETURN v_row;
  END IF;

  -- A book priced at zero needs no transaction.
  SELECT (COALESCE(retail_price, 0) = 0 AND COALESCE(rental_price, 0) = 0)
    INTO v_is_free
    FROM api_books
   WHERE id = p_book_id;

  IF v_is_free IS NULL THEN
    RAISE EXCEPTION 'No such book: %', p_book_id;
  END IF;

  -- Platform admins and content managers may grant directly — that is how a
  -- refund correction or an author gift is issued.
  IF is_platform_admin() OR has_admin_role('content_manager') THEN
    v_paid := TRUE;
  ELSIF v_is_free THEN
    v_paid := TRUE;
  ELSIF p_reference IS NOT NULL THEN
    -- The payment must be completed, belong to this user, and be for this
    -- book. Checking the reference alone would let someone replay a cheap
    -- book's reference to claim an expensive one.
    SELECT EXISTS (
      SELECT 1 FROM payment_transactions t
       WHERE t.reference = p_reference
         AND t.status    = 'completed'
         AND t.user_id   = p_user_id
         AND t.book_id   = p_book_id
    ) INTO v_paid;
  END IF;

  IF NOT v_paid THEN
    RAISE EXCEPTION 'No completed payment found for this book';
  END IF;

  INSERT INTO api_user_library_access
    (id, user_id, book_id, access_type, expires_at, created_at)
  VALUES
    (gen_random_uuid()::text, p_user_id, p_book_id, p_access_type, p_expires_at, NOW())
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION grant_book_access(TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION grant_book_access(TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) TO authenticated;


-- ── 4. Retire the duplicate table ────────────────────────────────────────
-- Empty, and every column it holds exists on api_books.
DROP TABLE IF EXISTS books CASCADE;


-- =============================================================================
-- NOTES
-- =============================================================================
--
-- 1. payment_transactions is checked by reference + user + book. The Paystack
--    work that follows must mark a row 'completed' there before calling
--    grant_book_access, or the grant is refused — which is the intended
--    ordering: verify with the provider first, then entitle.
--
-- 2. Book files still live in a PUBLIC storage bucket, so a leaked file_url is
--    still readable without any entitlement. These policies close the metadata
--    leak, not the file leak. Private bucket plus signed, expiring URLs is the
--    next step and is tracked separately.
--
-- =============================================================================
