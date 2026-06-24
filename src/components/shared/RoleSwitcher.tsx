import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { GraduationCap, Shield, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../../utils';

export const RoleSwitcher: React.FC = () => {
  const { user, activeRole, setActiveRole } = useAuthStore();
  const navigate = useNavigate();

  if (!user) return null;

  const isMentor = user.metadata?.mentor_onboarded === true;
  const isMentee = user.metadata?.mentee_onboarded === true;
  const isPendingMentor = user.metadata?.mentor_application_status === 'pending';
  const isDualRole = isMentor && isMentee;

  // Determine active state
  const isMenteeActive = activeRole === 'mentee';

  // ─── DUAL ROLE USER: THEMED SLIDING CONTROL PANEL (RELAXED & MINIMALIST) ───
  if (isDualRole) {
    return (
      <div className="relative group">
        {/* Soft, modern glowing backdrop aura */}
        <div
          className="absolute -inset-0.5 rounded-2xl blur-lg opacity-20 group-hover:opacity-35 transition-all duration-700 bg-gradient-to-r from-green-400 to-green-600"
        />

        {/* Minimalist Switcher container */}
        <div className="relative flex items-center p-1 rounded-2xl bg-slate-150/90 backdrop-blur-md border border-slate-200/60 shadow-sm min-w-[240px]">
          {/* Sliding active capsule */}
          <motion.div
            layoutId="activeRoleCapsule"
            className="absolute top-1 bottom-1 rounded-xl bg-white border border-slate-200 shadow-sm"
            transition={{
              type: "spring",
              stiffness: 350,
              damping: 22
            }}
            style={{
              left: isMenteeActive ? '4px' : 'calc(50% + 2px)',
              width: 'calc(50% - 6px)',
            }}
          />

          {/* Option A: Mentee */}
          <button
            onClick={() => { setActiveRole('mentee'); navigate('/'); }}
            className={cn(
              "flex-1 relative z-10 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 select-none min-w-[108px]",
              isMenteeActive
                ? "text-green-700"
                : "text-slate-500 hover:text-slate-800"
            )}
          >
            <GraduationCap size={15} className={isMenteeActive ? "text-green-700" : "text-slate-400"} />
            <span>Mentee</span>
          </button>

          {/* Option B: Mentor */}
          <button
            onClick={() => { setActiveRole('mentor'); navigate('/'); }}
            className={cn(
              "flex-1 relative z-10 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 select-none min-w-[108px]",
              !isMenteeActive
                ? "text-green-700"
                : "text-slate-500 hover:text-slate-805"
            )}
          >
            <Shield size={14} className={!isMenteeActive ? "text-green-700" : "text-slate-400"} />
            <span>Mentor</span>
          </button>
        </div>
      </div>
    );
  }

  // ─── SINGLE ROLE MENTOR: NO SWITCHER ───
  if (isMentor && !isMentee) {
    return null;
  }

  // ─── SINGLE ROLE MENTEE: MINIMALIST ADD ROLE BUTTON ───
  if (isMentee && !isMentor) {
    if (isPendingMentor) {
      return (
        <button
          disabled
          className="relative group overflow-hidden py-2.5 px-5 rounded-2xl bg-orange-50 border border-orange-200 flex items-center gap-2.5 shadow-sm select-none font-bold"
        >
          <div className="w-7 h-7 rounded-xl bg-orange-100 border border-orange-200 text-orange-700 flex items-center justify-center shrink-0 shadow-inner">
            <Shield size={13} />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-orange-700">
              Mentor App Pending
            </span>
          </div>
        </button>
      );
    }

    return (
      <button
        onClick={() => navigate('/mentor/onboarding')}
        className="relative group overflow-hidden py-2.5 px-5 rounded-2xl bg-white border border-slate-200 hover:border-green-400 flex items-center gap-2.5 shadow-sm hover:shadow-md transition-all duration-300 active:scale-98 select-none font-bold"
      >
        <div className="w-7 h-7 rounded-xl bg-green-50 border border-green-100 text-green-700 flex items-center justify-center shrink-0 shadow-inner">
          <Shield size={13} />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Become a Mentor
          </span>
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"></span>
          </span>
          <Sparkles size={11} className="text-green-500 animate-pulse" />
        </div>
      </button>
    );
  }

  return null;
};
