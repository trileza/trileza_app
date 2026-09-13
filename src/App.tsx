import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore, resolveActiveRole } from './store/authStore';
import { nexus } from './lib/nexus';
import { useMeetingStore } from './store/meetingStore';
import { liveService } from './lib/services/live';
import { ensureRealtimeConnection } from './lib/services/realtimeEvents';
import { useSettingsStore } from './store/settingsStore';
import { initCapacitorNative, setNativeStatusBar, registerAndroidBackButton } from './lib/native/capacitor';

// Layouts
import DashboardLayout from './components/layout/DashboardLayout';
import { Button } from './components/ui';
import { LoadingOverlay } from './components/shared';

// Meeting Overlay (persists across sidebar navigation)
import MeetingOverlay from './components/live/MeetingOverlay';

// Core Auth Page (Eagerly loaded for instant post-login transition)
import LoginPage from './pages/auth/LoginPage';

// All other pages lazy-loaded for optimal code splitting and faster deploys
const StudentDashboard = React.lazy(() => import('./pages/student/Dashboard'));
const TutorDashboard = React.lazy(() => import('./pages/tutor/Dashboard'));
const PublicLibrary = React.lazy(() => import('./pages/shared/PublicLibrary'));
const Courses = React.lazy(() => import('./pages/shared/Courses'));
const Community = React.lazy(() => import('./pages/shared/Community'));
const Messages = React.lazy(() => import('./pages/shared/Messages'));
const Settings = React.lazy(() => import('./pages/shared/Settings'));
const Wallet = React.lazy(() => import('./pages/shared/Wallet'));
const Assignments = React.lazy(() => import('./pages/shared/Assignments'));
const MenteeOnboarding = React.lazy(() => import('./pages/student/MenteeOnboarding'));
const Onboarding = React.lazy(() => import('./pages/mentor/Onboarding'));
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
const PricingPage = React.lazy(() => import('./pages/shared/PricingPage'));
const PaymentCheckoutPage = React.lazy(() => import('./pages/shared/PaymentCheckoutPage'));
const InstitutionalRegister = React.lazy(() => import('./pages/auth/InstitutionalRegister'));
const InstitutionKycForm = React.lazy(() => import('./pages/auth/InstitutionKycForm'));
const TenantAdminDashboard = React.lazy(() => import('./pages/admin/TenantAdminDashboard'));
const InstitutionalDashboard = React.lazy(() => import('./pages/admin/InstitutionalDashboard'));
const InstitutionDirectory = React.lazy(() => import('./pages/shared/InstitutionDirectory'));
const InstitutionDetail = React.lazy(() => import('./pages/shared/InstitutionDetail'));
const Gradebook = React.lazy(() => import('./pages/tutor/Gradebook'));
const AttendanceRegister = React.lazy(() => import('./pages/tutor/AttendanceRegister'));
const Classes = React.lazy(() => import('./pages/tutor/Classes'));
const ParentPortal = React.lazy(() => import('./pages/guardian/ParentPortal'));
const SchoolOps = React.lazy(() => import('./pages/admin/SchoolOps'));
const StudentInsights = React.lazy(() => import('./pages/tutor/StudentInsights'));
const LessonPlanner = React.lazy(() => import('./pages/tutor/LessonPlanner'));
const ResourceBooking = React.lazy(() => import('./pages/shared/ResourceBooking'));
const Rubrics = React.lazy(() => import('./pages/tutor/Rubrics'));
const GuardianLinks = React.lazy(() => import('./pages/admin/GuardianLinks'));
const Support = React.lazy(() => import('./pages/shared/Support'));
const AdminApp = React.lazy(() => import('./AdminApp'));

const App: React.FC = () => {

  const { user, activeRole, loading, initialized, initialize } = useAuthStore();
  const navigate = useNavigate();
  // Must be called unconditionally, above every early return below.
  const location = useLocation();

  // Resolved here, above the early returns, because the loading gate below
  // depends on it. No 'mentee' fallback: guessing a role and correcting it a
  // frame later is exactly what made the dashboard flash.
  const resolvedRole = activeRole || resolveActiveRole(user);
  const derivedRole = (resolvedRole || '').toLowerCase();
  const resolvedRoleReady = Boolean(resolvedRole);

  // Initialize Nexus auth session and Capacitor native listeners on app mount
  useEffect(() => {
    initialize();
    initCapacitorNative();
    // Open the realtime socket up front. Publishes are dropped when no
    // connection exists, so without this the first events of a session — the
    // ones raised during sign-in, enrollment and checkout — never arrived.
    ensureRealtimeConnection();
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
          // Only the host's own client may act on a session. This loop runs in
          // every signed-in browser, and previously any of them would delete
          // anyone's late session.
          if (session.status !== 'scheduled' || session.tutor_id !== user.id) continue;

          const scheduledTime = new Date(session.scheduled_at).getTime();
          const elapsedMs = now - scheduledTime;

          // 1. If 1 hour passed and not started, delete the session
          if (elapsedMs >= 60 * 60 * 1000) {
            console.log(`[Auto-Remove] Session ${session.id} ("${session.title}") auto-removed due to no-show.`);
            await liveService.deleteSession(session.id);
          }
          // 2. If 30 minutes passed, remind the host
          else if (elapsedMs >= 30 * 60 * 1000) {
            const reminderKey = `trileza_no_show_reminder_${session.id}`;
            if (!localStorage.getItem(reminderKey)) {
              localStorage.setItem(reminderKey, 'true');
              addToast(`Your scheduled meeting "${session.title}" will be removed in 30 minutes if not started.`, 'warning');
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
        const hasMentorStatus = metadata.mentor_onboarded === true || state.user?.metadata?.mentor_onboarded === true || payload.role === 'mentor' || payload.role === 'tutor' || metadata.mentor_application_status === 'approved';
        if (currentActiveRole === 'mentor' && !hasMentorStatus) {
          currentActiveRole = 'mentee';
        }

        // If newly approved by admin or metadata specifies active_role, switch activeRole
        if (hasMentorStatus && (metadata.active_role === 'mentor' || metadata.mentor_application_status === 'approved')) {
          currentActiveRole = 'mentor';
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

  // Signed in but the role has not resolved yet. Rendering anything role-shaped
  // here would show the wrong dashboard and then swap it.
  if (user && !resolvedRoleReady) {
    return <LoadingOverlay message="Loading your workspace…" />;
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

  const isGuardian = derivedRole === 'guardian';
  const isMentee = derivedRole === 'mentee' && !isGuardian;
  const isMenteeOnboarded = user?.metadata?.mentee_onboarded === true;
  const isMentor = derivedRole === 'mentor' || derivedRole === 'tutor';
  const isMentorOnboarded = user?.metadata?.mentor_onboarded === true || 
    user?.mentor_tier === 'free' || 
    user?.mentor_tier === 'pro' || 
    user?.mentor_tier === 'institutional' || 
    user?.metadata?.mentor_application_status === 'approved' ||
    Boolean(user?.metadata?.mentor_tier);

  // Onboarding Gates
  if (user) {
    if (isMentee && !isMenteeOnboarded && location.pathname !== '/mentee/onboarding') {
      return <Navigate to="/mentee/onboarding" replace />;
    }
    // Mentor onboarding is an application, not a mandatory setup step, so this
    // gate must never trap. It previously did: a user whose role resolved to
    // mentor without being onboarded was redirected here, and "Cancel & Return"
    // navigated to "/" only to be bounced straight back — which read as a dead
    // button.
    //
    // Two escapes: an application already in flight (or declined), and an
    // explicit dismissal held for the session.
    const applicationState = user?.metadata?.mentor_application_status;
    const hasApplied = applicationState === 'pending' || applicationState === 'rejected';
    const dismissed = sessionStorage.getItem('trileza_mentor_onboarding_dismissed') === '1';

    if (
      isMentor &&
      !isMentorOnboarded &&
      !hasApplied &&
      !dismissed &&
      location.pathname !== '/mentor/onboarding'
    ) {
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
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/institution-signup" element={<InstitutionalRegister />} />
          <Route path="/institution/signup" element={<InstitutionalRegister />} />
          {/* Registered signed-out as well, even though it needs an account.
              Without it the catch-all silently redirects to "/", so the link
              from registration looks broken rather than asking for a sign-in. */}
          <Route path="/institution/verification" element={<InstitutionKycForm />} />
          <Route path="/institutions" element={<InstitutionDirectory />} />
          <Route path="/institutions/:institutionId" element={<InstitutionDetail />} />
          <Route path="/courses" element={<Courses />} />
          <Route path="/tenant-admin/:subdomain?" element={<TenantAdminDashboard />} />
          <Route path="/superadmin/*" element={<AdminApp />} />
          <Route path="/gate/*" element={<AdminApp />} />
          <Route path="/content-manager/*" element={<AdminApp />} />
          <Route path="/user-manager/*" element={<AdminApp />} />
          <Route path="/finance-admin/*" element={<AdminApp />} />
          <Route path="/support-agent/*" element={<AdminApp />} />
          <Route path="/compliance-officer/*" element={<AdminApp />} />
          <Route path="/analytics-viewer/*" element={<AdminApp />} />
          <Route path="/admin/*" element={<AdminApp />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      ) : (
        <>
          {/* Meeting Overlay — renders outside routes so it persists across navigation */}
          <MeetingOverlay />

          <Routes>
            {/* Onboarding — standalone full-screen flows, deliberately outside
                DashboardLayout so no app chrome sits above their own header. */}
            <Route path="/mentor/onboarding" element={<Onboarding />} />
            <Route path="/mentee/onboarding" element={<MenteeOnboarding />} />

            {/* Payment & Checkout Routes */}
            <Route path="/checkout" element={<PaymentCheckoutPage />} />
            <Route path="/payment" element={<PaymentCheckoutPage />} />
            <Route path="/payment-confirmation" element={<PaymentCheckoutPage />} />

            {/* Multi-Tenant Institutional Routes */}
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/institution-signup" element={<InstitutionalRegister />} />
            <Route path="/institution/signup" element={<InstitutionalRegister />} />
            {/* Verification is signed-in only: the record is keyed to the
                submitter, and it holds documents nobody should upload
                anonymously. */}
            <Route path="/institution/verification" element={<InstitutionKycForm />} />
            <Route path="/institutions" element={<InstitutionDirectory />} />
            <Route path="/institutions/:institutionId" element={<InstitutionDetail />} />
            <Route path="/tenant-admin/:subdomain?" element={<TenantAdminDashboard />} />

            {/* Admin Portal Routes */}
            <Route path="/superadmin/*" element={<AdminApp />} />
            <Route path="/gate/*" element={<AdminApp />} />
            <Route path="/content-manager/*" element={<AdminApp />} />
            <Route path="/user-manager/*" element={<AdminApp />} />
            <Route path="/finance-admin/*" element={<AdminApp />} />
            <Route path="/support-agent/*" element={<AdminApp />} />
            <Route path="/compliance-officer/*" element={<AdminApp />} />
            <Route path="/analytics-viewer/*" element={<AdminApp />} />
            <Route path="/admin/*" element={<AdminApp />} />

            {/* Standard Portal Route */}
            <Route 
              path="/*" 
              element={
                <DashboardLayout>
                  <Routes>
                    <Route path="/pricing" element={<PricingPage />} />
                    <Route path="/checkout" element={<PaymentCheckoutPage />} />
                    <Route path="/payment" element={<PaymentCheckoutPage />} />
                    <Route 
                      path="/" 
                      element={
                        <React.Fragment key={derivedRole}>
                          {derivedRole === 'guardian' ? <ParentPortal /> :
                           derivedRole === 'mentee' ? <StudentDashboard /> : 
                           (derivedRole === 'mentor' || derivedRole === 'tutor') ? <TutorDashboard /> : 
                           (derivedRole === 'management' || derivedRole === 'staff') ? <InstitutionalDashboard initialTab="dashboard" /> :
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
                          {derivedRole === 'guardian' ? <ParentPortal /> :
                           derivedRole === 'mentee' ? <StudentDashboard /> : 
                           (derivedRole === 'mentor' || derivedRole === 'tutor') ? <TutorDashboard /> : 
                           (derivedRole === 'management' || derivedRole === 'staff') ? <InstitutionalDashboard initialTab="branding" /> :
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
                    <Route path="/author/apply" element={<AuthorApplication />} />
                    <Route path="/author/dashboard" element={<AuthorDashboard />} />
                    <Route path="/vault" element={<Vault />} />
                    <Route path="/diagnostics" element={<Diagnostics />} />
                    <Route path="/gradebook" element={<Gradebook />} />
                    <Route path="/attendance" element={<AttendanceRegister />} />
                    <Route path="/classes" element={<Classes />} />
                    <Route path="/family" element={<ParentPortal />} />
                    <Route path="/school" element={<SchoolOps />} />
                    <Route path="/insights" element={<StudentInsights />} />
                    <Route path="/lesson-plans" element={<LessonPlanner />} />
                    <Route path="/resources" element={<ResourceBooking />} />
                    <Route path="/rubrics" element={<Rubrics />} />
                    <Route path="/guardians" element={<GuardianLinks />} />
                    <Route path="/support" element={<Support />} />
                    <Route path="/help" element={<Support />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/institution/users" element={<InstitutionalDashboard initialTab="users" />} />
                    <Route path="/institution/instructors" element={<InstitutionalDashboard initialTab="instructors" />} />
                    <Route path="/institution/students" element={<InstitutionalDashboard initialTab="students" />} />
                    <Route path="/institution/enrollments" element={<InstitutionalDashboard initialTab="enrollments" />} />
                    <Route path="/institution/reports" element={<InstitutionalDashboard initialTab="reports" />} />
                    <Route path="/institution/branding" element={<InstitutionalDashboard initialTab="branding" />} />
                    <Route path="/institution/payouts" element={<InstitutionalDashboard initialTab="payouts" />} />
                    <Route path="/institution/settings" element={<InstitutionalDashboard initialTab="settings" />} />
                    <Route path="/institution/:tab" element={<InstitutionalDashboard />} />
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
