import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import type { AdminRole } from '../../types/admin';
import { cn } from '../../utils';
import { 
  ShieldAlert, 
  BookOpen, 
  Users, 
  DollarSign, 
  LifeBuoy, 
  Scale, 
  BarChart3, 
  LogOut,
  ChevronRight,
  ShieldAlert as ShieldIcon
} from 'lucide-react';

interface AdminLayoutProps {
  currentRole: AdminRole;
  onRoleChange: (role: AdminRole) => void;
  children: React.ReactNode;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ currentRole, onRoleChange, children }) => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const roleMeta: Record<AdminRole, { label: string; icon: any; color: string; bg: string }> = {
    super_admin: { label: 'Super Admin', icon: ShieldAlert, color: 'text-red-700', bg: 'bg-red-50 border-red-200/50' },
    content_manager: { label: 'Content Manager', icon: BookOpen, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200/50' },
    user_manager: { label: 'User Manager', icon: Users, color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200/50' },
    finance_admin: { label: 'Finance Admin', icon: DollarSign, color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200/50' },
    support_agent: { label: 'Support Agent', icon: LifeBuoy, color: 'text-cyan-700', bg: 'bg-cyan-50 border-cyan-200/50' },
    compliance_officer: { label: 'Compliance Officer', icon: Scale, color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200/50' },
    analytics_viewer: { label: 'Analytics Viewer', icon: BarChart3, color: 'text-slate-650', bg: 'bg-slate-50 border-slate-200/50' },
  };

  const currentMeta = roleMeta[currentRole];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex font-sans">
      
      {/* ── Sidebar Navigation ── */}
      <aside className="w-80 bg-white border-r border-slate-200/80 flex flex-col justify-between shrink-0 relative z-30 shadow-sm">
        
        <div className="flex flex-col flex-1">
          {/* Brand/Header */}
          <div className="p-6 border-b border-slate-200/80 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center font-black text-white text-lg shadow-lg shadow-emerald-500/10">
                T
              </div>
              <div>
                <h1 className="font-black text-lg tracking-tight uppercase text-slate-900">Trileza Admin</h1>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Operational Node</p>
              </div>
            </div>
          </div>

          {/* Active Admin Identity */}
          <div className="p-6 border-b border-slate-100 bg-slate-50/20">
            <div className="flex items-center gap-4">
              <img 
                src={user?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.full_name || 'Admin'}`} 
                className="w-12 h-12 rounded-2xl border border-slate-200 bg-slate-100 object-cover shadow-inner" 
                alt="Avatar" 
              />
              <div className="min-w-0 flex-1 text-left">
                <p className="font-extrabold text-sm text-slate-900 truncate">{user?.full_name}</p>
                <p className="text-[11px] text-slate-500 font-bold truncate mt-0.5">{user?.email}</p>
                <span className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider mt-2 border",
                  currentMeta.color,
                  currentMeta.bg
                )}>
                  {currentMeta.label}
                </span>
              </div>
            </div>
          </div>

          {/* Menu Sections */}
          <nav className="flex-1 p-6 space-y-6 overflow-y-auto no-scrollbar">
            <div className="space-y-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-3 mb-3">Management Queues</p>
              
              <button
                onClick={() => navigate('/admin')}
                className="w-full flex items-center justify-between px-3 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-bold text-xs hover:bg-slate-100 transition-all text-left"
              >
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-lg text-white bg-green-600 shadow-sm")}>
                    <currentMeta.icon size={16} />
                  </div>
                  <span>{currentMeta.label} deck</span>
                </div>
                <ChevronRight size={14} className="text-slate-400" />
              </button>
            </div>

            {/* Quick SLA parameters */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-4">
              <p className="text-[10px] font-black text-slate-450 uppercase tracking-widest">SLA Requirements</p>
              <div className="text-xs text-slate-600 space-y-2.5 leading-relaxed">
                {currentRole === 'content_manager' && (
                  <p>📖 Review submitted Courses and Books within <strong className="text-amber-600 font-black">48 hours</strong> according to quality checklists.</p>
                )}
                {currentRole === 'user_manager' && (
                  <p>🧑‍🏫 Audit and verify Mentor applications & qualifications within <strong className="text-emerald-600 font-black">72 hours</strong>.</p>
                )}
                {currentRole === 'finance_admin' && (
                  <p>💰 Process large vendor withdrawals (&gt;₦500k) within <strong className="text-indigo-650 font-black">48 hours</strong>. Small payouts auto-approve.</p>
                )}
                {currentRole === 'support_agent' && (
                  <p>🎫 Ticket Response times:<br />
                    • <span className="text-red-650 font-black">Urgent: 1hr</span> (hide immediately)<br />
                    • High: 24hrs | Med: 3d | Low: 7d</p>
                )}
                {currentRole === 'compliance_officer' && (
                  <p>⚖️ Review terms violations, copyright claims (DMCA), and execute GDPR user deletion requests.</p>
                )}
                {currentRole === 'super_admin' && (
                  <p>🛠️ Complete system oversight, audit trails logging, RBAC user assignment, and infrastructure status check.</p>
                )}
                {currentRole === 'analytics_viewer' && (
                  <p>📈 Read-only business intelligence metrics, platform financials, and user demographics charts.</p>
                )}
              </div>
            </div>
          </nav>
        </div>

        {/* ── Bottom Role Switcher & Sign Out ── */}
        <div className="p-6 border-t border-slate-200/80 space-y-4 bg-slate-50/30">
          
          <div className="space-y-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">Dev RBAC Switcher</p>
            <select
              value={currentRole}
              onChange={(e) => onRoleChange(e.target.value as AdminRole)}
              className="w-full bg-white border border-slate-200 text-xs font-bold rounded-xl p-3 outline-none text-slate-700 focus:ring-2 focus:ring-emerald-500/20 shadow-sm"
            >
              <option value="super_admin">🔧 Super Admin</option>
              <option value="content_manager">📚 Content Manager</option>
              <option value="user_manager">🧑‍🤝‍🧑 User Manager</option>
              <option value="finance_admin">💰 Finance Admin</option>
              <option value="support_agent">🎫 Support Agent</option>
              <option value="compliance_officer">⚖️ Compliance Officer</option>
              <option value="analytics_viewer">📈 Analytics Viewer</option>
            </select>
          </div>

          <button
            onClick={() => logout()}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-200 hover:border-red-200 hover:bg-red-50 text-slate-650 hover:text-red-600 font-bold text-xs uppercase tracking-wider transition-all"
          >
            <LogOut size={14} />
            <span>Sign Out Session</span>
          </button>
        </div>

      </aside>

      {/* ── Main Content Area ── */}
      <main className="flex-1 min-w-0 h-screen overflow-y-auto bg-slate-50 relative">
        <div className="absolute top-0 left-0 right-0 h-[400px] bg-gradient-to-b from-white via-transparent to-transparent pointer-events-none z-0" />
        <div className="absolute top-10 right-10 w-96 h-96 bg-emerald-500/2 rounded-full blur-[120px] pointer-events-none z-0" />
        
        <div className="relative z-10 p-6 sm:p-8 md:p-10 max-w-7xl mx-auto space-y-8">
          {children}
        </div>
      </main>

    </div>
  );
};

export default AdminLayout;
