-- =============================================================================
-- TRILEZA — AUTHOR EARNINGS
-- =============================================================================
--
-- Two problems, one of them serious.
--
-- ── Anyone could set their own balance ───────────────────────────────────
--
-- wallets had an UPDATE policy of `auth.uid() = user_id` and an INSERT policy
-- to match, with no restriction on which columns. Reproduced against the live
-- project: a signed-in user created their own wallet row claiming a balance of
-- 9,999,999 in one API call.
--
--     {"id":"w-hack","user_id":"...","available_balance":9999999}
--     -> row created
--
-- payout_requests already restricts approval to finance_admin, so this was not
-- yet a completed theft — but the balance a payout is judged against was
-- attacker-controlled, which is the same thing one approval away.
--
-- Balances are now derived, never asserted. A wallet row holds bank details
-- and a Paystack subaccount; the money columns are maintained by
-- record_book_earning() and nothing else.
--
-- ── Royalties were a number in a browser ─────────────────────────────────
--
-- AuthorDashboard computed royalties on every page load at 10% — the spec says
-- 60% — from a useState(140.00) default, and stored nothing. There was no
-- earnings table at all, so an author's income existed only as a figure
-- recalculated in front of them, with no record to audit, dispute or pay out
-- against.
--
-- =============================================================================


-- ── The ledger ───────────────────────────────────────────────────────────
--
-- One row per earning event, never mutated after the fact. An author's balance
-- is the sum of their rows, so a disputed figure can always be traced to the
-- transactions that produced it.
CREATE TABLE IF NOT EXISTS author_earnings (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id      TEXT DEFAULT 'default-tenant',
  author_id      TEXT NOT NULL,
  book_id        TEXT,
  -- The payment this came from. Unique per author so a replayed webhook
  -- cannot pay twice for one sale.
  transaction_id TEXT,
  earning_type   TEXT NOT NULL CHECK (earning_type IN ('sale','borrow','subscription','adjustment')),
  -- Minor units, like payment_transactions. Money in floating point
  -- accumulates error precisely when it is split, which is all this table does.
  gross_minor    BIGINT NOT NULL CHECK (gross_minor >= 0),
  author_minor   BIGINT NOT NULL CHECK (author_minor >= 0),
  platform_minor BIGINT NOT NULL CHECK (platform_minor >= 0),
  -- Stored per row: the split in force when this was earned. Changing the
  -- platform's rate later must not silently rewrite what an author already
  -- earned.
  author_rate    NUMERIC(5,4) NOT NULL DEFAULT 0.6000,
  currency       TEXT NOT NULL DEFAULT 'NGN',
  status         TEXT NOT NULL DEFAULT 'available'
                 CHECK (status IN ('pending','available','paid','reversed')),
  payout_id      TEXT,
  note           TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at        TIMESTAMPTZ
);

-- One earning per transaction per author. This is what makes recording
-- idempotent under webhook retries.
CREATE UNIQUE INDEX IF NOT EXISTS idx_author_earnings_txn
  ON author_earnings (author_id, transaction_id)
  WHERE transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_author_earnings_author ON author_earnings (author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_author_earnings_book   ON author_earnings (book_id);
CREATE INDEX IF NOT EXISTS idx_author_earnings_unpaid ON author_earnings (author_id) WHERE status = 'available';

ALTER TABLE author_earnings ENABLE ROW LEVEL SECURITY;

-- Readable by the author it belongs to and by finance. Writable by nobody:
-- there is deliberately no INSERT or UPDATE policy, so the only way a row
-- appears is through record_book_earning() below.
DROP POLICY IF EXISTS author_earnings_select ON author_earnings;
CREATE POLICY author_earnings_select ON author_earnings
  FOR SELECT TO authenticated
  USING (
    author_id = (SELECT auth.uid())::text
    OR is_platform_admin()
    OR has_admin_role('finance_admin')
  );


-- ── Payouts ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS author_payouts (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id     TEXT DEFAULT 'default-tenant',
  author_id     TEXT NOT NULL,
  amount_minor  BIGINT NOT NULL CHECK (amount_minor > 0),
  currency      TEXT NOT NULL DEFAULT 'NGN',
  method        TEXT NOT NULL DEFAULT 'paystack_transfer',
  reference     TEXT UNIQUE,
  provider_reference TEXT,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','processing','paid','failed','cancelled')),
  failure_reason TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_author_payouts_author ON author_payouts (author_id, created_at DESC);

ALTER TABLE author_payouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS author_payouts_select ON author_payouts;
CREATE POLICY author_payouts_select ON author_payouts
  FOR SELECT TO authenticated
  USING (
    author_id = (SELECT auth.uid())::text
    OR is_platform_admin()
    OR has_admin_role('finance_admin')
  );

-- Only finance moves money.
DROP POLICY IF EXISTS author_payouts_write ON author_payouts;
CREATE POLICY author_payouts_write ON author_payouts
  FOR ALL TO authenticated
  USING (is_platform_admin() OR has_admin_role('finance_admin'))
  WITH CHECK (is_platform_admin() OR has_admin_role('finance_admin'));


-- ── Close the wallet hole ────────────────────────────────────────────────
--
-- A user may create their wallet and maintain their bank details, but the
-- money columns are not theirs to write. Postgres has no column-level RLS, so
-- the UPDATE policy compares the incoming values against the stored ones: any
-- change to a balance is refused unless it comes from an admin or from a
-- SECURITY DEFINER function, which bypasses RLS entirely.

DROP POLICY IF EXISTS wallets_update ON wallets;
CREATE POLICY wallets_update ON wallets
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid())::text = user_id OR is_platform_admin())
  WITH CHECK (
    is_platform_admin()
    OR (
      (SELECT auth.uid())::text = user_id
      AND lifetime_earnings  IS NOT DISTINCT FROM (SELECT w.lifetime_earnings  FROM wallets w WHERE w.id = wallets.id)
      AND available_balance  IS NOT DISTINCT FROM (SELECT w.available_balance  FROM wallets w WHERE w.id = wallets.id)
      AND pending_settlement IS NOT DISTINCT FROM (SELECT w.pending_settlement FROM wallets w WHERE w.id = wallets.id)
    )
  );

-- A new wallet starts empty. Without this a user simply creates one with the
-- balance already in it, which is exactly what the probe did.
DROP POLICY IF EXISTS wallets_insert ON wallets;
CREATE POLICY wallets_insert ON wallets
  FOR INSERT TO authenticated
  WITH CHECK (
    is_platform_admin()
    OR (
      (SELECT auth.uid())::text = user_id
      AND COALESCE(lifetime_earnings, 0)  = 0
      AND COALESCE(available_balance, 0)  = 0
      AND COALESCE(pending_settlement, 0) = 0
    )
  );


-- ── Recording an earning ─────────────────────────────────────────────────
--
-- Called after a payment is confirmed. SECURITY DEFINER so it can write rows
-- the caller cannot, and idempotent so a webhook retry does not pay twice.
CREATE OR REPLACE FUNCTION record_book_earning(
  p_transaction_id TEXT,
  p_author_rate    NUMERIC DEFAULT 0.60
)
RETURNS author_earnings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_txn      payment_transactions;
  v_author   TEXT;
  v_existing author_earnings;
  v_row      author_earnings;
  v_author_minor   BIGINT;
  v_platform_minor BIGINT;
  v_type     TEXT;
BEGIN
  SELECT * INTO v_txn FROM payment_transactions WHERE reference = p_transaction_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No such payment: %', p_transaction_id;
  END IF;

  -- Only a confirmed payment earns anything.
  IF v_txn.status <> 'completed' THEN
    RAISE EXCEPTION 'Payment % is % — only a completed payment earns', p_transaction_id, v_txn.status;
  END IF;

  SELECT author_id INTO v_author FROM api_books WHERE id = v_txn.book_id;
  IF v_author IS NULL THEN
    RAISE EXCEPTION 'Book % has no author', v_txn.book_id;
  END IF;

  -- Already recorded. Return it rather than paying again.
  SELECT * INTO v_existing
    FROM author_earnings
   WHERE author_id = v_author AND transaction_id = p_transaction_id;
  IF FOUND THEN
    RETURN v_existing;
  END IF;

  IF p_author_rate < 0 OR p_author_rate > 1 THEN
    RAISE EXCEPTION 'Author rate must be between 0 and 1, got %', p_author_rate;
  END IF;

  -- Round the author's share, then take the platform's as the remainder, so
  -- the two always sum to the gross exactly. Rounding both independently
  -- loses or invents a kobo on odd amounts.
  v_author_minor   := ROUND(v_txn.amount_minor * p_author_rate);
  v_platform_minor := v_txn.amount_minor - v_author_minor;

  v_type := CASE WHEN v_txn.type = 'purchase' THEN 'sale' ELSE 'borrow' END;

  INSERT INTO author_earnings (
    author_id, book_id, transaction_id, earning_type,
    gross_minor, author_minor, platform_minor, author_rate, currency, status
  ) VALUES (
    v_author, v_txn.book_id, p_transaction_id, v_type,
    v_txn.amount_minor, v_author_minor, v_platform_minor, p_author_rate,
    COALESCE(v_txn.currency, 'NGN'), 'available'
  )
  RETURNING * INTO v_row;

  -- Keep the wallet in step. It is a cache of the ledger, not the source of
  -- truth — author_earnings_balance() recomputes from rows when it matters.
  INSERT INTO wallets (id, user_id, lifetime_earnings, available_balance, pending_settlement, currency)
  VALUES (gen_random_uuid()::text, v_author, v_author_minor / 100.0, v_author_minor / 100.0, 0, 'NGN')
  ON CONFLICT (user_id) DO UPDATE
    SET lifetime_earnings = COALESCE(wallets.lifetime_earnings, 0) + (v_author_minor / 100.0),
        available_balance = COALESCE(wallets.available_balance, 0) + (v_author_minor / 100.0);

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION record_book_earning(TEXT, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_book_earning(TEXT, NUMERIC) TO authenticated;


-- ── Balances, computed from the ledger ───────────────────────────────────
--
-- The wallet is a convenience; this is the truth. A payout is judged against
-- these numbers, so they are derived from immutable rows rather than from a
-- column anyone has ever been able to write.
CREATE OR REPLACE FUNCTION author_earnings_balance(p_author_id TEXT)
RETURNS TABLE (
  lifetime_minor  BIGINT,
  available_minor BIGINT,
  pending_minor   BIGINT,
  paid_minor      BIGINT,
  currency        TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(SUM(author_minor) FILTER (WHERE status <> 'reversed'), 0)::BIGINT,
    COALESCE(SUM(author_minor) FILTER (WHERE status = 'available'), 0)::BIGINT,
    COALESCE(SUM(author_minor) FILTER (WHERE status = 'pending'), 0)::BIGINT,
    COALESCE(SUM(author_minor) FILTER (WHERE status = 'paid'), 0)::BIGINT,
    COALESCE(MAX(currency), 'NGN')
  FROM author_earnings
  WHERE author_id = p_author_id;
$$;

GRANT EXECUTE ON FUNCTION author_earnings_balance(TEXT) TO authenticated;


-- ── Per-book breakdown, for the author dashboard ─────────────────────────
CREATE OR REPLACE FUNCTION author_earnings_by_book(p_author_id TEXT)
RETURNS TABLE (
  book_id       TEXT,
  book_title    TEXT,
  sales_count   BIGINT,
  borrows_count BIGINT,
  earned_minor  BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    e.book_id,
    MAX(b.title),
    COUNT(*) FILTER (WHERE e.earning_type = 'sale'),
    COUNT(*) FILTER (WHERE e.earning_type = 'borrow'),
    COALESCE(SUM(e.author_minor) FILTER (WHERE e.status <> 'reversed'), 0)::BIGINT
  FROM author_earnings e
  LEFT JOIN api_books b ON b.id = e.book_id
  WHERE e.author_id = p_author_id
  GROUP BY e.book_id
  ORDER BY 5 DESC;
$$;

GRANT EXECUTE ON FUNCTION author_earnings_by_book(TEXT) TO authenticated;


-- =============================================================================
-- NOTES
-- =============================================================================
--
-- 1. The 60/40 split is the default argument rather than a hardcoded constant,
--    and the rate that applied is stored on every row. Changing the platform's
--    share later affects new earnings only — an author's history stays as it
--    was earned.
--
-- 2. wallets.available_balance is NUMERIC in naira while author_earnings is
--    BIGINT in kobo. The wallet predates this work and is read by existing UI;
--    converting it is a separate change. Where the two disagree,
--    author_earnings_balance() is correct.
--
-- 3. Subscription-pool earnings are not implemented. They need an engagement
--    metric — minutes read, pages consumed — that book_access_logs has only
--    just started collecting, so any distribution now would divide a pool by
--    numbers that do not yet mean anything.
--
-- =============================================================================
