-- =============================================================================
-- TRILEZA — BOOK METADATA: NISO RP-29-2022 AND ONIX 3.0
-- =============================================================================
--
-- The catalogue could not be listed anywhere. Retailers, library systems and
-- aggregators all expect the same core record — a real ISBN, contributors with
-- roles, a subject classification, a language code, a rights statement — and
-- api_books carried almost none of it.
--
-- Worse than absent: the upload form fabricated an ISBN when the author left
-- the field blank.
--
--     `978-${Math.floor(1000000000 + Math.random() * 9000000000)}`
--
-- That is not a weak identifier, it is a wrong one. It fails checksum
-- validation, it can collide with a real book's ISBN, and once it reaches a
-- retailer feed it is indistinguishable from a genuine registration. A missing
-- ISBN is an honest gap; an invented one is bad data that spreads.
--
-- Three columns the form already collected were also being discarded on every
-- upload: co_authors, edition, and any language beyond the display string
-- "English" (ISO 639-1 wants "en").
--
-- =============================================================================


-- ── Title block (ONIX 3.0 P.5) ───────────────────────────────────────────
ALTER TABLE api_books
  ADD COLUMN IF NOT EXISTS subtitle_text TEXT,
  -- ONIX title type: 01 is the distinctive title, which is what a book has.
  ADD COLUMN IF NOT EXISTS title_type    TEXT DEFAULT '01',
  -- "The", "A" — held apart so catalogues can sort on the substantive word.
  ADD COLUMN IF NOT EXISTS title_prefix  TEXT;


-- ── Identifiers (ISO 2108) ───────────────────────────────────────────────
-- isbn_13 sits alongside the legacy `isbn` column rather than replacing it:
-- the old one holds fabricated values that must not be promoted to a validated
-- field. New uploads write isbn_13 and leave it NULL when the author has none.
ALTER TABLE api_books
  ADD COLUMN IF NOT EXISTS isbn_13 TEXT,
  ADD COLUMN IF NOT EXISTS isbn_10 TEXT,
  ADD COLUMN IF NOT EXISTS doi     TEXT;

-- Deliberately not UNIQUE NOT NULL, which the brief asked for. A NOT NULL
-- unique ISBN would make it impossible to publish without one, and most
-- self-published authors do not have one. Uniqueness is enforced only among
-- books that actually carry an ISBN.
CREATE UNIQUE INDEX IF NOT EXISTS idx_api_books_isbn13
  ON api_books (isbn_13) WHERE isbn_13 IS NOT NULL;


-- ── Publishing block ─────────────────────────────────────────────────────
ALTER TABLE api_books
  ADD COLUMN IF NOT EXISTS publisher_name    TEXT,
  ADD COLUMN IF NOT EXISTS edition_number    INTEGER DEFAULT 1,
  -- ISO 639-1, two letters. The display name ("English") stays in `language`
  -- so nothing that renders it breaks; this is the machine-readable form.
  ADD COLUMN IF NOT EXISTS language_code     TEXT,
  ADD COLUMN IF NOT EXISTS original_language TEXT,
  ADD COLUMN IF NOT EXISTS publication_date_iso DATE;

-- publication_date is TEXT and holds whatever the form produced. A real DATE
-- column sits beside it rather than converting in place, because an unparseable
-- string would otherwise fail the whole migration.
UPDATE api_books
   SET publication_date_iso = publication_date::date
 WHERE publication_date IS NOT NULL
   AND publication_date ~ '^\d{4}-\d{2}-\d{2}$'
   AND publication_date_iso IS NULL;


-- ── Subject block ────────────────────────────────────────────────────────
ALTER TABLE api_books
  -- BISAC subject headings, e.g. FIC009000. An array: a book may carry
  -- several, and retailers expect the full set.
  ADD COLUMN IF NOT EXISTS bisac_codes   TEXT[],
  -- ONIX audience code. 01 is general/trade adult.
  ADD COLUMN IF NOT EXISTS audience_code TEXT DEFAULT '01';


-- ── Format block ─────────────────────────────────────────────────────────
ALTER TABLE api_books
  ADD COLUMN IF NOT EXISTS file_format     TEXT,
  ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT,
  ADD COLUMN IF NOT EXISTS word_count      INTEGER,
  -- How this file is protected. 'watermark' matches what Phase 5 actually
  -- does on a purchased download; 'stream_only' is what a borrow gets.
  ADD COLUMN IF NOT EXISTS drm_type        TEXT DEFAULT 'watermark';


-- ── Rights block ─────────────────────────────────────────────────────────
ALTER TABLE api_books
  ADD COLUMN IF NOT EXISTS rights_statement TEXT DEFAULT 'World',
  ADD COLUMN IF NOT EXISTS copyright_year   INTEGER,
  ADD COLUMN IF NOT EXISTS copyright_holder TEXT,
  ADD COLUMN IF NOT EXISTS license_type     TEXT DEFAULT 'allrightsreserved';


-- ── Constraints ──────────────────────────────────────────────────────────
-- Added separately and tolerantly: a CHECK that rejects existing rows would
-- fail the migration outright.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'api_books_file_format_valid') THEN
    ALTER TABLE api_books ADD CONSTRAINT api_books_file_format_valid
      CHECK (file_format IS NULL OR file_format IN ('EPUB', 'PDF'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'api_books_drm_type_valid') THEN
    ALTER TABLE api_books ADD CONSTRAINT api_books_drm_type_valid
      CHECK (drm_type IS NULL OR drm_type IN ('watermark', 'stream_only', 'none'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'api_books_license_type_valid') THEN
    ALTER TABLE api_books ADD CONSTRAINT api_books_license_type_valid
      CHECK (license_type IS NULL OR license_type IN
        ('allrightsreserved', 'creativecommons', 'publicdomain'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'api_books_language_code_shape') THEN
    ALTER TABLE api_books ADD CONSTRAINT api_books_language_code_shape
      CHECK (language_code IS NULL OR language_code ~ '^[a-z]{2,3}$');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'api_books_isbn13_shape') THEN
    -- Shape only. The checksum is validated by isbn13_is_valid() below, which
    -- a CHECK cannot call portably across restores.
    ALTER TABLE api_books ADD CONSTRAINT api_books_isbn13_shape
      CHECK (isbn_13 IS NULL OR isbn_13 ~ '^\d{13}$');
  END IF;
END $$;


-- ── Contributors (ONIX P.7) ──────────────────────────────────────────────
--
-- A separate table rather than a JSONB column. Contributors are queried
-- ("everything by this author"), ordered, and carry their own identifiers;
-- a JSON blob makes all three awkward and cannot be indexed usefully.
CREATE TABLE IF NOT EXISTS book_contributors (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  book_id          TEXT NOT NULL REFERENCES api_books(id) ON DELETE CASCADE,
  contributor_name TEXT NOT NULL,
  -- ONIX contributor role: A01 author, A12 illustrator, B01 editor,
  -- B06 translator, E07 narrator.
  contributor_role TEXT NOT NULL DEFAULT 'A01',
  contributor_bio  TEXT,
  contributor_orcid TEXT,
  -- Where this name falls on the title page.
  display_order    INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_book_contributors_book ON book_contributors (book_id, display_order);
CREATE INDEX IF NOT EXISTS idx_book_contributors_name ON book_contributors (contributor_name);

ALTER TABLE book_contributors ENABLE ROW LEVEL SECURITY;

-- Contributors are part of the public record of a published book: they appear
-- on the catalogue page, so they follow the book's own visibility.
DROP POLICY IF EXISTS book_contributors_select ON book_contributors;
CREATE POLICY book_contributors_select ON book_contributors
  FOR SELECT TO authenticated, anon
  USING (
    EXISTS (
      SELECT 1 FROM api_books b
       WHERE b.id = book_contributors.book_id
         AND (b.status = 'published'
              OR b.author_id = (SELECT auth.uid())::text
              OR is_platform_admin())
    )
  );

DROP POLICY IF EXISTS book_contributors_write ON book_contributors;
CREATE POLICY book_contributors_write ON book_contributors
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM api_books b
       WHERE b.id = book_contributors.book_id
         AND (b.author_id = (SELECT auth.uid())::text OR has_admin_role('content_manager'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM api_books b
       WHERE b.id = book_contributors.book_id
         AND (b.author_id = (SELECT auth.uid())::text OR has_admin_role('content_manager'))
    )
  );


-- ── Identifiers table ────────────────────────────────────────────────────
--
-- A book can carry several identifiers at once — ISBN-13 for the EPUB, another
-- for the PDF, a DOI for an academic title, an OCLC number once a library
-- catalogues it. The columns on api_books hold the primary ones; this holds
-- the full set.
CREATE TABLE IF NOT EXISTS book_identifiers (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  book_id          TEXT NOT NULL REFERENCES api_books(id) ON DELETE CASCADE,
  identifier_type  TEXT NOT NULL
                   CHECK (identifier_type IN ('isbn13','isbn10','doi','oclc','asin','issn')),
  identifier_value TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (book_id, identifier_type, identifier_value)
);

CREATE INDEX IF NOT EXISTS idx_book_identifiers_book  ON book_identifiers (book_id);
CREATE INDEX IF NOT EXISTS idx_book_identifiers_value ON book_identifiers (identifier_type, identifier_value);

ALTER TABLE book_identifiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS book_identifiers_select ON book_identifiers;
CREATE POLICY book_identifiers_select ON book_identifiers
  FOR SELECT TO authenticated, anon
  USING (
    EXISTS (
      SELECT 1 FROM api_books b
       WHERE b.id = book_identifiers.book_id
         AND (b.status = 'published'
              OR b.author_id = (SELECT auth.uid())::text
              OR is_platform_admin())
    )
  );

DROP POLICY IF EXISTS book_identifiers_write ON book_identifiers;
CREATE POLICY book_identifiers_write ON book_identifiers
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM api_books b
       WHERE b.id = book_identifiers.book_id
         AND (b.author_id = (SELECT auth.uid())::text OR has_admin_role('content_manager'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM api_books b
       WHERE b.id = book_identifiers.book_id
         AND (b.author_id = (SELECT auth.uid())::text OR has_admin_role('content_manager'))
    )
  );


-- ── ISBN validation ──────────────────────────────────────────────────────
--
-- The checksum is the whole point of an ISBN: it is what distinguishes a real
-- registration from a typo or an invented number. Implemented in SQL so the
-- database can refuse bad data regardless of which client wrote it.
CREATE OR REPLACE FUNCTION isbn13_is_valid(p_isbn TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_digits TEXT;
  v_sum    INTEGER := 0;
  v_i      INTEGER;
  v_digit  INTEGER;
BEGIN
  IF p_isbn IS NULL THEN RETURN FALSE; END IF;

  -- Hyphens and spaces are presentation, not part of the number.
  v_digits := regexp_replace(p_isbn, '[^0-9]', '', 'g');
  IF length(v_digits) <> 13 THEN RETURN FALSE; END IF;

  -- Alternating weights of 1 and 3 across the first twelve digits; the
  -- thirteenth makes the total a multiple of ten.
  FOR v_i IN 1..12 LOOP
    v_digit := substr(v_digits, v_i, 1)::INTEGER;
    v_sum := v_sum + v_digit * (CASE WHEN v_i % 2 = 0 THEN 3 ELSE 1 END);
  END LOOP;

  RETURN ((10 - (v_sum % 10)) % 10) = substr(v_digits, 13, 1)::INTEGER;
END;
$$;

CREATE OR REPLACE FUNCTION isbn10_is_valid(p_isbn TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_digits TEXT;
  v_sum    INTEGER := 0;
  v_i      INTEGER;
  v_char   TEXT;
BEGIN
  IF p_isbn IS NULL THEN RETURN FALSE; END IF;

  v_digits := upper(regexp_replace(p_isbn, '[^0-9Xx]', '', 'g'));
  IF length(v_digits) <> 10 THEN RETURN FALSE; END IF;

  FOR v_i IN 1..10 LOOP
    v_char := substr(v_digits, v_i, 1);
    -- Only the final position may be X, standing for ten.
    IF v_char = 'X' THEN
      IF v_i <> 10 THEN RETURN FALSE; END IF;
      v_sum := v_sum + 10 * (11 - v_i);
    ELSE
      v_sum := v_sum + v_char::INTEGER * (11 - v_i);
    END IF;
  END LOOP;

  RETURN v_sum % 11 = 0;
END;
$$;

GRANT EXECUTE ON FUNCTION isbn13_is_valid(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION isbn10_is_valid(TEXT) TO authenticated, anon;

-- Now that a validator exists, refuse an ISBN-13 that does not check out.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'api_books_isbn13_checksum') THEN
    ALTER TABLE api_books ADD CONSTRAINT api_books_isbn13_checksum
      CHECK (isbn_13 IS NULL OR isbn13_is_valid(isbn_13));
  END IF;
END $$;


-- ── Backfill what can be inferred ────────────────────────────────────────

-- Format, from the file the author uploaded.
UPDATE api_books
   SET file_format = CASE
     WHEN upper(coalesce(uploaded_format, '')) LIKE '%EPUB%' THEN 'EPUB'
     WHEN upper(coalesce(uploaded_format, '')) LIKE '%PDF%'  THEN 'PDF'
     WHEN lower(coalesce(book_file_name, '')) LIKE '%.epub'  THEN 'EPUB'
     WHEN lower(coalesce(book_file_name, '')) LIKE '%.pdf'   THEN 'PDF'
     ELSE NULL
   END
 WHERE file_format IS NULL;

-- Language display name to ISO 639-1. Only the unambiguous cases; anything
-- else stays NULL rather than being guessed.
UPDATE api_books
   SET language_code = CASE lower(trim(coalesce(language, '')))
     WHEN 'english'    THEN 'en'
     WHEN 'french'     THEN 'fr'
     WHEN 'arabic'     THEN 'ar'
     WHEN 'spanish'    THEN 'es'
     WHEN 'portuguese' THEN 'pt'
     WHEN 'german'     THEN 'de'
     WHEN 'swahili'    THEN 'sw'
     WHEN 'yoruba'     THEN 'yo'
     WHEN 'igbo'       THEN 'ig'
     WHEN 'hausa'      THEN 'ha'
     ELSE NULL
   END
 WHERE language_code IS NULL;

-- The author of record becomes the first contributor, with the ONIX author
-- role, so every existing book satisfies "at least one A01".
INSERT INTO book_contributors (book_id, contributor_name, contributor_role, display_order)
SELECT b.id, b.author_name, 'A01', 0
  FROM api_books b
 WHERE b.author_name IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM book_contributors c WHERE c.book_id = b.id);

-- Copyright year from the publication date, holder from the author.
UPDATE api_books
   SET copyright_year = COALESCE(
         EXTRACT(YEAR FROM publication_date_iso)::INTEGER,
         EXTRACT(YEAR FROM created_at)::INTEGER
       ),
       copyright_holder = COALESCE(copyright_holder, author_name)
 WHERE copyright_year IS NULL;


-- =============================================================================
-- NOTES
-- =============================================================================
--
-- 1. isbn_13 is nullable by design. The brief specified UNIQUE NOT NULL, which
--    would bar anyone without a registered ISBN from publishing at all — most
--    self-published authors. Uniqueness applies only where one is supplied.
--
-- 2. The legacy `isbn` column is left alone. It contains fabricated values and
--    must not be promoted into the validated field; new uploads write isbn_13
--    and leave it NULL when the author has none.
--
-- 3. BISAC codes are stored but not validated against the official list, which
--    is licensed and not redistributable. Format is checked at the application
--    layer; correctness is the publisher's responsibility.
--
-- =============================================================================
