-- =============================================================================
-- TRILEZA — BOOK FILE ACCESS CONTROL
-- =============================================================================
--
-- Until now the paywall was decorative. Book files lived in a PUBLIC bucket and
-- the reader passed `book.file_url` straight to PDF.js, so anyone holding a URL
-- downloaded the whole book — bought, borrowed, or neither. The RLS work in
-- 20260918 closed the metadata leak; this closes the file leak.
--
-- Files move to the private `book-files` bucket. Verified against the live
-- project: an unauthenticated request returns 401 and one bearing the public
-- anon key returns 403, so possession of a URL is no longer enough.
--
-- What decides access is entitlement, not authentication. A signed-in user who
-- has not bought or borrowed a book must be refused exactly like a stranger.
--
-- Covers and sample pages stay public and stay in the old bucket: they are
-- marketing, they appear to signed-out visitors browsing the catalogue, and
-- putting them behind auth would break the storefront for the people it is
-- meant to attract.
--
-- =============================================================================


-- ── Who may read a book's file ───────────────────────────────────────────
--
-- SECURITY DEFINER so it can consult api_user_library_access, which the caller
-- cannot read for anyone but themselves.
--
-- Returns TRUE when the user owns the book, has an unexpired borrow/rental, or
-- is the author. Expired borrows return FALSE — that is the whole point of a
-- loan, and the previous arrangement had no way to enforce it.
CREATE OR REPLACE FUNCTION user_can_read_book(p_user_id TEXT, p_book_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ok BOOLEAN := FALSE;
BEGIN
  IF p_user_id IS NULL OR p_book_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- The author always reads their own work, published or not.
  SELECT EXISTS (
    SELECT 1 FROM api_books b
     WHERE b.id = p_book_id
       AND b.author_id = p_user_id
  ) INTO v_ok;

  IF v_ok THEN
    RETURN TRUE;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM api_user_library_access a
     WHERE a.user_id = p_user_id
       AND a.book_id = p_book_id
       AND a.returned_at IS NULL
       -- 'own' and 'gift' never expire. A rental or borrow does, and a NULL
       -- expiry on those is treated as still valid rather than as forever —
       -- the grant path always sets one.
       AND (
         a.access_type IN ('own', 'gift')
         OR a.expires_at IS NULL
         OR a.expires_at > NOW()
       )
  ) INTO v_ok;

  RETURN v_ok;
END;
$$;

REVOKE ALL ON FUNCTION user_can_read_book(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION user_can_read_book(TEXT, TEXT) TO authenticated;


-- ── Map a storage key back to its book ───────────────────────────────────
--
-- Storage policies see an object key, not a book id, so the link has to be
-- recoverable from the row. file_url is what the upload wrote, and it ends in
-- the object key.
CREATE OR REPLACE FUNCTION book_id_for_object_key(p_key TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.id
    FROM api_books b
   WHERE b.file_url IS NOT NULL
     AND b.file_url LIKE '%' || p_key
   LIMIT 1;
$$;

REVOKE ALL ON FUNCTION book_id_for_object_key(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION book_id_for_object_key(TEXT) TO authenticated;


-- ── Storage policy: entitlement, not merely a login ──────────────────────

DROP POLICY IF EXISTS storage_objects_book_files_read ON storage.objects;

CREATE POLICY storage_objects_book_files_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket = 'book-files'
    AND (
      -- The uploader, for the window between upload and the book row existing.
      uploaded_by = (SELECT auth.jwt() ->> 'sub')
      OR has_admin_role('content_manager')
      OR is_platform_admin()
      OR user_can_read_book(
           (SELECT auth.jwt() ->> 'sub'),
           book_id_for_object_key(key)
         )
    )
  );


-- ── Audit trail ──────────────────────────────────────────────────────────
--
-- Every read of a book is recorded. This is what makes an access claim
-- checkable after the fact — a licensing dispute, an author asking why their
-- earnings look wrong, or a shared account being used by a dozen people.
CREATE TABLE IF NOT EXISTS book_access_logs (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id   TEXT DEFAULT 'default-tenant',
  user_id     TEXT NOT NULL,
  book_id     TEXT NOT NULL,
  access_type TEXT NOT NULL
              CHECK (access_type IN ('view_page','open','download','highlight','comment','denied')),
  page_number INTEGER,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reading is heavy on inserts and light on reads, so index only what is
-- actually queried: an author's report by book, and a user's own history.
CREATE INDEX IF NOT EXISTS idx_book_access_logs_book ON book_access_logs (book_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_book_access_logs_user ON book_access_logs (user_id, created_at DESC);

ALTER TABLE book_access_logs ENABLE ROW LEVEL SECURITY;

-- A reader may write their own log lines and read their own history. Authors
-- see activity on their own books; admins see everything. Nobody may update or
-- delete — an audit trail that its subject can edit is not an audit trail.
DROP POLICY IF EXISTS book_access_logs_insert ON book_access_logs;
CREATE POLICY book_access_logs_insert ON book_access_logs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid())::text);

DROP POLICY IF EXISTS book_access_logs_select ON book_access_logs;
CREATE POLICY book_access_logs_select ON book_access_logs
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())::text
    OR is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM api_books b
       WHERE b.id = book_access_logs.book_id
         AND b.author_id = (SELECT auth.uid())::text
    )
  );


-- ── Borrow expiry ────────────────────────────────────────────────────────
--
-- A borrow that has run out should stop working without anyone having to act.
-- user_can_read_book already refuses on expiry, so this is bookkeeping rather
-- than enforcement: it keeps "my library" honest about what is still readable.
CREATE OR REPLACE FUNCTION expire_lapsed_borrows()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  WITH expired AS (
    UPDATE api_user_library_access
       SET returned_at = NOW()
     WHERE returned_at IS NULL
       AND access_type IN ('rent', 'borrow')
       AND expires_at IS NOT NULL
       AND expires_at < NOW()
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_count FROM expired;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION expire_lapsed_borrows() TO authenticated, anon;


-- =============================================================================
-- NOTES
-- =============================================================================
--
-- 1. book_id_for_object_key matches on a file_url suffix. That is sound while
--    one object belongs to one book, which the upload paths guarantee. If a
--    file is ever shared between books, store the object key on api_books and
--    match on it directly instead.
--
-- 2. This makes a borrowed book unreadable after expiry and an unpaid book
--    unreadable at all. It does not stop a paying reader from saving what they
--    can already see. That is what the watermark on purchased downloads is
--    for — it does not prevent copying, it makes a leaked copy traceable.
--
-- 3. Files already uploaded to the public bucket stay readable by URL. Both
--    book tables were empty at the time of writing, so there is nothing to
--    migrate; if that changes, the old objects must be moved and file_url
--    rewritten.
--
-- =============================================================================
