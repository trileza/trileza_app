-- =============================================================================
-- TRILEZA — LIVE SESSION DURATION LIMITS
-- =============================================================================
--
-- Live sessions ran indefinitely. Every tier — a mentee pod and an institution
-- alike — could hold a room open for as long as it liked, which is both a cost
-- problem (RealtimeKit bills participant-minutes) and the reason the paid tiers
-- had nothing concrete to sell.
--
-- The limit is stamped onto the session row at creation rather than derived at
-- render time, for two reasons:
--
--   1. Every participant must agree on when the room closes. Deriving it from
--      the viewer's own tier would give the host and their students different
--      deadlines, and a late joiner a different one again.
--
--   2. Changing a tier's allowance should not retroactively cut short or extend
--      sessions that are already running. A session carries the limit it was
--      created under.
--
-- The countdown itself is computed from started_at, which is already set when
-- a session goes live, so nothing new is needed to anchor it.
--
-- =============================================================================


ALTER TABLE live_sessions
  ADD COLUMN IF NOT EXISTS duration_limit_minutes INTEGER;

COMMENT ON COLUMN live_sessions.duration_limit_minutes IS
  'How long this session may run, in minutes, fixed at creation from the '
  'host''s tier. NULL means unlimited (institutional). The client counts down '
  'from started_at + this value.';


-- Existing sessions predate the limit and keep running unbounded. There are no
-- rows in practice on a fresh project, but a backfill to a specific tier would
-- be a guess, and NULL already means "no limit" — the correct reading for a
-- session created when no limit existed.


-- Guard against a nonsensical value arriving from a client. The upper bound is
-- 24 hours: anything beyond that is a bug rather than a legitimate all-day
-- session, and an unbounded integer here would silently disable the cap.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'live_sessions'::regclass
      AND conname  = 'live_sessions_duration_limit_sane'
  ) THEN
    ALTER TABLE live_sessions
      ADD CONSTRAINT live_sessions_duration_limit_sane
      CHECK (
        duration_limit_minutes IS NULL
        OR (duration_limit_minutes > 0 AND duration_limit_minutes <= 1440)
      );
  END IF;
END $$;


-- =============================================================================
-- NOTES
-- =============================================================================
--
-- The tier -> minutes mapping lives in src/config/sessionLimits.ts, not here.
-- It is product policy that changes with pricing, and putting it in SQL would
-- mean a migration every time a plan is repriced. This column stores only the
-- resolved number.
--
-- Enforcement is client-side: the meeting UI counts down and leaves at zero.
-- That is honest for a cost-control measure but it is not a security boundary —
-- a modified client could ignore it. If sessions need to be provably capped,
-- the backstop is RealtimeKit's own meeting expiry, set when the meeting is
-- created, and that belongs in the dyte-meeting function.
--
-- =============================================================================
