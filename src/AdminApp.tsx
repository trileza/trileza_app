import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { LoadingOverlay } from './components/shared';
import type { AdminRole } from './types/admin';
import { hasAdminRole, isAdminRecordActive, getDefaultAdminRole } from './utils/adminAuth';

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

// Screen shown to a signed-in admin who lacks the role this console requires.
// Deliberately not a redirect to /signin — they are already authenticated, so
// bouncing them to the login form would loop instead of explaining anything.
const AccessDenied: React.FC<{ requiredRole?: AdminRole }> = ({ requiredRole }) => {
  const { logoutAdmin } = useAuthStore();
  const label = requiredRole ? requiredRole.replace(/_/g, ' ') : 'this console';

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-6 shadow-2xl">
        <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto text-3xl">
          ⛔
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-white uppercase">Access Denied</h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            Your account does not hold the <span className="font-bold text-slate-200 capitalize">{label}</span> role.
            This attempt has been recorded.
          </p>
        </div>
        <div className="space-y-2">
          <button
            onClick={() => { window.location.href = '/gate'; }}
            className="w-full h-12 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition-all"
          >
            Back to Gate
          </button>
          <button
            onClick={async () => { await logoutAdmin(); window.location.href = '/signin'; }}
            className="w-full h-12 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 font-bold transition-all"
          >
            Sign in as a different user
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Route guard for the admin consoles.
 *
 * Three conditions must all hold, in order:
 *   1. a validated admin session token exists (proves 2FA / gate sign-in),
 *   2. the admin_users record backing it is active (not suspended),
 *   3. that record grants `requiredRole` (super_admin satisfies any role).
 *
 * Being signed in to the main learner app grants nothing here.
 */
const ProtectedRoute: React.FC<{ children: React.ReactNode; requiredRole?: AdminRole }> = ({ children, requiredRole }) => {
  const { adminSessionToken, adminUser, loading, initialized } = useAuthStore();
  const location = useLocation();

  if (loading || !initialized) {
    return <LoadingOverlay message="Authorizing secure connection..." />;
  }

  // 1 + 2: an active admin session is required, not merely a platform login.
  const hasAdminSession = Boolean(adminSessionToken) && isAdminRecordActive(adminUser);

  if (!hasAdminSession) {
    return <Navigate to={requiredRole ? `/signin?role=${requiredRole}` : '/signin'} state={{ from: location }} replace />;
  }

  // 3: the session must actually carry the role this console demands.
  if (!hasAdminRole(adminUser, requiredRole)) {
    return <AccessDenied requiredRole={requiredRole} />;
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
  // From the router, not the global `location`, so client-side navigation
  // re-renders this component instead of relying on a parent to do it.
  const location = useLocation();

  useEffect(() => {
    if (!initialized) {
      initialize();
    }
  }, [initialized, initialize]);

  useEffect(() => {
    // Only roles the admin record actually grants; null when it grants none.
    setActiveRole(getDefaultAdminRole(adminUser));
  }, [adminUser]);

  const { showWarning, setShowWarning } = useInactivityTimer(logoutAdmin, !!adminSessionToken);

  if (loading && !initialized) {
    return <LoadingOverlay message="Initializing Secure Gate" submessage="Establishing encrypted handshake..." />;
  }

  const renderContent = () => {
    const p = location.pathname.toLowerCase();

    if (p.endsWith('/signin')) {
      return <GateLogin />;
    }
    if (p.endsWith('/signup')) {
      return <GateRegister />;
    }
    if (p.includes('/verify-2fa')) {
      return <GateVerify2FA />;
    }
    if (p.includes('/onboarding')) {
      return (
        <ProtectedRoute>
          <GateOnboarding />
        </ProtectedRoute>
      );
    }

    if (p === '/superadmin/admins' || p.endsWith('/superadmin/admins') || p.includes('/gate/superadmin/admins')) {
      return (
        <ProtectedRoute requiredRole="super_admin">
          <AdminLayout currentRole="super_admin" onRoleChange={setActiveRole}>
            <AdminManagement />
          </AdminLayout>
        </ProtectedRoute>
      );
    }

    if (p === '/superadmin/tenants' || p.endsWith('/superadmin/tenants') || p.includes('/gate/superadmin/tenants')) {
      return (
        <ProtectedRoute requiredRole="super_admin">
          <AdminLayout currentRole="super_admin" onRoleChange={setActiveRole}>
            <SuperAdminTenantsView />
          </AdminLayout>
        </ProtectedRoute>
      );
    }

    if (p.startsWith('/superadmin') || p.includes('/gate/superadmin')) {
      return (
        <ProtectedRoute requiredRole="super_admin">
          <AdminLayout currentRole="super_admin" onRoleChange={setActiveRole}>
            <SuperAdminDashboard />
          </AdminLayout>
        </ProtectedRoute>
      );
    }

    if (p.startsWith('/content-manager') || p.includes('content_manager')) {
      return (
        <ProtectedRoute requiredRole="content_manager">
          <AdminLayout currentRole="content_manager" onRoleChange={setActiveRole}>
            <ContentManagerDashboard />
          </AdminLayout>
        </ProtectedRoute>
      );
    }

    if (p.startsWith('/user-manager') || p.includes('user_manager')) {
      return (
        <ProtectedRoute requiredRole="user_manager">
          <AdminLayout currentRole="user_manager" onRoleChange={setActiveRole}>
            <UserManagerDashboard />
          </AdminLayout>
        </ProtectedRoute>
      );
    }

    if (p.startsWith('/finance-admin') || p.includes('finance_admin')) {
      return (
        <ProtectedRoute requiredRole="finance_admin">
          <AdminLayout currentRole="finance_admin" onRoleChange={setActiveRole}>
            <FinanceAdminDashboard />
          </AdminLayout>
        </ProtectedRoute>
      );
    }

    if (p.startsWith('/support-agent') || p.includes('support_agent')) {
      return (
        <ProtectedRoute requiredRole="support_agent">
          <AdminLayout currentRole="support_agent" onRoleChange={setActiveRole}>
            <SupportAgentDashboard />
          </AdminLayout>
        </ProtectedRoute>
      );
    }

    if (p.startsWith('/compliance-officer') || p.includes('compliance_officer')) {
      return (
        <ProtectedRoute requiredRole="compliance_officer">
          <AdminLayout currentRole="compliance_officer" onRoleChange={setActiveRole}>
            <ComplianceOfficerDashboard />
          </AdminLayout>
        </ProtectedRoute>
      );
    }

    if (p.startsWith('/analytics-viewer') || p.includes('analytics_viewer')) {
      return (
        <ProtectedRoute requiredRole="analytics_viewer">
          <AdminLayout currentRole="analytics_viewer" onRoleChange={setActiveRole}>
            <AnalyticsViewerDashboard />
          </AdminLayout>
        </ProtectedRoute>
      );
    }

    // Default to Gate Entry Page
    return <GateEntryPage />;
  };

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
        {renderContent()}
      </React.Suspense>
    </div>
  );
};

export default AdminApp;