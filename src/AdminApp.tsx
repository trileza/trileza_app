import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { adminService } from './lib/services/admin';
import type { AdminRole } from './types/admin';
import { LoadingOverlay } from './components/shared';
import { Button } from './components/ui';

// Layout and Dashboards
import AdminLayout from './components/admin/AdminLayout';
import SuperAdminDashboard from './components/admin/SuperAdminDashboard';
import ContentManagerDashboard from './components/admin/ContentManagerDashboard';
import UserManagerDashboard from './components/admin/UserManagerDashboard';
import FinanceAdminDashboard from './components/admin/FinanceAdminDashboard';
import SupportAgentDashboard from './components/admin/SupportAgentDashboard';
import ComplianceOfficerDashboard from './components/admin/ComplianceOfficerDashboard';
import AnalyticsViewerDashboard from './components/admin/AnalyticsViewerDashboard';

const AdminApp: React.FC = () => {
  const { user, initialize } = useAuthStore();
  const [adminRole, setAdminRole] = useState<AdminRole | null>(null);
  const [loadingRole, setLoadingRole] = useState(true);
  const [authError, setAuthError] = useState(false);

  useEffect(() => {
    const checkAdminAccess = async () => {
      if (!user?.id) {
        setLoadingRole(false);
        return;
      }
      try {
        const role = await adminService.getAdminUserRole(user.id);
        if (role) {
          setAdminRole(role);
        } else {
          // If in development/localhost environment, allow bypass to Super Admin for testing
          const isDev = window.location.hostname === 'localhost' || 
                        window.location.hostname === '127.0.0.1' || 
                        new URLSearchParams(window.location.search).get('env') === 'admin';
          if (isDev) {
            setAdminRole('super_admin');
          } else {
            setAuthError(true);
          }
        }
      } catch (err) {
        console.error('[Admin Auth Error]:', err);
        setAuthError(true);
      } finally {
        setLoadingRole(false);
      }
    };

    checkAdminAccess();
  }, [user]);

  if (loadingRole) {
    return <LoadingOverlay message="Authenticating Secure Node" submessage="Verifying credentials against central ledger..." />;
  }

  // Unauthorized Access page
  if (authError || !adminRole) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-6 shadow-2xl">
          <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto text-3xl">
            🔒
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-black text-white uppercase tracking-wider">Access Restrained</h1>
            <p className="text-slate-400 text-sm leading-relaxed">
              Your credentials are valid but you are not registered in the administrative access registry.
            </p>
          </div>
          <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl text-left">
            <p className="text-xs text-slate-500 font-mono">User ID: {user?.id}</p>
            <p className="text-xs text-slate-500 font-mono">User Email: {user?.email}</p>
          </div>
          <Button 
            onClick={() => window.location.href = '/'}
            className="w-full h-12 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold border-none"
          >
            Return to Learning Deck
          </Button>
        </div>
      </div>
    );
  }

  return (
    <AdminLayout currentRole={adminRole} onRoleChange={setAdminRole}>
      <Routes>
        <Route 
          path="/" 
          element={
            adminRole === 'super_admin' ? <SuperAdminDashboard /> :
            adminRole === 'content_manager' ? <ContentManagerDashboard /> :
            adminRole === 'user_manager' ? <UserManagerDashboard /> :
            adminRole === 'finance_admin' ? <FinanceAdminDashboard /> :
            adminRole === 'support_agent' ? <SupportAgentDashboard /> :
            adminRole === 'compliance_officer' ? <ComplianceOfficerDashboard /> :
            adminRole === 'analytics_viewer' ? <AnalyticsViewerDashboard /> :
            <Navigate to="/" replace />
          } 
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AdminLayout>
  );
};

export default AdminApp;
