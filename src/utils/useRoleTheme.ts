import { useEffect } from 'react';
import { useAuthStore, resolveActiveRole } from '../store/authStore';

/**
 * Applies the active role's accent colour to the document.
 *
 * Every dashboard shares the green system; a role differs only by its accent —
 * the 10% in the 60-30-10 split. Rather than each dashboard hardcoding a hue,
 * this stamps `data-role` on <html> and the CSS in index.css resolves
 * `--role-accent` from it. Adding a role means adding one CSS block, not
 * touching any component.
 *
 * Admin consoles pass an explicit role because their console is chosen by
 * route, not by the signed-in user's own role.
 */
export const useRoleTheme = (explicitRole?: string | null) => {
  const { user, activeRole } = useAuthStore();

  useEffect(() => {
    const role = explicitRole || activeRole || resolveActiveRole(user) || '';
    const root = document.documentElement;

    if (role) {
      root.setAttribute('data-role', role.toLowerCase());
    } else {
      root.removeAttribute('data-role');
    }

    // Not cleaned up on unmount: the attribute should persist across a route
    // change within the same role, and the next caller overwrites it. Removing
    // it here would flash the default accent between pages.
  }, [explicitRole, activeRole, user]);
};

/** The accent for a role, for the rare case a value is needed in JS. */
export const ROLE_ACCENTS: Record<string, string> = {
  super_admin: '#D4A017',
  management: '#1E6FD9',
  staff: '#1E6FD9',
  finance_admin: '#0E8C86',
  mentor: '#7C4DBE',
  tutor: '#7C4DBE',
  mentee: '#E07B39',
  content_manager: '#C2410C',
  user_manager: '#0F766E',
  support_agent: '#0E7490',
  compliance_officer: '#7E22CE',
  analytics_viewer: '#475569',
  guardian: '#BE185D'
};

export default useRoleTheme;
