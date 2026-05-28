import React, { useState } from 'react';
import { Card, Button } from '../../components/ui';
import { 
  Search, 
  Send, 
  Paperclip, 
  Image as ImageIcon, 
  MoreVertical, 
  Video, 
  Phone
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

const dummyChats = [
  { id: 1, name: 'Alice Smith', lastMessage: 'Can we schedule a session?', timestamp: '10:42 AM', unread: 2, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alice' },
  { id: 2, name: 'Trivent Support', lastMessage: 'Your issue has been resolved', timestamp: 'Yesterday', unread: 0, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Support' },
  { id: 3, name: 'Bob Johnson', lastMessage: 'Thanks for the notes!', timestamp: 'Mon', unread: 0, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bob' },
];

const dummyMessages = [
  { id: 1, sender: 'Alice Smith', text: 'Hi! Could you help me with the recent assignment?', time: '10:30 AM', isMe: false },
  { id: 2, sender: 'Me', text: 'Of course! What specific part are you struggling with?', time: '10:35 AM', isMe: true },
  { id: 3, sender: 'Alice Smith', text: 'The React hooks section is confusing. Can we schedule a session?', time: '10:42 AM', isMe: false },
];

const Messages = () => {
  const { user } = useAuthStore();
  const [activeChat, setActiveChat] = useState(dummyChats[0]);
  const [messages, setMessages] = useState(dummyMessages);
  const [newMessage, setNewMessage] = useState('');

  const handleSend = () => {
    if (!newMessage.trim()) return;
    setMessages([
      ...messages, 
      { 
        id: Date.now(), 
        sender: 'Me', 
        text: newMessage, 
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 
        isMe: true 
      }
    ]);
    setNewMessage('');
  };

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col md:flex-row gap-6 animate-in fade-in duration-500 pb-20 md:pb-0">
      {/* Sidebar: Conversations List */}
      <Card className="w-full md:w-80 flex flex-col border-none shadow-xl shadow-slate-200/50 bg-white rounded-[2rem] overflow-hidden shrink-0 h-[40vh] md:h-full">
        <div className="p-6 border-b border-slate-100 space-y-4">
          <h2 className="text-xl font-black text-slate-900">Messages</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search conversations..." 
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 transition-all font-medium"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {dummyChats.map(chat => (
            <div 
              key={chat.id} 
              onClick={() => setActiveChat(chat)}
              className={`p-4 flex items-center gap-4 cursor-pointer transition-colors border-l-4 ${activeChat.id === chat.id ? 'border-emerald-500 bg-emerald-50/50' : 'border-transparent hover:bg-slate-50'}`}
            >
              <img src={chat.avatar} alt={chat.name} className="w-12 h-12 rounded-full bg-slate-100" />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-1">
                  <h4 className="text-sm font-bold text-slate-900 truncate">{chat.name}</h4>
                  <span className="text-[10px] text-slate-400 font-medium">{chat.timestamp}</span>
                </div>
                <p className="text-xs text-slate-500 truncate">{chat.lastMessage}</p>
              </div>
              {chat.unread > 0 && (
                <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-[10px] font-bold text-white shadow-sm">
                  {chat.unread}
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Main Area: Active Chat */}
      <Card className="flex-1 flex flex-col border-none shadow-xl shadow-slate-200/50 bg-white rounded-[2rem] overflow-hidden h-[60vh] md:h-full">
        {/* Chat Header */}
        <div className="p-4 md:p-6 border-b border-slate-100 flex items-center justify-between bg-white/50 backdrop-blur-md z-10">
          <div className="flex items-center gap-4">
            <img src={activeChat.avatar} alt={activeChat.name} className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-slate-100" />
            <div>
              <h3 className="text-base md:text-lg font-bold text-slate-900">{activeChat.name}</h3>
              <p className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span> Online
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-4 text-slate-400">
            <button className="p-2 hover:bg-slate-100 rounded-full transition-colors"><Phone size={18} /></button>
            <button className="p-2 hover:bg-slate-100 rounded-full transition-colors"><Video size={18} /></button>
            <button className="p-2 hover:bg-slate-100 rounded-full transition-colors"><MoreVertical size={18} /></button>
          </div>
        </div>

        {/* Messages List */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 bg-slate-50/30">
          {messages.map(msg => (
            <div key={msg.id} className={`flex flex-col ${msg.isMe ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[85%] md:max-w-[70%] rounded-2xl p-4 ${msg.isMe ? 'bg-emerald-600 text-white rounded-br-sm' : 'bg-white border border-slate-100 text-slate-700 shadow-sm rounded-bl-sm'}`}>
                <p className="text-sm font-medium leading-relaxed">{msg.text}</p>
              </div>
              <span className="text-[10px] text-slate-400 mt-1.5 px-1 font-medium">{msg.time}</span>
            </div>
          ))}
        </div>

        {/* Message Input */}
        <div className="p-4 bg-white border-t border-slate-100">
          <div className="flex items-center gap-2 md:gap-4 flex-wrap md:flex-nowrap">
            <button className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors shrink-0">
              <Paperclip size={20} />
            </button>
            <button className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors shrink-0">
              <ImageIcon size={20} />
            </button>
            <div className="flex-1 relative order-last md:order-none w-full md:w-auto mt-2 md:mt-0">
              <input 
                type="text" 
                placeholder="Type your message..." 
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                className="w-full bg-slate-50 border-none rounded-full px-6 py-3 md:py-4 text-sm font-medium focus:ring-2 focus:ring-emerald-500/20 transition-all placeholder:text-slate-400 shadow-inner"
              />
            </div>
            <Button 
              onClick={handleSend}
              className="rounded-full w-12 h-12 md:w-14 md:h-14 p-0 flex items-center justify-center bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/30 shrink-0"
            >
              <Send size={18} className="translate-x-0.5" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default Messages;
