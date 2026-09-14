export const ROLE_SLUGS: Record<string, string> = {
  super_admin: 'superadmin',
  content_manager: 'content-manager',
  user_manager: 'user-manager',
  finance_admin: 'finance-admin',
  support_agent: 'support-agent',
  compliance_officer: 'compliance-officer',
  analytics_viewer: 'analytics-viewer'
};

export const getAdminRedirectPath = (adminUser: any, requestedRole: string | null): string => {
  if (!adminUser) return '/signin';
  
  const rolesList = adminUser.roles || [];
  
  // If a specific role was requested
  if (requestedRole) {
    if (rolesList.includes(requestedRole)) {
      const slug = ROLE_SLUGS[requestedRole] || requestedRole;
      return `/${slug}`;
    }
    // Doesn't have this role: redirect to apply
    return `/signup?role=${requestedRole}`;
  }
  
  // Fallback defaults
  if (rolesList.includes('super_admin')) {
    return '/superadmin';
  }
  if (rolesList.length > 0) {
    const firstRole = rolesList[0];
    return `/${ROLE_SLUGS[firstRole] || firstRole}`;
  }
  
  return '/superadmin';
};
