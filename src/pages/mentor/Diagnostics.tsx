import React, { useState } from 'react';
import { Card, Button } from '../../components/ui';
import { PlayCircle, PlusCircle, Activity, LayoutDashboard } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Toast } from '../../components/ui/Toast';
import { PageHeader } from '../../components/shared';

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
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 w-full">
      {/* Global Premium Header */}
      <PageHeader 
        title="Diagnostic Tools"
        description="Deploy real-time comprehension checks and monitor your cohort's performance metrics."
        tag="PERFORMANCE ENGINE"
        icon={Activity}
        rightContent={
          <div className="hidden md:flex items-center gap-4 bg-white/5 border border-white/10 p-4 rounded-2xl backdrop-blur-md">
             <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-xl"><LayoutDashboard size={24}/></div>
             <div>
                <p className="font-bold text-white leading-tight">Live Realtime Sync</p>
                <p className="text-xs text-slate-400">Connected to 12 students</p>
             </div>
          </div>
        }
      />
      
      <div className="relative z-10 grid grid-cols-1 gap-8">
        <Card className="p-8 border-none shadow-xl shadow-slate-200/50 rounded-[2rem]">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-black text-foreground">Pop-Quiz Launcher</h3>
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold border-none shadow-lg shadow-emerald-500/20" onClick={() => showFeedback('Deploying live quiz to all screens via Realtime Engine...')}>
            <PlayCircle size={16} className="mr-2" /> Deploy Live Quiz
          </Button>
        </div>
        <div className="bg-surface-2 p-6 rounded-2xl border border-border">
          <input type="text" placeholder="Question 1 (e.g. What is the Big-O of QuickSort?)" className="w-full bg-surface border border-border p-4 rounded-xl font-medium outline-none focus:ring-2 focus:ring-emerald-500 mb-4 text-foreground" />
          <Button variant="outline" className="w-full border-dashed border-border text-text-secondary font-bold bg-surface hover:text-emerald-500"><PlusCircle size={16} className="mr-2"/> Add Question</Button>
        </div>
      </Card>

      <Card className="p-8 border-none shadow-xl shadow-slate-200/50 rounded-[2rem]">
        <h3 className="text-xl font-black text-foreground mb-6">Real-Time Comprehension Metrics</h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={diagnosticData}>
              <XAxis dataKey="name" axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }} />
              <Bar dataKey="score" radius={[8, 8, 8, 8]}>
                {diagnosticData.map((entry, index) => (
                   <Cell key={`cell-${index}`} fill={entry.score > 80 ? '#43A047' : entry.score > 60 ? '#f59e0b' : '#ef4444'} />
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
