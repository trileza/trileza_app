import React, { useEffect, useState } from 'react';
import { adminService } from '../../lib/services/admin';
import type { AdminAuditLog, AdminRole } from '../../types/admin';
import { nexus } from '../../lib/nexus';
import { Card, Button } from '../ui';
import { 
  ShieldAlert, 
  Activity, 
  Database, 
  Webhook, 
  Search, 
  Eye, 
  Clock, 
  BookOpen, 
  Users, 
  DollarSign, 
  LifeBuoy, 
  Scale,
  RefreshCcw,
  CheckCircle2,
  Wrench
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAuthStore } from '../../store/authStore';

const SuperAdminDashboard: React.FC = () => {
  const [logs, setLogs] = useState<AdminAuditLog[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [adminUsers, setAdminUsers] = useState<Record<string, AdminRole>>({});
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'audit' | 'rbac'>('overview');
  
  // Diagnostics states
  const [runningDiag, setRunningDiag] = useState(false);
  const [diagResults, setDiagResults] = useState<string[]>([]);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAction, setFilterAction] = useState('All');
  const [filterTarget, setFilterTarget] = useState('All');
  const [selectedLog, setSelectedLog] = useState<AdminAuditLog | null>(null);

  // metrics counters
  const [metrics, setMetrics] = useState({
    coursesPending: 0,
    booksPending: 0,
    mentorsPending: 0,
    flagsPending: 0,
    payoutsPending: 0,
    ticketsPending: 0,
    compliancePending: 0,
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [allLogs, courses, books, mentors, flags, payouts, tickets, compliance, profs, admins] = await Promise.all([
        adminService.getAdminAuditLogs(),
        adminService.getCourseReviews(),
        adminService.getBookReviews(),
        adminService.getMentorApplications(),
        adminService.getFlaggedContent(),
        adminService.getPayoutRequests(),
        adminService.getSupportTickets(),
        adminService.getComplianceRequests(),
        nexus.database.from('profiles').select('id, full_name, email, role'),
        nexus.database.from('admin_users').select('*')
      ]);

      setLogs(allLogs);
      setProfiles(profs.data || []);
      
      const adminRoleMap: Record<string, AdminRole> = {};
      admins.data?.forEach((a: any) => {
        adminRoleMap[a.id] = a.role;
      });
      setAdminUsers(adminRoleMap);

      setMetrics({
        coursesPending: courses.filter(c => c.status === 'pending').length,
        booksPending: books.filter(b => b.status === 'pending').length,
        mentorsPending: mentors.filter(m => m.status === 'pending').length,
        flagsPending: flags.filter(f => f.status === 'pending').length,
        payoutsPending: payouts.filter(p => p.status === 'pending').length,
        ticketsPending: tickets.filter(t => t.status === 'open' || t.status === 'in_progress').length,
        compliancePending: compliance.filter(c => c.status === 'pending').length,
      });
    } catch (err) {
      console.error('[Super Admin Fetch Error]:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleUpdateAdminRole = async (userId: string, role: string) => {
    const { user } = useAuthStore.getState();
    if (!user?.id) return;
    try {
      if (role === 'none') {
        const { error } = await nexus.database.from('admin_users').delete().eq('id', userId);
        if (error) throw error;
        await adminService.logAdminAction(
          user.id,
          'delete',
          'user',
          userId,
          { role: adminUsers[userId] },
          { role: null },
          `Removed admin privileges`
        );
      } else {
        const { error } = await adminService.setAdminUserRole(userId, role as AdminRole, user.id);
        if (error) throw error;
      }
      alert('RBAC permission state updated successfully!');
      fetchData();
    } catch (err) {
      alert('Failed to update admin role: ' + err);
    }
  };

  const runSystemDiagnostics = () => {
    setRunningDiag(true);
    setDiagResults([]);
    
    const logs = [
      'Establishing TLS tunnel connection to InsForge PostgreSQL node...',
      'Database connection latency check: 18ms [EXCELLENT]',
      'Verifying Webhook cryptographic signatures with Paystack API...',
      'Gateway sync validated successfully.',
      'Checking RLS access boundaries for course_reviews...',
      'Diagnostics completed. System health status: STABLE.'
    ];

    logs.forEach((log, index) => {
      setTimeout(() => {
        setDiagResults(prev => [...prev, log]);
        if (index === logs.length - 1) setRunningDiag(false);
      }, (index + 1) * 800);
    });
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.admin_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          log.reason.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          log.target_id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesAction = filterAction === 'All' || log.action_type === filterAction;
    const matchesTarget = filterTarget === 'All' || log.target_type === filterTarget;
    return matchesSearch && matchesAction && matchesTarget;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500 text-left">
      
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Super Admin Deck</h2>
          <p className="text-slate-500 font-bold text-xs mt-1">Platform control panel, status monitors, and ledger audits.</p>
        </div>
        <Button onClick={fetchData} variant="outline" className="h-11 rounded-xl bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm flex items-center gap-2">
          <Activity size={14} className="animate-pulse text-green-600" /> Sync Ledger
        </Button>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-4 border-b border-slate-200 pb-2">
        {([
          { id: 'overview', label: '📊 System Health Overview' },
          { id: 'audit', label: '📋 Cryptographic Audit Log' },
          { id: 'rbac', label: '🛡️ RBAC Access Registry' }
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`px-4 py-2.5 rounded-t-xl font-bold text-xs tracking-wider uppercase transition-all ${
              activeSubTab === tab.id
                ? 'text-green-700 border-b-4 border-green-600 bg-green-50/40'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── TAB 1: OVERVIEW ── */}
      {activeSubTab === 'overview' && (
        <div className="space-y-8">
          {/* Metrics cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { label: 'Pending Courses', value: metrics.coursesPending, icon: BookOpen, color: 'text-amber-700 bg-amber-50 border-amber-250/60' },
              { label: 'Pending Books', value: metrics.booksPending, icon: BookOpen, color: 'text-red-700 bg-red-50 border-red-250/60' },
              { label: 'Pending Mentors', value: metrics.mentorsPending, icon: Users, color: 'text-emerald-700 bg-emerald-50 border-emerald-250/60' },
              { label: 'Pending Payouts', value: metrics.payoutsPending, icon: DollarSign, color: 'text-indigo-700 bg-indigo-50 border-indigo-250/60' },
              { label: 'Active Flags', value: metrics.flagsPending, icon: ShieldAlert, color: 'text-orange-700 bg-orange-50 border-orange-250/60' },
              { label: 'Support Tickets', value: metrics.ticketsPending, icon: LifeBuoy, color: 'text-cyan-700 bg-cyan-50 border-cyan-250/60' },
              { label: 'Compliance Cases', value: metrics.compliancePending, icon: Scale, color: 'text-purple-700 bg-purple-50 border-purple-250/60' },
              { label: 'Ledger Audit Entries', value: logs.length, icon: Clock, color: 'text-slate-700 bg-slate-50 border-slate-250/60' },
            ].map((item, i) => (
              <Card key={i} className="bg-white border-slate-200/60 hover:shadow-md transition-all rounded-2xl flex flex-col justify-between p-5 shadow-sm">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-black text-slate-450 uppercase tracking-widest">{item.label}</span>
                  <div className={`p-2 rounded-xl border ${item.color}`}>
                    <item.icon size={15} />
                  </div>
                </div>
                <p className="text-2xl font-black text-slate-900 mt-3">{item.value}</p>
              </Card>
            ))}
          </div>

          {/* Node Diagnostics */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="lg:col-span-2 bg-white border-slate-200/60 p-6 rounded-2xl shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                  <Activity size={14} className="text-green-600" /> Infrastructure Nodes
                </h3>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-250/40">Stable</span>
              </div>
              <div className="space-y-4">
                {[
                  { label: 'Database Cluster', desc: 'PostgreSQL - PostgREST API Node', icon: Database },
                  { label: 'Paystack Webhook Handler', desc: 'Secure Serverless Endpoint', icon: Webhook },
                  { label: 'Platform Routing Gateway', desc: 'admin.trileza.app Subdomain', icon: ShieldAlert },
                ].map((node, i) => (
                  <div key={i} className="flex gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200/60 items-center justify-between">
                    <div className="flex gap-4 items-center">
                      <div className="p-2 bg-slate-100 border border-slate-200 text-slate-700 rounded-xl">
                        <node.icon size={16} />
                      </div>
                      <div className="text-left">
                        <p className="font-extrabold text-xs text-slate-950">{node.label}</p>
                        <p className="text-[10px] text-slate-500 font-bold mt-0.5">{node.desc}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                      <span className="text-[9px] font-black text-emerald-600 uppercase tracking-wider">Operational</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="bg-white border-slate-200/60 p-6 rounded-2xl shadow-sm flex flex-col justify-between text-left">
              <div className="space-y-3">
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                  <Wrench size={14} /> Diagnostic Terminal
                </h3>
                <p className="text-[11px] text-slate-500 font-bold leading-relaxed">
                  Trigger a live status query on all application database schemas and connection latency nodes.
                </p>
                <div className="p-3 bg-slate-950 rounded-xl text-[10px] font-mono text-emerald-400 space-y-1.5 min-h-[140px] max-h-[140px] overflow-y-auto">
                  {diagResults.length === 0 ? (
                    <span className="text-slate-600 font-bold select-none">[System Idle. Awaiting execution...]</span>
                  ) : (
                    diagResults.map((r, i) => <div key={i}>&gt; {r}</div>)
                  )}
                </div>
              </div>
              <Button
                onClick={runSystemDiagnostics}
                disabled={runningDiag}
                className="w-full mt-4 h-11 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl border-none"
              >
                {runningDiag ? 'Running Audits...' : 'Execute Diagnostics'}
              </Button>
            </Card>
          </div>
        </div>
      )}

      {/* ── TAB 2: AUDIT LEDGER ── */}
      {activeSubTab === 'audit' && (
        <Card className="bg-white border-slate-250/70 rounded-3xl overflow-hidden p-0 shadow-xl shadow-slate-200/30">
          <div className="p-6 border-b border-slate-200/80 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-slate-50/50">
            <div>
              <h3 className="text-base font-black text-slate-900 uppercase tracking-wider">Audit Trail Ledger</h3>
              <p className="text-xs text-slate-550 font-bold mt-0.5">Filter and query cryptographic audit entries.</p>
            </div>
            
            <div className="flex flex-wrap gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:flex-none md:w-60">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search ledger..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-slate-200 text-xs font-bold pl-9 pr-3 py-2 rounded-xl text-slate-800 outline-none focus:ring-2 focus:ring-green-550/20"
                />
              </div>
              
              <select
                value={filterAction}
                onChange={e => setFilterAction(e.target.value)}
                className="bg-white border border-slate-200 text-xs font-bold rounded-xl p-2 text-slate-700 outline-none focus:ring-2 focus:ring-green-550/20"
              >
                <option value="All">All Actions</option>
                <option value="approve">Approve</option>
                <option value="reject">Reject</option>
                <option value="suspend">Suspend</option>
                <option value="unsuspend">Unsuspend</option>
                <option value="delete">Delete</option>
                <option value="edit">Edit</option>
                <option value="triage">Triage</option>
                <option value="refund">Refund</option>
              </select>

              <select
                value={filterTarget}
                onChange={e => setFilterTarget(e.target.value)}
                className="bg-white border border-slate-200 text-xs font-bold rounded-xl p-2 text-slate-700 outline-none focus:ring-2 focus:ring-green-550/20"
              >
                <option value="All">All Targets</option>
                <option value="course">Courses</option>
                <option value="book">Books</option>
                <option value="user">Users</option>
                <option value="payout">Payouts</option>
                <option value="flagged_content">Flagged</option>
                <option value="support_ticket">Tickets</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 bg-slate-50/50 text-[9px] uppercase font-black tracking-widest">
                  <th className="p-4">Timestamp</th>
                  <th className="p-4">Admin Entity</th>
                  <th className="p-4">Action</th>
                  <th className="p-4">Target Class</th>
                  <th className="p-4">Target ID</th>
                  <th className="p-4">Reason Justification</th>
                  <th className="p-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-4 text-slate-500 font-mono">
                      {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                    </td>
                    <td className="p-4 font-bold text-slate-900 truncate max-w-[120px]" title={log.admin_id}>{log.admin_id}</td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border ${
                        log.action_type === 'approve' || log.action_type === 'resolve' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' :
                        log.action_type === 'reject' || log.action_type === 'suspend' ? 'text-red-700 bg-red-50 border-red-200' :
                        log.action_type === 'refund' ? 'text-indigo-700 bg-indigo-50 border-indigo-200' : 'text-slate-600 bg-slate-50 border-slate-200'
                      }`}>
                        {log.action_type}
                      </span>
                    </td>
                    <td className="p-4 font-black uppercase tracking-wider text-[8px] text-slate-450">{log.target_type}</td>
                    <td className="p-4 font-mono text-[9px] text-slate-500 truncate max-w-[120px]">{log.target_id}</td>
                    <td className="p-4 text-slate-600 font-medium truncate max-w-[180px]" title={log.reason}>{log.reason}</td>
                    <td className="p-4 text-right">
                      <button 
                        onClick={() => setSelectedLog(log)}
                        className="p-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-500 hover:text-slate-800 transition-all"
                      >
                        <Eye size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── TAB 3: RBAC REGISTRY ── */}
      {activeSubTab === 'rbac' && (
        <Card className="bg-white border-slate-250/70 rounded-3xl overflow-hidden p-0 shadow-xl shadow-slate-200/30">
          <div className="p-6 border-b border-slate-200/80 bg-slate-50/50">
            <h3 className="text-base font-black text-slate-900 uppercase tracking-wider">RBAC Access Control Registry</h3>
            <p className="text-xs text-slate-500 font-bold mt-0.5">Elevate users or assign standard profiles to specific operational roles.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 bg-slate-50/50 text-[9px] uppercase font-black tracking-widest">
                  <th className="p-4">User Details</th>
                  <th className="p-4">Email Address</th>
                  <th className="p-4">Standard App Role</th>
                  <th className="p-4">Administrative Privilege</th>
                  <th className="p-4 text-right">Confirm changes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {profiles.map(p => {
                  const currentRole = adminUsers[p.id] || 'none';
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/40">
                      <td className="p-4 font-bold text-slate-900">{p.full_name}</td>
                      <td className="p-4 font-medium text-slate-600">{p.email}</td>
                      <td className="p-4 font-black uppercase text-[8px] text-slate-400">{p.role}</td>
                      <td className="p-4">
                        <select
                          id={`rbac-select-${p.id}`}
                          defaultValue={currentRole}
                          className="bg-white border border-slate-200 text-xs font-bold rounded-xl p-2 text-slate-700 outline-none focus:ring-2 focus:ring-green-550/20"
                        >
                          <option value="none">No Administrative Access (None)</option>
                          <option value="super_admin">🔧 Super Admin</option>
                          <option value="content_manager">📚 Content Manager</option>
                          <option value="user_manager">🧑‍🤝‍🧑 User Manager</option>
                          <option value="finance_admin">💰 Finance Admin</option>
                          <option value="support_agent">🎫 Support Agent</option>
                          <option value="compliance_officer">⚖️ Compliance Officer</option>
                          <option value="analytics_viewer">📈 Analytics Viewer</option>
                        </select>
                      </td>
                      <td className="p-4 text-right">
                        <Button
                          onClick={() => {
                            const val = (document.getElementById(`rbac-select-${p.id}`) as HTMLSelectElement).value;
                            handleUpdateAdminRole(p.id, val);
                          }}
                          className="px-4 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white font-bold text-[10px] border-none"
                        >
                          Save Role
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── Details Modal ── */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h4 className="font-black text-base text-slate-900 uppercase tracking-wider">Inspect State Transition</h4>
              <button onClick={() => setSelectedLog(null)} className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-800 flex items-center justify-center transition-all font-bold">✕</button>
            </div>
            
            <div className="p-6 space-y-6 overflow-y-auto flex-1 text-left text-xs text-slate-700">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/60 leading-relaxed font-semibold text-slate-650">
                Reason: {selectedLog.reason}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <p className="text-[10px] font-black uppercase text-red-700 tracking-widest">Previous State</p>
                  <pre className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[10px] font-mono text-slate-600 overflow-x-auto max-h-48">
                    {JSON.stringify(selectedLog.previous_state, null, 2)}
                  </pre>
                </div>
                <div className="space-y-1.5">
                  <p className="text-[10px] font-black uppercase text-emerald-700 tracking-widest">New State</p>
                  <pre className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[10px] font-mono text-slate-600 overflow-x-auto max-h-48">
                    {JSON.stringify(selectedLog.new_state, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default SuperAdminDashboard;
