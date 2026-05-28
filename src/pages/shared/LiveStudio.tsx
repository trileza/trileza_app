import React, { useState, useEffect } from 'react';
import { 
  Radio, 
  Users,
  ArrowRight,
  Plus,
  Calendar,
  Clock,
  Video,
  Layout
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../utils';
import { Card, Button } from '../../components/ui';
import { useAuthStore } from '../../store/authStore';
import { liveService } from '../../lib/services/live';
import type { LiveSession } from '../../lib/services/live';
import { Toast } from '../../components/ui/Toast';
import { PageHeader } from '../../components/shared';

const LiveStudio: React.FC = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [activeSessions, setActiveSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'info'} | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({ title: '', time: '' });

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        // Fetch all active/live sessions
        // In a real app, we'd filter by 'live' status
        const { data, error } = await (liveService as any).getCourseSessions('global'); // Using a dummy global ID for lobby
        if (data) setActiveSessions(data);
      } catch (err) {
        console.error('Failed to fetch live sessions:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSessions();
  }, []);

  const handleStartSession = async () => {
    if (!user) return;
    try {
      setToast({ message: 'Initializing Elite Broadcast Node...', type: 'info' });
      const session = await liveService.createSession(
        'global', // For testing
        user.id,
        `${user.full_name}'s Masterclass`,
        new Date().toISOString()
      );
      
      // Update status to live immediately for this demo
      await liveService.updateStatus(session.id, 'live');
      
      navigate(`/live/${session.dyte_meeting_id}`);
    } catch (err: any) {
      setToast({ message: `Failed to start session: ${err.message}`, type: 'info' });
    }
  };

  const handleScheduleSession = async () => {
    if (!user || !scheduleForm.title || !scheduleForm.time) return;
    try {
      setToast({ message: 'Scheduling Transmission Node...', type: 'info' });
      await liveService.createSession(
        'global',
        user.id,
        scheduleForm.title,
        new Date(scheduleForm.time).toISOString()
      );
      setToast({ message: 'Session Scheduled Successfully!', type: 'success' });
      setShowScheduleModal(false);
      // Refresh sessions
      const { data } = await (liveService as any).getCourseSessions('global');
      if (data) setActiveSessions(data);
    } catch (err: any) {
      setToast({ message: `Scheduling Failed: ${err.message}`, type: 'info' });
    }
  };

  const handleJoinSession = (dyteMeetingId: string) => {
    navigate(`/live/${dyteMeetingId}`);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-12 animate-in fade-in duration-700 pb-20">
      {/* Premium Studio Header */}
      <PageHeader 
        title={
          <>Live <span className="text-emerald-400 italic">Studio</span></>
        }
        description="Connect with your audience in real-time. High-fidelity video, interactive chat, and crystal clear screen sharing."
        tag="Live Social Transmission"
        icon={Radio}
        rightContent={
          <div className="flex flex-col sm:flex-row gap-4">
            {user?.role === 'tutor' && (
              <Button 
                onClick={handleStartSession}
                className="h-16 px-8 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-sm uppercase tracking-widest shadow-xl shadow-emerald-500/30 transition-all flex items-center gap-3"
              >
                <Plus size={20} strokeWidth={3} /> Start Live Node
              </Button>
            )}
            <Button 
              onClick={() => {
                setScheduleForm({ title: '', time: '' });
                setShowScheduleModal(true);
              }}
              variant="outline"
              className="h-16 px-8 rounded-2xl bg-white/5 border-white/10 text-white font-black text-sm uppercase tracking-widest hover:bg-white/10 backdrop-blur-xl transition-all"
            >
              <Calendar size={20} /> Schedule Video
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Active Nodes Gallery */}
        <div className="lg:col-span-2 space-y-8">
          <div className="flex items-center justify-between border-b border-slate-100 pb-6">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse shadow-lg shadow-red-500/50" />
              <h2 className="text-xs font-black text-slate-500 uppercase tracking-[0.3em]">Active Transmissions</h2>
            </div>
            <span className="text-[10px] font-black text-slate-400 bg-slate-50 px-3 py-1 rounded-full uppercase tracking-widest">
              {activeSessions.length} Nodes Online
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {loading ? (
              [1, 2, 3, 4].map(i => (
                <Card key={i} className="h-56 animate-pulse bg-slate-100 border-none rounded-[2.5rem]" />
              ))
            ) : activeSessions.length === 0 ? (
              <div className="col-span-full py-32 text-center bg-slate-50/50 rounded-[3.5rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-6 group">
                 <div className="w-24 h-24 rounded-full bg-white flex items-center justify-center text-slate-200 shadow-xl group-hover:scale-110 transition-transform duration-500">
                    <Video size={40} />
                 </div>
                 <div className="space-y-1">
                   <p className="text-slate-400 font-black uppercase tracking-[0.3em] text-[10px]">Silence in the Ether</p>
                   <p className="text-slate-500 font-bold">No active sessions detected at this time.</p>
                 </div>
                 {user?.role === 'tutor' && (
                   <Button 
                    onClick={handleStartSession}
                    variant="outline" 
                    className="border-brand-primary text-brand-primary font-black rounded-xl px-8"
                   >
                     Be the First &rarr;
                   </Button>
                 )}
              </div>
            ) : (
              activeSessions.map((session) => (
                <Card 
                  key={session.id}
                  onClick={() => handleJoinSession(session.dyte_meeting_id)}
                  className="group p-0 overflow-hidden border-none bg-white shadow-2xl shadow-slate-200/50 rounded-[2.5rem] hover:translate-y-[-8px] transition-all duration-500 cursor-pointer"
                >
                  <div className="relative aspect-[16/10] bg-slate-950">
                    <img 
                      src={`https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=600`} 
                      className="w-full h-full object-cover opacity-60 group-hover:scale-110 transition-transform duration-1000" 
                      alt="Session cover" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />
                    <div className="absolute top-6 left-6 flex gap-2">
                       <span className="px-3 py-1 bg-red-500 text-white text-[10px] font-black uppercase tracking-widest rounded-full animate-pulse">Live</span>
                       <span className="px-3 py-1 bg-black/40 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-widest rounded-full border border-white/10">1.2k Viewers</span>
                    </div>
                  </div>
                  <div className="p-8">
                    <h3 className="text-xl font-black text-slate-900 group-hover:text-emerald-600 transition-colors line-clamp-1">{session.title}</h3>
                    <div className="flex items-center justify-between mt-6 pt-6 border-t border-slate-50">
                      <div className="flex items-center gap-3">
                         <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-black text-slate-400 text-xs uppercase">T</div>
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Host Node Activated</p>
                      </div>
                      <ArrowRight size={20} className="text-slate-300 group-hover:text-emerald-500 group-hover:translate-x-2 transition-all" />
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Studio Sidebar */}
        <div className="space-y-8">
           <Card className="bg-slate-950 p-10 rounded-[3rem] border-none text-white shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl" />
              <h3 className="text-xs font-black uppercase tracking-[0.3em] text-emerald-400 mb-8">Studio Analytics</h3>
              <div className="space-y-6">
                 <div className="flex items-center justify-between">
                    <div className="space-y-1">
                       <p className="text-2xl font-black">12.8k</p>
                       <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Viewers Today</p>
                    </div>
                    <Users size={32} className="text-slate-800 group-hover:text-emerald-500/20 transition-colors" />
                 </div>
                 <div className="flex items-center justify-between">
                    <div className="space-y-1">
                       <p className="text-2xl font-black">450</p>
                       <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Active Communities</p>
                    </div>
                    <Layout size={32} className="text-slate-800 group-hover:text-emerald-500/20 transition-colors" />
                 </div>
              </div>
           </Card>

           <Card className="p-10 rounded-[3rem] border-2 border-slate-100 shadow-xl shadow-slate-200/50 space-y-6">
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">Upcoming Sessions</h3>
              {[1, 2, 3].map(i => (
                <div key={i} className="flex gap-4 p-4 rounded-2xl bg-slate-50 hover:bg-white hover:shadow-lg transition-all cursor-pointer group border border-transparent hover:border-slate-100">
                   <div className="w-12 h-12 rounded-xl bg-white flex flex-col items-center justify-center shadow-sm font-black text-slate-900 leading-none">
                      <span className="text-lg">0{i+4}</span>
                      <span className="text-[8px] uppercase text-emerald-600">May</span>
                   </div>
                   <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-slate-800 group-hover:text-emerald-600 transition-colors truncate">System Node Architecture</p>
                      <div className="flex items-center gap-2 mt-1">
                         <Clock size={10} className="text-slate-400" />
                         <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">14:00 GMT</span>
                      </div>
                   </div>
                </div>
              ))}
              <Button variant="ghost" className="w-full text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-emerald-600">View Full Schedule &rarr;</Button>
           </Card>
        </div>
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* ── Scheduling Modal ── */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-300">
          <Card className="max-w-md w-full bg-slate-900 border border-white/10 p-10 rounded-[3rem] space-y-8 shadow-3xl">
            <div className="space-y-2">
              <h2 className="text-3xl font-black text-white tracking-tight">Schedule Node</h2>
              <p className="text-slate-400 font-medium text-sm">Prepare your future transmission for the elite network.</p>
            </div>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-emerald-400 ml-2">Session Title</label>
                <input 
                  type="text" 
                  placeholder="e.g. Advanced Agentic Design"
                  value={scheduleForm.title}
                  onChange={(e) => setScheduleForm({...scheduleForm, title: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-emerald-400 ml-2">Broadcast Time</label>
                <input 
                  type="datetime-local" 
                  value={scheduleForm.time}
                  onChange={(e) => setScheduleForm({...scheduleForm, time: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                />
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <Button 
                variant="ghost" 
                onClick={() => setShowScheduleModal(false)}
                className="flex-1 py-4 text-slate-400 hover:text-white hover:bg-white/5 rounded-2xl"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleScheduleSession}
                className="flex-1 py-4 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black rounded-2xl shadow-lg shadow-emerald-500/20"
              >
                Launch Node
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default LiveStudio;
