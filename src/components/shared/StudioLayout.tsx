import React, { Suspense, useEffect, useRef } from 'react';
import { RealtimeKitProvider } from '@cloudflare/realtimekit-react';
import { RtkMeeting, RtkParticipantsAudio } from '@cloudflare/realtimekit-react-ui';
import { applyRtkTheme } from '../../utils/dyteTheme';
import DashboardLayout from '../layout/DashboardLayout';
import { LoadingOverlay } from './LoadingOverlay';

interface StudioLayoutProps {
  meeting: any; // Dyte meeting object initialized with InsForge profile
  title?: string;
  subtitle?: string;
  isLoading?: boolean;
}

/**
 * StudioLayout: The high-fidelity wrapper for Dyte integration.
 * It encapsulates the video SDK within our custom Dashboard architecture,
 * ensuring the interface feels native and premium.
 */
const StudioLayout: React.FC<StudioLayoutProps> = ({ 
  meeting, 
  title = "Live Studio", 
  subtitle = "Interactive Learning Environment",
  isLoading = false
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Apply Agro-green & Glassmorphism design tokens to RealtimeKit shadow DOM
  useEffect(() => {
    if (containerRef.current) {
      applyRtkTheme(containerRef.current);
    }
  }, [meeting]);

  return (
    <DashboardLayout>
      <div className="flex flex-col space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Studio Command Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white uppercase leading-none">
              {title}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium italic">
              {subtitle}
            </p>
          </div>
          
          <div className="flex items-center gap-3 px-6 py-2.5 rounded-2xl bg-brand-primary/10 border border-brand-primary/20 backdrop-blur-sm">
            <span className="flex h-3 w-3 rounded-full bg-brand-primary animate-pulse shadow-[0_0_12px_rgba(46,125,50,0.8)]" />
            <span className="text-[10px] font-black text-brand-primary uppercase tracking-[0.2em]">
              Live Connection Node
            </span>
          </div>
        </div>

        {/* Video Stage: The Glassmorphism Container */}
        <div 
          ref={containerRef}
          className="relative w-full h-[75vh] min-h-[600px] rounded-[3rem] overflow-hidden border border-white/10 shadow-2xl bg-slate-900/60 backdrop-blur-xl ring-1 ring-white/10 transition-all duration-500 group"
        >
          <Suspense fallback={
            <div className="flex items-center justify-center w-full h-full bg-slate-900/40 backdrop-blur-xl">
              <LoadingOverlay isFullPage={false} message="Initializing Studio" submessage="Securing encrypted transmission tunnel..." />
            </div>
          }>
            {meeting && !isLoading ? (
              <RealtimeKitProvider value={meeting}>
                <div className="flex flex-col h-full w-full">
                  <RtkMeeting 
                    meeting={meeting} 
                    mode="fill" 
                    showSetupScreen={false}
                    className="w-full h-full"
                  />
                </div>
                <RtkParticipantsAudio meeting={meeting} />
              </RealtimeKitProvider>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-6">
                 <div className="w-24 h-24 rounded-[2.5rem] bg-white/5 flex items-center justify-center border border-white/10 shadow-inner group-hover:scale-110 group-hover:rotate-6 transition-all duration-700">
                    <span className="text-4xl animate-pulse">📡</span>
                 </div>
                 <div className="text-center">
                    <p className="font-black uppercase tracking-[0.2em] text-[11px] text-white/80">Awaiting Broadcast Node Synchronization</p>
                    <p className="text-[9px] text-slate-500 uppercase tracking-widest mt-2 font-bold">Ready to connect to global learning grid</p>
                 </div>
              </div>
            )}
          </Suspense>
        </div>

        {/* Unified Ecosystem Note */}
        <div className="flex items-center justify-center py-4">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.4em] opacity-40">
                Powered by Trileza Live Engine • Native WebRTC Node
            </p>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default StudioLayout;
