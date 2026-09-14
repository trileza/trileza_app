import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  BookOpen, 
  Wallet, 
  Users, 
  BarChart3, 
  Settings, 
  LogOut, 
  GraduationCap, 
  Radio, 
  MessageSquare, 
  FileText, 
  FileEdit, 
  Shield, 
  BookMarked, 
  X, 
  Building2, 
  Zap,
  UserPlus,
  UserCheck,
  Download,
  Palette,
  DollarSign,
  Layers,
  ClipboardList,
  CalendarCheck,
  Heart,
  ShieldAlert,
  NotebookPen,
  Package,
  Grid3x3,
  LifeBuoy,
  Sparkles
} from 'lucide-react';
import { useAuthStore, resolveActiveRole } from '../../store/authStore';
import { useSubscriptionStore } from '../../store/subscriptionStore';
import { useMessageStore } from '../../store/messageStore';
import { cn } from '../../utils';
import { RoleSwitcher } from '../shared/RoleSwitcher';
import Logo from '../shared/Logo';

interface SidebarProps {
  isOpenOnMobile?: boolean;
  onCloseMobile?: () => void;
}

interface NavItem {
  name: string;
  icon: any;
  path: string;
  highlight?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpenOnMobile, onCloseMobile }) => {
  const { user, activeRole, logout } = useAuthStore();
  const { tier } = useSubscriptionStore();
  const { totalUnreadCount } = useMessageStore();
  
  const currentRole = activeRole || resolveActiveRole(user) || 'mentee';
  const currentRoleLower = (currentRole as string)?.toLowerCase() || '';

  // Determine user subscription tier
  const userTier = 
    (user?.mentor_tier as string) || 
    (user?.metadata?.mentor_tier as string) || 
    (user?.metadata?.subscription_tier as string) || 
    tier || 
    (user?.role === 'management' || (user?.role as string) === 'tenant_admin' ? 'institutional' : 'free');

  // A guardian only ever sees the parent portal, so this check comes first and
  // short-circuits every other role branch below.
  const isGuardian = currentRoleLower === 'guardian';

  const isInstitutional =
    currentRoleLower === 'management' ||
    currentRoleLower === 'staff' ||
    currentRoleLower === 'tenant_admin' ||
    currentRoleLower === 'institute' ||
    currentRoleLower === 'institutional';

  const isMentor = currentRoleLower === 'mentor' || currentRoleLower === 'tutor';
  const isMentorPro = isMentor && (userTier === 'pro');
  const isMenteeActive = currentRoleLower === 'mentee';

  // ═════════════════════════════════════════════════════════════════════════
  // 1. MENTEE SIDEBAR (Merged Dashboard/Profile - 8 Items)
  // ═════════════════════════════════════════════════════════════════════════
  const menteeNavItems: NavItem[] = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/' },
    { name: 'Courses', icon: GraduationCap, path: '/courses' },
    { name: 'My Learning', icon: BookOpen, path: '/learning' },
    { name: 'Assignments', icon: FileText, path: '/assignments' },
    { name: 'Books', icon: BookMarked, path: '/library' },
    { name: 'Community', icon: Users, path: '/community' },
    { name: 'Messages', icon: MessageSquare, path: '/messages' },
    { name: 'Help & Support', icon: LifeBuoy, path: '/support' },
    { name: 'Settings', icon: Settings, path: '/settings' },
  ];

  // ═════════════════════════════════════════════════════════════════════════
  // 2. FREE MENTOR SIDEBAR (Merged Dashboard/Profile - 10 Items)
  // ═════════════════════════════════════════════════════════════════════════
  const freeMentorNavItems: NavItem[] = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/' },
    { name: 'Course Builder', icon: GraduationCap, path: '/tutor/courses' },
    { name: 'Courses', icon: BookOpen, path: '/courses' },
    { name: 'Mentorship Assessment', icon: FileEdit, path: '/mentorship-assessment' },
    { name: 'Classes', icon: Users, path: '/classes' },
    { name: 'Gradebook', icon: ClipboardList, path: '/gradebook' },
    { name: 'Attendance', icon: CalendarCheck, path: '/attendance' },
    { name: 'Student Insights', icon: ShieldAlert, path: '/insights' },
    { name: 'Lesson Plans', icon: NotebookPen, path: '/lesson-plans' },
    { name: 'Rubrics', icon: Grid3x3, path: '/rubrics' },
    { name: 'Live Studio', icon: Radio, path: '/live' },
    { name: 'Books', icon: BookMarked, path: '/library' },
    { name: 'Community', icon: Users, path: '/community' },
    { name: 'Messages', icon: MessageSquare, path: '/messages' },
    { name: 'Wallet', icon: Wallet, path: '/wallet' },
    { name: 'Help & Support', icon: LifeBuoy, path: '/support' },
    { name: 'Settings', icon: Settings, path: '/settings' },
  ];

  // ═════════════════════════════════════════════════════════════════════════
  // 3. MENTOR PRO SIDEBAR (Merged Dashboard/Profile - 15 Items)
  // ═════════════════════════════════════════════════════════════════════════
  const mentorProNavItems: NavItem[] = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/' },
    { name: 'Course Builder', icon: GraduationCap, path: '/tutor/courses' },
    { name: 'Courses', icon: BookOpen, path: '/courses' },
    { name: 'Students', icon: UserCheck, path: '/institution/students' },
    { name: 'Mentorship Assessment', icon: FileEdit, path: '/mentorship-assessment' },
    { name: 'Classes', icon: Users, path: '/classes' },
    { name: 'Gradebook', icon: ClipboardList, path: '/gradebook' },
    { name: 'Attendance', icon: CalendarCheck, path: '/attendance' },
    { name: 'Student Insights', icon: ShieldAlert, path: '/insights' },
    { name: 'Lesson Plans', icon: NotebookPen, path: '/lesson-plans' },
    { name: 'Rubrics', icon: Grid3x3, path: '/rubrics' },
    { name: 'Live Studio', icon: Radio, path: '/live' },
    { name: 'Analytics', icon: BarChart3, path: '/analytics' },
    { name: 'Books', icon: BookMarked, path: '/library' },
    { name: 'Vault', icon: Shield, path: '/vault' },
    { name: 'Diagnostics', icon: Sparkles, path: '/diagnostics' },
    { name: 'Community', icon: Users, path: '/community' },
    { name: 'Messages', icon: MessageSquare, path: '/messages' },
    { name: 'Wallet', icon: Wallet, path: '/wallet' },
    { name: 'Payouts', icon: DollarSign, path: '/institution/payouts' },
    { name: 'Help & Support', icon: LifeBuoy, path: '/support' },
    { name: 'Settings', icon: Settings, path: '/settings' },
  ];

  // ═════════════════════════════════════════════════════════════════════════
  // 4. INSTITUTIONAL SIDEBAR (Comprehensive Enterprise - 16 Items)
  // ═════════════════════════════════════════════════════════════════════════
  const institutionalNavItems: NavItem[] = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/' },
    { name: 'Users Management', icon: UserPlus, path: '/institution/users' },
    { name: 'Instructors', icon: GraduationCap, path: '/institution/instructors' },
    { name: 'Students', icon: UserCheck, path: '/institution/students' },
    { name: 'Course Builder', icon: GraduationCap, path: '/tutor/courses' },
    { name: 'Courses', icon: BookOpen, path: '/courses' },
    { name: 'Mentorship Assessment', icon: FileEdit, path: '/mentorship-assessment' },
    { name: 'Classes', icon: Users, path: '/classes' },
    { name: 'Gradebook', icon: ClipboardList, path: '/gradebook' },
    { name: 'Attendance', icon: CalendarCheck, path: '/attendance' },
    { name: 'Student Insights', icon: ShieldAlert, path: '/insights' },
    { name: 'Lesson Plans', icon: NotebookPen, path: '/lesson-plans' },
    { name: 'Rubrics', icon: Grid3x3, path: '/rubrics' },
    { name: 'Live Studio', icon: Radio, path: '/live' },
    { name: 'Books', icon: BookMarked, path: '/library' },
    { name: 'Enrollments', icon: Layers, path: '/institution/enrollments' },
    { name: 'School Operations', icon: Building2, path: '/school' },
    { name: 'Resources', icon: Package, path: '/resources' },
    { name: 'Parents & Guardians', icon: Heart, path: '/guardians' },
    { name: 'Branding', icon: Palette, path: '/institution/branding' },
    { name: 'Community', icon: Users, path: '/community' },
    { name: 'Messages', icon: MessageSquare, path: '/messages' },
    { name: 'Wallet', icon: Wallet, path: '/wallet' },
    { name: 'Reports', icon: Download, path: '/institution/reports' },
    { name: 'Payouts', icon: DollarSign, path: '/institution/payouts' },
    { name: 'Help & Support', icon: LifeBuoy, path: '/support' },
    { name: 'Settings', icon: Settings, path: '/institution/settings' },
  ];

  // Pick the exact tailored sidebar based on the active role and tier
  // ═════════════════════════════════════════════════════════════════════════
  // 5. GUARDIAN SIDEBAR (Parent portal — read-only, deliberately minimal)
  // ═════════════════════════════════════════════════════════════════════════
  const guardianNavItems: NavItem[] = [
    { name: 'My Children', icon: Heart, path: '/' },
    { name: 'Messages', icon: MessageSquare, path: '/messages' },
    { name: 'Help & Support', icon: LifeBuoy, path: '/support' },
    { name: 'Settings', icon: Settings, path: '/settings' },
  ];

  const navItems = isGuardian
    ? guardianNavItems
    : isInstitutional
    ? institutionalNavItems
    : isMentorPro
    ? mentorProNavItems
    : isMentor
    ? freeMentorNavItems
    : menteeNavItems;

  return (
    <aside className={cn(
      "flex flex-col w-72 sm:w-64 h-screen fixed left-0 top-0 border-r border-border bg-[#f1f5f9] dark:bg-[#0f1713] text-foreground transition-all duration-300 z-50 font-sans lg:translate-x-0 pt-safe shadow-sm",
      isOpenOnMobile ? "translate-x-0 shadow-2xl shadow-black/80" : "-translate-x-full lg:translate-x-0"
    )}>
      {/* Sidebar Header Logo */}
      <div className="relative flex items-center justify-between pr-4">
        <div className="px-5 py-4" onClick={onCloseMobile}>
          <Logo variant="full" size="md" to="/" />
        </div>
        {onCloseMobile && (
          <button 
            onClick={onCloseMobile} 
            className="lg:hidden p-2 rounded-[10px] hover:bg-surface-hover text-text-secondary hover:text-foreground transition-colors"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* Navigation links */}
      <nav className="flex-1 px-4 mt-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            onClick={onCloseMobile}
            className={({ isActive }) => cn(
              "flex items-center justify-between px-3.5 py-3 rounded-xl transition-all duration-200 group text-sm font-medium touch-target",
              isActive 
                ? "bg-[#2E7D32] text-white font-black shadow-md shadow-green-600/20 border-none"
                : "text-text-secondary hover:bg-surface-hover hover:text-foreground"
            )}
          >
            {({ isActive }) => (
              <>
                <div className="flex items-center gap-3">
                  <item.icon size={18} className={cn("transition-colors shrink-0", isActive ? "text-white" : "group-hover:text-[#2E7D32]")} />
                  <span className={cn(isActive ? "text-white font-black" : "")}>{item.name}</span>
                </div>
                {item.name === 'Messages' && totalUnreadCount > 0 && (
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-black min-w-[20px] text-center",
                    isActive ? "bg-white text-emerald-700" : "bg-emerald-600 text-white"
                  )}>
                    {totalUnreadCount}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* ── LOWER FOOTER SECTION (Upgrade Plan replaces username card) ── */}
      <div className="p-4 mt-auto border-t border-border space-y-3 pb-safe">
        {/* 2-Way Role Switcher (ONLY shown when dual profile has been obtained) */}
        <RoleSwitcher />

        {/* Minimal Upgrade Plan Button */}
        {!isInstitutional ? (
          <NavLink
            to="/pricing"
            onClick={onCloseMobile}
            className="flex items-center justify-center gap-2 w-full py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-sm transition-all cursor-pointer group"
          >
            <Zap size={14} className="fill-slate-950 shrink-0 group-hover:scale-110 transition-transform" />
            <span>{isMenteeActive ? 'Mentorship Plan' : 'Upgrade Plan'}</span>
          </NavLink>
        ) : (
          <div className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded-xl bg-indigo-500/10 dark:bg-indigo-950/40 border border-indigo-500/25 text-indigo-600 dark:text-indigo-400 font-bold text-xs">
            <Building2 size={14} className="shrink-0" />
            <span className="truncate">Institutional Tier</span>
          </div>
        )}

        {/* Logout button */}
        <button 
          onClick={() => {
            if (onCloseMobile) onCloseMobile();
            logout();
          }}
          className="flex items-center gap-3 w-full px-3.5 py-2.5 rounded-xl text-slate-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 hover:text-rose-600 dark:hover:text-rose-400 transition-all font-bold text-sm cursor-pointer"
        >
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
