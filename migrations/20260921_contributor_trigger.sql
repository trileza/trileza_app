-- =============================================================================
-- TRILEZA — KEEP THE AUTHOR OF RECORD AS A CONTRIBUTOR
-- =============================================================================
--
-- 20260920 backfilled book_contributors from api_books.author_name, but only
-- for rows that existed at the time. A book uploaded afterwards had no
-- contributor row at all, so "every book has at least one contributor with
-- role A01" — the ONIX requirement, and part of the Phase 8 checklist — held
-- only until the next upload.
--
-- Doing this in a trigger rather than in the upload code means it holds for
-- every writer: the author dashboard, the store manager, an admin correction,
-- or a future import script. None of them can forget.
--
-- =============================================================================

CREATE OR REPLACE FUNCTION ensure_primary_contributor()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Nothing to record if the book carries no author name.
  IF NEW.author_name IS NULL OR trim(NEW.author_name) = '' THEN
    RETURN NEW;
  END IF;

  -- Only when the book has no contributors yet. An author who has since added
  -- co-authors, an editor or a translator has a deliberate list, and this must
  -- not push itself back into it.
  IF EXISTS (SELECT 1 FROM book_contributors WHERE book_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  INSERT INTO book_contributors (book_id, contributor_name, contributor_role, display_order)
  VALUES (NEW.id, trim(NEW.author_name), 'A01', 0);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_primary_contributor ON api_books;

CREATE TRIGGER trg_ensure_primary_contributor
  AFTER INSERT ON api_books
  FOR EACH ROW
  EXECUTE FUNCTION ensure_primary_contributor();


-- =============================================================================
-- NOTES
-- =============================================================================
--
-- AFTER INSERT rather than BEFORE: book_contributors has a foreign key to
-- api_books, so the book row has to exist before a contributor can reference
-- it.
--
-- SECURITY DEFINER because the RLS policy on book_contributors checks
-- ownership through api_books, and during an INSERT the new row is not yet
-- visible to that subquery for every caller.
--
-- =============================================================================
