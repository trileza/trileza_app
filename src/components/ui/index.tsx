import React from 'react';
import { cn } from '../../utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  className,
  variant = 'primary',
  size = 'md',
  loading,
  children,
  ...props
}) => {
  const variants = {
    primary: 'bg-[linear-gradient(145deg,#43A047,#2E7D32)] text-[#06170C] hover:brightness-110 active:scale-95 shadow-lg shadow-emerald-500/10 focus-visible:ring-2 focus-visible:ring-[#66BB6A] focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    secondary: 'bg-surface-2 border border-border text-foreground hover:bg-surface-2-hover focus-visible:ring-2 focus-visible:ring-[#66BB6A]',
    outline: 'border border-border bg-transparent text-foreground hover:bg-surface focus-visible:ring-2 focus-visible:ring-[#66BB6A]',
    ghost: 'bg-transparent text-text-secondary hover:text-foreground hover:bg-surface focus-visible:ring-2 focus-visible:ring-[#66BB6A]',
    danger: 'bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-200 hover:bg-red-500/20 focus-visible:ring-2 focus-visible:ring-red-500',
    success: 'bg-[linear-gradient(145deg,#43A047,#2E7D32)] text-[#06170C] hover:brightness-110 shadow-lg shadow-emerald-500/10 focus-visible:ring-2 focus-visible:ring-[#66BB6A]',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs rounded-[10px]',
    md: 'px-5 py-2.5 text-sm rounded-[10px]',
    lg: 'px-7 py-3.5 text-base rounded-[10px]',
    icon: 'p-2.5 rounded-[10px]',
  };

  return (
    <button
      className={cn(
        'inline-flex items-center justify-center font-semibold transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:pointer-events-none focus:outline-none',
        variants[variant],
        sizes[size],
        className
      )}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? (
        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-[#06170C] border-t-transparent" />
      ) : null}
      {children}
    </button>
  );
};

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  glass?: boolean;
}

export const Card: React.FC<CardProps> = ({ className, glass, children, ...props }) => {
  return (
    <div
      className={cn(
        'rounded-2xl border-none bg-surface p-6 shadow-sm text-foreground transition-all duration-300',
        glass && 'glass',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export * from './Toast';
