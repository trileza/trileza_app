/**
 * MeetingControls — Bespoke White Theme Floating Control Bar
 * ───────────────────────────────────────────────────────────
 * Custom controls bar featuring side-by-side icons and labels.
 * Fixed: reactions use broadcastMessage, added fullscreen toggle.
 */
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic, MicOff, Video, VideoOff, Monitor, MonitorOff,
  Hand, MessageSquare, Users, PhoneOff, Circle, MoreHorizontal,
  Smile, Lock, Unlock, VolumeX, BarChart3, Boxes, Maximize, Minimize2,
  FileText,
} from 'lucide-react';
import { useMeetingStore } from '../../store/meetingStore';
import { RecordingOptionsModal } from './MeetingModals';

interface MeetingControlsProps {
  userRole: 'teacher' | 'student' | 'moderator';
}

const MeetingControls: React.FC<MeetingControlsProps> = ({ userRole }) => {
  const {
    isMuted, isCameraOn, isScreenSharing, isHandRaised, isRecording, recordingState,
    isRoomLocked, activePanel, unreadChatCount, isFullscreen,
    toggleMute, toggleCamera, toggleScreenShare, toggleHandRaise,
    toggleRecording, startLocalRecording, hangup, muteAll, setActivePanel, sendReaction, setFullscreen,
  } = useMeetingStore();

  const [showMore, setShowMore] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [showRecordingOptions, setShowRecordingOptions] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const reactionsRef = useRef<HTMLDivElement>(null);

  const isTeacher = userRole === 'teacher' || userRole === 'moderator';
  const reactions = ['👍', '❤️', '👏', '😂', '😮', '🎉', '🙌', '✋'];

  // Close popups on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setShowMore(false);
      }
      if (
        reactionsRef.current && 
        !reactionsRef.current.contains(e.target as Node) && 
        !(e.target as Element).closest?.('.reactions-popup-container')
      ) {
        setShowReactions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleReaction = (emoji: string) => {
    sendReaction(emoji);
    setShowReactions(false);
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  };

  const handleRecordClick = () => {
    if (isRecording || recordingState === 'RECORDING') {
      toggleRecording(); // Stop current recording
    } else {
      setShowRecordingOptions(true);
    }
  };

  const ControlButton: React.FC<{
    onClick: () => void;
    active?: boolean;
    danger?: boolean;
    badge?: number;
    label: string;
    icon: React.ReactNode;
    className?: string;
  }> = ({ onClick, active, danger, badge, label, icon, className }) => (
    <motion.button
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={`relative px-4 py-3 rounded-2xl flex items-center justify-center gap-2.5 transition-all duration-200 text-xs font-black uppercase tracking-wider border shadow-sm cursor-pointer shrink-0 ${
        danger
          ? 'bg-red-500 border-transparent text-white hover:bg-red-650'
          : active
            ? 'bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100/70'
            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
      } ${className || ''}`}
    >
      <span className="shrink-0">{icon}</span>
      <span className="hidden lg:inline shrink-0">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-emerald-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border border-white">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </motion.button>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="absolute bottom-0 left-0 right-0 z-30 p-4 sm:p-6 font-sans"
    >
      <div className="flex justify-center relative">
        <AnimatePresence>
          {showReactions && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute bottom-[calc(100%+12px)] bg-white border border-slate-200 rounded-3xl p-3 flex gap-2.5 shadow-2xl z-[9999] reactions-popup-container"
            >
              {reactions.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleReaction(emoji)}
                  className="w-11 h-11 rounded-2xl hover:bg-slate-100 flex items-center justify-center text-2xl transition-all hover:scale-125 border-none cursor-pointer bg-transparent"
                >
                  {emoji}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="bg-white border border-slate-200 rounded-[2.5rem] px-4 py-3 shadow-2xl flex items-center gap-2.5 sm:gap-3 flex-wrap justify-center max-w-full overflow-x-auto lg:overflow-visible no-scrollbar">
          {/* Mic */}
          <ControlButton
            onClick={toggleMute}
            active={!isMuted}
            icon={isMuted ? <MicOff size={16} /> : <Mic size={16} />}
            label={isMuted ? 'Unmute Audio' : 'Mute Audio'}
          />

          {/* Camera */}
          <ControlButton
            onClick={toggleCamera}
            active={isCameraOn}
            icon={isCameraOn ? <Video size={16} /> : <VideoOff size={16} />}
            label={isCameraOn ? 'Stop Video' : 'Start Video'}
          />

          {/* Screen Share */}
          <ControlButton
            onClick={toggleScreenShare}
            active={isScreenSharing}
            icon={isScreenSharing ? <MonitorOff size={16} /> : <Monitor size={16} />}
            label={isScreenSharing ? 'Stop Share' : 'Share Screen'}
          />

          {/* Divider */}
          <div className="w-px h-8 bg-slate-200 mx-1 hidden lg:block" />

          {/* Raise Hand */}
          <ControlButton
            onClick={toggleHandRaise}
            active={isHandRaised}
            icon={<Hand size={16} />}
            label={isHandRaised ? 'Lower Hand' : 'Raise Hand'}
          />

          {/* Reactions (via broadcastMessage) */}
          <div className="relative" ref={reactionsRef}>
            <ControlButton
              onClick={() => setShowReactions(!showReactions)}
              active={showReactions}
              icon={<Smile size={16} />}
              label="React"
            />
          </div>

          {/* Chat */}
          <ControlButton
            onClick={() => setActivePanel('chat')}
            active={activePanel === 'chat'}
            badge={unreadChatCount}
            icon={<MessageSquare size={16} />}
            label="Chat"
          />

          {/* Notes */}
          <ControlButton
            onClick={() => setActivePanel('notes')}
            active={activePanel === 'notes'}
            icon={<FileText size={16} />}
            label="Notes"
          />

          {/* Participants */}
          <ControlButton
            onClick={() => setActivePanel('participants')}
            active={activePanel === 'participants'}
            icon={<Users size={16} />}
            label="People"
          />

          {/* Divider */}
          <div className="w-px h-8 bg-slate-200 mx-1 hidden lg:block" />

          {/* Fullscreen Toggle */}
          <ControlButton
            onClick={toggleFullscreen}
            icon={isFullscreen ? <Minimize2 size={16} /> : <Maximize size={16} />}
            label={isFullscreen ? 'Exit FS' : 'Fullscreen'}
          />

          {/* Teacher / Host Controls */}
          {isTeacher && (
            <>
              {/* Record */}
              <ControlButton
                onClick={handleRecordClick}
                active={isRecording}
                icon={<Circle size={16} fill={isRecording ? '#ef4444' : 'none'} className={isRecording ? 'text-red-500 animate-pulse' : 'text-slate-500'} />}
                label={
                  recordingState === 'STARTING' ? 'Starting...' :
                  recordingState === 'RECORDING' ? 'Stop Rec' :
                  recordingState === 'STOPPING' ? 'Stopping...' :
                  'Record'
                }
              />

              {/* Polls */}
              <ControlButton
                onClick={() => setActivePanel('polls')}
                active={activePanel === 'polls'}
                icon={<BarChart3 size={16} />}
                label="Polls"
              />

              {/* Breakout Pods */}
              <ControlButton
                onClick={() => setActivePanel('pods')}
                active={activePanel === 'pods'}
                icon={<Boxes size={16} />}
                label="Breakouts"
              />

              {/* More (Mute All, Lock) */}
              <div className="relative" ref={moreRef}>
                <ControlButton
                  onClick={() => setShowMore(!showMore)}
                  icon={<MoreHorizontal size={16} />}
                  label="More"
                />
                <AnimatePresence>
                  {showMore && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute bottom-full mb-3 right-0 bg-white border border-slate-200 rounded-2xl p-2 min-w-[180px] shadow-2xl text-left z-50"
                    >
                      <button
                        onClick={() => { muteAll(); setShowMore(false); }}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-100 text-left transition-colors border-none bg-transparent cursor-pointer"
                      >
                        <VolumeX size={16} className="text-amber-500" />
                        <span className="text-xs font-black uppercase tracking-wider text-slate-700">Mute All</span>
                      </button>
                      <button
                        onClick={() => {
                          const { isRoomLocked } = useMeetingStore.getState();
                          useMeetingStore.setState({ isRoomLocked: !isRoomLocked });
                          setShowMore(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-100 text-left transition-colors border-none bg-transparent cursor-pointer"
                      >
                        {isRoomLocked
                          ? <><Unlock size={16} className="text-emerald-500" /><span className="text-xs font-black uppercase tracking-wider text-slate-700">Unlock Room</span></>
                          : <><Lock size={16} className="text-amber-500" /><span className="text-xs font-black uppercase tracking-wider text-slate-700">Lock Room</span></>
                        }
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </>
          )}

          {/* Leave */}
          <ControlButton
            onClick={hangup}
            danger
            icon={<PhoneOff size={16} />}
            label="Leave"
          />
        </div>
      </div>
      
      {/* Modals */}
      <RecordingOptionsModal 
        isOpen={showRecordingOptions}
        onClose={() => setShowRecordingOptions(false)}
        onSelectLocal={() => {
          setShowRecordingOptions(false);
          startLocalRecording();
        }}
        onSelectCloud={() => {
          setShowRecordingOptions(false);
          toggleRecording(); // Will start cloud recording if IDLE
        }}
      />
    </motion.div>
  );
};

export default MeetingControls;
