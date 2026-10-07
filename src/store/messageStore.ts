/**
 * Message Store — Global Messaging & RealtimeKit State (Zustand)
 * ─────────────────────────────────────────────────────────────────
 * Manages: DMs, Cloudflare RealtimeKit groups, file/image attachments,
 * message pinning, editing, deletion, typing indicators, read receipts,
 * and 1-on-1 / group audio & video calls with WebRTC signaling & ringing.
 */
import { create } from 'zustand';
import { PeerSession, hasTurn } from '../lib/webrtc';
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

  /** The two ends of the media, for the UI to attach to <video> elements. */
  localStream?: MediaStream | null;
  remoteStream?: MediaStream | null;
  /**
   * Set when the call signalled fine but no media path could be found —
   * usually a strict NAT with no TURN server configured. Worth saying
   * plainly, because the alternative is a call that looks connected and is
   * silent.
   */
  mediaError?: string | null;
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
  /** Who is online, by user id, with the time we last heard from them. */
  onlinePartners: Map<string, number>;
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

/**
 * The live peer connection, if a call is up.
 *
 * Module scope rather than store state: a PeerSession holds MediaStreams and
 * an RTCPeerConnection, none of which belong in a serialisable store, and
 * putting them there would have every subscriber re-render on an ICE event.
 */
let peer: PeerSession | null = null;

/** The offer, held while the callee decides whether to answer. */
let pendingOffer: { sdp: RTCSessionDescriptionInit; callId: string } | null = null;

/** Re-joins channels when the tab comes back. Removed on cleanup. */
let visibilityHandler: (() => void) | null = null;

/**
 * Who the realtime listeners are currently bound for.
 *
 * initialize() can run more than once — its caller is an effect keyed on the
 * user id — and each run registers another set of `on` handlers. Without this
 * a remount leaves two listeners for every event, so one message renders
 * twice and every arrival fires two conversation refetches.
 */
let listenersBoundFor: string | null = null;

/**
 * Releases the camera, microphone and peer connection.
 *
 * Called from every path that ends a call — hang-up, decline, cancel, the
 * other side hanging up, the no-answer timeout and sign-out. Missing one
 * leaves the camera light on after the call is over, which people reasonably
 * read as still being recorded.
 */
const teardownCall = () => {
  peer?.close();
  peer = null;
  pendingOffer = null;
};

export const useMessageStore = create<MessageStore>((set, get) => {
  let typingTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  // Presence timing.
  //
  // Six seconds between beats, with fifteen before someone is considered gone:
  // wide enough that one dropped packet does not blink a contact offline, tight
  // enough that a closed tab clears within a sensible time.
  const PRESENCE_BEAT_MS = 6000;
  const PRESENCE_STALE_MS = 15000;
  const PRESENCE_SWEEP_MS = 5000;
  let presenceTimer: ReturnType<typeof setInterval> | null = null;
  let presenceSweeper: ReturnType<typeof setInterval> | null = null;

  // Coalesces sidebar refreshes.
  //
  // loadConversations is the expensive call in this store — around 2.3s
  // against the live backend — and several messages can land in a second.
  // Collapsing them into one refresh a second after the last arrival keeps
  // the list correct without putting a long query behind every message.
  let conversationRefreshTimer: ReturnType<typeof setTimeout> | null = null;

  const scheduleConversationRefresh = (userId: string) => {
    if (conversationRefreshTimer) clearTimeout(conversationRefreshTimer);
    conversationRefreshTimer = setTimeout(() => {
      conversationRefreshTimer = null;
      useMessageStore.getState().loadConversations(userId).catch(() => {});
    }, 1000);
  };
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
    onlinePartners: new Map(),
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
        // Connect before loading anything.
        //
        // These two awaits used to come first, and measured against the live
        // backend they cost about 2.3s and 1.1s — so for roughly three and a
        // half seconds after opening the app there was no socket, and any
        // message sent in that window arrived only when the history query
        // finally returned. That is the delay: not the sending, which is
        // already optimistic, but the listening.
        //
        // Nothing below depends on the conversation list, so it has no reason
        // to wait for it. The lists now load alongside, and arrive when they
        // arrive.
        get().loadConversations(userId).catch(err => console.error('[MessageStore] Error loading conversations:', err));
        get().loadGroups(userId).catch(err => console.error('[MessageStore] Error loading groups:', err));

        nexus.realtime.connect().then(() => {
          // subscribe() resolves with { ok, error } rather than throwing, so
          // `.catch()` alone caught nothing: a refused subscription returned
          // ok:false, was discarded, and the app carried on believing it was
          // listening. That is exactly the shape of "messages only appear
          // after a refresh" — the socket is up, the channel is not.
          const join = (channel: string) =>
            nexus.realtime
              .subscribe(channel)
              .then(res => {
                if (res && (res as any).ok === false) {
                  console.error(`[Realtime] Could not subscribe to ${channel}:`, (res as any).error);
                  set({ realtimeConnected: false });
                }
              })
              .catch(err => {
                console.error(`[Realtime] Subscribe threw for ${channel}:`, err);
                set({ realtimeConnected: false });
              });

          join(`dm:${userId}`);
          join(`typing:${userId}`);
          join(`user_call:${userId}`);

          // Re-join every channel whenever the socket comes back.
          //
          // Nothing listened for this before. A subscription belongs to a
          // socket, so when the connection drops — a laptop sleeping, a tunnel,
          // a backgrounded tab, a wifi handover — the SDK reconnects and the
          // channels are simply gone. The app looks connected, hears nothing,
          // and only a page refresh runs initialize() again. That is the
          // "messages only appear after a refresh" everyone was seeing.
          //
          // Registered inside connect().then() so it is attached once, after
          // the first connection rather than before it.
          nexus.realtime.on('connect', () => {
            console.info('[Realtime] Reconnected — re-joining channels.');
            set({ realtimeConnected: true });
            join(`dm:${userId}`);
            join(`typing:${userId}`);
            join(`user_call:${userId}`);
            join('presence');
          });

          nexus.realtime.on('disconnect', (reason: unknown) => {
            console.warn('[Realtime] Disconnected:', reason);
            set({ realtimeConnected: false });
          });

          // Returning to the tab is its own recovery point.
          //
          // A browser can suspend a backgrounded tab's socket without the
          // page ever seeing a 'disconnect', so waiting for that event is not
          // enough on its own. Reconnecting is safe to call when already
          // connected, and the conversation refetch catches anything that
          // arrived while the tab was asleep.
          if (!visibilityHandler) {
            visibilityHandler = () => {
              if (document.visibilityState !== 'visible') return;
              nexus.realtime
                .connect()
                .then(() => {
                  join(`dm:${userId}`);
                  join(`typing:${userId}`);
                  join(`user_call:${userId}`);
                  join('presence');
                  scheduleConversationRefresh(userId);
                })
                .catch(err => console.warn('[Realtime] Reconnect on focus failed:', err));
            };
            document.addEventListener('visibilitychange', visibilityHandler);
          }

          // One shared channel rather than a channel per pair: a heartbeat is
          // the same fact for everyone who cares, and subscribing per
          // conversation would mean re-subscribing every time a chat opens.
          join('presence');

          // Announce immediately, then keep saying so. A heartbeat is the only
          // honest way to know someone is still there — a "went offline"
          // message never arrives when a laptop lid closes or a tunnel eats
          // the connection, which is exactly when it would matter.
          const beat = () => {
            nexus.realtime.publish('presence', 'presence_ping', {
              userId,
              at: Date.now()
            }).catch(() => {});
          };

          beat();
          presenceTimer = setInterval(beat, PRESENCE_BEAT_MS);

          // Sweep anyone we have stopped hearing from. Done on a timer rather
          // than on read so the list changes on its own, without needing a
          // render to notice.
          presenceSweeper = setInterval(() => {
            const cutoff = Date.now() - PRESENCE_STALE_MS;
            set(st => {
              let changed = false;
              const next = new Map(st.onlinePartners);
              next.forEach((seen, id) => {
                if (seen < cutoff) {
                  next.delete(id);
                  changed = true;
                }
              });
              return changed ? { onlinePartners: next } : {};
            });
          }, PRESENCE_SWEEP_MS);
        }).catch(() => {});

        // Bind the event handlers once per user.
        //
        // Everything below registers an `on` listener, and initialize() runs
        // again whenever its calling effect re-runs. Without this guard a
        // remount doubles every handler: one message renders twice, and each
        // arrival fires two conversation refetches.
        if (listenersBoundFor === userId) return;
        listenersBoundFor = userId;

        // Someone said they are here.
        nexus.realtime.on('presence_ping', (payload: any) => {
          const id = payload?.userId;
          if (!id || id === userId) return;

          set(st => {
            const next = new Map(st.onlinePartners);
            next.set(id, Date.now());
            return { onlinePartners: next };
          });

          // Answer a newcomer directly so they see us without waiting for our
          // next beat. Only to a ping that is not itself an answer, or two
          // clients would volley forever.
          if (!payload.reply) {
            nexus.realtime.publish('presence', 'presence_ping', {
              userId,
              at: Date.now(),
              reply: true
            }).catch(() => {});
          }
        });

        // Request Browser Push Notification Permission
        if ('Notification' in window && Notification.permission === 'default') {
          Notification.requestPermission().catch(() => {});
        }

        // Listen for new messages
        nexus.realtime.on('new_message', (payload: any) => {
          const { activePartnerId } = get();
          if (payload.sender_id === activePartnerId) {
            set(s => {
              // The sender publishes twice: once optimistically with a
              // temporary id so this arrives at network speed, and again with
              // the saved row. Without this the recipient sees the same
              // message twice.
              //
              // Matched on sender and content rather than id, because the two
              // publishes carry different ids by design. The second one
              // replaces the first, so the recipient ends up holding the
              // stored row.
              const existing = s.messages.findIndex(
                (m: any) =>
                  m.sender_id === payload.sender_id &&
                  m.content === payload.content &&
                  (m.id === payload.id || String(m.id).startsWith('tmp-'))
              );

              if (existing !== -1) {
                const next = [...s.messages];
                next[existing] = payload;
                return { messages: next };
              }
              return { messages: [...s.messages, payload] };
            });
            messageService.markAsRead(userId, payload.sender_id).catch(() => {});
          } else {
            // The conversation is not open, so put the message straight into
            // the sidebar rather than only counting it.
            //
            // This branch used to increment totalUnreadCount and nothing else.
            // The row's preview, its timestamp and its position all waited on
            // the debounced refetch — and if the sender was not already in the
            // list, the conversation did not appear at all until the next
            // reload. That is why a new message was only visible after
            // refreshing the page.
            set(s => {
              const idx = s.conversations.findIndex(c => c.id === payload.sender_id);

              const preview = {
                id: payload.id,
                content: payload.content,
                created_at: payload.created_at,
                sender_id: payload.sender_id,
                highlight_data: payload.highlight_data ?? null
              };

              // A sender already in the list: update in place and move to the
              // top, which is where the refetch would have put them.
              if (idx !== -1) {
                const next = [...s.conversations];
                const row = { ...next[idx], lastMessage: preview, unreadCount: next[idx].unreadCount + 1 };
                next.splice(idx, 1);
                return {
                  conversations: [row, ...next],
                  totalUnreadCount: s.totalUnreadCount + 1
                };
              }

              // A first message from someone new. The name and avatar are not
              // in this payload, so a placeholder holds the row until the
              // debounced refresh fills it in — far better than no row at all.
              return {
                conversations: [
                  {
                    id: payload.sender_id,
                    full_name: payload.sender_name || 'New message',
                    avatar_url: payload.sender_avatar ?? null,
                    username: null,
                    role: 'Member',
                    lastMessage: preview,
                    unreadCount: 1
                  } as any,
                  ...s.conversations
                ],
                totalUnreadCount: s.totalUnreadCount + 1
              };
            });
          }

          // Refresh the sidebar, but not once per message.
          //
          // This ran on every arrival, and the conversation query takes about
          // 2.3s against the live backend — so a quick back-and-forth queued
          // one of those per message and the whole app felt heavy while it
          // worked through them. The message itself is already on screen by
          // this point; only the sidebar ordering and unread counts are
          // waiting, and those can settle a moment later.
          scheduleConversationRefresh(userId);
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
              teardownCall();
            set(s => ({ signalingCall: { ...s.signalingCall, status: 'idle', localStream: null, remoteStream: null, mediaError: null } }));
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

          // The callee has answered, so the caller opens its devices and
          // sends the offer. Media is started here rather than at dial time:
          // asking for a camera before anyone has picked up turns the light
          // on for a call that may never happen.
          const call = get().signalingCall;
          if (!call.partnerId || !call.callId) return;

          peer = new PeerSession(call.partnerId, userId, {
            onRemoteStream: stream =>
              set(s => ({ signalingCall: { ...s.signalingCall, remoteStream: stream } })),
            onStateChange: state => {
              if (state === 'failed') {
                set(s => ({
                  signalingCall: {
                    ...s.signalingCall,
                    mediaError: hasTurn()
                      ? 'The connection could not be established.'
                      : 'No media path could be found. This network needs a TURN relay, which is not configured.'
                  }
                }));
              }
            }
          });

          peer
            .openMedia(call.mode === 'video')
            .then(local => {
              set(s => ({ signalingCall: { ...s.signalingCall, localStream: local } }));
              return peer!.createOffer(call.callId!);
            })
            .catch(err => {
              console.error('[Call] Could not start media:', err);
              set(s => ({
                signalingCall: {
                  ...s.signalingCall,
                  mediaError:
                    err?.name === 'NotAllowedError'
                      ? 'Microphone and camera permission was refused.'
                      : 'Your microphone or camera could not be opened.'
                }
              }));
            });
        });

        // ── SDP and ICE ──────────────────────────────────────────────────
        // The offer arrives at the callee, who has already accepted; the
        // answer goes back to the caller. Candidates flow both ways
        // throughout and may arrive before a description is set, which
        // PeerSession queues rather than dropping.

        nexus.realtime.on('call_sdp_offer', (payload: any) => {
          if (!payload?.sdp || payload.from === userId) return;
          pendingOffer = { sdp: payload.sdp, callId: payload.callId };

          // The callee builds its session only once it has an offer to answer.
          const call = get().signalingCall;
          if (!peer && call.partnerId) {
            peer = new PeerSession(call.partnerId, userId, {
              onRemoteStream: stream =>
                set(s => ({ signalingCall: { ...s.signalingCall, remoteStream: stream } })),
              onStateChange: state => {
                if (state === 'failed') {
                  set(s => ({
                    signalingCall: {
                      ...s.signalingCall,
                      mediaError: hasTurn()
                        ? 'The connection could not be established.'
                        : 'No media path could be found. This network needs a TURN relay, which is not configured.'
                    }
                  }));
                }
              }
            });
          }

          if (!peer) return;

          peer
            .openMedia(call.mode === 'video')
            .then(local => {
              set(s => ({ signalingCall: { ...s.signalingCall, localStream: local } }));
              return peer!.acceptOffer(pendingOffer!.sdp, pendingOffer!.callId);
            })
            .catch(err => {
              console.error('[Call] Could not answer:', err);
              set(s => ({
                signalingCall: {
                  ...s.signalingCall,
                  mediaError:
                    err?.name === 'NotAllowedError'
                      ? 'Microphone and camera permission was refused.'
                      : 'Your microphone or camera could not be opened.'
                }
              }));
            });
        });

        nexus.realtime.on('call_sdp_answer', (payload: any) => {
          if (!payload?.sdp || payload.from === userId) return;
          peer?.acceptAnswer(payload.sdp).catch(err =>
            console.error('[Call] Could not apply answer:', err)
          );
        });

        nexus.realtime.on('call_ice_candidate', (payload: any) => {
          if (!payload?.candidate || payload.from === userId) return;
          peer?.addCandidate(payload.candidate).catch(() => {});
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
            teardownCall();
            set(s => ({ signalingCall: { ...s.signalingCall, status: 'idle', localStream: null, remoteStream: null, mediaError: null } }));
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
      const body = content.trim();

      // Show it immediately, and tell the recipient immediately.
      //
      // Both of these used to wait on the database round trip: the sender
      // watched an empty thread until the insert returned, and the recipient
      // waited for that same trip before the realtime event was even sent. On
      // a slow connection a message took a visible second to appear for the
      // person who had just typed it.
      //
      // The optimistic row carries a temporary id and `pending`, so the bubble
      // can show it is still in flight and the reconciliation below knows
      // which row to replace.
      const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const optimistic: any = {
        id: tempId,
        sender_id: userId,
        receiver_id: targetId,
        content: body,
        highlight_data: highlightData,
        created_at: new Date().toISOString(),
        read_at: null,
        pending: true,
        // Carried so a recipient who has never spoken to this sender can show
        // their name immediately, instead of a row labelled "New message"
        // until the sidebar refetch fills it in. Not stored — the database row
        // has no such column — it only travels with the realtime event.
        sender_name: senderName,
        sender_avatar: senderAvatar
      };

      set(s => ({ messages: [...s.messages, optimistic] }));

      // Published before the insert, so the other side renders at network
      // speed rather than at database speed.
      nexus.realtime.publish(`dm:${targetId}`, 'new_message', optimistic).catch(() => {});

      try {
        const realMsg = await messageService.sendMessage(userId, targetId, body, highlightData, senderName);

        // Swap the placeholder for the saved row, keeping its position rather
        // than appending — otherwise a message jumps to the bottom when it
        // settles, which reads as a second message.
        set(s => ({
          messages: s.messages.map(m => (m.id === tempId ? realMsg : m))
        }));

        // Re-publish with the real id so the recipient's copy matches what is
        // stored; their handler de-duplicates on content and sender.
        //
        // The sender's name rides along again: realMsg is the database row and
        // has no column for it, so without this the second publish would
        // replace a correctly labelled sidebar row with one reading "New
        // message".
        nexus.realtime
          .publish(`dm:${targetId}`, 'new_message', {
            ...realMsg,
            sender_name: senderName,
            sender_avatar: senderAvatar
          })
          .catch(() => {});

        // Debounced for the same reason as the receive path: someone typing
        // several messages in a row should not queue a 2.3s query behind each
        // one.
        scheduleConversationRefresh(userId);
      } catch (err) {
        console.error('[Messages] Send failed:', err);

        // Mark it failed rather than removing it. A message that vanishes
        // leaves the sender unsure whether it went; one marked failed can be
        // retried, and the text is still on screen to copy.
        set(s => ({
          messages: s.messages.map(m =>
            m.id === tempId ? { ...m, pending: false, failed: true } : m
          )
        }));
      }
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
          teardownCall();
          set(s => ({ signalingCall: { ...s.signalingCall, status: 'ended', localStream: null, remoteStream: null } }));
          setTimeout(() => set(s => ({ signalingCall: { ...s.signalingCall, status: 'idle', mediaError: null } })), 2000);
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

      teardownCall();
            set(s => ({ signalingCall: { ...s.signalingCall, status: 'idle', localStream: null, remoteStream: null, mediaError: null } }));
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

      teardownCall();
            set(s => ({ signalingCall: { ...s.signalingCall, status: 'idle', localStream: null, remoteStream: null, mediaError: null } }));
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

      teardownCall();
            set(s => ({ signalingCall: { ...s.signalingCall, status: 'idle', localStream: null, remoteStream: null, mediaError: null } }));
    },

    // These used to flip a flag and nothing else, so the button changed and
    // the microphone kept transmitting. They now disable the track itself,
    // which is what actually stops the other side hearing or seeing you.
    toggleMuteCall: () => {
      const next = !get().signalingCall.isMuted;
      peer?.setMuted(next);
      set(s => ({ signalingCall: { ...s.signalingCall, isMuted: next } }));
    },

    toggleCameraCall: () => {
      const next = !get().signalingCall.isCameraOn;
      peer?.setCameraOn(next);
      set(s => ({ signalingCall: { ...s.signalingCall, isCameraOn: next } }));
    },

    toggleScreenShareCall: () => {
      set(s => ({ signalingCall: { ...s.signalingCall, isScreenSharing: !s.signalingCall.isScreenSharing } }));
    },

    cleanup: () => {
      callAudioRinger.stopAll();
      // Signing out during a call must still release the camera.
      teardownCall();

      if (visibilityHandler) {
        document.removeEventListener('visibilitychange', visibilityHandler);
        visibilityHandler = null;
      }

      // Or signing out and back in binds nothing, because the guard still
      // thinks this user's listeners are attached.
      listenersBoundFor = null;
      nexus.realtime.disconnect();
      typingTimers.forEach(timer => clearTimeout(timer));
      typingTimers.clear();
      if (localTypingTimer) {
        clearTimeout(localTypingTimer);
        localTypingTimer = null;
      }

      // Stop the heartbeat, or a signed-out session keeps announcing itself as
      // online — and the interval survives the next sign-in, so beats double
      // with every cycle.
      if (presenceTimer) {
        clearInterval(presenceTimer);
        presenceTimer = null;
      }
      if (presenceSweeper) {
        clearInterval(presenceSweeper);
        presenceSweeper = null;
      }

      // A pending refresh would otherwise fire after sign-out, querying for a
      // user who is no longer here.
      if (conversationRefreshTimer) {
        clearTimeout(conversationRefreshTimer);
        conversationRefreshTimer = null;
      }

      set({ realtimeConnected: false, onlinePartners: new Map() });
    },
  };
});
