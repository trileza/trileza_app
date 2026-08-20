/**
 * ShareMeetingModal — Social Sharing Orchestrator
 * ────────────────────────────────────────────────
 * Custom modal featuring a live card preview and one-click social sharing intents
 * for WhatsApp, Facebook, Twitter/X, LinkedIn, Instagram, Email, and Copy Link.
 * Target URL routes through Netlify Edge Functions for dynamic Open Graph previews.
 */
import React, { useState, useEffect } from 'react';
import { 
  X, Copy, Check, Share2, Mail, MessageCircle, 
  Facebook, Twitter, Linkedin, Instagram 
} from 'lucide-react';
import { Card, Button } from '../ui';
import { useAuthStore } from '../../store/authStore';
import { messageService } from '../../lib/services/messages';

interface ShareMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  meeting: {
    id?: string;
    title: string;
    scheduled_at: string;
    tutor_name?: string;
    dyte_meeting_id: string; // The Jitsi room name
    image_url?: string;
    recurring?: string;
  };
  hostName: string;
}

const ShareMeetingModal: React.FC<ShareMeetingModalProps> = ({
  isOpen,
  onClose,
  meeting,
  hostName,
}) => {
  const [copied, setCopied] = useState(false);
  const { user } = useAuthStore();
  const [contacts, setContacts] = useState<any[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [invitedPartners, setInvitedPartners] = useState<Record<string, boolean>>({});

  // The shareable URL points to our dynamic Edge Function endpoint
  // Using dyte_meeting_id (the room name) as the identifier
  const shareUrl = `${window.location.origin}/share/${meeting.dyte_meeting_id}`;

  const formattedDate = meeting.scheduled_at
    ? new Date(meeting.scheduled_at).toLocaleString([], {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Instant Live Session';

  const shareText = `Join the live session "${meeting.title}" hosted by ${hostName} on Trileza!\nScheduled: ${formattedDate}\nJoin here:`;

  useEffect(() => {
    if (isOpen && user?.id) {
      setLoadingContacts(true);
      messageService.getConversations(user.id)
        .then(setContacts)
        .catch(err => console.error('[Share] Failed to load contacts:', err))
        .finally(() => setLoadingContacts(false));
    }
  }, [isOpen, user?.id]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`${shareUrl}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDirectInvite = async (partnerId: string) => {
    if (!user?.id) return;
    try {
      await messageService.sendMessage(
        user.id,
        partnerId,
        `Hey! I'm inviting you to a live classroom session:\n\n"${meeting.title}"\nScheduled: ${formattedDate}\n\nJoin the live session here: ${shareUrl}`
      );
      setInvitedPartners(prev => ({ ...prev, [partnerId]: true }));
    } catch (err) {
      console.error('[Share] Direct invite failed:', err);
      alert('Failed to send invitation. Please try again.');
    }
  };

  if (!isOpen) return null;

  const platforms = [
    {
      name: 'WhatsApp',
      icon: MessageCircle,
      color: 'bg-emerald-600 hover:bg-emerald-700 text-white',
      url: `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`,
    },
    {
      name: 'Facebook',
      icon: Facebook,
      color: 'bg-blue-600 hover:bg-blue-700 text-white',
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
    },
    {
      name: 'Twitter / X',
      icon: Twitter,
      color: 'bg-slate-950 hover:bg-slate-900 text-white border border-white/10',
      url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
    },
    {
      name: 'LinkedIn',
      icon: Linkedin,
      color: 'bg-indigo-650 hover:bg-indigo-700 text-white',
      url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
    },
    {
      name: 'Instagram',
      icon: Instagram,
      color: 'bg-gradient-to-tr from-yellow-500 via-pink-500 to-purple-600 text-white',
      onClick: () => {
        navigator.clipboard.writeText(shareUrl);
        alert(
          "Instagram doesn't support direct link sharing. The link has been copied to your clipboard! You can paste it into your bio, stories, or direct messages."
        );
      },
    },
    {
      name: 'Email',
      icon: Mail,
      color: 'bg-slate-800 hover:bg-slate-900 text-white border border-transparent',
      url: `mailto:?subject=${encodeURIComponent(`Invitation: ${meeting.title} on Trileza`)}&body=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`,
    },
  ];

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"
    >
      <Card 
        onClick={(e) => e.stopPropagation()}
        className="max-w-xl w-full bg-white border border-slate-200 p-8 md:p-10 rounded-[3rem] space-y-6 shadow-2xl text-left relative overflow-hidden max-h-[90vh] flex flex-col"
      >
        {/* Background Ambience */}
        <div className="absolute top-0 right-0 w-36 h-36 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-5 shrink-0 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <Share2 size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 tracking-tight">Share Session Node</h2>
              <p className="text-xs text-slate-500 font-medium">Distribute this broadcast link to the learning network.</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2.5 rounded-2xl hover:bg-slate-100 text-slate-400 hover:text-slate-800 transition-all border-none bg-transparent cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto space-y-6 pr-2 -mr-2 custom-scrollbar">
          {/* Card Preview */}
          <div className="space-y-3 relative z-10">
            <label className="text-[10px] font-black uppercase tracking-widest text-emerald-600 ml-1">Card Live Preview</label>
            <div className="border border-slate-200 rounded-[2rem] overflow-hidden bg-slate-50 flex flex-col sm:flex-row shadow-sm">
              {/* Thumbnail */}
              <div className="sm:w-2/5 aspect-[16/10] sm:aspect-auto relative bg-slate-100 border-r border-slate-200">
                <img 
                  src={meeting.image_url || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400&h=300&fit=crop'} 
                  alt={meeting.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t sm:bg-gradient-to-r from-slate-50 via-transparent to-transparent" />
              </div>
              {/* Info */}
              <div className="p-6 sm:w-3/5 flex flex-col justify-between gap-4 text-left">
                <div className="space-y-2">
                  <span className="px-2 py-0.5 rounded bg-emerald-100 border border-emerald-200 text-emerald-700 text-[8px] font-black uppercase tracking-wider">
                    {meeting.recurring ? `Recurring: ${meeting.recurring}` : 'Cohorts Live'}
                  </span>
                  <h4 className="text-base font-black text-slate-800 leading-snug line-clamp-2">{meeting.title}</h4>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">Host: {hostName}</p>
                  <p className="text-[10px] font-bold text-slate-400 leading-none mt-1">{formattedDate}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Direct In-App Contacts Invitation */}
          <div className="space-y-3 relative z-10">
            <label className="text-[10px] font-black uppercase tracking-widest text-emerald-600 ml-1 font-sans">Direct Invite Partners</label>
            {loadingContacts ? (
              <div className="text-slate-500 font-bold text-xs font-sans">Loading contacts...</div>
            ) : contacts.length === 0 ? (
              <div className="text-slate-500 font-bold text-xs font-sans">No active chat partners to invite.</div>
            ) : (
              <div className="flex flex-col gap-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                {contacts.map(contact => (
                  <div key={contact.id} className="flex items-center justify-between bg-white border border-slate-200 rounded-2xl p-3 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-xs border border-emerald-200 font-sans">
                        {contact.full_name.split(' ').map((n: string) => n[0]).join('')}
                      </div>
                      <div>
                        <p className="text-xs font-black text-slate-800 leading-none font-sans">{contact.full_name}</p>
                        <p className="text-[9px] font-bold text-slate-500 mt-1 capitalize font-sans">{contact.role}</p>
                      </div>
                    </div>
                    <Button
                      onClick={() => handleDirectInvite(contact.id)}
                      disabled={invitedPartners[contact.id]}
                      className={`py-1.5 px-4 rounded-xl text-[10px] font-black uppercase tracking-wider border-none ${
                        invitedPartners[contact.id] 
                          ? 'bg-slate-100 text-slate-400' 
                          : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                      }`}
                    >
                      {invitedPartners[contact.id] ? 'Invited' : 'Invite'}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Copy Link Row */}
          <div className="space-y-2 relative z-10">
            <label className="text-[10px] font-black uppercase tracking-widest text-emerald-600 ml-1">Secure Broadcast URL</label>
            <div className="flex gap-2">
              <input 
                type="text" 
                readOnly 
                value={shareUrl}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500/20 select-all"
              />
              <Button
                onClick={handleCopyLink}
                className="h-[52px] px-6 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-500/20 flex items-center gap-2 border-none shrink-0"
              >
                {copied ? (
                  <>
                    <Check size={16} /> Copied
                  </>
                ) : (
                  <>
                    <Copy size={16} /> Copy
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Social Platforms Grid */}
          <div className="space-y-3 relative z-10">
            <label className="text-[10px] font-black uppercase tracking-widest text-emerald-600 ml-1">Distribute Node</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {platforms.map((platform) => {
                const Icon = platform.icon;
                return platform.url ? (
                  <a
                    key={platform.name}
                    href={platform.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`py-3.5 px-4 rounded-2xl font-black text-[10px] uppercase tracking-wider flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] no-underline shadow-md ${platform.color}`}
                  >
                    <Icon size={14} />
                    {platform.name}
                  </a>
                ) : (
                  <button
                    key={platform.name}
                    onClick={platform.onClick}
                    className={`py-3.5 px-4 rounded-2xl font-black text-[10px] uppercase tracking-wider flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] border-none shadow-md cursor-pointer ${platform.color}`}
                  >
                    <Icon size={14} />
                    {platform.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        
        {/* Footer Action */}
        <div className="pt-5 border-t border-slate-100 flex justify-end shrink-0 relative z-10">
          <Button
            onClick={onClose}
            className="py-3 px-8 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-slate-900/10 border-none"
          >
            Done
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default ShareMeetingModal;
