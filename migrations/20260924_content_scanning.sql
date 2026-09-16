-- =============================================================================
-- TRILEZA — CONTENT SCANNING: PLAGIARISM AND AI DETECTION
-- =============================================================================
--
-- Nothing screened uploads. A book went from the author's machine into the
-- review queue, where a content manager ticked `checklist_no_copyright` based
-- on nothing but reading it — which is not a check anyone can actually perform
-- against the whole web.
--
-- Scanning does not replace that human review; it informs it. The reviewer
-- still decides, but now with a similarity score and a list of matching
-- sources in front of them.
--
-- Two scores, two different questions:
--
--   plagiarism_score  how much of this text appears elsewhere
--   ai_score          how likely it was generated rather than written
--
-- Neither is proof. A high similarity score can be a correctly quoted source,
-- a public-domain text, or the author's own earlier work; a high AI score can
-- be a non-native speaker's careful prose. So a threshold breach routes to a
-- person, never to an automatic rejection.
--
-- =============================================================================


CREATE TABLE IF NOT EXISTS book_scans (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id        TEXT DEFAULT 'default-tenant',
  book_id          TEXT NOT NULL REFERENCES api_books(id) ON DELETE CASCADE,
  provider         TEXT NOT NULL DEFAULT 'copyleaks',
  scan_type        TEXT NOT NULL DEFAULT 'plagiarism_and_ai'
                   CHECK (scan_type IN ('plagiarism', 'ai', 'plagiarism_and_ai')),
  -- The provider's own id, which their webhook reports back under.
  external_scan_id TEXT,
  -- Percentages, 0.00 to 100.00.
  plagiarism_score NUMERIC(5,2) CHECK (plagiarism_score IS NULL OR (plagiarism_score >= 0 AND plagiarism_score <= 100)),
  ai_score         NUMERIC(5,2) CHECK (ai_score IS NULL OR (ai_score >= 0 AND ai_score <= 100)),
  -- Where the matches came from: [{url, title, matched_words, percent}]
  matched_sources  JSONB DEFAULT '[]'::jsonb,
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped')),
  -- Why a scan failed or was skipped, in words a reviewer can act on.
  status_detail    TEXT,
  -- What the thresholds said about this result, so the decision is recorded
  -- rather than recomputed from scores that may be read differently later.
  verdict          TEXT CHECK (verdict IS NULL OR verdict IN ('clear', 'review', 'error')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_book_scans_book     ON book_scans (book_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_book_scans_external ON book_scans (external_scan_id) WHERE external_scan_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_book_scans_pending  ON book_scans (status) WHERE status IN ('pending', 'running');

ALTER TABLE book_scans ENABLE ROW LEVEL SECURITY;

-- An author sees the result for their own book — being told "this was flagged"
-- without being told why is not something anyone can act on. Content managers
-- and compliance see everything.
--
-- No INSERT or UPDATE policy for `authenticated`: scans are written by the
-- edge functions using the service key. An author who could edit their own
-- scan result could clear it.
DROP POLICY IF EXISTS book_scans_select ON book_scans;
CREATE POLICY book_scans_select ON book_scans
  FOR SELECT TO authenticated
  USING (
    is_platform_admin()
    OR has_admin_role('content_manager')
    OR has_admin_role('compliance_officer')
    OR EXISTS (
      SELECT 1 FROM api_books b
       WHERE b.id = book_scans.book_id
         AND b.author_id = (SELECT auth.uid())::text
    )
  );


-- ── Thresholds ───────────────────────────────────────────────────────────
--
-- In a table rather than in code so compliance can tune them without a
-- deployment, and so the value in force is auditable.
CREATE TABLE IF NOT EXISTS scan_thresholds (
  id                   TEXT PRIMARY KEY DEFAULT 'default',
  plagiarism_threshold NUMERIC(5,2) NOT NULL DEFAULT 20.00,
  ai_threshold         NUMERIC(5,2) NOT NULL DEFAULT 80.00,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by           TEXT
);

INSERT INTO scan_thresholds (id, plagiarism_threshold, ai_threshold)
VALUES ('default', 20.00, 80.00)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE scan_thresholds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS scan_thresholds_select ON scan_thresholds;
CREATE POLICY scan_thresholds_select ON scan_thresholds
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS scan_thresholds_write ON scan_thresholds;
CREATE POLICY scan_thresholds_write ON scan_thresholds
  FOR ALL TO authenticated
  USING (is_platform_admin() OR has_admin_role('compliance_officer'))
  WITH CHECK (is_platform_admin() OR has_admin_role('compliance_officer'));


-- ── Recording a result ───────────────────────────────────────────────────
--
-- SECURITY DEFINER so the webhook can write a row no client may write, and
-- idempotent on external_scan_id because providers retry their callbacks just
-- as payment processors do.
CREATE OR REPLACE FUNCTION record_scan_result(
  p_external_scan_id TEXT,
  p_plagiarism_score NUMERIC,
  p_ai_score         NUMERIC,
  p_matched_sources  JSONB DEFAULT '[]'::jsonb
)
RETURNS book_scans
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_scan    book_scans;
  v_plag_t  NUMERIC;
  v_ai_t    NUMERIC;
  v_verdict TEXT;
BEGIN
  SELECT * INTO v_scan FROM book_scans WHERE external_scan_id = p_external_scan_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No scan with external id %', p_external_scan_id;
  END IF;

  -- Already recorded. A retried callback must not re-open a review a human
  -- has since resolved.
  IF v_scan.status = 'completed' THEN
    RETURN v_scan;
  END IF;

  SELECT plagiarism_threshold, ai_threshold
    INTO v_plag_t, v_ai_t
    FROM scan_thresholds WHERE id = 'default';

  v_verdict := CASE
    WHEN COALESCE(p_plagiarism_score, 0) > COALESCE(v_plag_t, 20)
      OR COALESCE(p_ai_score, 0)         > COALESCE(v_ai_t, 80)
    THEN 'review'
    ELSE 'clear'
  END;

  UPDATE book_scans
     SET plagiarism_score = p_plagiarism_score,
         ai_score         = p_ai_score,
         matched_sources  = COALESCE(p_matched_sources, '[]'::jsonb),
         status           = 'completed',
         verdict          = v_verdict,
         completed_at     = NOW()
   WHERE id = v_scan.id
  RETURNING * INTO v_scan;

  -- A flagged book must not sit published while it waits for a person.
  -- Clearing does NOT publish: a clean scan means "nothing automated
  -- objected", not "a human approved this".
  IF v_verdict = 'review' THEN
    UPDATE api_books
       SET status = 'pending_review'
     WHERE id = v_scan.book_id
       AND status <> 'pending_review';

    UPDATE book_reviews
       SET status = 'pending',
           notes  = COALESCE(notes || E'\n', '') ||
                    format('Automated scan: %s%% similarity, %s%% AI-generated. Needs review.',
                           COALESCE(p_plagiarism_score, 0), COALESCE(p_ai_score, 0))
     WHERE book_id = v_scan.book_id;
  END IF;

  RETURN v_scan;
END;
$$;

REVOKE ALL ON FUNCTION record_scan_result(TEXT, NUMERIC, NUMERIC, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_scan_result(TEXT, NUMERIC, NUMERIC, JSONB) TO authenticated;


-- ── The latest scan for a book, for the review queue ─────────────────────
CREATE OR REPLACE FUNCTION latest_book_scan(p_book_id TEXT)
RETURNS book_scans
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM book_scans
   WHERE book_id = p_book_id
   ORDER BY created_at DESC
   LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION latest_book_scan(TEXT) TO authenticated;


-- ── Books whose status allows publication ────────────────────────────────
-- 'pending_review' joins the existing statuses. Books already carry free-text
-- statuses, so this is a note rather than a constraint — adding a CHECK now
-- would reject rows written by paths not yet updated.
COMMENT ON COLUMN api_books.status IS
  'draft | pending_review | published | rejected | suspended. '
  'pending_review is set automatically when a scan breaches a threshold, and '
  'cleared by a content manager, not by a subsequent clean scan.';


-- =============================================================================
-- NOTES
-- =============================================================================
--
-- 1. A clean scan never publishes a book. It only records that nothing
--    automated objected; a person still approves. The reverse — a flagged book
--    being pulled from publication automatically — is safe in the other
--    direction, because the cost of wrongly hiding a book is far lower than
--    the cost of wrongly hosting a plagiarised one.
--
-- 2. Thresholds default to the brief's values: 20% similarity, 80% AI. Both
--    are blunt. Similarity counts correctly quoted sources and public-domain
--    text, and AI detectors are known to misjudge non-native English. They
--    route to a human for exactly that reason.
--
-- 3. No scan provider is configured yet. Until COPYLEAKS_EMAIL and
--    COPYLEAKS_API_KEY are set, submissions record a 'skipped' scan with the
--    reason, so the review queue shows honestly that nothing was checked
--    rather than implying a clean result.
--
-- =============================================================================
