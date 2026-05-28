import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  BookOpen, 
  ShieldCheck, 
  AlertCircle,
  FileCheck,
  MoreVertical,
  ArrowUpRight,
  Check,
  X,
  UserCheck,
  Sparkles
} from 'lucide-react';
import { Card, Button } from '../../components/ui';
import { cn } from '../../utils';
import { useAuthStore } from '../../store/authStore';
import { nexus } from '../../lib/nexus';

interface AuthorApplicationRecord {
  id: string;
  userId: string;
  userEmail: string;
  penName: string;
  category: string;
  agreedToTerms: boolean;
  status: 'pending' | 'approved' | 'denied';
  submittedAt: string;
  rejectionReason?: string;
}

const ManagementDashboard = () => {
  const navigate = useNavigate();
  const { user, updateProfile } = useAuthStore();
  const [applications, setApplications] = useState<AuthorApplicationRecord[]>([]);

  const fetchApplications = async () => {
    try {
      const { data, error } = await nexus.database
        .from('author_applications')
        .select('*')
        .order('submitted_at', { ascending: false });

      if (data && !error) {
        setApplications(data.map((d: any) => ({
          id: d.id,
          userId: d.user_id,
          userEmail: d.user_email,
          penName: d.pen_name,
          category: d.category,
          agreedToTerms: d.agreed_to_terms,
          status: d.status,
          submittedAt: d.submitted_at,
          rejectionReason: d.rejection_reason || undefined
        })));
      }
    } catch (e) {
      console.error('[Error fetching admin applications]:', e);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, []);

  const handleDecideApplication = async (appId: string, status: 'approved' | 'denied') => {
    const targetApp = applications.find(app => app.id === appId);
    if (!targetApp) return;

    try {
      // 1. Update application status in database
      const { error } = await nexus.database
        .from('author_applications')
        .update({ status })
        .eq('id', appId);

      if (error) throw error;

      // 2. Elevate user role or metadata if approved
      if (status === 'approved') {
        const { data: userProfile, error: profileErr } = await nexus.database
          .from('profiles')
          .select('metadata, role')
          .eq('id', targetApp.userId)
          .single();

        if (userProfile && !profileErr) {
          const currentMetadata = userProfile.metadata || {};
          const updatedMetadata = {
            ...currentMetadata,
            is_author: true,
            author_profile: {
              name: targetApp.penName,
              category: targetApp.category,
              approvedAt: new Date().toISOString()
            }
          };

          // Update profiles database directly
          await nexus.database
            .from('profiles')
            .update({
              role: 'mentor',
              metadata: updatedMetadata
            })
            .eq('id', targetApp.userId);

          // If current logged-in user, sync store state
          if (targetApp.userId === user?.id) {
            await updateProfile({
              role: 'mentor',
              metadata: updatedMetadata
            });
          }
        }
      } else {
        const { data: userProfile } = await nexus.database
          .from('profiles')
          .select('metadata')
          .eq('id', targetApp.userId)
          .single();

        if (userProfile) {
          const currentMetadata = userProfile.metadata || {};
          const { is_author, author_profile, ...cleanedMetadata } = currentMetadata;

          await nexus.database
            .from('profiles')
            .update({
              metadata: cleanedMetadata
            })
            .eq('id', targetApp.userId);

          if (targetApp.userId === user?.id) {
            await updateProfile({
              metadata: cleanedMetadata
            });
          }
        }
      }

      await fetchApplications();

      // Trigger toast notification
      const notificationEvent = new CustomEvent('show-notification', {
        detail: { 
          message: `Author application for "${targetApp.penName}" was ${status}!`, 
          type: status === 'approved' ? 'success' : 'info' 
        }
      });
      window.dispatchEvent(notificationEvent);
    } catch (e: any) {
      console.error(e);
      alert('Failed to update application decision: ' + (e.message || e));
    }
  };

  const pendingApps = applications.filter(app => app.status === 'pending');

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex justify-between items-center px-2">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Platform Audit Command</h1>
          <p className="text-slate-500 font-medium text-lg mt-1">Real-time oversight of global Trileza operations.</p>
        </div>
        <div className="flex gap-4">
          <Button variant="outline" className="gap-2 rounded-2xl h-14 px-6 border-slate-200">
            <FileCheck size={18} /> Export Report
          </Button>
          <Button 
            onClick={() => navigate('/settings')}
            className="gap-2 bg-brand-primary hover:bg-brand-primary-hover text-white border-none shadow-xl shadow-emerald-500/20 rounded-2xl h-14 px-8 font-black uppercase text-[10px] tracking-widest transition-all">
            Global Settings
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {[
          { label: 'Active Students', value: '1,280', grow: '+24%', icon: Users, color: 'text-brand-primary', bg: 'bg-emerald-50', path: '/audit/students' },
          { label: 'Course Pipeline', value: '42', grow: '+12%', icon: BookOpen, color: 'text-brand-primary', bg: 'bg-emerald-50', path: '/audit/courses' },
          { label: 'Pending Approvals', value: '18', grow: '-2', icon: AlertCircle, color: 'text-orange-500', bg: 'bg-orange-50', path: '/audit/approvals' },
          { label: 'Platform Health', value: '99.9%', grow: 'Stable', icon: ShieldCheck, color: 'text-brand-primary', bg: 'bg-emerald-50', path: '/audit/health' },
        ].map((stat, i) => (
          <Card 
            key={i} 
            onClick={() => navigate(stat.path)}
            className="group flex flex-col justify-between p-8 border-none ring-1 ring-slate-100 shadow-sm hover:shadow-2xl hover:ring-brand-primary/20 hover:translate-y-[-4px] transition-all duration-500 cursor-pointer rounded-[2.5rem]"
          >
            <div className="flex justify-between items-start">
              <div className={cn("p-4 rounded-2xl transition-all duration-500 group-hover:scale-110 group-hover:rotate-6 shadow-sm", stat.bg, stat.color)}>
                <stat.icon size={24} strokeWidth={2.5} />
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={cn("text-[10px] font-black px-3 py-1.5 rounded-xl uppercase tracking-widest", stat.bg, stat.color)}>
                  {stat.grow}
                </span>
                <div className="opacity-0 group-hover:opacity-100 transition-all duration-500 transform translate-x-2 group-hover:translate-x-0">
                  <ArrowUpRight size={14} className={stat.color} />
                </div>
              </div>
            </div>
            <div className="mt-8">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{stat.label}</p>
              <p className="text-4xl font-black mt-2 tabular-nums text-slate-900 group-hover:text-brand-primary transition-colors">{stat.value}</p>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Card 1: Content Moderation Queue */}
        <Card className="p-0 overflow-hidden border-none shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] rounded-[3rem] bg-white group">
          <div className="p-8 border-b border-slate-50 flex items-center justify-between">
             <div className="flex items-center gap-4">
                <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse shadow-lg shadow-red-500/50" />
                <h3 className="text-xl font-black text-slate-900 tracking-tight">Content Moderation Queue</h3>
             </div>
             <Button variant="outline" size="sm" className="rounded-xl px-4 text-[10px] font-black uppercase border-slate-200">Refresh</Button>
          </div>
          <div className="divide-y divide-slate-50">
            {[
              { title: 'Intro to Web3', tutor: 'Sarah Khan', date: '2h ago', status: 'Flagged' },
              { title: 'Mastering Figma', tutor: 'John Doe', date: '5h ago', status: 'Review' },
              { title: 'Py-Data Engine', tutor: 'Bisi A.', date: '1d ago', status: 'Review' },
              { title: 'Social Marketing', tutor: 'Alex R.', date: '2d ago', status: 'Flagged' },
            ].map((item, i) => (
              <div key={i} className="p-8 flex items-center justify-between hover:bg-slate-50/50 cursor-pointer transition-all duration-300 group/item" onClick={() => navigate('/audit/courses')}>
                <div className="flex gap-6">
                  <div className={cn("w-1.5 h-12 rounded-full transition-all duration-500 group-hover/item:h-14", item.status === 'Flagged' ? 'bg-red-400' : 'bg-brand-primary')} />
                  <div>
                    <h4 className="font-bold text-lg tracking-tight text-slate-800 group-hover/item:text-brand-primary transition-colors">{item.title}</h4>
                    <p className="text-[11px] text-slate-400 mt-1 font-bold uppercase tracking-widest">by {item.tutor} • {item.date}</p>
                  </div>
                </div>
                <MoreVertical size={18} className="text-slate-200 group-hover/item:text-slate-400 transition-colors" />
              </div>
            ))}
          </div>
          <div className="p-8 bg-slate-50/50 text-center border-t border-slate-50 transition-colors hover:bg-slate-100/50">
            <button className="text-[11px] font-black text-brand-primary uppercase tracking-[0.3em] hover:underline transition-all" onClick={() => navigate('/audit/courses')}>Launch Audit Panel (14)</button>
          </div>
        </Card>

        {/* Card 2: Author Application Requests Queue [NEW] */}
        <Card className="p-0 overflow-hidden border-none shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] rounded-[3rem] bg-white group/author">
          <div className="p-8 border-b border-slate-50 flex items-center justify-between">
             <div className="flex items-center gap-4">
                <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse shadow-lg shadow-emerald-500/50" />
                <h3 className="text-xl font-black text-slate-900 tracking-tight">Author Requests Queue</h3>
             </div>
             <span className="text-[10px] font-black uppercase tracking-wider px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-xl">
               {pendingApps.length} Pending
             </span>
          </div>

          <div className="divide-y divide-slate-50 min-h-[300px] flex flex-col justify-start">
            {pendingApps.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 shadow-inner">
                  <UserCheck size={28} />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-base text-slate-700">Queue Synchronized</h4>
                  <p className="text-xs font-medium text-slate-400 max-w-xs">
                    All publisher applications are processed. No pending review requirements.
                  </p>
                </div>
              </div>
            ) : (
              pendingApps.map((app) => (
                <div key={app.id} className="p-8 flex items-center justify-between hover:bg-slate-50/50 transition-all duration-300 group/app-item">
                  <div className="flex gap-6 min-w-0">
                    <div className="w-1.5 h-12 rounded-full bg-emerald-400 transition-all duration-500 group-hover/app-item:h-14" />
                    <div className="min-w-0">
                      <h4 className="font-bold text-lg tracking-tight text-slate-800 truncate">{app.penName}</h4>
                      <p className="text-[11px] text-slate-450 mt-1 font-bold uppercase tracking-widest truncate">
                        {app.category} • {app.userEmail}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    {/* Approve Button */}
                    <button
                      onClick={() => handleDecideApplication(app.id, 'approved')}
                      className="w-10 h-10 rounded-xl bg-emerald-50 hover:bg-emerald-500 text-emerald-600 hover:text-white flex items-center justify-center transition-all shadow-sm border border-emerald-100/50"
                      title="Approve Author"
                    >
                      <Check size={16} strokeWidth={3} />
                    </button>
                    {/* Deny Button */}
                    <button
                      onClick={() => handleDecideApplication(app.id, 'denied')}
                      className="w-10 h-10 rounded-xl bg-rose-50 hover:bg-rose-500 text-rose-600 hover:text-white flex items-center justify-center transition-all shadow-sm border border-rose-100/50"
                      title="Deny Request"
                    >
                      <X size={16} strokeWidth={3} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="p-8 bg-slate-50/50 text-center border-t border-slate-50 transition-colors hover:bg-slate-100/50 mt-auto">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">
              Trileza Global Publishing Network
            </span>
          </div>
        </Card>
      </div>

      {/* Row 2: Infrastructure Logs */}
      <div className="grid grid-cols-1 gap-8">
        <Card className="p-10 rounded-[3rem] border-none shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] bg-slate-900 text-white relative overflow-hidden group">
           <div className="relative z-10">
              <h3 className="text-2xl font-black mb-8 tracking-tight">Infrastructure Logs</h3>
              <div className="space-y-6">
                {[
                  { msg: 'Database node synchronized successfully', time: 'Just now', type: 'success' },
                  { msg: 'New management entity authenticated', time: '12m ago', type: 'info' },
                  { msg: 'Unusual traffic detected on node #940', time: '45m ago', type: 'warning' },
                ].map((log, i) => (
                  <div key={i} className="flex gap-4 group/log cursor-default">
                    <div className={cn(
                      "w-1.5 h-1.5 rounded-full mt-2 ring-4 ring-offset-4 ring-offset-slate-900 transition-all duration-500 group-hover/log:scale-150",
                      log.type === 'success' ? 'bg-emerald-500 ring-emerald-500/20' : 
                      log.type === 'warning' ? 'bg-red-400 ring-red-400/20' : 'bg-blue-400 ring-blue-400/20'
                    )} />
                    <div>
                      <p className="text-sm font-bold text-slate-200 group-hover/log:text-white transition-colors">{log.msg}</p>
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">{log.time}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Button className="mt-12 w-full bg-white/10 hover:bg-white/20 text-white border-none rounded-2xl h-14 font-black uppercase tracking-widest text-[10px]" onClick={() => navigate('/analytics')}>Open Stream Dashboard</Button>
           </div>
           <div className="absolute top-0 right-0 w-64 h-64 bg-brand-primary/10 rounded-full blur-[100px]" />
        </Card>
      </div>
    </div>
  );
};

export default ManagementDashboard;
