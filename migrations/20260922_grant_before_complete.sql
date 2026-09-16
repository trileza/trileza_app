-- =============================================================================
-- TRILEZA — LET A GRANT PRECEDE THE LEDGER BEING MARKED COMPLETE
-- =============================================================================
--
-- Found by an end-to-end test against Paystack's test environment, not by
-- reading the code.
--
-- The webhook marked payment_transactions 'completed' and then granted the
-- book. When the grant failed — in the test, because the buyer had no profiles
-- row — the ledger already read 'completed', so every retry hit the
-- idempotency gate, reported already_processed, and did nothing. The money was
-- taken, the book never arrived, and no number of retries could repair it:
--
--     delivery 1  HTTP 500  {"error":"grant failed"}
--     delivery 2  HTTP 200  {"already_processed":true}   <- wrong
--     delivery 3  HTTP 200  {"already_processed":true}
--     access rows: 0
--
-- The webhook now grants first and marks the ledger afterwards, so a failed
-- grant leaves the row 'pending' and the next delivery genuinely retries.
--
-- That inverts the dependency this function was written around: it required a
-- 'completed' row, which can no longer exist at the moment it is called. The
-- check becomes "this payment exists, belongs to this user, is for this book,
-- and Paystack has confirmed it" — with the caller responsible for that last
-- part, which is exactly what payments-verify and the webhook both do before
-- calling in.
--
-- A 'pending' row created by initialize and never paid still grants nothing,
-- because nothing calls this function without first confirming the charge with
-- Paystack — payments-verify checks status, amount and currency, and the
-- webhook checks a signed payload plus the amount. This function is not the
-- place that decides whether money arrived; it is the place that records the
-- entitlement once something trustworthy has decided.
--
-- =============================================================================

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

  IF is_platform_admin() OR has_admin_role('content_manager') THEN
    v_paid := TRUE;
  ELSIF v_is_free THEN
    v_paid := TRUE;
  ELSIF p_reference IS NOT NULL THEN
    -- The payment must belong to this user and this book. Matching on the
    -- reference alone would let a cheap book's reference be replayed against
    -- an expensive one.
    --
    -- 'pending' is allowed because the webhook now grants before completing,
    -- so that a failed grant leaves a retryable row. Both callers verify with
    -- Paystack before reaching this point.
    SELECT EXISTS (
      SELECT 1 FROM payment_transactions t
       WHERE t.reference = p_reference
         AND t.status   IN ('completed', 'pending')
         AND t.user_id   = p_user_id
         AND t.book_id   = p_book_id
    ) INTO v_paid;
  END IF;

  IF NOT v_paid THEN
    RAISE EXCEPTION 'No payment found for this book';
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


-- ── Every account needs a profile ────────────────────────────────────────
--
-- The grant failed on a foreign key: api_user_library_access.user_id
-- references profiles, and the test account had an auth.users row but no
-- profile. Signing up through the app creates one, so this only bites accounts
-- made another way — an admin invite, an import, a test — but the consequence
-- is that a real payment cannot be fulfilled, which is too severe to leave to
-- whichever path created the user.
CREATE OR REPLACE FUNCTION ensure_profile_exists()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role)
  VALUES (
    NEW.id::text,
    NEW.email,
    COALESCE(NULLIF(trim(NEW.profile->>'name'), ''), split_part(NEW.email, '@', 1)),
    'mentee'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  -- auth.users is platform-managed, so a trigger on it may not be permitted.
  -- Try, and carry on if not: the backfill below still repairs existing rows.
  BEGIN
    DROP TRIGGER IF EXISTS trg_ensure_profile_exists ON auth.users;
    CREATE TRIGGER trg_ensure_profile_exists
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION ensure_profile_exists();
  EXCEPTION WHEN insufficient_privilege OR undefined_table THEN
    RAISE NOTICE 'Could not attach profile trigger to auth.users; relying on app-side creation.';
  END;
END $$;

-- Repair accounts that already lack one.
INSERT INTO profiles (id, email, full_name, role)
SELECT u.id::text,
       u.email,
       COALESCE(NULLIF(trim(u.profile->>'name'), ''), split_part(u.email, '@', 1)),
       'mentee'
  FROM auth.users u
 WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = u.id::text)
ON CONFLICT (id) DO NOTHING;
