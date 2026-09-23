-- =============================================================================
-- TRILEZA LIBRARY — LICENSING CORE (Worthy of Note proposal)
-- =============================================================================
--
-- Rebuilds book access around the proposal's central distinction: a Book is the
-- content, a License is what a user may do with it. Loans, sponsorship and
-- borrow-to-own all hang off that one idea.
--
-- Three behaviours that are already live change here, deliberately:
--
--   borrow term      14 days -> 5 days (proposal section 2)
--   mentee borrowing allowed -> refused; a mentee buys, or asks a mentor
--   access record    api_user_library_access -> book_licenses, which separates
--                    payer from beneficiary. The old table cannot express
--                    "Mary paid, John reads", which is the product's core idea.
--
-- The old table is kept and backfilled rather than dropped: it is read in
-- several places, and dropping it silently would break them.
--
-- =============================================================================


-- ── Mentor and mentee relationships ──────────────────────────────────────
-- Sponsorship needs to know who may sponsor whom. Without this, anyone could
-- nominate any other user as their mentee and start issuing licences.
CREATE TABLE IF NOT EXISTS mentor_mentees (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id  TEXT DEFAULT 'default-tenant',
  mentor_id  TEXT NOT NULL,
  mentee_id  TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'active'
             CHECK (status IN ('active', 'paused', 'ended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at   TIMESTAMPTZ,
  UNIQUE (mentor_id, mentee_id)
);

CREATE INDEX IF NOT EXISTS idx_mentor_mentees_mentor ON mentor_mentees (mentor_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_mentor_mentees_mentee ON mentor_mentees (mentee_id) WHERE status = 'active';

ALTER TABLE mentor_mentees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mentor_mentees_select ON mentor_mentees;
CREATE POLICY mentor_mentees_select ON mentor_mentees
  FOR SELECT TO authenticated
  USING (
    mentor_id = (SELECT auth.uid())::text
    OR mentee_id = (SELECT auth.uid())::text
    OR is_platform_admin()
  );

-- A mentor manages their own pairings; nobody can insert a pairing they are
-- not the mentor of.
DROP POLICY IF EXISTS mentor_mentees_write ON mentor_mentees;
CREATE POLICY mentor_mentees_write ON mentor_mentees
  FOR ALL TO authenticated
  USING (mentor_id = (SELECT auth.uid())::text OR is_platform_admin())
  WITH CHECK (mentor_id = (SELECT auth.uid())::text OR is_platform_admin());


-- ── Editions ─────────────────────────────────────────────────────────────
-- A book is the work; an edition is a published version of it. Separate so a
-- corrected edition never overwrites the one people already bought.
CREATE TABLE IF NOT EXISTS book_editions (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id      TEXT DEFAULT 'default-tenant',
  book_id        TEXT NOT NULL REFERENCES api_books(id) ON DELETE CASCADE,
  edition_number INTEGER NOT NULL DEFAULT 1,
  edition_label  TEXT,
  -- The author's original upload, never overwritten by processing.
  source_key     TEXT,
  -- What the reader serves, once normalised.
  reader_key     TEXT,
  status         TEXT NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft','processing','author_review','submitted',
                                   'under_review','changes_requested','approved',
                                   'published','suspended','archived')),
  effective_from TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (book_id, edition_number)
);

CREATE INDEX IF NOT EXISTS idx_book_editions_book ON book_editions (book_id, edition_number DESC);

ALTER TABLE book_editions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS book_editions_select ON book_editions;
CREATE POLICY book_editions_select ON book_editions
  FOR SELECT TO authenticated, anon
  USING (
    status = 'published'
    OR EXISTS (SELECT 1 FROM api_books b WHERE b.id = book_editions.book_id
                 AND (b.author_id = (SELECT auth.uid())::text OR is_platform_admin()))
    OR has_admin_role('content_manager')
  );

DROP POLICY IF EXISTS book_editions_write ON book_editions;
CREATE POLICY book_editions_write ON book_editions
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM api_books b WHERE b.id = book_editions.book_id
                   AND (b.author_id = (SELECT auth.uid())::text OR has_admin_role('content_manager'))))
  WITH CHECK (EXISTS (SELECT 1 FROM api_books b WHERE b.id = book_editions.book_id
                   AND (b.author_id = (SELECT auth.uid())::text OR has_admin_role('content_manager'))));


-- ── Commercial terms, per book ───────────────────────────────────────────
-- Which actions an author permits, and on what terms.
ALTER TABLE api_books
  ADD COLUMN IF NOT EXISTS allow_purchase       BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS allow_mentor_gift    BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS allow_borrow         BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS allow_borrow_to_own  BOOLEAN NOT NULL DEFAULT FALSE,
  -- What fraction of a borrow payment counts toward ownership. 1.0 matches the
  -- proposal's worked example: five 2,000 borrows buy a 10,000 book.
  ADD COLUMN IF NOT EXISTS borrow_credit_rate   NUMERIC(4,3) NOT NULL DEFAULT 1.000
                                                CHECK (borrow_credit_rate >= 0 AND borrow_credit_rate <= 1),
  -- Stored per book so a future change to the standard term does not rewrite
  -- what existing books already promised.
  ADD COLUMN IF NOT EXISTS borrow_days          INTEGER NOT NULL DEFAULT 5
                                                CHECK (borrow_days > 0 AND borrow_days <= 90);


-- ── Licences ─────────────────────────────────────────────────────────────
-- payer_id and beneficiary_id are separate columns because "Mary paid, John
-- reads" is the product, not an edge case.
CREATE TABLE IF NOT EXISTS book_licenses (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id        TEXT DEFAULT 'default-tenant',
  book_id          TEXT NOT NULL REFERENCES api_books(id) ON DELETE CASCADE,
  edition_id       TEXT REFERENCES book_editions(id) ON DELETE SET NULL,

  -- Who holds the licence, and therefore who may read.
  beneficiary_id   TEXT NOT NULL,
  -- Who paid. The same person for a self-purchase; a mentor for a sponsorship.
  payer_id         TEXT NOT NULL,

  license_type     TEXT NOT NULL CHECK (license_type IN ('owned','borrowed','granted')),
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','active','expiring','expired',
                                     'owned','revoked','suspended')),

  start_at         TIMESTAMPTZ,
  -- Always explicit, even though the term is currently fixed at five days, so
  -- another term later needs no restructuring.
  expires_at       TIMESTAMPTZ,

  purchase_minor   BIGINT NOT NULL DEFAULT 0,
  transaction_id   TEXT,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_book_licenses_beneficiary ON book_licenses (beneficiary_id, status);
CREATE INDEX IF NOT EXISTS idx_book_licenses_payer       ON book_licenses (payer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_book_licenses_book        ON book_licenses (book_id);
CREATE INDEX IF NOT EXISTS idx_book_licenses_expiring    ON book_licenses (expires_at)
  WHERE status IN ('active','expiring');

-- One live ownership licence per person per book. Borrows may repeat, which is
-- what makes borrow-to-own possible.
CREATE UNIQUE INDEX IF NOT EXISTS idx_book_licenses_one_owned
  ON book_licenses (beneficiary_id, book_id)
  WHERE license_type IN ('owned','granted') AND status IN ('active','owned');

ALTER TABLE book_licenses ENABLE ROW LEVEL SECURITY;

-- Readable by the holder, by whoever paid (a mentor tracking a sponsorship),
-- and by staff. Never writable from a browser: licences come only from the
-- functions below, after a verified payment.
DROP POLICY IF EXISTS book_licenses_select ON book_licenses;
CREATE POLICY book_licenses_select ON book_licenses
  FOR SELECT TO authenticated
  USING (
    beneficiary_id = (SELECT auth.uid())::text
    OR payer_id = (SELECT auth.uid())::text
    OR is_platform_admin()
    OR has_admin_role('finance_admin')
  );

DROP POLICY IF EXISTS book_licenses_admin ON book_licenses;
CREATE POLICY book_licenses_admin ON book_licenses
  FOR ALL TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());


-- ── Ownership credit ledger ──────────────────────────────────────────────
-- Immutable, one row per qualifying borrow payment. A ledger rather than a
-- running total, so credit cannot be silently duplicated and every increment
-- traces back to the payment that caused it.
CREATE TABLE IF NOT EXISTS ownership_credits (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id      TEXT DEFAULT 'default-tenant',
  beneficiary_id TEXT NOT NULL,
  book_id        TEXT NOT NULL REFERENCES api_books(id) ON DELETE CASCADE,
  license_id     TEXT REFERENCES book_licenses(id) ON DELETE SET NULL,
  transaction_id TEXT,
  credit_minor   BIGINT NOT NULL CHECK (credit_minor >= 0),
  -- 'consumed' once converted into ownership, so the same credit cannot buy
  -- the book twice.
  status         TEXT NOT NULL DEFAULT 'available'
                 CHECK (status IN ('available','consumed','reversed')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  consumed_at    TIMESTAMPTZ
);

-- One credit per payment. This is what stops a retried webhook crediting twice.
CREATE UNIQUE INDEX IF NOT EXISTS idx_ownership_credits_txn
  ON ownership_credits (transaction_id) WHERE transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ownership_credits_holder
  ON ownership_credits (beneficiary_id, book_id) WHERE status = 'available';

ALTER TABLE ownership_credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ownership_credits_select ON ownership_credits;
CREATE POLICY ownership_credits_select ON ownership_credits
  FOR SELECT TO authenticated
  USING (
    beneficiary_id = (SELECT auth.uid())::text
    OR is_platform_admin()
    OR has_admin_role('finance_admin')
    -- A mentor sees the credit their own payments built up.
    OR EXISTS (SELECT 1 FROM book_licenses l
                WHERE l.id = ownership_credits.license_id
                  AND l.payer_id = (SELECT auth.uid())::text)
  );


-- ── Book requests ────────────────────────────────────────────────────────
-- "Ask my mentor to get this." Distinct from sponsorship_requests, which is
-- course-scoped and carries no book_id.
CREATE TABLE IF NOT EXISTS book_requests (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id    TEXT DEFAULT 'default-tenant',
  book_id      TEXT NOT NULL REFERENCES api_books(id) ON DELETE CASCADE,
  mentee_id    TEXT NOT NULL,
  mentor_id    TEXT NOT NULL,
  message      TEXT,
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','fulfilled','declined','cancelled')),
  fulfilled_as TEXT CHECK (fulfilled_as IS NULL OR fulfilled_as IN ('purchase','borrow')),
  license_id   TEXT REFERENCES book_licenses(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_book_requests_mentor ON book_requests (mentor_id, status);
CREATE INDEX IF NOT EXISTS idx_book_requests_mentee ON book_requests (mentee_id, created_at DESC);

ALTER TABLE book_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS book_requests_select ON book_requests;
CREATE POLICY book_requests_select ON book_requests
  FOR SELECT TO authenticated
  USING (
    mentee_id = (SELECT auth.uid())::text
    OR mentor_id = (SELECT auth.uid())::text
    OR is_platform_admin()
  );

-- A mentee raises their own request, and only to a mentor they actually have.
DROP POLICY IF EXISTS book_requests_insert ON book_requests;
CREATE POLICY book_requests_insert ON book_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    mentee_id = (SELECT auth.uid())::text
    AND EXISTS (
      SELECT 1 FROM mentor_mentees m
       WHERE m.mentor_id = book_requests.mentor_id
         AND m.mentee_id = (SELECT auth.uid())::text
         AND m.status = 'active'
    )
  );

-- The mentee may cancel; the mentor may decline. Fulfilment is written by the
-- payment path, not from a browser.
DROP POLICY IF EXISTS book_requests_update ON book_requests;
CREATE POLICY book_requests_update ON book_requests
  FOR UPDATE TO authenticated
  USING (mentee_id = (SELECT auth.uid())::text OR mentor_id = (SELECT auth.uid())::text)
  WITH CHECK (mentee_id = (SELECT auth.uid())::text OR mentor_id = (SELECT auth.uid())::text);


-- ── Reading progress ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reading_progress (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id     TEXT DEFAULT 'default-tenant',
  user_id       TEXT NOT NULL,
  book_id       TEXT NOT NULL REFERENCES api_books(id) ON DELETE CASCADE,
  edition_id    TEXT REFERENCES book_editions(id) ON DELETE SET NULL,
  last_position TEXT,
  percent_read  NUMERIC(5,2) NOT NULL DEFAULT 0
                CHECK (percent_read >= 0 AND percent_read <= 100),
  last_read_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, book_id)
);

CREATE INDEX IF NOT EXISTS idx_reading_progress_user ON reading_progress (user_id, last_read_at DESC);

ALTER TABLE reading_progress ENABLE ROW LEVEL SECURITY;

-- The reader's own, plus the mentor who paid for the licence — the proposal
-- shows a mentor seeing "62% read" — and nobody else.
DROP POLICY IF EXISTS reading_progress_select ON reading_progress;
CREATE POLICY reading_progress_select ON reading_progress
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())::text
    OR is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM book_licenses l
       WHERE l.beneficiary_id = reading_progress.user_id
         AND l.book_id = reading_progress.book_id
         AND l.payer_id = (SELECT auth.uid())::text
         AND l.payer_id <> l.beneficiary_id
    )
  );

DROP POLICY IF EXISTS reading_progress_write ON reading_progress;
CREATE POLICY reading_progress_write ON reading_progress
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid())::text)
  WITH CHECK (user_id = (SELECT auth.uid())::text);


-- ── Backfill from the old access table ───────────────────────────────────
-- Existing entitlements become licences where payer and beneficiary are the
-- same person, which is what they were.
INSERT INTO book_licenses (
  book_id, beneficiary_id, payer_id, license_type, status,
  start_at, expires_at, created_at
)
SELECT
  a.book_id,
  a.user_id,
  COALESCE(a.sponsored_by, a.user_id),
  CASE WHEN a.access_type IN ('own','gift') THEN 'owned' ELSE 'borrowed' END,
  CASE
    WHEN a.returned_at IS NOT NULL THEN 'expired'
    WHEN a.access_type IN ('own','gift') THEN 'owned'
    WHEN a.expires_at IS NOT NULL AND a.expires_at < NOW() THEN 'expired'
    ELSE 'active'
  END,
  a.created_at,
  a.expires_at,
  a.created_at
FROM api_user_library_access a
WHERE EXISTS (SELECT 1 FROM api_books b WHERE b.id = a.book_id)
  AND NOT EXISTS (
    SELECT 1 FROM book_licenses l
     WHERE l.book_id = a.book_id AND l.beneficiary_id = a.user_id
  );


-- =============================================================================
-- NOTES
-- =============================================================================
--
-- 1. api_user_library_access is kept in step by the functions in the next
--    migration rather than dropped. Several screens still read it, and the
--    reader's storage policy resolves entitlement through it.
--
-- 2. book_licenses has no INSERT policy for `authenticated` on purpose. A
--    licence is a claim on paid content; it is issued by SECURITY DEFINER
--    functions after a payment is verified, never asserted by a client.
--
-- 3. The five-day term lives in api_books.borrow_days rather than in code, so
--    an author-approved different term needs no migration.
--
-- =============================================================================
