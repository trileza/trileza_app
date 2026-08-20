import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { LoadingOverlay } from './components/shared';

// Pages
const GateLogin = React.lazy(() => import('./pages/admin/GateLogin'));
const GateVerify2FA = React.lazy(() => import('./pages/admin/GateVerify2FA'));
const GateRegister = React.lazy(() => import('./pages/admin/GateRegister'));
const GateOnboarding = React.lazy(() => import('./pages/admin/GateOnboarding'));
const AdminManagement = React.lazy(() => import('./pages/admin/AdminManagement'));
const SuperAdminTenantsView = React.lazy(() => import('./pages/admin/SuperAdminTenantsView'));
const GateEntryPage = React.lazy(() => import('./pages/admin/GateEntryPage'));

// Layout and Dashboards
const AdminLayout = React.lazy(() => import('./components/admin/AdminLayout'));
const SuperAdminDashboard = React.lazy(() => import('./components/admin/SuperAdminDashboard'));
const ContentManagerDashboard = React.lazy(() => import('./components/admin/ContentManagerDashboard'));
const UserManagerDashboard = React.lazy(() => import('./components/admin/UserManagerDashboard'));
const FinanceAdminDashboard = React.lazy(() => import('./components/admin/FinanceAdminDashboard'));
const SupportAgentDashboard = React.lazy(() => import('./components/admin/SupportAgentDashboard'));
const ComplianceOfficerDashboard = React.lazy(() => import('./components/admin/ComplianceOfficerDashboard'));
const AnalyticsViewerDashboard = React.lazy(() => import('./components/admin/AnalyticsViewerDashboard'));

// Inactivity Timer Hook
const useInactivityTimer = (logoutAdmin: () => void, hasToken: boolean) => {
  const [showWarning, setShowWarning] = React.useState(false);

  useEffect(() => {
    if (!hasToken) {
      setShowWarning(false);
      return;
    }

    let warningTimer: any;
    let logoutTimer: any;

    const resetTimers = () => {
      setShowWarning(false);
      clearTimeout(warningTimer);
      clearTimeout(logoutTimer);

      // Warning at 25 minutes of inactivity
      warningTimer = setTimeout(() => {
        setShowWarning(true);
      }, 25 * 60 * 1000);

      // Logout at 30 minutes of inactivity
      logoutTimer = setTimeout(() => {
        logoutAdmin();
        alert('Session Timeout: You have been logged out due to 30 minutes of inactivity.');
        window.location.href = '/signin';
      }, 30 * 60 * 1000);
    };

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    const handleActivity = () => {
      resetTimers();
    };

    resetTimers();

    events.forEach(e => window.addEventListener(e, handleActivity));

    return () => {
      clearTimeout(warningTimer);
      clearTimeout(logoutTimer);
      events.forEach(e => window.removeEventListener(e, handleActivity));
    };
  }, [hasToken, logoutAdmin]);

  return { showWarning, setShowWarning };
};

// Route Guard component
const ProtectedRoute: React.FC<{ children: React.ReactNode; requiredRole?: string }> = ({ children, requiredRole }) => {
  const { adminSessionToken, adminUser, loading } = useAuthStore();
  const location = useLocation();

  if (loading) {
    return <LoadingOverlay message="Authorizing secure connection..." />;
  }

  if (!adminSessionToken || !adminUser) {
    return <Navigate to={requiredRole ? `/signin?role=${requiredRole}` : '/signin'} state={{ from: location }} replace />;
  }

  // Enforce onboarding check
  if (!adminUser.onboarding_completed && location.pathname !== '/gate/onboarding') {
    return <Navigate to="/gate/onboarding" replace />;
  }

  // Enforce role permission
  const userRoles = adminUser.roles || (adminUser.role ? [adminUser.role] : []);
  const isSuperAdmin = userRoles.includes('super_admin');
  const hasAccess = isSuperAdmin || !requiredRole || userRoles.includes(requiredRole);

  if (!hasAccess) {
    // If not super admin and doesn't hold required role, redirect to apply
    return <Navigate to={`/signup?role=${requiredRole}`} replace />;
  }

  return <>{children}</>;
};

const AdminApp: React.FC = () => {
  const { 
    adminSessionToken, 
    adminUser, 
    logoutAdmin, 
    loading, 
    initialized, 
    initialize 
  } = useAuthStore();
  const [activeRole, setActiveRole] = React.useState<any>(null);

  useEffect(() => {
    if (!initialized) {
      initialize();
    }
  }, [initialized, initialize]);

  useEffect(() => {
    if (adminUser && adminUser.roles && adminUser.roles.length > 0) {
      if (adminUser.roles.includes('super_admin')) {
        setActiveRole('super_admin');
      } else {
        setActiveRole(adminUser.roles[0]);
      }
    } else if (adminUser && adminUser.role) {
      setActiveRole(adminUser.role);
    }
  }, [adminUser]);

  const { showWarning, setShowWarning } = useInactivityTimer(logoutAdmin, !!adminSessionToken);

  if (loading && !initialized) {
    return <LoadingOverlay message="Initializing Secure Gate" submessage="Establishing encrypted handshake..." />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 bg-gradient-to-br from-slate-100 via-slate-50 to-slate-200/90 transition-colors duration-300 relative">
      {/* Session Warning Banner/Modal */}
      {showWarning && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-6 shadow-2xl">
            <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-full flex items-center justify-center mx-auto text-3xl animate-pulse">
              ⏳
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white uppercase">Inactivity Warning</h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                Your session has been idle. You will be automatically logged out in 5 minutes to protect platform integrity.
              </p>
            </div>
            <button
              onClick={() => setShowWarning(false)}
              className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-600/20 transition-all"
            >
              Extend Session
            </button>
          </div>
        </div>
      )}

      <React.Suspense fallback={<LoadingOverlay message="Loading secure console..." />}>
        <Routes>
          {/* Public Gate Routes */}
          <Route path="/" element={<GateEntryPage />} />
          <Route path="/signin" element={<GateLogin />} />
          <Route path="/signup" element={<GateRegister />} />
          <Route path="/gate/verify-2fa" element={<GateVerify2FA />} />

          {/* Protected Gate Routes */}
          <Route 
            path="/gate/onboarding" 
            element={
              <ProtectedRoute>
                <GateOnboarding />
              </ProtectedRoute>
            } 
          />

          {/* Super Admin Dashboard routes */}
          <Route 
            path="/gate/superadmin" 
            element={
              <ProtectedRoute requiredRole="super_admin">
                <AdminLayout currentRole={activeRole || 'super_admin'} onRoleChange={setActiveRole}>
                  <SuperAdminDashboard />
                </AdminLayout>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/gate/superadmin/admins" 
            element={
              <ProtectedRoute requiredRole="super_admin">
                <AdminLayout currentRole={activeRole || 'super_admin'} onRoleChange={setActiveRole}>
                  <AdminManagement />
                </AdminLayout>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/gate/superadmin/tenants" 
            element={
              <ProtectedRoute requiredRole="super_admin">
                <AdminLayout currentRole={activeRole || 'super_admin'} onRoleChange={setActiveRole}>
                  <SuperAdminTenantsView />
                </AdminLayout>
              </ProtectedRoute>
            } 
          />

          {/* Role-specific dashboards */}
          <Route 
            path="/content-manager" 
            element={
              <ProtectedRoute requiredRole="content_manager">
                <AdminLayout currentRole={activeRole || 'content_manager'} onRoleChange={setActiveRole}>
                  <ContentManagerDashboard />
                </AdminLayout>
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/user-manager" 
            element={
              <ProtectedRoute requiredRole="user_manager">
                <AdminLayout currentRole={activeRole || 'user_manager'} onRoleChange={setActiveRole}>
                  <UserManagerDashboard />
                </AdminLayout>
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/finance-admin" 
            element={
              <ProtectedRoute requiredRole="finance_admin">
                <AdminLayout currentRole={activeRole || 'finance_admin'} onRoleChange={setActiveRole}>
                  <FinanceAdminDashboard />
                </AdminLayout>
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/support-agent" 
            element={
              <ProtectedRoute requiredRole="support_agent">
                <AdminLayout currentRole={activeRole || 'support_agent'} onRoleChange={setActiveRole}>
                  <SupportAgentDashboard />
                </AdminLayout>
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/compliance-officer" 
            element={
              <ProtectedRoute requiredRole="compliance_officer">
                <AdminLayout currentRole={activeRole || 'compliance_officer'} onRoleChange={setActiveRole}>
                  <ComplianceOfficerDashboard />
                </AdminLayout>
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/analytics-viewer" 
            element={
              <ProtectedRoute requiredRole="analytics_viewer">
                <AdminLayout currentRole={activeRole || 'analytics_viewer'} onRoleChange={setActiveRole}>
                  <AnalyticsViewerDashboard />
                </AdminLayout>
              </ProtectedRoute>
            } 
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </React.Suspense>
    </div>
  );
};

export default AdminApp;