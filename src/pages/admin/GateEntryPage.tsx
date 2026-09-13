import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Card } from '../../components/ui';
import { 
  BookOpen, 
  Users, 
  DollarSign, 
  LifeBuoy, 
  Scale, 
  BarChart3, 
  ShieldAlert, 
  ArrowRight 
} from 'lucide-react';
import { cn } from '../../utils';

interface RoleContainer {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: any;
  color: string;
  bg: string;
  border: string;
  shadow: string;
}

const ROLES: RoleContainer[] = [
  {
    id: 'super_admin',
    slug: 'superadmin',
    name: 'Super Admin',
    description: 'Root supervisor console. Platform configuration, global metrics, multi-tenant management, and audit logs.',
    icon: ShieldAlert,
    color: 'text-red-400',
    bg: 'from-red-950/25 to-red-900/10',
    border: 'border-red-500/20 hover:border-red-500/50',
    shadow: 'hover:shadow-red-500/15'
  },
  {
    id: 'content_manager',
    slug: 'content-manager',
    name: 'Content Manager',
    description: 'Review and approve syllabus, course submissions, publication materials, and flag violations.',
    icon: BookOpen,
    color: 'text-amber-500',
    bg: 'from-amber-950/20 to-amber-900/10',
    border: 'border-amber-500/20 hover:border-amber-500/40',
    shadow: 'hover:shadow-amber-500/5'
  },
  {
    id: 'user_manager',
    slug: 'user-manager',
    name: 'User Manager',
    description: 'Audit and approve mentor credentials, verify account status, and enforce user suspensions.',
    icon: Users,
    color: 'text-emerald-500',
    bg: 'from-emerald-950/20 to-emerald-900/10',
    border: 'border-emerald-500/20 hover:border-emerald-500/40',
    shadow: 'hover:shadow-emerald-500/5'
  },
  {
    id: 'finance_admin',
    slug: 'finance-admin',
    name: 'Finance Admin',
    description: 'Process tutor withdraws, audit platform transaction ledgers, and manage refunds.',
    icon: DollarSign,
    color: 'text-indigo-500',
    bg: 'from-indigo-950/20 to-indigo-900/10',
    border: 'border-indigo-500/20 hover:border-indigo-500/40',
    shadow: 'hover:shadow-indigo-500/5'
  },
  {
    id: 'support_agent',
    slug: 'support-agent',
    name: 'Support Agent',
    description: 'Handle student/tutor tickets, response queues, and live help requests.',
    icon: LifeBuoy,
    color: 'text-cyan-500',
    bg: 'from-cyan-950/20 to-cyan-900/10',
    border: 'border-cyan-500/20 hover:border-cyan-500/40',
    shadow: 'hover:shadow-cyan-500/5'
  },
  {
    id: 'compliance_officer',
    slug: 'compliance-officer',
    name: 'Compliance Officer',
    description: 'Investigate copyright claims, legal terms disputes, and user deletion requests.',
    icon: Scale,
    color: 'text-purple-500',
    bg: 'from-purple-950/20 to-purple-900/10',
    border: 'border-purple-500/20 hover:border-purple-500/40',
    shadow: 'hover:shadow-purple-500/5'
  },
  {
    id: 'analytics_viewer',
    slug: 'analytics-viewer',
    name: 'Analytics Viewer',
    description: 'Examine business intelligence metrics, platform financials, and usage analytics.',
    icon: BarChart3,
    color: 'text-slate-400',
    bg: 'from-slate-800/20 to-slate-900/10',
    border: 'border-slate-700/30 hover:border-slate-600/40',
    shadow: 'hover:shadow-slate-500/5'
  }
];

export default function GateEntryPage() {
  const navigate = useNavigate();
  const { adminSessionToken, user } = useAuthStore();

  const handleRoleClick = (role: RoleContainer) => {
    if (adminSessionToken || user) {
      navigate(`/${role.slug}`);
    } else {
      navigate(`/signin?role=${role.id}`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-between relative overflow-hidden font-sans py-16 px-6">
      {/* Sleek aesthetic background elements */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[160px] pointer-events-none" />

      {/* Header */}
      <div className="max-w-6xl w-full mx-auto text-center space-y-4 z-10">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 font-extrabold text-xs uppercase tracking-widest animate-pulse">
          🛡️ SECURE OPERATION CENTER
        </div>
        <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white uppercase">
          Trileza Admin <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">Gate</span>
        </h1>
        <p className="text-sm sm:text-base text-slate-400 max-w-xl mx-auto font-medium leading-relaxed">
          Select a departmental portal container to login and manage operations.
        </p>
      </div>

      {/* Role Grid */}
      <div className="max-w-6xl w-full mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 my-12 z-10">
        {ROLES.map((role) => {
          const Icon = role.icon;
          return (
            <Card
              key={role.id}
              onClick={() => handleRoleClick(role)}
              className={cn(
                "p-8 rounded-[2rem] border bg-gradient-to-b cursor-pointer transition-all duration-300 group flex flex-col justify-between hover:-translate-y-1 bg-slate-900/60 backdrop-blur-xl shadow-lg",
                role.bg,
                role.border,
                role.shadow
              )}
            >
              <div className="space-y-4">
                <div className={cn("w-12 h-12 rounded-2xl bg-slate-950 flex items-center justify-center border border-slate-800 transition-transform duration-300 group-hover:scale-110", role.color)}>
                  <Icon size={22} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-black text-white group-hover:text-emerald-400 transition-colors uppercase tracking-tight">
                    {role.name}
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed font-medium">
                    {role.description}
                  </p>
                </div>
              </div>

              <div className="mt-8 flex items-center justify-between text-xs font-bold text-slate-500 group-hover:text-emerald-400 transition-colors pt-4 border-t border-slate-800/40">
                <span>Access portal</span>
                <ArrowRight size={14} className="transform transition-transform duration-300 group-hover:translate-x-1" />
              </div>
            </Card>
          );
        })}
      </div>

      {/* Footer */}
      <div className="text-center z-10">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">
          Trileza learning management suite • Operations portal v2.10
        </p>
      </div>
    </div>
  );
}
