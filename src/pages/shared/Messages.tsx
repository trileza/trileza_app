/**
 * Messages — Cloudflare RealtimeKit Powered Messaging & Communication System
 * ──────────────────────────────────────────────────────────────────────────
 * Features:
 * 1. Cloudflare RealtimeKit DMs, Image/File Attachments, Pinned Messages.
 * 2. Group Chats & Channels (Mentor-Mentee Groups, Study Groups).
 * 3. Group Member Management (Add, Remove Members, Public/Private).
 * 4. 1-on-1 & Group Voice & Video Calls directly from chat header.
 * 5. Message Editing, Deletion, Read Receipts, Typing Indicators.
 * 6. Cloudflare CDN Storage for File Attachments & Previews.
 */
import React, { useState, useEffect, useRef } from 'react';
import { Card, Button } from '../../components/ui';
import {
  Search, Send, ArrowLeft, Check, Paperclip, Smile,
  PenSquare, Clock, Loader2, ChevronUp, X, MessageSquare,
  Image as ImageIcon, FileText, Phone, Video, Pin, Users,
  UserPlus, Trash2, Edit3, Download, Plus, CheckCheck,
  Globe, Lock, AlertCircle, Sparkles, UserMinus
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useMessageStore } from '../../store/messageStore';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../utils';

// Quick emojis
const EMOJI_SET = ['😀','😃','😄','😁','😆','😂','😊','😇','🙂','😉','😍','🥰','👍','🙏','🔥','💯','👏','❤️','💡','🎉'];

// Quick replies
const QUICK_REPLIES = [
  "Got it, thanks! 👍",
  "Let's schedule a video call.",
  "I'll review the materials right away.",
  "Sounds great! See you then.",
  "Can you share the link again?",
];

const Messages = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const {
    conversations, conversationsLoading, activePartnerId, activePartner,
    activeGroupId, activeGroup, groupMembers, rtkGroups, groupsLoading,
    messages, messagesLoading, searchResults, searchLoading, typingPartners,
    initialize, openConversation, openGroup, closeConversation, sendMessage,
    sendAttachmentMessage, pinMessage, unpinMessage, editMessage, deleteMessage,
    createGroup, addGroupMember, removeGroupMember, searchUsers, clearSearch,
    publishTyping, initiateCall, acceptCall, declineCall, cancelCall, endCall, toggleMuteCall, toggleCameraCall,
    toggleScreenShareCall, cleanup
  } = useMessageStore();

  const [activeTab, setActiveTab] = useState<'dm' | 'group'>('dm');
  const [newMessageText, setNewMessageText] = useState('');
  const [sidebarSearch, setSidebarSearch] = useState('');
  
  // Modals
  const [showNewMessageModal, setShowNewMessageModal] = useState(false);
  const [newMsgSearch, setNewMsgSearch] = useState('');
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [newGroupPrivate, setNewGroupPrivate] = useState(false);
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<string[]>([]);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');

  // Attachments & UI States
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [fileUploading, setFileUploading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showPinnedDrawer, setShowPinnedDrawer] = useState(false);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [selectedPreviewImage, setSelectedPreviewImage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Extract URL parameters
  const chatParam = new URLSearchParams(location.search).get('chat');
  const groupParam = new URLSearchParams(location.search).get('group');

  useEffect(() => {
    if (user?.id) {
      initialize(user.id);
    }
    return () => cleanup();
  }, [user?.id]);

  useEffect(() => {
    if (chatParam && user?.id && chatParam !== activePartnerId) {
      openConversation(user.id, chatParam);
      setActiveTab('dm');
    } else if (groupParam && user?.id && groupParam !== activeGroupId) {
      openGroup(user.id, groupParam);
      setActiveTab('group');
    }
  }, [chatParam, groupParam, user?.id]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  // Debounced search for user discovery
  useEffect(() => {
    if (!newMsgSearch.trim() || !user?.id) {
      clearSearch();
      return;
    }
    const timer = setTimeout(() => {
      searchUsers(newMsgSearch.trim(), user.id);
    }, 300);
    return () => clearTimeout(timer);
  }, [newMsgSearch]);

  const handleOpenDM = (partnerId: string) => {
    navigate(`/messages?chat=${partnerId}`);
    setShowNewMessageModal(false);
    setNewMsgSearch('');
    clearSearch();
  };

  const handleOpenGroupChat = (groupId: string) => {
    navigate(`/messages?group=${groupId}`);
  };

  const handleSendMessage = async () => {
    if (!user || (!newMessageText.trim() && !pendingFile)) return;

    if (pendingFile) {
      setFileUploading(true);
      try {
        await sendAttachmentMessage(
          user.id,
          user.full_name || 'User',
          user.avatar_url || null,
          pendingFile
        );
        setPendingFile(null);
      } catch (err) {
        console.error('Attachment upload failed:', err);
      } finally {
        setFileUploading(false);
      }
    }

    if (newMessageText.trim()) {
      await sendMessage(
        user.id,
        newMessageText.trim(),
        user.full_name || 'User',
        user.avatar_url || null
      );
      setNewMessageText('');
    }
    setShowEmojiPicker(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setPendingFile(e.target.files[0]);
    }
  };

  const handleCreateGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newGroupName.trim()) return;

    const group = await createGroup(
      user.id,
      user.full_name || 'User',
      user.avatar_url || null,
      newGroupName,
      newGroupDesc,
      newGroupPrivate,
      selectedGroupMembers
    );

    setShowNewGroupModal(false);
    setNewGroupName('');
    setNewGroupDesc('');
    setSelectedGroupMembers([]);
    handleOpenGroupChat(group.id);
  };

  const pinnedMessages = messages.filter(m => m.highlight_data?.is_pinned);

  return (
    <div className="space-y-6">
      {/* Main Grid Container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-140px)] min-h-[620px]">

        {/* ── SIDEBAR: CONVERSATIONS & GROUPS ── */}
        <div className={cn(
          "lg:col-span-4 bg-white dark:bg-[#1B2620] border border-slate-200 dark:border-slate-800 rounded-3xl p-4 flex flex-col shadow-sm transition-all overflow-hidden",
          (activePartnerId || activeGroupId) ? "hidden lg:flex" : "flex"
        )}>
          {/* Header & Tabs */}
          <div className="space-y-4 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-green-500/10 dark:bg-green-500/20 text-green-600 dark:text-green-400 flex items-center justify-center font-bold">
                  <MessageSquare size={18} />
                </div>
                <h1 className="text-lg font-black text-slate-900 dark:text-white font-sans tracking-tight">Messages</h1>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setShowNewMessageModal(true)}
                  className="p-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl transition-all shadow-md flex items-center gap-1 text-xs font-bold font-sans"
                  title="New Direct Message"
                >
                  <PenSquare size={14} />
                  <span>DM</span>
                </button>

                <button
                  onClick={() => setShowNewGroupModal(true)}
                  className="p-2.5 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-xl transition-all shadow-md flex items-center gap-1 text-xs font-bold font-sans"
                  title="Create Group Chat"
                >
                  <Plus size={14} />
                  <span>Group</span>
                </button>
              </div>
            </div>

            {/* Tab Switcher */}
            <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl text-xs font-black font-sans">
              <button
                onClick={() => setActiveTab('dm')}
                className={cn(
                  "py-2 rounded-lg transition-all flex items-center justify-center gap-1.5",
                  activeTab === 'dm'
                    ? "bg-white dark:bg-[#26362E] text-slate-900 dark:text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400"
                )}
              >
                <Users size={14} />
                <span>Contacts ({conversations.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('group')}
                className={cn(
                  "py-2 rounded-lg transition-all flex items-center justify-center gap-1.5",
                  activeTab === 'group'
                    ? "bg-white dark:bg-[#26362E] text-slate-900 dark:text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400"
                )}
              >
                <Globe size={14} />
                <span>Groups ({rtkGroups.length})</span>
              </button>
            </div>

            {/* Quick Contacts Avatar Strip */}
            {conversations.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 block">
                  Quick Contacts
                </span>
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                  {conversations.slice(0, 10).map(c => (
                    <button
                      key={`quick-${c.id}`}
                      onClick={() => handleOpenDM(c.id)}
                      className="group flex flex-col items-center flex-shrink-0"
                      title={c.full_name}
                    >
                      <div className="relative">
                        {c.avatar_url ? (
                          <img src={c.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover border-2 border-slate-200 dark:border-slate-700 group-hover:border-green-500 transition-all" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-green-600 text-white flex items-center justify-center font-bold text-xs group-hover:scale-105 transition-all">
                            {c.full_name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white dark:border-[#1B2620]" />
                      </div>
                      <span className="text-[9px] font-bold text-slate-700 dark:text-slate-300 w-12 truncate text-center mt-1">
                        {c.full_name.split(' ')[0]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder={activeTab === 'dm' ? "Filter contacts..." : "Filter groups..."}
                value={sidebarSearch}
                onChange={e => setSidebarSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-green-500 transition-all"
              />
            </div>
          </div>

          {/* List Content */}
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
            {activeTab === 'dm' ? (
              conversationsLoading ? (
                <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
                  <Loader2 className="animate-spin" size={18} />
                  <span className="text-xs font-bold">Loading chats...</span>
                </div>
              ) : conversations.length === 0 ? (
                <div className="text-center py-12 p-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                  <MessageSquare size={32} className="mx-auto text-slate-400 mb-2 opacity-50" />
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No direct messages</p>
                  <p className="text-[11px] text-slate-500 mt-1">Click "DM" above to start a conversation with a mentor or student.</p>
                </div>
              ) : (
                conversations
                  .filter(c => c.full_name.toLowerCase().includes(sidebarSearch.toLowerCase()))
                  .map(c => {
                    const isActive = activePartnerId === c.id;
                    const isTyping = typingPartners.get(c.id);

                    return (
                      <button
                        key={c.id}
                        onClick={() => handleOpenDM(c.id)}
                        className={cn(
                          "w-full p-3 rounded-2xl text-left transition-all flex items-start gap-3 border",
                          isActive
                            ? "bg-green-500/10 border-green-500/30 text-green-950 dark:text-green-300"
                            : "bg-transparent border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        )}
                      >
                        <div className="relative flex-shrink-0">
                          {c.avatar_url ? (
                            <img src={c.avatar_url} alt="" className="w-11 h-11 rounded-full object-cover border border-slate-200 dark:border-slate-700" />
                          ) : (
                            <div className="w-11 h-11 rounded-full bg-green-600 text-white flex items-center justify-center font-bold text-sm">
                              {c.full_name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-[#1B2620]" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="font-bold text-xs text-slate-900 dark:text-white truncate font-sans">{c.full_name}</h4>
                            {c.lastMessage && (
                              <span className="text-[10px] text-slate-400 font-mono">
                                {new Date(c.lastMessage.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate font-sans">
                            {isTyping ? (
                              <span className="text-green-500 font-bold italic animate-pulse">typing...</span>
                            ) : c.lastMessage?.content ? (
                              c.lastMessage.content
                            ) : (
                              <span className="italic text-slate-400">No messages yet</span>
                            )}
                          </p>
                        </div>
                      </button>
                    );
                  })
              )
            ) : (
              /* Groups Tab */
              groupsLoading ? (
                <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
                  <Loader2 className="animate-spin" size={18} />
                  <span className="text-xs font-bold">Loading groups...</span>
                </div>
              ) : (
                rtkGroups
                  .filter(g => g.name.toLowerCase().includes(sidebarSearch.toLowerCase()))
                  .map(g => {
                    const isActive = activeGroupId === g.id;

                    return (
                      <button
                        key={g.id}
                        onClick={() => handleOpenGroupChat(g.id)}
                        className={cn(
                          "w-full p-3 rounded-2xl text-left transition-all flex items-start gap-3 border",
                          isActive
                            ? "bg-green-500/10 border-green-500/30 text-green-950 dark:text-green-300"
                            : "bg-transparent border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        )}
                      >
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-green-600 to-teal-600 text-white flex items-center justify-center font-black text-sm shadow-md flex-shrink-0">
                          {g.name.slice(0, 2).toUpperCase()}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="font-bold text-xs text-slate-900 dark:text-white truncate font-sans flex items-center gap-1">
                              <span>{g.name}</span>
                              {g.is_private ? <Lock size={11} className="text-slate-400" /> : <Globe size={11} className="text-slate-400" />}
                            </h4>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold font-mono">
                              {g.members_count} members
                            </span>
                          </div>

                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate font-sans">
                            {g.description || "Cloudflare RealtimeKit Group Channel"}
                          </p>
                        </div>
                      </button>
                    );
                  })
              )
            )}
          </div>
        </div>

        {/* ── CHAT MAIN VIEW ── */}
        <div className={cn(
          "lg:col-span-8 bg-white dark:bg-[#1B2620] border border-slate-200 dark:border-slate-800 rounded-3xl p-4 md:p-6 flex flex-col shadow-sm transition-all overflow-hidden relative",
          (!activePartnerId && !activeGroupId) ? "hidden lg:flex items-center justify-center" : "flex"
        )}>
          {activePartner || activeGroup ? (
            <>
              {/* Chat Room Header */}
              <div className="border-b border-slate-100 dark:border-slate-800 pb-4 mb-4 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      closeConversation();
                      navigate('/messages');
                    }}
                    className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                  >
                    <ArrowLeft size={18} />
                  </button>

                  <div className="relative">
                    {activePartner ? (
                      activePartner.avatar_url ? (
                        <img src={activePartner.avatar_url} alt="" className="w-11 h-11 rounded-full object-cover border-2 border-green-500" />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-green-600 text-white flex items-center justify-center font-bold text-sm">
                          {activePartner.full_name.slice(0, 2).toUpperCase()}
                        </div>
                      )
                    ) : (
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-green-600 to-teal-600 text-white flex items-center justify-center font-black text-sm">
                        {activeGroup?.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="font-black text-sm md:text-base text-slate-900 dark:text-white font-sans tracking-tight flex items-center gap-2">
                      <span>{activePartner ? activePartner.full_name : activeGroup?.name}</span>
                      {activePartner?.role && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 font-bold uppercase tracking-wider">
                          {activePartner.role}
                        </span>
                      )}
                    </h3>

                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                      {activePartner ? (
                        typingPartners.get(activePartner.id) ? (
                          <span className="text-green-500 font-bold animate-pulse">typing...</span>
                        ) : (
                          "Cloudflare RealtimeKit DM"
                        )
                      ) : (
                        `${groupMembers.length} Members • Cloudflare Group Room`
                      )}
                    </p>
                  </div>
                </div>

                {/* Header Actions */}
                <div className="flex items-center gap-2">
                  {/* Voice Call */}
                  <button
                    onClick={() => {
                      if (!user) return;
                      const partnerName = activePartner ? activePartner.full_name : activeGroup?.name || 'Group';
                      const partnerAvatar = activePartner?.avatar_url || null;
                      const partnerId = activePartnerId || activeGroupId || 'group';
                      initiateCall(
                        user.id,
                        partnerId,
                        partnerName,
                        partnerAvatar,
                        'audio',
                        `Voice Call - ${partnerName}`,
                        activeGroupId
                      );
                    }}
                    className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white rounded-xl transition-all"
                    title="Start Voice Call"
                  >
                    <Phone size={18} />
                  </button>

                  {/* Video Call */}
                  <button
                    onClick={() => {
                      if (!user) return;
                      const partnerName = activePartner ? activePartner.full_name : activeGroup?.name || 'Group';
                      const partnerAvatar = activePartner?.avatar_url || null;
                      const partnerId = activePartnerId || activeGroupId || 'group';
                      initiateCall(
                        user.id,
                        partnerId,
                        partnerName,
                        partnerAvatar,
                        'video',
                        `Video Call - ${partnerName}`,
                        activeGroupId
                      );
                    }}
                    className="p-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl transition-all shadow-md"
                    title="Start Video Call"
                  >
                    <Video size={18} />
                  </button>

                  {/* Pinned Drawer Toggle */}
                  <button
                    onClick={() => setShowPinnedDrawer(!showPinnedDrawer)}
                    className={cn(
                      "p-2.5 rounded-xl transition-all",
                      showPinnedDrawer || pinnedMessages.length > 0
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600"
                    )}
                    title="View Pinned Messages"
                  >
                    <Pin size={18} />
                  </button>

                  {/* Group Members Manage button */}
                  {activeGroupId && (
                    <button
                      onClick={() => setShowMembersModal(true)}
                      className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-white rounded-xl transition-all"
                      title="Manage Group Members"
                    >
                      <Users size={18} />
                    </button>
                  )}
                </div>
              </div>

              {/* Pinned Messages Drawer Banner */}
              <AnimatePresence>
                {showPinnedDrawer && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3 mb-4 flex-shrink-0"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="text-xs font-black text-amber-700 dark:text-amber-300 font-sans flex items-center gap-1.5">
                        <Pin size={14} />
                        <span>Pinned Messages ({pinnedMessages.length})</span>
                      </h5>
                      <button onClick={() => setShowPinnedDrawer(false)} className="text-amber-600 text-xs">
                        <X size={14} />
                      </button>
                    </div>

                    {pinnedMessages.length === 0 ? (
                      <p className="text-xs text-amber-600/80 italic font-sans">No pinned messages yet. Hover any message and click the pin icon to save it here.</p>
                    ) : (
                      <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                        {pinnedMessages.map(pm => (
                          <div key={pm.id} className="bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-xl flex items-center justify-between text-xs border border-amber-500/20">
                            <span className="font-medium text-slate-800 dark:text-slate-200 truncate">{pm.content}</span>
                            <button
                              onClick={() => unpinMessage(pm.id)}
                              className="text-amber-600 hover:text-amber-700 font-bold text-[11px] ml-2 shrink-0"
                            >
                              Unpin
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Message History Feed */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-2 mb-4 scrollbar-thin">
                {messagesLoading ? (
                  <div className="flex items-center justify-center py-20 text-slate-400 gap-2">
                    <Loader2 className="animate-spin" size={20} />
                    <span className="text-xs font-bold">Retrieving messages from RealtimeKit...</span>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-20">
                    <div className="w-16 h-16 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center mx-auto mb-3">
                      <Sparkles size={28} />
                    </div>
                    <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200 font-sans">Say Hello!</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto font-sans">
                      Start your conversation powered by Cloudflare RealtimeKit with end-to-end reliability.
                    </p>
                  </div>
                ) : (
                  messages.map(m => {
                    const isOwn = m.sender_id === user?.id;
                    const isPinned = m.highlight_data?.is_pinned;
                    const isEdited = m.highlight_data?.is_edited;
                    const attachment = m.highlight_data;

                    return (
                      <div
                        key={m.id}
                        className={cn(
                          "flex gap-3 group relative",
                          isOwn ? "flex-row-reverse" : "flex-row"
                        )}
                      >
                        {/* Avatar */}
                        {!isOwn && (
                          <div className="w-8 h-8 rounded-full bg-slate-700 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-1">
                            {attachment?.sender_name ? attachment.sender_name.slice(0, 1).toUpperCase() : 'U'}
                          </div>
                        )}

                        <div className={cn("max-w-[75%]", isOwn ? "items-end text-right" : "items-start")}>
                          {/* Sender name for groups */}
                          {!isOwn && activeGroupId && attachment?.sender_name && (
                            <span className="text-[10px] font-bold text-slate-500 mb-1 block font-sans">
                              {attachment.sender_name}
                            </span>
                          )}

                          {/* Message Bubble */}
                          <div className={cn(
                            "p-3.5 rounded-2xl text-xs md:text-sm font-sans relative shadow-sm",
                            isOwn
                              ? "bg-green-600 text-white rounded-tr-none"
                              : "bg-slate-100 dark:bg-[#26362E] text-slate-900 dark:text-slate-100 rounded-tl-none border border-slate-200/50 dark:border-slate-800"
                          )}>
                            {/* Pinned indicator badge */}
                            {isPinned && (
                              <div className="flex items-center gap-1 text-[10px] font-bold text-amber-400 mb-1">
                                <Pin size={10} />
                                <span>Pinned</span>
                              </div>
                            )}

                            {/* Editing inline form */}
                            {editingMsgId === m.id ? (
                              <div className="space-y-2 min-w-[220px]">
                                <textarea
                                  value={editingContent}
                                  onChange={e => setEditingContent(e.target.value)}
                                  className="w-full p-2 text-xs bg-white text-slate-900 rounded-lg outline-none"
                                />
                                <div className="flex justify-end gap-1">
                                  <button
                                    onClick={() => setEditingMsgId(null)}
                                    className="px-2 py-1 text-[10px] font-bold text-slate-400"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={async () => {
                                      await editMessage(m.id, editingContent);
                                      setEditingMsgId(null);
                                    }}
                                    className="px-2.5 py-1 text-[10px] font-bold bg-green-700 text-white rounded-md"
                                  >
                                    Save
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                {/* Image Attachment Render */}
                                {attachment?.type === 'image' && attachment.url && (
                                  <div className="mb-2 rounded-xl overflow-hidden cursor-pointer max-w-sm border border-black/10">
                                    <img
                                      src={attachment.url}
                                      alt={attachment.name || ''}
                                      onClick={() => setSelectedPreviewImage(attachment.url)}
                                      className="w-full max-h-60 object-cover hover:scale-105 transition-all"
                                    />
                                  </div>
                                )}

                                {/* File Attachment Render */}
                                {attachment?.type === 'file' && attachment.url && (
                                  <a
                                    href={attachment.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-3 p-3 rounded-xl bg-black/10 dark:bg-white/10 mb-2 hover:bg-black/20 transition-all text-left"
                                  >
                                    <FileText size={24} className="text-amber-400 shrink-0" />
                                    <div className="min-w-0 flex-1">
                                      <p className="font-bold text-xs truncate">{attachment.name || 'Attachment'}</p>
                                      {attachment.size && (
                                        <p className="text-[10px] opacity-75 font-mono">
                                          {(attachment.size / 1024).toFixed(1)} KB
                                        </p>
                                      )}
                                    </div>
                                    <Download size={16} className="shrink-0 opacity-80" />
                                  </a>
                                )}

                                {/* Message text content */}
                                <p className="leading-relaxed whitespace-pre-wrap font-sans">{m.content}</p>

                                {isEdited && (
                                  <span className="text-[10px] opacity-70 italic ml-1">(edited)</span>
                                )}
                              </>
                            )}

                            {/* Meta & Status Bar */}
                            <div className="flex items-center justify-end gap-1 mt-1 text-[10px] opacity-75 font-mono">
                              <span>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              {isOwn && (
                                m.read_at ? <CheckCheck size={12} className="text-blue-300" /> : <Check size={12} />
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Action Dropdown Menu on Hover */}
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 self-center">
                          <button
                            onClick={() => isPinned ? unpinMessage(m.id) : pinMessage(m.id)}
                            className="p-1.5 text-slate-400 hover:text-amber-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                            title={isPinned ? "Unpin Message" : "Pin Message"}
                          >
                            <Pin size={13} />
                          </button>

                          {isOwn && (
                            <>
                              <button
                                onClick={() => {
                                  setEditingMsgId(m.id);
                                  setEditingContent(m.content);
                                }}
                                className="p-1.5 text-slate-400 hover:text-green-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                                title="Edit Message"
                              >
                                <Edit3 size={13} />
                              </button>

                              <button
                                onClick={() => deleteMessage(m.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                                title="Delete Message"
                              >
                                <Trash2 size={13} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Replies Chips */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-2 scrollbar-none">
                {QUICK_REPLIES.map((reply, idx) => (
                  <button
                    key={idx}
                    onClick={() => setNewMessageText(reply)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-full text-xs font-bold font-sans whitespace-nowrap transition-all"
                  >
                    {reply}
                  </button>
                ))}
              </div>

              {/* Pending File Attachment Preview Bar */}
              {pendingFile && (
                <div className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl mb-2 flex items-center justify-between text-xs font-sans border border-slate-300 dark:border-slate-700">
                  <div className="flex items-center gap-2 truncate">
                    <FileText size={16} className="text-green-500 shrink-0" />
                    <span className="font-bold text-slate-800 dark:text-slate-200 truncate">{pendingFile.name}</span>
                    <span className="text-[10px] text-slate-500 font-mono">({(pendingFile.size / 1024).toFixed(1)} KB)</span>
                  </div>
                  <button onClick={() => setPendingFile(null)} className="text-slate-400 hover:text-rose-500">
                    <X size={16} />
                  </button>
                </div>
              )}

              {/* Input Control Box */}
              <div className="relative flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                />

                {/* Attach File Button */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-3 text-slate-500 hover:text-green-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
                  title="Attach Image or Document"
                >
                  <Paperclip size={18} />
                </button>

                {/* Textarea */}
                <textarea
                  value={newMessageText}
                  onChange={e => {
                    setNewMessageText(e.target.value);
                    if (user && (activePartnerId || activeGroupId)) {
                      publishTyping(user.id, activeGroupId || activePartnerId!);
                    }
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Type a message..."
                  rows={1}
                  className="flex-1 py-3 px-4 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs md:text-sm font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-green-500 transition-all resize-none placeholder:text-slate-400"
                />

                {/* Send Action Button */}
                <button
                  onClick={handleSendMessage}
                  disabled={fileUploading || (!newMessageText.trim() && !pendingFile)}
                  className="p-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-xl transition-all shadow-md flex items-center justify-center"
                >
                  {fileUploading ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                </button>
              </div>
            </>
          ) : (
            /* Empty Active Chat Placeholder */
            <div className="text-center py-24 p-6">
              <div className="w-20 h-20 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 flex items-center justify-center mx-auto mb-4">
                <MessageSquare size={36} />
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white font-sans">Cloudflare RealtimeKit Messaging</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 max-w-md mx-auto font-sans leading-relaxed">
                Select a direct message or join a study group to communicate in real-time with instant file sharing and voice/video calling.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── MODAL 1: NEW DIRECT MESSAGE SEARCH ── */}
      {showNewMessageModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-white dark:bg-[#1B2620] rounded-3xl p-6 w-full max-w-md border border-slate-200 dark:border-slate-800 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-black text-slate-900 dark:text-white font-sans">New Direct Message</h3>
              <button onClick={() => setShowNewMessageModal(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>

            <div className="relative mb-4">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Search mentor or student by name..."
                value={newMsgSearch}
                onChange={e => setNewMsgSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 outline-none"
              />
            </div>

            <div className="max-h-64 overflow-y-auto space-y-2">
              {searchLoading ? (
                <div className="text-center py-6 text-slate-400"><Loader2 className="animate-spin mx-auto" size={20} /></div>
              ) : searchResults.length === 0 ? (
                <p className="text-center py-6 text-xs text-slate-400 font-sans">Type to search registered users.</p>
              ) : (
                searchResults.map(u => (
                  <button
                    key={u.id}
                    onClick={() => handleOpenDM(u.id)}
                    className="w-full p-3 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-3 transition-all text-left"
                  >
                    <div className="w-10 h-10 rounded-full bg-green-600 text-white flex items-center justify-center font-bold text-xs">
                      {u.full_name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-slate-900 dark:text-white">{u.full_name}</h4>
                      <p className="text-[10px] text-slate-500 font-mono">{u.role}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* ── MODAL 2: NEW GROUP CHAT ── */}
      {showNewGroupModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-white dark:bg-[#1B2620] rounded-3xl p-6 w-full max-w-lg border border-slate-200 dark:border-slate-800 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-black text-slate-900 dark:text-white font-sans">Create Cloudflare Group Chat</h3>
              <button onClick={() => setShowNewGroupModal(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>

            <form onSubmit={handleCreateGroupSubmit} className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">Group Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. React Developers Study Group"
                  value={newGroupName}
                  onChange={e => setNewGroupName(e.target.value)}
                  className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">Description (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Brief summary of group goals..."
                  value={newGroupDesc}
                  onChange={e => setNewGroupDesc(e.target.value)}
                  className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                <div>
                  <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200">Private Group</h5>
                  <p className="text-[10px] text-slate-500">Only invited members can join</p>
                </div>
                <input
                  type="checkbox"
                  checked={newGroupPrivate}
                  onChange={e => setNewGroupPrivate(e.target.checked)}
                  className="w-4 h-4 accent-green-600"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button variant="outline" type="button" onClick={() => setShowNewGroupModal(false)}>Cancel</Button>
                <Button variant="primary" type="submit">Create Group</Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* ── MODAL 3: MANAGE GROUP MEMBERS ── */}
      {showMembersModal && activeGroup && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-white dark:bg-[#1B2620] rounded-3xl p-6 w-full max-w-md border border-slate-200 dark:border-slate-800 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-black text-slate-900 dark:text-white font-sans">Group Members ({groupMembers.length})</h3>
              <button onClick={() => setShowMembersModal(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
              {groupMembers.map(m => (
                <div key={m.id} className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl flex items-center justify-between text-xs border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center font-bold text-xs">
                      {m.full_name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white font-sans">{m.full_name}</span>
                      <span className="text-[10px] text-slate-400 font-mono ml-2 uppercase">({m.role})</span>
                    </div>
                  </div>

                  {m.role !== 'owner' && (
                    <button
                      onClick={() => removeGroupMember(activeGroup.id, m.user_id)}
                      className="text-rose-500 hover:text-rose-600 p-1"
                      title="Remove Member"
                    >
                      <UserMinus size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      )}

      {/* Image Preview Expand Modal */}
      {selectedPreviewImage && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setSelectedPreviewImage(null)}>
          <img src={selectedPreviewImage} alt="" className="max-w-full max-h-[85vh] rounded-2xl shadow-2xl object-contain" />
        </div>
      )}
    </div>
  );
};

export default Messages;
