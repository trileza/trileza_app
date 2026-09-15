/**
 * How long a live session may run, per tier.
 *
 * Lives here rather than in SQL because it is product policy: it changes when
 * pricing changes, and a migration per repricing would be absurd. The resolved
 * number is stamped onto `live_sessions.duration_limit_minutes` when a session
 * is created, so a session keeps the allowance it was created under even if
 * these values change later.
 *
 * RealtimeKit bills participant-minutes, so these are a real cost control, not
 * only a way to differentiate the paid plans.
 */

import type { UserProfile } from '../store/authStore';

/** Hosting tiers, cheapest first. `null` means no limit. */
export const SESSION_LIMITS = {
  /** A mentee running a peer study pod. */
  mentee: 45,
  /** Free Mentor — the entry plan for new instructors. */
  free: 75,
  /** Pro Mentor. */
  pro: 120,
  /** Institutional plans are uncapped. */
  institutional: null
} as const satisfies Record<string, number | null>;

export type SessionTier = keyof typeof SESSION_LIMITS;

/** Human label for each tier, matching the names used in pricing. */
export const TIER_LABELS: Record<SessionTier, string> = {
  mentee: 'Mentee Live Pod',
  free: 'Free Mentor',
  pro: 'Pro Mentor',
  institutional: 'Institution'
};

/**
 * Which tier's allowance this account hosts under.
 *
 * The precedence mirrors the sidebar's own tier resolution so the plan a user
 * sees named in the UI is the one that governs their sessions. A mentor with no
 * recorded tier falls back to `free` — the safe direction, since guessing
 * upward would hand out unpaid capacity.
 */
export const resolveSessionTier = (user: UserProfile | null): SessionTier => {
  if (!user) return 'mentee';

  const metadata = (user.metadata || {}) as Record<string, unknown>;
  const role = String(user.role || '').toLowerCase();

  const raw = String(
    user.mentor_tier ||
      metadata.mentor_tier ||
      metadata.subscription_tier ||
      ''
  ).toLowerCase();

  if (raw === 'institutional' || role === 'management' || role === 'tenant_admin' || role === 'staff') {
    return 'institutional';
  }
  if (raw === 'pro') return 'pro';
  if (raw === 'free') return 'free';

  // No recorded tier. Someone who can teach is on the entry mentor plan;
  // everyone else is hosting a mentee pod.
  const isMentor =
    ['mentor', 'tutor', 'teacher', 'author'].includes(role) ||
    metadata.mentor_onboarded === true ||
    metadata.mentor_application_status === 'approved';

  return isMentor ? 'free' : 'mentee';
};

/** Minutes this account may host for, or null when uncapped. */
export const resolveSessionLimit = (user: UserProfile | null): number | null =>
  SESSION_LIMITS[resolveSessionTier(user)];

/** "45 mins", "1h 15m", "2h", or "Unlimited". */
export const formatLimit = (minutes: number | null): string => {
  if (minutes === null) return 'Unlimited';
  if (minutes < 60) return `${minutes} mins`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

/**
 * Points at which the meeting warns that time is running out, in minutes
 * remaining. Descending, so the UI can take the first one it has passed.
 */
export const WARNING_THRESHOLDS = [10, 5, 1] as const;
