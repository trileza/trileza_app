/**
 * MeetingHeader — Bespoke Top Bar Overlay
 * ────────────────────────────────────────
 * Floats above the video grid. Shows: session title, live timer,
 * participant count, recording indicator, screen share indicator,
 * connection quality, back/minimize buttons, exit fullscreen.
 */
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ChevronLeft, Users, Clock, Circle, Lock, Unlock, WifiOff, Signal,
  Minimize2, Monitor,
} from 'lucide-react';
import { useMeetingStore } from '../../store/meetingStore';

interface MeetingHeaderProps {
  sessionTitle?: string;
  onBack: () => void;
  onMinimize?: () => void;
}

const MeetingHeader: React.FC<MeetingHeaderProps> = ({ sessionTitle, onBack, onMinimize }) => {
  const {
    participantCount, isRecording, recordingState, isRoomLocked,
    startTime, connectionQuality, isFullscreen, activeScreenShareParticipantId,
  } = useMeetingStore();

  const [elapsed, setElapsed] = useState('00:00');

  // Live timer
  useEffect(() => {
    if (!startTime) return;
    const interval = setInterval(() => {
      const diff = Math.floor((Date.now() - startTime) / 1000);
      const hrs = Math.floor(diff / 3600);
      const mins = Math.floor((diff % 3600) / 60);
      const secs = diff % 60;
      setElapsed(
        hrs > 0
          ? `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
          : `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
      );
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  const qualityColor = {
    excellent: 'text-emerald-400',
    good: 'text-emerald-400',
    fair: 'text-amber-400',
    poor: 'text-red-400',
    lost: 'text-red-500',
  }[connectionQuality];

  const qualityIcon = connectionQuality === 'lost'
    ? <WifiOff size={12} />
    : <Signal size={12} />;

  const handleExitFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="absolute top-0 left-0 right-0 z-30 p-3 sm:p-4 font-sans"
    >
      <div className="flex items-center justify-between bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl px-4 py-3 shadow-lg">
        {/* Left: Back + Minimize + Logo + Title */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="p-2 bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl transition-all active:scale-90 shrink-0"
            title="Leave meeting"
          >
            <ChevronLeft size={16} />
          </button>
          {onMinimize && (
            <button
              onClick={onMinimize}
              className="p-2 bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl transition-all active:scale-90 shrink-0"
              title="Minimize to PiP"
            >
              <Minimize2 size={16} />
            </button>
          )}
          <img src="/icon-192.png" className="h-8 object-contain shrink-0 hidden sm:block" alt="Trileza" />
          <div className="min-w-0">
            <h2 className="text-sm font-black text-white truncate flex items-center gap-2">
              {sessionTitle || 'Live Classroom'}
              <span className="px-2 py-0.5 rounded-full bg-brand-secondary/15 border border-brand-secondary/30 text-brand-accent text-[8px] font-black tracking-widest uppercase shrink-0">
                Live
              </span>
            </h2>
          </div>
        </div>

        {/* Right: Stats */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Screen Share Indicator */}
          {activeScreenShareParticipantId && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-300">
              <Monitor size={12} />
              <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">
                Sharing
              </span>
            </div>
          )}

          {/* Recording Indicator */}
          {(isRecording || recordingState === 'STARTING' || recordingState === 'STOPPING') && (
            <motion.div
              animate={{ opacity: isRecording ? [1, 0.5, 1] : 1 }}
              transition={{ duration: 1.5, repeat: isRecording ? Infinity : 0 }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border ${
                recordingState === 'STARTING' ? 'bg-amber-500/15 border-amber-500/30 text-amber-300' :
                recordingState === 'STOPPING' ? 'bg-slate-800/80 border-slate-700 text-slate-400' :
                'bg-red-500/15 border-red-500/30 text-red-300'
              }`}
            >
              <Circle size={8} fill={isRecording ? '#ef4444' : recordingState === 'STARTING' ? '#f59e0b' : '#94a3b8'} className={isRecording ? 'text-red-500' : ''} />
              <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">
                {recordingState === 'STARTING' ? 'Starting' : recordingState === 'STOPPING' ? 'Stopping' : 'REC'}
              </span>
            </motion.div>
          )}

          {/* Lock Status */}
          <div className={`p-2 border rounded-xl ${isRoomLocked ? 'bg-amber-500/15 border-amber-500/30 text-amber-300' : 'bg-slate-800/80 border-slate-700 text-slate-500'}`}>
            {isRoomLocked ? <Lock size={12} /> : <Unlock size={12} />}
          </div>

          {/* Timer */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-100">
            <Clock size={12} className="text-slate-500" />
            <span className="text-xs font-black tabular-nums">{elapsed}</span>
          </div>

          {/* Participants */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-100">
            <Users size={12} className="text-brand-accent" />
            <span className="text-xs font-black">{participantCount}</span>
          </div>

          {/* Connection Quality */}
          <div className={`p-2 border rounded-xl bg-slate-800/80 border-slate-700 ${qualityColor}`}>
            {qualityIcon}
          </div>

          {/* Exit Fullscreen Button */}
          {isFullscreen && (
            <button
              onClick={handleExitFullscreen}
              className="px-3 py-1.5 rounded-xl bg-slate-800 text-white text-[10px] font-black uppercase tracking-wider hover:bg-slate-700 transition-all border-none cursor-pointer"
            >
              Exit FS
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default MeetingHeader;
