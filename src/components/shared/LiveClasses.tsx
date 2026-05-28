import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveStore } from '../../store/liveStore';
import { Radio, Users, Play, ChevronRight } from 'lucide-react';
import { cn } from '../../utils';
import { motion } from 'framer-motion';

const LiveClasses: React.FC = () => {
  const { activeSessions } = useLiveStore();
  const navigate = useNavigate();

  if (activeSessions.length === 0) return null;

  return (
    <div className="space-y-4 mb-8">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500">
            <Radio size={18} className="animate-pulse" />
          </div>
          Live Classes Now
        </h2>
        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{activeSessions.length} Active Sessions</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {activeSessions.map((session, index) => (
          <motion.div
            key={session.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1 }}
            className="group relative bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 hover:border-brand-primary/30 hover:shadow-2xl hover:shadow-emerald-500/5 transition-all cursor-pointer overflow-hidden"
            onClick={() => navigate('/live')}
          >
            {/* Live Badge */}
            <div className="absolute top-4 right-4 z-10">
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500 text-white text-[10px] font-bold uppercase tracking-wider animate-pulse shadow-lg shadow-red-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-white" />
                Live
              </span>
            </div>

            <div className="flex gap-4">
              <div className="relative flex-shrink-0">
                <img 
                  src={session.tutorAvatar} 
                  alt={session.tutorName} 
                  className="w-14 h-14 rounded-2xl object-cover ring-2 ring-slate-100 dark:ring-slate-800 group-hover:ring-brand-primary/20 transition-all"
                />
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-lg bg-brand-primary text-white flex items-center justify-center shadow-lg">
                  <Play size={10} fill="currentColor" />
                </div>
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-slate-900 dark:text-white truncate text-sm mb-1 group-hover:text-brand-primary transition-colors">
                  {session.courseName}
                </h3>
                <p className="text-xs text-slate-500 font-medium mb-3">{session.tutorName}</p>
                
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <Users size={12} />
                    <span className="text-[10px] font-bold">{(session.viewerCount / 1000).toFixed(1)}k</span>
                  </div>
                  <div className="h-4 w-px bg-slate-100 dark:bg-slate-800" />
                  <div className="flex items-center gap-1.5 text-brand-primary">
                    <span className="text-[10px] font-bold uppercase tracking-tighter">Enter Studio</span>
                    <ChevronRight size={12} />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default LiveClasses;
