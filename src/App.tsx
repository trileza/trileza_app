import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore, resolveActiveRole } from './store/authStore';
import { nexus } from './lib/nexus';
import { useMeetingStore } from './store/meetingStore';
import { liveService } from './lib/services/live';
import { useSettingsStore } from './store/settingsStore';
import { initCapacitorNative, setNativeStatusBar, registerAndroidBackButton } from './lib/native/capacitor';

// Layouts
import DashboardLayout from './components/layout/DashboardLayout';
import { Button } from './components/ui';
import { LoadingOverlay } from './components/shared';

// Meeting Overlay (persists across sidebar navigation)
import MeetingOverlay from './components/live/MeetingOverlay';

// Primary Navigation Pages (Eagerly loaded for instant sub-50ms tab switching)
import StudentDashboard from './pages/student/Dashboard';
import TutorDashboard from './pages/tutor/Dashboard';
import PublicLibrary from './pages/shared/PublicLibrary';
import Courses from './pages/shared/Courses';
import Community from './pages/shared/Community';
import Messages from './pages/shared/Messages';
import Settings from './pages/shared/Settings';
import Wallet from './pages/shared/Wallet';
import Assignments from './pages/shared/Assignments';

// Core Auth & Onboarding Pages (Eagerly loaded for instant post-login transitions)
import LoginPage from './pages/auth/LoginPage';
import MenteeOnboarding from './pages/student/MenteeOnboarding';
import Onboarding from './pages/mentor/Onboarding';

const ManagementDashboard = React.lazy(() => import('./pages/management/Dashboard'));
const ManagementAnalytics = React.lazy(() => import('./pages/management/Analytics'));
const AuditDetail = React.lazy(() => import('./pages/management/AuditDetail'));
const StudentAudit = React.lazy(() => import('./pages/tutor/StudentAudit'));
const CourseBuilder = React.lazy(() => import('./pages/tutor/CourseBuilder'));
const CourseViewer = React.lazy(() => import('./pages/student/CourseViewer'));
const AssessmentEngine = React.lazy(() => import('./pages/shared/AssessmentEngine'));
const LiveStudio = React.lazy(() => import('./pages/shared/LiveStudio'));
const LiveClassroom = React.lazy(() => import('./pages/shared/LiveClassroom'));
const Mentorship = React.lazy(() => import('./pages/shared/Mentorship'));
const Portfolio = React.lazy(() => import('./pages/shared/Portfolio'));
const MentorshipAssessment = React.lazy(() => import('./pages/shared/MentorshipAssessment'));
const BookDetail = React.lazy(() => import('./pages/shared/BookDetail'));
const Vault = React.lazy(() => import('./pages/mentor/Vault'));
const Diagnostics = React.lazy(() => import('./pages/mentor/Diagnostics'));
const EditProfile = React.lazy(() => import('./pages/shared/EditProfile'));
const AuthorApplication = React.lazy(() => import('./pages/shared/AuthorApplication'));
const AuthorDashboard = React.lazy(() => import('./pages/shared/AuthorDashboard'));
const Feeds = React.lazy(() => import('./pages/shared/Feeds'));
const InstitutionalRegister = React.lazy(() => import('./pages/auth/InstitutionalRegister'));
const TenantAdminDashboard = React.lazy(() => import('./pages/admin/TenantAdminDashboard'));
const InstitutionDirectory = React.lazy(() => import('./pages/shared/InstitutionDirectory'));
const InstitutionDetail = React.lazy(() => import('./pages/shared/InstitutionDetail'));
const AdminApp = React.lazy(() => import('./AdminApp'));

const App: React.FC = () => {

  const { user, activeRole, loading, initialized, initialize } = useAuthStore();
  const navigate = useNavigate();

  // Initialize Nexus auth session and Capacitor native listeners on app mount
  useEffect(() => {
    initialize();
    initCapacitorNative();
  }, [initialize]);

  // Register Android hardware back button handler
  useEffect(() => {
    const unregister = registerAndroidBackButton(() => {
      if (window.history.length > 1) {
        navigate(-1);
      }
    });
    return () => unregister();
  }, [navigate]);

  // ── Auto-Remove Scheduled Meeting (No Show) & Reminders ──
  useEffect(() => {
    if (!user) return;

    const performNoShowCleanups = async () => {
      try {
        const sessions = await liveService.getCourseSessions('global');
        if (!sessions) return;

        const now = Date.now();
        const addToast = useMeetingStore.getState().addToast;

        for (const session of sessions) {
          if (session.status === 'scheduled') {
            const scheduledTime = new Date(session.scheduled_at).getTime();
            const elapsedMs = now - scheduledTime;

            // 1. If 1 hour passed and not started, delete the session
            if (elapsedMs >= 60 * 60 * 1000) {
              console.log(`[Auto-Remove] Session ${session.id} ("${session.title}") auto-removed due to no-show.`);
              await liveService.deleteSession(session.id);
            }
            // 2. If 30 minutes passed and user is the host, show a reminder
            else if (elapsedMs >= 30 * 60 * 1000) {
              if (session.tutor_id === user.id) {
                const reminderKey = `trileza_no_show_reminder_${session.id}`;
                if (!localStorage.getItem(reminderKey)) {
                  localStorage.setItem(reminderKey, 'true');
                  addToast(`Your scheduled meeting "${session.title}" will be removed in 30 minutes if not started.`, 'warning');
                }
              }
            }
          }
        }
      } catch (err) {
        console.error('[Auto-Remove] Error during session cleanup:', err);
      }
    };

    const delayTimer = setTimeout(performNoShowCleanups, 3000);
    const interval = setInterval(performNoShowCleanups, 60000);
    return () => {
      clearTimeout(delayTimer);
      clearInterval(interval);
    };
  }, [user]);

  const { loadSettings, applySettings, theme } = useSettingsStore();

  // Load settings on boot or when user changes
  useEffect(() => {
    loadSettings();
  }, [user, loadSettings]);

  // Synchronize dark theme class with system preferences or battery saver and Native Status Bar
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const checkTheme = () => {
      applySettings();
      const isDark = theme === 'dark' || (theme === 'system' && mediaQuery.matches);
      setNativeStatusBar(isDark);
    };
    checkTheme();
    mediaQuery.addEventListener('change', checkTheme);
    return () => mediaQuery.removeEventListener('change', checkTheme);
  }, [theme, applySettings]);



  // If logged in and URL has ?env=admin, redirect to /admin path for a cleaner URL and experience
  useEffect(() => {
    if (user && new URLSearchParams(window.location.search).get('env') === 'admin') {
      window.location.href = '/admin';
    }
  }, [user]);

  // Real-time synchronization subscription for admin actions (suspension, role upgrades)
  useEffect(() => {
    if (!user?.id) return;

    let subscribed = false;
    const channelName = `user:${user.id}`;

    const handleProfileUpdated = (payload: any) => {
      console.log('[Realtime] Profile updated event received:', payload);
      const metadata = payload.metadata || {};
      
      if (metadata.suspended === true) {
        useAuthStore.getState().logout();
        window.location.href = `/login?suspended=true&reason=${encodeURIComponent(metadata.suspension_reason || 'N/A')}`;
        return;
      }

      const store = useAuthStore.getState();
      const isSwitching = store._isSwitchingRole || (Date.now() - store._lastRoleSwitchAt < 6000);

      // Update local store with the new role and metadata, strictly preserving local activeRole during role switch
      useAuthStore.setState((state) => {
        let currentActiveRole = isSwitching ? state.activeRole : (state.activeRole || resolveActiveRole(state.user));
        
        // Validate if mentor status is still active
        const hasMentorStatus = metadata.mentor_onboarded === true || state.user?.metadata?.mentor_onboarded === true || payload.role === 'mentor' || payload.role === 'tutor';
        if (currentActiveRole === 'mentor' && !hasMentorStatus) {
          currentActiveRole = 'mentee';
        }

        const mergedMetadata = {
          ...state.user?.metadata,
          ...metadata,
          active_role: currentActiveRole
        };

        return {
          user: state.user ? {
            ...state.user,
            role: payload.role || state.user.role,
            metadata: mergedMetadata
          } : null,
          activeRole: currentActiveRole
        };
      });
    };

    const startSubscription = async () => {
      try {
        await nexus.realtime.connect();
        const res = await nexus.realtime.subscribe(channelName);
        if (res.ok) {
          subscribed = true;
          nexus.realtime.on('profile_updated', handleProfileUpdated);
          console.log(`[Realtime] Subscribed to channel: ${channelName}`);
        } else {
          console.error('[Realtime] Failed to subscribe:', (res as any).error);
        }
      } catch (err) {
        console.error('[Realtime] Connection error:', err);
      }
    };

    startSubscription();

    // Deep sync fallback (window focus, visibility state, and periodic polling)
    const triggerSync = () => {
      useAuthStore.getState().syncProfile();
    };

    window.addEventListener('focus', triggerSync);
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        triggerSync();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const intervalId = setInterval(triggerSync, 60000);

    return () => {
      if (subscribed) {
        nexus.realtime.off('profile_updated', handleProfileUpdated);
        nexus.realtime.unsubscribe(channelName);
        console.log(`[Realtime] Unsubscribed from channel: ${channelName}`);
      }
      window.removeEventListener('focus', triggerSync);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(intervalId);
    };
  }, [user?.id]);

  // Show loading spinner while checking initial session
  if (!initialized) {
    return <LoadingOverlay />;
  }

  // Subdomain / query parameter detection for Admin Portal
  // Subdomain / query parameter / path detection for Admin Portal
  const isAdminSubdomain = 
    window.location.hostname.startsWith('admin') || 
    window.location.pathname.startsWith('/gate') ||
    window.location.pathname.startsWith('/signin') ||
    window.location.pathname.startsWith('/signup') ||
    window.location.pathname.startsWith('/content-manager') ||
    window.location.pathname.startsWith('/user-manager') ||
    window.location.pathname.startsWith('/finance-admin') ||
    window.location.pathname.startsWith('/support-agent') ||
    window.location.pathname.startsWith('/compliance-officer') ||
    window.location.pathname.startsWith('/analytics-viewer') ||
    new URLSearchParams(window.location.search).get('env') === 'admin';

  if (isAdminSubdomain) {
    return <AdminApp />;
  }

  const location = useLocation();
  const derivedRole = (activeRole || resolveActiveRole(user) || 'mentee').toLowerCase();
  const isMentee = derivedRole === 'mentee';
  const isMenteeOnboarded = user?.metadata?.mentee_onboarded === true;
  const isMentor = derivedRole === 'mentor' || derivedRole === 'tutor';
  const isMentorOnboarded = user?.metadata?.mentor_onboarded === true;

  // Onboarding Gates
  if (user) {
    if (isMentee && !isMenteeOnboarded && location.pathname !== '/mentee/onboarding') {
      return <Navigate to="/mentee/onboarding" replace />;
    }
    if (isMentor && !isMentorOnboarded && location.pathname !== '/mentor/onboarding') {
      return <Navigate to="/mentor/onboarding" replace />;
    }
  }

  return (
    <React.Suspense fallback={<LoadingOverlay />}>
      {!user ? (
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signin" element={<LoginPage />} />
          <Route path="/institution-signup" element={<InstitutionalRegister />} />
          <Route path="/institution/signup" element={<InstitutionalRegister />} />
          <Route path="/institutions" element={<InstitutionDirectory />} />
          <Route path="/institutions/:institutionId" element={<InstitutionDetail />} />
          <Route path="/courses" element={<Courses />} />
          <Route path="/tenant-admin/:subdomain?" element={<TenantAdminDashboard />} />
          <Route path="/admin/*" element={<AdminApp />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      ) : (
        <>
          {/* Meeting Overlay — renders outside routes so it persists across navigation */}
          <MeetingOverlay />

          <Routes>
            {/* Multi-Tenant Institutional Routes */}
            <Route path="/institution-signup" element={<InstitutionalRegister />} />
            <Route path="/institution/signup" element={<InstitutionalRegister />} />
            <Route path="/institutions" element={<InstitutionDirectory />} />
            <Route path="/institutions/:institutionId" element={<InstitutionDetail />} />
            <Route path="/tenant-admin/:subdomain?" element={<TenantAdminDashboard />} />

            {/* Admin Portal Route */}
            <Route path="/admin/*" element={<AdminApp />} />

            {/* Standard Portal Route */}
            <Route 
              path="/*" 
              element={
                <DashboardLayout>
                  <Routes>
                    <Route 
                      path="/" 
                      element={
                        <React.Fragment key={derivedRole}>
                          {derivedRole === 'mentee' ? <StudentDashboard /> : 
                           (derivedRole === 'mentor' || derivedRole === 'tutor') ? <TutorDashboard /> : 
                           (derivedRole === 'management' || derivedRole === 'staff') ? <ManagementDashboard /> :
                           <div className="p-12 text-center">
                             <h2 className="text-2xl font-black text-slate-900 mb-2">Welcome, {user.full_name || 'Expert'}!</h2>
                             <p className="text-slate-500 font-medium mb-6">Your account (Role: {user.role || 'Unassigned'}) is being initialized.</p>
                             <Button 
                               variant="outline" 
                               onClick={() => initialize()}
                               className="rounded-xl border-slate-200 hover:bg-slate-50 font-bold"
                             >
                               Refresh Profile
                             </Button>
                           </div>}
                        </React.Fragment>
                      } 
                    />
                    
                    <Route 
                      path="/profile" 
                      element={
                        <React.Fragment key={derivedRole}>
                          {derivedRole === 'mentee' ? <StudentDashboard /> : 
                           (derivedRole === 'mentor' || derivedRole === 'tutor') ? <TutorDashboard /> : 
                           (derivedRole === 'management' || derivedRole === 'staff') ? <ManagementDashboard /> :
                           <Navigate to="/" replace />}
                        </React.Fragment>
                      } 
                    />
                    
                    <Route path="/library" element={<PublicLibrary />} />
                    <Route path="/library/:bookId" element={<BookDetail />} />
                    <Route path="/courses" element={<Courses />} />
                    <Route path="/feeds" element={<Navigate to="/community" replace />} />
                    <Route path="/learning" element={<CourseViewer />} />
                    <Route path="/assessment" element={<AssessmentEngine />} />
                    <Route path="/wallet" element={<Wallet />} />
                    <Route path="/community" element={<Community />} />
                    <Route path="/mentorship" element={<Mentorship />} />
                    <Route path="/messages" element={<Messages />} />
                    <Route path="/tutor/audit" element={<StudentAudit />} />
                    <Route path="/tutor/courses" element={<CourseBuilder onBack={() => {}} />} />
                    <Route path="/tutor/courses/:courseId" element={<CourseBuilder onBack={() => {}} />} />
                    <Route path="/analytics" element={<ManagementAnalytics />} />
                    <Route path="/audit/:type" element={<AuditDetail />} />
                    <Route path="/live" element={<LiveStudio />} />
                    <Route path="/live/:meetingId" element={<LiveClassroom />} />
                    <Route path="/portfolio" element={<Portfolio />} />
                    <Route path="/assignments" element={<Assignments />} />
                    <Route path="/mentorship-assessment" element={<MentorshipAssessment />} />
                    <Route path="/mentor/profile" element={<TutorDashboard />} />
                    <Route path="/mentor/onboarding" element={<Onboarding />} />
                    <Route path="/mentee/onboarding" element={<MenteeOnboarding />} />
                    <Route path="/author/apply" element={<AuthorApplication />} />
                    <Route path="/author/dashboard" element={<AuthorDashboard />} />
                    <Route path="/vault" element={<Vault />} />
                    <Route path="/diagnostics" element={<Diagnostics />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/profile/edit" element={<EditProfile />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </DashboardLayout>
              }
            />
          </Routes>
        </>
      )}
    </React.Suspense>
  );
};

export default App;
