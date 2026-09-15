/**
 * MeetingHeader — Bespoke Top Bar Overlay
 * ────────────────────────────────────────
 * Floats above the video grid. Shows: session title, live timer,
 * participant count, recording indicator, screen share indicator,
 * connection quality, back/minimize buttons, exit fullscreen.
 */
import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  ChevronLeft, Users, Clock, Circle, Lock, Unlock, WifiOff, Signal,
  Minimize2, Monitor, Hourglass,
} from 'lucide-react';
import { useMeetingStore } from '../../store/meetingStore';
import { WARNING_THRESHOLDS } from '../../config/sessionLimits';

interface MeetingHeaderProps {
  sessionTitle?: string;
  onBack: () => void;
  onMinimize?: () => void;
}

const MeetingHeader: React.FC<MeetingHeaderProps> = ({ sessionTitle, onBack, onMinimize }) => {
  const {
    participantCount, isRecording, recordingState, isRoomLocked,
    startTime, connectionQuality, isFullscreen, activeScreenShareParticipantId,
    sessionDeadline, addToast, forceLeave,
  } = useMeetingStore();

  const [elapsed, setElapsed] = useState('00:00');
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  // Thresholds already announced, so each warning fires once rather than on
  // every tick after it is crossed.
  const warnedRef = useRef<Set<number>>(new Set());
  const endedRef = useRef(false);

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

  // ── Session countdown ──
  // Recomputed from the shared deadline on every tick rather than decremented,
  // so a backgrounded tab (where timers are throttled) still shows the true
  // remaining time when it comes back rather than a drifted one.
  useEffect(() => {
    if (!sessionDeadline) {
      setRemainingMs(null);
      return;
    }

    const tick = () => {
      const left = sessionDeadline - Date.now();
      setRemainingMs(left);

      if (left <= 0) {
        // Leave once. forceLeave() unmounts this component, but a throttled tab
        // can fire the interval again before that happens.
        if (!endedRef.current) {
          endedRef.current = true;
          addToast('Session time limit reached. Ending the room…', 'warning');
          setTimeout(() => forceLeave(), 1200);
        }
        return;
      }

      const minutesLeft = Math.ceil(left / 60_000);
      for (const threshold of WARNING_THRESHOLDS) {
        if (minutesLeft <= threshold && !warnedRef.current.has(threshold)) {
          warnedRef.current.add(threshold);
          addToast(
            threshold === 1
              ? 'One minute left in this session.'
              : `${threshold} minutes left in this session.`,
            'warning'
          );
          break;
        }
      }
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [sessionDeadline, addToast, forceLeave]);

  /** mm:ss, or h:mm:ss past an hour. */
  const formatRemaining = (ms: number): string => {
    const total = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  };

  // Urgency shifts as the end approaches: neutral, then amber under ten
  // minutes, then red under two.
  const remainingMinutes = remainingMs === null ? null : remainingMs / 60_000;
  const countdownTone =
    remainingMinutes === null ? ''
    : remainingMinutes <= 2 ? 'bg-red-500/15 border-red-500/30 text-red-300'
    : remainingMinutes <= 10 ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
    : 'bg-slate-800/80 border-slate-700 text-slate-100';

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

          {/* Time remaining. Shown to everyone: a student needs to know when
              the class ends as much as the host does. */}
          {remainingMs !== null && (
            <motion.div
              animate={remainingMinutes !== null && remainingMinutes <= 2 ? { opacity: [1, 0.55, 1] } : { opacity: 1 }}
              transition={{ duration: 1.5, repeat: remainingMinutes !== null && remainingMinutes <= 2 ? Infinity : 0 }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border ${countdownTone}`}
              title="Time remaining in this session"
            >
              <Hourglass size={12} />
              <span className="text-xs font-black tabular-nums">
                {formatRemaining(remainingMs)}
              </span>
              <span className="text-[9px] font-black uppercase tracking-widest hidden sm:inline opacity-70">
                left
              </span>
            </motion.div>
          )}

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
