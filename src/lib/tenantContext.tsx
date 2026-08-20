import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Tenant } from '../types';
import { tenantService, INITIAL_DEFAULT_TENANT } from './services/tenants';
import { getSubdomainFromWindow } from '../utils/tenant';

interface TenantContextType {
  tenant: Tenant;
  subdomain: string;
  loading: boolean;
  error: string | null;
  setTenant: (tenant: Tenant) => void;
  refreshTenant: () => Promise<void>;
  switchTenantBySubdomain: (subdomain: string) => Promise<void>;
}

const TenantContext = createContext<TenantContextType>({
  tenant: INITIAL_DEFAULT_TENANT,
  subdomain: 'app',
  loading: true,
  error: null,
  setTenant: () => {},
  refreshTenant: async () => {},
  switchTenantBySubdomain: async () => {}
});

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [subdomain, setSubdomain] = useState<string>('app');
  const [tenant, setTenant] = useState<Tenant>(INITIAL_DEFAULT_TENANT);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadTenant = async (detectedSubdomain: string) => {
    setLoading(true);
    setError(null);
    try {
      const resolvedTenant = await tenantService.getTenantBySubdomain(detectedSubdomain);
      setTenant(resolvedTenant);
      setSubdomain(resolvedTenant.subdomain);

      // Dynamically apply tenant primary color to document root
      if (resolvedTenant.primary_color) {
        document.documentElement.style.setProperty('--tenant-primary', resolvedTenant.primary_color);
      }
    } catch (err: any) {
      console.error('[TenantContext] Error loading tenant context:', err);
      setError(err?.message || 'Failed to load institution profile');
      setTenant(INITIAL_DEFAULT_TENANT);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const currentSubdomain = getSubdomainFromWindow();
    loadTenant(currentSubdomain);
  }, []);

  const refreshTenant = async () => {
    await loadTenant(subdomain);
  };

  const switchTenantBySubdomain = async (newSubdomain: string) => {
    await loadTenant(newSubdomain);
  };

  return (
    <TenantContext.Provider
      value={{
        tenant,
        subdomain,
        loading,
        error,
        setTenant,
        refreshTenant,
        switchTenantBySubdomain
      }}
    >
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
};
