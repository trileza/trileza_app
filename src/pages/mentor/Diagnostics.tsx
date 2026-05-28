import React, { useState } from 'react';
import { Card, Button } from '../../components/ui';
import { PlayCircle, PlusCircle, Activity, LayoutDashboard } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Toast } from '../../components/ui/Toast';

const diagnosticData = [
  { name: 'Alice S.', score: 85 },
  { name: 'Sarah J.', score: 92 },
  { name: 'Michael C.', score: 45 },
  { name: 'David B.', score: 78 }
];

const Diagnostics = () => {
  const [toast, setToast] = useState<{message: string, type: 'success' | 'info'} | null>(null);
  const showFeedback = (msg: string, type: 'success' | 'info' = 'success') => setToast({ message: msg, type });

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 max-w-7xl mx-auto">
      {/* Global Premium Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-950 p-8 md:p-12 rounded-[2.5rem] text-white shadow-2xl shadow-emerald-900/20 relative overflow-hidden">
        <div className="absolute -top-32 -left-32 w-80 h-80 bg-indigo-500 rounded-full blur-[100px] opacity-30 animate-pulse" />
        <div className="absolute right-0 bottom-0 w-80 h-80 bg-emerald-500 rounded-full blur-[100px] opacity-20 translate-y-1/2 translate-x-1/3" />
        
        <div className="relative z-10 space-y-2">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-lg">
               <Activity className="text-indigo-400" size={20} />
            </div>
            <span className="text-indigo-400 font-black tracking-[0.2em] uppercase text-xs">Performance Engine</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white">Diagnostic Tools</h1>
          <p className="text-slate-400 font-medium max-w-xl text-lg mt-2">Deploy real-time comprehension checks and monitor your cohort's performance metrics.</p>
        </div>
        
        <div className="relative z-10 hidden md:flex items-center gap-4 bg-white/5 border border-white/10 p-4 rounded-2xl backdrop-blur-md">
           <div className="p-3 bg-indigo-500/20 text-indigo-400 rounded-xl"><LayoutDashboard size={24}/></div>
           <div>
              <p className="font-bold text-white leading-tight">Live Realtime Sync</p>
              <p className="text-xs text-slate-400">Connected to 12 students</p>
           </div>
        </div>
      </div>
      
      <div className="relative z-10 grid grid-cols-1 gap-8">
        <Card className="p-8 border-none shadow-xl shadow-slate-200/50 rounded-[2rem]">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-black text-slate-900">Pop-Quiz Launcher</h3>
          <Button className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold border-none" onClick={() => showFeedback('Deploying live quiz to all screens via Realtime Engine...')}>
            <PlayCircle size={16} className="mr-2" /> Deploy Live Quiz
          </Button>
        </div>
        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
          <input type="text" placeholder="Question 1 (e.g. What is the Big-O of QuickSort?)" className="w-full bg-white border border-slate-200 p-4 rounded-xl font-medium outline-none focus:ring-2 focus:ring-indigo-500 mb-4" />
          <Button variant="outline" className="w-full border-dashed border-slate-300 text-slate-500 font-bold bg-white"><PlusCircle size={16} className="mr-2"/> Add Question</Button>
        </div>
      </Card>

      <Card className="p-8 border-none shadow-xl shadow-slate-200/50 rounded-[2rem]">
        <h3 className="text-xl font-black text-slate-900 mb-6">Real-Time Comprehension Metrics</h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={diagnosticData}>
              <XAxis dataKey="name" axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }} />
              <Bar dataKey="score" radius={[8, 8, 8, 8]}>
                {diagnosticData.map((entry, index) => (
                   <Cell key={`cell-${index}`} fill={entry.score > 80 ? '#10b981' : entry.score > 60 ? '#f59e0b' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default Diagnostics;
