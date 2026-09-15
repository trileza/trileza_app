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

export const nexus = createClient({
  baseUrl: INSFORGE_URL,
  anonKey: INSFORGE_ANON_KEY,
  ...(FUNCTIONS_URL ? { functionsUrl: FUNCTIONS_URL } : {}),
  timeout: REQUEST_TIMEOUT_MS,
  // Bounds the worst case. With the SDK default of 3, a genuinely unreachable
  // backend would tie a caller up for eight minutes.
  retryCount: 2,
  // Request and response bodies can carry personal data, and the noise is not
  // useful in production.
  debug: import.meta.env.DEV
});

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
