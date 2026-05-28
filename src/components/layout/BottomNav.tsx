import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  Home, 
  BookOpen, 
  Users, 
  Wallet, 
  User,
  Radio,
  MessageSquare,
  Network
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { cn } from '../../utils';

const BottomNav = () => {
  const { user, activeRole } = useAuthStore();

  const navItems = [
    { name: 'Home', icon: Home, path: '/', roles: ['mentee', 'mentor', 'staff', 'management'] },
    { name: 'Live', icon: Radio, path: '/live', roles: ['mentee', 'mentor', 'staff', 'management'] },
    { name: 'Courses', icon: BookOpen, path: '/courses', roles: ['mentee', 'mentor', 'staff', 'management'] },
    { name: 'Community', icon: Users, path: '/community', roles: ['mentee', 'mentor', 'management', 'staff'] },
    { name: 'Mentorship', icon: Network, path: '/mentorship', roles: ['mentee', 'mentor'] },
    { name: 'Messages', icon: MessageSquare, path: '/messages', roles: ['mentee', 'mentor', 'management', 'staff'] },
    { name: 'Wallet', icon: Wallet, path: '/wallet', roles: ['mentor', 'management'] },
    { name: 'Profile', icon: User, path: '/', roles: ['mentee', 'mentor', 'staff', 'management'] },
  ].filter(item => user && item.roles.includes(activeRole || user.role));

  return (
    <nav className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-md h-16 glass rounded-2xl shadow-2xl border border-white/40 flex items-center justify-around px-4 z-50 transition-all duration-300">
      {navItems.map((item) => (
        <NavLink
          key={item.name}
          to={item.path}
          className={({ isActive }) => cn(
            "flex flex-col items-center justify-center gap-1 transition-all duration-300",
            isActive ? "text-emerald-500 scale-110" : "text-slate-500 hover:text-emerald-500/70"
          )}
        >
          <div className={cn(
            "p-2 rounded-xl transition-all duration-300",
            "active:scale-90"
          )}>
            <item.icon size={22} strokeWidth={2.5} />
          </div>
        </NavLink>
      ))}
    </nav>
  );
};

export default BottomNav;
