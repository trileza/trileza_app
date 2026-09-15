-- =============================================================================
-- TRILEZA — STORAGE ROW-LEVEL SECURITY
-- =============================================================================
--
-- Every upload in the app was failing with a permission error.
--
-- InsForge governs storage.objects with RLS, and a fresh project ships with
-- ZERO policies on that table. RLS is enabled, nothing matches, so no end user
-- can read or write any file — avatars, course thumbnails, session covers,
-- chat attachments, KYC documents, all of it.
--
-- The symptom was misleading: the API reported
--
--     Bucket "session-thumbnails" does not exist
--
-- for a bucket that demonstrably existed. The real cause was that the caller
-- had no permission to write to it, and the bucket was reported as missing
-- rather than forbidden.
--
-- Buckets fall into two groups:
--
--   Public-read  — uploads, session-thumbnails, course-materials-*
--                  Anyone may read (these are rendered in the UI, often to
--                  signed-out visitors). Only the uploader may modify.
--
--   Private      — chat-attachments, institution-kyc
--                  Only the uploader, plus the admin roles that must review
--                  the contents.
--
-- Writes are owner-scoped everywhere: a signed-in user may upload, and may
-- only change or delete what they uploaded themselves.
--
-- =============================================================================


ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Clean slate, so this migration is re-runnable.
DROP POLICY IF EXISTS storage_objects_owner_select  ON storage.objects;
DROP POLICY IF EXISTS storage_objects_owner_insert  ON storage.objects;
DROP POLICY IF EXISTS storage_objects_owner_update  ON storage.objects;
DROP POLICY IF EXISTS storage_objects_owner_delete  ON storage.objects;
DROP POLICY IF EXISTS storage_objects_public_read   ON storage.objects;
DROP POLICY IF EXISTS storage_objects_private_read  ON storage.objects;


-- --- Reads --------------------------------------------------------------

-- Public buckets: readable by anyone, signed in or not. The course catalog,
-- community feed and live-session cards are all visible to signed-out
-- visitors, so anonymous read is required, not merely convenient.
CREATE POLICY storage_objects_public_read ON storage.objects
  FOR SELECT TO authenticated, anon
  USING (bucket IN ('uploads', 'session-thumbnails', 'course-materials-trileza-784bc328'));

-- Private buckets: the uploader, and the admin role responsible for the
-- content. Compliance officers review KYC documents; support agents see
-- attachments raised on tickets.
CREATE POLICY storage_objects_private_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket IN ('chat-attachments', 'institution-kyc')
    AND (
      uploaded_by = (SELECT auth.jwt() ->> 'sub')
      OR (bucket = 'institution-kyc'  AND has_admin_role('compliance_officer'))
      OR (bucket = 'chat-attachments' AND has_admin_role('support_agent'))
    )
  );


-- --- Writes -------------------------------------------------------------
-- Owner-scoped across every bucket. A signed-in user may upload, and may only
-- modify or remove their own files.

CREATE POLICY storage_objects_owner_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = (SELECT auth.jwt() ->> 'sub'));

CREATE POLICY storage_objects_owner_update ON storage.objects
  FOR UPDATE TO authenticated
  USING      (uploaded_by = (SELECT auth.jwt() ->> 'sub'))
  WITH CHECK (uploaded_by = (SELECT auth.jwt() ->> 'sub'));

CREATE POLICY storage_objects_owner_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (uploaded_by = (SELECT auth.jwt() ->> 'sub'));


-- --- Grants -------------------------------------------------------------
-- RLS decides which rows; these decide whether the role may touch the table
-- at all. Both are required.
--
-- Only `authenticated` is granted here. A GRANT to `anon` on this schema is
-- accepted and then silently reverted by the platform, and it is not needed:
-- anonymous reads of a public bucket never reach storage.objects. Requesting
-- /api/storage/buckets/<bucket>/objects/<key> without a token returns a 302 to
-- a signed CDN URL, so an <img> tag on a signed-out page resolves normally.
-- A private bucket returns 401 on that same route. Verified on the live
-- project against both.

GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO authenticated;


-- =============================================================================
-- NOTES
-- =============================================================================
--
-- 1. Adding a bucket means adding it to one of the two read policies above.
--    A bucket in neither is readable by nobody, and the API will report it as
--    non-existent rather than forbidden — which is exactly the false trail
--    this migration exists to fix.
--
-- 2. scripts/setup-buckets.cjs creates the buckets themselves; buckets are not
--    part of the SQL schema. Run both against a new project.
--
-- =============================================================================
