import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import type { AdminRole } from '../../types/admin';
import { cn } from '../../utils';
import { ROLE_SLUGS } from '../../utils/adminRedirect';
import { getGrantedAdminRoles, ALL_ADMIN_ROLES } from '../../utils/adminAuth';
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
  X,
  UserPlus,
  RefreshCw,
} from 'lucide-react';
import { useAdminRealtimeHub } from './hooks/useAdminData';
import Logo from '../shared/Logo';
import { useRoleTheme } from '../../utils/useRoleTheme';

interface AdminLayoutProps {
  currentRole: AdminRole;
  onRoleChange: (role: AdminRole) => void;
  children: React.ReactNode;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ currentRole, onRoleChange, children }) => {
  const { user, adminUser, adminRoles, logoutAdmin } = useAuthStore();
  const { isConnected, eventCount, lastSyncedAt } = useAdminRealtimeHub(true);
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [mobileSwitcherOpen, setMobileSwitcherOpen] = React.useState(false);

  // The console determines the accent here, not the signed-in user's role.
  useRoleTheme(currentRole);

  const roleMeta: Record<AdminRole, { label: string; icon: any; color: string; bg: string }> = {
    super_admin: { label: 'Super Admin', icon: ShieldAlert, color: 'text-red-700', bg: 'bg-red-50 border-red-200/50' },
    content_manager: { label: 'Content Manager', icon: BookOpen, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200/50' },
    user_manager: { label: 'User Manager', icon: Users, color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200/50' },
    finance_admin: { label: 'Finance Admin', icon: DollarSign, color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200/50' },
    support_agent: { label: 'Support Agent', icon: LifeBuoy, color: 'text-cyan-700', bg: 'bg-cyan-50 border-cyan-200/50' },
    compliance_officer: { label: 'Compliance Officer', icon: Scale, color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200/50' },
    analytics_viewer: { label: 'Analytics Viewer', icon: BarChart3, color: 'text-slate-650', bg: 'bg-slate-50 border-slate-200/50' },
  };

  const currentMeta = currentRole ? roleMeta[currentRole] : null;

  // Only offer consoles this admin can actually enter. Advertising the rest
  // just produces an Access Denied screen on click, and hints at capabilities
  // the account does not have. super_admin sees every console.
  const grantedRoles = getGrantedAdminRoles(adminUser);
  const switchableRoles: AdminRole[] = grantedRoles.includes('super_admin')
    ? ALL_ADMIN_ROLES
    : grantedRoles;

  // Safe fallback if role meta is missing (e.g. during state initialization)
  if (!currentMeta) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 text-sm font-bold uppercase tracking-wider">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  // Close sidebar drawer on route navigation
  const handleNavigate = (path: string) => {
    setSidebarOpen(false);
    navigate(path);
  };

  const getNavLinks = () => {
    const slug = ROLE_SLUGS[currentRole] || currentRole;
    const links = [
      { label: 'Dashboard', path: `/${slug}`, icon: roleMeta[currentRole]?.icon || ShieldAlert },
    ];
    if (currentRole === 'super_admin') {
      links.push({ label: 'Admins & Logs', path: '/superadmin/admins', icon: UserPlus });
      links.push({ label: 'Multi-Tenant Platform', path: '/superadmin/tenants', icon: BookOpen });
    }
    return links;
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex font-sans">
      
      {/* ── Mobile Sidebar Backdrop ── */}
      {sidebarOpen && (
        <div 
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden fixed inset-0 bg-slate-950/40 z-40 backdrop-blur-sm transition-all duration-300"
        />
      )}



      {/* ── Sidebar Navigation ── */}
      <aside className={cn(
        "bg-white border-r border-slate-200/80 flex flex-col justify-between shrink-0 w-80 h-screen fixed lg:sticky top-0 left-0 transition-transform duration-300 z-50 shadow-sm lg:translate-x-0 lg:flex relative",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Console identity — the one element that differs between consoles. */}
        <span
          aria-hidden="true"
          className="absolute left-0 top-0 bottom-0 w-1"
          style={{ backgroundColor: 'var(--role-accent)' }}
        />
        
        <div className="flex flex-col flex-1">
          {/* Brand/Header */}
          <div className="p-6 border-b border-slate-200/80 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-3 text-left min-w-0">
              <Logo variant="mark" size="md" to="/gate" />
              <div className="min-w-0">
                <h1 className="font-black text-lg tracking-tight text-slate-900 truncate">Trileza admin</h1>
                <p className="text-[11px] text-slate-450 font-bold tracking-wider">Operations portal</p>
              </div>
            </div>
            {/* Mobile Close Button */}
            <button 
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-colors"
              title="Close Sidebar"
            >
              <X size={18} />
            </button>
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
                
                {/* Live Realtime Status Pill */}
                <div className="flex items-center gap-1.5 mt-2">
                  <span className={cn(
                    "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border",
                    isConnected 
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                      : "bg-amber-50 text-amber-700 border-amber-200"
                  )}>
                    <span className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      isConnected ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                    )} />
                    {isConnected ? "Live Sync Active" : "Connecting..."}
                  </span>
                  {eventCount > 0 && (
                    <span className="text-[9px] font-bold text-slate-400">
                      • {eventCount} {eventCount === 1 ? 'event' : 'events'}
                    </span>
                  )}
                </div>

                {switchableRoles && switchableRoles.length > 1 ? (
                  <div className="mt-2.5">
                    <label className="text-[8px] text-slate-400 font-black uppercase tracking-widest block mb-1">Switch Role</label>
                    <select
                      value={currentRole}
                      onChange={(e) => {
                        const newRole = e.target.value as AdminRole;
                        onRoleChange(newRole);
                        const slug = ROLE_SLUGS[newRole] || newRole;
                        navigate(`/${slug}`);
                      }}
                      className="w-full text-[11px] font-bold bg-slate-100 border border-slate-200 rounded-xl px-2 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                    >
                      {switchableRoles.map((r) => (
                        <option key={r} value={r}>
                          {roleMeta[r]?.label || r}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider mt-2 border"
                    style={{
                      color: 'var(--role-accent)',
                      backgroundColor: 'var(--role-accent-soft)',
                      borderColor: 'var(--role-accent-border)'
                    }}
                  >
                    {currentMeta.label}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Menu Sections */}
          <nav className="flex-1 p-6 space-y-6 overflow-y-auto no-scrollbar">
            <div className="space-y-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-3 mb-3">Management Queues</p>
              
              {getNavLinks().map((link) => {
                const Icon = link.icon;
                const isActive = window.location.pathname === link.path;
                return (
                  <button
                    key={link.path}
                    onClick={() => handleNavigate(link.path)}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-3 rounded-xl font-bold text-xs transition-all text-left border mb-2",
                      isActive 
                        ? "bg-emerald-50 border-emerald-200 text-emerald-900 shadow-sm" 
                        : "bg-slate-50 border-slate-200 text-slate-950 hover:bg-slate-100"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "p-2 rounded-lg text-white shadow-sm",
                        isActive ? "bg-emerald-600" : "bg-slate-600"
                      )}>
                        <Icon size={16} />
                      </div>
                      <span>{link.label}</span>
                    </div>
                    <ChevronRight size={14} className={isActive ? "text-emerald-500" : "text-slate-400"} />
                  </button>
                );
              })}
            </div>

            {/* All Admin Consoles Quick Links */}
            <div className="space-y-1 pt-4 border-t border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-3 mb-3">Your Admin Consoles</p>
              {[
                { role: 'super_admin', label: 'Super Admin', path: '/superadmin', icon: ShieldAlert, color: 'text-red-600' },
                { role: 'content_manager', label: 'Content Manager', path: '/content-manager', icon: BookOpen, color: 'text-amber-600' },
                { role: 'user_manager', label: 'User Manager', path: '/user-manager', icon: Users, color: 'text-emerald-600' },
                { role: 'finance_admin', label: 'Finance Admin', path: '/finance-admin', icon: DollarSign, color: 'text-indigo-600' },
                { role: 'support_agent', label: 'Support Agent', path: '/support-agent', icon: LifeBuoy, color: 'text-cyan-600' },
                { role: 'compliance_officer', label: 'Compliance Officer', path: '/compliance-officer', icon: Scale, color: 'text-purple-600' },
                { role: 'analytics_viewer', label: 'Analytics Viewer', path: '/analytics-viewer', icon: BarChart3, color: 'text-slate-600' },
              ].filter((item) => switchableRoles.includes(item.role as AdminRole)).map((item) => {
                const ItemIcon = item.icon;
                const isSelected = currentRole === item.role;
                return (
                  <button
                    key={item.role}
                    onClick={() => {
                      onRoleChange(item.role as AdminRole);
                      handleNavigate(item.path);
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-bold text-xs transition-all text-left mb-1 cursor-pointer",
                      isSelected 
                        ? "bg-slate-900 text-white shadow-sm" 
                        : "hover:bg-slate-100 text-slate-700 hover:text-slate-900"
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <ItemIcon size={15} className={isSelected ? "text-emerald-400" : item.color} />
                      <span>{item.label}</span>
                    </div>
                    {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                  </button>
                );
              })}
            </div>

            {/* Quick SLA parameters */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-4">
              <p className="text-[10px] font-black text-slate-450 uppercase tracking-widest">SLA Requirements</p>
              <div className="text-xs text-slate-600 space-y-2.5 leading-relaxed text-left">
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

        {/* ── Bottom Actions & Sign Out ── */}
        <div className="p-6 border-t border-slate-200/80 space-y-4 bg-slate-50/30">
          
          <button
            onClick={() => {
              const mainSiteUrl = window.location.hostname.includes('admin')
                ? window.location.origin.replace('admin.', '')
                : '/';
              window.location.href = mainSiteUrl;
            }}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-200 hover:bg-slate-100 hover:border-slate-300 text-slate-655 hover:text-slate-800 font-bold text-xs uppercase tracking-wider transition-all"
          >
            🏠 Return to Learning Deck
          </button>

          <button
            onClick={() => logoutAdmin()}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-200 hover:border-red-200 hover:bg-red-50 text-slate-650 hover:text-red-600 font-bold text-xs uppercase tracking-wider transition-all"
          >
            <LogOut size={14} />
            <span>Sign Out Session</span>
          </button>
        </div>

      </aside>

      {/* ── Main Content Area ── */}
      <main className="flex-1 min-w-0 h-screen overflow-y-auto bg-slate-50 relative pt-4 pb-20 lg:pt-0 lg:pb-0">
        <div className="absolute top-0 left-0 right-0 h-[400px] bg-gradient-to-b from-white via-transparent to-transparent pointer-events-none z-0" />
        <div className="absolute top-10 right-10 w-96 h-96 bg-emerald-500/2 rounded-full blur-[120px] pointer-events-none z-0" />
        
        <div className="relative z-10 p-6 sm:p-8 md:p-10 max-w-[92%] 2xl:max-w-[1550px] mx-auto space-y-8">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation Bar (WhatsApp-style) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-slate-200/80 flex items-center justify-around px-4 z-40 shadow-lg">
        {getNavLinks().map((link) => {
          const Icon = link.icon;
          const isActive = window.location.pathname === link.path;
          return (
            <button
              key={link.path}
              onClick={() => handleNavigate(link.path)}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full py-1 text-[11px] font-bold transition-colors duration-200 touch-target",
                isActive ? "text-emerald-600" : "text-slate-500 hover:text-slate-800"
              )}
            >
              <Icon size={20} className={isActive ? "text-emerald-600" : "text-slate-400"} />
              <span className="mt-1">{link.label}</span>
            </button>
          );
        })}

        {switchableRoles && switchableRoles.length > 1 && (
          <button
            onClick={() => setMobileSwitcherOpen(true)}
            className="flex flex-col items-center justify-center flex-1 h-full py-1 text-[11px] font-bold text-slate-500 hover:text-slate-800 touch-target"
          >
            <RefreshCw size={20} className="text-slate-400" />
            <span className="mt-1">Switch role</span>
          </button>
        )}

        <button
          onClick={() => logoutAdmin()}
          className="flex flex-col items-center justify-center flex-1 h-full py-1 text-[11px] font-bold text-slate-500 hover:text-red-650 touch-target"
        >
          <LogOut size={20} className="text-slate-400" />
          <span className="mt-1">Sign out</span>
        </button>
      </div>

      {/* Mobile Role Switcher Bottom Sheet */}
      {mobileSwitcherOpen && (
        <div className="lg:hidden">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity"
            onClick={() => setMobileSwitcherOpen(false)}
          />
          {/* Bottom Sheet Modal */}
          <div className="mobile-bottom-sheet fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl p-6 z-55 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mb-6" />
            <h2 className="text-lg font-black text-slate-900 mb-4 text-center">Switch role</h2>
            <div className="space-y-2">
              {switchableRoles.map((r) => {
                const isActive = currentRole === r;
                return (
                  <button
                    key={r}
                    onClick={() => {
                      onRoleChange(r);
                      setMobileSwitcherOpen(false);
                      const slug = ROLE_SLUGS[r] || r;
                      navigate(`/${slug}`);
                    }}
                    className={cn(
                      "w-full flex items-center justify-between p-4 rounded-xl font-bold text-sm border text-left transition-all touch-target",
                      isActive 
                        ? "bg-emerald-50 border-emerald-200 text-emerald-900 shadow-sm" 
                        : "bg-slate-50 border-slate-200 text-slate-900"
                    )}
                  >
                    <span>{roleMeta[r]?.label || r}</span>
                    {isActive && <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setMobileSwitcherOpen(false)}
              className="w-full mt-6 h-12 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-sm transition-colors touch-target"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminLayout;
