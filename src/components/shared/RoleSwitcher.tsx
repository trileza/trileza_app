import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, resolveActiveRole } from '../../store/authStore';
import { GraduationCap, Shield, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../../utils';

export const RoleSwitcher: React.FC = () => {
  const { user, activeRole, setActiveRole } = useAuthStore();
  const navigate = useNavigate();

  if (!user) return null;

  const isMentorPermitted = 
    user.role === 'mentor' || 
    user.role === 'tutor' || 
    user.metadata?.mentor_onboarded === true || 
    user.metadata?.mentor_application_status === 'approved';

  const isDualRole = isMentorPermitted;

  // Determine active state
  const currentActive = activeRole || resolveActiveRole(user) || 'mentee';
  const isMenteeActive = currentActive === 'mentee';

  // ─── DUAL ROLE USER: THEMED SLIDING CONTROL PANEL (ORANGE TOGGLE) ───
  if (isDualRole) {
    return (
      <div className="relative group">
        {/* Soft, modern orange glowing backdrop aura */}
        <div
          className="absolute -inset-0.5 rounded-2xl blur-md opacity-25 group-hover:opacity-45 transition-all duration-500 bg-gradient-to-r from-orange-500 to-amber-500"
        />

        {/* Minimalist Switcher container (Orange) */}
        <div className="relative flex items-center p-1 rounded-2xl bg-orange-500 border border-orange-600 w-full shadow-lg">
          {/* Sliding active capsule */}
          <motion.div
            layoutId="activeRoleCapsule"
            className="absolute top-1 bottom-1 rounded-xl bg-white shadow-[0_2px_8px_rgba(0,0,0,0.18)]"
            transition={{
              type: "spring",
              stiffness: 400,
              damping: 25
            }}
            style={{
              left: isMenteeActive ? '4px' : 'calc(50% + 2px)',
              width: 'calc(50% - 6px)',
            }}
          />

          {/* Option A: Mentee */}
          <button
            onClick={() => {
              if (!isMenteeActive) {
                setActiveRole('mentee');
                if (window.location.pathname !== '/') {
                  navigate('/');
                }
              }
            }}
            className={cn(
              "flex-1 relative z-10 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 select-none cursor-pointer touch-target",
              isMenteeActive
                ? "text-slate-950 font-black"
                : "text-white/90 hover:text-white font-bold"
            )}
          >
            <GraduationCap size={15} className={isMenteeActive ? "text-slate-950 stroke-[2.5]" : "text-white/80"} />
            <span className="font-extrabold tracking-wide">Mentee</span>
          </button>

          {/* Option B: Mentor */}
          <button
            onClick={() => {
              if (isMenteeActive) {
                setActiveRole('mentor');
                if (window.location.pathname !== '/') {
                  navigate('/');
                }
              }
            }}
            className={cn(
              "flex-1 relative z-10 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 select-none cursor-pointer touch-target",
              !isMenteeActive
                ? "text-slate-950 font-black"
                : "text-white/90 hover:text-white font-bold"
            )}
          >
            <Shield size={14} className={!isMenteeActive ? "text-slate-950 stroke-[2.5]" : "text-white/80"} />
            <span className="font-extrabold tracking-wide">Mentor</span>
          </button>
        </div>
      </div>
    );
  }

  return null;
};
