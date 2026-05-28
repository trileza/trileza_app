import React, { useState, useRef, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  SkipForward, 
  SkipBack, 
  Volume2, 
  Settings, 
  Maximize, 
  MessageSquare, 
  BookOpen, 
  Download,
  Link as LinkIcon,
  ChevronRight,
  Clock
} from 'lucide-react';
import { Button, Card } from '../../components/ui';
import { cn } from '../../utils';

interface TimestampAction {
  time: number;
  label: string;
  type: 'pdf' | 'link' | 'note';
  content: string;
}

const CourseViewer = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(180); // 3 minutes for demo
  const [activeAction, setActiveAction] = useState<TimestampAction | null>(null);
  
  const videoRef = useRef<HTMLDivElement>(null);

  const smartTimestamps: TimestampAction[] = [
    { time: 15, label: 'Download Design Brief', type: 'pdf', content: 'Design_Guidelines_v1.pdf' },
    { time: 45, label: 'View UI Inspiration', type: 'link', content: 'https://dribbble.com/search/lms-ui' },
    { time: 110, label: 'Key Principle: Hierarchy', type: 'note', content: 'Always prioritize typography scale over color.' },
  ];

  useEffect(() => {
    let interval: any;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentTime((prev) => {
          const next = prev + 1;
          if (next >= duration) {
            setIsPlaying(false);
            return duration;
          }
          // Check for smart actions
          const action = smartTimestamps.find(a => a.time === next);
          if (action) setActiveAction(action);
          return next;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, duration]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 h-[calc(100vh-120px)]">
      {/* Video Section */}
      <div className="flex-1 flex flex-col gap-6">
        <div 
          ref={videoRef}
          className="relative aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl group border border-slate-800"
        >
          {/* Mock Video Content */}
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-brand-indigo/20 to-brand-slate">
            {!isPlaying && (
              <button 
                onClick={() => setIsPlaying(true)}
                className="w-20 h-20 rounded-full bg-brand-mint text-brand-slate flex items-center justify-center hover:scale-110 transition-transform shadow-xl shadow-brand-mint/20"
              >
                <Play fill="currentColor" size={32} />
              </button>
            )}
            <div className="text-white/20 font-bold text-6xl select-none uppercase tracking-tighter italic">
              Module 01: Core UX
            </div>
          </div>

          {/* Smart Action Notification Overlay */}
          {activeAction && (
            <div className="absolute top-6 right-6 animate-in slide-in-from-right fade-in duration-500">
              <div className="bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-2xl flex items-center gap-4 shadow-2xl">
                <div className="p-2 bg-brand-mint rounded-lg text-brand-slate">
                  {activeAction.type === 'pdf' && <Download size={20} />}
                  {activeAction.type === 'link' && <LinkIcon size={20} />}
                  {activeAction.type === 'note' && <BookOpen size={20} />}
                </div>
                <div>
                  <p className="text-[10px] font-bold text-brand-mint uppercase tracking-wider">Smart Trigger</p>
                  <p className="text-sm font-bold text-white">{activeAction.label}</p>
                </div>
                <button 
                  onClick={() => setActiveAction(null)}
                  className="p-1 hover:bg-white/10 rounded-full text-white"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>
          )}

          {/* Custom Controls */}
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-6 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
            <div className="flex flex-col gap-4">
              {/* Progress Bar */}
              <div className="relative h-1.5 bg-white/20 rounded-full cursor-pointer overflow-hidden">
                <div 
                  className="absolute h-full bg-brand-mint transition-all duration-300" 
                  style={{ width: `${(currentTime / duration) * 100}%` }}
                />
                {/* Timestamp markers */}
                {smartTimestamps.map((st, idx) => (
                  <div 
                    key={idx}
                    className="absolute top-0 w-1 h-full bg-white/50"
                    style={{ left: `${(st.time / duration) * 100}%` }}
                  />
                ))}
              </div>

              <div className="flex items-center justify-between text-white">
                <div className="flex items-center gap-6">
                  <button onClick={() => setIsPlaying(!isPlaying)} className="hover:text-brand-mint transition-colors">
                    {isPlaying ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}
                  </button>
                  <button className="hover:text-brand-mint transition-colors"><SkipBack /></button>
                  <button className="hover:text-brand-mint transition-colors"><SkipForward /></button>
                  <div className="flex items-center gap-2">
                    <Volume2 size={20} />
                    <div className="w-20 h-1 bg-white/30 rounded-full">
                      <div className="w-2/3 h-full bg-white rounded-full" />
                    </div>
                  </div>
                  <span className="text-sm font-medium tabular-nums">{formatTime(currentTime)} / {formatTime(duration)}</span>
                </div>
                <div className="flex items-center gap-4">
                  <button className="hover:text-brand-mint transition-colors"><Settings size={20} /></button>
                  <button className="hover:text-brand-mint transition-colors"><Maximize size={20} /></button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold">01. Understanding User Hierarchy</h2>
            <p className="text-slate-500 mt-1">Foundations of Digital Experience Design • 12 mins left</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2"><MessageSquare size={18} /> Community</Button>
            <Button className="gap-2 bg-brand-indigo hover:bg-brand-indigo/90">Mark as Complete</Button>
          </div>
        </div>
      </div>

      {/* Sidebar Section */}
      <div className="w-full lg:w-80 shrink-0 flex flex-col gap-6">
        <Card className="flex-1 overflow-y-auto">
          <div className="flex items-center gap-2 mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
            <BookOpen className="text-brand-indigo" size={20} />
            <h3 className="font-bold">Course Modules</h3>
          </div>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((m) => (
              <div 
                key={m}
                className={cn(
                  "p-4 rounded-2xl cursor-pointer transition-all border border-transparent",
                  m === 1 ? "bg-brand-indigo/5 border-brand-indigo/10" : "hover:bg-slate-50"
                )}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Module 0{m}</span>
                  {m === 1 && <span className="text-[10px] font-bold text-brand-indigo">Current</span>}
                </div>
                <h4 className={cn("text-xs font-bold", m === 1 ? "text-brand-indigo" : "text-slate-700")}>Introduction to Systems</h4>
                <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-400 font-medium">
                  <Clock size={12} /> 14:20
                  {m < 1 ? <span className="text-emerald-500">Completed</span> : null}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {activeAction && (
          <Card className="border-brand-mint shadow-lg shadow-brand-mint/5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-2 text-brand-mint mb-3">
              <Download size={18} />
              <span className="text-xs font-bold uppercase tracking-widest">Active Resource</span>
            </div>
            <p className="text-sm font-bold text-slate-800">{activeAction.label}</p>
            <p className="text-xs text-slate-500 mt-2 line-clamp-2">This resource is highly relevant to the current segment of the lecture.</p>
            <Button size="sm" className="w-full mt-4 bg-brand-mint text-brand-slate hover:bg-brand-mint/90 border-none">
              Open Resource
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
};

export default CourseViewer;
