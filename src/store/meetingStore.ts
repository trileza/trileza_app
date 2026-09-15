import { create } from 'zustand';
import { nexus } from '../lib/nexus';
import { useAuthStore } from './authStore';

// ── Types ──────────────────────────────────────────────────────────

export interface MeetingParticipant {
  id: string; // 'local' or RTK peer ID
  displayName: string;
  avatarUrl?: string;
  role: 'teacher' | 'student' | 'moderator';
  isMuted: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
  isHandRaised: boolean;
  isDominantSpeaker: boolean;
  videoTrack?: MediaStreamTrack;
  audioTrack?: MediaStreamTrack;
  screenShareTrack?: MediaStreamTrack; // screen share video track
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  message: string;
  timestamp: number;
  isPrivate: boolean;
  isAnnouncement?: boolean;
  type: 'text' | 'image' | 'file' | 'custom';
  link?: string;       // for image/file messages
  fileName?: string;    // for file messages
  fileSize?: number;    // for file messages
  pinned?: boolean;
  isEdited?: boolean;
}

export interface Poll {
  id: string;
  question: string;
  options: { text: string; votes: { id: string; name: string }[]; count: number }[];
  anonymous: boolean;
  hideVotes: boolean;
  createdBy: string;
  createdByUserId: string;
  voted: string[]; // user IDs who voted
}

export interface FloatingReaction {
  id: string;
  emoji: string;
  senderName: string;
  createdAt: number;
}

export type PanelView = 'none' | 'chat' | 'participants' | 'pods' | 'polls' | 'settings' | 'notes';

export type ConnectionQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'lost';

// ── Store Interface ────────────────────────────────────────────────

interface MeetingState {
  meeting: any | null; // RTK Client instance

  // ── Meeting Persistence (survives sidebar navigation) ──
  isActive: boolean;      // true when joined, false after leave
  isMinimized: boolean;   // true when PiP mode
  authToken: string | null;
  displayName: string;
  avatarUrl: string | undefined;
  sessionTitle: string | null;
  sessionId: string | null;
  userId: string;
  userRole: 'teacher' | 'student' | 'moderator';
  meetingAudioEnabled: boolean;
  meetingVideoEnabled: boolean;

  // ── Session info ──
  rtkMeetingId: string | null;
  isJoined: boolean;
  startTime: number | null;

  /**
   * When the room closes, as an epoch milliseconds value, or null if uncapped.
   *
   * Derived from the session's `started_at` and `duration_limit_minutes` — not
   * from when this particular client joined. A student arriving twenty minutes
   * late must see the same deadline as the host, which a locally-anchored
   * timer could not give them.
   */
  sessionDeadline: number | null;

  // ── Local user state ──
  isMuted: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
  isHandRaised: boolean;
  isRecording: boolean;
  recordingState: 'IDLE' | 'STARTING' | 'RECORDING' | 'PAUSED' | 'STOPPING';
  recordingType: 'local' | 'cloud' | null;
  recordingId: string | null;
  localMediaRecorder: MediaRecorder | null;

  // ── Room state ──
  isRoomLocked: boolean;
  participantCount: number;
  connectionQuality: ConnectionQuality;

  // ── Screen share ──
  activeScreenShareParticipantId: string | null;

  // ── Participants ──
  participants: MeetingParticipant[];

  // ── Hand raise tracking ──
  handRaisedParticipantIds: string[]; // peer IDs with raised hands

  // ── Reactions ──
  floatingReactions: FloatingReaction[];

  // ── Chat ──
  chatMessages: ChatMessage[];
  pinnedMessages: ChatMessage[];
  unreadChatCount: number;

  // ── Polls ──
  polls: Poll[];

  // ── UI state ──
  activePanel: PanelView;
  showPreJoin: boolean;
  isFullscreen: boolean;
  toasts: { id: string; message: string; type: 'info' | 'success' | 'warning' }[];

  // ── Lobby requests (moderation) ──
  lobbyRequests: { id: string; displayName: string }[];

  // ── Actions ──
  setMeeting: (meeting: any) => void;
  setSessionInfo: (sessionId: string, rtkMeetingId: string) => void;
  setJoined: (joined: boolean) => void;

  // Meeting persistence
  activateMeeting: (params: {
    authToken: string;
    displayName: string;
    avatarUrl?: string;
    sessionTitle?: string;
    sessionId: string | null;
    userId: string;
    userRole: 'teacher' | 'student' | 'moderator';
    audioEnabled: boolean;
    videoEnabled: boolean;
    rtkMeetingId: string | null;
    sessionDeadline?: number | null;
  }) => void;
  minimizeMeeting: () => void;
  maximizeMeeting: () => void;
  deactivateMeeting: () => void;

  // Local controls
  toggleMute: () => void;
  toggleCamera: () => void;
  toggleScreenShare: () => void;
  toggleHandRaise: () => void;
  toggleRecording: () => void; // Stops recording if active, otherwise should be triggered via modal
  startLocalRecording: () => void;
  stopLocalRecording: () => void;
  muteAll: () => void;
  hangup: () => void;

  muteParticipant: (id: string) => void;
  kickParticipant: (id: string) => void;
  spotlightParticipant: (id: string) => void;
  approveLobby: (id: string) => void;
  rejectLobby: (id: string) => void;

  // Chat
  addChatMessage: (msg: ChatMessage) => void;
  setChatMessages: (messages: ChatMessage[]) => void;
  sendChatMessage: (msg: string) => void;
  sendFileMessage: (file: File) => void;
  sendImageMessage: (file: File) => void;
  editChatMessage: (messageId: string, newText: string) => void;
  deleteChatMessage: (messageId: string) => void;
  pinMessage: (messageId: string) => void;
  unpinMessage: (messageId: string) => void;
  clearUnreadChat: () => void;

  // Lobby
  addLobbyRequest: (req: { id: string; displayName: string }) => void;
  removeLobbyRequest: (id: string) => void;

  // Polls
  addPoll: (question: string, options: string[], anonymous?: boolean, hideVotes?: boolean) => void;
  votePoll: (pollId: string, optionIndex: number) => void;
  syncPolls: (polls: Poll[]) => void;

  // Reactions
  sendReaction: (emoji: string) => void;
  addFloatingReaction: (reaction: FloatingReaction) => void;
  removeFloatingReaction: (id: string) => void;

  // Hand raise
  setParticipantHandRaise: (peerId: string, raised: boolean) => void;

  // UI Actions
  addToast: (message: string, type?: 'info' | 'success' | 'warning') => void;
  removeToast: (id: string) => void;
  setActivePanel: (panel: PanelView) => void;
  setShowPreJoin: (show: boolean) => void;
  setConnectionQuality: (q: ConnectionQuality) => void;
  setFullscreen: (fs: boolean) => void;

  // Reset
  reset: () => void;
}

// ── Initial State ──────────────────────────────────────────────────

const initialState = {
  meeting: null,

  // Meeting persistence
  isActive: false,
  isMinimized: false,
  authToken: null as string | null,
  displayName: '',
  avatarUrl: undefined as string | undefined,
  sessionTitle: null as string | null,
  sessionId: null as string | null,
  userId: '',
  userRole: 'student' as 'teacher' | 'student' | 'moderator',
  meetingAudioEnabled: true,
  meetingVideoEnabled: true,

  rtkMeetingId: null as string | null,
  sessionDeadline: null as number | null,
  isJoined: false,
  startTime: null as number | null,
  isMuted: true,
  isCameraOn: true,
  isScreenSharing: false,
  isHandRaised: false,
  isRecording: false,
  recordingState: 'IDLE' as 'IDLE' | 'STARTING' | 'RECORDING' | 'PAUSED' | 'STOPPING',
  recordingType: null as 'local' | 'cloud' | null,
  recordingId: null as string | null,
  localMediaRecorder: null as MediaRecorder | null,
  isRoomLocked: false,
  participantCount: 0,
  connectionQuality: 'good' as ConnectionQuality,
  activeScreenShareParticipantId: null as string | null,
  participants: [] as MeetingParticipant[],
  handRaisedParticipantIds: [] as string[],
  floatingReactions: [] as FloatingReaction[],
  lobbyRequests: [] as { id: string; displayName: string }[],
  chatMessages: [] as ChatMessage[],
  pinnedMessages: [] as ChatMessage[],
  unreadChatCount: 0,
  polls: [] as Poll[],
  activePanel: 'none' as PanelView,
  showPreJoin: true,
  isFullscreen: false,
  toasts: [] as { id: string; message: string; type: 'info' | 'success' | 'warning' }[],
};

// ── Store ──────────────────────────────────────────────────────────

export const useMeetingStore = create<MeetingState>((set, get) => ({
  ...initialState,

  setMeeting: (meeting) => set({ meeting }),
  setSessionInfo: (sessionId, rtkMeetingId) => set({ sessionId, rtkMeetingId }),
  setJoined: (joined) => set({ isJoined: joined, startTime: joined ? Date.now() : null }),

  // ── Meeting Persistence ──
  activateMeeting: (params) => set({
    isActive: true,
    isMinimized: false,
    authToken: params.authToken,
    displayName: params.displayName,
    avatarUrl: params.avatarUrl,
    sessionTitle: params.sessionTitle || null,
    sessionId: params.sessionId,
    userId: params.userId,
    userRole: params.userRole,
    meetingAudioEnabled: params.audioEnabled,
    meetingVideoEnabled: params.videoEnabled,
    showPreJoin: false,
    rtkMeetingId: params.rtkMeetingId,
    sessionDeadline: params.sessionDeadline ?? null,
  }),

  minimizeMeeting: () => set({ isMinimized: true }),
  maximizeMeeting: () => set({ isMinimized: false }),

  deactivateMeeting: () => {
    const { meeting } = get();
    if (meeting) {
      try { meeting.leave(); } catch { /* ignore */ }
    }
    set({
      ...initialState,
      showPreJoin: true,
    });
  },

  // ── Local Controls ──
  toggleMute: () => {
    const { meeting } = get();
    const self = meeting?.self;
    if (self) {
      if (self.audioEnabled) {
        self.disableAudio();
      } else {
        self.enableAudio();
      }
    }
  },

  toggleCamera: () => {
    const { meeting } = get();
    const self = meeting?.self;
    if (self) {
      if (self.videoEnabled) {
        self.disableVideo();
      } else {
        self.enableVideo();
      }
    }
  },

  toggleScreenShare: () => {
    const { meeting } = get();
    const self = meeting?.self;
    if (self) {
      if (self.screenShareEnabled) {
        self.disableScreenShare().catch((err: any) => console.error('[RTK] disableScreenShare error:', err));
      } else {
        self.enableScreenShare().catch((err: any) => console.error('[RTK] enableScreenShare error:', err));
      }
    }
  },

  toggleHandRaise: () => {
    const { meeting, isHandRaised } = get();
    if (meeting?.participants) {
      const nextState = !isHandRaised;
      // Broadcast hand raise state to all participants
      meeting.participants.broadcastMessage('hand_raise', {
        raised: nextState,
        timestamp: Date.now(),
      }).catch((err: any) => console.error('[RTK] broadcastMessage hand_raise error:', err));
      set({ isHandRaised: nextState });
    }
  },

  toggleRecording: async () => {
    const { meeting, recordingState, recordingType, stopLocalRecording, recordingId, rtkMeetingId, sessionTitle } = get();
    if (recordingState === 'RECORDING') {
      if (recordingType === 'local') {
        stopLocalRecording();
      } else {
        if (!recordingId) {
          console.error('[RTK] No active recordingId found to stop cloud recording');
          set({ recordingState: 'IDLE', recordingType: null });
          return;
        }
        
        set({ recordingState: 'STOPPING' });
        try {
          // The recording link is mailed to the session's host, whom the
          // backend resolves from the recording itself. Passing an address
          // from here would have let a caller redirect someone else's
          // recording to their own inbox.
          const { data, error } = await nexus.functions.invoke('dyte-meeting', {
            body: { action: 'stop_recording', recordingId }
          });
          if (error) throw error;
          console.log('[RTK] Stopped cloud recording successfully:', data);
          set({ recordingType: null, recordingId: null });
        } catch (err) {
          console.error('[RTK] Failed to stop cloud recording:', err);
          if (meeting?.recording) {
            meeting.recording.stop().catch(() => {});
          }
          set({ recordingState: 'IDLE', recordingType: null, recordingId: null });
        }
      }
    } else if (recordingState === 'IDLE' || recordingState === 'STOPPING') {
      if (recordingType === 'local') {
        // Stop local screen capture before switching
        return;
      }
      
      if (!rtkMeetingId) {
        console.error('[RTK] rtkMeetingId is required to start cloud recording');
        return;
      }
      
      set({ recordingState: 'STARTING', recordingType: 'cloud' });
      try {
        const { data, error } = await nexus.functions.invoke('dyte-meeting', {
          body: { action: 'start_recording', meetingId: rtkMeetingId }
        });
        if (error) throw error;
        console.log('[RTK] Started cloud recording successfully:', data);
        
        const newRecordingId = data?.data?.id || null;
        set({ recordingId: newRecordingId });
      } catch (err) {
        console.error('[RTK] Failed to start cloud recording:', err);
        if (meeting?.recording) {
          meeting.recording.start().catch(() => {});
        } else {
          set({ recordingState: 'IDLE', recordingType: null });
        }
      }
    }
  },

  startLocalRecording: async () => {
    const { meeting, rtkMeetingId } = get();
    if (!rtkMeetingId) {
      console.error('[RTK] rtkMeetingId is required to start local recording');
      return;
    }
    
    set({ recordingState: 'STARTING', recordingType: 'local' });
    try {
      const { data, error } = await nexus.functions.invoke('dyte-meeting', {
        body: { action: 'start_recording', meetingId: rtkMeetingId }
      });
      if (error) throw error;
      console.log('[RTK] Started local recording bot successfully:', data);
      
      const newRecordingId = data?.data?.id || null;
      set({ recordingId: newRecordingId });
    } catch (err) {
      console.error('[RTK] Failed to start local recording bot:', err);
      if (meeting?.recording) {
        meeting.recording.start().catch(() => {});
      } else {
        set({ recordingState: 'IDLE', recordingType: null });
      }
    }
  },

  stopLocalRecording: async () => {
    const { recordingId } = get();
    if (!recordingId) {
      console.error('[RTK] No recordingId found to stop local recording');
      set({ recordingState: 'IDLE', recordingType: null });
      return;
    }

    set({ recordingState: 'STOPPING' });
    try {
      const { data, error } = await nexus.functions.invoke('dyte-meeting', {
        body: { action: 'stop_recording', recordingId }
      });
      if (error) throw error;
      console.log('[RTK] Stopped local recording bot successfully:', data);

      const { addToast } = get();
      addToast('Compiling video. Your download will start automatically...', 'info');

      // Poll until the recording is ready and download it
      let attempts = 0;
      const maxAttempts = 30; // 30 * 4s = 120s max
      const pollInterval = setInterval(async () => {
        attempts++;
        try {
          const { data: checkData, error: checkError } = await nexus.functions.invoke('dyte-meeting', {
            body: { action: 'check_recording_status', recordingId }
          });

          if (!checkError && checkData?.success && checkData?.data) {
            const recording = checkData.data;
            if (recording.status === 'completed' && recording.download_url) {
              clearInterval(pollInterval);
              
              // Trigger the browser download!
              const a = document.createElement('a');
              document.body.appendChild(a);
              a.style.display = 'none';
              a.href = recording.download_url;
              a.target = '_blank';
              a.click();
              document.body.removeChild(a);

              addToast('Download started!', 'success');
              set({ isRecording: false, recordingState: 'IDLE', recordingType: null, recordingId: null });
            } else if (recording.status === 'failed') {
              clearInterval(pollInterval);
              addToast('Recording failed to compile.', 'warning');
              set({ isRecording: false, recordingState: 'IDLE', recordingType: null, recordingId: null });
            }
          }
        } catch (pollErr) {
          console.error('[Recording Status Poll Error]:', pollErr);
        }

        if (attempts >= maxAttempts) {
          clearInterval(pollInterval);
          addToast('Recording compile timed out. Check back later.', 'warning');
          set({ isRecording: false, recordingState: 'IDLE', recordingType: null, recordingId: null });
        }
      }, 4000);

    } catch (err) {
      console.error('[Recording] Failed to stop local recording:', err);
      set({ isRecording: false, recordingState: 'IDLE', recordingType: null, recordingId: null });
    }
  },

  muteAll: () => {
    const { meeting } = get();
    if (meeting?.participants) {
      meeting.participants.disableAllAudio(false).catch((err: any) => console.error('[RTK] disableAllAudio error:', err));
    }
  },

  hangup: () => {
    const { meeting } = get();
    meeting?.leave();
    set({ isJoined: false });
  },

  muteParticipant: (id: string) => {
    const { meeting } = get();
    if (meeting?.participants) {
      const p = meeting.participants.joined.toArray().find((x: any) => x.id === id);
      p?.disableAudio?.();
    }
  },

  kickParticipant: (id: string) => {
    const { meeting } = get();
    if (meeting?.participants) {
      const p = meeting.participants.joined.toArray().find((x: any) => x.id === id);
      p?.kick?.();
    }
  },

  spotlightParticipant: (id: string) => {
    const { meeting } = get();
    if (meeting?.participants) {
      const p = meeting.participants.joined.toArray().find((x: any) => x.id === id);
      p?.pin?.();
    }
  },

  approveLobby: (id: string) => {
    const { meeting } = get();
    if (meeting?.participants?.waitlisted) {
      meeting.participants.acceptWaitingRoomRequest(id);
    }
  },

  rejectLobby: (id: string) => {
    const { meeting } = get();
    if (meeting?.participants?.waitlisted) {
      meeting.participants.rejectWaitingRoomRequest(id);
    }
  },

  // ── Chat ──
  addChatMessage: (msg) => set((s) => ({
    chatMessages: [...s.chatMessages, msg],
    unreadChatCount: s.activePanel === 'chat' ? 0 : s.unreadChatCount + 1,
  })),

  setChatMessages: (messages) => set({ chatMessages: messages }),

  sendChatMessage: (message) => {
    const { meeting } = get();
    meeting?.chat.sendTextMessage(message);
  },

  sendFileMessage: (file) => {
    const { meeting } = get();
    meeting?.chat.sendFileMessage(file);
  },

  sendImageMessage: (file) => {
    const { meeting } = get();
    meeting?.chat.sendImageMessage(file);
  },

  editChatMessage: (messageId, newText) => {
    const { meeting } = get();
    meeting?.chat.editTextMessage(messageId, newText);
  },

  deleteChatMessage: (messageId) => {
    const { meeting } = get();
    meeting?.chat.deleteMessage(messageId);
  },

  pinMessage: (messageId) => {
    const { meeting } = get();
    meeting?.chat.pin(messageId);
  },

  unpinMessage: (messageId) => {
    const { meeting } = get();
    meeting?.chat.unpin(messageId);
  },

  clearUnreadChat: () => set({ unreadChatCount: 0 }),

  addLobbyRequest: (req) => set((s) => {
    if (s.lobbyRequests.some(x => x.id === req.id)) return {};
    return { lobbyRequests: [...s.lobbyRequests, req] };
  }),

  removeLobbyRequest: (id) => set((s) => ({
    lobbyRequests: s.lobbyRequests.filter(x => x.id !== id),
  })),

  // ── Polls ──
  addPoll: (question, options, anonymous = false, hideVotes = false) => {
    const { meeting } = get();
    if (meeting?.polls) {
      meeting.polls.create(question, options, anonymous, hideVotes);
    }
  },

  votePoll: (pollId, optionIndex) => {
    const { meeting } = get();
    if (meeting?.polls) {
      meeting.polls.vote(pollId, optionIndex);
    }
  },

  syncPolls: (polls) => set({ polls }),

  // ── Reactions ──
  sendReaction: (emoji) => {
    const { meeting, displayName, addFloatingReaction, removeFloatingReaction } = get();
    const senderName = displayName || 'Me';
    
    // Add reaction locally immediately so local user gets real-time feedback
    const reactionId = `reaction-local-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    addFloatingReaction({
      id: reactionId,
      emoji,
      senderName,
      createdAt: Date.now(),
    });
    setTimeout(() => removeFloatingReaction(reactionId), 5000);

    // Broadcast to other participants
    if (meeting?.participants?.broadcastMessage) {
      meeting.participants.broadcastMessage('reaction', {
        emoji: emoji,
        senderName: senderName,
        timestamp: Date.now(),
      }).catch((err: any) => console.error('[RTK] broadcastMessage reaction error:', err));
    }
  },

  addFloatingReaction: (reaction) => set((s) => ({
    floatingReactions: [...s.floatingReactions, reaction],
  })),

  removeFloatingReaction: (id) => set((s) => ({
    floatingReactions: s.floatingReactions.filter(r => r.id !== id),
  })),

  // ── Hand Raise ──
  setParticipantHandRaise: (peerId, raised) => set((s) => {
    const ids = new Set(s.handRaisedParticipantIds);
    if (raised) ids.add(peerId);
    else ids.delete(peerId);
    return {
      handRaisedParticipantIds: Array.from(ids),
      participants: s.participants.map(p =>
        p.id === peerId ? { ...p, isHandRaised: raised } : p
      ),
    };
  }),

  // ── UI Actions ──
  setActivePanel: (panel) => {
    const current = get().activePanel;
    set({
      activePanel: current === panel ? 'none' : panel,
      unreadChatCount: panel === 'chat' ? 0 : get().unreadChatCount,
    });
  },

  setShowPreJoin: (show) => set({ showPreJoin: show }),

  setFullscreen: (fs) => set({ isFullscreen: fs }),

  addToast: (message, type = 'info') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter(t => t.id !== id) }));
    }, 4000);
  },

  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter(t => t.id !== id) })),

  setConnectionQuality: (q) => set({ connectionQuality: q }),

  reset: () => set(initialState),
}));
