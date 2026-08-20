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
 * Multi-table realtime subscription — subscribes to multiple InsForge tables
 * and debounces the refresh callback to avoid rapid-fire re-fetches.
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
        for (const table of tables) {
          const channel = `admin:${table}`;
          const res = await nexus.realtime.subscribe(channel);
          if (res.ok) {
            subscribed.add(channel);
          }
        }
        if (subscribed.size > 0) {
          nexus.realtime.on('database_update', debouncedUpdate);
        }
      } catch (err) {
        console.warn('[MultiTableSync] Subscription error:', err);
      }
    };

    subscribe();

    return () => {
      clearTimeout(debounceTimer);
      nexus.realtime.off('database_update', debouncedUpdate);
      subscribed.forEach(channel => {
        try { nexus.realtime.unsubscribe(channel); } catch (_) {}
      });
    };
  }, [tables.join(','), enabled]);
}
