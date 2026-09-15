/**
 * ChatPanel — Bespoke White Theme Chat Sidebar
 * ─────────────────────────────────────────────
 * Uses RTK v2.0 chat API: chatUpdate event, fetchPublicMessages,
 * file/image messages, edit/delete/pin support.
 */
import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Send, Smile, Paperclip, Image as ImageIcon, Pin, PinOff, Pencil, Trash2, FileText, Download } from 'lucide-react';
import { useMeetingStore } from '../../store/meetingStore';

const ChatPanel: React.FC = () => {
  const {
    chatMessages, meeting, sendChatMessage, sendFileMessage, sendImageMessage,
    editChatMessage, deleteChatMessage, pinMessage, unpinMessage,
    setChatMessages, setActivePanel, clearUnreadChat, addToast,
  } = useMeetingStore();
  const [input, setInput] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const emojis = ['😀', '😂', '❤️', '👍', '👏', '🎉', '🔥', '💡', '✅', '❓', '🙌', '💯'];

  // Clear unread on mount
  useEffect(() => {
    clearUnreadChat();
  }, [clearUnreadChat]);

  // Fetch existing messages on mount
  useEffect(() => {
    if (meeting?.chat) {
      meeting.chat.fetchPublicMessages({ limit: 100, direction: 'before' })
        .then((messages: any[]) => {
          if (messages && messages.length > 0) {
            const formatted = messages.map((msg: any) => ({
              id: msg.id,
              senderId: msg.userId || '',
              senderName: msg.displayName || 'Scholar',
              message: msg.message || msg.link || '',
              timestamp: msg.time ? new Date(msg.time).getTime() : Date.now(),
              isPrivate: !!(msg.targetUserIds && msg.targetUserIds.length > 0),
              type: msg.type || 'text',
              link: msg.link,
              fileName: msg.name,
              fileSize: msg.size,
              pinned: msg.pinned || false,
              isEdited: msg.isEdited || false,
            }));
            setChatMessages(formatted);
          }
        })
        .catch((err: any) => console.error('[Chat] Failed to fetch messages:', err));
    }
  }, [meeting]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const handleSend = () => {
    if (!input.trim()) return;
    sendChatMessage(input.trim());
    setInput('');
    setShowEmoji(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      sendFileMessage(file);
      addToast('File sent', 'success');
    }
    e.target.value = '';
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      sendImageMessage(file);
      addToast('Image sent', 'success');
    }
    e.target.value = '';
  };

  const handleEdit = (msgId: string) => {
    if (!editText.trim()) return;
    editChatMessage(msgId, editText.trim());
    setEditingMessageId(null);
    setEditText('');
  };

  const renderMessageContent = (msg: any) => {
    if (msg.type === 'image' && msg.link) {
      return (
        <a href={msg.link} target="_blank" rel="noopener noreferrer" className="block">
          <img
            src={msg.link}
            alt="Shared image"
            className="max-w-full max-h-48 rounded-xl object-cover border border-slate-700"
          />
        </a>
      );
    }

    if (msg.type === 'file' && msg.link) {
      return (
        <a
          href={msg.link}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-800 transition-colors"
        >
          <FileText size={16} className="text-slate-400 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-slate-200 truncate">{msg.fileName || 'File'}</p>
            {msg.fileSize && (
              <p className="text-[10px] text-slate-500">{(msg.fileSize / 1024).toFixed(1)} KB</p>
            )}
          </div>
          <Download size={14} className="text-emerald-500 shrink-0" />
        </a>
      );
    }

    return <span>{msg.message}</span>;
  };

  return (
    <div className="w-full h-full flex flex-col bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-black text-white uppercase tracking-wider">Chat</h3>
          <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-[9px] font-black tracking-widest">
            {chatMessages.length}
          </span>
        </div>
        <button
          onClick={() => setActivePanel('none')}
          className="p-2 rounded-xl hover:bg-slate-800 text-slate-500 hover:text-slate-200 transition-all border-none bg-transparent cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
        {chatMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-12">
            <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center">
              <span className="text-2xl">💬</span>
            </div>
            <p className="text-xs font-bold text-slate-400">No messages yet</p>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              Start the conversation
            </p>
          </div>
        ) : (
          chatMessages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="group"
            >
              <div className="flex items-start gap-2 text-left">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[10px] font-black text-emerald-400">
                    {msg.senderName?.charAt(0)?.toUpperCase() || '?'}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-xs font-black text-white truncate">{msg.senderName}</span>
                    <span className="text-[9px] font-bold text-slate-500">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {msg.isEdited && (
                      <span className="text-[9px] font-bold text-slate-500 italic">(edited)</span>
                    )}
                    {msg.pinned && (
                      <Pin size={10} className="text-amber-500" />
                    )}
                  </div>

                  {/* Edit mode */}
                  {editingMessageId === msg.id ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleEdit(msg.id); if (e.key === 'Escape') setEditingMessageId(null); }}
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/10"
                        autoFocus
                      />
                      <button onClick={() => handleEdit(msg.id)} className="px-2 py-1 rounded-lg bg-emerald-500 text-white text-xs font-bold">Save</button>
                      <button onClick={() => setEditingMessageId(null)} className="px-2 py-1 rounded-lg bg-slate-800 text-slate-300 text-xs font-bold">Cancel</button>
                    </div>
                  ) : (
                    <div className={`px-3 py-2 rounded-2xl rounded-tl-md text-sm text-slate-200 leading-relaxed break-words border ${
                      msg.isAnnouncement
                        ? 'bg-emerald-500/15 border-emerald-500/25'
                        : msg.pinned
                        ? 'bg-amber-500/15 border-amber-500/25'
                        : 'bg-slate-900 border-slate-800'
                    }`}>
                      {renderMessageContent(msg)}
                    </div>
                  )}

                  {/* Action buttons (visible on hover) */}
                  {editingMessageId !== msg.id && (
                    <div className="flex gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {msg.type === 'text' && (
                        <button
                          onClick={() => { setEditingMessageId(msg.id); setEditText(msg.message); }}
                          className="p-1 rounded text-slate-500 hover:text-blue-500 hover:bg-blue-500/15 transition-all"
                          title="Edit"
                        >
                          <Pencil size={10} />
                        </button>
                      )}
                      <button
                        onClick={() => deleteChatMessage(msg.id)}
                        className="p-1 rounded text-slate-500 hover:text-red-500 hover:bg-red-500/15 transition-all"
                        title="Delete"
                      >
                        <Trash2 size={10} />
                      </button>
                      <button
                        onClick={() => msg.pinned ? unpinMessage(msg.id) : pinMessage(msg.id)}
                        className="p-1 rounded text-slate-500 hover:text-amber-500 hover:bg-amber-500/15 transition-all"
                        title={msg.pinned ? 'Unpin' : 'Pin'}
                      >
                        {msg.pinned ? <PinOff size={10} /> : <Pin size={10} />}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Emoji Picker */}
      {showEmoji && (
        <div className="px-4 pb-2">
          <div className="bg-slate-900 rounded-2xl border border-slate-700 p-2 flex flex-wrap gap-1 shadow-lg">
            {emojis.map((emoji) => (
              <button
                key={emoji}
                onClick={() => { setInput(prev => prev + emoji); setShowEmoji(false); }}
                className="w-9 h-9 rounded-xl hover:bg-slate-800 flex items-center justify-center text-lg transition-all hover:scale-110 border-none bg-transparent cursor-pointer"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Hidden file inputs */}
      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />

      {/* Input */}
      <div className="px-4 pb-4 pt-2 border-t border-slate-800 shrink-0">
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-2xl px-3 py-1 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/10 transition-all">
          <button
            onClick={() => setShowEmoji(!showEmoji)}
            className="p-2 rounded-xl text-slate-500 hover:text-emerald-400 hover:bg-slate-800 transition-all shrink-0 border-none bg-transparent cursor-pointer"
          >
            <Smile size={18} />
          </button>
          <button
            onClick={() => imageInputRef.current?.click()}
            className="p-2 rounded-xl text-slate-500 hover:text-emerald-400 hover:bg-slate-800 transition-all shrink-0 border-none bg-transparent cursor-pointer"
            title="Send image"
          >
            <ImageIcon size={16} />
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 rounded-xl text-slate-500 hover:text-emerald-400 hover:bg-slate-800 transition-all shrink-0 border-none bg-transparent cursor-pointer"
            title="Send file"
          >
            <Paperclip size={16} />
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1 bg-transparent border-none outline-none text-sm text-white placeholder-slate-455 py-2 focus:ring-0"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="p-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white transition-all active:scale-90 disabled:opacity-30 disabled:pointer-events-none shrink-0 border-none cursor-pointer"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;
