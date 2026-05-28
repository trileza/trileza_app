import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';

// Layouts
import DashboardLayout from './components/layout/DashboardLayout';
import { Button } from './components/ui';
import { LoadingOverlay } from './components/shared';

// Pages
import LoginPage from './pages/auth/LoginPage';
import StudentDashboard from './pages/student/Dashboard';
import TutorDashboard from './pages/tutor/Dashboard';
import ManagementDashboard from './pages/management/Dashboard';
import ManagementAnalytics from './pages/management/Analytics';
import AuditDetail from './pages/management/AuditDetail';
import StudentAudit from './pages/tutor/StudentAudit';
import CourseBuilder from './pages/tutor/CourseBuilder';
import Onboarding from './pages/mentor/Onboarding';
import MenteeOnboarding from './pages/student/MenteeOnboarding';
import Wallet from './pages/shared/Wallet';
import Community from './pages/shared/Community';
import Messages from './pages/shared/Messages';
import CourseViewer from './pages/student/CourseViewer';
import AssessmentEngine from './pages/shared/AssessmentEngine';
import LiveStudio from './pages/shared/LiveStudio';
import LiveClassroom from './pages/shared/LiveClassroom';
import Mentorship from './pages/shared/Mentorship';
import Portfolio from './pages/shared/Portfolio';
import Assignments from './pages/shared/Assignments';
import MentorshipAssessment from './pages/shared/MentorshipAssessment';
import MentorProfile from './pages/mentor/Profile';
import PublicLibrary from './pages/shared/PublicLibrary';
import Vault from './pages/mentor/Vault';
import Diagnostics from './pages/mentor/Diagnostics';
import Settings from './pages/shared/Settings';
import Courses from './pages/shared/Courses';
import AuthorApplication from './pages/shared/AuthorApplication';
import AuthorDashboard from './pages/shared/AuthorDashboard';

const App: React.FC = () => {

  const { user, activeRole, loading, initialized, initialize } = useAuthStore();

  // Initialize Nexus auth session on app mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Show loading spinner while checking initial session
  if (!initialized) {
    return <LoadingOverlay />;
  }

  const derivedRole = activeRole || user?.role;

  return (
    <Router>
      {!user ? (
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      ) : (
        <DashboardLayout>
          <Routes>
            {/* Dashboard Routing based on Role */}
            <Route 
              path="/" 
              element={
                derivedRole === 'mentee' ? <StudentDashboard /> : 
                (derivedRole === 'mentor' || derivedRole === 'tutor') ? <MentorProfile /> : 
                derivedRole === 'management' || derivedRole === 'staff' ? <ManagementDashboard /> :
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
                </div>
              } 
            />
            
            <Route path="/library" element={<PublicLibrary />} />
            <Route path="/courses" element={<Courses />} />
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
            <Route path="/mentor/profile" element={<MentorProfile />} />
            <Route path="/mentor/onboarding" element={<Onboarding />} />
            <Route path="/mentee/onboarding" element={<MenteeOnboarding />} />
            <Route path="/author/apply" element={<AuthorApplication />} />
            <Route path="/author/dashboard" element={<AuthorDashboard />} />
            <Route path="/vault" element={<Vault />} />
            <Route path="/diagnostics" element={<Diagnostics />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </DashboardLayout>
      )}
    </Router>
  );
};

export default App;
