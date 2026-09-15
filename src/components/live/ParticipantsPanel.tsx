/**
 * ParticipantsPanel — Bespoke White Theme Participant List
 * ────────────────────────────────────────────────────────
 * Custom participant cards with avatars, role badges, status indicators,
 * and teacher-only management controls (mute, spotlight, kick).
 */
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  X, Search, Mic, MicOff, Video, VideoOff, Hand,
  Star, UserX, Volume2, MoreVertical, Crown, Shield, GraduationCap, HandMetal
} from 'lucide-react';
import { useMeetingStore } from '../../store/meetingStore';

interface ParticipantsPanelProps {
  userRole: 'teacher' | 'student' | 'moderator';
}

const ParticipantsPanel: React.FC<ParticipantsPanelProps> = ({ userRole }) => {
  const {
    participants, lobbyRequests, setActivePanel,
    muteParticipant, spotlightParticipant, kickParticipant,
    approveLobby, rejectLobby, meeting, setParticipantHandRaise,
  } = useMeetingStore();

  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const isTeacher = userRole === 'teacher' || userRole === 'moderator';

  const filtered = participants.filter(p =>
    p.displayName.toLowerCase().includes(search.toLowerCase())
  );

  // Sort: teachers first, then hand-raised, then alphabetical
  const sorted = [...filtered].sort((a, b) => {
    if (a.role === 'teacher' && b.role !== 'teacher') return -1;
    if (b.role === 'teacher' && a.role !== 'teacher') return 1;
    if (a.isHandRaised && !b.isHandRaised) return -1;
    if (b.isHandRaised && !a.isHandRaised) return 1;
    return a.displayName.localeCompare(b.displayName);
  });

  const RoleBadge: React.FC<{ role: string }> = ({ role }) => {
    const config = {
      teacher: { icon: Crown, color: 'text-amber-400 bg-amber-500/15 border-amber-500/25', label: 'Teacher' },
      moderator: { icon: Shield, color: 'text-blue-400 bg-blue-500/15 border-blue-500/25', label: 'Mod' },
      student: { icon: GraduationCap, color: 'text-slate-400 bg-slate-900 border-slate-700', label: 'Student' },
    }[role] || { icon: GraduationCap, color: 'text-slate-400 bg-slate-900 border-slate-700', label: role };

    const Icon = config.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[9px] font-black uppercase tracking-widest ${config.color}`}>
        <Icon size={10} />
        {config.label}
      </span>
    );
  };

  return (
    <div
      className="w-full h-full flex flex-col bg-slate-900"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-black text-slate-805 uppercase tracking-wider">Participants</h3>
          <span className="px-2 py-0.5 rounded-full bg-emerald-555 bg-emerald-500/15 border border-emerald-500/25 text-emerald-605 text-[9px] font-black tracking-widest">
            {participants.length}
          </span>
        </div>
        <button
          onClick={() => setActivePanel('none')}
          className="p-2 rounded-xl hover:bg-slate-800 text-slate-500 hover:text-slate-200 transition-all border-none bg-transparent cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>

      {/* Search */}
      <div className="px-4 py-3 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2">
          <Search size={14} className="text-slate-405" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search participants..."
            className="flex-1 bg-transparent border-none outline-none text-xs text-white placeholder-slate-455"
          />
        </div>
      </div>

      {/* Lobby Requests (Moderator Only) */}
      {isTeacher && lobbyRequests && lobbyRequests.length > 0 && (
        <div className="px-4 py-3 bg-emerald-500/50 border-b border-slate-700 space-y-2 shrink-0 text-left">
          <p className="text-[10px] font-black text-emerald-655 text-emerald-400 uppercase tracking-widest flex items-center gap-1.5 animate-pulse">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> Join Requests ({lobbyRequests.length})
          </p>
          <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
            {lobbyRequests.map((req) => (
              <div key={req.id} className="flex items-center justify-between bg-slate-900 p-2.5 rounded-xl border border-slate-800 gap-2 shadow-sm">
                <span className="text-xs font-bold text-white truncate">{req.displayName}</span>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => approveLobby(req.id)}
                    className="px-2.5 py-1 rounded bg-emerald-500 hover:bg-emerald-600 text-white text-[9px] font-black uppercase tracking-wider border-none cursor-pointer"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => rejectLobby(req.id)}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-800 text-slate-300 text-[9px] font-black uppercase tracking-wider border border-slate-700 cursor-pointer"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1 no-scrollbar text-left">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-12">
            <p className="text-xs font-bold text-slate-505">
              {search ? 'No participants match your search' : 'No participants yet'}
            </p>
          </div>
        ) : (
          sorted.map((p) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="group"
            >
              <div className={`flex items-center gap-3 p-3 rounded-2xl transition-all ${
                expandedId === p.id ? 'bg-slate-900' : 'hover:bg-slate-105 hover:bg-slate-900/50'
              } ${p.isDominantSpeaker ? 'ring-1 ring-emerald-500/30 bg-emerald-500/10' : ''}`}>
                {/* Avatar */}
                <div className="relative shrink-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center border overflow-hidden ${
                    p.isDominantSpeaker
                      ? 'bg-emerald-500/15 border-emerald-500/30'
                      : 'bg-slate-900 border-slate-700'
                  }`}>
                    {p.avatarUrl ? (
                      <img src={p.avatarUrl} alt={p.displayName} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-sm font-black text-emerald-400">
                        {p.displayName?.charAt(0)?.toUpperCase() || '?'}
                      </span>
                    )}
                  </div>
                  {p.isHandRaised && (
                    <motion.div
                      animate={{ y: [0, -3, 0] }}
                      transition={{ duration: 1, repeat: Infinity }}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 rounded-lg flex items-center justify-center shadow"
                    >
                      <Hand size={10} className="text-white" />
                    </motion.div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-white truncate">{p.displayName}</span>
                    <RoleBadge role={p.role} />
                  </div>
                  {/* Status indicators */}
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`${p.isMuted ? 'text-red-500' : 'text-emerald-555 text-emerald-400'}`}>
                      {p.isMuted ? <MicOff size={10} /> : <Mic size={10} />}
                    </span>
                    <span className={`${!p.isCameraOn ? 'text-red-555 text-red-500' : 'text-emerald-555 text-emerald-400'}`}>
                      {p.isCameraOn ? <Video size={10} /> : <VideoOff size={10} />}
                    </span>
                    {p.isScreenSharing && (
                      <span className="text-[9px] font-bold text-blue-500 uppercase tracking-widest">Sharing</span>
                    )}
                  </div>
                </div>

                {/* Teacher Actions */}
                {isTeacher && (
                  <button
                    onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                    className="p-2 rounded-xl hover:bg-slate-800 text-slate-500 hover:text-slate-200 opacity-0 group-hover:opacity-100 transition-all border-none bg-transparent cursor-pointer"
                  >
                    <MoreVertical size={14} />
                  </button>
                )}
              </div>

              {/* Expanded Actions */}
              {isTeacher && expandedId === p.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="ml-12 flex gap-2 px-3 pb-2 pt-1 flex-wrap"
                >
                  <button
                    onClick={() => muteParticipant(p.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/25 text-amber-400 text-[10px] font-bold hover:bg-amber-500/25 transition-all cursor-pointer"
                  >
                    <Volume2 size={12} /> Mute
                  </button>
                  <button
                    onClick={() => spotlightParticipant(p.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-[10px] font-bold hover:bg-emerald-500/25 transition-all cursor-pointer"
                  >
                    <Star size={12} /> Spotlight
                  </button>
                  {p.isHandRaised && (
                    <button
                      onClick={() => {
                        // Broadcast lower-hand on behalf of this participant
                        if (meeting?.participants) {
                          meeting.participants.broadcastMessage('hand_raise', {
                            raised: false,
                            peerId: p.id,
                            timestamp: Date.now(),
                          }).catch(() => {});
                        }
                        setParticipantHandRaise(p.id, false);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/25 text-amber-400 text-[10px] font-bold hover:bg-amber-500/25 transition-all cursor-pointer"
                    >
                      <HandMetal size={12} /> Lower Hand
                    </button>
                  )}
                  <button
                    onClick={() => { kickParticipant(p.id); setExpandedId(null); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/15 border border-red-500/25 text-red-500 text-[10px] font-bold hover:bg-red-500/25 transition-all cursor-pointer"
                  >
                    <UserX size={12} /> Remove
                  </button>
                </motion.div>
              )}
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};

export default ParticipantsPanel;
