-- =============================================================================
-- TRILEZA — READER BOOKMARKS
-- =============================================================================
--
-- The proposal's reader (section 16) lists bookmarks alongside highlights and
-- notes. Highlights and notes already have tables (api_highlights,
-- api_comments); bookmarks had nowhere to go, so the feature could not exist.
--
-- Deliberately separate from highlights rather than a flag on them. A bookmark
-- is a place in a book; a highlight is a passage with an opinion attached.
-- Merging them would mean every bookmark carried an empty passage_text, and
-- "show me my bookmarks" would become a filter over rows that mostly are not.
--
-- =============================================================================

CREATE TABLE IF NOT EXISTS book_bookmarks (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id  TEXT DEFAULT 'default-tenant',
  user_id    TEXT NOT NULL,
  book_id    TEXT NOT NULL REFERENCES api_books(id) ON DELETE CASCADE,
  -- Where in the book. A page for a PDF, a chapter anchor for a normalised
  -- edition — kept as text so both fit without a schema change.
  position   TEXT NOT NULL,
  page_index INTEGER,
  -- What the reader will see in their bookmark list, so the list is readable
  -- without loading every book to resolve each position.
  label      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, book_id, position)
);

CREATE INDEX IF NOT EXISTS idx_book_bookmarks_user
  ON book_bookmarks (user_id, book_id, page_index);

ALTER TABLE book_bookmarks ENABLE ROW LEVEL SECURITY;

-- A bookmark is private. Not even the mentor who paid for the licence sees it:
-- the proposal permits a mentor to see reading progress, which is a number,
-- not what a mentee chose to mark.
DROP POLICY IF EXISTS book_bookmarks_own ON book_bookmarks;
CREATE POLICY book_bookmarks_own ON book_bookmarks
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid())::text)
  WITH CHECK (user_id = (SELECT auth.uid())::text);


-- ── Reading sessions ─────────────────────────────────────────────────────
--
-- The proposal asks for reading sessions to be recorded "without storing
-- unnecessary personal data" (section 24), for two reasons: an author needs
-- read-through figures, and unusual repeated access is how borrowing abuse
-- shows up.
--
-- So this records that a licence was exercised, and for how long — not what
-- was read. No page numbers, no dwell time per passage.
CREATE TABLE IF NOT EXISTS reading_sessions (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id   TEXT DEFAULT 'default-tenant',
  user_id     TEXT NOT NULL,
  book_id     TEXT NOT NULL REFERENCES api_books(id) ON DELETE CASCADE,
  license_id  TEXT REFERENCES book_licenses(id) ON DELETE SET NULL,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at    TIMESTAMPTZ,
  seconds     INTEGER
);

CREATE INDEX IF NOT EXISTS idx_reading_sessions_book ON reading_sessions (book_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_reading_sessions_user ON reading_sessions (user_id, started_at DESC);

ALTER TABLE reading_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reading_sessions_insert ON reading_sessions;
CREATE POLICY reading_sessions_insert ON reading_sessions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid())::text);

DROP POLICY IF EXISTS reading_sessions_update ON reading_sessions;
CREATE POLICY reading_sessions_update ON reading_sessions
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid())::text)
  WITH CHECK (user_id = (SELECT auth.uid())::text);

-- The reader sees their own; the author sees sessions on their own books,
-- which is what read-through analytics is computed from.
DROP POLICY IF EXISTS reading_sessions_select ON reading_sessions;
CREATE POLICY reading_sessions_select ON reading_sessions
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())::text
    OR is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM api_books b
       WHERE b.id = reading_sessions.book_id
         AND b.author_id = (SELECT auth.uid())::text
    )
  );


-- ── Opening a book ───────────────────────────────────────────────────────
--
-- One call the reader makes before rendering anything. It answers "may this
-- person read this book right now", and in the same breath opens a session and
-- returns where they left off.
--
-- Putting the three together means the reader cannot accidentally render first
-- and check afterwards, which is the mistake the proposal warns about when it
-- says hiding a button is not a security control.
CREATE OR REPLACE FUNCTION open_book(p_user_id TEXT, p_book_id TEXT)
RETURNS TABLE (
  allowed       BOOLEAN,
  reason        TEXT,
  license_type  TEXT,
  expires_at    TIMESTAMPTZ,
  days_left     INTEGER,
  last_position TEXT,
  percent_read  NUMERIC,
  session_id    TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_license book_licenses;
  v_author  BOOLEAN;
  v_prog    reading_progress;
  v_session TEXT;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM api_books WHERE id = p_book_id AND author_id = p_user_id
  ) INTO v_author;

  IF NOT v_author THEN
    -- The strongest live licence: ownership first, then an unexpired loan.
    SELECT * INTO v_license
      FROM book_licenses
     WHERE beneficiary_id = p_user_id
       AND book_id = p_book_id
       AND status IN ('active','expiring','owned')
       AND (license_type IN ('owned','granted')
            OR expires_at IS NULL
            OR expires_at > NOW())
     ORDER BY CASE WHEN license_type IN ('owned','granted') THEN 0 ELSE 1 END
     LIMIT 1;

    IF NOT FOUND THEN
      -- Say which it is. "You have no licence" and "your loan ended" call for
      -- different next steps, and the reader should be told which applies.
      IF EXISTS (
        SELECT 1 FROM book_licenses
         WHERE beneficiary_id = p_user_id AND book_id = p_book_id
      ) THEN
        RETURN QUERY SELECT FALSE, 'expired'::TEXT, NULL::TEXT, NULL::TIMESTAMPTZ,
                            NULL::INTEGER, NULL::TEXT, NULL::NUMERIC, NULL::TEXT;
      ELSE
        RETURN QUERY SELECT FALSE, 'no_license'::TEXT, NULL::TEXT, NULL::TIMESTAMPTZ,
                            NULL::INTEGER, NULL::TEXT, NULL::NUMERIC, NULL::TEXT;
      END IF;
      RETURN;
    END IF;
  END IF;

  SELECT * INTO v_prog
    FROM reading_progress
   WHERE user_id = p_user_id AND book_id = p_book_id;

  INSERT INTO reading_sessions (user_id, book_id, license_id)
  VALUES (p_user_id, p_book_id, v_license.id)
  RETURNING id INTO v_session;

  RETURN QUERY SELECT
    TRUE,
    'ok'::TEXT,
    COALESCE(v_license.license_type, 'author'),
    v_license.expires_at,
    CASE WHEN v_license.expires_at IS NULL THEN NULL
         ELSE GREATEST(0, CEIL(EXTRACT(EPOCH FROM (v_license.expires_at - NOW())) / 86400)::INTEGER)
    END,
    v_prog.last_position,
    COALESCE(v_prog.percent_read, 0),
    v_session;
END;
$$;

GRANT EXECUTE ON FUNCTION open_book(TEXT, TEXT) TO authenticated;


-- ── Closing a session ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION close_reading_session(p_session_id TEXT)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE reading_sessions
     SET ended_at = NOW(),
         seconds  = GREATEST(0, EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER)
   WHERE id = p_session_id
     AND ended_at IS NULL;
$$;

GRANT EXECUTE ON FUNCTION close_reading_session(TEXT) TO authenticated;
