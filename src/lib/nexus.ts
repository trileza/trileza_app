/**
 * Nexus Engine — powered by InsForge
 * ─────────────────────────────────────
 * Creates and exports the InsForge SDK client as `nexus`.
 * All services (auth, database, storage, functions) flow through here.
 *
 * Credentials are pulled from environment variables so nothing sensitive is
 * committed to source control.
 */

import { createClient } from '@insforge/sdk';

const INSFORGE_URL = import.meta.env.VITE_INSFORGE_URL as string;
const INSFORGE_ANON_KEY = import.meta.env.VITE_INSFORGE_ANON_KEY as string;

if (!INSFORGE_URL || !INSFORGE_ANON_KEY) {
  console.error(
    '[Nexus] Missing InsForge credentials. ' +
    'Ensure VITE_INSFORGE_URL and VITE_INSFORGE_ANON_KEY are set in .env'
  );
}

/**
 * How long any request may take before it is aborted.
 *
 * This was previously `timeout: 0`, which the SDK treats as "never time out".
 * Any awaited call that stalled — an unreachable backend, a rejected policy, a
 * dropped connection — stayed pending forever, and every caller awaiting it
 * hung with no error and no way to recover. A "Cancel & Return" button that
 * awaited a profile write before navigating was simply dead in that state.
 *
 * The value is a single compromise rather than a per-request budget, because
 * the SDK only accepts timeout at client level and its session is held in
 * memory per instance — a second, longer-lived client for uploads would carry
 * its own empty token and 401 on every transfer.
 *
 * Two minutes is therefore sized for the largest thing that legitimately goes
 * through this client: an ebook or identity document on a slow connection.
 * Course video does not — that uploads to BunnyCDN over tus, which handles its
 * own resumable transfer and is unaffected by this setting.
 */
const REQUEST_TIMEOUT_MS = 120_000;

/**
 * The core InsForge client instance.
 * Import `nexus` anywhere in the app to access:
 *   nexus.auth       — Authentication (signUp, signIn, signOut, getProfile…)
 *   nexus.database   — PostgreSQL queries (.from().select().eq()…)
 *   nexus.storage    — File storage
 *   nexus.functions  — Serverless edge functions
 */
/**
 * Where edge functions are actually served from.
 *
 * The SDK derives this as `{appKey}.functions.insforge.app`, but this project's
 * functions are deployed to `{appKey}.function2.insforge.app` — the value the
 * backend reports as its `deploymentUrl`. The derived host answers with
 * DEPLOYMENT_NOT_FOUND ("Deno Deploy Classic was sunset"), which surfaced in
 * the app as "Network request failed: Failed to fetch" on every function call:
 * creating a live session, uploading course video, creating a Paystack
 * subaccount.
 *
 * Override it with VITE_INSFORGE_FUNCTIONS_URL if the host changes again.
 */
const FUNCTIONS_URL =
  (import.meta.env.VITE_INSFORGE_FUNCTIONS_URL as string | undefined) ||
  (() => {
    try {
      const { hostname } = new URL(INSFORGE_URL);
      if (!hostname.endsWith('.insforge.app')) return undefined;
      return `https://${hostname.split('.')[0]}.function2.insforge.app`;
    } catch {
      return undefined;
    }
  })();

/**
 * Refreshes an expired session and replays the request, once.
 *
 * The SDK has its own auto-refresh, but it only triggers on
 * `statusCode === 401 && error === "INVALID_TOKEN"`. This backend answers an
 * expired token with `error: "AUTH_UNAUTHORIZED"`, so the codes never match and
 * the built-in refresh never fires. The visible result was that leaving a tab
 * idle past the access-token lifetime broke the next action with
 * "Invalid token" — an upload, a save, a page of results — until a manual
 * reload.
 *
 * Wrapping fetch fixes it for every call at once, rather than at each call
 * site: database, storage, functions and auth all pass through here.
 *
 * Details that matter:
 *
 *  - One refresh at a time. A page that fires several requests on load would
 *    otherwise start several refreshes, and each rotation invalidates the
 *    previous refresh token, so the later ones fail and log the user out.
 *    Concurrent callers await the same promise.
 *
 *  - Only one retry per request, and never for the refresh call itself, so a
 *    genuinely dead session fails instead of looping.
 *
 *  - The body is replayed as given. A stream body could not be re-sent, but
 *    the SDK only ever passes strings and FormData here.
 */
const createRefreshingFetch = (): typeof fetch => {
  const baseFetch: typeof fetch = (input, init) => globalThis.fetch(input, init);
  let refreshing: Promise<boolean> | null = null;

  const refreshOnce = (): Promise<boolean> => {
    if (!refreshing) {
      refreshing = fetch(`${INSFORGE_URL}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      })
        .then((r) => r.ok)
        .catch(() => false)
        .finally(() => {
          // Cleared on the next tick so callers that arrived during the
          // refresh resolve against this attempt rather than starting another.
          setTimeout(() => {
            refreshing = null;
          }, 0);
        });
    }
    return refreshing;
  };

  return async (input, init) => {
    const response = await baseFetch(input, init);
    if (response.status !== 401) return response;

    const url = typeof input === 'string' ? input : (input as Request).url || String(input);
    // Never try to refresh a failed refresh, and never fight the login flow.
    if (url.includes('/api/auth/refresh') || url.includes('/api/auth/sessions')) {
      return response;
    }

    // Read the body from a clone so the original is still consumable if the
    // caller ends up receiving it.
    let isAuthFailure = false;
    try {
      const body = await response.clone().json();
      isAuthFailure =
        body?.error === 'AUTH_UNAUTHORIZED' ||
        body?.error === 'INVALID_TOKEN' ||
        /invalid token|jwt expired|token is expired/i.test(String(body?.message || ''));
    } catch {
      // A 401 with no JSON body is still worth one refresh attempt.
      isAuthFailure = true;
    }
    if (!isAuthFailure) return response;

    const refreshed = await refreshOnce();
    if (!refreshed) return response;

    return baseFetch(input, init);
  };
};

export const nexus = createClient({
  baseUrl: INSFORGE_URL,
  anonKey: INSFORGE_ANON_KEY,
  ...(FUNCTIONS_URL ? { functionsUrl: FUNCTIONS_URL } : {}),
  fetch: createRefreshingFetch(),
  timeout: REQUEST_TIMEOUT_MS,
  // Bounds the worst case. With the SDK default of 3, a genuinely unreachable
  // backend would tie a caller up for eight minutes.
  retryCount: 2,
  // Request and response bodies can carry personal data, and the noise is not
  // useful in production.
  debug: import.meta.env.DEV
});

/**
 * The most useful human-readable text an InsForge failure carries.
 *
 * `InsForgeError` holds four fields — message, error, statusCode, nextActions —
 * and which one is populated depends on where the failure came from. An edge
 * function returning `{"error": "Not permitted to create meetings"}` puts that
 * string in `.error` and leaves `.message` empty, so the common
 * `err.message || err.toString()` fallback renders the literal class name:
 *
 *     Failed to create session: InsForgeError
 *
 * which tells the user nothing and sends whoever debugs it looking in the wrong
 * place. Prefer whichever field actually has content.
 */
export const errorMessage = (err: unknown, fallback = 'Something went wrong'): string => {
  if (!err) return fallback;
  if (typeof err === 'string') return err;

  const e = err as Record<string, any>;
  const text = [e.message, e.error, e.details, e.hint].find(
    (v) => typeof v === 'string' && v.trim() && v !== 'InsForgeError'
  );
  if (text) return e.nextActions ? `${text} (${e.nextActions})` : text;

  if (typeof e.statusCode === 'number') return `Request failed (HTTP ${e.statusCode})`;
  return fallback;
};

/**
 * Where edge functions are served from, for callers that must bypass the SDK.
 *
 * nexus.functions.invoke reads any non-JSON response as text, which corrupts
 * binary — a downloaded PDF comes back mangled. Anything fetching a file calls
 * the function directly and needs this.
 */
export const FUNCTIONS_URL_PUBLIC = FUNCTIONS_URL || '';

/**
 * The signed-in user's access token, or null.
 *
 * Only needed for the direct-fetch case above; every ordinary call gets its
 * Authorization header from the SDK.
 */
export const getAccessToken = (): string | null => {
  try {
    return (nexus.auth as any).getAccessToken?.() ?? null;
  } catch {
    return null;
  }
};

/**
 * True when a failure came from the request budget being exceeded rather than
 * the server rejecting the call, so callers can say "that took too long, try
 * again" instead of showing a generic error.
 */
export const isTimeoutError = (err: unknown): boolean => {
  const message = (err as any)?.message?.toLowerCase?.() || '';
  const name = (err as any)?.name?.toLowerCase?.() || '';
  return name === 'aborterror' || message.includes('timeout') || message.includes('timed out');
};
