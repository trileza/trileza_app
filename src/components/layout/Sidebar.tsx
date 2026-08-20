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
  User,
  Rss,
  X,
  Building2
} from 'lucide-react';
import { useAuthStore, resolveActiveRole } from '../../store/authStore';
import { useMessageStore } from '../../store/messageStore';
import { cn } from '../../utils';
import { RoleSwitcher } from '../shared/RoleSwitcher';

interface SidebarProps {
  isOpenOnMobile?: boolean;
  onCloseMobile?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpenOnMobile, onCloseMobile }) => {
  const { user, activeRole, logout, isAdmin, adminUser } = useAuthStore();
  const { totalUnreadCount } = useMessageStore();
  
  const currentRole = activeRole || resolveActiveRole(user) || 'mentee';
  const currentRoleLower = currentRole?.toLowerCase() || '';
  const isMenteeActive = currentRoleLower === 'mentee';
  const isMentor = currentRoleLower === 'mentor' || currentRoleLower === 'tutor';

  const profilePath = '/profile';

  const baseItems = [
    { name: 'Profile', icon: User, path: profilePath, roles: ['mentee', 'mentor', 'management', 'staff'] },
    { name: 'Community', icon: Users, path: '/community', roles: ['mentee', 'mentor', 'management', 'staff'] },
    { name: 'Course Builder', icon: GraduationCap, path: '/tutor/courses', roles: ['mentor'] },
    { name: 'Mentorship Assessment', icon: FileEdit, path: '/mentorship-assessment', roles: ['mentor'] },
    { name: 'Messages', icon: MessageSquare, path: '/messages', roles: ['mentee', 'mentor', 'management', 'staff'] },
    { name: 'Wallet', icon: Wallet, path: '/wallet', roles: ['mentor', 'management'] },
    { name: 'Live Studio', icon: Radio, path: '/live', roles: ['mentor', 'management', 'staff', 'mentee'] },
    { name: 'Analytics', icon: BarChart3, path: '/analytics', roles: ['management', 'staff'] },
    { name: 'Assignments', icon: FileText, path: '/assignments', roles: ['mentee'] },
    { name: 'Courses', icon: GraduationCap, path: '/courses', roles: ['mentee', 'mentor', 'management', 'staff'] },
    { name: 'Institutions', icon: Building2, path: '/institutions', roles: ['mentee', 'mentor', 'management', 'staff'] },
    { name: 'Public Library', icon: BookMarked, path: '/library', roles: ['mentee', 'mentor', 'management', 'staff'] },
    { name: 'Become a Mentor', icon: Shield, path: '/mentor/onboarding', roles: ['mentee'] },
    { name: 'Settings', icon: Settings, path: '/settings', roles: ['mentee', 'mentor', 'management', 'staff'] },
  ];

  const navItems = baseItems.filter(item => {
    if (!user) return false;
    // Don't show "Become a Mentor" if they are already a mentor (or have application onboarded/approved or pending)
    if (item.name === 'Become a Mentor' && (user.mentor_tier || user.metadata?.mentor_onboarded === true || user.metadata?.mentor_application_status === 'pending')) return false;
    return item.roles.includes(currentRoleLower);
  });
  return (
    <aside className={cn(
      "flex flex-col w-72 sm:w-64 h-screen fixed left-0 top-0 border-r border-border bg-[#f1f5f9] dark:bg-[#0f1713] text-foreground transition-all duration-300 z-50 font-sans lg:translate-x-0 pt-safe shadow-sm",
      isOpenOnMobile ? "translate-x-0 shadow-2xl shadow-black/80" : "-translate-x-full lg:translate-x-0"
    )}>
      {/* Sidebar Header Logo */}
      <div className="relative flex items-center justify-between pr-4">
        <NavLink to="/" onClick={onCloseMobile} className="p-6 flex items-center gap-3 hover:opacity-90 transition-opacity">
          <div className="w-20 h-20 flex items-center justify-center transition-all duration-300">
            <img src="/logo.png" alt="Trileza Logo" className="w-full h-full object-contain scale-125 drop-shadow-md" onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://api.dicebear.com/7.x/initials/svg?seed=Tr&backgroundColor=16a34a';
            }} />
          </div>
          <span className="text-xl font-black text-foreground tracking-tight">
            Trileza
          </span>
        </NavLink>
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
      <nav className="flex-1 px-4 mt-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            onClick={onCloseMobile}
            className={({ isActive }) => cn(
              "flex items-center justify-between px-4 py-3.5 rounded-xl transition-all duration-200 group text-base touch-target",
              isActive 
                ? "bg-[#16a34a] text-white font-extrabold shadow-md shadow-green-600/20 border-none"
                : "text-text-secondary hover:bg-surface-hover hover:text-foreground font-medium"
            )}
          >
            {({ isActive }) => (
              <>
                <div className="flex items-center gap-3">
                  <item.icon size={20} className={cn("transition-colors", isActive ? "text-white" : "group-hover:text-[#16a34a]")} />
                  <span className={cn(isActive ? "text-white font-extrabold" : "")}>{item.name}</span>
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

      <div className="p-4 mt-auto border-t border-border space-y-4 pb-safe">
        <RoleSwitcher />
        <div className="flex items-center gap-3 px-4 py-3 rounded-[10px] bg-surface-2 border border-border mb-4 shadow-sm">
          <img 
            src={user?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.full_name || 'User'}`} 
            className="w-8 h-8 rounded-full ring-2 ring-[#4ADE80]/20 object-cover"
            alt="User avatar"
          />
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold text-slate-900 dark:text-[#EAF2EA] truncate">{user?.full_name}</p>
            <p className="text-sm truncate capitalize font-bold text-slate-500 dark:text-[#9BA89E]">{isMenteeActive ? 'Mentee' : (activeRole || user?.role)}</p>
          </div>
        </div>
        
        <button 
          onClick={() => {
            if (onCloseMobile) onCloseMobile();
            logout();
          }}
          className="flex items-center gap-3 w-full px-4 py-3 rounded-[10px] text-text-secondary hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-500 dark:hover:text-red-400 transition-all duration-200"
        >
          <LogOut size={20} />
          <span className="text-base font-medium">Logout</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
