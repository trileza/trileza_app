import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, resolveActiveRole } from '../../store/authStore';
import { useSubscriptionStore } from '../../store/subscriptionStore';
import { GraduationCap, Shield, Building2, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../../utils';

export const RoleSwitcher: React.FC = () => {
  const { user, activeRole, setActiveRole } = useAuthStore();
  const navigate = useNavigate();

  if (!user) return null;

  // A dual profile requires an actual upgrade: Free Mentor, Pro Mentor or
  // Institutional. A plain mentee sees no toggle at all.
  //
  // `Boolean(user.tenant_id)` used to be one of these conditions, which made
  // every single user institutional: tenant_id defaults to 'default-tenant',
  // the shared marketplace tenant that everyone belongs to. So the toggle
  // appeared for mentees who had never upgraded to anything. Belonging to a
  // real institution means a tenant that is not the default one.
  const realTenantId =
    user.tenant_id && user.tenant_id !== 'default-tenant' ? user.tenant_id : null;

  const isInstitutionalUser =
    user.role === 'management' ||
    (user.role as string) === 'tenant_admin' ||
    user.role === 'staff' ||
    user.mentor_tier === 'institutional' ||
    user.metadata?.mentor_tier === 'institutional' ||
    user.metadata?.subscription_tier === 'institutional' ||
    Boolean(realTenantId);

  const isProUser = !isInstitutionalUser && (
    user.mentor_tier === 'pro' ||
    user.metadata?.mentor_tier === 'pro' ||
    user.metadata?.subscription_tier === 'pro'
  );

  const isFreeMentorUser = !isInstitutionalUser && !isProUser && (
    user.role === 'mentor' ||
    user.role === 'tutor' ||
    user.mentor_tier === 'free' ||
    user.metadata?.mentor_tier === 'free' ||
    user.metadata?.mentor_onboarded === true ||
    user.metadata?.mentor_application_status === 'approved'
  );

  const hasDualProfile = isInstitutionalUser || isProUser || isFreeMentorUser;

  // If user has not obtained a dual profile (pure mentee), NO toggle is shown
  if (!hasDualProfile) {
    return null;
  }

  const currentActive = activeRole || resolveActiveRole(user) || 'mentee';
  const currentRoleLower = (currentActive as string)?.toLowerCase() || '';

  const isMenteeActive = currentRoleLower === 'mentee';

  // Determine the secondary toggle details (Strictly 2 options maximum)
  let secondRoleKey = 'mentor';
  let secondRoleLabel = 'Free Mentor';
  let secondRoleIcon = Shield;
  let secondActiveBg = 'bg-amber-500 text-black';
  let secondLayoutId = 'role-amber';

  if (isInstitutionalUser) {
    secondRoleKey = 'management';
    secondRoleLabel = 'Institutional';
    secondRoleIcon = Building2;
    secondActiveBg = 'bg-emerald-600 text-white';
    secondLayoutId = 'role-emerald';
  } else if (isProUser) {
    secondRoleKey = 'mentor';
    secondRoleLabel = 'Pro Mentor';
    secondRoleIcon = Zap;
    secondActiveBg = 'bg-purple-600 text-white';
    secondLayoutId = 'role-purple';
  }

  const isSecondActive = !isMenteeActive;

  return (
    <div className="relative group w-full">
      <div className="relative flex items-center p-1 rounded-2xl bg-slate-900 border border-slate-800 w-full shadow-lg">
        {/* Animated Active Capsule Slider */}
        <motion.div
          layoutId="twoWayRoleCapsule"
          className={cn(
            "absolute top-1 bottom-1 rounded-xl shadow-md transition-colors duration-200",
            isMenteeActive ? "bg-white" : secondActiveBg
          )}
          transition={{
            type: "spring",
            stiffness: 450,
            damping: 28
          }}
          style={{
            left: isMenteeActive ? '4px' : 'calc(50% + 2px)',
            width: 'calc(50% - 6px)',
          }}
        />

        {/* Option 1: Mentee */}
        <button
          onClick={() => {
            if (!isMenteeActive) {
              setActiveRole('mentee');
              if (window.location.pathname !== '/') navigate('/');
            }
          }}
          className={cn(
            "flex-1 relative z-10 flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs uppercase tracking-wider select-none cursor-pointer transition-all duration-200",
            isMenteeActive 
              ? "text-slate-950 font-black" 
              : "text-slate-400 hover:text-white font-bold"
          )}
        >
          <GraduationCap size={14} className={isMenteeActive ? "text-slate-950 stroke-[2.5]" : "text-slate-400"} />
          <span>Mentee</span>
        </button>

        {/* Option 2: Tailored Secondary Role (Free Mentor | Pro Mentor | Institutional) */}
        <button
          onClick={() => {
            if (isMenteeActive) {
              setActiveRole(secondRoleKey as any);
              if (window.location.pathname !== '/') navigate('/');
            }
          }}
          className={cn(
            "flex-1 relative z-10 flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs uppercase tracking-wider select-none cursor-pointer transition-all duration-200 truncate",
            isSecondActive 
              ? "font-black" 
              : "text-slate-400 hover:text-white font-bold"
          )}
        >
          {React.createElement(secondRoleIcon, {
            size: 14,
            className: isSecondActive ? "stroke-[2.5]" : "text-slate-400"
          })}
          <span className="truncate">{secondRoleLabel}</span>
        </button>
      </div>
    </div>
  );
};

export default RoleSwitcher;
