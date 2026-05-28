import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, Button } from '../../components/ui';
import { 
  Users, MessageSquare, ShieldAlert, Search, CheckCircle2,
  Heart, Share2, TrendingUp, Award, MoreVertical, Send,
  Image as ImageIcon, Link as LinkIcon, Radio, Video,
  Mic, Hand, Pin, FileText, Settings, UserMinus, ShieldBan,
  Lock, MicOff, ArrowLeft, Briefcase, MapPin, Building2, ExternalLink,
  PlusCircle, X, Sparkles, Check, MonitorUp, Volume2,
  Maximize2, Minimize2, Calendar, Bell, BellOff, Link
} from 'lucide-react';
import { cn } from '../../utils';
import { Toast } from '../../components/ui/Toast';
import { PageHeader } from '../../components/shared';
import { useAuthStore } from '../../store/authStore';

const DUMMY_MEMBERS = [
  { id: 1, name: 'Alice Smith', role: 'Student', points: 1250, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alice', bio: 'Frontend enthusiast mastering React and Next.js.' },
  { id: 2, name: 'Dr. John Doe', role: 'Tutor', points: 4200, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=John', bio: 'Software Architect with 10 years of experience. Always here to help!' },
  { id: 3, name: 'Sarah Jenkins', role: 'Student', points: 890, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah', bio: 'Data Science student exploring AI and Machine Learning.' },
  { id: 4, name: 'Michael Chen', role: 'Student', points: 540, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Michael', bio: 'Backend developer working with Node and Go.' },
];

const DUMMY_POSTS = [
  { 
    id: 1, user: DUMMY_MEMBERS[1], time: '2 hours ago', content: 'Just published a new guide on advanced state management in React! Let me know if you have any questions.', likes: 45, 
    replies: [
      { id: 1, user: DUMMY_MEMBERS[0], text: 'This is amazing, exactly what I was looking for! Thanks Doc!', time: '1 hr ago' }
    ]
  },
  { 
    id: 2, user: DUMMY_MEMBERS[2], time: '4 hours ago', content: 'Attended Dr. Doe\'s Live Studio today! The insight into architectural patterns was mind-blowing. Here is a snap from the whiteboard session 📸', likes: 124, 
    imageUrl: 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&w=600&q=80',
    replies: []
  },
  { 
    id: 3, user: { name: 'Trileza Bootcamps', role: 'Sponsored Ad', avatar: 'https://api.dicebear.com/7.x/shapes/svg?seed=brand' }, time: 'Promoted', content: 'Looking to transition into tech? Our new immersive engineering bootcamp starts next month. Master Fullstack TS with Agentic AI pipelines. Apply today and get a 20% early bird tuition reduction!', likes: 532, 
    isAd: true,
    imageUrl: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=600&q=80',
    replies: []
  }
];

const DUMMY_PODS = [
  { id: 1, name: 'UI/UX Design Mastermind', members: 42, activity: 'Live Now', creatorType: 'tutor', restricted: true, creatorId: 'mentor-doe', creatorName: 'Dr. Emily Doe', image: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=400&h=300&fit=crop', description: 'One-off live class introducing premium layout spacing to promote our upcoming cohort!' },
  { id: 2, name: 'React Development Squad', members: 128, activity: 'Very High', creatorType: 'student', restricted: true, creatorId: 'student-alice', creatorName: 'Alice Smith', image: 'https://images.unsplash.com/photo-1517245385169-d238b036de88?w=400&h=300&fit=crop', description: 'Co-learning and sharing peer portfolios. Live reviewing state hooks!' },
  { id: 3, name: 'Data Structures Algo', members: 85, activity: 'Medium', creatorType: 'tutor', restricted: false, creatorId: 'mentor-john', creatorName: 'Dr. John Doe', image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400&h=300&fit=crop', description: 'Reviewing binary search tree loops for the upcoming systems engineering audit.' },
  { id: 4, name: 'Cyber Security Operations & Audits', members: 54, activity: 'Scheduled', scheduledAt: 'June 4th @ 2:00 PM', creatorType: 'tutor', restricted: true, creatorId: 'mentor-john', creatorName: 'Dr. John Doe', image: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=400&h=300&fit=crop', description: 'Interactive network penetration simulation showcasing premium firewalls and payload analysis.' }
];

const DUMMY_JOBS = [
  { id: 1, title: 'Senior Frontend Engineer', company: 'Trileza Systems', location: 'Remote', type: 'Full-time', salary: '$120k - $150k', logo: 'https://api.dicebear.com/7.x/identicon/svg?seed=trileza', match: '98%' },
  { id: 2, title: 'UX/UI Designer Pipeline', company: 'CreativeTech', location: 'London, UK', type: 'Contract', salary: '$60/hr', logo: 'https://api.dicebear.com/7.x/identicon/svg?seed=creative', match: '85%' },
  { id: 3, title: 'Backend Node.js Developer', company: 'StartupInc HQ', location: 'Hybrid • New York', type: 'Full-time', salary: '$90k - $120k', logo: 'https://api.dicebear.com/7.x/identicon/svg?seed=startup', match: '72%' },
];

const StudyPodWorkspace = ({ pod, onBack, showFeedback, user, requests, setRequests }: any) => {
  const [activeTab, setActiveTab] = useState<'live' | 'chat' | 'resources'>('live');
  const [micMuted, setMicMuted] = useState(false);
  const [videoActive, setVideoActive] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [customMessages, setCustomMessages] = useState<any[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const stageRef = React.useRef<HTMLDivElement>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const mockResources = [
    { id: 1, name: 'Full-Stack AI Architecture Blueprint V2', details: 'Syllabus PDF • 8.5MB • Pinned by Host', url: 'https://trileza.app/vault/materials/ai-blueprint.pdf' },
    { id: 2, name: 'React State Management Guide & Slides', details: 'Keynote Presentation • 14.2MB • Pinned by Host', url: 'https://trileza.app/vault/materials/react-slides.pdf' },
    { id: 3, name: 'Immersive Tech Careers Roadmap 2026', details: 'Promotional Catalog • 4.1MB • Pinned by Host', url: 'https://trileza.app/vault/materials/careers-roadmap.pdf' },
  ];

  useEffect(() => {
    let isSubscribed = true;
    let activeStream: MediaStream | null = null;

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        if (!isSubscribed) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        activeStream = stream;
        setLocalStream(stream);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Failed to access camera:", err);
        if (isSubscribed) {
          showFeedback("Camera access denied or unavailable", "info");
          setVideoActive(false);
        }
      }
    };

    if (videoActive && activeTab === 'live') {
      startCamera();
    } else {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        setLocalStream(null);
      }
    }

    return () => {
      isSubscribed = false;
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [videoActive, activeTab]);

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      if (stageRef.current?.requestFullscreen) {
        stageRef.current.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
    setIsFullscreen(!isFullscreen);
  };

  const handleDownloadResource = (resource: any) => {
    setDownloadingId(resource.id);
    showFeedback(`Starting download: ${resource.name}...`, 'info');
    setTimeout(() => {
      setDownloadingId(null);
      showFeedback(`Successfully downloaded: ${resource.name}`, 'success');
    }, 2000);
  };

  const handleShareResource = (resource: any) => {
    navigator.clipboard.writeText(resource.url);
    showFeedback('Resource link copied to clipboard!', 'success');

    const newMsg = {
      id: Date.now(),
      sender: user?.full_name || 'You',
      text: `📢 Shared Class Material: "${resource.name}"! Access here: ${resource.url}`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isHost: isHost,
      isResourceShare: true
    };
    setCustomMessages(prev => [...prev, newMsg]);
  };

  const isHost = user?.id === pod.creatorId;

  // Filter requests for the current pod
  const podRequests = requests.filter((r: any) => r.podId === pod.id && r.status === 'pending');

  const handleAcceptRequest = (requestId: number) => {
    const updated = requests.map((r: any) => r.id === requestId ? { ...r, status: 'approved' } : r);
    setRequests(updated);
    localStorage.setItem('trileza_pod_requests', JSON.stringify(updated));
    showFeedback('Join request approved!');
  };

  const handleDeclineRequest = (requestId: number) => {
    const updated = requests.filter((r: any) => r.id !== requestId);
    setRequests(updated);
    localStorage.setItem('trileza_pod_requests', JSON.stringify(updated));
    showFeedback('Join request declined.');
  };

  const handleSendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;
    const newMsg = {
      id: Date.now(),
      sender: user?.full_name || 'You',
      text: chatMessage,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isHost: isHost
    };
    setCustomMessages(prev => [...prev, newMsg]);
    setChatMessage('');
    showFeedback('Message broadcasted via Live Classroom Chat!');
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-right duration-500 pb-24 lg:pb-0 font-sans">
      
      {/* Workspace Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-md border border-slate-100 dark:border-slate-850 gap-4">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-3 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 rounded-2xl transition-colors shrink-0 text-slate-600 dark:text-slate-300">
            <ArrowLeft size={18} />
          </button>
          <img src={pod.image} alt={pod.name} className="w-12 h-12 rounded-2xl object-cover shrink-0" />
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              {pod.name}
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[8px] font-black uppercase tracking-wider">
                Live Pod Class
              </span>
            </h2>
            <div className="flex items-center gap-3 text-xs font-bold text-slate-550 dark:text-slate-400 mt-1 uppercase tracking-wider">
              <span className="text-red-500 flex items-center gap-1">
                <Radio size={12} className="animate-pulse" /> Live Now
              </span>
              <span>•</span>
              <span className="flex items-center gap-1"><Users size={12} /> {pod.members + (isHost ? 0 : 1)} Present</span>
              <span>•</span>
              <span className="text-slate-400">Starter: {pod.creatorName}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200/40">
            Status: <strong className="text-emerald-500 font-extrabold uppercase">{isHost ? 'Host' : 'Approved Mentee'}</strong>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Left Area (3 columns): Live Video Stage & Tabs */}
        <div className="lg:col-span-3 space-y-4">
          
          <div className="flex gap-2 bg-slate-100/50 dark:bg-slate-900/50 p-1 rounded-2xl">
            {(['live', 'chat', 'resources'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "flex-1 py-3 rounded-xl font-black uppercase text-[10px] tracking-wider transition-all",
                  activeTab === tab ? "bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-md border-none" : "text-slate-500 hover:text-slate-800"
                )}
              >
                {tab === 'live' && '🎥 Live Video Stage'}
                {tab === 'chat' && '💬 Live Classroom Chat'}
                {tab === 'resources' && '📂 Class Materials'}
              </button>
            ))}
          </div>

          <Card className="min-h-[520px] border-none shadow-xl rounded-[2.5rem] p-0 overflow-hidden flex flex-col bg-slate-950">
            
            {/* LIVE VIDEO STAGE */}
            {activeTab === 'live' && (
              <div 
                ref={stageRef} 
                id="pod-video-stage" 
                className={cn(
                  "flex-1 flex flex-col bg-slate-950 relative p-6 transition-all duration-300", 
                  isFullscreen && "fixed inset-0 z-50 p-8 w-screen h-screen"
                )}
              >
                
                {/* Visual Glassmorphic AI Recording HUD */}
                <div className="absolute top-6 left-6 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[9px] font-black uppercase tracking-widest px-3.5 py-1.5 rounded-full z-20 flex items-center gap-1.5 backdrop-blur-md">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" /> AI Classroom Recording Active
                </div>

                {/* Live Split Stream Grid */}
                <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 items-center justify-center p-2 mb-20 min-h-[340px]">
                  
                  {/* Primary Video Feed: Starter/Tutor Screen Share (8 columns) */}
                  <div className="md:col-span-8 h-full bg-slate-900 rounded-[2rem] border border-slate-800 relative group overflow-hidden shadow-2xl flex flex-col justify-between p-4">
                    <div className="absolute inset-0 bg-slate-950/20 z-10 pointer-events-none" />
                    
                    {isScreenSharing ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-indigo-950/30 border-2 border-indigo-500/30 rounded-[2rem] z-10 p-6 animate-pulse">
                        <MonitorUp size={64} className="text-indigo-400 mb-3" />
                        <h4 className="font-extrabold text-white text-sm uppercase tracking-wider">Screen Broadcast in progress</h4>
                        <p className="text-slate-400 text-xs mt-1">Broadcasting your workspace directly to the peer pipeline.</p>
                      </div>
                    ) : (
                      <img 
                        src="https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&w=1200&q=80" 
                        alt="Whiteboard Screen share" 
                        className="absolute inset-0 w-full h-full object-cover rounded-[2rem] opacity-75 filter contrast-125 saturate-110" 
                      />
                    )}

                    <div className="relative z-15 flex justify-between items-start w-full">
                      <span className="px-2.5 py-1 rounded-xl bg-slate-900/80 backdrop-blur-md border border-slate-800 text-slate-300 text-[8px] font-black uppercase tracking-wider flex items-center gap-1.5">
                        <MonitorUp size={10} className="text-indigo-400" /> screen share • active
                      </span>
                    </div>

                    <div className="relative z-15 flex justify-between items-end w-full">
                      <div className="px-3 py-1.5 rounded-xl bg-slate-950/85 backdrop-blur-md border border-slate-800 text-left">
                        <p className="text-[10px] font-bold text-slate-400">Class Focus</p>
                        <h5 className="text-xs font-black text-white">{pod.name}</h5>
                      </div>
                    </div>
                  </div>

                  {/* Secondary Video Feed: Active Speakers / Tutor Camera (4 columns) */}
                  <div className="md:col-span-4 grid grid-rows-2 gap-4 h-full">
                    {/* Host Camera Stream */}
                    <div className="bg-slate-900 rounded-[2rem] border border-slate-800 relative overflow-hidden flex flex-col justify-between p-4 group shadow-xl">
                      <img src="https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=300&q=80" className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform" />
                      <div className="absolute top-4 right-4 bg-slate-950/80 p-1.5 rounded-full border border-slate-800 flex items-center justify-center text-emerald-400 animate-pulse">
                        <Volume2 size={12} />
                      </div>
                      <div className="relative z-10 mt-auto">
                        <span className="px-2 py-1 rounded-lg bg-emerald-600 text-white text-[8px] font-black uppercase tracking-widest">
                          Host • Speaking
                        </span>
                        <p className="text-white font-extrabold text-xs mt-1.5">{pod.creatorName}</p>
                      </div>
                    </div>

                    {/* Student/Viewer Stream */}
                    <div className="bg-slate-900 rounded-[2rem] border border-slate-800 relative overflow-hidden flex flex-col justify-between p-4 group shadow-xl">
                      {videoActive ? (
                        <video 
                          ref={videoRef}
                          autoPlay
                          playsInline
                          muted
                          className="absolute inset-0 w-full h-full object-cover scale-x-[-1] opacity-90 bg-slate-950"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-slate-650 bg-slate-900">
                          <Users size={40} />
                        </div>
                      )}
                      <div className="absolute top-4 right-4 flex gap-1">
                        {isHandRaised && (
                          <div className="bg-amber-500 text-white p-1.5 rounded-full shadow-lg border border-amber-400">
                            <Hand size={12} />
                          </div>
                        )}
                        {micMuted && (
                          <div className="bg-red-500/20 text-red-400 p-1.5 rounded-full border border-red-500/30">
                            <MicOff size={12} />
                          </div>
                        )}
                      </div>
                      <div className="relative z-10 mt-auto">
                        <span className="px-2 py-1 rounded-lg bg-slate-950/80 backdrop-blur-md text-slate-350 text-[8px] font-black uppercase tracking-widest border border-slate-800">
                          {isHost ? 'Starter' : 'You (Mentee)'}
                        </span>
                        <p className="text-white font-extrabold text-xs mt-1.5">{user?.full_name || 'Scholar'}</p>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Control Bar */}
                <div className="absolute bottom-6 left-6 right-6 bg-slate-900/60 dark:bg-slate-900/70 backdrop-blur-xl border border-white/10 p-3 rounded-2xl flex items-center justify-between gap-4 z-20 shadow-2xl">
                  
                  {/* Left: AV Controls */}
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setMicMuted(!micMuted)}
                      className={cn(
                        "p-3 rounded-xl transition-all border shadow-md active:scale-95",
                        micMuted 
                          ? "bg-red-600 border-red-500 text-white hover:bg-red-700" 
                          : "bg-slate-800 hover:bg-slate-700 border-slate-700 text-white"
                      )}
                      title={micMuted ? 'Unmute Audio' : 'Mute Audio'}
                    >
                      {micMuted ? <MicOff size={16} /> : <Mic size={16} />}
                    </button>
                    
                    <button 
                      onClick={() => setVideoActive(!videoActive)}
                      className={cn(
                        "p-3 rounded-xl transition-all border shadow-md active:scale-95",
                        !videoActive 
                          ? "bg-red-600 border-red-500 text-white hover:bg-red-700" 
                          : "bg-slate-800 hover:bg-slate-700 border-slate-700 text-white"
                      )}
                      title={videoActive ? 'Stop Video' : 'Start Video'}
                    >
                      <Video size={16} className={!videoActive ? 'opacity-50' : ''} />
                    </button>
                  </div>

                  {/* Center: Live Sharing */}
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setIsHandRaised(!isHandRaised)}
                      className={cn(
                        "p-3 rounded-xl transition-all border shadow-md active:scale-95 flex items-center gap-1.5 text-xs font-black uppercase tracking-wider px-4",
                        isHandRaised 
                          ? "bg-amber-500 border-amber-400 text-white" 
                          : "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300"
                      )}
                    >
                      <Hand size={14} /> {isHandRaised ? 'Hand Raised' : 'Raise Hand'}
                    </button>

                    <button 
                      onClick={() => {
                        setIsScreenSharing(!isScreenSharing);
                        showFeedback(isScreenSharing ? 'Screen share paused' : 'Screen share active');
                      }}
                      className={cn(
                        "p-3 rounded-xl transition-all border shadow-md active:scale-95 flex items-center gap-1.5 text-xs font-black uppercase tracking-wider px-4",
                        isScreenSharing 
                          ? "bg-indigo-600 border-indigo-500 text-white" 
                          : "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300"
                      )}
                    >
                      <MonitorUp size={14} /> {isScreenSharing ? 'Stop Share' : 'Share Screen'}
                    </button>
                  </div>

                  {/* Right: Maximize & Leave */}
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={toggleFullscreen}
                      className="p-3 bg-slate-800 hover:bg-slate-700 border-slate-700 text-white rounded-xl transition-all border shadow-md active:scale-95"
                      title={isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
                    >
                      {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                    </button>
                    
                    <button 
                      onClick={() => { showFeedback('Session ended. Class recap generated.'); onBack(); }}
                      className="p-3 bg-red-650 hover:bg-red-700 text-white rounded-xl font-black uppercase text-[10px] tracking-widest px-5 active:scale-95 transition-all shadow-lg border-none"
                    >
                      Leave Class
                    </button>
                  </div>

                </div>

              </div>
            )}

            {/* LIVE CLASSROOM CHAT */}
            {activeTab === 'chat' && (
              <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 relative min-h-[500px]">
                <div className="bg-slate-50 dark:bg-slate-850 p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Live Chat Stream • Sync active</span>
                  <span className="text-[9px] bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded font-black uppercase">Realtime WebSockets</span>
                </div>
                
                <div className="flex-1 p-6 overflow-y-auto space-y-4 max-h-[380px]">
                  {/* Host Initial Message */}
                  <div className="flex items-start gap-3">
                    <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=John" className="w-8 h-8 rounded-full bg-slate-100" />
                    <div className="bg-emerald-50 dark:bg-emerald-950/40 p-4 rounded-[1.5rem] border border-emerald-100/50 dark:border-emerald-900/30 text-xs font-semibold text-slate-800 dark:text-slate-200 max-w-[80%]">
                      <span className="font-extrabold text-emerald-700 dark:text-emerald-400 block mb-1">Dr. Emily Doe (Host)</span>
                      Hello team! Welcome to this live promotional masterclass. Today we are exploring active structural frameworks to support elite portfolio growth! Let me know where you are joining from.
                    </div>
                  </div>

                  {/* Render Custom Messages */}
                  {customMessages.map(msg => (
                    <div key={msg.id} className="flex items-start gap-3 justify-end">
                      <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-[1.5rem] text-xs font-semibold text-slate-800 dark:text-slate-200 max-w-[80%] text-right">
                        <span className="font-extrabold text-slate-900 dark:text-white block mb-0.5">{msg.sender}</span>
                        {msg.text}
                      </div>
                      <img 
                        src={user?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.full_name || 'Student'}`} 
                        className="w-8 h-8 rounded-full bg-slate-100 shrink-0 object-cover" 
                      />
                    </div>
                  ))}
                </div>

                <form onSubmit={handleSendChatMessage} className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-3">
                  <input 
                    type="text" 
                    placeholder="Broadcast a question to the active speakers..." 
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    className="flex-1 bg-slate-50 dark:bg-slate-850 border-none rounded-xl py-4 px-5 outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all font-semibold text-xs text-slate-800 dark:text-white"
                  />
                  <Button 
                    type="submit"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-5 h-12 shadow-md border-none flex items-center justify-center shrink-0"
                  >
                    <Send size={14} />
                  </Button>
                </form>
              </div>
            )}

            {/* CLASS MATERIALS */}
            {activeTab === 'resources' && (
              <div className="p-8 h-full bg-white dark:bg-slate-900 space-y-6 min-h-[500px]">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <h3 className="font-black text-slate-900 dark:text-white text-base">Class Materials & Downloads</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Access promotional case studies and syllabus blueprints pinned by the host.</p>
                  </div>
                  {isHost && (
                    <Button className="bg-slate-900 hover:bg-black dark:bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase tracking-wider border-none" onClick={() => showFeedback('Upload functionality ready for cohort release!')}>
                      Upload Resource
                    </Button>
                  )}
                </div>
                <div className="space-y-3">
                  {mockResources.map(resource => (
                    <div key={resource.id} className="p-5 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between border border-emerald-100/50 dark:border-emerald-900/30 gap-4">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-emerald-250/20 text-emerald-600 dark:text-emerald-450 rounded-xl shrink-0">
                          <Pin size={18} />
                        </div>
                        <div className="text-left">
                          <h4 className="font-extrabold text-slate-900 dark:text-white text-sm">{resource.name}</h4>
                          <p className="text-[10px] font-bold text-slate-400 mt-0.5">{resource.details}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          onClick={() => handleShareResource(resource)}
                          className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[9px] font-black uppercase tracking-wider px-3 border-none flex items-center gap-1.5"
                        >
                          <Share2 size={12} /> Share
                        </Button>
                        <Button 
                          size="sm" 
                          onClick={() => handleDownloadResource(resource)}
                          disabled={downloadingId === resource.id}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-black uppercase tracking-wider px-3.5 border-none flex items-center gap-1.5 min-w-[90px] justify-center"
                        >
                          {downloadingId === resource.id ? (
                            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : 'Download'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </Card>
        </div>

        {/* Right Sidebar (1 column): Moderator Controls & Requests */}
        <div className="space-y-6">
          <Card className="border-none shadow-xl rounded-2xl p-0 overflow-hidden flex flex-col h-[520px] bg-slate-900 border border-slate-800">
            
            {/* Join Requests Moderation section for Starters */}
            {isHost && podRequests.length > 0 && (
              <div className="p-4 border-b border-slate-800 bg-slate-950 text-white">
                <h3 className="font-black flex items-center gap-2 mb-3 text-xs text-amber-400 uppercase tracking-wider">
                  <Users size={14} className="text-amber-400" /> Join Requests ({podRequests.length})
                </h3>
                <div className="space-y-2 max-h-44 overflow-y-auto">
                  {podRequests.map((req: any) => (
                    <div key={req.id} className="flex items-center justify-between bg-slate-900 p-2.5 rounded-xl border border-slate-800/80">
                      <div className="flex items-center gap-2 min-w-0">
                        <img src={req.avatar} className="w-6 h-6 rounded-full shrink-0" />
                        <span className="text-[10px] font-black text-slate-200 truncate max-w-[80px]">{req.userName}</span>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button 
                          onClick={() => handleAcceptRequest(req.id)}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white text-[9px] font-black uppercase px-2.5 py-1 rounded"
                        >
                          Accept
                        </button>
                        <button 
                          onClick={() => handleDeclineRequest(req.id)}
                          className="bg-slate-800 hover:bg-slate-700 text-slate-400 text-[9px] font-black uppercase px-2 py-1 rounded border border-slate-700/60"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isHost && (
              <div className="p-4 border-b border-slate-850 bg-slate-950 text-white">
                <h3 className="font-bold flex items-center gap-2 mb-3 text-xs uppercase tracking-wider text-slate-400">
                  <Settings size={14} className="text-indigo-400" /> Host Studio Control
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <button className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-slate-800 hover:bg-slate-750 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all" onClick={() => { setMicMuted(true); showFeedback('All student lines muted'); }}>
                    <MicOff size={12} /> Mute Room
                  </button>
                  <button className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-slate-800 hover:bg-slate-750 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all" onClick={() => showFeedback('Live sharing stage locked')}>
                    <Lock size={12} /> Lock Stage
                  </button>
                </div>
              </div>
            )}
            
            <div className="p-4 border-b border-slate-850 bg-slate-950/40">
              <h3 className="font-black text-xs uppercase tracking-wider text-slate-400">Active Audience</h3>
            </div>

            <div className="flex-1 overflow-y-auto p-2 bg-slate-950">
              <div className="p-2.5 flex items-center justify-between hover:bg-slate-900 rounded-xl transition-colors">
                <div className="flex items-center gap-3">
                  <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Host" className="w-8 h-8 rounded-full bg-slate-800" />
                  <div>
                    <h4 className="font-bold text-xs text-white flex items-center gap-1">
                      {pod.creatorName}
                      <span className="text-[7px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded ml-1 font-black uppercase">Host</span>
                    </h4>
                    <p className="text-[9px] font-bold text-slate-500">Starter</p>
                  </div>
                </div>
              </div>

              {/* Mock active listeners */}
              {DUMMY_MEMBERS.filter(m => m.name !== pod.creatorName).slice(0, 3).map((m, i) => (
                <div key={m.id} className="p-2.5 flex items-center justify-between hover:bg-slate-900 rounded-xl transition-colors group">
                  <div className="flex items-center gap-3">
                    <img src={m.avatar} alt={m.name} className="w-8 h-8 rounded-full bg-slate-850" />
                    <div>
                      <h4 className="font-bold text-xs text-slate-300">{m.name}</h4>
                      <p className="text-[9px] font-bold text-slate-550 uppercase tracking-widest">{m.role}</p>
                    </div>
                  </div>
                  {isHost && (
                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                      <button className="p-1 text-slate-450 hover:text-red-400 rounded" title="Mute"><MicOff size={12} /></button>
                      <button className="p-1 text-slate-450 hover:text-red-500 rounded" title="Kick"><UserMinus size={12} /></button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>

      </div>
    </div>
  );
};

const STUDY_POD_THUMBNAILS = [
  { id: 'uiux', name: 'UI/UX Design', url: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=400&h=300&fit=crop' },
  { id: 'react', name: 'React Development', url: 'https://images.unsplash.com/photo-1517245385169-d238b036de88?w=400&h=300&fit=crop' },
  { id: 'algo', name: 'Algorithms', url: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400&h=300&fit=crop' },
  { id: 'cyber', name: 'Cyber Security', url: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=400&h=300&fit=crop' }
];

const DIGITAL_SKILLS = [
  'React Development', 'Angular Development', 'Vue.js Development', 'Next.js Framework', 'Svelte',
  'TypeScript', 'JavaScript (ES6+)', 'HTML5 & CSS3', 'Tailwind CSS', 'Bootstrap',
  'Node.js (Express)', 'Python Programming', 'Django Framework', 'FastAPI', 'Flask',
  'Ruby on Rails', 'PHP Laravel', 'Java Spring Boot', 'Go (Golang) Microservices', 'Rust Systems Programming',
  'PostgreSQL', 'MongoDB', 'MySQL', 'Redis Caching', 'SQLite', 'GraphQL API Design', 'RESTful API Engineering',
  'UI/UX Design', 'Figma Prototyping', 'Adobe XD & Illustrator', 'Wireframing & Spacing', 'Color Theory & Hierarchy',
  'Docker Containers', 'Kubernetes Orchestration', 'AWS Cloud Architectures', 'Google Cloud Platform (GCP)', 'Microsoft Azure',
  'Git Version Control', 'CI/CD Pipelines (GitHub Actions)', 'Linux Sysops & Shell Scripting',
  'Data Science & Analytics', 'Machine Learning Algorithms', 'Deep Learning & Neural Networks', 'PyTorch & TensorFlow', 'NLP (Natural Language Processing)',
  'OpenAI API Integration', 'Agentic AI Workflows', 'Prompt Engineering', 'LangChain Framework',
  'Cyber Security Operations', 'Network Penetration Testing', 'Ethical Hacking', 'OWASP Top 10 Auditing', 'Firewall Administration',
  'Solidity Smart Contracts', 'Web3 & Blockchain Architectures', 'Cryptography',
  'Agile Scrum Methodology', 'Technical Product Management', 'DevOps Engineering', 'System Architecture Design'
];

const CommunityPortal = () => {
  const [activeTab, setActiveTab] = useState<'pods' | 'feed' | 'jobs'>('pods');
  const [activePod, setActivePod] = useState<any>(null);
  const [newPostContent, setNewPostContent] = useState('');
  const [toast, setToast] = useState<{message: string, type: 'success' | 'info'} | null>(null);
  const { user } = useAuthStore();
  
  // Launch Study Pod Form States
  const [isCreatingPod, setIsCreatingPod] = useState(false);
  const [newPodName, setNewPodName] = useState('');
  const [newPodCategory, setNewPodCategory] = useState('');
  const [showSkillSuggestions, setShowSkillSuggestions] = useState(false);
  const [newPodDescription, setNewPodDescription] = useState('');

  // Scheduling & Custom Thumbnail picker states
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [newPodImage, setNewPodImage] = useState('');

  // Social account connection & publishing modal states
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [selectedSharePod, setSelectedSharePod] = useState<any>(null);
  const [connections, setConnections] = useState<Record<string, string>>({
    linkedin: 'disconnected',
    twitter: 'disconnected',
    slack: 'disconnected'
  });
  const [publishStatus, setPublishStatus] = useState<string>('idle');

  // Reminders for Scheduled Pods
  const [reminders, setReminders] = useState<number[]>([]);

  const toggleReminder = (podId: number) => {
    if (reminders.includes(podId)) {
      setReminders(prev => prev.filter(id => id !== podId));
      showFeedback('Reminder cancelled.', 'info');
    } else {
      setReminders(prev => [...prev, podId]);
      showFeedback('🔔 Reminder successfully set! We will alert you 10 minutes before class.', 'success');
    }
  };

  const handleConnectSocial = (platform: string) => {
    setConnections(prev => ({ ...prev, [platform]: 'connecting' }));
    setTimeout(() => {
      setConnections(prev => ({ ...prev, [platform]: 'connected' }));
      showFeedback(`Connected to platform successfully!`, 'success');
    }, 1500);
  };

  const handlePublishPost = () => {
    const isAnyConnected = Object.values(connections).some(v => v === 'connected');
    if (!isAnyConnected) {
      showFeedback('Please connect at least one social media account first!', 'info');
      return;
    }

    setPublishStatus('drafting');
    setTimeout(() => {
      setPublishStatus('formatting');
      setTimeout(() => {
        setPublishStatus('publishing');
        setTimeout(() => {
          setPublishStatus('published');
          showFeedback('🎉 Post published to connected social platforms!', 'success');
          setTimeout(() => {
            setIsShareModalOpen(false);
            setPublishStatus('idle');
          }, 2000);
        }, 1500);
      }, 1200);
    }, 1000);
  };
  
  const showFeedback = (msg: string, type: 'success' | 'info' = 'success') => setToast({ message: msg, type });

  // Sync Study Pods list to LocalStorage
  const [pods, setPods] = useState<any[]>(() => {
    const stored = localStorage.getItem('trileza_study_pods');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        return DUMMY_PODS;
      }
    }
    return DUMMY_PODS;
  });

  // Sync Join Requests to LocalStorage
  const [requests, setRequests] = useState<any[]>(() => {
    const stored = localStorage.getItem('trileza_pod_requests');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        return [];
      }
    }
    // Pre-populate mock pending request to test starters dashboard moderation
    return [
      { id: 201, podId: 1, userId: 'alice-student-1', userName: 'Alice Smith', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alice', status: 'pending' },
      { id: 202, podId: 1, userId: 'sarah-student-2', userName: 'Sarah Jenkins', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah', status: 'pending' }
    ];
  });

  // Check URL triggers (?startPod=true)
  useEffect(() => {
    if (window.location.search.includes('startPod=true')) {
      setIsCreatingPod(true);
      // Clean query parameter from history
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleLaunchPodSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPodName.trim()) return;

    const newPod = {
      id: Date.now(),
      name: newPodName,
      members: 1,
      activity: isScheduled ? 'Scheduled' : 'Live Now',
      scheduledAt: isScheduled ? `${scheduledDate} @ ${scheduledTime}` : undefined,
      creatorType: user?.role === 'mentor' || user?.role === 'tutor' ? 'tutor' : 'student',
      restricted: true,
      creatorId: user?.id || 'unknown-user',
      creatorName: user?.full_name || 'Academic Scholar',
      image: newPodImage || STUDY_POD_THUMBNAILS[0].url,
      description: newPodDescription || 'Special one-off live class to review objectives and promote academic sessions!'
    };

    const updatedPods = [newPod, ...pods];
    setPods(updatedPods);
    localStorage.setItem('trileza_study_pods', JSON.stringify(updatedPods));

    setIsCreatingPod(false);
    setNewPodName('');
    setNewPodDescription('');
    setNewPodImage('');
    setNewPodCategory('');
    setIsScheduled(false);
    setScheduledDate('');
    setScheduledTime('');
    
    showFeedback(
      isScheduled 
        ? 'Live Class Pod successfully scheduled and published to community!' 
        : 'Live Study Pod successfully launched! You are the Host.', 
      'success'
    );
    
    if (isScheduled) {
      setSelectedSharePod(newPod);
      setIsShareModalOpen(true);
    } else {
      setActivePod(newPod);
    }
  };

  const handleJoinPodRequest = (pod: any) => {
    if (user?.id === pod.creatorId) {
      // Host enters directly
      setActivePod(pod);
      return;
    }

    // Check request status
    const existing = requests.find(r => r.podId === pod.id && r.userId === user?.id);
    
    if (existing?.status === 'approved') {
      setActivePod(pod);
      return;
    }

    if (existing?.status === 'pending') {
      showFeedback('Request already pending starter approval.', 'info');
      return;
    }

    // Send a new request
    const newReq = {
      id: Date.now(),
      podId: pod.id,
      userId: user?.id || 'student-viewer',
      userName: user?.full_name || 'Student Mentee',
      avatar: user?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.full_name || 'Student'}`,
      status: 'pending'
    };

    const updatedReqs = [...requests, newReq];
    setRequests(updatedReqs);
    localStorage.setItem('trileza_pod_requests', JSON.stringify(updatedReqs));
    showFeedback('Join request submitted to pod starter!', 'success');
  };

  // Helper to instantly approve yourself for demo testing
  const handleSimulateSelfApproval = (podId: number) => {
    const updated = requests.map(r => 
      (r.podId === podId && r.userId === user?.id) ? { ...r, status: 'approved' } : r
    );
    setRequests(updated);
    localStorage.setItem('trileza_pod_requests', JSON.stringify(updated));
    showFeedback('Simulated approval! Click "Enter Workspace" to join the live session.');
  };

  const totalMembers = DUMMY_MEMBERS.length * 452;

  if (activePod) {
    return (
      <div className="max-w-7xl mx-auto">
        <StudyPodWorkspace 
          pod={activePod} 
          onBack={() => setActivePod(null)} 
          showFeedback={showFeedback} 
          user={user}
          requests={requests}
          setRequests={setRequests}
        />
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 max-w-7xl mx-auto font-sans">
      
      {/* Global Header */}
      <PageHeader 
        title="Community Hub"
        description={
          <div className="flex items-center gap-2 text-emerald-300 font-extrabold uppercase tracking-widest text-xs mt-4">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            {totalMembers.toLocaleString()} Active Learners Globally
          </div>
        }
        tag="Global Network"
        icon={Users}
        rightContent={
          <Button 
            onClick={() => setIsCreatingPod(true)}
            className="bg-white hover:bg-slate-50 text-emerald-950 font-black text-xs uppercase tracking-widest py-5 px-8 rounded-2xl shadow-xl flex items-center gap-2.5 border-none transition-all active:scale-[0.98]"
          >
            <PlusCircle size={18} className="text-emerald-600" /> Start a Live Pod
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
        
        {/* Left Area (3 columns): Tabs & Contents */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* Navigation Tabs */}
          <div className="flex gap-4 border-b border-slate-200 dark:border-slate-800 overflow-x-auto no-scrollbar pb-2">
            {(['pods', 'feed', 'jobs'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-6 py-3 rounded-t-xl font-bold capitalize transition-colors whitespace-nowrap",
                  activeTab === tab 
                    ? "text-emerald-700 border-b-4 border-emerald-600 bg-emerald-50 dark:bg-slate-900/40" 
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                )}
              >
                {tab === 'pods' && '👥 Live Study Pods'}
                {tab === 'feed' && '📢 Discovery Feed'}
                {tab === 'jobs' && '💼 Job Board'}
              </button>
            ))}
          </div>
              {/* ----- STUDY PODS TAB ----- */}
          {activeTab === 'pods' && (() => {
            const livePods = pods.filter(p => p.activity !== 'Scheduled');
            const scheduledPods = pods.filter(p => p.activity === 'Scheduled');

            return (
              <div className="space-y-8 animate-in fade-in duration-500">
                
                {/* SECTION 1: LIVE NOW */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-left">
                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" /> Live Now ({livePods.length})
                    </h3>
                  </div>
                  
                  {livePods.length === 0 ? (
                    <div className="p-8 bg-slate-50 dark:bg-slate-900/40 rounded-2xl text-center border border-slate-100 dark:border-slate-850">
                      <p className="text-xs font-semibold text-slate-400">No live study sessions right now. Be the first to start a pod!</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {livePods.map((pod) => {
                        const request = requests.find(r => r.podId === pod.id && r.userId === user?.id);
                        const isCreator = user?.id === pod.creatorId;
                        const isApproved = request?.status === 'approved' || isCreator;
                        const isPending = request?.status === 'pending';

                        return (
                          <Card 
                            key={pod.id} 
                            className="p-0 overflow-hidden border border-slate-100 dark:border-slate-850 shadow-md hover:shadow-xl rounded-2xl group transition-all duration-300 relative bg-white dark:bg-slate-900/50 flex flex-col justify-between"
                          >
                            <div className="relative">
                              {pod.restricted && (
                                <div className="absolute top-4 right-4 bg-slate-950/80 backdrop-blur-md text-white text-[9px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full flex items-center gap-1 z-20 border border-slate-800">
                                  <Lock size={10} className="text-indigo-400" /> Req Required
                                </div>
                              )}
                              
                              <div className="h-36 overflow-hidden relative">
                                <div className="absolute inset-0 bg-emerald-950/30 group-hover:bg-emerald-950/15 transition-colors z-10" />
                                <img src={pod.image} alt={pod.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                              </div>
                              
                              <div className="p-6 relative text-left">
                                <div className="absolute -top-6 left-6 shadow-md flex items-center z-20 bg-white dark:bg-slate-900 p-1 rounded-xl">
                                  <div className={cn(
                                    "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5", 
                                    pod.creatorType === 'tutor' 
                                      ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400' 
                                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                                  )}>
                                    {pod.creatorType === 'tutor' ? <Award size={12}/> : <Users size={12}/>}
                                    {pod.creatorType === 'tutor' ? 'Pro Class' : 'Peer Study'}
                                  </div>
                                </div>

                                <div className="mt-4 space-y-1">
                                  <h4 className="font-black text-lg text-slate-900 dark:text-white leading-snug group-hover:text-emerald-600 transition-colors">
                                    {pod.name}
                                  </h4>
                                  <p className="text-slate-450 dark:text-slate-400 text-xs font-semibold leading-normal line-clamp-2">
                                    {pod.description}
                                  </p>
                                </div>
                                
                                <div className="flex gap-4 mt-4 bg-slate-50 dark:bg-slate-850/40 p-3 rounded-xl border border-slate-100 dark:border-slate-850">
                                  <div className="flex items-center gap-1.5 text-[10px] text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider">
                                    <Users size={12} className="text-emerald-500" /> {pod.members} Peers
                                  </div>
                                  <div className="w-px h-4 bg-slate-200 dark:bg-slate-800" />
                                  <div className="flex items-center gap-1.5 text-[9px] text-slate-600 dark:text-slate-400 font-black uppercase tracking-wider">
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> Live Now
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="px-6 pb-6 pt-0 flex gap-2 w-full">
                              <Button 
                                variant="outline"
                                onClick={() => { setSelectedSharePod(pod); setIsShareModalOpen(true); }}
                                className="rounded-xl h-11 px-4 border-slate-200 dark:border-slate-800 shrink-0 flex items-center justify-center"
                                title="Share live pod to social feeds"
                              >
                                <Share2 size={14} className="text-slate-550" />
                              </Button>
                              
                              {isApproved ? (
                                <Button 
                                  className="flex-1 rounded-xl font-black uppercase tracking-wider text-[10px] bg-slate-950 dark:bg-slate-800 text-white hover:bg-black transition-all border-none h-11" 
                                  onClick={() => setActivePod(pod)}
                                >
                                  Enter Workspace &rarr;
                                </Button>
                              ) : isPending ? (
                                <div className="flex-1 space-y-1">
                                  <div className="w-full bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/30 p-2 rounded-xl text-center">
                                    <p className="text-[9px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest flex items-center justify-center gap-1">
                                      <Lock size={10} /> Pending Approval
                                    </p>
                                  </div>
                                  <button
                                    onClick={() => handleSimulateSelfApproval(pod.id)}
                                    className="w-full py-1 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950 text-indigo-650 dark:text-indigo-400 rounded-lg text-[8px] font-black uppercase border border-dashed border-indigo-300 transition-colors"
                                  >
                                    [Simulate Approve]
                                  </button>
                                </div>
                              ) : (
                                <Button 
                                  className="flex-1 rounded-xl font-black uppercase tracking-wider text-[10px] bg-emerald-600 text-white hover:bg-emerald-700 transition-all border-none h-11" 
                                  onClick={() => handleJoinPodRequest(pod)}
                                >
                                  Request Access
                                </Button>
                              )}
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* SECTION 2: SCHEDULED WORKSHOPS */}
                <div className="space-y-4 pt-6 border-t border-slate-200/60 dark:border-slate-800/60">
                  <div className="flex items-center justify-between text-left">
                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Calendar size={16} className="text-emerald-600" /> Upcoming Scheduled Pods ({scheduledPods.length})
                    </h3>
                  </div>

                  {scheduledPods.length === 0 ? (
                    <div className="p-8 bg-slate-50 dark:bg-slate-900/40 rounded-2xl text-center border border-slate-100 dark:border-slate-850">
                      <p className="text-xs font-semibold text-slate-400">No upcoming workshops scheduled yet. Post one for future learners!</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {scheduledPods.map((pod) => {
                        const hasReminder = reminders.includes(pod.id);

                        return (
                          <Card 
                            key={pod.id} 
                            className="p-0 overflow-hidden border border-slate-100 dark:border-slate-850 shadow-md hover:shadow-xl rounded-2xl group transition-all duration-300 relative bg-white dark:bg-slate-900/50 flex flex-col justify-between"
                          >
                            <div className="relative">
                              <div className="absolute top-4 right-4 bg-emerald-950/80 backdrop-blur-md text-emerald-400 text-[9px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full flex items-center gap-1.5 z-20 border border-emerald-800">
                                <Calendar size={10} /> {pod.scheduledAt}
                              </div>
                              
                              <div className="h-36 overflow-hidden relative">
                                <div className="absolute inset-0 bg-slate-950/30 group-hover:bg-slate-950/15 transition-colors z-10" />
                                <img src={pod.image} alt={pod.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                              </div>
                              
                              <div className="p-6 relative text-left">
                                <div className="absolute -top-6 left-6 shadow-md flex items-center z-20 bg-white dark:bg-slate-900 p-1 rounded-xl">
                                  <div className={cn(
                                    "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5", 
                                    pod.creatorType === 'tutor' 
                                      ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400' 
                                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                                  )}>
                                    {pod.creatorType === 'tutor' ? <Award size={12}/> : <Users size={12}/>}
                                    {pod.creatorType === 'tutor' ? 'Syllabus Class' : 'Upcoming Review'}
                                  </div>
                                </div>

                                <div className="mt-4 space-y-1">
                                  <h4 className="font-black text-lg text-slate-900 dark:text-white leading-snug group-hover:text-emerald-600 transition-colors">
                                    {pod.name}
                                  </h4>
                                  <p className="text-slate-450 dark:text-slate-400 text-xs font-semibold leading-normal line-clamp-2">
                                    {pod.description}
                                  </p>
                                </div>
                                
                                <div className="flex gap-4 mt-4 bg-slate-50 dark:bg-slate-850/40 p-3 rounded-xl border border-slate-100 dark:border-slate-850">
                                  <div className="flex items-center gap-1.5 text-[10px] text-slate-650 dark:text-slate-400 font-bold uppercase tracking-wider">
                                    <Users size={12} className="text-emerald-500" /> {pod.members} Interested
                                  </div>
                                  <div className="w-px h-4 bg-slate-200 dark:bg-slate-800" />
                                  <div className="flex items-center gap-1.5 text-[9px] text-emerald-600 dark:text-emerald-400 font-black uppercase tracking-wider">
                                    <span>📅 Scheduled Class</span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="px-6 pb-6 pt-0 flex gap-2 w-full">
                              <Button 
                                variant="outline"
                                onClick={() => { setSelectedSharePod(pod); setIsShareModalOpen(true); }}
                                className="rounded-xl h-11 px-4 border-slate-200 dark:border-slate-800 shrink-0 flex items-center justify-center"
                                title="Share class details to social networks"
                              >
                                <Share2 size={14} className="text-slate-550" />
                              </Button>

                              <button
                                onClick={() => toggleReminder(pod.id)}
                                className={cn(
                                  "flex-1 rounded-xl h-11 text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-2 border transition-all active:scale-[0.98]",
                                  hasReminder 
                                    ? "bg-emerald-50 border-emerald-200 text-emerald-650 dark:bg-emerald-950/20 dark:border-emerald-900/30" 
                                    : "bg-slate-100 hover:bg-slate-200 border-transparent text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-750 dark:text-slate-300"
                                )}
                              >
                                {hasReminder ? (
                                  <>
                                    <BellOff size={12} /> Reminder Set
                                  </>
                                ) : (
                                  <>
                                    <Bell size={12} /> Set Reminder
                                  </>
                                )}
                              </button>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>
            );
          })()}

          {/* ----- FEED TAB ----- */}
          {activeTab === 'feed' && (
            <div className="space-y-6 animate-in fade-in duration-500">
              {/* Native Post Composer */}
              <Card className="p-6 md:p-8 border border-slate-100 dark:border-slate-850 bg-white dark:bg-slate-900/50 rounded-[2rem]">
                <div className="flex gap-4">
                  <img src={user?.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=You'} alt="You" className="w-12 h-12 rounded-full border-2 border-emerald-100 bg-slate-100 object-cover shrink-0" />
                  <div className="flex-1 space-y-4">
                    <textarea 
                      placeholder="Share an update, find a study partner, or upload a picture..."
                      value={newPostContent}
                      onChange={(e) => setNewPostContent(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-850 border-none rounded-xl p-4 text-xs font-semibold focus:ring-2 focus:ring-emerald-500/20 transition-all placeholder:text-slate-400 resize-none h-24"
                    />
                    <div className="flex justify-between items-center">
                      <div className="flex gap-2">
                        <button className="p-2 text-slate-450 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors"><ImageIcon size={18} /></button>
                        <button className="p-2 text-slate-450 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors"><Video size={18} /></button>
                      </div>
                      <Button onClick={() => { if(newPostContent) { showFeedback('Post successfully published!'); setNewPostContent(''); } }} className="rounded-full px-6 gap-2 bg-emerald-600 hover:bg-emerald-700 border-none shadow-lg text-white font-bold">
                        Post <Send size={14} />
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Feed Timeline */}
              {DUMMY_POSTS.map(post => (
                <Card key={post.id} className="p-6 md:p-8 border border-slate-100 dark:border-slate-850 bg-white dark:bg-slate-900/50 rounded-[2rem] overflow-hidden">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-4 cursor-pointer group">
                      <img src={post.user.avatar} alt={post.user.name} className="w-12 h-12 rounded-full bg-slate-100 group-hover:ring-2 ring-emerald-500 transition-all" />
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 transition-colors flex items-center gap-2 text-sm">
                          {post.user.name}
                          {post.user.role === 'Tutor' && <span title="Pro Mentor" className="flex items-center"><CheckCircle2 size={14} className="text-emerald-500" /></span>}
                        </h4>
                        <p className={cn("text-[10px] font-bold", post.isAd ? 'text-emerald-600 uppercase tracking-widest font-bold' : 'text-slate-400')}>{post.user.role} • {post.time}</p>
                      </div>
                    </div>
                    <button className="text-slate-450 hover:text-emerald-600 transition-colors"><MoreVertical size={18} /></button>
                  </div>
                  
                  <p className="text-slate-700 dark:text-slate-200 leading-relaxed font-semibold text-xs mb-4">
                    {post.content}
                  </p>

                  {/* Rich Media Banner */}
                  {post.imageUrl && (
                    <div className="my-4 rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-850 shadow-md">
                      <img src={post.imageUrl} alt="Post attachment" className="w-full h-72 object-cover" />
                      {post.isAd && (
                        <div className="bg-slate-50 dark:bg-slate-850 p-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                          <div>
                            <p className="font-black text-slate-900 dark:text-white text-xs">Trileza Immersive Engineering Bootcamp</p>
                            <p className="text-[10px] font-bold text-slate-450 dark:text-slate-400">Starts Next Month • Secure early waivers</p>
                          </div>
                          <Button size="sm" className="bg-slate-950 text-white rounded-xl font-bold border-none" onClick={() => showFeedback('Redirecting to course blueprint application...')}>Apply Now</Button>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className="flex items-center gap-6 border-t border-slate-100 dark:border-slate-800 pt-4 mt-2">
                    <button className="flex items-center gap-2 text-slate-550 hover:text-emerald-650 font-bold text-xs transition-colors group" onClick={() => showFeedback('+1 Helpful Reaction logged')}>
                      <div className="p-2 bg-slate-50 group-hover:bg-emerald-50 dark:bg-slate-850 rounded-full transition-colors"><Heart size={16} /></div>
                      {post.likes}
                    </button>
                    {!post.isAd && (
                      <button className="flex items-center gap-2 text-slate-550 hover:text-emerald-650 font-bold text-xs transition-colors group">
                        <div className="p-2 bg-slate-50 group-hover:bg-emerald-50 dark:bg-slate-850 rounded-full transition-colors"><MessageSquare size={16} /></div>
                        {post.replies.length}
                      </button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* ----- JOB BOARD TAB ----- */}
          {activeTab === 'jobs' && (
            <div className="space-y-6 animate-in fade-in duration-500">
              <Card className="p-8 border-none shadow-xl bg-gradient-to-br from-emerald-800 to-emerald-950 text-white rounded-[2rem] relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-48 h-48 bg-emerald-400 rounded-full blur-3xl opacity-30 pointer-events-none" />
                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                  <div>
                    <h2 className="text-2xl font-black mb-2">Build Your Career</h2>
                    <p className="text-emerald-100 text-xs font-semibold leading-relaxed max-w-xl">Discover tailored opportunities matched directly to your Trileza assessment scores and portfolio.</p>
                  </div>
                  <Button className="bg-white text-emerald-900 hover:bg-emerald-50 font-bold border-none shrink-0 rounded-xl" onClick={() => showFeedback('Updating match algorithms...')}>
                    Update Skill Matches
                  </Button>
                </div>
              </Card>

              <div className="space-y-4">
                {DUMMY_JOBS.map(job => (
                  <Card key={job.id} className="p-6 border border-slate-100 dark:border-slate-850 bg-white dark:bg-slate-900/50 shadow-md rounded-2xl group hover:-translate-y-1 transition-all duration-300">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div className="flex gap-6 items-center">
                        <img src={job.logo} alt={job.company} className="w-16 h-16 rounded-2xl bg-slate-50 p-2 shadow-inner shrink-0" />
                        <div className="space-y-1">
                          <h4 className="font-black text-lg text-slate-900 dark:text-white group-hover:text-emerald-600 transition-colors">{job.title}</h4>
                          <p className="text-xs font-bold text-slate-500 flex items-center gap-1"><Building2 size={12}/> {job.company}</p>
                          <div className="flex items-center gap-4 mt-2">
                            <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg"><MapPin size={10}/> {job.location}</span>
                            <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg"><Briefcase size={10}/> {job.type}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-row md:flex-col items-center md:items-end justify-between gap-4 border-t md:border-none border-slate-100 dark:border-slate-800 pt-4 md:pt-0">
                        <div className="text-right">
                          <span className="bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-400 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg inline-block mb-2">{job.match} Skill Match</span>
                          <p className="text-sm font-black text-slate-900 dark:text-white">{job.salary}</p>
                        </div>
                        <Button className="font-bold bg-slate-950 hover:bg-emerald-600 text-white border-none transition-colors px-6 flex items-center gap-2 rounded-xl h-11" onClick={() => showFeedback('Application submitted to employer!')}>
                          Apply Now <ExternalLink size={14}/>
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar Widget Stack */}
        <div className="space-y-6">
          <Card className="bg-slate-950 border border-slate-850 shadow-2xl shadow-slate-900/30 rounded-[2.5rem] p-6 relative overflow-hidden text-white">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500 rounded-full blur-3xl opacity-20 -translate-y-1/2 translate-x-1/2" />
            <div className="relative z-10 space-y-4">
              <Award className="text-emerald-400" size={32} />
              <h3 className="font-black text-white text-base leading-tight">Become a Paid Class Host</h3>
              <p className="text-xs text-slate-400 font-semibold leading-relaxed">
                As a top contributor, you qualify to host live study pods. Schedule one-off classes, advertise your expertise courses, and gain student leads immediately!
              </p>
              <Button 
                onClick={() => setIsCreatingPod(true)}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase text-[10px] tracking-wider rounded-xl mt-2 py-4 border-none"
              >
                Launch Pod Studio
              </Button>
            </div>
          </Card>

          <Card className="border border-slate-100 dark:border-slate-850 shadow-md bg-white dark:bg-slate-900/50 rounded-3xl p-6">
            <div className="flex items-center gap-2 mb-6">
              <TrendingUp className="text-emerald-600" size={18} />
              <h3 className="font-black text-sm text-slate-900 dark:text-white uppercase tracking-wider">Trending Topics</h3>
            </div>
            <div className="space-y-4">
              {['#ReactHooks', '#ArchitectureDesign', '#Algorithms', '#DesignSystems'].map((tag, i) => (
                <div key={i} className="flex items-center justify-between group cursor-pointer" onClick={() => showFeedback(`Loading discussions for ${tag}`)}>
                  <span className="font-bold text-xs text-slate-650 group-hover:text-emerald-600 dark:text-slate-350 transition-colors">{tag}</span>
                  <span className="text-[9px] font-bold text-slate-450 bg-slate-50 dark:bg-slate-850 px-2 py-1 rounded-md">{15 + i * 8} posts</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* ── CREATE LIVE STUDY POD MODAL ── */}
      {isCreatingPod && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <Card className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-2xl border border-slate-100 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-350 text-left">
            <div className="p-8 border-b border-slate-50 dark:border-slate-850 flex items-center justify-between bg-slate-50/50 dark:bg-slate-955/40">
              <div className="flex items-center gap-3">
                <Sparkles size={22} className="text-emerald-600 animate-pulse" />
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">Launch Live Class Pod</h2>
              </div>
              <button 
                onClick={() => setIsCreatingPod(false)} 
                className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleLaunchPodSubmit} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-450 ml-1">Pod Class Title</label>
                <input 
                  type="text"
                  required
                  placeholder="e.g. Masterclass: Advanced State Hooks"
                  value={newPodName}
                  onChange={(e) => setNewPodName(e.target.value)}
                  className="w-full h-13 px-5 rounded-2xl bg-slate-55 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 font-semibold text-sm text-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm"
                />
              </div>

              {/* High-Fidelity Custom File/Thumbnail Uploader */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-450 ml-1">Upload Pod Thumbnail</label>
                <div className="flex flex-col sm:flex-row gap-4 items-center bg-slate-50 dark:bg-slate-850 p-4 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                  {newPodImage ? (
                    <div className="relative w-32 h-20 rounded-xl overflow-hidden shadow-md shrink-0 bg-slate-100">
                      <img src={newPodImage} alt="Uploaded thumbnail" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setNewPodImage('')}
                        className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 shadow-md hover:bg-red-700 transition-colors"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ) : (
                    <div className="w-32 h-20 rounded-xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-400 shrink-0 border border-slate-300 dark:border-slate-700">
                      <ImageIcon size={28} />
                    </div>
                  )}
                  <div className="flex-grow text-center sm:text-left space-y-1">
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200">Click to upload class thumbnail banner</p>
                    <p className="text-[10px] text-slate-400 font-semibold">Supports PNG, JPG, or GIF up to 5MB. Real dynamic browser preview!</p>
                    <input
                      type="file"
                      accept="image/*"
                      id="pod-thumbnail-upload"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setNewPodImage(reader.result as string);
                            showFeedback('Thumbnail uploaded successfully!', 'success');
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                    <label
                      htmlFor="pod-thumbnail-upload"
                      className="inline-block mt-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-wider rounded-lg cursor-pointer transition-colors shadow-sm"
                    >
                      Select Image File
                    </label>
                  </div>
                </div>
              </div>

              <div className="space-y-2 relative">
                <label className="text-xs font-black uppercase tracking-widest text-slate-450 ml-1">Syllabus Topic Focus</label>
                <input
                  type="text"
                  required
                  placeholder="Type to search digital skills, or enter your own..."
                  value={newPodCategory}
                  onChange={(e) => {
                    setNewPodCategory(e.target.value);
                    setShowSkillSuggestions(true);
                  }}
                  onFocus={() => setShowSkillSuggestions(true)}
                  onBlur={() => {
                    setTimeout(() => setShowSkillSuggestions(false), 250);
                  }}
                  className="w-full h-13 px-5 rounded-2xl bg-slate-55 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 font-semibold text-sm text-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm"
                />

                {showSkillSuggestions && (
                  <div className="absolute z-[110] left-0 right-0 mt-1.5 max-h-52 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl animate-in fade-in duration-100 text-left">
                    {(() => {
                      const query = newPodCategory.toLowerCase().trim();
                      const filtered = DIGITAL_SKILLS.filter(skill =>
                        skill.toLowerCase().includes(query)
                      );
                      if (filtered.length === 0) {
                        return (
                          <div className="p-4 text-xs text-slate-400 font-medium">
                            Press Enter or continue typing to define a custom skill: "{newPodCategory}"
                          </div>
                        );
                      }
                      return filtered.map(skill => (
                        <button
                          key={skill}
                          type="button"
                          onClick={() => {
                            setNewPodCategory(skill);
                            setShowSkillSuggestions(false);
                          }}
                          className="w-full px-5 py-3 text-sm text-left hover:bg-emerald-50 dark:hover:bg-slate-800 text-slate-850 dark:text-slate-200 transition-colors font-semibold border-none bg-transparent"
                        >
                          {skill}
                        </button>
                      ));
                    })()}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-450 ml-1">Promotional Description (One-off Pitch)</label>
                <textarea
                  placeholder="Describe what learners will achieve and pitch your core curriculum courses/templates..."
                  value={newPodDescription}
                  onChange={(e) => setNewPodDescription(e.target.value)}
                  rows={3}
                  className="w-full p-4 rounded-2xl bg-slate-55 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 font-semibold text-sm text-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm resize-none"
                />
              </div>

              {/* Scheduling Slot */}
              <div className="space-y-3">
                <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-850 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <div className="text-left">
                    <h5 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">Schedule for Later</h5>
                    <p className="text-[10px] text-slate-400 font-bold mt-0.5">List this pod as an upcoming community class.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsScheduled(!isScheduled)}
                    className={cn(
                      "w-11 h-6 rounded-full relative transition-colors focus:outline-none",
                      isScheduled ? "bg-emerald-600" : "bg-slate-350"
                    )}
                  >
                    <span
                      className={cn(
                        "w-4 h-4 rounded-full bg-white absolute top-1 transition-all shadow-md",
                        isScheduled ? "right-1" : "left-1"
                      )}
                    />
                  </button>
                </div>

                {isScheduled && (
                  <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-3 duration-250">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-450 ml-1">Event Date</label>
                      <input
                        type="date"
                        required
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        className="w-full h-13 px-4 rounded-2xl bg-slate-55 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 font-semibold text-sm text-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-450 ml-1">Start Time</label>
                      <input
                        type="time"
                        required
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                        className="w-full h-13 px-4 rounded-2xl bg-slate-55 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 font-semibold text-sm text-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsCreatingPod(false)} 
                  className="flex-1 rounded-2xl h-13 text-xs font-black uppercase tracking-widest border-slate-200 dark:border-slate-700"
                >
                  Cancel
                </Button>
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => setIsScheduled(true)} 
                  className="flex-1 rounded-2xl h-13 text-xs font-black uppercase tracking-widest border-slate-200 dark:border-slate-700 flex items-center justify-center gap-2"
                >
                  <Calendar size={14} /> Schedule a Date
                </Button>
                <Button 
                  type="submit" 
                  className="flex-1 rounded-2xl h-13 font-black uppercase tracking-widest text-xs bg-emerald-600 text-white hover:bg-emerald-700 border-none shadow-lg shadow-emerald-500/10"
                >
                  Go Live 🚀
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* ── SOCIAL SHARE & CONNECTOR MODAL ── */}
      {isShareModalOpen && selectedSharePod && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <Card className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-2xl border border-slate-100 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-350 text-left">
            <div className="p-8 border-b border-slate-50 dark:border-slate-850 flex items-center justify-between bg-slate-50/50 dark:bg-slate-955/40">
              <div className="flex items-center gap-3">
                <Share2 size={22} className="text-emerald-600 animate-pulse" />
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">Share Live Class to Socials</h2>
              </div>
              <button 
                onClick={() => { setIsShareModalOpen(false); setPublishStatus('idle'); }} 
                className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-8 space-y-6">
              
              {/* Pod Details Preview Card */}
              <div className="bg-slate-50 dark:bg-slate-850 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 flex gap-4">
                <img src={selectedSharePod.image} alt={selectedSharePod.name} className="w-24 h-24 rounded-xl object-cover shrink-0 shadow-sm" />
                <div className="space-y-1.5 min-w-0 text-left">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-450 px-2.5 py-0.5 rounded inline-block">
                    {selectedSharePod.activity === 'Scheduled' ? 'Upcoming Class' : 'Live Now'}
                  </span>
                  <h4 className="font-extrabold text-slate-900 dark:text-white text-base truncate">{selectedSharePod.name}</h4>
                  <p className="text-xs text-slate-450 dark:text-slate-400 font-semibold line-clamp-2 leading-relaxed">{selectedSharePod.description}</p>
                  {selectedSharePod.scheduledAt && (
                    <p className="text-[11px] text-indigo-650 dark:text-indigo-400 font-black mt-1">📅 Starts: {selectedSharePod.scheduledAt}</p>
                  )}
                </div>
              </div>

              {/* Step 1: Connect Accounts */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-450 ml-1">Step 1: Connect Social Accounts</h4>
                <div className="space-y-2">
                  {[
                    { id: 'linkedin', name: 'LinkedIn', color: 'bg-blue-600 hover:bg-blue-700' },
                    { id: 'twitter', name: 'X / Twitter', color: 'bg-slate-900 hover:bg-black' },
                    { id: 'slack', name: 'Slack Workspace', color: 'bg-purple-600 hover:bg-purple-700' }
                  ].map(platform => {
                    const status = connections[platform.id];
                    return (
                      <div key={platform.id} className="flex items-center justify-between p-4 bg-slate-55 dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-800">
                        <span className="text-sm font-black text-slate-850 dark:text-white">{platform.name}</span>
                        <div className="flex items-center gap-2">
                          {status === 'connected' ? (
                            <span className="text-xs font-black bg-emerald-50 text-emerald-650 dark:bg-emerald-950 dark:text-emerald-450 px-3 py-1.5 rounded-xl border border-emerald-250/40 shadow-sm">
                              Connected ✓
                            </span>
                          ) : status === 'connecting' ? (
                            <span className="text-xs font-black bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 px-3 py-1.5 rounded-xl flex items-center gap-2">
                              <span className="w-3.5 h-3.5 border border-slate-400 border-t-transparent rounded-full animate-spin" /> Authorization...
                            </span>
                          ) : (
                            <button
                              onClick={() => handleConnectSocial(platform.id)}
                              className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-black transition-all shadow-sm"
                            >
                              Connect
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Step 2: Preview & Post */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-450 ml-1">Step 2: Preview & Publish Post</h4>
                
                {/* Simulated Social Post Preview */}
                <div className="bg-slate-50 dark:bg-slate-850 p-5 rounded-2xl border border-slate-200 dark:border-slate-800/80 text-sm font-semibold text-slate-700 dark:text-slate-300 space-y-3 text-left">
                  <div className="flex items-center gap-2.5 mb-1">
                    <img src={user?.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=You'} className="w-8 h-8 rounded-full border border-slate-200" />
                    <div>
                      <p className="font-extrabold text-xs text-slate-900 dark:text-white leading-none">{user?.full_name || 'Academic Scholar'}</p>
                      <p className="text-[10px] text-slate-450 font-bold leading-none mt-1">Now posting</p>
                    </div>
                  </div>
                  <p className="leading-relaxed text-sm">
                    🚀 Hey peer network! I am hosting a live Study Pod: <strong className="text-slate-900 dark:text-white font-extrabold">"{selectedSharePod.name}"</strong> on Trileza Community! Join me to master digital engineering skills.
                  </p>
                  <p className="text-emerald-600 font-bold truncate text-sm">
                    Register here: https://trileza.app/community/pods/{selectedSharePod.id}
                  </p>
                </div>

                {publishStatus !== 'idle' ? (
                  <div className="p-6 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-150/40 rounded-2xl text-center flex flex-col items-center justify-center gap-2 shadow-sm">
                    <span className="w-7 h-7 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                    <p className="text-xs font-black text-emerald-800 dark:text-emerald-400 uppercase tracking-wider mt-1">
                      {publishStatus === 'drafting' && 'Drafting post payload...'}
                      {publishStatus === 'formatting' && 'Attaching media assets...'}
                      {publishStatus === 'publishing' && 'Broadcasting to social channels...'}
                      {publishStatus === 'published' && '🎉 Success! Broadcast published on all connected socials.'}
                    </p>
                  </div>
                ) : (
                  <Button
                    onClick={handlePublishPost}
                    className="w-full rounded-2xl h-13 font-black uppercase tracking-widest text-xs bg-emerald-600 text-white hover:bg-emerald-700 border-none shadow-md"
                  >
                    Share Post on Connected Socials 🚀
                  </Button>
                )}
              </div>

            </div>
          </Card>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default CommunityPortal;
