/**
 * RealtimeKit Call Overlay — Interactive Voice & Video Calls for Messages
 * ────────────────────────────────────────────────────────────────────────
 * Enables 1-on-1 & group voice/video calls inside the Messages tab
 * Peer-to-peer WebRTC, signalled over InsForge Realtime. Media travels
 * directly between the two devices and through no server of ours.
 */
import React, { useState, useEffect, useRef } from 'react';
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

  /** Live media, bound to the elements below. */
  localStream?: MediaStream | null;
  remoteStream?: MediaStream | null;
  /** Why the call has no media, when it has none. */
  mediaError?: string | null;
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

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  // Attach the streams to the elements.
  //
  // srcObject cannot be set as a JSX attribute — it takes a MediaStream, not
  // a string — so it has to be assigned against a ref once the element
  // exists. The remote stream goes to both the video and a hidden audio
  // element: on an audio-only call there is no video element mounted, and
  // without the audio tag the call connects and nobody hears anything.
  useEffect(() => {
    if (localVideoRef.current && callState.localStream) {
      localVideoRef.current.srcObject = callState.localStream;
    }
  }, [callState.localStream, callState.isCameraOn, isMinimized]);

  useEffect(() => {
    if (remoteVideoRef.current && callState.remoteStream) {
      remoteVideoRef.current.srcObject = callState.remoteStream;
    }
    if (remoteAudioRef.current && callState.remoteStream) {
      remoteAudioRef.current.srcObject = callState.remoteStream;
    }
  }, [callState.remoteStream, callState.isCameraOn, isMinimized]);

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
                  {callState.mode === 'video' ? 'Video call' : 'Voice call'}
                </span>
              </h4>
              <p className="text-xs text-slate-400 font-mono">
                {formatDuration(duration)} • {callState.remoteStream ? `Connected` : `Connecting…`}
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

        {/* The call's audio, outside every conditional.
            It must survive minimising and audio-only mode: if this were
            inside the video panel, collapsing the window would cut the
            sound mid-sentence. */}
        <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

        {/* Said plainly rather than left as a call that looks fine and
            carries nothing. */}
        {callState.mediaError && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-red-500/15 border border-red-500/30">
            <p className="text-[11px] font-bold text-red-300 leading-relaxed">
              {callState.mediaError}
            </p>
          </div>
        )}

        {/* Video Stream Area (Only shown when not minimized) */}
        {!isMinimized && (
          <div className="my-4 relative rounded-xl bg-slate-950 border border-slate-800 h-48 md:h-56 flex items-center justify-center overflow-hidden">
            {callState.mode === 'video' && callState.isCameraOn ? (
              /* The actual video, not a picture of one.
                 This panel used to show a green camera icon captioned
                 "Cloudflare RealtimeKit HD Stream" over an empty box — a
                 drawing of a call, with no stream behind it. The remote
                 feed fills the panel and the local preview sits in the
                 corner, which is the arrangement people already expect. */
              <div className="w-full h-full relative bg-slate-900">
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />

                {/* Muted, or the caller hears themselves back. */}
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="absolute bottom-3 right-3 w-24 h-32 object-cover rounded-lg border border-slate-700 shadow-lg bg-slate-950 z-20"
                />

                {/* Until the remote track arrives there is nothing to show,
                    so say so rather than leaving a black rectangle. */}
                {!callState.remoteStream && (
                  <div className="absolute inset-0 flex items-center justify-center z-10">
                    <p className="text-xs font-bold text-slate-400">Connecting video…</p>
                  </div>
                )}
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
