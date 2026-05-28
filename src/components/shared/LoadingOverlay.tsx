import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

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
    <div className="flex flex-col items-center justify-center text-center space-y-6 relative z-10">
      <div className="relative w-24 h-24">
        {/* Minimal Animated Ring */}
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 rounded-full border-[3px] border-emerald-500/10 border-t-emerald-500"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-20 h-20 flex items-center justify-center drop-shadow-md">
            <img src="/logo.png" alt="Loading" className="w-full h-full object-contain drop-shadow-lg scale-125" onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://api.dicebear.com/7.x/initials/svg?seed=Tr&backgroundColor=059669';
            }} />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {message && <h2 className="text-xl font-black text-slate-900 tracking-tight">{message}</h2>}
        <div className="flex flex-col items-center gap-3">
          <div className="w-32 h-1 bg-slate-100 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-indigo-500"
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>
          {submessage && (
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.25em] animate-pulse">
              {submessage}
            </p>
          )}
        </div>
      </div>
    </div>
  );

  if (!isFullPage) return content;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/80 backdrop-blur-xl">
      {content}
    </div>
  );
};
