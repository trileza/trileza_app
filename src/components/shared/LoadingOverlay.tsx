import React from 'react';

interface LoadingOverlayProps {
  message?: string;
  submessage?: string;
  isFullPage?: boolean;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ 
  message = "", 
  submessage = "",
  isFullPage = true
}) => {
  const content = (
    <div className="flex flex-col items-center justify-center text-center space-y-4 relative z-10">
      {/* Single spinning ring */}
      <div className="w-10 h-10 rounded-full border-[3px] border-emerald-500/20 border-t-emerald-500 animate-spin" />
      {message && (
        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{message}</p>
      )}
      {submessage && (
        <p className="text-xs text-slate-400 dark:text-slate-500">{submessage}</p>
      )}
    </div>
  );

  if (!isFullPage) return content;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ backgroundColor: document.documentElement.classList.contains('dark') ? '#0A0E0D' : '#FFFFFF' }}>
      {content}
    </div>
  );
};
