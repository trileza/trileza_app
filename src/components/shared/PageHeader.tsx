import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../utils';
import { useAuthStore, resolveActiveRole } from '../../store/authStore';

interface PageHeaderProps {
  title: React.ReactNode;
  description: React.ReactNode;
  tag: string;
  icon: LucideIcon;
  className?: string;
  rightContent?: React.ReactNode;
  variant?: 'mentor' | 'mentee' | 'default';
}

const PageHeader: React.FC<PageHeaderProps> = ({ 
  title, 
  description, 
  tag, 
  icon: Icon,
  className,
  rightContent,
  variant
}) => {
  const { activeRole, user } = useAuthStore();
  
  const currentRole = activeRole || resolveActiveRole(user) || 'mentee';
  const currentRoleLower = currentRole?.toLowerCase() || '';
  const isMentor = currentRoleLower === 'mentor' || currentRoleLower === 'tutor';
  const isMentorSection = variant === 'mentor' || (!variant && isMentor);

  return (
    <div 
      className={cn(
        isMentorSection ? "mentor-hero" : "mentee-hero",
        "flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 p-4 sm:p-8 md:p-12 rounded-2xl sm:rounded-[20px] text-white shadow-2xl relative overflow-hidden mb-4 sm:mb-6",
        className
      )}
    >
      {/* Dark scrim behind the text for AA contrast */}
      <div className="absolute inset-0 bg-gradient-to-r from-[rgba(8,20,14,0.78)] to-transparent pointer-events-none z-0" />

      {/* Role identity.
          Every dashboard shares the green ground above; this rail and the icon
          tint below are the only things that differ, which is what makes a
          Finance console read as distinct from a Mentor one without either
          leaving the design system. The colour comes from --role-accent, set by
          useRoleTheme() — no dashboard hardcodes its own hue. */}
      <div
        aria-hidden="true"
        className="absolute left-0 top-0 bottom-0 w-1.5 z-10"
        style={{ backgroundColor: 'var(--role-accent)' }}
      />
      <div
        aria-hidden="true"
        className="absolute -top-24 -right-16 w-72 h-72 rounded-full blur-[90px] opacity-25 pointer-events-none z-0"
        style={{ backgroundColor: 'var(--role-accent)' }}
      />

      <div className="relative z-10 space-y-1 sm:space-y-1.5 max-w-3xl">
        <div className="flex items-center gap-2 mb-1">
          <div
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white/10 backdrop-blur-md flex items-center justify-center shadow-lg border"
            style={{ borderColor: 'var(--role-accent-border)' }}
          >
             <Icon size={14} style={{ color: 'var(--role-accent)' }} />
          </div>
          <span className="section-eyebrow text-[10px] sm:text-xs">{tag}</span>
        </div>
        <h1 className="text-xl sm:text-3xl md:text-4xl lg:text-5xl font-black tracking-tight text-[#EAF2EA]">{title}</h1>
        <p className="text-xs sm:text-sm md:text-lg text-[#EAF2EA] font-medium leading-relaxed">{description}</p>
      </div>

      {rightContent && (
        <div className="relative z-10 shrink-0 mt-1 sm:mt-2 md:mt-0">
          {rightContent}
        </div>
      )}
    </div>
  );
};

export default PageHeader;
