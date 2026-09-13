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

Take both values from the InsForge dashboard (project settings / backend
metadata) and put them in `.env` at the repo root:

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

| Bucket | Visibility | Holds |
|---|---|---|
| `uploads` | public | avatars, thumbnails, course material |
| `institution-kyc` | **private** | incorporation certificates, tax documents, passports, government IDs |

Create them in the console, or over the API:

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
BUNNY_PULL_ZONE         CLOUDFLARE_ACCOUNT_ID   CLOUDFLARE_APP_ID
CLOUDFLARE_API_TOKEN
```

**Netlify** (site settings → environment variables): `INSFORGE_URL`,
`INSFORGE_ANON_KEY`, plus the `VITE_` values so the build can embed them.

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
5. Update the same values in Netlify
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
