/**
 * Global Call Manager — WebRTC Incoming/Outgoing Call Orchestrator
 * ──────────────────────────────────────────────────────────────────
 * Renders incoming call ringing overlays, outgoing calling screens,
 * and active Cloudflare RealtimeKit calls globally across Trileza LMS.
 */
import React from 'react';
import {
  Phone, PhoneOff, Video, Mic, MicOff, VideoOff, Monitor, MonitorOff,
  Maximize2, Minimize2, X, PhoneCall, Volume2, ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMessageStore } from '../../store/messageStore';
import { RealtimeKitCallOverlay } from './RealtimeKitCallOverlay';
import { cn } from '../../utils';

export const GlobalCallManager: React.FC = () => {
  const {
    signalingCall,
    acceptCall,
    declineCall,
    cancelCall,
    endCall,
    toggleMuteCall,
    toggleCameraCall,
    toggleScreenShareCall,
  } = useMessageStore();

  if (signalingCall.status === 'idle') return null;

  return (
    <AnimatePresence>
      {/* ── 1. INCOMING CALL RINGING SCREEN (RECEIVER) ── */}
      {signalingCall.status === 'incoming_ringing' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="fixed inset-0 z-[100] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full text-center text-white shadow-2xl relative overflow-hidden">
            {/* Glowing animated background rings */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
              <div className="w-64 h-64 rounded-full bg-green-500 animate-ping" />
            </div>

            {/* Caller Avatar with Pulse */}
            <div className="relative w-28 h-28 mx-auto mb-6">
              <div className="absolute inset-0 rounded-full bg-green-500/30 animate-pulse scale-125" />
              {signalingCall.partnerAvatar ? (
                <img
                  src={signalingCall.partnerAvatar}
                  alt=""
                  className="w-full h-full rounded-full object-cover border-4 border-green-500 relative z-10 shadow-xl"
                />
              ) : (
                <div className="w-full h-full rounded-full bg-green-600 border-4 border-green-400 flex items-center justify-center text-2xl font-black relative z-10 shadow-xl">
                  {signalingCall.partnerName.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>

            <h3 className="text-xl font-black font-sans text-white mb-1 tracking-tight">
              {signalingCall.partnerName}
            </h3>
            <p className="text-xs text-green-400 font-mono font-bold uppercase tracking-wider mb-6 flex items-center justify-center gap-1.5">
              <PhoneCall size={14} className="animate-bounce" />
              <span>Incoming {signalingCall.mode === 'video' ? 'Video Call' : 'Voice Call'}...</span>
            </p>

            {/* Accept / Decline Action Buttons */}
            <div className="flex items-center justify-center gap-8 pt-4">
              {/* Decline Button */}
              <button
                onClick={declineCall}
                className="flex flex-col items-center gap-2 group"
              >
                <div className="w-16 h-16 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow-lg transition-transform group-hover:scale-110">
                  <PhoneOff size={28} />
                </div>
                <span className="text-xs font-bold text-slate-400 font-sans">Decline</span>
              </button>

              {/* Accept Button */}
              <button
                onClick={acceptCall}
                className="flex flex-col items-center gap-2 group"
              >
                <div className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 text-white flex items-center justify-center shadow-lg transition-transform group-hover:scale-110 animate-bounce">
                  {signalingCall.mode === 'video' ? <Video size={28} /> : <Phone size={28} />}
                </div>
                <span className="text-xs font-bold text-green-400 font-sans">Accept Call</span>
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── 2. OUTGOING RINGING SCREEN (CALLER) ── */}
      {signalingCall.status === 'outgoing_ringing' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="fixed inset-0 z-[100] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full text-center text-white shadow-2xl relative overflow-hidden">
            {/* Avatar */}
            <div className="relative w-28 h-28 mx-auto mb-6">
              <div className="absolute inset-0 rounded-full bg-blue-500/20 animate-ping" />
              {signalingCall.partnerAvatar ? (
                <img
                  src={signalingCall.partnerAvatar}
                  alt=""
                  className="w-full h-full rounded-full object-cover border-4 border-slate-700 relative z-10"
                />
              ) : (
                <div className="w-full h-full rounded-full bg-slate-800 border-4 border-slate-700 flex items-center justify-center text-2xl font-black relative z-10">
                  {signalingCall.partnerName.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>

            <h3 className="text-xl font-black font-sans text-white mb-1 tracking-tight">
              {signalingCall.partnerName}
            </h3>
            <p className="text-xs text-blue-400 font-mono font-bold uppercase tracking-wider mb-6 animate-pulse">
              Ringing {signalingCall.mode === 'video' ? 'Video' : 'Voice'} Call...
            </p>

            {/* Cancel Action Button */}
            <div className="flex items-center justify-center pt-2">
              <button
                onClick={cancelCall}
                className="flex flex-col items-center gap-2 group"
              >
                <div className="w-16 h-16 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow-lg transition-transform group-hover:scale-110">
                  <PhoneOff size={28} />
                </div>
                <span className="text-xs font-bold text-slate-400 font-sans">Cancel</span>
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── 3. DECLINED / ENDED NOTIFICATION ── */}
      {(signalingCall.status === 'declined' || signalingCall.status === 'ended') && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed top-6 right-6 z-[100] bg-rose-600 text-white px-5 py-3 rounded-2xl shadow-xl font-sans text-xs font-bold flex items-center gap-2"
        >
          <PhoneOff size={16} />
          <span>
            {signalingCall.status === 'declined' ? 'Call Declined' : 'Call Ended'}
          </span>
        </motion.div>
      )}

      {/* ── 4. ACTIVE CONNECTED CALL WINDOW ── */}
      {signalingCall.status === 'connected' && (
        <RealtimeKitCallOverlay
          callState={{
            isOpen: true,
            mode: signalingCall.mode,
            title: signalingCall.title,
            partnerName: signalingCall.partnerName,
            partnerAvatar: signalingCall.partnerAvatar,
            groupId: signalingCall.groupId,
            isMuted: signalingCall.isMuted,
            isCameraOn: signalingCall.isCameraOn,
            isScreenSharing: signalingCall.isScreenSharing,
          }}
          onEndCall={endCall}
          onToggleMute={toggleMuteCall}
          onToggleCamera={toggleCameraCall}
          onToggleScreenShare={toggleScreenShareCall}
        />
      )}
    </AnimatePresence>
  );
};
