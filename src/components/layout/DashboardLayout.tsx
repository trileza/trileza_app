import React, { useRef, useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore, resolveActiveRole } from '../../store/authStore';
import { useMessageStore } from '../../store/messageStore';
import { cn } from '../../utils';
import { CartButton, CartDrawer } from '../shared';
import { GlobalCallManager } from '../messaging/GlobalCallManager';
import { PlusCircle, Menu } from 'lucide-react';

import BottomNav from './BottomNav';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, activeRole } = useAuthStore();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Global Realtime & Call Signaling listener initialization
  useEffect(() => {
    if (user?.id) {
      useMessageStore.getState().initialize(user.id);
    }
  }, [user?.id]);

  const derivedRole = (activeRole || resolveActiveRole(user) || 'mentee').toLowerCase();
  const isMentee = derivedRole === 'mentee';
  const isMenteeOnboarded = user?.metadata?.mentee_onboarded === true;
  const isMentor = derivedRole === 'mentor' || derivedRole === 'tutor';
  const isMentorOnboarded = user?.metadata?.mentor_onboarded === true;
  const isChatActive = location.pathname === '/messages' && new URLSearchParams(location.search).has('chat');

  const hasAccess = 
    (isMentee && isMenteeOnboarded) || 
    (isMentor && isMentorOnboarded) || 
    derivedRole === 'management' || 
    derivedRole === 'staff';

  const showNavigation = hasAccess;

  const showMobileHeaderAndNav = showNavigation && (!isChatActive || window.innerWidth >= 768);

  // ── Swipe Gestures Handling Disabled (As Requested) ──
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    // Disabled swipe navigation
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    // Disabled swipe navigation
  };

  return (
    <div 
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="min-h-screen bg-background text-foreground flex overflow-x-hidden transition-colors duration-300 pb-16 lg:pb-0"
    >
      {/* Sidebar (handles desktop static sidebar & mobile responsive overlay) */}
      {showNavigation && (
        <Sidebar 
          isOpenOnMobile={isMobileSidebarOpen} 
          onCloseMobile={() => setIsMobileSidebarOpen(false)} 
        />
      )}

      {/* Mobile Sidebar Backdrop Overlay */}
      {showNavigation && isMobileSidebarOpen && (
        <div 
          onClick={() => setIsMobileSidebarOpen(false)}
          className="lg:hidden fixed inset-0 bg-background/60 backdrop-blur-sm z-40 transition-opacity"
        />
      )}

      <main className={cn(
        "flex-1 relative min-h-screen pb-6 lg:pb-8 transition-all duration-300 main-content-area",
        showNavigation ? "lg:ml-64" : "lg:ml-0"
      )}>
        {/* Mobile Header Bar - Logo Only */}
        {showNavigation && (
          <header className="lg:hidden sticky top-0 z-30 bg-surface/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-border px-4 py-2 pt-safe flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <img 
                src="/logo.png" 
                alt="Trileza Logo" 
                className="h-10 w-auto object-contain scale-110 drop-shadow-sm" 
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://api.dicebear.com/7.x/initials/svg?seed=Tr&backgroundColor=16a34a';
                }}
              />
            </div>
            <CartButton />
          </header>
        )}

        {/* Top-Right Premium Header Controls - Desktop */}
        <div className="hidden md:flex fixed md:top-6 md:right-8 z-50 items-center gap-3">
          {showNavigation && <CartButton />}
        </div>

        <div className={cn("max-w-7xl mx-auto w-full", isChatActive ? "p-0 md:p-8" : "px-3 py-4 sm:p-4 md:p-8")}>
          <AnimatePresence mode="popLayout">
            <motion.div
              key={`${location.pathname}-${derivedRole}`}
              initial={{ opacity: 0, y: 2 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -2 }}
              transition={{ duration: 0.04, ease: 'easeOut' }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Bottom Navigation as Primary Navigation on Mobile */}
      {showNavigation && <BottomNav />}

      {/* Cart Drawer */}
      {showNavigation && <CartDrawer />}
      
      {/* Global RealtimeKit Call & Ringing Manager */}
      <GlobalCallManager />

      {/* Focus Mode Overlay Placeholder */}
      <div id="focus-mode-overlay" />
    </div>
  );
};

export default DashboardLayout;
