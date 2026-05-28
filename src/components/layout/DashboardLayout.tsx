import React from 'react';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { RoleSwitcher } from '../shared/RoleSwitcher';
import { useAuthStore } from '../../store/authStore';
import { cn } from '../../utils';
import { CartButton, CartDrawer } from '../shared';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const location = useLocation();
  const { activeRole } = useAuthStore();
  const isMenteeActive = activeRole === 'mentee';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-slate-200/90 text-slate-800 flex overflow-hidden transition-colors duration-300">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <main className="flex-1 lg:ml-64 relative min-h-screen overflow-y-auto pb-24 lg:pb-8 transition-all duration-300">
        {/* Top-Right Premium Header Controls */}
        <div className="fixed top-4 right-4 md:top-6 md:right-8 z-50 flex items-center gap-3">
          <CartButton />
          <RoleSwitcher />
        </div>

        <div className="max-w-[1600px] mx-auto p-4 md:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <BottomNav />

      {/* Cart Drawer */}
      <CartDrawer />
      
      {/* Focus Mode Overlay Placeholder */}
      <div id="focus-mode-overlay" />
    </div>
  );
};

export default DashboardLayout;
