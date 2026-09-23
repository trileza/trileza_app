-- =============================================================================
-- TRILEZA — TIGHTEN SOCIAL READS
-- =============================================================================
--
-- Found by `insforge advisor`, then checked by reading each policy rather than
-- taking the label at face value. Of the three it flagged, two were real and
-- one was correct as written.
--
-- ── follows: the whole social graph was public ───────────────────────────
--
-- follows_select was USING (true) for `public`, so anyone holding the anon
-- key — no account needed — could read every follower relationship on the
-- platform: who mentors whom, who follows whom, as a downloadable list.
--
-- Nothing in the app needs a stranger to read the global graph. A signed-in
-- user needs their own edges (to render follow buttons and counts), and the
-- counts a profile shows are aggregates anyone may see. So: readable when you
-- are one of the two people in the row, and otherwise not.
--
-- ── post_comments: leaked across tenants ─────────────────────────────────
--
-- posts is scoped by tenant. post_comments was USING (true), and has no
-- tenant_id of its own, so a comment was readable by anyone even when the post
-- it belonged to was not. The child was more visible than its parent, which is
-- never deliberate.
--
-- Fixed by inheriting: a comment is visible exactly when its post is. That
-- keeps the two in step automatically if the post rule changes again.
--
-- ── mentorship_programs: correct already ─────────────────────────────────
--
-- Flagged for the same USING (true), but this one is a catalogue of programmes
-- people are meant to browse before signing up — the same reasoning as
-- published books being world-readable. Left alone deliberately, so the next
-- person to run the advisor does not "fix" it.
--
-- =============================================================================


-- ── follows ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS follows_select ON follows;

CREATE POLICY follows_select ON follows
  FOR SELECT TO authenticated
  USING (
    follower_id = (SELECT auth.uid())::text
    OR following_id = (SELECT auth.uid())::text
    OR is_platform_admin()
  );


-- ── post_comments ────────────────────────────────────────────────────────

DROP POLICY IF EXISTS post_comments_select ON post_comments;

CREATE POLICY post_comments_select ON post_comments
  FOR SELECT TO authenticated, anon
  USING (
    EXISTS (
      SELECT 1 FROM posts p
       WHERE p.id = post_comments.post_id
         AND (
           p.tenant_id = 'default-tenant'
           OR p.tenant_id = current_user_tenant_id()
           OR is_platform_admin()
         )
    )
  );

-- The subquery above runs per row, so the lookup needs to be an index hit.
CREATE INDEX IF NOT EXISTS post_comments_post_id_idx
  ON post_comments (post_id);
