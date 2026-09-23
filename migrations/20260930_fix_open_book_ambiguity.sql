-- =============================================================================
-- TRILEZA — FIX AMBIGUOUS COLUMNS IN open_book
-- =============================================================================
--
-- Found by calling it:
--
--     Error: column reference "license_type" is ambiguous
--
-- The RETURNS TABLE column names are in scope inside the function body, so
-- `license_type` and `expires_at` in the ORDER BY and WHERE matched both the
-- output column and book_licenses' own. Postgres refuses rather than guessing,
-- and the whole reader gate failed on every call.
--
-- Fixed by qualifying every reference to the table, which is clearer anyway:
-- a reader of this function should not have to work out which `expires_at`
-- is meant.
--
-- =============================================================================

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
    SELECT 1 FROM api_books b WHERE b.id = p_book_id AND b.author_id = p_user_id
  ) INTO v_author;

  IF NOT v_author THEN
    -- The strongest live licence: ownership first, then an unexpired loan.
    SELECT l.* INTO v_license
      FROM book_licenses l
     WHERE l.beneficiary_id = p_user_id
       AND l.book_id = p_book_id
       AND l.status IN ('active','expiring','owned')
       AND (l.license_type IN ('owned','granted')
            OR l.expires_at IS NULL
            OR l.expires_at > NOW())
     ORDER BY CASE WHEN l.license_type IN ('owned','granted') THEN 0 ELSE 1 END
     LIMIT 1;

    IF NOT FOUND THEN
      -- Say which it is. "You have no licence" and "your loan ended" call for
      -- different next steps, and the reader should be told which applies.
      IF EXISTS (
        SELECT 1 FROM book_licenses l2
         WHERE l2.beneficiary_id = p_user_id AND l2.book_id = p_book_id
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

  SELECT rp.* INTO v_prog
    FROM reading_progress rp
   WHERE rp.user_id = p_user_id AND rp.book_id = p_book_id;

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
