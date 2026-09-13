-- =============================================================================
-- TRILEZA — LOGIC FIXES: ADMIN LIFECYCLE, ATOMIC ADMIN ACTIONS, PROVISIONING,
--           PROFILE PRIVACY
-- =============================================================================
--
-- Run after 20260908_institution_kyc.sql (depends on is_platform_admin(),
-- has_admin_role(), is_guardian_of() and teaches_class()).
--
--   1. Admin record status. The console approved registrations as 'approved'
--      while the UI only admits 'active', so approved admins were locked out.
--      The database helpers, meanwhile, ignored status entirely and treated a
--      pending applicant as an admin. Both now agree on 'active'.
--   2. Self-service admin applications, bound to the signed-in account.
--   3. One audit table (admin_audit_logs) instead of two.
--   4. Approvals, refunds and payouts as single transactions.
--   5. Institution provisioning and registration that a customer can run.
--   6. profiles is no longer world-readable; public fields move to a view.
--
-- REVIEW ON A STAGING BRANCH FIRST. Section 6 narrows who can read profiles;
-- verify signed-out pages, the feed, messaging, a mentor, a teacher, a guardian
-- and each admin console before promoting.
--
-- =============================================================================


-- --- 1. Admin record status ---------------------------------------------------

ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS status TEXT;

-- 'approved' was only ever written by the bug being fixed here.
UPDATE admin_users SET status = 'active' WHERE status IS NULL OR status = 'approved';

-- Records created by invitation carry no status and are granted directly by a
-- super admin, so the default is 'active'. Self-service applications are
-- inserted as 'pending' by request_admin_access() below.
ALTER TABLE admin_users ALTER COLUMN status SET DEFAULT 'active';

ALTER TABLE admin_users DROP CONSTRAINT IF EXISTS admin_users_status_check;
ALTER TABLE admin_users ADD CONSTRAINT admin_users_status_check
  CHECK (status IN ('pending', 'active', 'rejected', 'suspended')) NOT VALID;

CREATE OR REPLACE FUNCTION is_platform_admin() RETURNS BOOLEAN AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users a
    WHERE a.user_id::text = auth.uid()::text
      AND COALESCE(a.suspended, FALSE) = FALSE
      AND COALESCE(a.status, 'active') = 'active'
  );
$fn$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION has_admin_role(required_role TEXT) RETURNS BOOLEAN AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users a
    WHERE a.user_id::text = auth.uid()::text
      AND COALESCE(a.suspended, FALSE) = FALSE
      AND COALESCE(a.status, 'active') = 'active'
      AND (
        a.roles::jsonb ? 'super_admin'
        OR a.roles::jsonb ? required_role
      )
  );
$fn$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;


-- --- 2. Self-service admin applications --------------------------------------
-- The old flow looked up an account by email and inserted an admin record for
-- it without the requester ever proving they owned that account. This binds
-- the application to the caller's own session instead.

CREATE OR REPLACE FUNCTION request_admin_access(p_role TEXT, p_backup_codes JSONB)
RETURNS JSONB AS $fn$
DECLARE
  v_uid     TEXT := auth.uid()::text;
  v_email   TEXT;
  v_fields  JSONB;
  v_row     admin_users%ROWTYPE;
  v_id_has_default BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to the account you want to use for admin access.' USING ERRCODE = '28000';
  END IF;

  -- super_admin is never self-service.
  IF p_role IS NULL OR p_role NOT IN (
    'content_manager', 'user_manager', 'finance_admin',
    'support_agent', 'compliance_officer', 'analytics_viewer'
  ) THEN
    RAISE EXCEPTION 'That admin role cannot be requested.' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM admin_users
    WHERE user_id::text = v_uid AND COALESCE(status, 'active') IN ('pending', 'active')
  ) THEN
    RAISE EXCEPTION 'This account already holds or has requested admin access.' USING ERRCODE = '23505';
  END IF;

  SELECT email INTO v_email FROM profiles WHERE id::text = v_uid;

  -- Built as JSON and cast through the row type so array/JSON column types are
  -- converted to whatever this deployment uses.
  v_fields := jsonb_build_object(
    'id', v_uid,
    'user_id', v_uid,
    'role', p_role,
    'roles', jsonb_build_array(p_role),
    'permissions', jsonb_build_array(p_role),
    'twofa_email', v_email,
    'twofa_enabled', TRUE,
    'status', 'pending',
    'backup_codes', COALESCE(p_backup_codes, '[]'::jsonb)
  );

  SELECT column_default IS NOT NULL INTO v_id_has_default
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'admin_users' AND column_name = 'id';

  IF v_id_has_default THEN
    INSERT INTO admin_users (user_id, role, roles, permissions, twofa_email, twofa_enabled, status, backup_codes)
    SELECT r.user_id, r.role, r.roles, r.permissions, r.twofa_email, r.twofa_enabled, r.status, r.backup_codes
    FROM jsonb_populate_record(NULL::admin_users, v_fields) r
    RETURNING * INTO v_row;
  ELSE
    -- Legacy schema: id is the profile id.
    INSERT INTO admin_users (id, user_id, role, roles, permissions, twofa_email, twofa_enabled, status, backup_codes)
    SELECT r.id, r.user_id, r.role, r.roles, r.permissions, r.twofa_email, r.twofa_enabled, r.status, r.backup_codes
    FROM jsonb_populate_record(NULL::admin_users, v_fields) r
    RETURNING * INTO v_row;
  END IF;

  IF to_regclass('public.admin_applications') IS NOT NULL THEN
    INSERT INTO admin_applications (user_id, role, reason, status)
    VALUES (v_uid, p_role, 'Self-service admin application.', 'pending');
  END IF;

  RETURN jsonb_build_object('id', v_row.id, 'status', v_row.status, 'role', p_role);
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION request_admin_access(TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION request_admin_access(TEXT, JSONB) TO authenticated;


-- --- 3. One audit table ------------------------------------------------------
-- admin_audit_logs (plural) is the one every console reads, so it becomes the
-- only one written. admin_audit_log (singular) is copied in and left in place
-- for inspection; drop it once the copy is verified.

ALTER TABLE admin_audit_logs ALTER COLUMN admin_id DROP NOT NULL;
ALTER TABLE admin_audit_logs ALTER COLUMN reason DROP NOT NULL;
ALTER TABLE admin_audit_logs DROP CONSTRAINT IF EXISTS admin_audit_logs_action_type_check;
ALTER TABLE admin_audit_logs DROP CONSTRAINT IF EXISTS admin_audit_logs_target_type_check;
ALTER TABLE admin_audit_logs ADD COLUMN IF NOT EXISTS admin_user_id TEXT;
ALTER TABLE admin_audit_logs ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE admin_audit_logs ADD COLUMN IF NOT EXISTS legacy_source_id TEXT;

-- Deleting a user used to cascade-delete every audit entry they authored.
DO $fk$
DECLARE c RECORD;
BEGIN
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
    WHERE con.conrelid = 'public.admin_audit_logs'::regclass
      AND con.contype = 'f'
      AND att.attname = 'admin_id'
  LOOP
    EXECUTE format('ALTER TABLE admin_audit_logs DROP CONSTRAINT %I', c.conname);
  END LOOP;
  ALTER TABLE admin_audit_logs
    ADD CONSTRAINT admin_audit_logs_admin_id_fkey
    FOREIGN KEY (admin_id) REFERENCES profiles(id) ON DELETE SET NULL NOT VALID;
END
$fk$;

-- The acting admin is whoever holds the session, not whatever the client sends.
CREATE OR REPLACE FUNCTION stamp_admin_audit_log() RETURNS TRIGGER AS $fn$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.admin_id := auth.uid()::text;
  END IF;
  IF NEW.admin_user_id IS NULL AND NEW.admin_id IS NOT NULL THEN
    NEW.admin_user_id := (
      SELECT a.id::text FROM admin_users a WHERE a.user_id::text = NEW.admin_id LIMIT 1
    );
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_stamp_admin_audit_log ON admin_audit_logs;
CREATE TRIGGER trg_stamp_admin_audit_log
  BEFORE INSERT ON admin_audit_logs
  FOR EACH ROW EXECUTE FUNCTION stamp_admin_audit_log();

-- Copy the singular table across. Read through to_jsonb so this works whatever
-- columns that table ended up with; re-running skips rows already copied.
DO $copy$
BEGIN
  IF to_regclass('public.admin_audit_log') IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO admin_audit_logs (
    created_at, admin_id, admin_user_id, action_type, target_type, target_id,
    previous_state, new_state, reason, ip_address, legacy_source_id
  )
  SELECT
    COALESCE((s.j->>'created_at')::timestamptz, (s.j->>'timestamp')::timestamptz, NOW()),
    au.user_id::text,
    s.j->>'admin_user_id',
    COALESCE(s.j->>'action', 'unknown'),
    COALESCE(s.j->>'target_type', 'unknown'),
    COALESCE(s.j->>'target_id', ''),
    s.j->'previous_state',
    COALESCE(s.j->'new_state', s.j->'details'),
    s.j->>'reason',
    COALESCE(s.j->>'ip_address', s.j->>'ip'),
    s.j->>'id'
  FROM (SELECT to_jsonb(l) AS j FROM admin_audit_log l) s
  LEFT JOIN admin_users au ON au.id::text = s.j->>'admin_user_id'
  WHERE NOT EXISTS (
    SELECT 1 FROM admin_audit_logs x WHERE x.legacy_source_id = s.j->>'id'
  );
END
$copy$;


-- --- 4. Atomic admin actions -------------------------------------------------
-- Each of these used to be three to five separate client writes. A dropped
-- connection between them left a payout approved with no deduction, or a
-- course marked approved but still in draft. Each is now one transaction that
-- also refuses to repeat a decision already made.

CREATE OR REPLACE FUNCTION admin_review_payout(p_payout_id TEXT, p_status TEXT, p_reason TEXT)
RETURNS JSONB AS $fn$
DECLARE
  v_payout payout_requests%ROWTYPE;
  v_wallet wallets%ROWTYPE;
  v_prev   JSONB;
BEGIN
  IF NOT has_admin_role('finance_admin') THEN
    RAISE EXCEPTION 'Only finance admins can decide payouts.' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Unknown payout decision: %', p_status USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_payout FROM payout_requests WHERE id::text = p_payout_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payout request not found.' USING ERRCODE = 'P0002';
  END IF;
  IF v_payout.status <> 'pending' THEN
    RAISE EXCEPTION 'This payout has already been %.', v_payout.status USING ERRCODE = '55000';
  END IF;

  v_prev := to_jsonb(v_payout);

  IF p_status = 'approved' THEN
    SELECT * INTO v_wallet FROM wallets WHERE user_id::text = v_payout.user_id::text FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'The vendor has no wallet, so nothing can be paid out.' USING ERRCODE = 'P0002';
    END IF;
    IF COALESCE(v_wallet.available_balance, 0) < v_payout.amount THEN
      RAISE EXCEPTION 'Insufficient balance: wallet holds %, payout requests %.',
        COALESCE(v_wallet.available_balance, 0), v_payout.amount USING ERRCODE = '55000';
    END IF;

    INSERT INTO transactions (wallet_id, amount, type, status, description, metadata)
    VALUES (
      v_wallet.id, -v_payout.amount, 'payout', 'completed',
      'Payout to bank account: ' || COALESCE(p_reason, ''),
      jsonb_build_object('payout_id', v_payout.id)
    );

    UPDATE wallets
    SET available_balance = COALESCE(available_balance, 0) - v_payout.amount
    WHERE id = v_wallet.id;
  END IF;

  UPDATE payout_requests
  SET status = p_status, reviewed_by = auth.uid()::text, reason = p_reason, reviewed_at = NOW()
  WHERE id = v_payout.id
  RETURNING * INTO v_payout;

  INSERT INTO admin_audit_logs (action_type, target_type, target_id, previous_state, new_state, reason)
  VALUES (
    CASE WHEN p_status = 'approved' THEN 'approve' ELSE 'reject' END,
    'payout', v_payout.id::text, v_prev,
    jsonb_build_object('status', p_status, 'reason', p_reason),
    format('Payout request %s. Reason: %s', p_status, COALESCE(p_reason, ''))
  );

  RETURN to_jsonb(v_payout);
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


CREATE OR REPLACE FUNCTION admin_refund_transaction(p_transaction_id TEXT, p_amount NUMERIC, p_reason TEXT)
RETURNS JSONB AS $fn$
DECLARE
  v_tx     transactions%ROWTYPE;
  v_refund transactions%ROWTYPE;
  v_amount NUMERIC;
BEGIN
  IF NOT has_admin_role('finance_admin') THEN
    RAISE EXCEPTION 'Only finance admins can issue refunds.' USING ERRCODE = '42501';
  END IF;
  IF COALESCE(TRIM(p_reason), '') = '' THEN
    RAISE EXCEPTION 'A refund needs a reason.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_tx FROM transactions WHERE id::text = p_transaction_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found.' USING ERRCODE = 'P0002';
  END IF;
  IF v_tx.type <> 'sale' OR v_tx.amount <= 0 THEN
    RAISE EXCEPTION 'Only a completed sale can be refunded.' USING ERRCODE = '55000';
  END IF;

  -- Checked after taking the row lock, so two concurrent refunds cannot both pass.
  IF EXISTS (
    SELECT 1 FROM transactions r
    WHERE r.metadata->>'refund_of' = v_tx.id::text
       OR r.description LIKE 'Refund issued for txn ' || v_tx.id::text || ':%'
  ) THEN
    RAISE EXCEPTION 'This sale has already been refunded.' USING ERRCODE = '55000';
  END IF;

  v_amount := COALESCE(ABS(p_amount), v_tx.amount);
  IF v_amount <= 0 OR v_amount > v_tx.amount THEN
    RAISE EXCEPTION 'Refund amount must be between 0 and the sale amount (%).', v_tx.amount USING ERRCODE = '22023';
  END IF;

  PERFORM 1 FROM wallets WHERE id::text = v_tx.wallet_id::text FOR UPDATE;

  INSERT INTO transactions (wallet_id, amount, type, status, description, metadata)
  VALUES (
    v_tx.wallet_id, -v_amount, 'sale', 'completed',
    'Refund issued for txn ' || v_tx.id::text || ': ' || p_reason,
    jsonb_build_object('refund_of', v_tx.id)
  )
  RETURNING * INTO v_refund;

  UPDATE wallets
  SET available_balance = COALESCE(available_balance, 0) - v_amount
  WHERE id::text = v_tx.wallet_id::text;

  INSERT INTO admin_audit_logs (action_type, target_type, target_id, previous_state, new_state, reason)
  VALUES (
    'refund', 'payout', v_tx.id::text,
    jsonb_build_object('wallet_id', v_tx.wallet_id, 'amount', v_tx.amount),
    jsonb_build_object('refunded', TRUE, 'refund_tx_id', v_refund.id, 'amount', v_amount),
    format('Issued refund of NGN %s. Reason: %s', v_amount, p_reason)
  );

  RETURN to_jsonb(v_refund);
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


CREATE OR REPLACE FUNCTION admin_review_course(p_review_id TEXT, p_status TEXT, p_checklist JSONB, p_notes TEXT)
RETURNS JSONB AS $fn$
DECLARE
  v_review course_reviews%ROWTYPE;
  v_prev   JSONB;
BEGIN
  IF NOT has_admin_role('content_manager') THEN
    RAISE EXCEPTION 'Only content managers can review courses.' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('approved', 'needs_changes', 'rejected') THEN
    RAISE EXCEPTION 'Unknown course decision: %', p_status USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_review FROM course_reviews WHERE id::text = p_review_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Course review not found.' USING ERRCODE = 'P0002';
  END IF;
  v_prev := to_jsonb(v_review);

  UPDATE course_reviews SET
    content_manager_id     = auth.uid()::text,
    status                 = p_status,
    checklist_title        = COALESCE((p_checklist->>'checklist_title')::boolean, checklist_title),
    checklist_description  = COALESCE((p_checklist->>'checklist_description')::boolean, checklist_description),
    checklist_curriculum   = COALESCE((p_checklist->>'checklist_curriculum')::boolean, checklist_curriculum),
    checklist_video        = COALESCE((p_checklist->>'checklist_video')::boolean, checklist_video),
    checklist_audio        = COALESCE((p_checklist->>'checklist_audio')::boolean, checklist_audio),
    checklist_thumbnail    = COALESCE((p_checklist->>'checklist_thumbnail')::boolean, checklist_thumbnail),
    checklist_no_copyright = COALESCE((p_checklist->>'checklist_no_copyright')::boolean, checklist_no_copyright),
    notes                  = p_notes,
    reviewed_at            = NOW()
  WHERE id = v_review.id
  RETURNING * INTO v_review;

  UPDATE courses
  SET status = CASE WHEN p_status = 'approved' THEN 'published' ELSE 'draft' END
  WHERE id::text = v_review.course_id::text;

  INSERT INTO admin_audit_logs (action_type, target_type, target_id, previous_state, new_state, reason)
  VALUES (
    CASE WHEN p_status = 'approved' THEN 'approve' ELSE 'reject' END,
    'course', v_review.course_id::text, v_prev,
    jsonb_build_object('status', p_status, 'checklist', p_checklist, 'notes', p_notes),
    format('Course review processed. Status: %s. Notes: %s', p_status, COALESCE(p_notes, ''))
  );

  RETURN to_jsonb(v_review);
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


CREATE OR REPLACE FUNCTION admin_review_mentor(p_application_id TEXT, p_status TEXT, p_checklist JSONB, p_reason TEXT)
RETURNS JSONB AS $fn$
DECLARE
  v_app  mentor_applications%ROWTYPE;
  v_prev JSONB;
  v_meta JSONB;
  v_role TEXT;
BEGIN
  IF NOT has_admin_role('user_manager') THEN
    RAISE EXCEPTION 'Only user managers can review mentor applications.' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('approved', 'rejected', 'needs_info') THEN
    RAISE EXCEPTION 'Unknown mentor decision: %', p_status USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_app FROM mentor_applications WHERE id::text = p_application_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mentor application not found.' USING ERRCODE = 'P0002';
  END IF;
  v_prev := to_jsonb(v_app);

  SELECT COALESCE(metadata, '{}'::jsonb), role INTO v_meta, v_role
  FROM profiles WHERE id::text = v_app.user_id::text FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The applicant''s profile no longer exists.' USING ERRCODE = 'P0002';
  END IF;

  -- The application is updated first so the mentor-vetting trigger on
  -- profiles sees it as approved within this same transaction.
  UPDATE mentor_applications SET
    reviewed_by                    = auth.uid()::text,
    status                         = p_status,
    checklist_profile_completeness = COALESCE((p_checklist->>'checklist_profile_completeness')::boolean, checklist_profile_completeness),
    checklist_id_verification      = COALESCE((p_checklist->>'checklist_id_verification')::boolean, checklist_id_verification),
    checklist_qualifications       = COALESCE((p_checklist->>'checklist_qualifications')::boolean, checklist_qualifications),
    rejection_reason               = NULLIF(p_reason, ''),
    reviewed_at                    = NOW()
  WHERE id = v_app.id
  RETURNING * INTO v_app;

  IF p_status = 'approved' THEN
    v_meta := (v_meta - 'mentor_application_status' - 'pending_mentor_data') || jsonb_build_object(
      'mentor_application_status', 'approved',
      'mentor_onboarded', TRUE,
      'active_role', 'mentor',
      'mentor_onboarded_at', NOW(),
      'mentor_data', COALESCE(
        v_meta->'pending_mentor_data',
        jsonb_build_object('identity', jsonb_build_object('verified', TRUE), 'onboardedAt', NOW())
      )
    );
    v_role := 'mentor';
  ELSIF p_status = 'rejected' THEN
    v_meta := v_meta || jsonb_build_object(
      'mentor_application_status', 'rejected',
      'rejection_reason', COALESCE(NULLIF(p_reason, ''), 'Declined by administration.')
    );
  ELSE
    v_meta := v_meta || jsonb_build_object(
      'mentor_application_status', 'needs_info',
      'rejection_reason', COALESCE(NULLIF(p_reason, ''), 'More information requested.')
    );
  END IF;

  UPDATE profiles SET role = v_role, metadata = v_meta WHERE id::text = v_app.user_id::text;

  INSERT INTO admin_audit_logs (action_type, target_type, target_id, previous_state, new_state, reason)
  VALUES (
    CASE WHEN p_status = 'approved' THEN 'approve' ELSE 'reject' END,
    'user', v_app.user_id::text, v_prev,
    jsonb_build_object('status', p_status, 'checklist', p_checklist, 'rejectionReason', p_reason),
    format('Mentor onboarding review processed. Status: %s. Reason: %s', p_status, COALESCE(p_reason, ''))
  );

  RETURN jsonb_build_object('application', to_jsonb(v_app), 'role', v_role, 'metadata', v_meta);
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


CREATE OR REPLACE FUNCTION admin_review_author(p_application_id TEXT, p_status TEXT, p_reason TEXT)
RETURNS JSONB AS $fn$
DECLARE
  v_app       JSONB;
  v_db_status TEXT;
  v_meta      JSONB;
  v_role      TEXT;
  v_name      TEXT;
  v_user_id   TEXT;
BEGIN
  IF NOT has_admin_role('user_manager') THEN
    RAISE EXCEPTION 'Only user managers can review author applications.' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('approved', 'rejected', 'needs_info') THEN
    RAISE EXCEPTION 'Unknown author decision: %', p_status USING ERRCODE = '22023';
  END IF;

  -- Read through to_jsonb: pen_name and category are optional columns.
  SELECT to_jsonb(a) INTO v_app FROM author_applications a WHERE a.id::text = p_application_id FOR UPDATE;
  IF v_app IS NULL THEN
    RAISE EXCEPTION 'Author application not found.' USING ERRCODE = 'P0002';
  END IF;
  v_user_id := v_app->>'user_id';

  v_db_status := CASE p_status WHEN 'approved' THEN 'approved' WHEN 'needs_info' THEN 'needs_info' ELSE 'denied' END;

  UPDATE author_applications
  SET status = v_db_status, rejection_reason = NULLIF(p_reason, '')
  WHERE id::text = p_application_id;

  SELECT COALESCE(metadata, '{}'::jsonb), role, full_name INTO v_meta, v_role, v_name
  FROM profiles WHERE id::text = v_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The applicant''s profile no longer exists.' USING ERRCODE = 'P0002';
  END IF;

  IF v_db_status = 'approved' THEN
    v_meta := v_meta || jsonb_build_object(
      'is_author', TRUE,
      'author_profile', jsonb_build_object(
        'name', COALESCE(v_app->>'pen_name', v_name, 'Author'),
        'category', COALESCE(v_app->>'category', 'General'),
        'approvedAt', NOW()
      )
    );
    v_role := 'mentor';
  ELSIF v_db_status = 'needs_info' THEN
    v_meta := (v_meta - 'is_author' - 'author_profile') || jsonb_build_object(
      'author_application_status', 'needs_info',
      'rejection_reason', COALESCE(NULLIF(p_reason, ''), 'More information requested.')
    );
  ELSE
    v_meta := v_meta - 'is_author' - 'author_profile';
  END IF;

  UPDATE profiles SET role = v_role, metadata = v_meta WHERE id::text = v_user_id;

  INSERT INTO admin_audit_logs (action_type, target_type, target_id, previous_state, new_state, reason)
  VALUES (
    CASE WHEN v_db_status = 'approved' THEN 'approve' ELSE 'reject' END,
    'user', v_user_id, v_app,
    jsonb_build_object('status', v_db_status, 'rejectionReason', p_reason),
    format('Author application review processed. Status: %s. Reason: %s', v_db_status, COALESCE(p_reason, ''))
  );

  RETURN jsonb_build_object('status', v_db_status, 'user_id', v_user_id, 'role', v_role, 'metadata', v_meta);
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION admin_review_payout(TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_refund_transaction(TEXT, NUMERIC, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_review_course(TEXT, TEXT, JSONB, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_review_mentor(TEXT, TEXT, JSONB, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_review_author(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_review_payout(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_refund_transaction(TEXT, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_review_course(TEXT, TEXT, JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_review_mentor(TEXT, TEXT, JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_review_author(TEXT, TEXT, TEXT) TO authenticated;


-- --- 5. Institution provisioning and registration ----------------------------
-- tenants_write only admits super admins, so a customer who bought the
-- Institutional plan could not create the tenant they paid for, and self-serve
-- registration could not submit. Both now go through functions that decide
-- what the caller may create, instead of opening the table.

CREATE OR REPLACE FUNCTION tenant_settings_for_plan(p_plan TEXT) RETURNS JSONB AS $fn$
  SELECT jsonb_build_object(
    'allow_self_registration', TRUE,
    'default_user_role', 'mentee',
    'course_hierarchy', jsonb_build_array('Module', 'Topic', 'Subtopic'),
    'pricing_mode', 'custom',
    'custom_categories', jsonb_build_array('General', 'Specialized Studies', 'Certifications'),
    'max_users',   CASE p_plan WHEN 'enterprise' THEN 50000 WHEN 'growth' THEN 10000 ELSE 2000 END,
    'max_courses', CASE p_plan WHEN 'enterprise' THEN 1000  WHEN 'growth' THEN 250   ELSE 50   END
  );
$fn$ LANGUAGE sql IMMUTABLE;


-- Paid path. Requires the caller's own active Institutional subscription and
-- consumes it: a subscription provisions one tenant. Re-running with the same
-- subscription returns the tenant it already created, so a retry after a
-- network failure is safe.
CREATE OR REPLACE FUNCTION provision_institution(
  p_subscription_id TEXT,
  p_name            TEXT,
  p_subdomain       TEXT,
  p_email           TEXT,
  p_custom_domain   TEXT DEFAULT NULL
) RETURNS JSONB AS $fn$
DECLARE
  v_uid    TEXT := auth.uid()::text;
  v_sub    subscriptions%ROWTYPE;
  v_tenant tenants%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to provision an institution.' USING ERRCODE = '28000';
  END IF;
  IF COALESCE(TRIM(p_name), '') = '' OR COALESCE(TRIM(p_email), '') = '' THEN
    RAISE EXCEPTION 'Institution name and contact email are required.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_sub FROM subscriptions
  WHERE id = p_subscription_id
    AND user_id = v_uid
    AND tier = 'institutional'
    AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'An active Institutional subscription is required to provision an institution.' USING ERRCODE = '42501';
  END IF;

  IF v_sub.tenant_id IS NOT NULL AND v_sub.tenant_id <> 'default-tenant' THEN
    SELECT * INTO v_tenant FROM tenants WHERE id = v_sub.tenant_id;
    IF FOUND THEN
      RETURN to_jsonb(v_tenant);
    END IF;
  END IF;

  INSERT INTO tenants (name, subdomain, custom_domain, email, status, plan, settings)
  VALUES (
    TRIM(p_name), LOWER(TRIM(p_subdomain)), NULLIF(TRIM(COALESCE(p_custom_domain, '')), ''),
    TRIM(p_email), 'active', 'enterprise', tenant_settings_for_plan('enterprise')
  )
  RETURNING * INTO v_tenant;

  UPDATE subscriptions SET tenant_id = v_tenant.id, updated_at = NOW() WHERE id = v_sub.id;

  RETURN to_jsonb(v_tenant);
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION provision_institution(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION provision_institution(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;


-- Unpaid path. Always 'pending': a super admin approves it from the tenants
-- console. Open to signed-out visitors because the registration page is.
CREATE OR REPLACE FUNCTION register_institution(
  p_name          TEXT,
  p_subdomain     TEXT,
  p_email         TEXT,
  p_plan          TEXT,
  p_primary_color TEXT DEFAULT NULL,
  p_custom_domain TEXT DEFAULT NULL
) RETURNS JSONB AS $fn$
DECLARE
  v_tenant tenants%ROWTYPE;
  v_plan   TEXT := COALESCE(p_plan, 'starter');
BEGIN
  IF COALESCE(TRIM(p_name), '') = '' OR COALESCE(TRIM(p_email), '') = '' THEN
    RAISE EXCEPTION 'Institution name and contact email are required.' USING ERRCODE = '22023';
  END IF;
  IF v_plan NOT IN ('starter', 'growth', 'enterprise') THEN
    RAISE EXCEPTION 'Unknown plan: %', v_plan USING ERRCODE = '22023';
  END IF;
  IF p_primary_color IS NOT NULL AND p_primary_color !~ '^#[0-9A-Fa-f]{6}$' THEN
    RAISE EXCEPTION 'Brand colour must be a hex value like #4f46e5.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO tenants (name, subdomain, custom_domain, email, status, plan, primary_color, settings)
  VALUES (
    TRIM(p_name), LOWER(TRIM(p_subdomain)), NULLIF(TRIM(COALESCE(p_custom_domain, '')), ''),
    TRIM(p_email), 'pending', v_plan, COALESCE(p_primary_color, '#4f46e5'), tenant_settings_for_plan(v_plan)
  )
  RETURNING * INTO v_tenant;

  RETURN jsonb_build_object('id', v_tenant.id, 'subdomain', v_tenant.subdomain, 'status', v_tenant.status);
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION register_institution(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION register_institution(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;


-- Pending and suspended tenants are hidden from the public by RLS, so a plain
-- read reported their addresses as free. Answers yes/no and nothing else.
CREATE OR REPLACE FUNCTION subdomain_is_taken(p_subdomain TEXT) RETURNS BOOLEAN AS $fn$
  SELECT EXISTS (SELECT 1 FROM tenants WHERE LOWER(subdomain) = LOWER(TRIM(p_subdomain)));
$fn$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION subdomain_is_taken(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION subdomain_is_taken(TEXT) TO anon, authenticated;


-- --- 6. Profile privacy ------------------------------------------------------
-- profiles.metadata carries identity documents, addresses, phone numbers and
-- suspension reasons, and email sits beside it. Until now every row was
-- readable by anyone holding the anon key.
--
-- Public display (feed authors, catalog cards, contact lists) reads the
-- public_profiles view. The table itself is readable by the owner, platform
-- admins, and people with a real relationship to the person.

CREATE OR REPLACE VIEW public_profiles AS
  SELECT id, full_name, username, avatar_url, bio, role, mentor_tier, country, tenant_id, created_at
  FROM profiles;

GRANT SELECT ON public_profiles TO anon, authenticated;

-- Built dynamically because enrollments records its course as item_id on some
-- deployments and course_id on others.
DO $viewer$
DECLARE
  v_course_col TEXT;
  v_enrollment_clause TEXT := 'FALSE';
BEGIN
  SELECT column_name INTO v_course_col
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'enrollments'
    AND column_name IN ('item_id', 'course_id')
  ORDER BY CASE column_name WHEN 'item_id' THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_course_col IS NOT NULL THEN
    v_enrollment_clause := format(
      'EXISTS (SELECT 1 FROM enrollments e JOIN courses c ON c.id::text = e.%I::text
               WHERE e.user_id::text = target_id AND c.tutor_id::text = auth.uid()::text)',
      v_course_col
    );
  END IF;

  EXECUTE format($create$
    CREATE OR REPLACE FUNCTION can_view_private_profile(target_id TEXT, target_tenant TEXT, target_metadata JSONB)
    RETURNS BOOLEAN AS $body$
      SELECT
        -- Mentor and mentee, either direction.
        COALESCE(target_metadata->>'assigned_mentor_id', '') = auth.uid()::text
        OR EXISTS (
          SELECT 1 FROM profiles me
          WHERE me.id::text = auth.uid()::text AND me.metadata->>'assigned_mentor_id' = target_id
        )
        -- Guardian and student, either direction.
        OR is_guardian_of(target_id)
        OR EXISTS (
          SELECT 1 FROM guardian_links g
          WHERE g.guardian_id::text = target_id AND g.student_id::text = auth.uid()::text AND g.status = 'active'
        )
        -- A teacher and the people on their class rosters.
        OR EXISTS (
          SELECT 1 FROM class_members m
          WHERE m.user_id::text = target_id AND m.left_at IS NULL AND teaches_class(m.class_id)
        )
        -- A tutor and the learners enrolled in their courses.
        OR %s
        -- Staff inside the same institution. Never the shared default tenant,
        -- which every marketplace user belongs to.
        OR (
          target_tenant IS NOT NULL AND target_tenant <> 'default-tenant'
          AND EXISTS (
            SELECT 1 FROM profiles me
            WHERE me.id::text = auth.uid()::text
              AND me.tenant_id = target_tenant
              AND me.role IN ('management', 'staff', 'tenant_admin', 'mentor', 'tutor')
          )
        );
    $body$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;
  $create$, v_enrollment_clause);
END
$viewer$;

DROP POLICY IF EXISTS profiles_select ON profiles;
CREATE POLICY profiles_select ON profiles
  FOR SELECT USING (
    auth.uid()::text = id::text
    OR is_platform_admin()
    OR can_view_private_profile(id::text, tenant_id, metadata)
  );

-- The sign-in form shows the account's avatar once an email is typed. That is
-- the only thing a signed-out visitor may learn from an email address.
CREATE OR REPLACE FUNCTION get_sign_in_avatar(p_email TEXT) RETURNS TEXT AS $fn$
  SELECT avatar_url FROM profiles
  WHERE LOWER(email) = LOWER(TRIM(p_email))
  LIMIT 1;
$fn$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION get_sign_in_avatar(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_sign_in_avatar(TEXT) TO anon, authenticated;

-- Messaging lets a signed-in user start a chat by typing someone's exact email.
-- Returns public fields only, and never the email itself.
CREATE OR REPLACE FUNCTION find_user_by_email(p_email TEXT) RETURNS SETOF public_profiles AS $fn$
  SELECT pp.*
  FROM public_profiles pp
  JOIN profiles p ON p.id = pp.id
  WHERE auth.uid() IS NOT NULL
    AND LOWER(p.email) = LOWER(TRIM(p_email))
    AND p.id::text <> auth.uid()::text
  LIMIT 1;
$fn$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION find_user_by_email(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION find_user_by_email(TEXT) TO authenticated;


-- =============================================================================
-- NOTES
-- =============================================================================
--
-- 1. provision_institution trusts the subscriptions table. Subscriptions are
--    still written by the client after the Paystack popup, so this gate is
--    only as strong as that record until activation moves to the verified
--    webhook.
--
-- 2. admin_audit_log (singular) is no longer written by the app. After
--    checking the copied rows (legacy_source_id IS NOT NULL), drop it:
--      DROP TABLE admin_audit_log;
--
-- 3. Existing admin_users rows with status 'pending' or 'rejected' stay as
--    they are. Review them in the Super Admin console.
--
-- =============================================================================
