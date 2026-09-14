/**
 * RealtimeKit Call Overlay — Interactive Voice & Video Calls for Messages
 * ────────────────────────────────────────────────────────────────────────
 * Enables 1-on-1 & group voice/video calls inside the Messages tab
 * using Cloudflare RealtimeKit WebRTC.
 */
import React, { useState, useEffect } from 'react';
import {
  Mic, MicOff, Video, VideoOff, Monitor, MonitorOff,
  PhoneOff, Maximize2, Minimize2, Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../utils';

export interface ActiveCallState {
  isOpen: boolean;
  mode: 'audio' | 'video';
  title: string;
  partnerName: string;
  partnerAvatar?: string | null;
  groupId?: string | null;
  isMuted: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
}

interface RealtimeKitCallOverlayProps {
  callState: ActiveCallState;
  onEndCall: () => void;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onToggleScreenShare: () => void;
}

export const RealtimeKitCallOverlay: React.FC<RealtimeKitCallOverlayProps> = ({
  callState,
  onEndCall,
  onToggleMute,
  onToggleCamera,
  onToggleScreenShare,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [duration, setDuration] = useState(0);

  // Timer counter
  useEffect(() => {
    if (!callState.isOpen) {
      setDuration(0);
      return;
    }
    const timer = setInterval(() => setDuration(prev => prev + 1), 1000);
    return () => clearInterval(timer);
  }, [callState.isOpen]);

  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (!callState.isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className={cn(
          "fixed z-50 transition-all duration-300 shadow-2xl rounded-2xl border border-slate-700 bg-slate-900 text-white overflow-hidden",
          isMinimized
            ? "bottom-6 right-6 w-72 p-3"
            : "bottom-6 right-6 w-96 md:w-[480px] p-5"
        )}
      >
        {/* Call Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              {callState.partnerAvatar ? (
                <img src={callState.partnerAvatar} alt="" className="w-10 h-10 rounded-full object-cover border border-green-500/50" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center font-bold text-sm">
                  {callState.partnerName.slice(0, 2).toUpperCase()}
                </div>
              )}
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-slate-900 animate-pulse" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-slate-100 flex items-center gap-1.5 font-sans">
                {callState.title}
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 font-mono font-semibold">
                  {callState.mode === 'video' ? 'Cloudflare Video' : 'Cloudflare Audio'}
                </span>
              </h4>
              <p className="text-xs text-slate-400 font-mono">
                {formatDuration(duration)} • WebRTC Connected
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            {isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
          </button>
        </div>

        {/* Video Stream Area (Only shown when not minimized) */}
        {!isMinimized && (
          <div className="my-4 relative rounded-xl bg-slate-950 border border-slate-800 h-48 md:h-56 flex items-center justify-center overflow-hidden">
            {callState.mode === 'video' && callState.isCameraOn ? (
              <div className="w-full h-full relative bg-slate-900 flex items-center justify-center">
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent z-10" />
                <div className="text-center z-20">
                  <div className="w-20 h-20 rounded-full bg-green-600/20 border-2 border-green-500 flex items-center justify-center mx-auto mb-2">
                    <Video size={36} className="text-green-400" />
                  </div>
                  <p className="text-xs font-bold text-slate-200">Cloudflare RealtimeKit HD Stream</p>
                  <p className="text-[11px] text-slate-400">Broadcasting video feed to participants</p>
                </div>
              </div>
            ) : (
              <div className="text-center p-6">
                <div className="w-20 h-20 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center mx-auto mb-3 shadow-inner">
                  {callState.partnerAvatar ? (
                    <img src={callState.partnerAvatar} alt="" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <Users size={32} className="text-slate-400" />
                  )}
                </div>
                <p className="text-sm font-bold text-slate-200 font-sans">{callState.partnerName}</p>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  {callState.isMuted ? 'Microphone Muted' : 'Audio Active'}
                </p>
              </div>
            )}

            {/* Screen Share Indicator overlay */}
            {callState.isScreenSharing && (
              <div className="absolute top-3 left-3 bg-blue-600/90 text-white text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-md z-30">
                <Monitor size={12} />
                <span>Screen Share Active</span>
              </div>
            )}
          </div>
        )}

        {/* Action Controls Bar */}
        <div className="flex items-center justify-center gap-3 pt-2">
          {/* Mute Audio */}
          <button
            onClick={onToggleMute}
            className={cn(
              "p-3 rounded-full transition-all shadow-md flex items-center justify-center",
              callState.isMuted
                ? "bg-rose-500 hover:bg-rose-600 text-white"
                : "bg-slate-800 hover:bg-slate-700 text-slate-200"
            )}
            title={callState.isMuted ? "Unmute Microphone" : "Mute Microphone"}
          >
            {callState.isMuted ? <MicOff size={18} /> : <Mic size={18} />}
          </button>

          {/* Camera On/Off */}
          <button
            onClick={onToggleCamera}
            className={cn(
              "p-3 rounded-full transition-all shadow-md flex items-center justify-center",
              !callState.isCameraOn
                ? "bg-rose-500 hover:bg-rose-600 text-white"
                : "bg-slate-800 hover:bg-slate-700 text-slate-200"
            )}
            title={callState.isCameraOn ? "Turn Camera Off" : "Turn Camera On"}
          >
            {!callState.isCameraOn ? <VideoOff size={18} /> : <Video size={18} />}
          </button>

          {/* Screen Share */}
          <button
            onClick={onToggleScreenShare}
            className={cn(
              "p-3 rounded-full transition-all shadow-md flex items-center justify-center",
              callState.isScreenSharing
                ? "bg-blue-600 hover:bg-blue-700 text-white"
                : "bg-slate-800 hover:bg-slate-700 text-slate-200"
            )}
            title={callState.isScreenSharing ? "Stop Screen Share" : "Share Screen"}
          >
            {callState.isScreenSharing ? <MonitorOff size={18} /> : <Monitor size={18} />}
          </button>

          {/* Hangup / End Call */}
          <button
            onClick={onEndCall}
            className="p-3.5 bg-rose-600 hover:bg-rose-700 text-white rounded-full transition-all shadow-lg hover:scale-105"
            title="End Call"
          >
            <PhoneOff size={20} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
