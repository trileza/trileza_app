/**
 * BreakoutPodsManager — Host/Teacher Breakout Rooms Controller
 * ─────────────────────────────────────────────────────────────
 * Manages breakout sessions (pods) using Cloudflare RealtimeKit's
 * native `connectedMeetings` API alongside database fallback tracking.
 * Allows the teacher to move participants between pods in real time.
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Plus, Boxes, Trash2, Megaphone, ArrowRightLeft, ArrowRight, UserPlus
} from 'lucide-react';
import { useMeetingStore } from '../../store/meetingStore';
import { liveService, type BreakoutPod } from '../../lib/services/live';

interface BreakoutPodsManagerProps {
  sessionId: string | null;
  userId: string;
  onNavigateToPod?: (roomName: string) => void;
}

const BreakoutPodsManager: React.FC<BreakoutPodsManagerProps> = ({
  sessionId,
  userId,
  onNavigateToPod,
}) => {
  const { meeting, setActivePanel, addToast } = useMeetingStore();
  const [pods, setPods] = useState<any[]>([]);
  const [parentMeeting, setParentMeeting] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [podName, setPodName] = useState('');
  const [movingParticipantId, setMovingParticipantId] = useState<string | null>(null);

  // Sync connected meetings from SDK
  const syncMeetings = async () => {
    if (!meeting?.connectedMeetings) {
      setLoading(false);
      return;
    }
    try {
      const data = await meeting.connectedMeetings.getConnectedMeetings();
      setParentMeeting(data.parentMeeting || null);
      setPods(data.meetings || []);
    } catch (err) {
      console.error('[Pods] Failed to get connected meetings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    syncMeetings();

    if (meeting?.connectedMeetings) {
      const onStateUpdate = (payload: any) => {
        setParentMeeting(payload.parentMeeting || null);
        setPods(payload.meetings || []);
      };
      meeting.connectedMeetings.on('stateUpdate', onStateUpdate);
      return () => {
        meeting.connectedMeetings.removeListener('stateUpdate', onStateUpdate);
      };
    }
  }, [meeting]);

  const handleCreate = async () => {
    if (!podName.trim()) return;
    try {
      setLoading(true);
      if (meeting?.connectedMeetings) {
        // 1. Create native RTK breakout room
        await meeting.connectedMeetings.createMeetings([{ title: podName.trim() }]);
      }
      
      // 2. Also log in DB for persistence and analytics
      if (sessionId) {
        try {
          await liveService.createBreakoutPod(sessionId, podName.trim(), userId, 10);
        } catch (dbErr) {
          console.warn('[Pods] DB logging failed, proceeding with RTK pod:', dbErr);
        }
      }

      addToast(`Pod "${podName}" created successfully`, 'success');
      setPodName('');
      setShowCreate(false);
      await syncMeetings();
    } catch (err: any) {
      addToast(`Failed to create pod: ${err.message}`, 'warning');
      setLoading(false);
    }
  };

  const handleClose = async (pod: any) => {
    try {
      setLoading(true);
      if (meeting?.connectedMeetings && pod.id) {
        // 1. Delete native RTK breakout room
        await meeting.connectedMeetings.deleteMeetings([pod.id]);
      }

      // 2. Close in DB if matching record is found
      if (sessionId) {
        try {
          const dbPods = await liveService.getBreakoutPods(sessionId);
          const match = dbPods.find((p: any) => p.pod_name === pod.title);
          if (match) {
            await liveService.closePod(match.id);
          }
        } catch (dbErr) {
          console.warn('[Pods] DB closing failed, proceeding with RTK close:', dbErr);
        }
      }

      addToast(`Pod "${pod.title}" closed`, 'info');
      await syncMeetings();
    } catch (err: any) {
      addToast(`Failed to close pod: ${err.message}`, 'warning');
      setLoading(false);
    }
  };

  const handleCloseAll = async () => {
    if (!meeting?.connectedMeetings) return;
    try {
      setLoading(true);
      const ids = pods.map(p => p.id).filter(Boolean);
      if (ids.length > 0) {
        await meeting.connectedMeetings.deleteMeetings(ids);
      }

      if (sessionId) {
        try {
          await liveService.closeAllPods(sessionId);
        } catch (dbErr) {
          console.warn('[Pods] DB close all failed:', dbErr);
        }
      }

      addToast('All breakout pods closed', 'success');
      await syncMeetings();
    } catch (err: any) {
      addToast(`Failed to close all pods: ${err.message}`, 'warning');
      setLoading(false);
    }
  };

  const handleMoveParticipant = async (participantId: string, destMeetingId: string, sourceMeetingId: string) => {
    if (!meeting?.connectedMeetings) return;
    try {
      await meeting.connectedMeetings.moveParticipants(
        sourceMeetingId,
        destMeetingId,
        [participantId]
      );
      addToast('Participant moved successfully', 'success');
      setMovingParticipantId(null);
      await syncMeetings();
    } catch (err: any) {
      addToast(`Failed to move participant: ${err.message}`, 'warning');
    }
  };

  // Find all active participants across parent and breakout rooms
  const allActiveParticipants = [
    ...(parentMeeting?.participants || []).map((p: any) => ({ ...p, meetingId: parentMeeting.id, meetingTitle: 'Main Room' })),
    ...pods.flatMap(pod => (pod.participants || []).map((p: any) => ({ ...p, meetingId: pod.id, meetingTitle: pod.title })))
  ];

  return (
    <div className="w-full h-full flex flex-col bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <Boxes size={16} className="text-emerald-400" />
          <h3 className="text-sm font-black text-slate-805 uppercase tracking-wider">Breakout Pods</h3>
          <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-[9px] font-black tracking-widest">
            {pods.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-500 hover:bg-emerald-500/25 transition-all cursor-pointer"
            title="Create Pod"
          >
            <Plus size={14} />
          </button>
          <button
            onClick={() => setActivePanel('none')}
            className="p-2 rounded-xl hover:bg-slate-800 text-slate-500 hover:text-slate-200 transition-all border-none bg-transparent cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Create Form */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-b border-slate-800 overflow-hidden text-left"
          >
            <div className="p-4 space-y-4">
              <input
                type="text"
                value={podName}
                onChange={(e) => setPodName(e.target.value)}
                placeholder="Pod name (e.g., Group A, Table 1)"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-450 focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-semibold"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCreate(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-800 transition-all border-none bg-transparent cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!podName.trim()}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-500 text-white text-xs font-black hover:bg-emerald-600 transition-all disabled:opacity-30 border-none cursor-pointer"
                >
                  Create Pod
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pods List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar text-left">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : pods.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-12">
            <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center">
              <Boxes size={24} className="text-slate-500" />
            </div>
            <p className="text-xs font-bold text-slate-400">No breakout pods</p>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              Create pods for group activities
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Parent Room / Main Room */}
            {parentMeeting && (
              <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                    <h4 className="text-xs font-black text-white">Main Room</h4>
                  </div>
                  <span className="text-[10px] font-bold text-slate-500">
                    {parentMeeting.participants?.length || 0} online
                  </span>
                </div>
                {/* List participants in main room */}
                <div className="space-y-1.5 pt-1">
                  {(parentMeeting.participants || []).map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between bg-slate-900 px-2.5 py-1.5 rounded-xl border border-slate-800 text-[11px]">
                      <span className="font-bold text-slate-200 truncate">{p.displayName}</span>
                      <button
                        onClick={() => setMovingParticipantId(movingParticipantId === p.id ? null : p.id)}
                        className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-emerald-400 transition-colors border-none bg-transparent cursor-pointer"
                        title="Move to another room"
                      >
                        <ArrowRightLeft size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Breakout Rooms */}
            {pods.map((pod) => (
              <motion.div
                key={pod.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-900 border border-slate-700 rounded-2xl p-4 space-y-3 hover:border-emerald-500/20 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
                      <Boxes size={14} className="text-emerald-400" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-805">{pod.title}</h4>
                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                        {pod.participants?.length || 0} participants
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleClose(pod)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-red-500 hover:bg-red-500/15 transition-all border-none bg-transparent cursor-pointer"
                    title="Close Pod"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>

                {/* List participants in this pod */}
                <div className="space-y-1.5">
                  {(pod.participants || []).map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between bg-slate-900 px-2.5 py-1.5 rounded-xl border border-slate-800 text-[11px]">
                      <span className="font-bold text-slate-200 truncate">{p.displayName}</span>
                      <button
                        onClick={() => setMovingParticipantId(movingParticipantId === p.id ? null : p.id)}
                        className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-emerald-400 transition-colors border-none bg-transparent cursor-pointer"
                        title="Move to another room"
                      >
                        <ArrowRightLeft size={12} />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Join button for teachers if they want to enter manually */}
                {onNavigateToPod && (
                  <button
                    onClick={() => onNavigateToPod(pod.title)}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-500 text-[10px] font-bold hover:bg-emerald-500/25 transition-all cursor-pointer"
                  >
                    <ArrowRight size={12} /> Join Pod
                  </button>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Move Participant Modal / Panel */}
      <AnimatePresence>
        {movingParticipantId && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="absolute inset-x-0 bottom-0 bg-slate-900 border-t border-slate-700 rounded-t-3xl shadow-2xl p-5 z-50 text-left"
          >
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-200">Move Participant</h4>
              <button
                onClick={() => setMovingParticipantId(null)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-200 transition-colors border-none bg-transparent cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            {/* Target Rooms */}
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {/* Find current location of participant */}
              {(() => {
                const targetUser = allActiveParticipants.find(p => p.id === movingParticipantId);
                if (!targetUser) return null;

                const rooms = [
                  { id: parentMeeting?.id, title: 'Main Room' },
                  ...pods.map(p => ({ id: p.id, title: p.title }))
                ].filter(r => r.id !== targetUser.meetingId && r.id);

                return (
                  <>
                    <p className="text-xs font-bold text-slate-400 mb-3">
                      Move <span className="text-white font-extrabold">{targetUser.displayName}</span> from <span className="text-white font-bold">{targetUser.meetingTitle}</span> to:
                    </p>
                    {rooms.map(room => (
                      <button
                        key={room.id}
                        onClick={() => handleMoveParticipant(targetUser.id!, room.id!, targetUser.meetingId!)}
                        className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-slate-900 hover:bg-emerald-500/15 border border-slate-700 hover:border-emerald-400 hover:text-emerald-300 text-left text-xs font-black uppercase tracking-wider text-slate-200 transition-all cursor-pointer"
                      >
                        <span>{room.title}</span>
                        <UserPlus size={14} />
                      </button>
                    ))}
                  </>
                );
              })()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer Actions */}
      {pods.length > 0 && (
        <div className="px-4 pb-4 pt-2 border-t border-slate-800 shrink-0">
          <button
            onClick={handleCloseAll}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500/15 border border-red-500/25 text-red-500 text-xs font-bold hover:bg-red-500/25 transition-all cursor-pointer"
          >
            <Megaphone size={14} /> Close All Breakouts
          </button>
        </div>
      )}
    </div>
  );
};

export default BreakoutPodsManager;
