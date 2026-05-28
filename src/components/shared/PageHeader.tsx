import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../utils';

interface PageHeaderProps {
  title: React.ReactNode;
  description: React.ReactNode;
  tag: string;
  icon: LucideIcon;
  className?: string;
  rightContent?: React.ReactNode;
}

const PageHeader: React.FC<PageHeaderProps> = ({ 
  title, 
  description, 
  tag, 
  icon: Icon,
  className,
  rightContent
}) => {
  return (
    <div className={cn("flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-950 dark:bg-slate-900 p-8 md:p-12 rounded-[2.5rem] text-white shadow-2xl shadow-emerald-900/20 relative overflow-hidden mb-8", className)}>
      <div className="absolute -top-32 -left-32 w-80 h-80 bg-emerald-500 rounded-full blur-[100px] opacity-30 animate-pulse" />
      <div className="absolute right-0 bottom-0 w-80 h-80 bg-brand-primary rounded-full blur-[100px] opacity-20 translate-y-1/2 translate-x-1/3" />
      
      <div className="relative z-10 space-y-2 max-w-3xl">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-lg">
             <Icon className="text-emerald-400" size={20} />
          </div>
          <span className="text-emerald-400 font-black tracking-[0.2em] uppercase text-xs">{tag}</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white">{title}</h1>
        <p className="text-slate-300 dark:text-slate-400 font-medium text-lg mt-2 leading-relaxed">{description}</p>
      </div>

      {rightContent && (
        <div className="relative z-10 shrink-0">
          {rightContent}
        </div>
      )}
    </div>
  );
};

export default PageHeader;
