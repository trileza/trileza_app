import React from 'react';
import { InstitutionalDashboard } from './InstitutionalDashboard';

export const TenantAdminDashboard: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <InstitutionalDashboard />
      </div>
    </div>
  );
};

export default TenantAdminDashboard;
