import React, { useState, useEffect } from 'react';
import { 
  Radio, Users, ArrowRight, Plus, Calendar, Clock, Video, Layout, Share2, Upload, Info
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn, executeWithAutoRefresh } from '../../utils';
import { Card, Button } from '../../components/ui';
import { useAuthStore } from '../../store/authStore';
import { liveService } from '../../lib/services/live';
import type { LiveSession } from '../../lib/services/live';
import { Toast } from '../../components/ui/Toast';
import { PageHeader } from '../../components/shared';
import ShareMeetingModal from '../../components/live/ShareMeetingModal';
import { nexus } from '../../lib/nexus';

const LiveStudio: React.FC = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  
  const [scheduledSessions, setScheduledSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'info'} | null>(null);
  
  // Share States
  const [shareMeeting, setShareMeeting] = useState<LiveSession | null>(null);
  
  // Form States
  const [scheduleForm, setScheduleForm] = useState({ 
    title: '', 
    description: '',
    time: '',
    type: 'instant' as 'instant' | 'scheduled' | 'recurring',
    recurring: 'none' as 'none' | 'daily' | 'weekly',
    imageUrl: ''
  });
  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    setToast({ message: 'Processing thumbnail...', type: 'info' });
    
    try {
      // Compress image to reduce file size and upload time
      const compressedFile = await new Promise<File>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
          const img = new Image();
          img.src = event.target?.result as string;
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 800;
            const MAX_HEIGHT = 450;
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > MAX_WIDTH) {
                height *= MAX_WIDTH / width;
                width = MAX_WIDTH;
              }
            } else {
              if (height > MAX_HEIGHT) {
                width *= MAX_HEIGHT / height;
                height = MAX_HEIGHT;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);

            canvas.toBlob((blob) => {
              if (blob) {
                const newFile = new File([blob], file.name, {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                });
                resolve(newFile);
              } else {
                reject(new Error('Canvas to Blob failed'));
              }
            }, 'image/jpeg', 0.8);
          };
          img.onerror = (error) => reject(error);
        };
        reader.onerror = (error) => reject(error);
      });

      setToast({ message: 'Uploading thumbnail...', type: 'info' });
      const { data, error: uploadError } = await executeWithAutoRefresh(() =>
        nexus.storage
          .from('session-thumbnails')
          .uploadAuto(compressedFile)
      );

      if (uploadError) throw uploadError;

      setScheduleForm(prev => ({ ...prev, imageUrl: data.url }));
      setToast({ message: 'Thumbnail uploaded successfully!', type: 'success' });
    } catch (err: any) {
      console.error('Upload error:', err);
      setToast({ message: `Upload failed: ${err.message}`, type: 'info' });
    } finally {
      setIsUploading(false);
    }
  };

  const fetchSessions = async () => {
    try {
      const data = await liveService.getCourseSessions('global');
      if (data) {
        setScheduledSessions(data.filter(s => s.status === 'scheduled'));
      }
    } catch (err) {
      console.error('Failed to fetch live sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleScheduleSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!scheduleForm.title.trim()) {
      setToast({ message: 'Please enter a session title', type: 'info' });
      return;
    }
    if (!scheduleForm.imageUrl) {
      setToast({ message: 'Please upload a thumbnail image first', type: 'info' });
      return;
    }
    if (scheduleForm.type !== 'instant' && !scheduleForm.time) {
      setToast({ message: 'Please select a broadcast start time', type: 'info' });
      return;
    }

    try {
      setToast({ 
        message: scheduleForm.type === 'instant' ? 'Initializing broadcast...' : 'Scheduling broadcast...', 
        type: 'info' 
      });
      
      const scheduledTime = scheduleForm.type === 'instant' 
        ? new Date().toISOString() 
        : new Date(scheduleForm.time).toISOString();
      
      const session = await liveService.createSession(
        'global',
        user.id,
        scheduleForm.title.trim(),
        scheduledTime,
        scheduleForm.type === 'recurring' ? scheduleForm.recurring : 'none',
        scheduleForm.imageUrl,
        scheduleForm.description.trim()
      );

      if (scheduleForm.type === 'instant') {
        await liveService.updateStatus(session.id, 'live');
        if (window.innerWidth >= 768) {
          window.open(`/live/${session.dyte_meeting_id}`, '_blank');
        } else {
          navigate(`/live/${session.dyte_meeting_id}`);
        }
      } else {
        setToast({ message: 'Session Scheduled Successfully!', type: 'success' });
        setScheduleForm({
          title: '',
          description: '',
          time: '',
          type: 'instant',
          recurring: 'none',
          imageUrl: ''
        });
        fetchSessions();
        setShareMeeting(session);
      }
    } catch (err: any) {
      console.error('[LiveStudio] Scheduling failed:', err);
      setToast({ message: `Failed to create session: ${err.message || err.toString()}`, type: 'info' });
    }
  };

  const handleLaunchScheduled = async (session: LiveSession) => {
    try {
      setToast({ message: 'Launching scheduled session...', type: 'info' });
      await liveService.updateStatus(session.id, 'live');
      if (window.innerWidth >= 768) {
        window.open(`/live/${session.dyte_meeting_id}`, '_blank');
      } else {
        navigate(`/live/${session.dyte_meeting_id}`);
      }
    } catch (err: any) {
      setToast({ message: `Launch failed: ${err.message}`, type: 'info' });
    }
  };

  return (
    <div className="w-full space-y-12 animate-in fade-in duration-700 pb-20 font-sans">
      {/* Premium Studio Header */}
      <PageHeader 
        title={
          <>Live <span className="text-emerald-500 italic">Studio</span></>
        }
        description="Connect with your audience in real-time. High-fidelity video, interactive chat, and crystal clear screen sharing."
        tag="Live Social Transmission"
        icon={Radio}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
         {/* Studio Broadcasting Desk Form */}
         <Card className="lg:col-span-7 bg-white p-5 md:p-8 lg:p-10 rounded-[3rem] border border-slate-200 text-slate-900 shadow-xl relative overflow-hidden">
            
            <div className="space-y-2 border-b border-slate-100 pb-6 mb-6 text-left">
              <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                <Video className="text-emerald-600 animate-pulse" /> Online Setup
              </h2>
              <p className="text-slate-500 text-xs">
                Provide meeting details and upload a cover thumbnail to setup your broadcast room.
              </p>
            </div>

            <form onSubmit={handleScheduleSession} className="space-y-6 text-left">
              <div className="space-y-2">
                <label className="text-[10px] font-black tracking-widest text-emerald-600 ml-1 uppercase">Meeting Title</label>
                <input 
                  type="text" 
                  placeholder="e.g. Advanced Agentic Design Masterclass"
                  value={scheduleForm.title}
                  onChange={(e) => setScheduleForm({...scheduleForm, title: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-semibold"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black tracking-widest text-emerald-600 ml-1 uppercase">Meeting Details / Description</label>
                <textarea 
                  placeholder="What will this broadcast cover?"
                  value={scheduleForm.description}
                  onChange={(e) => setScheduleForm({...scheduleForm, description: e.target.value})}
                  rows={3}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-semibold resize-none"
                />
              </div>

              {/* Cover Image Selector & Upload */}
              <div className="space-y-3">
                <label className="text-[10px] font-black tracking-widest text-emerald-600 ml-1 uppercase block">Upload Meeting Cover Thumbnail</label>
                
                {scheduleForm.imageUrl ? (
                  <div className="w-full max-w-sm aspect-video rounded-2xl overflow-hidden border border-slate-200 relative shadow-inner bg-slate-50">
                     <img src={scheduleForm.imageUrl} className="w-full h-full object-cover" alt="Custom Upload" />
                     <label className="absolute inset-0 bg-black/30 flex flex-col items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer">
                        <span className="text-white text-xs font-bold bg-black/70 px-3 py-1.5 rounded-full mb-2">Custom Thumbnail Uploaded</span>
                        <span className="text-white text-xs font-bold bg-black/70 px-3 py-1.5 rounded-full flex items-center gap-2"><Upload size={14}/> {isUploading ? 'Uploading...' : 'Change Image'}</span>
                        <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
                     </label>
                  </div>
                ) : (
                  <label className="w-full max-w-sm aspect-video rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-3 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-500 p-6 transition-colors cursor-pointer group">
                    <Upload size={32} className={cn("text-slate-350 group-hover:text-emerald-500 transition-colors", isUploading && "animate-bounce")} />
                    <div className="text-center">
                      <p className="text-xs font-black uppercase tracking-wider text-slate-500 group-hover:text-emerald-600 transition-colors">{isUploading ? 'Uploading...' : 'Click to Upload Thumbnail'}</p>
                      <p className="text-[10px] font-semibold text-slate-400 mt-1">Browse your files to attach a cover image</p>
                    </div>
                    <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
                  </label>
                )}
              </div>

              <div className="space-y-6 pt-4 border-t border-slate-100 animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="space-y-2">
                  <label className="text-[10px] font-black tracking-widest text-emerald-600 ml-1 uppercase">Scheduling Option</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {(['instant', 'scheduled', 'recurring'] as const).map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setScheduleForm({...scheduleForm, type})}
                          className={cn(
                            "py-3.5 rounded-xl font-black text-[10px] capitalize tracking-wider transition-all border cursor-pointer",
                            scheduleForm.type === type 
                              ? "bg-emerald-500 border-transparent text-white shadow-lg shadow-emerald-500/25" 
                              : "bg-slate-50 border-slate-200 text-slate-650 hover:bg-slate-100 hover:text-slate-800"
                          )}
                        >
                          {type === 'instant' ? 'Go Live' : type}
                        </button>
                      ))}
                    </div>
                  </div>

                  {scheduleForm.type === 'recurring' && (
                    <div className="space-y-2">
                      <label className="text-[10px] font-black tracking-widest text-emerald-600 ml-1 uppercase">Recurrence Interval</label>
                      <select
                        value={scheduleForm.recurring}
                        onChange={(e: any) => setScheduleForm({...scheduleForm, recurring: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-semibold cursor-pointer"
                      >
                        <option value="none">Select frequency...</option>
                        <option value="daily">Daily Broadcast</option>
                        <option value="weekly">Weekly Broadcast</option>
                      </select>
                    </div>
                  )}

                  {scheduleForm.type !== 'instant' && (
                    <div className="space-y-2">
                      <label className="text-[10px] font-black tracking-widest text-emerald-600 ml-1 uppercase">Broadcast Start Time</label>
                      <input 
                        type="datetime-local" 
                        value={scheduleForm.time}
                        onChange={(e) => setScheduleForm({...scheduleForm, time: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-semibold cursor-pointer"
                      />
                    </div>
                  )}

                  <div className="pt-4">
                    <Button 
                      type="submit"
                      disabled={isUploading}
                      className="w-full h-14 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-sm uppercase tracking-widest rounded-2xl shadow-xl shadow-emerald-500/10 border-none transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {scheduleForm.type === 'instant' ? (
                        <>
                          <Radio size={16} className="animate-pulse" /> Launch live session
                        </>
                      ) : (
                        <>
                          <Calendar size={16} /> Schedule Broadcast
                        </>
                      )}
                    </Button>
                  </div>
                </div>
            </form>
         </Card>

         {/* Scheduled Nodes Management */}
          <Card className="lg:col-span-5 p-5 md:p-8 lg:p-10 rounded-[3rem] border border-slate-200 shadow-xl space-y-6 bg-white text-slate-900">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2 text-left">Active Transmission Queue</h3>
            {loading ? (
              <div className="text-slate-400 font-bold text-xs uppercase tracking-widest py-8">Loading queue...</div>
            ) : scheduledSessions.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-xs font-bold border border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-2">
                <Info size={24} className="text-slate-350" />
                <span>No transmissions scheduled.</span>
              </div>
            ) : (
              <div className="space-y-4 max-h-[580px] overflow-y-auto pr-1">
                {scheduledSessions.map((session) => (
                  <div 
                    key={session.id} 
                    className="flex flex-col gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-slate-100/50 transition-all"
                  >
                     <div className="flex gap-4 items-start text-left">
                       <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col items-center justify-center font-black text-emerald-600 leading-none shrink-0">
                          <Calendar size={18} />
                       </div>
                       <div className="flex-1 min-w-0">
                          <p className="text-sm font-black text-slate-800 truncate">{session.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                             <Clock size={10} className="text-slate-400" />
                             <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                               {new Date(session.scheduled_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                             </span>
                          </div>
                          {session.recurring && session.recurring !== 'none' && (
                            <span className="inline-block mt-2 px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 text-[8px] font-black uppercase">
                              {session.recurring}
                            </span>
                          )}
                       </div>
                     </div>
                     <div className="flex gap-2">
                       <Button 
                         onClick={() => setShareMeeting(session)}
                         variant="outline" 
                         className="flex-1 h-9 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 border border-slate-200 hover:bg-slate-150 transition-colors cursor-pointer"
                       >
                         <Share2 size={10} /> Share
                       </Button>
                       <Button 
                         onClick={() => handleLaunchScheduled(session)}
                         className="flex-1 h-9 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-[9px] uppercase tracking-wider border-none shadow-md cursor-pointer"
                       >
                         Go Live &rarr;
                       </Button>
                     </div>
                  </div>
                ))}
              </div>
            )}
         </Card>
      </div>
      
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Share Modal */}
      {shareMeeting && (
        <ShareMeetingModal
          isOpen={!!shareMeeting}
          onClose={() => setShareMeeting(null)}
          meeting={{
            id: shareMeeting.id,
            title: shareMeeting.title,
            scheduled_at: shareMeeting.scheduled_at,
            dyte_meeting_id: shareMeeting.dyte_meeting_id,
            image_url: shareMeeting.image_url,
            recurring: shareMeeting.recurring
          }}
          hostName={user?.full_name || 'Academic Scholar'}
        />
      )}
    </div>
  );
};

export default LiveStudio;
