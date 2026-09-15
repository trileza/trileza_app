/**
 * TrilezaMeeting — Master Meeting Orchestrator (RealtimeKit v2.0)
 * ───────────────────────────────────────────────────────────────
 * Custom React WebRTC Meeting client using Cloudflare RealtimeKit.
 * Handles: video grid, screen share, reactions, fullscreen, recording sync.
 */
import React, { useEffect, useCallback, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MicOff, VideoOff, Maximize, Minimize, Hand, Monitor } from 'lucide-react';
import { useRealtimeKitClient } from '@cloudflare/realtimekit-react';

// Store
import { useMeetingStore, type FloatingReaction } from '../../store/meetingStore';

// Bespoke Components
import MeetingHeader from './MeetingHeader';
import MeetingControls from './MeetingControls';
import ChatPanel from './ChatPanel';
import ParticipantsPanel from './ParticipantsPanel';
import PollsPanel from './PollsPanel';
import BreakoutPodsManager from './BreakoutPodsManager';
import MeetingToast from './MeetingToast';
import { EndMeetingModal } from './MeetingModals';
import NotesPanel from './NotesPanel';

// Services
import { liveService } from '../../lib/services/live';
import { applyRtkTheme } from '../../utils/rtkTheme';

// ── Custom Video Track Renderer ────────────────────────────────────

const VideoTrack: React.FC<{ track: MediaStreamTrack; isLocal: boolean; isScreenShare?: boolean }> = ({ track, isLocal, isScreenShare }) => {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && track) {
      const stream = new MediaStream([track]);
      ref.current.srcObject = stream;
      return () => {
        if (ref.current) ref.current.srcObject = null;
      };
    }
  }, [track]);

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={isLocal}
      className={`w-full h-full ${isScreenShare ? 'object-contain bg-black' : 'object-cover'}`}
      style={isLocal && !isScreenShare ? { transform: 'scaleX(-1)' } : undefined}
    />
  );
};

const AudioTrack: React.FC<{ track: MediaStreamTrack }> = ({ track }) => {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (ref.current && track) {
      const stream = new MediaStream([track]);
      ref.current.srcObject = stream;
      return () => {
        if (ref.current) ref.current.srcObject = null;
      };
    }
  }, [track]);

  return <audio ref={ref} autoPlay />;
};

// ── Floating Reactions Renderer ────────────────────────────────────

const FloatingReactions: React.FC = () => {
  const { floatingReactions } = useMeetingStore();

  return (
    <div className="fixed bottom-32 right-6 z-[9998] pointer-events-none flex flex-col-reverse gap-2">
      <AnimatePresence>
        {floatingReactions.slice(-10).map(r => (
          <motion.div
            key={r.id}
            initial={{ opacity: 0, y: 30, scale: 0.3 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -60, scale: 0.3 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="flex items-center gap-2 bg-slate-900/90 backdrop-blur-md rounded-full px-4 py-2 shadow-2xl border border-slate-700"
          >
            <span className="text-2xl">{r.emoji}</span>
            <span className="text-[11px] font-bold text-slate-200">{r.senderName}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

// ── Main Orchestrator ──────────────────────────────────────────────

interface TrilezaMeetingProps {
  authToken: string;
  displayName: string;
  avatarUrl?: string;
  sessionTitle?: string;
  sessionId: string | null;
  userId: string;
  userRole: 'teacher' | 'student' | 'moderator';
  audioEnabled: boolean;
  videoEnabled: boolean;
  onLeave: () => void;
}

const TrilezaMeeting: React.FC<TrilezaMeetingProps> = ({
  authToken,
  displayName,
  avatarUrl,
  sessionTitle,
  sessionId,
  userId,
  userRole,
  audioEnabled,
  videoEnabled,
  onLeave,
}) => {
  const {
    activePanel,
    isJoined,
    participants,
    activeScreenShareParticipantId,
    isFullscreen,
    setMeeting,
    setJoined,
    addToast,
    addFloatingReaction,
    removeFloatingReaction,
    setParticipantHandRaise,
    syncPolls,
    setFullscreen,
    minimizeMeeting,
  } = useMeetingStore();

  const [rtkMeeting, initMeeting] = useRealtimeKitClient();
  const rootRef = useRef<HTMLDivElement>(null);
  const [showEndModal, setShowEndModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expandedParticipantId, setExpandedParticipantId] = useState<string | null>(null);
  const participantRecordRef = useRef<string | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const isHost = userRole === 'teacher' || userRole === 'moderator';

  // ── Brand the SDK's own shadow-DOM elements ──
  // Device pickers and permission prompts are drawn by RealtimeKit, not by us.
  // Without this they render in Cloudflare's stock palette.
  useEffect(() => {
    if (rootRef.current) applyRtkTheme(rootRef.current);
  }, []);

  // ── Fullscreen Handling ──
  useEffect(() => {
    const handleFullscreenChange = () => {
      setFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // ── Clean Leave ──
  const handleCleanLeave = useCallback(() => {
    if (participantRecordRef.current) {
      liveService.logParticipantLeave(participantRecordRef.current);
    }
    if (sessionId) {
      liveService.trackEvent(sessionId, 'participant_left', userId);
    }

    // Exit fullscreen if active
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }

    // Cleanup event listeners
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }

    onLeave();
  }, [sessionId, userId, onLeave]);

  // ── End Meeting (Host only) ──
  const handleEndMeeting = () => {
    if (sessionId) {
      liveService.updateStatus(sessionId, 'ended');
      liveService.trackEvent(sessionId, 'meeting_ended', userId);
      liveService.deleteSession(sessionId).catch(err => console.error('[Live] Failed to delete session:', err));
    }
    handleCleanLeave();
  };

  // ── Leave Trigger ──
  const handleLeaveClick = useCallback(() => {
    if (isHost) {
      setShowEndModal(true);
    } else {
      handleCleanLeave();
    }
  }, [isHost, handleCleanLeave]);

  // Bind store's hangup trigger
  useEffect(() => {
    useMeetingStore.setState({
      hangup: () => handleLeaveClick(),
    });
  }, [handleLeaveClick]);

  // ── Initialize RTK Client ──
  useEffect(() => {
    if (authToken && !rtkMeeting) {
      console.log('[RTK] Initializing Client...');
      initMeeting({
        authToken,
        defaults: {
          audio: audioEnabled,
          video: videoEnabled,
        },
      });
    }
  }, [authToken]);

  // ── RTK Core State Synchronization ──
  useEffect(() => {
    if (!rtkMeeting) return;

    setMeeting(rtkMeeting);
    const self = rtkMeeting.self;
    if (!self) return;

    // Join the meeting room
    rtkMeeting.join().then(() => {
      setJoined(true);
      setLoading(false);
      addToast('Connected to live classroom', 'success');

      // Sync local user states
      useMeetingStore.setState({
        isMuted: !self.audioEnabled,
        isCameraOn: self.videoEnabled,
        isScreenSharing: self.screenShareEnabled,
      });

      // Attendance log
      if (sessionId) {
        liveService.logParticipantJoin(sessionId, userId, displayName, userRole)
          .then(record => {
            if (record?.id) participantRecordRef.current = record.id;
          });
        liveService.trackEvent(sessionId, 'participant_joined', userId, {
          displayName,
          role: userRole,
        });
      }
    }).catch((err: any) => {
      console.error('[RTK] Join failed:', err);
      addToast('Failed to join video room', 'warning');
      setLoading(false);
    });

    // ── Unified participant sync ──
    const syncAllParticipants = () => {
      const activeList: any[] = [];
      const handRaisedIds = useMeetingStore.getState().handRaisedParticipantIds;

      // Local user
      activeList.push({
        id: 'local',
        displayName: self.name || displayName,
        avatarUrl: self.picture || avatarUrl,
        role: userRole,
        isMuted: !self.audioEnabled,
        isCameraOn: self.videoEnabled,
        isScreenSharing: self.screenShareEnabled,
        isHandRaised: useMeetingStore.getState().isHandRaised,
        isDominantSpeaker: false,
        videoTrack: self.videoTrack,
        audioTrack: self.audioTrack,
        screenShareTrack: self.screenShareTracks?.video || null,
      });

      // Remote participants
      const remotes = rtkMeeting.participants.joined.toArray();
      let screenShareParticipantId: string | null = null;

      remotes.forEach((p: any) => {
        const isTeacherRole = p.presetName?.includes('host') || p.presetName?.includes('teacher') || p.presetName?.includes('admin') || p.isHost;
        const isScreenSharing = p.screenShareEnabled;

        if (isScreenSharing) {
          screenShareParticipantId = p.id;
        }

        activeList.push({
          id: p.id,
          displayName: p.name || 'Guest',
          avatarUrl: p.picture,
          role: isTeacherRole ? 'teacher' : 'student',
          isMuted: !p.audioEnabled,
          isCameraOn: p.videoEnabled,
          isScreenSharing,
          isHandRaised: handRaisedIds.includes(p.id),
          isDominantSpeaker: p.id === rtkMeeting.participants.lastActiveSpeaker,
          videoTrack: p.videoTrack,
          audioTrack: p.audioTrack,
          screenShareTrack: p.screenShareTracks?.video || null,
        });
      });

      // Check if local user is screen sharing
      if (self.screenShareEnabled) {
        screenShareParticipantId = 'local';
      }

      useMeetingStore.setState({
        participants: activeList,
        participantCount: activeList.length,
        activeScreenShareParticipantId: screenShareParticipantId,
      });
    };

    // Initial sync
    syncAllParticipants();

    // ── Event Listeners ──

    // Participant map events
    const onParticipantJoined = (p: any) => {
      syncAllParticipants();
      addToast(`${p.name || 'Someone'} joined`, 'info');
    };
    const onParticipantLeft = (p: any) => {
      syncAllParticipants();
      addToast(`${p.name || 'Someone'} left`, 'info');
    };
    const onParticipantsUpdate = () => syncAllParticipants();

    rtkMeeting.participants.joined.on('participantJoined', onParticipantJoined);
    rtkMeeting.participants.joined.on('participantLeft', onParticipantLeft);
    rtkMeeting.participants.joined.on('participantsUpdate', onParticipantsUpdate);

    // Per-participant media events via the map's wildcard — for individual track updates
    rtkMeeting.participants.joined.on('videoUpdate', syncAllParticipants);
    rtkMeeting.participants.joined.on('audioUpdate', syncAllParticipants);
    rtkMeeting.participants.joined.on('screenShareUpdate', syncAllParticipants);

    // Self media events
    const onSelfVideoUpdate = () => {
      useMeetingStore.setState({ isCameraOn: self.videoEnabled });
      syncAllParticipants();
    };
    const onSelfAudioUpdate = () => {
      useMeetingStore.setState({ isMuted: !self.audioEnabled });
      syncAllParticipants();
    };
    const onSelfScreenShareUpdate = () => {
      useMeetingStore.setState({ isScreenSharing: self.screenShareEnabled });
      syncAllParticipants();
    };

    self.on('videoUpdate', onSelfVideoUpdate);
    self.on('audioUpdate', onSelfAudioUpdate);
    self.on('screenShareUpdate', onSelfScreenShareUpdate);

    // Self waitlist listener
    const onSelfWaitlisted = () => {
      syncAllParticipants();
    };
    self.on('waitlisted', onSelfWaitlisted);

    // ── Chat: chatUpdate event ──
    const onChatUpdate = ({ action, message }: any) => {
      if (action === 'add' && message) {
        const chatMsg = {
          id: message.id || `msg-${Date.now()}-${Math.random()}`,
          senderId: message.userId || '',
          senderName: message.displayName || 'Scholar',
          message: message.message || message.link || '',
          timestamp: message.time ? new Date(message.time).getTime() : Date.now(),
          isPrivate: !!(message.targetUserIds && message.targetUserIds.length > 0),
          type: message.type || 'text',
          link: message.link,
          fileName: message.name,
          fileSize: message.size,
          pinned: message.pinned || false,
          isEdited: message.isEdited || false,
        };
        useMeetingStore.getState().addChatMessage(chatMsg);
      } else if (action === 'edit' && message) {
        useMeetingStore.setState(s => ({
          chatMessages: s.chatMessages.map(m =>
            m.id === message.id ? { ...m, message: message.message || m.message, isEdited: true } : m
          ),
        }));
      } else if (action === 'delete' && message) {
        useMeetingStore.setState(s => ({
          chatMessages: s.chatMessages.filter(m => m.id !== message.id),
        }));
      }
    };
    rtkMeeting.chat.on('chatUpdate', onChatUpdate);

    // Pin/unpin events
    const onPinMessage = ({ message }: any) => {
      if (message) {
        useMeetingStore.setState(s => ({
          chatMessages: s.chatMessages.map(m =>
            m.id === message.id ? { ...m, pinned: true } : m
          ),
        }));
      }
    };
    const onUnpinMessage = ({ message }: any) => {
      if (message) {
        useMeetingStore.setState(s => ({
          chatMessages: s.chatMessages.map(m =>
            m.id === message.id ? { ...m, pinned: false } : m
          ),
        }));
      }
    };
    rtkMeeting.chat.on('pinMessage', onPinMessage);
    rtkMeeting.chat.on('unpinMessage', onUnpinMessage);

    // ── Polls ──
    const onPollsUpdate = ({ polls, newPoll }: any) => {
      syncPolls(polls || []);
      if (newPoll) {
        addToast('A new poll has been created!', 'info');
      }
    };
    rtkMeeting.polls.on('pollsUpdate', onPollsUpdate);
    // Sync initial polls
    if (rtkMeeting.polls.items) {
      syncPolls(rtkMeeting.polls.items);
    }

    // ── Recording ──
    const onRecordingUpdate = (state: string) => {
      useMeetingStore.setState({
        recordingState: state as any,
        isRecording: state === 'RECORDING',
      });
    };
    rtkMeeting.recording.on('recordingUpdate', onRecordingUpdate);

    // ── Broadcast Messages (Hand Raise + Reactions) ──
    const onBroadcastedMessage = ({ type, payload }: any) => {
      if (type === 'hand_raise' && payload) {
        // Find which participant sent this — use the sender's peer ID from payload
        // The broadcastedMessage event payload doesn't include peerId directly,
        // so we pass it in the broadcast payload
        const peerId = payload.peerId || payload.senderId;
        if (peerId) {
          setParticipantHandRaise(peerId, !!payload.raised);
          if (payload.raised) {
            const participant = useMeetingStore.getState().participants.find(p => p.id === peerId);
            addToast(`${participant?.displayName || 'Someone'} raised their hand ✋`, 'info');
          }
        }
      } else if (type === 'reaction' && payload) {
        const reactionId = `reaction-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        addFloatingReaction({
          id: reactionId,
          emoji: payload.emoji,
          senderName: payload.senderName || 'Someone',
          createdAt: Date.now(),
        });
        // Auto-remove after 5 seconds
        setTimeout(() => removeFloatingReaction(reactionId), 5000);
      }
    };
    rtkMeeting.participants.on('broadcastedMessage', onBroadcastedMessage);

    // ── Active Speaker ──
    const onActiveSpeaker = ({ peerId }: any) => {
      useMeetingStore.setState(s => ({
        participants: s.participants.map(p => ({
          ...p,
          isDominantSpeaker: p.id === peerId,
        })),
      }));
    };
    rtkMeeting.participants.on('activeSpeaker', onActiveSpeaker);

    // ── Lobby / Waitlist ──
    if (isHost && rtkMeeting.participants.waitlisted) {
      const syncLobby = () => {
        const list = rtkMeeting.participants.waitlisted.toArray();
        const formatted = list.map((w: any) => ({
          id: w.id,
          displayName: w.name || 'Guest',
        }));
        useMeetingStore.setState({ lobbyRequests: formatted });
      };

      rtkMeeting.participants.waitlisted.on('participantJoined', (w: any) => {
        syncLobby();
        addToast(`Join Request: ${w.name || 'Someone'} is waiting in the lobby`, 'info');
      });
      rtkMeeting.participants.waitlisted.on('participantLeft', syncLobby);
      syncLobby();
    }

    // ── Self roomLeft event (kicked or disconnected) ──
    const onRoomLeft = ({ state }: any) => {
      if (state === 'kicked') {
        addToast('You have been removed from the meeting', 'warning');
      }
    };
    self.on('roomLeft', onRoomLeft);

    // Store cleanup function
    cleanupRef.current = () => {
      rtkMeeting.participants.joined.removeListener('participantJoined', onParticipantJoined);
      rtkMeeting.participants.joined.removeListener('participantLeft', onParticipantLeft);
      rtkMeeting.participants.joined.removeListener('participantsUpdate', onParticipantsUpdate);
      rtkMeeting.participants.joined.removeListener('videoUpdate', syncAllParticipants);
      rtkMeeting.participants.joined.removeListener('audioUpdate', syncAllParticipants);
      rtkMeeting.participants.joined.removeListener('screenShareUpdate', syncAllParticipants);
      self.removeListener('videoUpdate', onSelfVideoUpdate);
      self.removeListener('audioUpdate', onSelfAudioUpdate);
      self.removeListener('screenShareUpdate', onSelfScreenShareUpdate);
      self.removeListener('roomLeft', onRoomLeft);
      self.removeListener('waitlisted', onSelfWaitlisted);
      rtkMeeting.chat.removeListener('chatUpdate', onChatUpdate);
      rtkMeeting.chat.removeListener('pinMessage', onPinMessage);
      rtkMeeting.chat.removeListener('unpinMessage', onUnpinMessage);
      rtkMeeting.polls.removeListener('pollsUpdate', onPollsUpdate);
      rtkMeeting.recording.removeListener('recordingUpdate', onRecordingUpdate);
      rtkMeeting.participants.removeListener('broadcastedMessage', onBroadcastedMessage);
      rtkMeeting.participants.removeListener('activeSpeaker', onActiveSpeaker);
    };

    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, [rtkMeeting, isHost]);

  // ── Auto-End Call When Empty (Inactivity) removed per user request ──

  // ── Render ──

  const isWaitlisted = rtkMeeting?.self?.roomState === 'waitlisted' || rtkMeeting?.self?.waitlistStatus === 'waiting';

  if (isWaitlisted) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950 flex items-center justify-center p-6 text-center text-white relative font-sans">
        {/* Background Ambience */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-emerald-500/5 rounded-full blur-[150px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-500/5 rounded-full blur-[150px]" />
        </div>
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-6 shadow-2xl relative z-10">
          <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto text-emerald-500">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-white">Waiting for Host</h2>
            <p className="text-slate-400 font-medium">
              The host has been notified. You will enter the live class as soon as you are approved.
            </p>
          </div>
          <button
            onClick={() => handleCleanLeave()}
            className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2 border-none cursor-pointer"
          >
            Cancel and Leave
          </button>
        </div>
      </div>
    );
  }

  // Find the screen-sharing participant
  const screenSharingParticipant = activeScreenShareParticipantId
    ? participants.find(p => p.id === activeScreenShareParticipantId)
    : null;

  const videoParticipants = expandedParticipantId
    ? participants.filter(p => p.id === expandedParticipantId)
    : participants;

  return (
    <div
      ref={rootRef}
      className="relative w-full h-full bg-slate-950 overflow-hidden flex flex-col justify-between font-sans"
    >
      {/* Background ambience. The surface is dark so video is the brightest
          thing on screen — on the previous near-white ground these glows were
          invisible and faces competed with the page for attention. */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[45%] h-[45%] bg-brand-primary/10 rounded-full blur-[130px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[45%] h-[45%] bg-brand-secondary/[0.07] rounded-full blur-[130px]" />
      </div>

      {/* Header */}
      <MeetingHeader sessionTitle={sessionTitle} onBack={handleLeaveClick} />

      {/* Floating Reactions Overlay */}
      <FloatingReactions />

      {/* Corner Trileza watermark logo */}
      {!loading && (
        <div className="absolute top-24 right-8 z-20 pointer-events-none opacity-80 animate-in fade-in duration-500">
          <img src="/icon-192.png" className="h-8 object-contain" alt="Trileza Logo" />
        </div>
      )}

      {/* Main Responsive Grid Area */}
      <div className="flex-1 w-full p-4 sm:p-8 flex z-10 overflow-hidden relative gap-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center bg-slate-900/60 backdrop-blur-sm border border-slate-800 p-10 rounded-[2.5rem] shadow-xl w-full">
            <img src="/icon-192.png" className="h-16 object-contain animate-pulse mb-6" alt="Trileza" />
            <div className="w-8 h-8 border-2 border-brand-secondary border-t-transparent rounded-full animate-spin" />
            <p className="mt-5 text-sm font-semibold text-slate-300">Joining the room…</p>
          </div>
        ) : (
          <>
            {/* Screen Share Area */}
            {screenSharingParticipant && screenSharingParticipant.screenShareTrack && !expandedParticipantId && (
              <div className="flex-1 flex flex-col gap-3 min-w-0">
                <div className="flex-1 bg-slate-950 rounded-[2.5rem] overflow-hidden relative shadow-[0_25px_60px_-15px_rgba(46, 125, 50,0.15)] border-2 border-emerald-500/20">
                  <VideoTrack track={screenSharingParticipant.screenShareTrack} isLocal={screenSharingParticipant.id === 'local'} isScreenShare />
                  
                  {/* Top-left Pulse Broadcast Indicator */}
                  <div className="absolute top-4 left-4 flex items-center gap-2 bg-emerald-500 text-white px-3.5 py-1.5 rounded-full shadow-md z-20 text-[9px] font-black uppercase tracking-wider animate-pulse">
                    <span className="w-1.5 h-1.5 bg-white rounded-full" />
                    Live Screen Broadcast
                  </div>

                  {/* Bottom-left User Tag */}
                  <div className="absolute bottom-4 left-4 flex items-center gap-2.5 bg-slate-900/85 backdrop-blur-md px-4 py-2 rounded-2xl border border-slate-700 shadow-lg z-20">
                    <div className="w-6 h-6 rounded-lg bg-brand-secondary/20 text-brand-accent flex items-center justify-center border border-brand-secondary/30 shrink-0">
                      <Monitor size={12} />
                    </div>
                    <span className="text-xs font-black text-white">
                      {screenSharingParticipant.displayName}'s Presentation
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Video Tiles */}
            <div className={`${
              screenSharingParticipant && screenSharingParticipant.screenShareTrack && !expandedParticipantId
                ? 'w-56 shrink-0 flex flex-col gap-3 overflow-y-auto no-scrollbar'
                : 'flex-1'
            }`}>
              <div
                className={`w-full h-full ${
                  screenSharingParticipant && screenSharingParticipant.screenShareTrack && !expandedParticipantId
                    ? 'flex flex-col gap-3'
                    : `max-w-7xl grid gap-4 sm:gap-6 transition-all duration-500 mx-auto ${
                        videoParticipants.length === 1 || expandedParticipantId
                          ? 'grid-cols-1 place-items-center'
                          : videoParticipants.length === 2
                          ? 'grid-cols-1 md:grid-cols-2 place-content-center'
                          : videoParticipants.length <= 4
                          ? 'grid-cols-1 sm:grid-cols-2 place-content-center'
                          : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 place-content-center'
                      }`
                }`}
              >
                {videoParticipants.map((p) => {
                  const hasVideo = p.isCameraOn && p.videoTrack;
                  const isSingleOrExpanded = videoParticipants.length === 1 || expandedParticipantId === p.id;
                  const isInSidebar = !!(screenSharingParticipant && screenSharingParticipant.screenShareTrack && !expandedParticipantId);

                  return (
                    <div
                      key={p.id}
                      className={`bg-slate-900 border rounded-[2rem] ${isInSidebar ? 'rounded-[1.5rem]' : 'sm:rounded-[3rem]'} overflow-hidden relative shadow-2xl flex items-center justify-center transition-all duration-300 w-full ${
                        isInSidebar
                          ? 'aspect-[4/3]'
                          : isSingleOrExpanded
                          ? 'max-h-full h-full'
                          : 'aspect-[4/3] sm:aspect-video'
                      } ${
                        p.isDominantSpeaker
                          ? 'border-brand-secondary ring-4 ring-brand-secondary/25 scale-[1.02]'
                          : 'border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {/* Remote Audio Track */}
                      {p.id !== 'local' && p.audioTrack && <AudioTrack track={p.audioTrack} />}

                      {/* Video Renderer */}
                      {hasVideo ? (
                        <VideoTrack track={p.videoTrack!} isLocal={p.id === 'local'} />
                      ) : (
                        <div className="flex flex-col items-center gap-4 bg-slate-900 w-full h-full justify-center">
                          <div className={`${isInSidebar ? 'w-14 h-14' : 'w-24 h-24 sm:w-32 sm:h-32'} rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden shadow-sm`}>
                            {p.avatarUrl ? (
                              <img src={p.avatarUrl} alt={p.displayName} className="w-full h-full object-cover" />
                            ) : (
                              <span className={`${isInSidebar ? 'text-xl' : 'text-4xl'} font-black text-brand-accent`}>
                                {p.displayName?.charAt(0)?.toUpperCase() || '?'}
                              </span>
                            )}
                          </div>
                          {!isInSidebar && (
                            <p className="text-[12px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                              <VideoOff size={14} /> Camera off
                            </p>
                          )}
                        </div>
                      )}

                      {/* Hand Raise Badge */}
                      {p.isHandRaised && (
                        <motion.div
                          animate={{ y: [0, -3, 0] }}
                          transition={{ duration: 1, repeat: Infinity }}
                          className="absolute top-3 right-3 w-8 h-8 bg-amber-500 rounded-xl flex items-center justify-center shadow-lg z-10"
                        >
                          <Hand size={16} className="text-white" />
                        </motion.div>
                      )}

                      {/* Bottom bar overlay */}
                      <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between pointer-events-none">
                        <div className="flex items-center gap-2 bg-slate-900/85 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700 shadow-sm pointer-events-auto">
                          <span className={`text-xs font-black text-white ${isInSidebar ? 'text-[10px]' : ''}`}>{p.displayName}</span>
                          {!isInSidebar && (
                            <span
                              className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md ${
                                p.role === 'teacher'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : 'bg-slate-800 text-slate-400 border border-slate-700'
                              }`}
                            >
                              {p.role === 'teacher' ? 'Host' : 'Student'}
                            </span>
                          )}
                        </div>

                        <div className="flex gap-2 pointer-events-auto">
                          {participants.length > 1 && !isInSidebar && (
                            <button
                              onClick={() => setExpandedParticipantId(expandedParticipantId === p.id ? null : p.id)}
                              className="w-8 h-8 rounded-xl bg-slate-900/85 backdrop-blur-md border border-slate-700 text-slate-300 flex items-center justify-center hover:bg-slate-800 hover:text-brand-accent transition-colors shadow-sm"
                              title={expandedParticipantId === p.id ? "Shrink" : "Expand"}
                            >
                              {expandedParticipantId === p.id ? <Minimize size={14} /> : <Maximize size={14} />}
                            </button>
                          )}

                          {p.isMuted && (
                            <div className="w-8 h-8 rounded-xl bg-red-500 border border-red-600 text-white flex items-center justify-center shadow-sm">
                              <MicOff size={14} />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Controls Bar */}
      {isJoined && <MeetingControls userRole={userRole} />}

      {/* Floating Reactions */}
      <FloatingReactions />

      {/* Toasts */}
      <MeetingToast />

      {/* Side Panels Container */}
      <div
        className={`absolute top-0 right-0 bottom-0 w-full sm:w-[380px] z-40 flex flex-col bg-slate-900 border-l border-slate-800 shadow-2xl font-sans transition-transform duration-300 ease-out ${
          activePanel !== 'none' && activePanel !== 'settings' ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {activePanel === 'chat' && <ChatPanel key="chat" />}
        {activePanel === 'participants' && (
          <ParticipantsPanel key="participants" userRole={userRole} />
        )}
        {activePanel === 'polls' && (
          <PollsPanel key="polls" userRole={userRole} />
        )}
        {activePanel === 'pods' && (
          <BreakoutPodsManager key="pods" sessionId={sessionId} userId={userId} />
        )}
        {activePanel === 'notes' && (
          <NotesPanel key="notes" sessionId={sessionId} sessionTitle={sessionTitle || ''} />
        )}
      </div>

      {/* End Meeting Modal */}
      <EndMeetingModal
        isOpen={showEndModal}
        onClose={() => setShowEndModal(false)}
        onConfirm={handleEndMeeting}
        isTeacher={userRole === 'teacher'}
      />
    </div>
  );
};

export default TrilezaMeeting;
