import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Video, VideoOff, Mic, MicOff, ChevronLeft, Zap, Users,
} from 'lucide-react';

interface PreJoinScreenProps {
  roomName: string;
  displayName: string;
  avatarUrl?: string;
  sessionTitle?: string;
  hostName?: string;
  participantCount?: number;
  onJoin: (settings: { audio: boolean; video: boolean }) => void;
  onBack: () => void;
  onTitleChange?: (newTitle: string) => void;
}

const PreJoinScreen: React.FC<PreJoinScreenProps> = ({
  roomName,
  displayName,
  avatarUrl,
  sessionTitle,
  hostName = '',
  participantCount = 0,
  onJoin,
  onBack,
  onTitleChange,
}) => {
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState(false);
  const [titleVal, setTitleVal] = useState(sessionTitle || roomName);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Request camera access for preview.
  //
  // The cleanup tracks the stream this run acquired, in a local variable.
  // It previously read the `stream` state, which the closure captured from
  // the render that created the effect — so toggling the camera or mic
  // stopped the *previous* stream while the new one kept running, and the
  // last stream was never stopped at all. The camera stayed live (and its
  // indicator light on) after leaving the screen.
  useEffect(() => {
    let active = true;
    let acquired: MediaStream | null = null;

    const getStream = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: videoEnabled,
          audio: audioEnabled,
        });
        acquired = mediaStream;
        if (active) {
          setStream(mediaStream);
          setCameraError(false);
        } else {
          // Unmounted while getUserMedia was still resolving.
          mediaStream.getTracks().forEach(t => t.stop());
        }
      } catch {
        if (active) setCameraError(true);
      }
    };
    getStream();

    return () => {
      active = false;
      if (acquired) {
        acquired.getTracks().forEach(t => t.stop());
      }
    };
  }, [videoEnabled, audioEnabled]);

  // Attach stream to video element
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const handleJoin = () => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
    }
    
    // If camera/mic access failed, join as listener/viewer cleanly
    const finalAudio = cameraError ? false : audioEnabled;
    const finalVideo = cameraError ? false : videoEnabled;
    
    onJoin({ audio: finalAudio, video: finalVideo });
  };

  return (
    <div className="h-screen w-full bg-slate-950 flex items-center justify-center p-4 sm:p-8 relative overflow-hidden font-sans">
      {/* Background Video */}
      {videoEnabled && !cameraError ? (
        <div className="absolute inset-0 z-0">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover mirror"
            style={{ transform: 'scaleX(-1)' }}
          />
          {/* Subtle overlay so card is readable */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
        </div>
      ) : (
        <div className="absolute inset-0 z-0 bg-slate-900 flex flex-col items-center justify-center">
          <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-emerald-500/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-500/10 rounded-full blur-[120px]" />
          
          <div className="flex flex-col items-center justify-center gap-4 py-12 z-10 relative">
             <div className="w-24 h-24 rounded-full bg-slate-800/50 border border-slate-700 flex items-center justify-center overflow-hidden">
                {avatarUrl ? (
                   <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                ) : (
                   <span className="text-3xl font-black text-emerald-500">
                     {displayName?.charAt(0)?.toUpperCase() || '?'}
                   </span>
                )}
             </div>
             <p className="text-sm font-bold text-slate-500">
                {cameraError ? 'Camera unavailable' : 'Camera off'}
             </p>
          </div>
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Back Button */}
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-white/80 hover:text-white mb-6 transition-colors group drop-shadow-md"
        >
          <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          <span className="text-xs font-black uppercase tracking-widest">Back to Dashboard</span>
        </button>

        <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/50 rounded-[2.5rem] overflow-hidden shadow-2xl">
          {/* ── Join Info Panel ── */}
          <div className="p-8 flex flex-col gap-6 text-white">
            <div className="space-y-6">
              {/* Brand Logo & Sub-header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-700">
                <img src="/icon-192.png" alt="Trileza Logo" className="h-9 object-contain" />
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg">
                  Live Broadcast
                </span>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-0.5 block">
                  Meeting Name
                </label>
                <input
                  type="text"
                  value={titleVal}
                  onChange={(e) => {
                    setTitleVal(e.target.value);
                    onTitleChange?.(e.target.value);
                  }}
                  placeholder="Classroom Room Name"
                  className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-bold"
                />
                {hostName && (
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Hosted by: <span className="text-slate-200 font-extrabold">{hostName}</span>
                  </p>
                )}
              </div>

              {/* Session Stats */}
              {participantCount > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 w-fit">
                  <Users size={14} className="text-emerald-605" />
                  <span className="text-xs font-bold">
                    {participantCount} in session
                  </span>
                </div>
              )}

              {/* User Info & Camera Toggles */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-900 border border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center overflow-hidden shrink-0">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-base font-black text-emerald-400">
                        {displayName?.charAt(0)?.toUpperCase() || '?'}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-800 truncate">{displayName}</p>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                      Joining Member
                    </p>
                  </div>
                </div>

                {/* Mini Toggles */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAudioEnabled(!audioEnabled)}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 active:scale-90 shadow-sm ${
                      audioEnabled
                        ? 'bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-900'
                        : 'bg-red-500 text-white border-transparent hover:bg-red-600'
                    }`}
                  >
                    {audioEnabled ? <Mic size={14} /> : <MicOff size={14} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setVideoEnabled(!videoEnabled)}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 active:scale-90 shadow-sm ${
                      videoEnabled
                        ? 'bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-900'
                        : 'bg-red-500 text-white border-transparent hover:bg-red-600'
                    }`}
                  >
                    {videoEnabled ? <Video size={14} /> : <VideoOff size={14} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Join Button */}
            <div className="space-y-3 pt-2">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleJoin}
                className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-sm uppercase tracking-widest rounded-2xl shadow-xl shadow-emerald-500/20 transition-colors flex items-center justify-center gap-3 border-none cursor-pointer"
              >
                <Zap size={18} strokeWidth={3} />
                JOIN LIVE CLASSROOM
              </motion.button>
              <p className="text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                Powered by Trileza Engine
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default PreJoinScreen;
