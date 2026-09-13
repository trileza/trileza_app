/**
 * Applies the pending migrations through InsForge's migration API.
 *
 * Usage (PowerShell):
 *   $env:INSFORGE_URL = "https://25t8cbg8.us-east.insforge.app"
 *   $env:INSFORGE_KEY = "<your insforge api key>"
 *   node apply_migrations.cjs
 *
 *   # dry run — prints what would be sent, changes nothing
 *   node apply_migrations.cjs --dry-run
 *
 *   # apply a single file
 *   node apply_migrations.cjs 20260812_multi_tenant_lms.sql
 *
 * Each POST runs inside its own transaction and is recorded only if every
 * statement succeeds, so a failed migration leaves nothing behind. We stop on
 * the first failure: later migrations depend on earlier ones, and a half-built
 * schema is worse than none.
 *
 * The key is read from the environment on purpose. Do not hardcode it here —
 * this file is tracked, and the repo already has one credential committed by
 * accident (see deploy_direct.cjs).
 */
const fs = require('fs');
const path = require('path');

const BASE = process.env.INSFORGE_URL;
const KEY = process.env.INSFORGE_KEY;
const DIR = path.join(__dirname, 'migrations');

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const ONLY = args.find(a => a.endsWith('.sql'));

/**
 * Version numbers are the 14-digit YYYYMMDDHHmmss form. The migration already
 * applied is 20260704165051 and versions compare numerically, so the 8-digit
 * date in the filename would sort as older and be rejected.
 */
const ORDER = [
  ['20260811000000', 'baseline-core-tables',       '20260811_baseline_core_tables.sql'],
  ['20260812000000', 'multi-tenant-lms',           '20260812_multi_tenant_lms.sql'],
  ['20260828000000', 'monetization-subscriptions', '20260828_monetization_subscriptions.sql'],
  ['20260829000000', 'pricing-tiers-catalog',      '20260829_pricing_tiers_catalog.sql'],
  ['20260904000000', 'rls-hardening',              '20260904_rls_hardening.sql'],
  ['20260905000000', 'school-core',                '20260905_school_core.sql'],
  ['20260905010000', 'school-operations',          '20260905_school_operations.sql'],
  ['20260906000000', 'workflow-integrity',         '20260906_workflow_integrity.sql'],
  ['20260907000000', 'mentor-kyc',                 '20260907_mentor_kyc.sql'],
  ['20260908000000', 'institution-kyc',            '20260908_institution_kyc.sql'],
  ['20260913000000', 'logic-fixes',                '20260913_logic_fixes.sql'],
  ['20260914000000', 'core-schema-and-tenancy',    '20260914_core_schema_and_tenancy.sql']
];

if (!BASE || !KEY) {
  console.error('Set INSFORGE_URL and INSFORGE_KEY in the environment first.');
  process.exit(1);
}

(async () => {
  for (const [version, name, file] of ORDER) {
    if (ONLY && file !== ONLY) continue;

    const full = path.join(DIR, file);
    if (!fs.existsSync(full)) {
      console.error(`${file} — NOT FOUND, stopping.`);
      process.exit(1);
    }
    const sql = fs.readFileSync(full, 'utf8');

    if (DRY) {
      console.log(`${file.padEnd(42)} ${version}  ${sql.length} bytes`);
      continue;
    }

    process.stdout.write(`${file.padEnd(42)} `);

    let res, body;
    try {
      res = await fetch(`${BASE}/api/database/migrations`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ version, name, sql })
      });
      body = await res.text();
    } catch (e) {
      console.log('NETWORK ERROR');
      console.log('  ' + e.message);
      process.exit(1);
    }

    if (res.ok) {
      let n = '?';
      try { n = (JSON.parse(body).statements || []).length; } catch { /* keep '?' */ }
      console.log(`OK (${n} statements)`);
      continue;
    }

    // Already recorded. The API rejects any version at or below the newest
    // applied one, so on a resumed run every earlier file lands here. That is
    // success, not failure — skip it and carry on to the ones that are pending.
    if (res.status === 409) {
      console.log('SKIPPED (already applied)');
      continue;
    }

    console.log(`FAILED ${res.status}`);
    try {
      const j = JSON.parse(body);
      console.log('  error   : ' + j.error);
      console.log('  message : ' + j.message);
      if (j.nextActions) console.log('  next    : ' + j.nextActions);
    } catch {
      console.log('  ' + body.slice(0, 900));
    }
    console.log('\nStopped — later migrations depend on this one.');
    process.exit(1);
  }

  console.log(DRY ? '\nDry run only. Nothing was sent.' : '\nDone.');
})();
