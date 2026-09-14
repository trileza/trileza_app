import type { AdminRole } from '../types/admin';

/**
 * Admin authorization helpers.
 *
 * The admin console is a separate SPA served from the same bundle, so the only
 * thing standing between a signed-in learner and the Super Admin deck is the
 * check performed here. Being an authenticated *platform* user is not enough:
 * the caller must hold a validated admin session AND the specific role the
 * console requires.
 */

export const ALL_ADMIN_ROLES: AdminRole[] = [
  'super_admin',
  'content_manager',
  'user_manager',
  'finance_admin',
  'support_agent',
  'compliance_officer',
  'analytics_viewer'
];

const isAdminRole = (value: unknown): value is AdminRole =>
  typeof value === 'string' && (ALL_ADMIN_ROLES as string[]).includes(value);

/**
 * True when the admin record is usable — present, not suspended, and not
 * explicitly deactivated. `status` is the newer column; `suspended` is the
 * older boolean. Both are honoured so neither schema version fails open.
 */
export const isAdminRecordActive = (adminUser: any): boolean => {
  if (!adminUser) return false;
  if (adminUser.suspended === true) return false;
  if (typeof adminUser.status === 'string' && adminUser.status !== 'active') return false;
  return true;
};

/**
 * The roles an admin record actually grants. Reads the `roles` array first and
 * falls back to the legacy single `role` column. Anything unrecognised is
 * dropped rather than trusted.
 */
export const getGrantedAdminRoles = (adminUser: any): AdminRole[] => {
  if (!isAdminRecordActive(adminUser)) return [];

  const raw: unknown[] = Array.isArray(adminUser.roles)
    ? adminUser.roles
    : adminUser.role
      ? [adminUser.role]
      : [];

  return Array.from(new Set(raw.filter(isAdminRole)));
};

/**
 * Whether the admin may enter a console. `super_admin` is the root supervisor
 * and reaches every console; every other role reaches only its own.
 */
export const hasAdminRole = (adminUser: any, requiredRole?: AdminRole): boolean => {
  const granted = getGrantedAdminRoles(adminUser);
  if (granted.length === 0) return false;
  if (!requiredRole) return true;
  if (granted.includes('super_admin')) return true;
  return granted.includes(requiredRole);
};

/**
 * The console a given admin should land on when no specific one was requested.
 */
export const getDefaultAdminRole = (adminUser: any): AdminRole | null => {
  const granted = getGrantedAdminRoles(adminUser);
  if (granted.length === 0) return null;
  return granted.includes('super_admin') ? 'super_admin' : granted[0];
};
