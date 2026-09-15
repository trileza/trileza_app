import { nexus } from '../lib/nexus';

/**
 * Runs an operation, refreshing an expired session and retrying once if the
 * failure was an auth failure.
 *
 * Mostly redundant now: nexus wraps fetch so that an expired access token is
 * refreshed and the request replayed underneath every SDK call. This remains
 * for operations that are not a single SDK call — a sequence that must be
 * re-run as a whole, say — and as a safety net.
 *
 * It previously only inspected thrown errors. Most of the SDK does not throw:
 * database queries, storage uploads and function invocations all *return*
 * `{ data, error }`, so the catch block never ran, the token was never
 * refreshed, and the wrapper did nothing at all on the calls that needed it
 * most. That is why an idle tab failed an upload with "Invalid token" despite
 * the call being wrapped. Both shapes are now handled.
 */

/** Whether a failure is an expired or rejected session rather than a real error. */
const isAuthFailure = (err: unknown): boolean => {
  if (!err) return false;
  const e = err as Record<string, any>;
  const code = String(e.error || '');
  const msg = String(e.message || e || '');

  return (
    code === 'AUTH_UNAUTHORIZED' ||
    code === 'INVALID_TOKEN' ||
    e.statusCode === 401 ||
    e.status === 401 ||
    /invalid token|jwt expired|invalid jwt|token is expired|unauthorized/i.test(msg)
  );
};

/** True for the SDK's `{ data, error }` result shape. */
const isResultShape = (value: unknown): value is { data: unknown; error: unknown } =>
  typeof value === 'object' && value !== null && 'error' in value && 'data' in value;

export async function executeWithAutoRefresh<T>(fn: () => Promise<T>): Promise<T> {
  const refreshAndRetry = async (): Promise<T> => {
    // getCurrentUser() drives the SDK's session refresh in the browser.
    await nexus.auth.getCurrentUser();
    return fn();
  };

  let result: T;
  try {
    result = await fn();
  } catch (err) {
    if (!isAuthFailure(err)) throw err;
    console.warn('[AuthHelper] Session expired mid-request; refreshing and retrying.');
    try {
      return await refreshAndRetry();
    } catch {
      throw err; // Report the original failure, not the refresh's.
    }
  }

  // Returned rather than thrown — the common case for this SDK.
  if (isResultShape(result) && isAuthFailure(result.error)) {
    console.warn('[AuthHelper] Session expired mid-request; refreshing and retrying.');
    try {
      return await refreshAndRetry();
    } catch {
      return result; // Hand back the original result so the caller can report it.
    }
  }

  return result;
}
