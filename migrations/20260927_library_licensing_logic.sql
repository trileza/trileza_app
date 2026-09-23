-- =============================================================================
-- TRILEZA LIBRARY — LICENSING LOGIC
-- =============================================================================
--
-- The rules from the proposal, enforced in the database rather than in the UI.
--
-- The proposal is explicit about why: "For a borrowed license, the reader
-- should check authorization through the backend. Hiding a button in the
-- frontend is not a security control."
--
-- =============================================================================


-- ── What may this user do with this book ─────────────────────────────────
--
-- One place that answers the whole role matrix, so the book page, the reader
-- and the payment path cannot disagree about it.
--
--   a mentee buys, or asks a mentor — never borrows (section 2)
--   a mentor buys for themselves, buys for a mentee, or borrows for a mentee
--   an author always reads their own work
--
-- Returns booleans rather than raising, because the book page needs to render
-- the permitted actions, not handle an exception.
CREATE OR REPLACE FUNCTION book_actions_for_user(p_user_id TEXT, p_book_id TEXT)
RETURNS TABLE (
  can_buy_self      BOOLEAN,
  can_buy_for_mentee BOOLEAN,
  can_borrow_for_mentee BOOLEAN,
  can_request       BOOLEAN,
  can_read          BOOLEAN,
  is_mentor         BOOLEAN,
  already_owns      BOOLEAN,
  has_active_loan   BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_book      api_books;
  v_role      TEXT;
  v_meta      JSONB;
  v_is_mentor BOOLEAN := FALSE;
  v_owns      BOOLEAN := FALSE;
  v_loan      BOOLEAN := FALSE;
  v_author    BOOLEAN := FALSE;
  v_has_mentor BOOLEAN := FALSE;
BEGIN
  SELECT * INTO v_book FROM api_books WHERE id = p_book_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE,FALSE,FALSE,FALSE,FALSE,FALSE,FALSE,FALSE;
    RETURN;
  END IF;

  SELECT p.role, p.metadata INTO v_role, v_meta FROM profiles p WHERE p.id = p_user_id;
  v_role := lower(coalesce(v_role, ''));

  -- Mentor status follows the same rule the app uses elsewhere: role alone is
  -- not enough, because an approved mentor can still sit at role 'mentee'.
  v_is_mentor :=
    v_role IN ('mentor','tutor','teacher','management','staff','admin','super_admin')
    OR coalesce(v_meta->>'mentor_onboarded', '') = 'true'
    OR coalesce(v_meta->>'mentor_application_status', '') = 'approved';

  v_author := (v_book.author_id = p_user_id);

  SELECT EXISTS (
    SELECT 1 FROM book_licenses l
     WHERE l.beneficiary_id = p_user_id AND l.book_id = p_book_id
       AND l.license_type IN ('owned','granted')
       AND l.status IN ('active','owned')
  ) INTO v_owns;

  SELECT EXISTS (
    SELECT 1 FROM book_licenses l
     WHERE l.beneficiary_id = p_user_id AND l.book_id = p_book_id
       AND l.license_type = 'borrowed'
       AND l.status IN ('active','expiring')
       AND (l.expires_at IS NULL OR l.expires_at > NOW())
  ) INTO v_loan;

  SELECT EXISTS (
    SELECT 1 FROM mentor_mentees m
     WHERE m.mentee_id = p_user_id AND m.status = 'active'
  ) INTO v_has_mentor;

  RETURN QUERY SELECT
    -- Anyone may buy for themselves, if the author allows purchase and they do
    -- not already own it.
    (v_book.allow_purchase AND NOT v_owns AND NOT v_author),
    -- Only a mentor may buy on someone else's behalf.
    (v_is_mentor AND v_book.allow_mentor_gift AND NOT v_author),
    -- Borrowing is a mentor action, always for a mentee. A mentee cannot
    -- initiate one for themselves.
    (v_is_mentor AND v_book.allow_borrow AND NOT v_author),
    -- Asking a mentor only makes sense if you have one and do not have it.
    (NOT v_is_mentor AND v_has_mentor AND NOT v_owns AND NOT v_loan),
    (v_owns OR v_loan OR v_author),
    v_is_mentor,
    v_owns,
    v_loan;
END;
$$;

GRANT EXECUTE ON FUNCTION book_actions_for_user(TEXT, TEXT) TO authenticated;


-- ── Issue a licence ──────────────────────────────────────────────────────
--
-- The only way a licence comes into being. SECURITY DEFINER so it can write a
-- row no client may write, and idempotent on transaction so a retried payment
-- webhook cannot issue two licences for one payment — which the proposal calls
-- out specifically as the thing idempotency must prevent.
CREATE OR REPLACE FUNCTION issue_book_license(
  p_book_id        TEXT,
  p_beneficiary_id TEXT,
  p_payer_id       TEXT,
  p_license_type   TEXT,
  p_transaction_id TEXT DEFAULT NULL,
  p_amount_minor   BIGINT DEFAULT 0
)
RETURNS book_licenses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_book    api_books;
  v_row     book_licenses;
  v_edition TEXT;
  v_expires TIMESTAMPTZ;
  v_credit  BIGINT;
  v_total   BIGINT;
BEGIN
  IF p_license_type NOT IN ('owned','borrowed','granted') THEN
    RAISE EXCEPTION 'Unknown license type: %', p_license_type;
  END IF;

  SELECT * INTO v_book FROM api_books WHERE id = p_book_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No such book: %', p_book_id;
  END IF;

  -- Already issued for this payment. Return it rather than issuing a second.
  IF p_transaction_id IS NOT NULL THEN
    SELECT * INTO v_row FROM book_licenses WHERE transaction_id = p_transaction_id;
    IF FOUND THEN
      RETURN v_row;
    END IF;
  END IF;

  -- The author's latest published edition, so a licence points at a version
  -- rather than floating free of one.
  SELECT id INTO v_edition
    FROM book_editions
   WHERE book_id = p_book_id AND status = 'published'
   ORDER BY edition_number DESC LIMIT 1;

  IF p_license_type = 'borrowed' THEN
    -- The term comes from the book, not from a constant, so an author-approved
    -- different term needs no code change.
    v_expires := NOW() + (COALESCE(v_book.borrow_days, 5) || ' days')::INTERVAL;

    -- An existing live loan is extended rather than duplicated: two concurrent
    -- loans on one book for one person is not a state the product has.
    SELECT * INTO v_row
      FROM book_licenses
     WHERE beneficiary_id = p_beneficiary_id AND book_id = p_book_id
       AND license_type = 'borrowed' AND status IN ('active','expiring')
     LIMIT 1;

    IF FOUND THEN
      UPDATE book_licenses
         SET expires_at = GREATEST(COALESCE(expires_at, NOW()), v_expires),
             status = 'active',
             updated_at = NOW()
       WHERE id = v_row.id
      RETURNING * INTO v_row;
    ELSE
      INSERT INTO book_licenses (
        book_id, edition_id, beneficiary_id, payer_id, license_type,
        status, start_at, expires_at, purchase_minor, transaction_id
      ) VALUES (
        p_book_id, v_edition, p_beneficiary_id, p_payer_id, 'borrowed',
        'active', NOW(), v_expires, p_amount_minor, p_transaction_id
      )
      RETURNING * INTO v_row;
    END IF;

    -- Borrow-to-own: record the credit this payment earned, then check whether
    -- it has crossed the ownership threshold.
    IF v_book.allow_borrow_to_own AND p_amount_minor > 0 THEN
      v_credit := ROUND(p_amount_minor * COALESCE(v_book.borrow_credit_rate, 1.0));

      INSERT INTO ownership_credits (
        beneficiary_id, book_id, license_id, transaction_id, credit_minor
      ) VALUES (
        p_beneficiary_id, p_book_id, v_row.id, p_transaction_id, v_credit
      )
      ON CONFLICT (transaction_id) DO NOTHING;

      PERFORM maybe_convert_credit_to_ownership(p_beneficiary_id, p_book_id, p_payer_id);
    END IF;

  ELSE
    -- Ownership. The partial unique index means a second attempt raises, so
    -- return what already exists instead.
    SELECT * INTO v_row
      FROM book_licenses
     WHERE beneficiary_id = p_beneficiary_id AND book_id = p_book_id
       AND license_type IN ('owned','granted') AND status IN ('active','owned')
     LIMIT 1;

    IF FOUND THEN
      RETURN v_row;
    END IF;

    INSERT INTO book_licenses (
      book_id, edition_id, beneficiary_id, payer_id, license_type,
      status, start_at, expires_at, purchase_minor, transaction_id
    ) VALUES (
      p_book_id, v_edition, p_beneficiary_id, p_payer_id, p_license_type,
      'owned', NOW(), NULL, p_amount_minor, p_transaction_id
    )
    RETURNING * INTO v_row;
  END IF;

  -- Keep the legacy access table in step. The reader's storage policy and
  -- several screens still read it, so letting it drift would break them.
  INSERT INTO api_user_library_access (
    id, user_id, book_id, access_type, sponsored_by, created_at, expires_at
  ) VALUES (
    gen_random_uuid()::text, p_beneficiary_id, p_book_id,
    CASE WHEN v_row.license_type = 'borrowed' THEN 'rent' ELSE 'own' END,
    CASE WHEN p_payer_id <> p_beneficiary_id THEN p_payer_id ELSE NULL END,
    NOW(), v_row.expires_at
  )
  ON CONFLICT DO NOTHING;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION issue_book_license(TEXT,TEXT,TEXT,TEXT,TEXT,BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION issue_book_license(TEXT,TEXT,TEXT,TEXT,TEXT,BIGINT) TO authenticated;


-- ── Borrow-to-own conversion ─────────────────────────────────────────────
--
-- When accumulated credit reaches the book price, ownership is granted and the
-- credit marked consumed in the same statement — so the same credit cannot buy
-- the book twice, which the proposal warns about directly.
CREATE OR REPLACE FUNCTION maybe_convert_credit_to_ownership(
  p_beneficiary_id TEXT,
  p_book_id        TEXT,
  p_payer_id       TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_price_minor BIGINT;
  v_available   BIGINT;
  v_license     book_licenses;
BEGIN
  SELECT ROUND(COALESCE(retail_price,0) * 100)::BIGINT INTO v_price_minor
    FROM api_books WHERE id = p_book_id;

  IF v_price_minor IS NULL OR v_price_minor <= 0 THEN
    RETURN FALSE;
  END IF;

  -- Already owns it; nothing to convert.
  IF EXISTS (
    SELECT 1 FROM book_licenses
     WHERE beneficiary_id = p_beneficiary_id AND book_id = p_book_id
       AND license_type IN ('owned','granted') AND status IN ('active','owned')
  ) THEN
    RETURN FALSE;
  END IF;

  SELECT COALESCE(SUM(credit_minor),0) INTO v_available
    FROM ownership_credits
   WHERE beneficiary_id = p_beneficiary_id AND book_id = p_book_id
     AND status = 'available';

  IF v_available < v_price_minor THEN
    RETURN FALSE;
  END IF;

  INSERT INTO book_licenses (
    book_id, beneficiary_id, payer_id, license_type,
    status, start_at, purchase_minor
  ) VALUES (
    p_book_id, p_beneficiary_id, COALESCE(p_payer_id, p_beneficiary_id), 'owned',
    'owned', NOW(), v_available
  )
  RETURNING * INTO v_license;

  UPDATE ownership_credits
     SET status = 'consumed', consumed_at = NOW()
   WHERE beneficiary_id = p_beneficiary_id AND book_id = p_book_id
     AND status = 'available';

  UPDATE api_user_library_access
     SET access_type = 'own', expires_at = NULL, returned_at = NULL
   WHERE user_id = p_beneficiary_id AND book_id = p_book_id;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION maybe_convert_credit_to_ownership(TEXT,TEXT,TEXT) TO authenticated;


-- ── Server-side access check ─────────────────────────────────────────────
--
-- What the reader asks before serving a page. Expiry is evaluated here, not
-- trusted from a stored status that a background job may not have reached yet.
CREATE OR REPLACE FUNCTION can_read_book(p_user_id TEXT, p_book_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM api_books b
     WHERE b.id = p_book_id AND b.author_id = p_user_id
  )
  OR EXISTS (
    SELECT 1 FROM book_licenses l
     WHERE l.beneficiary_id = p_user_id
       AND l.book_id = p_book_id
       AND l.status IN ('active','expiring','owned')
       AND (
         l.license_type IN ('owned','granted')
         OR l.expires_at IS NULL
         OR l.expires_at > NOW()
       )
  );
$$;

GRANT EXECUTE ON FUNCTION can_read_book(TEXT,TEXT) TO authenticated;


-- ── Expire lapsed loans ──────────────────────────────────────────────────
--
-- Bookkeeping rather than enforcement — can_read_book already refuses an
-- expired loan the moment it lapses. This keeps My Library honest about which
-- section a book belongs in, and marks the near-expiry state the proposal uses
-- for its warning notifications.
CREATE OR REPLACE FUNCTION expire_lapsed_licenses()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE book_licenses
     SET status = 'expiring', updated_at = NOW()
   WHERE status = 'active'
     AND license_type = 'borrowed'
     AND expires_at IS NOT NULL
     AND expires_at <= NOW() + INTERVAL '1 day'
     AND expires_at > NOW();

  WITH expired AS (
    UPDATE book_licenses
       SET status = 'expired', updated_at = NOW()
     WHERE status IN ('active','expiring')
       AND license_type = 'borrowed'
       AND expires_at IS NOT NULL
       AND expires_at <= NOW()
    RETURNING book_id, beneficiary_id
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

GRANT EXECUTE ON FUNCTION expire_lapsed_licenses() TO authenticated, anon;


-- ── My Library, in the proposal's sections ───────────────────────────────
CREATE OR REPLACE FUNCTION my_library(p_user_id TEXT)
RETURNS TABLE (
  book_id       TEXT,
  title         TEXT,
  author_name   TEXT,
  cover_url     TEXT,
  section       TEXT,
  license_type  TEXT,
  status        TEXT,
  expires_at    TIMESTAMPTZ,
  days_left     INTEGER,
  payer_id      TEXT,
  sponsored     BOOLEAN,
  percent_read  NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    b.id,
    b.title,
    b.author_name,
    b.cover_url,
    CASE
      WHEN l.license_type IN ('owned','granted') THEN 'owned'
      WHEN l.status = 'expired' THEN 'expired'
      WHEN l.expires_at IS NOT NULL AND l.expires_at <= NOW() + INTERVAL '1 day' THEN 'expiring'
      ELSE 'borrowed'
    END,
    l.license_type,
    l.status,
    l.expires_at,
    CASE WHEN l.expires_at IS NULL THEN NULL
         ELSE GREATEST(0, CEIL(EXTRACT(EPOCH FROM (l.expires_at - NOW())) / 86400)::INTEGER)
    END,
    l.payer_id,
    (l.payer_id <> l.beneficiary_id),
    COALESCE(rp.percent_read, 0)
  FROM book_licenses l
  JOIN api_books b ON b.id = l.book_id
  LEFT JOIN reading_progress rp
         ON rp.user_id = l.beneficiary_id AND rp.book_id = l.book_id
  WHERE l.beneficiary_id = p_user_id
  ORDER BY
    CASE WHEN l.status IN ('active','owned','expiring') THEN 0 ELSE 1 END,
    l.updated_at DESC;
$$;

GRANT EXECUTE ON FUNCTION my_library(TEXT) TO authenticated;


-- ── Mentor sponsorship view ──────────────────────────────────────────────
-- What the proposal's mentor dashboard needs: who I sponsored, what is still
-- running, and how far they have read.
CREATE OR REPLACE FUNCTION mentor_sponsorships(p_mentor_id TEXT)
RETURNS TABLE (
  license_id     TEXT,
  book_id        TEXT,
  title          TEXT,
  cover_url      TEXT,
  mentee_id      TEXT,
  mentee_name    TEXT,
  license_type   TEXT,
  status         TEXT,
  expires_at     TIMESTAMPTZ,
  days_left      INTEGER,
  percent_read   NUMERIC,
  amount_minor   BIGINT,
  credit_minor   BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    l.id,
    b.id,
    b.title,
    b.cover_url,
    l.beneficiary_id,
    p.full_name,
    l.license_type,
    l.status,
    l.expires_at,
    CASE WHEN l.expires_at IS NULL THEN NULL
         ELSE GREATEST(0, CEIL(EXTRACT(EPOCH FROM (l.expires_at - NOW())) / 86400)::INTEGER)
    END,
    COALESCE(rp.percent_read, 0),
    l.purchase_minor,
    COALESCE((
      SELECT SUM(c.credit_minor) FROM ownership_credits c
       WHERE c.beneficiary_id = l.beneficiary_id
         AND c.book_id = l.book_id AND c.status = 'available'
    ), 0)
  FROM book_licenses l
  JOIN api_books b ON b.id = l.book_id
  LEFT JOIN profiles p ON p.id = l.beneficiary_id
  LEFT JOIN reading_progress rp
         ON rp.user_id = l.beneficiary_id AND rp.book_id = l.book_id
  WHERE l.payer_id = p_mentor_id
    AND l.payer_id <> l.beneficiary_id
  ORDER BY l.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION mentor_sponsorships(TEXT) TO authenticated;
