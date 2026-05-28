import React from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Users, 
  DollarSign,
  Download,
  Calendar,
  Filter
} from 'lucide-react';
import { Card, Button } from '../../components/ui';
import { cn } from '../../utils';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell
} from 'recharts';

const data = [
  { name: 'Jan', revenue: 45000, students: 2400 },
  { name: 'Feb', revenue: 52000, students: 2800 },
  { name: 'Mar', revenue: 48000, students: 3200 },
  { name: 'Apr', revenue: 61000, students: 3900 },
  { name: 'May', revenue: 55000, students: 4500 },
  { name: 'Jun', revenue: 67000, students: 5100 },
];

const segmentData = [
  { name: 'Web Dev', value: 400 },
  { name: 'Design', value: 300 },
  { name: 'Logic', value: 300 },
  { name: 'Social', value: 200 },
];

const COLORS = ['#10b981', '#34d399', '#6ee7b7', '#f1f5f9'];

const Analytics = () => {
  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex justify-between items-center px-4">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Platform Analytics Center</h1>
          <p className="text-slate-500 font-medium text-lg mt-1">Granular growth vectors and behavioral forecasting.</p>
        </div>
        <div className="flex gap-4">
          <Button variant="outline" className="gap-2 rounded-2xl h-14 px-6 border-slate-200">
            <Calendar size={18} /> Timeframe: Q2 2024
          </Button>
          <Button className="gap-2 bg-brand-primary hover:bg-brand-primary-hover text-white border-none shadow-xl shadow-emerald-500/20 rounded-2xl h-14 px-8">
            <Download size={18} /> Global Export
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Growth Matrix */}
        <Card className="lg:col-span-2 p-10 rounded-[3rem] border-none shadow-2xl shadow-slate-200/40">
          <div className="flex justify-between items-center mb-12">
            <div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Platform Growth Matrix</h3>
              <p className="text-sm text-slate-400 font-bold uppercase tracking-widest mt-1">Monthly revenue vs mentee acquisition</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="rounded-xl px-4 text-[10px] font-black uppercase">Revenue</Button>
              <Button variant="outline" size="sm" className="rounded-xl px-4 text-[10px] font-black uppercase bg-slate-50 border-none">Engagement</Button>
            </div>
          </div>
          
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorPrimary" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#94a3b8', fontWeight: 600}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#94a3b8', fontWeight: 600}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)', padding: '20px' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={4} fillOpacity={1} fill="url(#colorPrimary)" />
                <Area type="monotone" dataKey="students" stroke="#64748b" strokeWidth={2} strokeDasharray="5 5" fillOpacity={0} fill="transparent" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-12 pt-8 border-t border-slate-50 grid grid-cols-3 gap-8">
             <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Total Yield</p>
                <p className="text-2xl font-black text-slate-900">$340,500</p>
                <div className="flex items-center gap-1 text-emerald-500 text-[10px] font-bold mt-1">
                  <TrendingUp size={12} /> +14.2%
                </div>
             </div>
             <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Cohort Growth</p>
                <p className="text-2xl font-black text-slate-900">4,280</p>
                <div className="flex items-center gap-1 text-emerald-500 text-[10px] font-bold mt-1">
                  <TrendingUp size={12} /> +24%
                </div>
             </div>
             <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Avg Ticket</p>
                <p className="text-2xl font-black text-slate-900">$79.40</p>
                <div className="flex items-center gap-1 text-red-400 text-[10px] font-bold mt-1">
                  <TrendingDown size={12} /> -2.1%
                </div>
             </div>
          </div>
        </Card>

        <div className="space-y-8">
           <Card className="p-8 rounded-[3rem] border-none shadow-2xl shadow-slate-200/40">
              <h3 className="font-black text-xl mb-8 tracking-tight">Channel Distribution</h3>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={segmentData}>
                    <Bar dataKey="value" radius={[10, 10, 10, 10]}>
                      {segmentData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-8 space-y-4">
                 {segmentData.map((s, i) => (
                   <div key={i} className="flex justify-between items-center text-sm font-bold">
                     <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                        <span className="text-slate-600">{s.name}</span>
                     </div>
                     <span className="text-slate-900">{s.value}</span>
                   </div>
                 ))}
              </div>
           </Card>

           <Card className="p-10 bg-brand-primary text-white rounded-[3rem] border-none shadow-xl shadow-emerald-500/20 relative overflow-hidden group">
              <div className="relative z-10">
                <BarChart3 size={32} className="mb-6 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500" />
                <h3 className="text-xl font-black mb-4">Forecasting Node</h3>
                <p className="text-white/70 text-sm font-medium leading-relaxed">System predicts 12% increase in Social Marketing enrollments over next cycle.</p>
                <Button className="mt-8 w-full bg-white text-brand-primary font-black uppercase text-[10px] tracking-widest h-12 rounded-2xl hover:bg-slate-50 border-none transition-all">Launch Simulation</Button>
              </div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl" />
           </Card>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
