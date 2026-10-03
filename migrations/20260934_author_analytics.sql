-- =============================================================================
-- TRILEZA — AUTHOR ANALYTICS (§22, §30.1)
-- =============================================================================
--
-- The Author Studio showed three numbers: how many books, how many
-- entitlements, and a royalty balance. §30.1 asks for ten, per book:
-- purchases, borrows, borrow-to-own conversions, active readers, read-through,
-- average progress, revenue and royalty balance among them.
--
-- Everything needed is already recorded — book_licenses knows purchase from
-- borrow, author_earnings knows revenue, reading_progress knows how far people
-- got, reading_sessions knows who is actually reading. Nothing was asking.
--
-- One function rather than five client queries, because an author with a dozen
-- books would otherwise issue sixty round trips to draw one table, and because
-- the numbers must agree with each other: computing revenue in the browser
-- while the ledger says something else is the exact failure the earnings
-- migration was written to end.
--
-- SECURITY DEFINER, with the author check inside. An author sees their own
-- books and nobody else's.
--
-- §18.3 draws the privacy line: an author "does not gain access to private
-- learner information beyond the analytics permitted by platform policy". So
-- this returns counts and averages, never who read what. A reader's identity
-- does not leave this function.
--
-- =============================================================================

CREATE OR REPLACE FUNCTION author_book_analytics(p_author_id TEXT)
RETURNS TABLE (
  book_id          TEXT,
  title            TEXT,
  cover_url        TEXT,
  status           TEXT,
  retail_price     NUMERIC,
  purchases        BIGINT,
  borrows          BIGINT,
  active_loans     BIGINT,
  conversions      BIGINT,
  active_readers   BIGINT,
  avg_progress     NUMERIC,
  completions      BIGINT,
  revenue_minor    BIGINT,
  earnings_minor   BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    b.id,
    b.title,
    b.cover_url,
    b.status,
    b.retail_price,

    -- A purchase is an outright buy; 'granted' is a mentor buying for a
    -- mentee, which is still a sale from the author's point of view.
    (SELECT COUNT(*) FROM book_licenses l
      WHERE l.book_id = b.id AND l.license_type IN ('owned','granted'))::BIGINT,

    (SELECT COUNT(*) FROM book_licenses l
      WHERE l.book_id = b.id AND l.license_type = 'borrowed')::BIGINT,

    -- Loans running right now, which is what an author watches week to week.
    (SELECT COUNT(*) FROM book_licenses l
      WHERE l.book_id = b.id
        AND l.license_type = 'borrowed'
        AND l.status IN ('active','expiring')
        AND (l.expires_at IS NULL OR l.expires_at > NOW()))::BIGINT,

    -- Borrow-to-own conversions: credit that reached the price and was spent.
    (SELECT COUNT(*) FROM ownership_credits c
      WHERE c.book_id = b.id AND c.status = 'consumed')::BIGINT,

    -- Someone who opened it in the last 30 days. Counted from sessions rather
    -- than licences, because holding a licence is not reading.
    (SELECT COUNT(DISTINCT s.user_id) FROM reading_sessions s
      WHERE s.book_id = b.id AND s.started_at > NOW() - INTERVAL '30 days')::BIGINT,

    COALESCE((SELECT ROUND(AVG(rp.percent_read), 1) FROM reading_progress rp
      WHERE rp.book_id = b.id), 0),

    -- Read-through. 90% rather than 100%, since back matter is often skipped
    -- and a book read to the last chapter has been read.
    (SELECT COUNT(*) FROM reading_progress rp
      WHERE rp.book_id = b.id AND rp.percent_read >= 90)::BIGINT,

    -- Gross, then the author's share. Both from the ledger: an author's
    -- revenue is never recomputed from the current price, which would change
    -- historical figures every time they edited it.
    COALESCE((SELECT SUM(e.gross_minor) FROM author_earnings e
      WHERE e.book_id = b.id AND e.author_id = p_author_id), 0)::BIGINT,

    COALESCE((SELECT SUM(e.author_minor) FROM author_earnings e
      WHERE e.book_id = b.id AND e.author_id = p_author_id), 0)::BIGINT

  FROM api_books b
  WHERE b.author_id = p_author_id
  ORDER BY b.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION author_book_analytics(TEXT) TO authenticated;


/**
 * The totals across every book, for the dashboard headline.
 *
 * Separate from the per-book list so the cards do not require loading the
 * whole catalogue, and so the two cannot disagree: both read the same tables.
 */
CREATE OR REPLACE FUNCTION author_dashboard_summary(p_author_id TEXT)
RETURNS TABLE (
  books_total      BIGINT,
  books_published  BIGINT,
  books_pending    BIGINT,
  purchases        BIGINT,
  borrows          BIGINT,
  active_loans     BIGINT,
  active_readers   BIGINT,
  revenue_minor    BIGINT,
  earned_minor     BIGINT,
  available_minor  BIGINT,
  paid_minor       BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH mine AS (
    SELECT id FROM api_books WHERE author_id = p_author_id
  )
  SELECT
    (SELECT COUNT(*) FROM mine)::BIGINT,
    (SELECT COUNT(*) FROM api_books WHERE author_id = p_author_id AND status = 'published')::BIGINT,
    -- 'draft' here means waiting for a reviewer, which is where the publishing
    -- service leaves a book until a moderator clears it.
    (SELECT COUNT(*) FROM api_books WHERE author_id = p_author_id AND status = 'draft')::BIGINT,

    (SELECT COUNT(*) FROM book_licenses l WHERE l.book_id IN (SELECT id FROM mine)
       AND l.license_type IN ('owned','granted'))::BIGINT,
    (SELECT COUNT(*) FROM book_licenses l WHERE l.book_id IN (SELECT id FROM mine)
       AND l.license_type = 'borrowed')::BIGINT,
    (SELECT COUNT(*) FROM book_licenses l WHERE l.book_id IN (SELECT id FROM mine)
       AND l.license_type = 'borrowed'
       AND l.status IN ('active','expiring')
       AND (l.expires_at IS NULL OR l.expires_at > NOW()))::BIGINT,
    (SELECT COUNT(DISTINCT s.user_id) FROM reading_sessions s
       WHERE s.book_id IN (SELECT id FROM mine)
         AND s.started_at > NOW() - INTERVAL '30 days')::BIGINT,

    COALESCE((SELECT SUM(gross_minor) FROM author_earnings WHERE author_id = p_author_id), 0)::BIGINT,
    COALESCE((SELECT SUM(author_minor) FROM author_earnings WHERE author_id = p_author_id), 0)::BIGINT,
    -- What could be paid out now, as against what already has been.
    COALESCE((SELECT SUM(author_minor) FROM author_earnings
       WHERE author_id = p_author_id AND status = 'available'), 0)::BIGINT,
    COALESCE((SELECT SUM(author_minor) FROM author_earnings
       WHERE author_id = p_author_id AND status = 'paid'), 0)::BIGINT;
$$;

GRANT EXECUTE ON FUNCTION author_dashboard_summary(TEXT) TO authenticated;
