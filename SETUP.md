# Trileza — environment setup

How to point the app at an InsForge backend, from a clean checkout or when
switching accounts.

The app never talks to Postgres directly. It goes through the InsForge SDK over
HTTPS ([src/lib/nexus.ts](src/lib/nexus.ts)), which needs an **API URL** and an
**anon key** — not a `postgresql://` connection string. A connection string is
useful only for running SQL by hand; it cannot be used by the browser, and a
Postgres password placed in a `VITE_` variable would be compiled into the public
JavaScript bundle where anyone can read it.

## 1. Credentials

Link the project, then read the anon key from the CLI:

```bash
npx @insforge/cli login --user-api-key <uak_...>
npx @insforge/cli link --project-id <project-id>
npx @insforge/cli secrets get ANON_KEY
```

The anon key is **not** shown in the dashboard's Project Settings and is not
returned by any REST endpoint — `secrets get ANON_KEY` is the way to obtain it.
It is an `anon_...` string, not a JWT, and is distinct from both the project
API key (`ik_...`, server-only, full access) and the user API key (`uak_...`,
for CLI login).

Put both values in `.env` at the repo root:

```
VITE_INSFORGE_URL=https://<project>.<region>.insforge.app
VITE_INSFORGE_ANON_KEY=<anon key>
VITE_PAYSTACK_PUBLIC_KEY=pk_...
```

`.env` is gitignored. Never commit it, and never paste these values into chat,
an issue, or a commit message. `.env.example` lists every variable the app and
its functions read, with placeholders.

Anything prefixed `VITE_` is **public** — it ships inside the bundle. Only ever
put publishable values there: the anon key and the Paystack *public* key. Secret
keys belong in the server-side stores described in step 4.

## 2. Schema

A new InsForge project starts empty. Build the schema before running the app,
or every query will fail on a missing table.

Run **`migrations/_APPLY_ALL.sql`** top to bottom in the InsForge SQL editor. It
concatenates every migration in dependency order, and each statement is written
to be safely re-runnable, so a partial run can be repeated after a fix.

Alternatively, apply them one at a time through the migration API:

```bash
export INSFORGE_URL="https://<project>.<region>.insforge.app"
export INSFORGE_KEY="<insforge api key>"   # the ik_... key, not the anon key

node apply_migrations.cjs --dry-run   # prints what would be sent
node apply_migrations.cjs             # applies pending migrations in order
```

Each file runs in its own transaction and stops at the first failure, because
later migrations build on earlier ones and a half-built schema is worse than
none. Versions already recorded are skipped, so after fixing a failure you
re-run the same command and it resumes where it stopped.

Two things to know about the migration API: it records each version and
**refuses any version at or below the newest applied one**, so a correction
cannot be made by editing an applied file — it needs a new file with a later
version. And migrations apply in the order listed in `apply_migrations.cjs`,
not by filename, so a new migration must be added to that list.

### Verifying

After the run, check that the security rules actually took effect:

```sql
-- Tables still without row-level security. Expect only the follow-ups
-- listed in the notes of 20260914_core_schema_and_tenancy.sql.
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
  AND NOT rowsecurity
ORDER BY tablename;

-- Constraints added NOT VALID, pending verification against legacy rows.
SELECT conrelid::regclass AS table_name, conname
FROM pg_constraint WHERE NOT convalidated;
```

On a **brand-new** database there is no legacy data, so the NOT VALID
constraints can be validated immediately:

```sql
ALTER TABLE <table> VALIDATE CONSTRAINT <constraint>;
```

## 3. Storage buckets

Run this once the project is linked — it creates every bucket the app writes
to, and is safe to re-run:

```bash
node scripts/setup-buckets.cjs
```

| Bucket | Visibility | Holds |
|---|---|---|
| `uploads` | public | avatars, profile photos, CVs |
| `session-thumbnails` | public | cover images for live sessions |
| `course-materials-trileza-784bc328` | public | downloadable lesson material |
| `chat-attachments` | **private** | files sent in private conversations |
| `institution-kyc` | **private** | incorporation certificates, tax documents, passports, government IDs |

Buckets are not part of the SQL schema, so the migrations do not create them.
A missing one fails only when someone reaches the feature that writes to it —
which is how `Bucket "session-thumbnails" does not exist` first appeared, well
after the backend looked fully set up. The script exists so that gap is closed
in one step rather than discovered feature by feature.

To create them by hand instead:

```bash
curl -X POST "$INSFORGE_URL/api/storage/buckets" \
  -H "x-api-key: $INSFORGE_KEY" -H "Content-Type: application/json" \
  -d '{"bucketName":"uploads","isPublic":true}'

curl -X POST "$INSFORGE_URL/api/storage/buckets" \
  -H "x-api-key: $INSFORGE_KEY" -H "Content-Type: application/json" \
  -d '{"bucketName":"institution-kyc","isPublic":false}'
```

The flag is `isPublic`, not `public`. A body sending `public` is accepted, the
unrecognised field is ignored, and the bucket is created **public** — so always
confirm afterwards:

```bash
curl -s -H "x-api-key: $INSFORGE_KEY" "$INSFORGE_URL/api/storage/buckets"
```

`institution-kyc` must read `"public": false`. It holds passports and tax
documents; if any signed-in user can read it, every mentor on the platform can
read every institution's identity papers. To correct one:

```bash
curl -X PATCH "$INSFORGE_URL/api/storage/buckets/institution-kyc" \
  -H "x-api-key: $INSFORGE_KEY" -H "Content-Type: application/json" \
  -d '{"isPublic":false}'
```

## 4. Server-side secrets

These are **not** `VITE_` variables and must never appear in `.env` for a
deployed environment.

**InsForge edge functions** (`insforge secrets add NAME "value"`):

```
PAYSTACK_SECRET_KEY     INSFORGE_BASE_URL       API_KEY
SMTP_PASSWORD           BUNNY_API_KEY           BUNNY_LIBRARY_ID
BUNNY_PULL_ZONE         BUNNY_TOKEN_KEY         CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_APP_ID       CLOUDFLARE_API_TOKEN
```

`insforge secrets list` shows what is set. A fresh project lists only
platform-reserved keys (`JWT_*`, `ANON_KEY`, `API_KEY`, `INSFORGE_BASE_URL`);
every name above that is absent must be added, or the feature it serves fails
at the moment a user reaches it:

| Missing | Breaks |
|---|---|
| `CLOUDFLARE_*` | live sessions — "credentials are not configured" |
| `BUNNY_*` | course video upload and playback |
| `PAYSTACK_SECRET_KEY` | payouts, subaccounts, webhook verification |
| `SMTP_PASSWORD` | verification email — **signup cannot complete** |

Secrets do not travel between projects. Deploying the functions is separate
again: `insforge functions list` on a new project returns "No functions found"
until they are pushed, and an app calling a function that was never deployed
fails with a network error rather than a 404 (see below).

### Cloudflare RealtimeKit

Live sessions need a RealtimeKit app. **Create it in the dashboard**, not
through the API: a dashboard-created app is provisioned with the default
presets, and [dyte-meeting](supabase/functions/dyte-meeting/index.ts) asks for
two of them by name — `group_call_host` and `group_call_participant`. An app
created by API has no presets, and the failure surfaces only when somebody
tries to join.

The three values can all be read back with a Realtime-scoped token, so there is
no need to hunt through the dashboard:

```bash
T=<api token>   # My Profile -> API Tokens -> Realtime / Realtime Admin
A=<account id>  # right sidebar of any dashboard page, or the URL after /accounts/

# CLOUDFLARE_APP_ID — the `id` of the app you want
curl -s -H "Authorization: Bearer $T" \
  "https://api.cloudflare.com/client/v4/accounts/$A/realtime/kit/apps"

# confirm the presets the function depends on exist
curl -s -H "Authorization: Bearer $T" \
  "https://api.cloudflare.com/client/v4/accounts/$A/realtime/kit/<app id>/presets"
```

A Realtime-scoped token cannot list accounts (`/accounts` returns an empty
array) — that is correct scoping, not a broken token. Verify it with
`/user/tokens/verify`, which works regardless of scope.

Worth a preflight before wiring the app up, since it isolates a Cloudflare-side
problem from an InsForge-side one:

```bash
B="https://api.cloudflare.com/client/v4/accounts/$A/realtime/kit/<app id>"
curl -s -X POST "$B/meetings" -H "Authorization: Bearer $T" \
  -H "Content-Type: application/json" -d '{"title":"preflight"}'
curl -s -X POST "$B/meetings/<meeting id>/participants" -H "Authorization: Bearer $T" \
  -H "Content-Type: application/json" \
  -d '{"preset_name":"group_call_host","name":"preflight"}'
```

The second call returning a `token` means the whole chain works. Deactivate the
test meeting afterwards with `PATCH $B/meetings/<id>` and `{"status":"INACTIVE"}`.

Meeting ids are stored per session in `live_sessions.dyte_meeting_id` and belong
to the app that created them. Moving to a different Cloudflare account orphans
every existing meeting id, so scheduled sessions from the old account stop
resolving — check `SELECT count(*) FROM live_sessions` before switching.

### Functions are served from a different host

The SDK derives the functions host as `{appKey}.functions.insforge.app`, but
this project's are served from `{appKey}.function2.insforge.app` — the value
`GET /api/functions` returns as `deploymentUrl`. [src/lib/nexus.ts](src/lib/nexus.ts)
overrides it for that reason.

A wrong functions host does not look like a wrong host. The dead one answers
404 with no CORS headers, so `fetch()` reports a network failure and the app
shows *"Network request failed: Failed to fetch"* — which reads as the backend
being down. Check `deploymentUrl` before chasing connectivity.

### Bunny Stream uses three different secrets

This trips people up, because all three are called "the key" somewhere in
Bunny's dashboard, and using the wrong one fails at a different layer each time:

| Secret | Where it comes from | Used for | Wrong value gives |
|---|---|---|---|
| `BUNNY_API_KEY` | the **video library**'s key (`ApiKey` in `GET /videolibrary/{id}`) | creating videos, upload signatures | 401 from `video.bunnycdn.com` |
| `BUNNY_TOKEN_KEY` | the **pull zone**'s `ZoneSecurityKey` | signing playback URLs | 403 on every video |
| account key | Account Settings → API | creating libraries/zones (setup only) | never belongs in the app |

The account-level key is for provisioning and must not be given to the edge
function: it can delete every library and zone you own.

To read the library and zone values back at any time:

```bash
curl -H "AccessKey: $BUNNY_ACCOUNT_KEY" https://api.bunny.net/videolibrary/<id>
curl -H "AccessKey: $BUNNY_ACCOUNT_KEY" https://api.bunny.net/pullzone/<pullZoneId>
```

Token authentication must be **on** for the pull zone (`ZoneSecurityEnabled`),
otherwise signed URLs are pointless — every course video is readable by anyone
who has the link, whether they paid or not.

**Hosting platform** (environment variables on whichever host serves the site):
the `VITE_` values, so the build can embed them, plus `SITE_URL` — the public
origin, which edge functions use to build links in outgoing email.

## 5. Run it

```bash
npm install
npm run dev            # main app
npm run build          # production build
npm run build:admin    # admin console bundle
```

## Switching accounts

1. Update `VITE_INSFORGE_URL` and `VITE_INSFORGE_ANON_KEY` in `.env`
2. Run the migrations against the new project (step 2)
3. Create the storage buckets (step 3)
4. Re-add every server-side secret (step 4) — these do not travel with the project
5. Update the same values on the hosting platform
6. Rotate the credentials of the account you left

Data does **not** move between projects automatically. If the old account holds
real users, courses or payments, plan an export/import before cutting over —
and mind the foreign keys: `profiles` must load before anything referencing it.

## If a query returns nothing after migrating

Almost always row-level security, not lost data. `20260914_core_schema_and_tenancy.sql`
enables RLS on ~30 tables that previously had none. Check which policy applies:

```sql
SELECT policyname, cmd, qual FROM pg_policies
WHERE schemaname = 'public' AND tablename = '<table>';
```

A signed-out visitor reads only what a policy explicitly allows — published
courses, the public catalog, and the `public_profiles` view.
