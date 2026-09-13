import { nexus } from '../nexus';

/**
 * Centralized Realtime Event Publisher
 * ─────────────────────────────────────
 * Publishes events to the admin:all broadcast channel so that
 * admin dashboards and user-facing apps stay in real-time sync.
 * 
 * All publish calls are non-blocking (.catch(() => {})) so they
 * never break the primary database mutation.
 */

const ADMIN_CHANNEL = 'admin:all';

/**
 * Publishing requires a live socket. Every publish below used to fire straight
 * at `nexus.realtime` whether or not one existed, and swallow the rejection —
 * so an event raised before the connection was up (which is most of them, since
 * nothing called ensureRealtimeConnection) simply never reached any dashboard,
 * and the consoles fell back to their 60-second poll while appearing live.
 *
 * The publish now connects first, and queues while that is in flight.
 */
let connectPromise: Promise<void> | null = null;

const withConnection = async (): Promise<boolean> => {
  try {
    if (nexus.realtime.isConnected) return true;
    if (!connectPromise) {
      connectPromise = nexus.realtime
        .connect()
        .then(async () => {
          await nexus.realtime.subscribe(ADMIN_CHANNEL);
        })
        .finally(() => {
          connectPromise = null;
        });
    }
    await connectPromise;
    return nexus.realtime.isConnected;
  } catch (_) {
    return false;
  }
};

const publish = (event: string, payload: any, source: 'admin' | 'user') => {
  void (async () => {
    try {
      if (!(await withConnection())) return;
      await nexus.realtime.publish(ADMIN_CHANNEL, event, {
        ...payload,
        _ts: new Date().toISOString(),
        _source: source,
      });
    } catch (_) {
      // A dropped broadcast must never fail the database write it describes.
    }
  })();
};

/**
 * Publish an admin event to the broadcast channel.
 * Called from admin service after successful mutations.
 */
export const publishAdminEvent = (event: string, payload?: any) => {
  publish(event, payload, 'admin');
};

/**
 * Publish a user-facing event to the admin broadcast channel.
 * Called from user-facing stores/pages after user actions.
 */
export const publishUserEvent = (event: string, payload?: any) => {
  publish(event, payload, 'user');
};

/**
 * Ensure the realtime connection is active and subscribe
 * to the admin broadcast channel. Call this early in the
 * app lifecycle so publish calls don't fail silently.
 */
export const ensureRealtimeConnection = async () => {
  await withConnection();
};
