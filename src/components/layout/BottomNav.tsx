import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  Home,
  Users,
  BookMarked,
  MessageSquare, 
  MoreHorizontal,
  GraduationCap,
  Radio,
  Wallet,
  FileEdit,
  FileText,
  Shield,
  BarChart3,
  Settings,
  User,
  LogOut,
  X,
  ChevronRight
} from 'lucide-react';
import { useAuthStore, resolveActiveRole } from '../../store/authStore';
import { useMessageStore } from '../../store/messageStore';
import { RoleSwitcher } from '../shared/RoleSwitcher';
import { cn } from '../../utils';

const BottomNav = () => {
  const { user, activeRole, logout } = useAuthStore();
  const { totalUnreadCount } = useMessageStore();
  const navigate = useNavigate();
  const [isLockerOpen, setIsLockerOpen] = useState(false);

  if (!user) return null;

  const currentRole = activeRole || resolveActiveRole(user) || 'mentee';
  const currentRoleLower = currentRole?.toLowerCase() || '';
  const isMenteeActive = currentRoleLower === 'mentee';

  // Primary 4 tabs + 1 More tab (5 items total)
  const primaryTabs = [
    { name: 'Home', icon: Home, path: '/' },
    { name: 'Courses', icon: GraduationCap, path: '/courses' },
    { name: 'Community', icon: Users, path: '/community' },
    { name: 'Library', icon: BookMarked, path: '/library' },
  ];

  // Secondary options inside the Lower Locker (Bottom Sheet)
  const secondaryItems = [
    { name: 'Chats', icon: MessageSquare, path: '/messages', badge: totalUnreadCount, roles: ['mentee', 'mentor', 'management', 'staff'] },
    { name: 'Live Studio', icon: Radio, path: '/live', roles: ['mentor', 'management', 'staff', 'mentee'] },
    { name: 'Course Builder', icon: GraduationCap, path: '/tutor/courses', roles: ['mentor'] },
    { name: 'Mentorship Assessment', icon: FileEdit, path: '/mentorship-assessment', roles: ['mentor'] },
    { name: 'Wallet', icon: Wallet, path: '/wallet', roles: ['mentor', 'management'] },
    { name: 'Assignments', icon: FileText, path: '/assignments', roles: ['mentee'] },
    { name: 'Become a Mentor', icon: Shield, path: '/mentor/onboarding', roles: ['mentee'] },
    { name: 'Admin Console', icon: Shield, path: '/superadmin', roles: ['management', 'staff', 'admin', 'super_admin'] },
    { name: 'Analytics', icon: BarChart3, path: '/analytics', roles: ['management', 'staff'] },
    { name: 'Profile', icon: User, path: '/profile', roles: ['mentee', 'mentor', 'management', 'staff'] },
    { name: 'Settings', icon: Settings, path: '/settings', roles: ['mentee', 'mentor', 'management', 'staff'] },
  ].filter(item => {
    if (item.name === 'Become a Mentor' && (user.mentor_tier || user.metadata?.mentor_onboarded === true || user.metadata?.mentor_application_status === 'pending')) return false;
    return item.roles.includes(currentRoleLower);
  });

  return (
    <>
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 pb-safe">
        {/* ── Main 5-Tab Bottom Navigation Bar ── */}
        <nav className="h-16 bg-surface/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-border flex items-center justify-around px-1 transition-all duration-300 shadow-2xl">
          {primaryTabs.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              end={item.path === '/'}
              className="flex flex-col items-center justify-center gap-0.5 transition-all duration-200 touch-target relative"
            >
              {({ isActive }) => (
                <>
                  <div className={cn(
                     "p-1.5 rounded-xl transition-all duration-200 active:scale-90 relative flex items-center justify-center",
                     isActive ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20 px-3 py-1.5" : "text-slate-500 dark:text-slate-400"
                  )}>
                    <item.icon size={18} />
                  </div>
                  <span className={cn(
                    "text-[10px] font-extrabold leading-none transition-colors duration-200",
                    isActive ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500"
                  )}>
                    {item.name}
                  </span>
                </>
              )}
            </NavLink>
          ))}

          {/* 5th Tab: "More" Options Button */}
          <button
            onClick={() => setIsLockerOpen(true)}
            className="flex flex-col items-center justify-center gap-0.5 transition-all duration-200 touch-target relative cursor-pointer border-none bg-transparent"
          >
            <div className={cn(
              "p-1.5 rounded-xl transition-all duration-200 active:scale-90 relative flex items-center justify-center",
              isLockerOpen ? "bg-emerald-600 text-white shadow-md px-3 py-1.5" : "text-slate-500 dark:text-slate-400"
            )}>
              <MoreHorizontal size={18} />
              {totalUnreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[8px] font-black text-white shadow-sm">
                  {totalUnreadCount > 9 ? '9+' : totalUnreadCount}
                </span>
              )}
            </div>
            <span className={cn(
              "text-[10px] font-extrabold leading-none transition-colors duration-200",
              isLockerOpen ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500"
            )}>
              More
            </span>
          </button>
        </nav>
      </div>

      {/* ── Lower Locker (Bottom Sheet) Drawer ── */}
      {isLockerOpen && (
        <div className="lg:hidden fixed inset-0 z-[60] flex flex-col justify-end bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          {/* Backdrop Click */}
          <div className="flex-1" onClick={() => setIsLockerOpen(false)} />

          {/* Bottom Sheet Box */}
          <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 rounded-t-[2.5rem] p-6 max-h-[85vh] overflow-y-auto space-y-6 shadow-2xl animate-in slide-in-from-bottom duration-300 text-left">
            {/* Top Handle & Title */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black tracking-tight text-slate-900 dark:text-white uppercase tracking-wider text-xs">
                  More Options & Control
                </h3>
              </div>
              <button 
                onClick={() => setIsLockerOpen(false)}
                className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors border-none bg-transparent cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Dashboard Toggle Switch (RoleSwitcher) */}
            <div className="p-4 bg-slate-50 dark:bg-slate-850/60 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
                Dashboard Mode Switch:
              </span>
              <RoleSwitcher />
            </div>

            {/* Navigation Options List */}
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-2 pb-1">
                Navigation Directory
              </p>
              <div className="grid grid-cols-1 gap-1">
                {secondaryItems.map((item) => (
                  <NavLink
                    key={item.name}
                    to={item.path}
                    onClick={() => setIsLockerOpen(false)}
                    className={({ isActive }) => cn(
                      "flex items-center justify-between p-3.5 rounded-2xl transition-all duration-200 group text-sm cursor-pointer",
                      isActive 
                        ? "bg-emerald-600 text-white font-extrabold shadow-md"
                        : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold"
                    )}
                  >
                    {({ isActive }) => (
                      <>
                        <div className="flex items-center gap-3">
                          <item.icon size={18} className={cn(isActive ? "text-white" : "text-emerald-500")} />
                          <span>{item.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {item.badge !== undefined && item.badge > 0 && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-500 text-white">
                              {item.badge}
                            </span>
                          )}
                          <ChevronRight size={16} className={cn("opacity-60", isActive ? "text-white" : "text-slate-400")} />
                        </div>
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>

            {/* Account Info & Logout */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <img 
                  src={user?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.full_name || 'User'}`} 
                  className="w-10 h-10 rounded-full ring-2 ring-emerald-500/20 object-cover shrink-0"
                  alt=""
                />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{user?.full_name}</p>
                  <p className="text-[10px] font-semibold text-slate-400 truncate capitalize">{isMenteeActive ? 'Mentee' : (activeRole || user?.role)}</p>
                </div>
              </div>

              <button
                onClick={() => {
                  setIsLockerOpen(false);
                  logout();
                }}
                className="px-4 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 font-bold text-xs hover:bg-rose-100 transition-colors flex items-center gap-2 border border-rose-200 dark:border-rose-900/40 cursor-pointer shrink-0"
              >
                <LogOut size={14} /> Logout
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
};

export default BottomNav;
