/**
 * MeetingOverlay — App-Level Persistent Meeting Container
 * ───────────────────────────────────────────────────────
 * Renders at the App level (outside React Router routes) so the meeting
 * persists across sidebar tab navigation. Supports fullscreen and PiP modes.
 */
import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Maximize2, Mic, MicOff, Video, VideoOff, Users, Clock, X } from 'lucide-react';
import { useMeetingStore } from '../../store/meetingStore';

/**
 * Loaded on demand.
 *
 * This overlay renders outside the router so a call survives navigation, which
 * meant its static import of TrilezaMeeting pulled @cloudflare/realtimekit —
 * 3.5 MB, ~920 KB gzipped — into the initial bundle of EVERY page, including
 * the course catalog and the login screen. The component already returns null
 * unless a meeting is active, so the library is only fetched when one is.
 */
const TrilezaMeeting = React.lazy(() => import('./TrilezaMeeting'));

const PiPVideo: React.FC<{ track: MediaStreamTrack }> = ({ track }) => {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && track) {
      ref.current.srcObject = new MediaStream([track]);
    }
  }, [track]);
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted
      className="w-full h-full object-cover"
    />
  );
};

const MeetingOverlay: React.FC = () => {
  const navigate = useNavigate();
  const {
    isActive,
    isMinimized,
    authToken,
    displayName,
    avatarUrl,
    sessionTitle,
    sessionId,
    userId,
    userRole,
    meetingAudioEnabled,
    meetingVideoEnabled,
    isMuted,
    isCameraOn,
    participantCount,
    startTime,
    maximizeMeeting,
    deactivateMeeting,
    participants,
    rtkMeetingId,
  } = useMeetingStore();

  // ── Auto-routing on minimize ──
  useEffect(() => {
    if (isActive && isMinimized) {
      navigate('/');
    }
  }, [isMinimized, isActive]);

  const handleMaximize = () => {
    maximizeMeeting();
    if (rtkMeetingId) {
      navigate(`/live/${rtkMeetingId}`);
    }
  };

  // Don't render anything if no meeting is active
  if (!isActive || !authToken) return null;

  // Resolve dominant/active speaker video stream to show inside the PiP card
  const activeSpeaker = participants.find(p => p.isDominantSpeaker) || 
                        participants.find(p => p.role === 'teacher' && p.videoTrack) || 
                        participants.find(p => p.id === 'local' && p.videoTrack) || 
                        participants.find(p => p.videoTrack);
  const activeVideoTrack = activeSpeaker?.videoTrack;
  const activeSpeakerName = activeSpeaker?.displayName || 'Speaker';

  // ── PiP (Minimized) Mode ──
  if (isMinimized) {
    return (
      <PiPCard
        sessionTitle={sessionTitle}
        isMuted={isMuted}
        isCameraOn={isCameraOn}
        participantCount={participantCount}
        startTime={startTime}
        onMaximize={handleMaximize}
        onLeave={deactivateMeeting}
        videoTrack={activeVideoTrack}
        speakerName={activeSpeakerName}
      />
    );
  }

  // ── Fullscreen Meeting ──
  return (
    <div className="fixed inset-0 z-[9999] bg-slate-50">
      <React.Suspense fallback={
        <div className="flex items-center justify-center h-full w-full bg-slate-950 text-slate-400 font-bold text-sm gap-3">
          <span className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          Loading meeting room…
        </div>
      }>
        <TrilezaMeeting
          authToken={authToken}
          displayName={displayName}
          avatarUrl={avatarUrl}
          sessionTitle={sessionTitle || undefined}
          sessionId={sessionId}
          userId={userId}
          userRole={userRole}
          audioEnabled={meetingAudioEnabled}
          videoEnabled={meetingVideoEnabled}
          onLeave={deactivateMeeting}
        />
      </React.Suspense>
    </div>
  );
};

// ── PiP Floating Card ──

interface PiPCardProps {
  sessionTitle: string | null;
  isMuted: boolean;
  isCameraOn: boolean;
  participantCount: number;
  startTime: number | null;
  onMaximize: () => void;
  onLeave: () => void;
  videoTrack?: MediaStreamTrack;
  speakerName?: string;
}

const PiPCard: React.FC<PiPCardProps> = ({
  sessionTitle,
  isMuted,
  isCameraOn,
  participantCount,
  startTime,
  onMaximize,
  onLeave,
  videoTrack,
  speakerName,
}) => {
  const [elapsed, setElapsed] = React.useState('00:00');

  useEffect(() => {
    if (!startTime) return;
    const interval = setInterval(() => {
      const diff = Math.floor((Date.now() - startTime) / 1000);
      const mins = Math.floor(diff / 60);
      const secs = diff % 60;
      setElapsed(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.8, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.8, y: 20 }}
        className="fixed bottom-24 right-4 sm:right-6 z-[9999] w-64 sm:w-72 max-w-[calc(100vw-32px)] bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden font-sans cursor-pointer group"
        onClick={onMaximize}
      >
        {/* Header */}
        <div className="bg-emerald-500 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse shrink-0" />
            <span className="text-xs font-black text-white uppercase tracking-wider truncate">
              Live Session
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); onMaximize(); }}
              className="p-1.5 rounded-lg bg-white/20 text-white hover:bg-white/30 transition-all border-none cursor-pointer"
              title="Return to meeting"
            >
              <Maximize2 size={12} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onLeave(); }}
              className="p-1.5 rounded-lg bg-red-500/80 text-white hover:bg-red-600 transition-all border-none cursor-pointer"
              title="Leave meeting"
            >
              <X size={12} />
            </button>
          </div>
        </div>

        {/* Video feed in PiP if active speaker camera is enabled */}
        {videoTrack ? (
          <div className="h-32 sm:h-36 w-full bg-black relative overflow-hidden border-b border-slate-100">
            <PiPVideo track={videoTrack} />
            <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded text-[8px] font-black text-white uppercase tracking-wider">
              {speakerName || 'Speaker'}
            </div>
          </div>
        ) : null}

        {/* Body */}
        <div className="px-4 py-3 space-y-2">
          <p className="text-xs sm:text-sm font-bold text-slate-800 truncate">
            {sessionTitle || 'Live Classroom'}
          </p>

          <div className="flex items-center gap-3 text-[10px] sm:text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Clock size={12} className="text-slate-400" />
              <span className="font-bold tabular-nums">{elapsed}</span>
            </span>
            <span className="flex items-center gap-1">
              <Users size={12} className="text-emerald-500" />
              <span className="font-bold">{participantCount}</span>
            </span>
            <span className={`flex items-center gap-1 ${isMuted ? 'text-red-500' : 'text-emerald-500'}`}>
              {isMuted ? <MicOff size={12} /> : <Mic size={12} />}
            </span>
            <span className={`flex items-center gap-1 ${!isCameraOn ? 'text-red-500' : 'text-emerald-500'}`}>
              {isCameraOn ? <Video size={12} /> : <VideoOff size={12} />}
            </span>
          </div>
        </div>

        {/* Expand hint */}
        <div className="px-4 pb-3">
          {/* This card floats over the app, not the meeting, so it keeps the
              light palette the rest of the app uses. */}
          <div className="w-full py-2 rounded-xl bg-emerald-50 border border-emerald-100 text-center">
            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">
              Click to Return
            </span>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default MeetingOverlay;
