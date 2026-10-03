# The admin console

The administrative console is a **separate single-page application** from the
learner app. It shares the codebase but builds and deploys on its own, which is
why `npm run build` and `npm run build:admin` exist side by side.

It is reached by hostname or path — `admin.*`, `/gate`, `/signin`, `/signup`,
a role path such as `/content-manager`, or `?env=admin`. `src/App.tsx` detects
this and hands the whole tree to `src/AdminApp.tsx`.

---

## Getting the first administrator

A platform with no administrators cannot appoint one. The only routes into
`admin_users` are an invitation issued by a super admin, or a self-service
request a super admin must approve — both need an administrator to already
exist. One script breaks that circle:

```bash
node scripts/seed-super-admin.cjs someone@example.com
```

It prints an invitation link **once**. It does not set a password, and no
credential is written to the repository, the bundle or any file the script can
read back. The invitee signs up with their own password through the normal Gate
flow; the invitation is what grants the role.

The token is a bearer credential: anyone holding the link can become a super
administrator. Send it over a channel you trust, never in chat or a ticket. If
it is seen by anyone else, re-run the script — that rotates the token and
invalidates the old link.

Links expire after seven days. A lapsed invitation is swept to `expired` by
`expire_stale_admin_invites()`.

---

## Roles

Seven roles, stored as an array on `admin_users.roles`. An administrator may
hold several; `super_admin` satisfies every check.

| Role | Responsible for |
|---|---|
| `super_admin` | Everything, including appointing other administrators |
| `content_manager` | Reviewing books and courses before publication |
| `user_manager` | Accounts: viewing, suspending, removing |
| `finance_admin` | Payouts, refunds, transactions |
| `support_agent` | Support tickets |
| `compliance_officer` | KYC, flagged content, the audit trail |
| `analytics_viewer` | Read-only figures |

### Permission matrix

| Area | super | content | user | finance | support | compliance | analytics |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| Review books / courses | ● | ● | | | | | |
| View users | ● | | ● | | ● | ● | |
| Suspend / delete users | ● | | ● | | | | |
| Payouts, refunds | ● | | | ● | | | |
| Support tickets | ● | | | | ● | | |
| KYC, flagged content | ● | | | | | ● | |
| Analytics | ● | ● | ● | ● | ● | ● | ● |
| Invite admins, assign roles | ● | | | | | | |
| Audit log | ● | | | | | ● | |

---

## How access is actually enforced

**In the database, not in the interface.** Hiding a button is a courtesy to the
user, not a security control — an administrator who edits the page, or calls
the API directly, meets the same rules either way.

- `has_admin_role(required_role)` is the single source of truth. It is used in
  **48 row-level security policies**.
- Nine `admin_*` functions perform privileged writes as `SECURITY DEFINER`,
  each checking the caller's role inside the function body.
- `admin_audit_logs` records privileged actions. The acting administrator is
  stamped by a trigger from the session, so a client cannot attribute an action
  to someone else.

The console's own route guard (`ProtectedRoute` in `AdminApp.tsx`) checks three
things in order: a session exists, an `admin_users` record exists for it, and
that record grants the role the section requires. It is a convenience, so
people see a clear "you do not have this role" screen instead of an empty
dashboard. It is not what keeps anyone out.

---

## Sessions

- Two-factor authentication, with backup codes.
- `failed_attempts` and `lockout_until` on `admin_users`.
- An inactivity timer (`useInactivityTimer`) warns, then signs the admin out.
- Onboarding is forced on first sign-in: `onboarded` stays false until the
  admin completes it, including 2FA enrolment.

---

## Working in parallel

Several staff can work at once. Roles are independent, and each dashboard reads
and writes its own tables, so a content manager clearing the book queue does
not block a finance admin approving payouts.

Each section is wrapped in its own error boundary **inside** the layout, so a
section that fails leaves the sidebar, the role switcher and every other
section usable.

---

## Layout of the code

```
src/
  AdminApp.tsx                   routing, guard, role resolution
  components/admin/
    AdminLayout.tsx              sidebar, topbar, error boundary
    AdminErrorBoundary.tsx
    *Dashboard.tsx               one per role
    shared/                      ConfirmDialog, Pagination, StatusTabs,
                                 ExportToolbar, FileViewer, UserProfileModal
  pages/admin/
    Gate*.tsx                    sign-in, registration, 2FA, invitation,
                                 onboarding
    AdminManagement.tsx          inviting and managing administrators
  lib/services/admin.ts          every admin read and write
  types/admin.ts                 AdminRole and the record shapes
```

---

## Known gaps

Recorded honestly, rather than left to be discovered:

- **Lint.** 193 errors across the admin surface, mostly `no-explicit-any` and
  unused variables. None causes a runtime fault today. Typechecking and both
  builds pass.
- **File size.** `UserManagerDashboard` (1,852 lines) and
  `ContentManagerDashboard` (1,717) are large enough to be hard to change
  safely, and would benefit from being split by feature.
- **Loading and empty states** are inconsistent between dashboards.
- **No reporting service.** The error boundary logs to the console only.
  Wiring it to a service that does not exist would be worse — it would look
  handled.
