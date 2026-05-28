/**
 * Nexus Engine — powered by InsForge
 * ─────────────────────────────────────
 * This file creates and exports the InsForge SDK client as `nexus`.
 * All services (auth, database, storage, functions) flow through here.
 *
 * Credentials are pulled from environment variables so nothing
 * sensitive is committed to source control.
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
 * The core InsForge client instance.
 * Import `nexus` anywhere in the app to access:
 *   nexus.auth       — Authentication (signUp, signIn, signOut, getProfile, setProfile…)
 *   nexus.database   — PostgreSQL queries (.from().select().eq()…)
 *   nexus.storage    — File storage
 *   nexus.functions  — Serverless edge functions
 */
export const nexus = createClient({
  baseUrl: INSFORGE_URL,
  anonKey: INSFORGE_ANON_KEY,
});
