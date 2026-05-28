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
  User
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { cn } from '../../utils';

const Sidebar = () => {
  const { user, activeRole, logout } = useAuthStore();
  const isMenteeActive = activeRole === 'mentee';
  const currentRole = activeRole || user?.role;
  const isMentor = currentRole === 'mentor' || currentRole === 'tutor';

  const navItems = [
    { name: 'Profile', icon: User, path: '/', roles: ['mentee', 'mentor', 'management', 'staff'] },
    { name: 'Course Builder', icon: GraduationCap, path: '/tutor/courses', roles: ['mentor'] },
    { name: 'Mentorship Assessment', icon: FileEdit, path: '/mentorship-assessment', roles: ['mentor'] },
    { name: 'Community', icon: Users, path: '/community', roles: ['mentee', 'mentor', 'management', 'staff'] },
    { name: 'Messages', icon: MessageSquare, path: '/messages', roles: ['mentee', 'mentor', 'management', 'staff'] },
    { name: 'Wallet', icon: Wallet, path: '/wallet', roles: ['mentor', 'management'] },
    { name: 'Live Studio', icon: Radio, path: '/live', roles: ['mentor', 'management', 'staff'] },
    { name: 'My Learning', icon: BookOpen, path: '/learning', roles: ['mentee'] },
    { name: 'Analytics', icon: BarChart3, path: '/analytics', roles: ['management', 'staff'] },
    { name: 'Admin Hub', icon: Settings, path: '/analytics', roles: ['management'] },
    { name: 'Assignments', icon: FileText, path: '/assignments', roles: ['mentee'] },
    { name: 'Courses', icon: GraduationCap, path: '/courses', roles: ['mentee', 'mentor', 'management', 'staff'] },
    { name: 'Public Library', icon: BookMarked, path: '/library', roles: ['mentee', 'mentor', 'management', 'staff'] },
    { name: 'Become a Mentor', icon: Shield, path: '/mentor/onboarding', roles: ['mentee'] },
    { name: 'Settings', icon: Settings, path: '/settings', roles: ['management', 'staff'] },
  ].filter(item => {
    if (!user) return false;
    // Don't show "Become a Mentor" if they are already a mentor with a tier
    if (item.name === 'Become a Mentor' && user.mentor_tier) return false;
    return item.roles.includes(currentRole || '');
  });

  return (
    <aside className="hidden lg:flex flex-col w-64 h-screen fixed left-0 top-0 border-r border-slate-250/50 bg-white text-slate-700 transition-all duration-300 z-30 font-sans">
      {/* Sidebar Header Logo */}
      <div className="p-6 flex items-center gap-3">
        <div className="w-20 h-20 flex items-center justify-center transition-all duration-300">
          <img src="/logo.png" alt="Trileza Logo" className="w-full h-full object-contain scale-125 drop-shadow-md" onError={(e) => {
            (e.target as HTMLImageElement).src = 'https://api.dicebear.com/7.x/initials/svg?seed=Tr&backgroundColor=16a34a';
          }} />
        </div>
        <span className="text-xl font-black text-slate-800 tracking-tight">
          Trileza
        </span>
      </div>

      {/* Navigation links */}
      <nav className="flex-1 px-4 mt-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            className={({ isActive }) => cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group text-base font-medium",
              isActive 
                ? "bg-green-50 text-green-700 border border-green-100/60 font-black shadow-inner"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            )}
          >
            <item.icon size={20} className="transition-colors group-hover:text-green-600" />
            {item.name}
          </NavLink>
        ))}
      </nav>

      {/* Sidebar Footer User Section */}
      <div className="p-4 mt-auto border-t border-slate-200/50">
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white border border-slate-200/40 mb-4 shadow-sm">
          <img 
            src={user?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.full_name || 'User'}`} 
            className="w-8 h-8 rounded-full ring-2 ring-green-600/20 object-cover"
            alt="User avatar"
          />
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold text-slate-800 truncate">{user?.full_name}</p>
            <p className="text-sm truncate capitalize font-bold text-slate-450">{isMenteeActive ? 'Mentee' : (activeRole || user?.role)}</p>
          </div>
        </div>
        
        <button 
          onClick={logout}
          className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-all duration-200"
        >
          <LogOut size={20} />
          <span className="text-base font-medium">Logout</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
