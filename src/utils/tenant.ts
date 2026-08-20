/**
 * Tenant Subdomain & Domain Resolution Utilities
 * Handles extracting tenant subdomain from window.location.hostname
 * or fallback query parameters (`?tenant=oxford`) for dev testing.
 */

export const DEFAULT_TENANT_ID = 'default-tenant';
export const DEFAULT_SUBDOMAIN = 'app';

/**
 * Extracts subdomain or custom domain identifier from current window location.
 * Examples:
 *   - "oxford.trileza.com" -> "oxford"
 *   - "stanford.localhost:5173" -> "stanford"
 *   - "localhost:5173?tenant=mit" -> "mit"
 *   - "trileza.com" -> "app" (default)
 */
export function getSubdomainFromWindow(): string {
  if (typeof window === 'undefined') return DEFAULT_SUBDOMAIN;

  const urlParams = new URLSearchParams(window.location.search);
  const queryTenant = urlParams.get('tenant');
  if (queryTenant && queryTenant.trim() !== '') {
    return queryTenant.trim().toLowerCase();
  }

  const hostname = window.location.hostname;

  // Handle IP addresses or localhost directly without subdomains
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return DEFAULT_SUBDOMAIN;
  }

  const parts = hostname.split('.');

  // e.g. "mit.localhost" -> "mit"
  if (parts.length >= 2 && parts[parts.length - 1] === 'localhost') {
    return parts[0].toLowerCase();
  }

  // e.g. "oxford.trileza.com" or "oxford.netlify.app" -> "oxford"
  if (parts.length >= 3) {
    const candidate = parts[0].toLowerCase();
    if (candidate !== 'www' && candidate !== 'api' && candidate !== 'app') {
      return candidate;
    }
  }

  return DEFAULT_SUBDOMAIN;
}

/**
 * Validates a proposed subdomain slug for registration
 */
export function isValidSubdomain(slug: string): boolean {
  if (!slug || slug.length < 3 || slug.length > 30) return false;
  const regex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  return regex.test(slug.toLowerCase()) && !['admin', 'www', 'api', 'app', 'system', 'root'].includes(slug.toLowerCase());
}

/**
 * Formats full tenant hostname
 */
export function buildTenantUrl(subdomain: string): string {
  if (typeof window === 'undefined') return `https://${subdomain}.trileza.com`;
  const port = window.location.port ? `:${window.location.port}` : '';
  const protocol = window.location.protocol;
  const host = window.location.hostname;

  if (host.includes('localhost')) {
    return `${protocol}//${subdomain}.localhost${port}`;
  }

  const parts = host.split('.');
  if (parts.length >= 2) {
    const rootDomain = parts.slice(-2).join('.');
    return `${protocol}//${subdomain}.${rootDomain}${port}`;
  }

  return `${protocol}//${subdomain}.trileza.com`;
}
