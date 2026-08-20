import { nexus } from '../lib/nexus';

/**
 * Executes an async operation with automatic auth token refresh and retry
 * if an 'Invalid token', 'JWT expired', or 401 error is encountered.
 */
export async function executeWithAutoRefresh<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    const msg = String(err?.message || err || '');
    if (
      msg.includes('Invalid token') ||
      msg.includes('JWT expired') ||
      msg.includes('invalid JWT') ||
      msg.includes('token is expired') ||
      msg.includes('Unauthorized') ||
      err?.status === 401
    ) {
      console.log('[AuthHelper] Auth token issue detected. Re-synchronizing session...');
      try {
        // Refresh session token via getCurrentUser() which automatically refreshes tokens in browser
        await nexus.auth.getCurrentUser();
        // Retry operation after token refresh
        return await fn();
      } catch (refreshErr) {
        console.error('[AuthHelper] Failed to auto-refresh session token:', refreshErr);
        throw err;
      }
    }
    throw err;
  }
}
