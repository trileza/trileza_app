import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Users, 
  BookOpen, 
  AlertCircle, 
  ShieldCheck,
  TrendingUp,
  Download,
  Filter,
  Search,
  MoreHorizontal
} from 'lucide-react';
import { Card, Button } from '../../components/ui';
import { cn } from '../../utils';

const AuditDetail = () => {
  const { type } = useParams<{ type: string }>();
  const navigate = useNavigate();

  const getAuditConfig = () => {
    switch (type) {
      case 'students':
        return {
          title: 'Active Student Node Audit',
          icon: Users,
          color: 'text-brand-primary',
          bg: 'bg-emerald-50',
          stats: [
            { label: 'Total Enrolled', value: '4,280' },
            { label: 'Active Today', value: '1,280' },
            { label: 'Retention Rate', value: '94%' },
            { label: 'Avg Study Time', value: '2.4h' }
          ]
        };
      case 'courses':
        return {
          title: 'Course Pipeline Oversight',
          icon: BookOpen,
          color: 'text-brand-primary',
          bg: 'bg-emerald-50',
          stats: [
            { label: 'In Production', value: '42' },
            { label: 'Published Today', value: '3' },
            { label: 'Average Quality', value: '4.8/5' },
            { label: 'Total Modules', value: '1,240' }
          ]
        };
      case 'approvals':
        return {
          title: 'Pending Approval Queue',
          icon: AlertCircle,
          color: 'text-orange-500',
          bg: 'bg-orange-50',
          stats: [
            { label: 'Waitlist', value: '18' },
            { label: 'Avg Wait Time', value: '4.2h' },
            { label: 'Rejected This Week', value: '2' },
            { label: 'Auto-Approved', value: '124' }
          ]
        };
      case 'health':
        return {
          title: 'Platform Infrastructure Health',
          icon: ShieldCheck,
          color: 'text-brand-primary',
          bg: 'bg-emerald-50',
          stats: [
            { label: 'Uptime (30d)', value: '99.9%' },
            { label: 'Latency', value: '84ms' },
            { label: 'Error Rate', value: '0.02%' },
            { label: 'Cloud Resources', value: 'Active' }
          ]
        };
      default:
        return {
          title: 'Audit Detail',
          icon: ShieldCheck,
          color: 'text-slate-500',
          bg: 'bg-slate-50',
          stats: []
        };
    }
  };

  const config = getAuditConfig();

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col gap-6">
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-400 hover:text-brand-primary transition-colors group w-fit"
        >
          <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
          <span className="text-xs font-black uppercase tracking-widest">Back to Command Audit</span>
        </button>
        
        <div className="flex justify-between items-end">
          <div className="flex items-center gap-6">
            <div className={cn("p-6 rounded-[2rem] shadow-xl", config.bg, config.color)}>
              <config.icon size={40} />
            </div>
            <div>
              <h1 className="text-4xl font-black text-slate-900 tracking-tight">{config.title}</h1>
              <p className="text-slate-500 font-medium text-lg mt-1 group cursor-default">
                Deep-dive synchronized ledger for <span className="text-brand-primary font-bold capitalize">{type}</span> node.
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <Button variant="outline" className="gap-2 rounded-2xl h-14 px-6 border-slate-200">
              <Download size={18} /> Export Data
            </Button>
            <Button className="gap-2 bg-brand-primary hover:bg-brand-primary-hover text-white border-none shadow-xl shadow-emerald-500/20 rounded-2xl h-14 px-8">
              Sync Node
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {config.stats.map((stat, i) => (
          <Card key={i} className="p-8 border-none ring-1 ring-slate-100 shadow-sm hover:ring-brand-primary/20 hover:shadow-xl transition-all duration-500 rounded-[2rem]">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">{stat.label}</p>
            <p className="text-3xl font-black text-slate-900 tabular-nums">{stat.value}</p>
          </Card>
        ))}
      </div>

      <Card className="rounded-[3rem] overflow-hidden border-none shadow-2xl shadow-slate-200/50 bg-white">
        <div className="p-10 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4 flex-1">
             <div className="relative flex-1 max-w-md group">
               <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-brand-primary transition-colors" size={20} />
               <input 
                 type="text" 
                 placeholder={`Filter ${type} by identity or unique ID...`}
                 className="w-full pl-12 pr-6 py-4 bg-slate-50 rounded-2xl border-none ring-1 ring-slate-100 focus:ring-4 focus:ring-brand-primary/10 transition-all outline-none text-sm font-medium"
               />
             </div>
             <Button variant="outline" className="h-12 w-12 p-0 rounded-xl border-slate-100">
               <Filter size={18} />
             </Button>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest px-4 border-r border-slate-100">Showing 1-12 of 124 units</span>
            <div className="flex gap-2">
              <button className="h-8 w-8 flex items-center justify-center rounded-lg bg-slate-100 text-slate-400 hover:bg-brand-primary hover:text-white transition-all">&larr;</button>
              <button className="h-8 w-8 flex items-center justify-center rounded-lg bg-brand-primary text-white shadow-lg shadow-emerald-500/20">1</button>
              <button className="h-8 w-8 flex items-center justify-center rounded-lg bg-slate-100 text-slate-400 hover:bg-brand-primary hover:text-white transition-all">2</button>
              <button className="h-8 w-8 flex items-center justify-center rounded-lg bg-slate-100 text-slate-400 hover:bg-brand-primary hover:text-white transition-all">&rarr;</button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-10 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Node Identity</th>
                <th className="px-10 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Status Vector</th>
                <th className="px-10 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Activity Load</th>
                <th className="px-10 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-right">Synchronization</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <tr key={i} className="group hover:bg-slate-50/30 transition-colors cursor-pointer">
                  <td className="px-10 py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 font-black text-xs">U{i}</div>
                      <div>
                        <p className="font-bold text-slate-800">Quantum Entity #{i}024</p>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mt-1">Ref: TRI-{type.slice(0,3).toUpperCase()}-940-1{i}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-10 py-6">
                    <div className="flex items-center gap-2">
                       <div className={cn("w-2 h-2 rounded-full", i % 3 === 0 ? "bg-red-500 animate-pulse" : "bg-emerald-500")} />
                       <span className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-600">
                         {i % 3 === 0 ? 'Action Required' : 'Active Channel'}
                       </span>
                    </div>
                  </td>
                  <td className="px-10 py-6">
                    <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-brand-primary rounded-full transition-all duration-1000" style={{ width: `${Math.random() * 60 + 40}%` }} />
                    </div>
                  </td>
                  <td className="px-10 py-6 text-right">
                    <button className="p-2 rounded-xl text-slate-300 hover:text-brand-primary hover:bg-slate-100 transition-all opacity-0 group-hover:opacity-100">
                      <MoreHorizontal size={20} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default AuditDetail;
