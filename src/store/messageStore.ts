/**
 * Message Store — Global Messaging & RealtimeKit State (Zustand)
 * ─────────────────────────────────────────────────────────────────
 * Manages: DMs, Cloudflare RealtimeKit groups, file/image attachments,
 * message pinning, editing, deletion, typing indicators, read receipts,
 * and 1-on-1 / group audio & video calls with WebRTC signaling & ringing.
 */
import { create } from 'zustand';
import { nexus } from '../lib/nexus';
import { messageService, type ConversationPartner, type Message } from '../lib/services/messages';
import {
  realtimekitMessagingService,
  type RealtimeKitMessage,
  type GroupChat,
  type GroupMember,
} from '../lib/services/realtimekitMessages';
import { callAudioRinger } from '../utils/callAudioRinger';
import { useAuthStore } from './authStore';

export interface SignalingCallState {
  callId: string | null;
  status: 'idle' | 'outgoing_ringing' | 'incoming_ringing' | 'connected' | 'declined' | 'ended';
  mode: 'audio' | 'video';
  title: string;
  partnerId: string | null;
  partnerName: string;
  partnerAvatar?: string | null;
  groupId?: string | null;
  isMuted: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
}

interface MessageStore {
  // Conversations (DMs)
  conversations: ConversationPartner[];
  conversationsLoading: boolean;
  
  // Active chat (DM or Group)
  activePartnerId: string | null;
  activePartner: ConversationPartner | null;
  activeGroupId: string | null;
  activeGroup: GroupChat | null;
  groupMembers: GroupMember[];
  
  // RealtimeKit Groups
  rtkGroups: GroupChat[];
  groupsLoading: boolean;

  // Messages & Pinning
  messages: Message[];
  messagesLoading: boolean;
  hasMoreMessages: boolean;
  pinnedMessageIds: string[];
  
  // Search
  searchResults: any[];
  searchLoading: boolean;
  
  // Typing & Unread
  typingPartners: Map<string, boolean>;
  totalUnreadCount: number;
  
  // Realtime
  realtimeConnected: boolean;

  // RealtimeKit Active Call with WebRTC Signaling
  signalingCall: SignalingCallState;

  // Actions
  initialize: (userId: string) => Promise<void>;
  loadConversations: (userId: string) => Promise<void>;
  loadGroups: (userId: string) => Promise<void>;
  createGroup: (
    userId: string,
    userName: string,
    userAvatar: string | null,
    name: string,
    desc: string,
    isPrivate: boolean,
    memberIds: string[]
  ) => Promise<GroupChat>;
  openConversation: (userId: string, partnerId: string) => Promise<void>;
  openGroup: (userId: string, groupId: string) => Promise<void>;
  closeConversation: () => void;
  sendMessage: (
    userId: string,
    content: string,
    senderName?: string,
    senderAvatar?: string | null,
    highlightData?: any
  ) => Promise<void>;
  sendAttachmentMessage: (
    userId: string,
    userName: string,
    userAvatar: string | null,
    file: File
  ) => Promise<void>;
  pinMessage: (messageId: string) => Promise<void>;
  unpinMessage: (messageId: string) => Promise<void>;
  editMessage: (messageId: string, newContent: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  addGroupMember: (groupId: string, user: { id: string; name: string; avatar?: string }) => Promise<void>;
  removeGroupMember: (groupId: string, userId: string) => Promise<void>;
  loadMoreMessages: (userId: string) => Promise<void>;
  searchUsers: (query: string, userId: string) => Promise<void>;
  clearSearch: () => void;
  publishTyping: (userId: string, targetId: string) => void;
  
  // WebRTC Call Signaling Actions
  initiateCall: (
    userId: string,
    partnerId: string,
    partnerName: string,
    partnerAvatar: string | null,
    mode: 'audio' | 'video',
    title: string,
    groupId?: string | null
  ) => void;
  acceptCall: () => void;
  declineCall: () => void;
  cancelCall: () => void;
  endCall: () => void;
  toggleMuteCall: () => void;
  toggleCameraCall: () => void;
  toggleScreenShareCall: () => void;
  
  cleanup: () => void;
}

let ringingTimeoutTimer: ReturnType<typeof setTimeout> | null = null;

export const useMessageStore = create<MessageStore>((set, get) => {
  let typingTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  let localTypingTimer: ReturnType<typeof setTimeout> | null = null;

  return {
    conversations: [],
    conversationsLoading: false,
    activePartnerId: null,
    activePartner: null,
    activeGroupId: null,
    activeGroup: null,
    groupMembers: [],
    rtkGroups: [],
    groupsLoading: false,
    messages: [],
    messagesLoading: false,
    hasMoreMessages: true,
    pinnedMessageIds: [],
    searchResults: [],
    searchLoading: false,
    typingPartners: new Map(),
    totalUnreadCount: 0,
    realtimeConnected: false,

    signalingCall: {
      callId: null,
      status: 'idle',
      mode: 'video',
      title: '',
      partnerId: null,
      partnerName: '',
      partnerAvatar: null,
      groupId: null,
      isMuted: false,
      isCameraOn: true,
      isScreenSharing: false,
    },

    initialize: async (userId: string) => {
      try {
        await Promise.all([
          get().loadConversations(userId).catch(err => console.error('[MessageStore] Error loading conversations:', err)),
          get().loadGroups(userId).catch(err => console.error('[MessageStore] Error loading groups:', err))
        ]);

        nexus.realtime.connect().then(() => {
          nexus.realtime.subscribe(`dm:${userId}`).catch(() => {});
          nexus.realtime.subscribe(`typing:${userId}`).catch(() => {});
          nexus.realtime.subscribe(`user_call:${userId}`).catch(() => {});
        }).catch(() => {});

        // Request Browser Push Notification Permission
        if ('Notification' in window && Notification.permission === 'default') {
          Notification.requestPermission().catch(() => {});
        }

        // Listen for new messages
        nexus.realtime.on('new_message', (payload: any) => {
          const { activePartnerId } = get();
          if (payload.sender_id === activePartnerId) {
            set(s => ({
              messages: [...s.messages, payload],
            }));
            messageService.markAsRead(userId, payload.sender_id).catch(() => {});
          } else {
            set(s => ({ totalUnreadCount: s.totalUnreadCount + 1 }));
          }
          get().loadConversations(userId);
        });

        // Listen for WebRTC Incoming Call Signal
        nexus.realtime.on('incoming_call_signal', (payload: any) => {
          const { signalingCall } = get();
          if (payload.targetId && payload.targetId !== userId) return;
          if (payload.callerId === userId) return;
          if (signalingCall.status !== 'idle') return; // Busy line

          callAudioRinger.playIncomingRingtone();

          // Trigger Push Notification
          if ('Notification' in window && Notification.permission === 'granted') {
            try {
              new Notification(`Incoming ${payload.mode === 'video' ? 'Video' : 'Voice'} Call`, {
                body: `${payload.callerName} is calling you on Trileza LMS...`,
                icon: payload.callerAvatar || '/favicon.ico',
                tag: payload.callId,
              });
            } catch {}
          }

          set({
            signalingCall: {
              callId: payload.callId,
              status: 'incoming_ringing',
              mode: payload.mode,
              title: payload.title || `${payload.mode === 'video' ? 'Video' : 'Voice'} Call`,
              partnerId: payload.callerId,
              partnerName: payload.callerName,
              partnerAvatar: payload.callerAvatar,
              groupId: payload.groupId || null,
              isMuted: false,
              isCameraOn: payload.mode === 'video',
              isScreenSharing: false,
            },
          });

          // Auto timeout after 35s if no answer
          if (ringingTimeoutTimer) clearTimeout(ringingTimeoutTimer);
          ringingTimeoutTimer = setTimeout(() => {
            if (get().signalingCall.status === 'incoming_ringing') {
              callAudioRinger.stopAll();
              set(s => ({ signalingCall: { ...s.signalingCall, status: 'idle' } }));
            }
          }, 35000);
        });

        // Listen for Call Accepted
        nexus.realtime.on('call_accepted_signal', (payload: any) => {
          callAudioRinger.stopAll();
          if (ringingTimeoutTimer) clearTimeout(ringingTimeoutTimer);
          set(s => ({
            signalingCall: {
              ...s.signalingCall,
              status: 'connected',
            },
          }));
        });

        // Listen for Call Declined
        nexus.realtime.on('call_declined_signal', (payload: any) => {
          callAudioRinger.stopAll();
          if (ringingTimeoutTimer) clearTimeout(ringingTimeoutTimer);
          set(s => ({
            signalingCall: {
              ...s.signalingCall,
              status: 'declined',
            },
          }));
          setTimeout(() => {
            set(s => ({ signalingCall: { ...s.signalingCall, status: 'idle' } }));
          }, 2000);
        });

        // Listen for Call Ended / Cancelled
        nexus.realtime.on('call_ended_signal', (payload: any) => {
          callAudioRinger.stopAll();
          if (ringingTimeoutTimer) clearTimeout(ringingTimeoutTimer);
          set(s => ({
            signalingCall: {
              ...s.signalingCall,
              status: 'idle',
            },
          }));
        });

        nexus.realtime.on('typing_indicator', (payload: any) => {
          if (payload.userId === userId) return;
          const senderId = payload.userId;
          set(s => {
            const newTyping = new Map(s.typingPartners);
            newTyping.set(senderId, true);
            return { typingPartners: newTyping };
          });

          const existingTimer = typingTimers.get(senderId);
          if (existingTimer) clearTimeout(existingTimer);

          const timer = setTimeout(() => {
            set(s => {
              const newTyping = new Map(s.typingPartners);
              newTyping.delete(senderId);
              return { typingPartners: newTyping };
            });
            typingTimers.delete(senderId);
          }, 3000);

          typingTimers.set(senderId, timer);
        });

        set({ realtimeConnected: true });
      } catch (err) {
        console.error('[Messages] Realtime initialization failed:', err);
      }
    },

    loadConversations: async (userId: string) => {
      set({ conversationsLoading: true });
      try {
        const conversations = await messageService.getConversations(userId);
        const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);
        set({ conversations, totalUnreadCount: totalUnread });
      } catch (err) {
        console.error('[Messages] Failed to load conversations:', err);
      } finally {
        set({ conversationsLoading: false });
      }
    },

    loadGroups: async (userId: string) => {
      set({ groupsLoading: true });
      try {
        const groups = await realtimekitMessagingService.getGroupChats(userId);
        set({ rtkGroups: groups });
      } catch (err) {
        console.error('[Messages] Failed to load groups:', err);
      } finally {
        set({ groupsLoading: false });
      }
    },

    createGroup: async (userId, userName, userAvatar, name, desc, isPrivate, memberIds) => {
      const newGroup = await realtimekitMessagingService.createGroupChat(
        userId, userName, userAvatar, name, desc, isPrivate, memberIds
      );
      set(s => ({ rtkGroups: [newGroup, ...s.rtkGroups] }));
      return newGroup;
    },

    openConversation: async (userId: string, partnerId: string) => {
      set({
        activePartnerId: partnerId,
        activeGroupId: null,
        activeGroup: null,
        groupMembers: [],
        messagesLoading: true,
        messages: [],
        hasMoreMessages: true,
      });

      try {
        let partner = get().conversations.find(c => c.id === partnerId);
        if (!partner) {
          const profile = await messageService.getUserProfile(partnerId);
          if (profile) {
            partner = {
              id: profile.id,
              full_name: profile.full_name,
              avatar_url: profile.avatar_url,
              username: profile.username,
              role: profile.role,
              lastMessage: null,
              unreadCount: 0,
            };
          }
        }

        set({ activePartner: partner || null });

        const msgs = await messageService.getMessages(userId, partnerId, 50);
        set({
          messages: msgs,
          hasMoreMessages: msgs.length >= 50,
        });

        await messageService.markAsRead(userId, partnerId);
      } catch (err) {
        console.error('[Messages] Failed to open conversation:', err);
      } finally {
        set({ messagesLoading: false });
      }
    },

    openGroup: async (userId: string, groupId: string) => {
      set({
        activeGroupId: groupId,
        activePartnerId: null,
        activePartner: null,
        messagesLoading: true,
        messages: [],
        hasMoreMessages: true,
      });

      try {
        const group = get().rtkGroups.find(g => g.id === groupId) || null;
        const members = await realtimekitMessagingService.getGroupMembers(groupId);
        
        set({ activeGroup: group, groupMembers: members });

        const { messages, hasMore } = await realtimekitMessagingService.fetchMessages(userId, groupId, true);
        set({
          messages: messages.map(m => ({
            id: m.id,
            sender_id: m.sender_id,
            receiver_id: groupId,
            content: m.content,
            created_at: m.created_at,
            read_at: null,
            highlight_data: {
              sender_name: m.sender_name,
              sender_avatar: m.sender_avatar,
              type: m.type,
              url: m.attachment_url,
              name: m.attachment_name,
              size: m.attachment_size,
              is_pinned: m.is_pinned,
            },
          })),
          hasMoreMessages: hasMore,
        });
      } catch (err) {
        console.error('[Messages] Failed to open group:', err);
      } finally {
        set({ messagesLoading: false });
      }
    },

    closeConversation: () => {
      set({
        activePartnerId: null,
        activePartner: null,
        activeGroupId: null,
        activeGroup: null,
        groupMembers: [],
        messages: [],
        hasMoreMessages: true,
      });
    },

    sendMessage: async (userId, content, senderName = 'User', senderAvatar = null) => {
      const { activePartnerId, activeGroupId } = get();
      if ((!activePartnerId && !activeGroupId) || !content.trim()) return;

      const targetId = activeGroupId || activePartnerId!;
      const isGroup = !!activeGroupId;

      const highlightData = isGroup ? { sender_name: senderName, sender_avatar: senderAvatar } : undefined;
      const realMsg = await messageService.sendMessage(userId, targetId, content.trim(), highlightData);

      set(s => ({
        messages: [...s.messages, realMsg],
      }));

      nexus.realtime.publish(`dm:${targetId}`, 'new_message', realMsg).catch(() => {});
      get().loadConversations(userId);
    },

    sendAttachmentMessage: async (userId, userName, userAvatar, file) => {
      const { activePartnerId, activeGroupId } = get();
      if (!activePartnerId && !activeGroupId) return;

      const targetId = activeGroupId || activePartnerId!;
      const upload = await realtimekitMessagingService.uploadAttachment(file);
      const isImage = file.type.startsWith('image/');

      const highlightData = {
        type: isImage ? 'image' : 'file',
        url: upload.url,
        name: upload.name,
        size: upload.size,
        sender_name: userName,
        sender_avatar: userAvatar,
      };

      const realMsg = await messageService.sendMessage(userId, targetId, upload.name, highlightData);

      set(s => ({
        messages: [...s.messages, realMsg],
      }));

      nexus.realtime.publish(`dm:${targetId}`, 'new_message', realMsg).catch(() => {});
    },

    pinMessage: async (messageId: string) => {
      const msg = get().messages.find(m => m.id === messageId);
      const newHighlight = { ...(msg?.highlight_data || {}), is_pinned: true };
      await messageService.updateMessage(messageId, { highlight_data: newHighlight });
      set(s => ({
        messages: s.messages.map(m => m.id === messageId ? { ...m, highlight_data: newHighlight } : m),
        pinnedMessageIds: [...s.pinnedMessageIds, messageId],
      }));
    },

    unpinMessage: async (messageId: string) => {
      const msg = get().messages.find(m => m.id === messageId);
      const newHighlight = { ...(msg?.highlight_data || {}), is_pinned: false };
      await messageService.updateMessage(messageId, { highlight_data: newHighlight });
      set(s => ({
        messages: s.messages.map(m => m.id === messageId ? { ...m, highlight_data: newHighlight } : m),
        pinnedMessageIds: s.pinnedMessageIds.filter(id => id !== messageId),
      }));
    },

    editMessage: async (messageId: string, newContent: string) => {
      const msg = get().messages.find(m => m.id === messageId);
      const newHighlight = { ...(msg?.highlight_data || {}), is_edited: true };
      await messageService.updateMessage(messageId, { content: newContent, highlight_data: newHighlight });
      set(s => ({
        messages: s.messages.map(m => m.id === messageId ? { ...m, content: newContent, highlight_data: newHighlight } : m),
      }));
    },

    deleteMessage: async (messageId: string) => {
      await messageService.deleteMessage(messageId);
      set(s => ({
        messages: s.messages.filter(m => m.id !== messageId),
        pinnedMessageIds: s.pinnedMessageIds.filter(id => id !== messageId),
      }));
    },

    addGroupMember: async (groupId, user) => {
      const newMem = await realtimekitMessagingService.addGroupMember(groupId, user);
      set(s => ({ groupMembers: [...s.groupMembers, newMem] }));
    },

    removeGroupMember: async (groupId, userId) => {
      await realtimekitMessagingService.removeGroupMember(groupId, userId);
      set(s => ({ groupMembers: s.groupMembers.filter(m => m.user_id !== userId) }));
    },

    loadMoreMessages: async (userId: string) => {
      const { activePartnerId, activeGroupId, messages, hasMoreMessages } = get();
      const targetId = activeGroupId || activePartnerId;
      if (!targetId || !hasMoreMessages || messages.length === 0) return;

      const oldest = messages[0];
      const { messages: older, hasMore } = await realtimekitMessagingService.fetchMessages(
        userId, targetId, !!activeGroupId, 50, oldest.id
      );

      set(s => ({
        messages: [
          ...older.map(m => ({
            id: m.id,
            sender_id: m.sender_id,
            receiver_id: targetId,
            content: m.content,
            created_at: m.created_at,
            read_at: m.read_at || null,
            highlight_data: m.attachment_url ? {
              type: m.type,
              url: m.attachment_url,
              name: m.attachment_name,
              size: m.attachment_size,
              is_pinned: m.is_pinned,
              sender_name: m.sender_name,
            } : undefined,
          })),
          ...s.messages,
        ],
        hasMoreMessages: hasMore,
      }));
    },

    searchUsers: async (query: string, userId: string) => {
      if (!query.trim() || query.trim().length < 2) {
        set({ searchResults: [], searchLoading: false });
        return;
      }
      set({ searchLoading: true });
      try {
        const results = await messageService.searchUsers(query.trim(), userId);
        set({ searchResults: results });
      } catch (err) {
        console.error('[Messages] Search failed:', err);
        set({ searchResults: [] });
      } finally {
        set({ searchLoading: false });
      }
    },

    clearSearch: () => {
      set({ searchResults: [], searchLoading: false });
    },

    publishTyping: (userId: string, targetId: string) => {
      if (localTypingTimer) return;
      nexus.realtime.publish(`typing:${targetId}`, 'typing_indicator', {
        userId,
        timestamp: Date.now(),
      }).catch(() => {});

      localTypingTimer = setTimeout(() => {
        localTypingTimer = null;
      }, 2000);
    },

    // ── WebRTC Signaling Actions ──
    initiateCall: (userId, partnerId, partnerName, partnerAvatar, mode, title, groupId = null) => {
      const callId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const currentUser = useAuthStore.getState().user;
      const actualCallerName = currentUser?.full_name || 'Trileza User';
      const actualCallerAvatar = currentUser?.avatar_url || null;

      callAudioRinger.playOutgoingRingback();

      set({
        signalingCall: {
          callId,
          status: 'outgoing_ringing',
          mode,
          title,
          partnerId,
          partnerName,
          partnerAvatar,
          groupId,
          isMuted: false,
          isCameraOn: mode === 'video',
          isScreenSharing: false,
        },
      });

      // Send real-time WebRTC incoming call signal
      nexus.realtime.publish(`user_call:${partnerId}`, 'incoming_call_signal', {
        callId,
        callerId: userId,
        callerName: actualCallerName,
        callerAvatar: actualCallerAvatar,
        targetId: partnerId,
        mode,
        title,
        groupId,
      }).catch(() => {});

      // Auto cancel if no answer after 35s
      if (ringingTimeoutTimer) clearTimeout(ringingTimeoutTimer);
      ringingTimeoutTimer = setTimeout(() => {
        if (get().signalingCall.status === 'outgoing_ringing') {
          callAudioRinger.stopAll();
          set(s => ({ signalingCall: { ...s.signalingCall, status: 'ended' } }));
          setTimeout(() => set(s => ({ signalingCall: { ...s.signalingCall, status: 'idle' } })), 2000);
        }
      }, 35000);
    },

    acceptCall: () => {
      const { signalingCall } = get();
      callAudioRinger.stopAll();
      if (ringingTimeoutTimer) clearTimeout(ringingTimeoutTimer);

      set(s => ({ signalingCall: { ...s.signalingCall, status: 'connected' } }));

      if (signalingCall.partnerId) {
        nexus.realtime.publish(`user_call:${signalingCall.partnerId}`, 'call_accepted_signal', {
          callId: signalingCall.callId,
        }).catch(() => {});
      }
    },

    declineCall: () => {
      const { signalingCall } = get();
      callAudioRinger.stopAll();
      if (ringingTimeoutTimer) clearTimeout(ringingTimeoutTimer);

      if (signalingCall.partnerId) {
        nexus.realtime.publish(`user_call:${signalingCall.partnerId}`, 'call_declined_signal', {
          callId: signalingCall.callId,
        }).catch(() => {});
      }

      set(s => ({ signalingCall: { ...s.signalingCall, status: 'idle' } }));
    },

    cancelCall: () => {
      const { signalingCall } = get();
      callAudioRinger.stopAll();
      if (ringingTimeoutTimer) clearTimeout(ringingTimeoutTimer);

      if (signalingCall.partnerId) {
        nexus.realtime.publish(`user_call:${signalingCall.partnerId}`, 'call_ended_signal', {
          callId: signalingCall.callId,
        }).catch(() => {});
      }

      set(s => ({ signalingCall: { ...s.signalingCall, status: 'idle' } }));
    },

    endCall: () => {
      const { signalingCall } = get();
      callAudioRinger.stopAll();
      if (ringingTimeoutTimer) clearTimeout(ringingTimeoutTimer);

      if (signalingCall.partnerId) {
        nexus.realtime.publish(`user_call:${signalingCall.partnerId}`, 'call_ended_signal', {
          callId: signalingCall.callId,
        }).catch(() => {});
      }

      set(s => ({ signalingCall: { ...s.signalingCall, status: 'idle' } }));
    },

    toggleMuteCall: () => {
      set(s => ({ signalingCall: { ...s.signalingCall, isMuted: !s.signalingCall.isMuted } }));
    },

    toggleCameraCall: () => {
      set(s => ({ signalingCall: { ...s.signalingCall, isCameraOn: !s.signalingCall.isCameraOn } }));
    },

    toggleScreenShareCall: () => {
      set(s => ({ signalingCall: { ...s.signalingCall, isScreenSharing: !s.signalingCall.isScreenSharing } }));
    },

    cleanup: () => {
      callAudioRinger.stopAll();
      nexus.realtime.disconnect();
      typingTimers.forEach(timer => clearTimeout(timer));
      typingTimers.clear();
      if (localTypingTimer) {
        clearTimeout(localTypingTimer);
        localTypingTimer = null;
      }
      set({ realtimeConnected: false });
    },
  };
});
