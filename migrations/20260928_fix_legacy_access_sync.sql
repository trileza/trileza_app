-- =============================================================================
-- TRILEZA — FIX THE LEGACY ACCESS SYNC IN issue_book_license
-- =============================================================================
--
-- Found by issuing the proposal's worked example licence:
--
--     Error: there is no unique or exclusion constraint matching the
--            ON CONFLICT specification
--
-- The mirror write into api_user_library_access used a bare
-- ON CONFLICT DO NOTHING, which needs an inferable unique index. That table has
-- none on (user_id, book_id) — it was built to allow several rows per pair —
-- so every licence issue failed, and no licence could be created at all.
--
-- Replaced with an explicit check. Also makes the mirror an upsert in spirit:
-- a repeat borrow of the same book updates the existing row rather than
-- stacking a second, which is what the reader's entitlement check expects.
--
-- =============================================================================

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
  v_access  TEXT;
BEGIN
  IF p_license_type NOT IN ('owned','borrowed','granted') THEN
    RAISE EXCEPTION 'Unknown license type: %', p_license_type;
  END IF;

  SELECT * INTO v_book FROM api_books WHERE id = p_book_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No such book: %', p_book_id;
  END IF;

  -- Already issued for this payment. Return it rather than issuing a second —
  -- a retried webhook must not produce two licences.
  IF p_transaction_id IS NOT NULL THEN
    SELECT * INTO v_row FROM book_licenses WHERE transaction_id = p_transaction_id;
    IF FOUND THEN
      RETURN v_row;
    END IF;
  END IF;

  SELECT id INTO v_edition
    FROM book_editions
   WHERE book_id = p_book_id AND status = 'published'
   ORDER BY edition_number DESC LIMIT 1;

  IF p_license_type = 'borrowed' THEN
    -- The term comes from the book, so an author-approved different term needs
    -- no code change.
    v_expires := NOW() + (COALESCE(v_book.borrow_days, 5) || ' days')::INTERVAL;

    SELECT * INTO v_row
      FROM book_licenses
     WHERE beneficiary_id = p_beneficiary_id AND book_id = p_book_id
       AND license_type = 'borrowed' AND status IN ('active','expiring')
     LIMIT 1;

    IF FOUND THEN
      -- Extend rather than duplicate: two concurrent loans on one book for one
      -- person is not a state the product has.
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

    -- Borrow-to-own: record what this payment earned, then see whether it has
    -- crossed the ownership threshold.
    IF v_book.allow_borrow_to_own AND p_amount_minor > 0 THEN
      v_credit := ROUND(p_amount_minor * COALESCE(v_book.borrow_credit_rate, 1.0));

      IF p_transaction_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM ownership_credits WHERE transaction_id = p_transaction_id
      ) THEN
        INSERT INTO ownership_credits (
          beneficiary_id, book_id, license_id, transaction_id, credit_minor
        ) VALUES (
          p_beneficiary_id, p_book_id, v_row.id, p_transaction_id, v_credit
        );
      END IF;

      PERFORM maybe_convert_credit_to_ownership(p_beneficiary_id, p_book_id, p_payer_id);
    END IF;

  ELSE
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

  -- Mirror into the legacy access table, which the reader's storage policy and
  -- several screens still read. Done as an explicit update-or-insert because
  -- that table has no unique index to infer an ON CONFLICT target from.
  v_access := CASE WHEN v_row.license_type = 'borrowed' THEN 'rent' ELSE 'own' END;

  UPDATE api_user_library_access
     SET access_type  = v_access,
         expires_at   = v_row.expires_at,
         returned_at  = NULL,
         sponsored_by = CASE WHEN p_payer_id <> p_beneficiary_id THEN p_payer_id ELSE sponsored_by END
   WHERE user_id = p_beneficiary_id AND book_id = p_book_id;

  IF NOT FOUND THEN
    INSERT INTO api_user_library_access (
      id, user_id, book_id, access_type, sponsored_by, created_at, expires_at
    ) VALUES (
      gen_random_uuid()::text, p_beneficiary_id, p_book_id, v_access,
      CASE WHEN p_payer_id <> p_beneficiary_id THEN p_payer_id ELSE NULL END,
      NOW(), v_row.expires_at
    );
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION issue_book_license(TEXT,TEXT,TEXT,TEXT,TEXT,BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION issue_book_license(TEXT,TEXT,TEXT,TEXT,TEXT,BIGINT) TO authenticated;
