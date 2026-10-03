#!/usr/bin/env node
/**
 * Bootstraps the first super administrator.
 *
 * A platform with no administrators cannot appoint one: the only routes into
 * admin_users are an invitation issued by a super admin, or a self-service
 * request that a super admin must approve. Both need an administrator to
 * already exist. This script breaks that circle, once.
 *
 * It mints an invitation, not a password. Nothing here sets a credential, and
 * no credential is written to the repository, to the client bundle, or to this
 * file. The invitee signs up with their own password, through the normal Gate
 * flow, and the invitation is what grants the role. If the link leaks it
 * expires; if a password leaked it would not.
 *
 * The token is printed once, to this terminal, and never stored anywhere this
 * script can read back. Re-running issues a fresh token and invalidates the
 * previous one.
 *
 * Usage:
 *   node scripts/seed-super-admin.cjs trilezaltd@gmail.com
 *
 * Credentials come from .insforge/project.json, which is gitignored.
 */

const fs = require('fs');
const path = require('path');

const PROJECT_FILE = path.join(__dirname, '..', '.insforge', 'project.json');

function die(message) {
  console.error(`\n  ✗ ${message}\n`);
  process.exit(1);
}

function loadProject() {
  if (!fs.existsSync(PROJECT_FILE)) {
    die('No .insforge/project.json found. Run this from the repository root.');
  }
  const p = JSON.parse(fs.readFileSync(PROJECT_FILE, 'utf8'));
  if (!p.api_key || !p.oss_host) {
    die('.insforge/project.json is missing api_key or oss_host.');
  }
  return p;
}

async function rpc(project, fn, body) {
  const res = await fetch(`${project.oss_host}/api/database/rpc/${fn}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${project.api_key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }

  if (!res.ok) {
    die(`${fn} failed (${res.status}): ${typeof parsed === 'string' ? parsed : parsed.message || text}`);
  }
  return parsed;
}

async function main() {
  const email = (process.argv[2] || '').trim().toLowerCase();

  if (!email || !email.includes('@')) {
    die('Usage: node scripts/seed-super-admin.cjs <email>');
  }

  const project = loadProject();

  console.log(`\n  Project : ${project.project_name || project.appkey}`);
  console.log(`  Invitee : ${email}\n`);

  // Report, but do not refuse. Re-issuing an invitation is a legitimate thing
  // to do — a link expires, or is lost — and issue_admin_invite rotates the
  // token rather than creating a second live one.
  const existing = await rpc(project, 'admin_count_active', {}).catch(() => null);
  if (Array.isArray(existing) && existing.length && existing[0].count > 0) {
    console.log(`  Note: this project already has ${existing[0].count} active administrator(s).`);
    console.log('  Issuing another invitation anyway.\n');
  }

  const result = await rpc(project, 'issue_admin_invite', {
    p_email: email,
    p_roles: ['super_admin'],
    p_days: 7
  });

  const row = Array.isArray(result) ? result[0] : result;
  if (!row || !row.token) {
    die('The invitation was not returned. Nothing has been changed.');
  }

  const base = process.env.SITE_URL || 'https://trileza-app.pages.dev';
  const link = `${base}/gate/accept-invite?token=${row.token}`;

  console.log('  ─────────────────────────────────────────────────────────────');
  console.log('   Invitation created. This token is shown once.');
  console.log('  ─────────────────────────────────────────────────────────────\n');
  console.log(`   ${link}\n`);
  console.log(`   Expires : ${new Date(row.expires_at).toUTCString()}`);
  console.log('   Role    : super_admin\n');
  console.log('   Give this link to the invitee over a channel you trust.');
  console.log('   Anyone holding it can become a super administrator, so treat');
  console.log('   it as a password: do not paste it into chat, email or a');
  console.log('   ticket. If it is seen by anyone else, re-run this script —');
  console.log('   that issues a new token and invalidates this one.\n');
  console.log('   The invitee signs in or registers with their own password,');
  console.log('   then completes 2FA enrolment during Gate onboarding.\n');
}

main().catch(err => die(err.message || String(err)));
