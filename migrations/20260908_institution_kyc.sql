-- =============================================================================
-- TRILEZA — INSTITUTIONAL KYC / KYB
-- =============================================================================
--
-- Know-Your-Business record for institutions onboarding from any jurisdiction.
--
-- Structure follows the eight areas a reviewer works through in order, and each
-- is a JSONB column rather than eighty flat ones. Three reasons:
--
--   1. The fields differ by jurisdiction — a US institution has an EIN, an EU
--      one a VAT number, a Nigerian one a CAC number. Flattening every variant
--      produces a table that is mostly NULL.
--   2. Sections are read and saved as a unit, which is also how the form is
--      stepped, so partial progress maps cleanly onto a single column.
--   3. Requirements change with regulation. Adding a field to a JSONB section
--      does not need a migration and a deploy.
--
-- Anything a reviewer filters or sorts on is promoted to a real column.
--
-- =============================================================================

CREATE TABLE IF NOT EXISTS institution_kyc (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id   TEXT REFERENCES tenants(id) ON DELETE CASCADE,
  -- Set before a tenant exists: KYC is submitted during signup, and the tenant
  -- is only provisioned once payment clears and review passes.
  submitted_by TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- ── Promoted for the review queue ───────────────────────────────────────
  legal_name              TEXT NOT NULL,
  legal_entity_type       TEXT CHECK (legal_entity_type IN (
                            'university', 'college', 'training_center',
                            'corporate_training', 'non_profit',
                            'government_agency', 'other')),
  country_of_incorporation TEXT,
  registration_number     TEXT,
  tax_identification_number TEXT,
  tax_residence_country   TEXT,

  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft',            -- applicant still filling it in
    'submitted',        -- awaiting review
    'in_review',
    'info_requested',   -- reviewer needs something more
    'approved',
    'rejected'
  )),

  -- Set by the reviewer, not the applicant.
  risk_rating TEXT CHECK (risk_rating IN ('low', 'medium', 'high')),

  -- ── The eight sections ──────────────────────────────────────────────────
  entity_registration   JSONB NOT NULL DEFAULT '{}'::jsonb,
  address_contact       JSONB NOT NULL DEFAULT '{}'::jsonb,
  tax_financial         JSONB NOT NULL DEFAULT '{}'::jsonb,
  authorized_rep        JSONB NOT NULL DEFAULT '{}'::jsonb,
  institutional_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  compliance            JSONB NOT NULL DEFAULT '{}'::jsonb,
  risk_onboarding       JSONB NOT NULL DEFAULT '{}'::jsonb,
  consents              JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Uploaded evidence: [{ kind, name, path, type, size, uploaded_at }].
  -- Paths point at the private `institution-kyc` bucket. They are keys, not
  -- URLs: reviewers fetch the bytes with their own session and view them from a
  -- blob URL, so nothing shareable is ever produced. Never make that bucket
  -- public — it holds passports, bank letters and incorporation certificates.
  documents JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- ── Review trail ────────────────────────────────────────────────────────
  reviewed_by      TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  review_notes     TEXT,
  info_requested   TEXT,
  submitted_at     TIMESTAMPTZ,
  reviewed_at      TIMESTAMPTZ,
  -- KYC goes stale. Regulated onboarding is normally re-verified periodically.
  expires_at       TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_institution_kyc_status
  ON institution_kyc (status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_institution_kyc_tenant
  ON institution_kyc (tenant_id);
CREATE INDEX IF NOT EXISTS idx_institution_kyc_submitter
  ON institution_kyc (submitted_by);

-- One open submission per person. Without this a double-submit queues two
-- near-identical records for the compliance team to reconcile.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_open_institution_kyc
  ON institution_kyc (submitted_by)
  WHERE status IN ('draft', 'submitted', 'in_review', 'info_requested');


-- --- Row level security ------------------------------------------------------
-- This table holds passports, bank details and incorporation papers. Access is
-- the applicant themselves, and compliance staff. Nobody else, including other
-- admin roles.

ALTER TABLE institution_kyc ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS institution_kyc_select ON institution_kyc;
DROP POLICY IF EXISTS institution_kyc_insert ON institution_kyc;
DROP POLICY IF EXISTS institution_kyc_update ON institution_kyc;

CREATE POLICY institution_kyc_select ON institution_kyc
  FOR SELECT USING (
    submitted_by::text = auth.uid()::text
    OR has_admin_role('compliance_officer')
    OR has_admin_role('super_admin')
  );

CREATE POLICY institution_kyc_insert ON institution_kyc
  FOR INSERT WITH CHECK (submitted_by::text = auth.uid()::text);

-- An applicant may edit their own record only while it is still open. Once
-- submitted for review, only compliance may change it — otherwise details
-- could be altered after a reviewer has checked them.
CREATE POLICY institution_kyc_update ON institution_kyc
  FOR UPDATE USING (
    (submitted_by::text = auth.uid()::text AND status IN ('draft', 'info_requested'))
    OR has_admin_role('compliance_officer')
    OR has_admin_role('super_admin')
  );


-- =============================================================================
-- NOTES
-- =============================================================================
--
-- 1. Create a PRIVATE storage bucket named `institution-kyc` before enabling
--    the form. It receives certificates of incorporation, accreditation proof,
--    tax certificates, bank confirmation letters, government IDs and passport
--    photos. A public bucket here would be a serious data breach.
--
--    Its access rules need to mirror the policies above: an applicant may write
--    under their own user-id prefix, and only compliance_officer/super_admin may
--    read. The SDK has no signed-URL support, so reviewers download with their
--    own session — if the bucket lets any signed-in user read, every mentor on
--    the platform can read every institution's passports.
--
-- 2. `expires_at` exists so re-verification can be scheduled, but nothing sets
--    it yet. Decide a period (24 months is common) and populate it on approval.
--
-- 3. Sanctions and PEP screening are not modelled here. If Trileza takes
--    institutional money across borders, that check belongs in the review flow
--    and its result should be recorded against `risk_rating`.
--
-- =============================================================================
