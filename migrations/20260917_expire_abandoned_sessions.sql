-- =============================================================================
-- TRILEZA — EXPIRE ABANDONED LIVE SESSIONS
-- =============================================================================
--
-- The Community hub showed classrooms as "Live Now" with nobody in them.
-- Confirmed against Cloudflare: both sessions reported zero participants while
-- their rows still read `status = 'live'`.
--
-- A session only ever moved to 'ended' when the host clicked End Meeting and
-- confirmed a modal. Every other way of leaving left the row live forever:
--
--   * the host closes the tab, or the browser crashes
--   * the host navigates back (that path logged the participant out but never
--     touched session status)
--   * the laptop sleeps, or the network drops
--   * the session runs past its tier time limit
--
-- The last participant to leave cannot be relied on to report it — a closed tab
-- sends nothing — so this cannot be fixed on the client. Expiry has to be
-- decided from data the server already holds.
--
-- Two signals, so a session is never cut off while people are still in it:
--
--   1. Its tier time limit has elapsed since started_at. Hard stop, already the
--      promise made to the host when they created it.
--
--   2. Nobody has been seen for a while. `last_heartbeat_at` is touched by
--      clients in the room; once it goes stale the room is empty. A session
--      that never got a heartbeat falls back to started_at, which covers a room
--      nobody ever actually joined.
--
-- =============================================================================


ALTER TABLE live_sessions
  ADD COLUMN IF NOT EXISTS last_heartbeat_at TIMESTAMPTZ;

COMMENT ON COLUMN live_sessions.last_heartbeat_at IS
  'Last time any participant was confirmed present. Touched periodically by '
  'clients in the room; when it goes stale the room is empty and the session '
  'is expired by expire_abandoned_sessions().';

CREATE INDEX IF NOT EXISTS idx_live_sessions_live_heartbeat
  ON live_sessions (status, last_heartbeat_at)
  WHERE status = 'live';


-- ── Heartbeat ────────────────────────────────────────────────────────────
-- Callable by any participant. Deliberately not an UPDATE policy on the table:
-- a student must be able to say "I am still here" without being able to edit
-- anything else about the session.
CREATE OR REPLACE FUNCTION touch_session_heartbeat(p_session_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE live_sessions
     SET last_heartbeat_at = NOW()
   WHERE id = p_session_id
     AND status = 'live';
END;
$$;

GRANT EXECUTE ON FUNCTION touch_session_heartbeat(TEXT) TO authenticated;


-- ── Reaper ───────────────────────────────────────────────────────────────
-- Returns how many sessions it closed, so a caller can log it.
--
-- The grace period is generous on purpose. A brief disconnect, a tab
-- backgrounded by a phone, or a host stepping away mid-lesson must not kill a
-- class that people are still sitting in; it is far worse to end a live lesson
-- early than to let an empty room linger a few more minutes.
CREATE OR REPLACE FUNCTION expire_abandoned_sessions(p_grace_minutes INTEGER DEFAULT 5)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  WITH expired AS (
    UPDATE live_sessions
       SET status   = 'ended',
           ended_at = NOW()
     WHERE status = 'live'
       AND (
         -- Ran past its tier allowance.
         (
           duration_limit_minutes IS NOT NULL
           AND started_at IS NOT NULL
           AND NOW() > started_at + (duration_limit_minutes * INTERVAL '1 minute')
         )
         OR
         -- Nobody seen for longer than the grace period. COALESCE covers a
         -- room that never received a heartbeat at all.
         (
           NOW() > COALESCE(last_heartbeat_at, started_at, created_at)
                   + (p_grace_minutes * INTERVAL '1 minute')
         )
       )
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_count FROM expired;

  RETURN v_count;
END;
$$;

-- Any signed-in client may run the reaper. It only ever closes sessions that
-- are already provably finished, so there is nothing to gain by calling it, and
-- having every client sweep on load means expiry does not depend on a cron job
-- or on one particular user being online.
GRANT EXECUTE ON FUNCTION expire_abandoned_sessions(INTEGER) TO authenticated, anon;


-- ── Close out the sessions that are already stranded ─────────────────────
-- Everything currently marked live is past its limit with no participants.
SELECT expire_abandoned_sessions(5);


-- =============================================================================
-- NOTES
-- =============================================================================
--
-- Expiry runs from two directions, so neither has to be reliable alone:
--
--   1. An InsForge schedule calls this RPC every two minutes. That is the one
--      that matters, because it runs whether or not anybody is using the app —
--      a host whose tab crashed leaves nothing behind to trigger a sweep.
--      Created with:
--
--        insforge schedules create --name expire-abandoned-live-sessions \
--          --cron "*/2 * * * *" --method POST \
--          --url "<project>/api/database/rpc/expire_abandoned_sessions" \
--          --headers '{"Authorization":"Bearer <anon key>","Content-Type":"application/json"}' \
--          --body '{"p_grace_minutes":3}'
--
--      The anon key is enough: the function is SECURITY DEFINER and only ever
--      closes sessions that are already provably finished.
--
--   2. Clients call it when they list live sessions, and touch
--      touch_session_heartbeat() while they are in a room. This keeps the hub
--      accurate the instant someone looks at it, and covers any window where
--      the schedule is paused or failing.
--
-- The grace period is 3 minutes on the schedule against a default of 5, since
-- a sweep every 2 minutes can afford to be tighter than one that might not run
-- again until somebody opens the page.
--
-- =============================================================================
