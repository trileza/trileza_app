import React, { useState, useEffect, useRef } from 'react';
import { Card, Button } from '../../components/ui';
import { 
  Search, 
  Send, 
  MoreVertical, 
  Video, 
  Phone,
  Highlighter,
  Loader2,
  Clock
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { nexus } from '../../lib/nexus';

const Messages = () => {
  const { user } = useAuthStore();
  
  const [activeChat, setActiveChat] = useState<any | null>(null);
  const [chatPartners, setChatPartners] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loadingPartners, setLoadingPartners] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Fetch real profiles as conversations/contacts
  const fetchConversations = async () => {
    if (!user) return;
    setLoadingPartners(true);
    try {
      const { data, error } = await nexus.database
        .from('profiles')
        .select('*')
        .neq('id', user.id)
        .order('full_name', { ascending: true });

      if (error) throw error;
      if (data) {
        setChatPartners(data);
        if (data.length > 0 && !activeChat) {
          setActiveChat(data[0]);
        }
      }
    } catch (err) {
      console.error('[Messages] Failed to load connections:', err);
    } finally {
      setLoadingPartners(false);
    }
  };

  // Fetch messages between current user and selected chat partner
  const fetchMessages = async () => {
    if (!user || !activeChat) return;
    setLoadingMessages(true);
    try {
      const { data, error } = await nexus.database
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${activeChat.id}),and(sender_id.eq.${activeChat.id},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true });

      if (error) throw error;
      if (data) {
        setMessages(data);
      }
    } catch (err) {
      console.error('[Messages] Failed to load messages:', err);
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [user?.id]);

  useEffect(() => {
    fetchMessages();
    
    // Setup interval for device synchronization & polling
    const timer = setInterval(() => {
      fetchMessages();
    }, 4000);

    return () => clearInterval(timer);
  }, [activeChat?.id, user?.id]);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = async () => {
    if (!newMessage.trim() || !user || !activeChat) return;
    const tempContent = newMessage.trim();
    setNewMessage('');
    try {
      const { error } = await nexus.database.from('messages').insert([{
        id: `msg-${Date.now()}`,
        sender_id: user.id,
        receiver_id: activeChat.id,
        content: tempContent
      }]);
      if (error) throw error;
      fetchMessages();
    } catch (err) {
      console.error('[Messages] Failed to send message:', err);
    }
  };

  const filteredPartners = chatPartners.filter(p => 
    p.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.role && p.role.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col md:flex-row gap-6 animate-in fade-in duration-500 pb-20 md:pb-0">
      {/* Sidebar: Chat partners */}
      <Card className="w-full md:w-80 flex flex-col border-none shadow-xl shadow-slate-200/50 bg-white rounded-[2rem] overflow-hidden shrink-0 h-[40vh] md:h-full dark:bg-slate-900">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 space-y-4">
          <h2 className="text-xl font-black text-slate-900 dark:text-white">Messages</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search contacts..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 transition-all font-medium dark:bg-slate-950 dark:text-slate-200"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {loadingPartners ? (
            <div className="flex justify-center items-center py-10">
              <Loader2 className="animate-spin text-emerald-500" size={20} />
            </div>
          ) : filteredPartners.length === 0 ? (
            <div className="text-center py-10 text-xs text-slate-400">No contacts found.</div>
          ) : (
            filteredPartners.map(chat => {
              const isActive = activeChat?.id === chat.id;
              const avatar = chat.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${chat.full_name}`;
              
              return (
                <div 
                  key={chat.id} 
                  onClick={() => setActiveChat(chat)}
                  className={`p-4 flex items-center gap-4 cursor-pointer transition-colors border-l-4 ${isActive ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20' : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-850'}`}
                >
                  <img src={avatar} alt="" className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <h4 className="text-sm font-bold text-slate-900 truncate dark:text-white">{chat.full_name}</h4>
                    </div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider font-extrabold truncate dark:text-slate-400">
                      {chat.role || 'User'}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>

      {/* Main Area: Active Chat */}
      <Card className="flex-1 flex flex-col border-none shadow-xl shadow-slate-200/50 bg-white rounded-[2rem] overflow-hidden h-[60vh] md:h-full dark:bg-slate-900">
        {activeChat ? (
          <>
            {/* Chat Header */}
            <div className="p-4 md:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white/50 dark:bg-slate-900/50 backdrop-blur-md z-10">
              <div className="flex items-center gap-4">
                <img 
                  src={activeChat.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${activeChat.full_name}`} 
                  alt="" 
                  className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-slate-100 dark:bg-slate-800 shrink-0" 
                />
                <div>
                  <h3 className="text-base md:text-lg font-bold text-slate-900 dark:text-white">{activeChat.full_name}</h3>
                  <p className="text-xs text-slate-450 font-medium capitalize">
                    {activeChat.role} • Sync Active
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 md:gap-4 text-slate-400">
                <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-850 rounded-full transition-colors"><Phone size={18} /></button>
                <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-850 rounded-full transition-colors"><Video size={18} /></button>
                <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-850 rounded-full transition-colors"><MoreVertical size={18} /></button>
              </div>
            </div>

            {/* Messages List */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 bg-slate-50/30 dark:bg-slate-950/20">
              {loadingMessages && messages.length === 0 ? (
                <div className="flex justify-center items-center h-full">
                  <Loader2 className="animate-spin text-emerald-500" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col justify-center items-center h-full text-slate-400 space-y-2 text-center p-6">
                  <Clock size={36} className="text-slate-350" />
                  <p className="text-sm font-bold">No messages yet</p>
                  <p className="text-xs">Start the conversation by typing your first message below.</p>
                </div>
              ) : (
                messages.map(msg => {
                  const isMe = msg.sender_id === user?.id;
                  
                  return (
                    <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      <div 
                        className={`max-w-[85%] md:max-w-[70%] rounded-2xl p-4 ${
                          isMe 
                            ? 'bg-emerald-600 text-white rounded-br-sm' 
                            : 'bg-white border border-slate-100 text-slate-700 shadow-sm rounded-bl-sm dark:bg-slate-800 dark:border-slate-750 dark:text-slate-200'
                        }`}
                      >
                        {msg.highlight_data ? (
                          <div className="space-y-3 text-left">
                            {/* Card header */}
                            <div className="flex items-center gap-2 border-b border-white/10 pb-2">
                              <Highlighter size={12} className={isMe ? "text-emerald-300" : "text-emerald-500"} />
                              <span className={`text-[9px] font-black uppercase tracking-wider ${isMe ? "text-emerald-300" : "text-emerald-500"}`}>
                                Secure DRM Highlight
                              </span>
                            </div>
                            
                            {/* Quote passage */}
                            <p className={`text-[11px] font-serif leading-relaxed italic py-2.5 px-3 rounded-r-xl border-l-2 ${
                              isMe 
                                ? 'border-emerald-300 bg-white/10 text-white' 
                                : 'border-emerald-500 bg-slate-50 text-slate-700 dark:bg-slate-900 dark:text-slate-200'
                            }`}>
                              "{msg.highlight_data.passage}"
                            </p>

                            {/* Comment */}
                            {msg.highlight_data.comment && (
                              <p className={`text-xs font-medium ${isMe ? 'text-emerald-100' : 'text-slate-400 dark:text-slate-300'}`}>
                                💡 {msg.highlight_data.comment}
                              </p>
                            )}

                            {/* Book card info */}
                            <div className={`flex gap-3 p-3 border rounded-xl items-center ${
                              isMe 
                                ? 'bg-white/10 border-white/10' 
                                : 'bg-slate-50 border-slate-100 dark:bg-slate-900 dark:border-slate-750'
                            }`}>
                              <img src={msg.highlight_data.book_cover} alt="" className="w-8 h-11 rounded object-cover shadow shrink-0" />
                              <div className="flex-1 min-w-0">
                                <h5 className={`text-[10px] font-extrabold truncate ${isMe ? 'text-white' : 'text-slate-800 dark:text-slate-200'}`}>
                                  {msg.highlight_data.book_title}
                                </h5>
                                <p className={`text-[9px] truncate ${isMe ? 'text-emerald-250' : 'text-slate-400'}`}>
                                  By {msg.highlight_data.book_author}
                                </p>
                                <Link 
                                  to={`/library/${msg.highlight_data.book_id}`}
                                  className={`inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-wider mt-1.5 transition-colors ${
                                    isMe 
                                      ? 'text-emerald-300 hover:text-white' 
                                      : 'text-emerald-500 hover:text-emerald-600'
                                  }`}
                                >
                                  Open Book →
                                </Link>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm font-medium leading-relaxed">{msg.content}</p>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 mt-1.5 px-1 font-medium">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-4">
                <input 
                  type="text" 
                  placeholder="Type your message..." 
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && handleSend()}
                  className="flex-1 bg-slate-50 dark:bg-slate-950 border-none rounded-full px-6 py-3 text-sm font-medium focus:ring-2 focus:ring-emerald-500/20 transition-all dark:text-slate-200 placeholder:text-slate-400 shadow-inner"
                />
                <Button 
                  onClick={handleSend}
                  className="rounded-full w-12 h-12 p-0 flex items-center justify-center bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/30 shrink-0"
                >
                  <Send size={18} className="translate-x-0.5" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col justify-center items-center h-full text-slate-400 space-y-3 p-6 text-center">
            <Loader2 className="animate-spin text-emerald-500" size={30} />
            <p className="text-sm font-bold">Synchronizing messages...</p>
          </div>
        )}
      </Card>
    </div>
  );
};

export default Messages;
