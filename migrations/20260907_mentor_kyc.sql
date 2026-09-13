-- =============================================================================
-- TRILEZA — MENTOR APPLICATION KYC
-- =============================================================================
--
-- Two changes to what a mentor application carries.
--
-- 1. The intro video is dropped. It was never collected — the onboarding form
--    wrote `video_url: null` on every submission — so `checklist_intro_video`
--    was a review step nobody could ever complete.
--
-- 2. Identity documents are stored properly. The upload control existed but
--    only kept a filename in React state; nothing reached storage or the
--    database, which left `checklist_id_verification` equally unverifiable.
--
-- Safe to run before or after the other pending migrations.
--
-- =============================================================================


-- --- 1. Identity document ----------------------------------------------------

ALTER TABLE mentor_applications
  ADD COLUMN IF NOT EXISTS id_document_url  TEXT,
  ADD COLUMN IF NOT EXISTS id_document_type TEXT,
  ADD COLUMN IF NOT EXISTS id_document_name TEXT,
  ADD COLUMN IF NOT EXISTS phone_number     TEXT;

COMMENT ON COLUMN mentor_applications.id_document_url IS
  'Storage path of the government ID or institutional badge. Reviewed against checklist_id_verification.';


-- --- 2. Retire the intro video ----------------------------------------------
-- Dropped rather than left nullable: a column the product no longer collects
-- is a trap for the next person reading the review checklist.

ALTER TABLE mentor_applications
  DROP COLUMN IF EXISTS checklist_intro_video,
  DROP COLUMN IF EXISTS video_url;


-- --- 3. Applications awaiting an ID ------------------------------------------
-- Lets the User Manager sort the queue by whether there is anything to verify.

CREATE INDEX IF NOT EXISTS idx_mentor_applications_awaiting_id
  ON mentor_applications (status)
  WHERE id_document_url IS NULL;


-- =============================================================================
-- NOTE
-- =============================================================================
--
-- The identity document is uploaded to the `mentor-kyc` storage bucket, which
-- must exist and must NOT be public — these are passports and national IDs.
-- Create it as a private bucket before enabling ID upload in production, and
-- serve the file to reviewers through a signed URL rather than a public link.
--
-- =============================================================================
