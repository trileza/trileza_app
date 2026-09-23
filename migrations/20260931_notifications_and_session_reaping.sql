-- =============================================================================
-- TRILEZA — LIBRARY NOTIFICATIONS, AND CLOSING ABANDONED READING SESSIONS
-- =============================================================================
--
-- Two problems, both of the same shape: the database already knew something
-- had happened and nobody was told.
--
-- ── 1. Loans ended in silence ────────────────────────────────────────────
--
-- expire_lapsed_licenses() already moved a licence to 'expiring' a day before
-- it lapsed, and to 'expired' when it did. Both transitions are exactly the
-- moment a reader wants to hear from us, and neither produced anything. A
-- mentee's borrowed book simply stopped opening.
--
-- The proposal is explicit that a reader should "never feel that a borrowed
-- book has disappeared without explanation". ReaderGate explains it once they
-- try to open the book; this tells them before they do.
--
-- ── 2. Reading sessions were never closed ────────────────────────────────
--
-- open_book() opens a session; close_reading_session() ends it. A browser tab
-- closed without a clean unmount — which is most of them — leaves the row
-- open forever, so an author's read-duration figures count a session that
-- ended in minutes as one that is still running days later.
--
-- Same fix as the abandoned live sessions in 20260917: a scheduled sweep that
-- closes anything implausible. A session is capped at 4 hours, which is far
-- longer than a real sitting and short enough that the figures stay useful.
--
-- =============================================================================


-- ── Notifications on licence transitions ─────────────────────────────────

CREATE OR REPLACE FUNCTION expire_lapsed_licenses()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Due within a day. Warned once: the WHERE excludes rows already at
  -- 'expiring', so a daily sweep does not nag the same reader every run.
  WITH warned AS (
    UPDATE book_licenses
       SET status = 'expiring', updated_at = NOW()
     WHERE status = 'active'
       AND license_type = 'borrowed'
       AND expires_at IS NOT NULL
       AND expires_at <= NOW() + INTERVAL '1 day'
       AND expires_at > NOW()
    RETURNING book_id, beneficiary_id, expires_at
  )
  INSERT INTO notifications (id, user_id, title, message, type, link, is_read, metadata)
  SELECT
    'n-' || gen_random_uuid()::text,
    w.beneficiary_id,
    'A borrowed book is due',
    CASE
      WHEN w.expires_at::date <= NOW()::date
        THEN format('%s is due back today.', COALESCE('"' || b.title || '"', 'A book'))
      ELSE format('%s is due back tomorrow.', COALESCE('"' || b.title || '"', 'A book'))
    END,
    'warning',
    '/library/mine',
    FALSE,
    jsonb_build_object('event', 'license_expiring', 'bookId', w.book_id)
  FROM warned w
  LEFT JOIN api_books b ON b.id = w.book_id
  -- A licence whose beneficiary has no profile row would violate the foreign
  -- key and abort the whole sweep. Skip rather than fail.
  WHERE EXISTS (SELECT 1 FROM profiles p WHERE p.id = w.beneficiary_id);

  -- Actually lapsed.
  WITH expired AS (
    UPDATE book_licenses
       SET status = 'expired', updated_at = NOW()
     WHERE status IN ('active','expiring')
       AND license_type = 'borrowed'
       AND expires_at IS NOT NULL
       AND expires_at <= NOW()
    RETURNING book_id, beneficiary_id
  ),
  told AS (
    INSERT INTO notifications (id, user_id, title, message, type, link, is_read, metadata)
    SELECT
      'n-' || gen_random_uuid()::text,
      e.beneficiary_id,
      'A loan has ended',
      format(
        '%s is no longer readable. You can borrow it again or buy a copy.',
        COALESCE('"' || b.title || '"', 'A book')
      ),
      'info',
      '/library/' || e.book_id,
      FALSE,
      jsonb_build_object('event', 'license_expired', 'bookId', e.book_id)
    FROM expired e
    LEFT JOIN api_books b ON b.id = e.book_id
    WHERE EXISTS (SELECT 1 FROM profiles p WHERE p.id = e.beneficiary_id)
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_count FROM expired;

  UPDATE api_user_library_access a
     SET returned_at = NOW()
   WHERE a.returned_at IS NULL
     AND a.access_type IN ('rent','borrow')
     AND a.expires_at IS NOT NULL
     AND a.expires_at <= NOW();

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION expire_lapsed_licenses() TO authenticated;


-- ── Closing abandoned reading sessions ───────────────────────────────────

/**
 * Closes reading sessions that were never closed properly.
 *
 * `ended_at` is set to the cap rather than to NOW(), so a session abandoned
 * three days ago is recorded as the four hours it might plausibly have been,
 * not as seventy-two. Either is a guess; this one cannot inflate a figure
 * without limit.
 */
CREATE OR REPLACE FUNCTION close_abandoned_reading_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  WITH stale AS (
    UPDATE reading_sessions
       SET ended_at = started_at + INTERVAL '4 hours',
           -- `seconds` is what the reporting reads; leaving it NULL here
           -- would close the session and still lose the session from any
           -- figure that sums this column.
           seconds = 4 * 60 * 60,
           -- Marked so nobody later mistakes an inferred duration for a
           -- measured one.
           was_abandoned = TRUE
     WHERE ended_at IS NULL
       AND started_at < NOW() - INTERVAL '4 hours'
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_count FROM stale;

  RETURN v_count;
END;
$$;

-- Added here rather than in the original table so an existing deployment does
-- not need its sessions rewritten.
ALTER TABLE reading_sessions
  ADD COLUMN IF NOT EXISTS was_abandoned BOOLEAN NOT NULL DEFAULT FALSE;

GRANT EXECUTE ON FUNCTION close_abandoned_reading_sessions() TO authenticated;


-- ── Indexes ──────────────────────────────────────────────────────────────

-- The bell reads exactly this: one user's unread rows, newest first.
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON notifications (user_id, is_read, created_at DESC);

-- Both sweeps scan for open rows; without this they walk the whole table.
CREATE INDEX IF NOT EXISTS reading_sessions_open_idx
  ON reading_sessions (started_at)
  WHERE ended_at IS NULL;


-- ── Applied ──────────────────────────────────────────────────────────────
--
-- Run against the live project on 2026-09-23, and both sweeps scheduled
-- hourly on off-peak minutes so they do not collide with the live-session
-- reaper that runs every two minutes:
--
--   expire-lapsed-book-licenses        23 * * * *
--   close-abandoned-reading-sessions   47 * * * *
--
-- Verified with fixtures, since "returns 0 on an empty table" proves only
-- that a function does not crash:
--
--   a loan due in 12 hours   -> status 'expiring', "due back tomorrow"
--   a loan an hour lapsed    -> status 'expired',  "no longer readable"
--   a second sweep           -> still 2 notifications, nobody nagged twice
--   a 9-hour-old open session-> ended, seconds = 14400, was_abandoned = true
--
-- All fixtures removed afterwards; every table back to zero rows.
