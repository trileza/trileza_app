import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { nexus } from '../../../lib/nexus';

/**
 * Paginated list hook — slices an in-memory array into pages.
 * Used after data is fetched and filtered.
 */
export function usePaginatedList<T>(items: T[], pageSize = 25) {
  const [currentPage, setCurrentPage] = useState(1);

  // Reset to page 1 when items change (e.g. new filter)
  const prevLengthRef = useRef(items.length);
  useEffect(() => {
    if (items.length !== prevLengthRef.current) {
      setCurrentPage(1);
      prevLengthRef.current = items.length;
    }
  }, [items.length]);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedItems = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, safeCurrentPage, pageSize]);

  const goToPage = useCallback((page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  }, [totalPages]);

  const nextPage = useCallback(() => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages));
  }, [totalPages]);

  const prevPage = useCallback(() => {
    setCurrentPage(prev => Math.max(prev - 1, 1));
  }, []);

  return {
    currentPage: safeCurrentPage,
    totalPages,
    totalItems: items.length,
    paginatedItems,
    goToPage,
    nextPage,
    prevPage,
    startIndex: (safeCurrentPage - 1) * pageSize + 1,
    endIndex: Math.min(safeCurrentPage * pageSize, items.length),
  };
}

/**
 * Debounced value hook — delays updating the output value.
 * Use for search inputs to prevent re-filtering on every keystroke.
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Admin Realtime Channel — the single broadcast channel all admin
 * consoles and user-facing actions publish/subscribe to.
 */
export const ADMIN_REALTIME_CHANNEL = 'admin:all';

/**
 * All known admin realtime event names.
 */
const ALL_ADMIN_EVENTS: string[] = [
  'data_changed', 'course_reviewed', 'course_submitted', 'book_reviewed',
  'mentor_reviewed', 'mentor_application_submitted', 'author_reviewed',
  'author_application_submitted', 'payout_reviewed', 'payout_requested', 'ticket_updated',
  'ticket_reply', 'ticket_submitted', 'compliance_resolved', 'compliance_submitted',
  'flag_resolved', 'content_flagged',
  'user_suspension_changed', 'admin_role_changed', 'admin_invited',
  'registration_reviewed', 'transaction_refunded', 'audit_logged',
  'user_plan_upgraded', 'payment_completed', 'profile_updated',
  'enrollment_created', 'institution_registered', 'database_update'
];

/**
 * Realtime subscription hook — subscribes to InsForge table changes.
 * Auto-cleans up on unmount. Calls `onUpdate` when data changes.
 */
export function useRealtimeSync(
  table: string,
  onUpdate: () => void,
  enabled = true
) {
  useEffect(() => {
    if (!enabled) return;

    let isSubscribed = false;
    const handleUpdate = () => {
      onUpdate();
    };

    const subscribe = async () => {
      try {
        await nexus.realtime.connect();
        const res = await nexus.realtime.subscribe(`admin:${table}`);
        if (res.ok) {
          isSubscribed = true;
          nexus.realtime.on('database_update', handleUpdate);
        }
      } catch (err) {
        console.warn(`[Realtime] Could not subscribe to ${table}:`, err);
      }
    };

    subscribe();

    return () => {
      if (isSubscribed) {
        nexus.realtime.off('database_update', handleUpdate);
        try {
          nexus.realtime.unsubscribe(`admin:${table}`);
        } catch (_) {
          // Silently fail on cleanup
        }
      }
    };
  }, [table, onUpdate, enabled]);
}

/**
 * Optimistic action hook — performs an action with immediate UI feedback,
 * rolls back on failure, and syncs with the database.
 */
export function useOptimisticAction() {
  const [pendingActions, setPendingActions] = useState<Set<string>>(new Set());

  const execute = useCallback(async (
    actionId: string,
    action: () => Promise<void>,
    onSuccess?: () => void,
    onError?: (err: any) => void
  ) => {
    // Mark as pending immediately
    setPendingActions(prev => new Set(prev).add(actionId));

    try {
      await action();
      onSuccess?.();
    } catch (err) {
      onError?.(err);
    } finally {
      setPendingActions(prev => {
        const next = new Set(prev);
        next.delete(actionId);
        return next;
      });
    }
  }, []);

  const isPending = useCallback((actionId: string) => {
    return pendingActions.has(actionId);
  }, [pendingActions]);

  return { execute, isPending };
}

/**
 * Multi-table realtime subscription — subscribes to the admin broadcast channel
 * and listens for all known event types. Debounces the refresh callback at 300ms
 * to avoid rapid-fire re-fetches when multiple events arrive in quick succession.
 * 
 * Also subscribes to legacy per-table channels for backward compatibility.
 */
export function useMultiTableSync(
  tables: string[],
  onUpdate: () => void,
  enabled = true
) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    if (!enabled || tables.length === 0) return;

    let debounceTimer: any = null;
    const subscribed = new Set<string>();

    const debouncedUpdate = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        onUpdateRef.current();
      }, 300);
    };

    const subscribe = async () => {
      try {
        await nexus.realtime.connect();
        
        // Subscribe to the main admin broadcast channel
        try {
          const mainRes = await nexus.realtime.subscribe(ADMIN_REALTIME_CHANNEL);
          if (mainRes.ok) {
            subscribed.add(ADMIN_REALTIME_CHANNEL);
          }
        } catch (_) {
          // Main channel subscription is best-effort
        }
        
        // Also subscribe to legacy per-table channels for backward compat
        for (const table of tables) {
          const channel = `admin:${table}`;
          if (channel === ADMIN_REALTIME_CHANNEL) continue;
          try {
            const res = await nexus.realtime.subscribe(channel);
            if (res.ok) {
              subscribed.add(channel);
            }
          } catch (_) {
            // Non-critical
          }
        }
        
        if (subscribed.size > 0) {
          // Listen for all known admin event types
          ALL_ADMIN_EVENTS.forEach(evt => {
            nexus.realtime.on(evt, debouncedUpdate);
          });
        }
      } catch (err) {
        console.warn('[MultiTableSync] Subscription error:', err);
      }
    };

    subscribe();

    return () => {
      clearTimeout(debounceTimer);
      ALL_ADMIN_EVENTS.forEach(evt => {
        nexus.realtime.off(evt, debouncedUpdate);
      });
      subscribed.forEach(channel => {
        try { nexus.realtime.unsubscribe(channel); } catch (_) {}
      });
    };
  }, [tables.join(','), enabled]);
}

/**
 * Admin Realtime Hub — centralized connection hook that provides:
 * - Single WebSocket connection shared across all admin consoles
 * - Live event stream with last event metadata
 * - Event counter for activity indicators
 * - Last synced timestamp
 * 
 * Mount this in AdminLayout to share across all admin dashboards.
 */
export function useAdminRealtimeHub(enabled = true) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<{ type: string; timestamp: Date; payload?: any } | null>(null);
  const [eventCount, setEventCount] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date>(new Date());

  useEffect(() => {
    if (!enabled) return;

    let subscribed = false;

    const handleEvent = (payload: any) => {
      const eventType = payload?.meta?.event || payload?.type || 'unknown';
      setLastEvent({ type: eventType, timestamp: new Date(), payload });
      setEventCount(prev => prev + 1);
      setLastSyncedAt(new Date());
    };

    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);

    const connect = async () => {
      try {
        await nexus.realtime.connect();
        setIsConnected(true);

        const res = await nexus.realtime.subscribe(ADMIN_REALTIME_CHANNEL);
        if (res.ok) {
          subscribed = true;
          ALL_ADMIN_EVENTS.forEach(evt => {
            nexus.realtime.on(evt, handleEvent);
          });
        }

        nexus.realtime.on('connect', handleConnect);
        nexus.realtime.on('disconnect', handleDisconnect);
      } catch (err) {
        console.warn('[AdminRealtimeHub] Connection error:', err);
      }
    };

    connect();

    return () => {
      nexus.realtime.off('connect', handleConnect);
      nexus.realtime.off('disconnect', handleDisconnect);
      
      if (subscribed) {
        ALL_ADMIN_EVENTS.forEach(evt => {
          nexus.realtime.off(evt, handleEvent);
        });
        try {
          nexus.realtime.unsubscribe(ADMIN_REALTIME_CHANNEL);
        } catch (_) {}
      }
    };
  }, [enabled]);

  const resetEventCount = useCallback(() => setEventCount(0), []);

  return {
    isConnected,
    lastEvent,
    eventCount,
    lastSyncedAt,
    resetEventCount,
  };
}

/**
 * Auto-refresh hook — combines multi-table realtime sync with
 * a visible "last synced" timestamp and live pulse indicator.
 * Provides manual refresh capability and connection status.
 */
export function useAutoRefresh(
  fetchData: () => Promise<void> | void,
  tables: string[] = [],
  enabled = true
) {
  const [lastSyncedAt, setLastSyncedAt] = useState<Date>(new Date());
  const [isSyncing, setIsSyncing] = useState(false);
  const [liveEventCount, setLiveEventCount] = useState(0);
  const fetchRef = useRef(fetchData);
  fetchRef.current = fetchData;

  const wrappedFetch = useCallback(async () => {
    setIsSyncing(true);
    try {
      await fetchRef.current();
      setLastSyncedAt(new Date());
      setLiveEventCount(prev => prev + 1);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // Wire up multi-table sync to trigger wrapped fetch
  useMultiTableSync(
    tables.length > 0 ? tables : ['_broadcast'],
    wrappedFetch,
    enabled
  );

  const manualRefresh = useCallback(async () => {
    await wrappedFetch();
  }, [wrappedFetch]);

  return {
    lastSyncedAt,
    isSyncing,
    liveEventCount,
    manualRefresh,
  };
}

