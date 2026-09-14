/**
 * Creates every storage bucket the app writes to.
 *
 * Buckets are not part of the SQL schema, so migrations do not create them and
 * nothing in the repo recorded which ones the app needs. A missing bucket only
 * surfaces when a user hits the feature that writes to it — "Bucket
 * 'session-thumbnails' does not exist" appeared the first time someone tried
 * to attach a cover image to a live session, long after the backend was set up.
 *
 * Run after pointing the app at a new InsForge project:
 *
 *   node scripts/setup-buckets.cjs
 *
 * Reads credentials from .insforge/project.json (written by `insforge link`),
 * or from INSFORGE_URL / INSFORGE_KEY in the environment.
 *
 * Safe to re-run: existing buckets are left untouched.
 *
 * NOTE: the flag is `isPublic`, not `public`. A body sending `public` is
 * accepted, the unrecognised field ignored, and the bucket created PUBLIC —
 * which for institution-kyc would expose passports and tax documents.
 */
const fs = require('fs');
const path = require('path');

/** Every bucket the app references, and why it is public or private. */
const BUCKETS = [
  // Avatars, course thumbnails, CVs. Served directly in the UI.
  { name: 'uploads', isPublic: true },

  // Cover images for live sessions, shown on the community and studio pages.
  { name: 'session-thumbnails', isPublic: true },

  // Downloadable course material. Public so lesson pages can link to it.
  { name: 'course-materials-trileza-784bc328', isPublic: true },

  // Files sent inside private conversations. Never public.
  { name: 'chat-attachments', isPublic: false },

  // Certificates of incorporation, tax documents, passports, government IDs.
  // Must stay private: a public bucket here is a serious data breach.
  { name: 'institution-kyc', isPublic: false },
];

function loadCredentials() {
  const url = process.env.INSFORGE_URL;
  const key = process.env.INSFORGE_KEY;
  if (url && key) return { url, key };

  const linked = path.join(__dirname, '..', '.insforge', 'project.json');
  if (fs.existsSync(linked)) {
    const p = JSON.parse(fs.readFileSync(linked, 'utf8'));
    if (p.oss_host && p.api_key) return { url: p.oss_host, key: p.api_key };
  }

  console.error(
    'No InsForge credentials found.\n' +
    'Run `npx @insforge/cli link --project-id <id>`, or set INSFORGE_URL and INSFORGE_KEY.'
  );
  process.exit(1);
}

(async () => {
  const { url, key } = loadCredentials();
  const headers = { 'x-api-key': key, 'Content-Type': 'application/json' };

  const res = await fetch(`${url}/api/storage/buckets`, { headers });
  if (!res.ok) {
    console.error(`Could not list buckets: HTTP ${res.status}`);
    process.exit(1);
  }
  const existing = new Set((await res.json()).map((b) => b.name));

  let created = 0;
  for (const bucket of BUCKETS) {
    if (existing.has(bucket.name)) {
      console.log(`  exists   ${bucket.name}`);
      continue;
    }
    const r = await fetch(`${url}/api/storage/buckets`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ bucketName: bucket.name, isPublic: bucket.isPublic }),
    });
    if (r.ok) {
      created++;
      console.log(`  created  ${bucket.name} (${bucket.isPublic ? 'public' : 'private'})`);
    } else {
      console.error(`  FAILED   ${bucket.name} — HTTP ${r.status} ${await r.text()}`);
      process.exitCode = 1;
    }
  }

  // Creation silently ignores an unknown flag, so confirm what actually landed
  // rather than trusting the 201.
  const after = await (await fetch(`${url}/api/storage/buckets`, { headers })).json();
  const wrong = after.filter((b) => {
    const want = BUCKETS.find((x) => x.name === b.name);
    return want && want.isPublic !== b.public;
  });

  if (wrong.length) {
    console.error('\nVisibility does not match what the app expects:');
    wrong.forEach((b) => console.error(`  ${b.name}: is ${b.public ? 'public' : 'private'}`));
    process.exitCode = 1;
  } else {
    console.log(`\n${created} created, ${BUCKETS.length - created} already present. Visibility verified.`);
  }
})();
