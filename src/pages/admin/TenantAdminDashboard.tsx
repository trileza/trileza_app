import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui';
import { useTenant } from '../../lib/tenantContext';
import { tenantService } from '../../lib/services/tenants';
import type { Tenant, UserProfile, TenantAnalytics, TenantBilling, Course } from '../../types';
import { BulkUserImportModal } from '../../components/admin/BulkUserImportModal';

export const TenantAdminDashboard: React.FC = () => {
  const { subdomain: routeSubdomain } = useParams<{ subdomain: string }>();
  const { tenant: activeTenant, switchTenantBySubdomain } = useTenant();
  const navigate = useNavigate();

  const [tenant, setTenant] = useState<Tenant>(activeTenant);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'courses' | 'billing' | 'analytics' | 'settings'>('overview');
  const [loading, setLoading] = useState<boolean>(true);

  // Data states
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [courses, setCourses] = useState<Partial<Course>[]>([]);
  const [analytics, setAnalytics] = useState<TenantAnalytics | null>(null);
  const [billing, setBilling] = useState<TenantBilling | null>(null);

  // Modals & Forms
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [userRoleFilter, setUserRoleFilter] = useState<string>('all');
  const [newUserEmail, setNewUserEmail] = useState<string>('');
  const [newUserName, setNewUserName] = useState<string>('');
  const [newUserRole, setNewUserRole] = useState<UserProfile['role']>('student');

  // Settings State
  const [settingsName, setSettingsName] = useState<string>('');
  const [settingsCustomDomain, setSettingsCustomDomain] = useState<string>('');
  const [settingsPrimaryColor, setSettingsPrimaryColor] = useState<string>('#4f46e5');
  const [settingsSaved, setSettingsSaved] = useState<boolean>(false);

  useEffect(() => {
    const targetSubdomain = routeSubdomain || activeTenant.subdomain;
    loadDashboardData(targetSubdomain);
  }, [routeSubdomain]);

  const loadDashboardData = async (sub: string) => {
    setLoading(true);
    try {
      const t = await tenantService.getTenantBySubdomain(sub);
      setTenant(t);
      setSettingsName(t.name);
      setSettingsCustomDomain(t.custom_domain || '');
      setSettingsPrimaryColor(t.primary_color || '#4f46e5');

      const [uList, cList, aData, bData] = await Promise.all([
        tenantService.getTenantUsers(t.id),
        tenantService.getTenantCourses(t.id),
        tenantService.getTenantAnalytics(t.id),
        tenantService.getTenantBilling(t.id)
      ]);

      setUsers(uList);
      setCourses(cList);
      setAnalytics(aData);
      setBilling(bData);
    } catch (e) {
      console.error('[TenantAdminDashboard] Error loading data:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSingleUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail || !newUserName) return;

    const newUser: UserProfile = {
      id: `u-${tenant.id}-${Date.now()}`,
      email: newUserEmail,
      full_name: newUserName,
      role: newUserRole,
      tenant_id: tenant.id,
      created_at: new Date().toISOString()
    };

    setUsers([newUser, ...users]);
    setNewUserEmail('');
    setNewUserName('');
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const updated = await tenantService.updateTenant(tenant.id, {
      name: settingsName,
      custom_domain: settingsCustomDomain || undefined,
      primary_color: settingsPrimaryColor
    });
    setTenant(updated);
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 3000);
  };

  // Export Analytics CSV
  const handleExportCSV = () => {
    if (!analytics) return;
    const csvContent = "data:text/csv;charset=utf-8,"
      + "Metric,Value\n"
      + `Institution Name,${tenant.name}\n`
      + `Tenant Subdomain,${tenant.subdomain}.trileza.com\n`
      + `Total Users,${analytics.total_users}\n`
      + `Learners,${analytics.total_students}\n`
      + `Instructors,${analytics.total_tutors}\n`
      + `Courses Published,${analytics.total_courses}\n`
      + `Total Enrollments,${analytics.total_enrollments}\n`
      + `Gross Revenue,$${analytics.total_revenue}\n`
      + `Completion Rate,${analytics.completion_rate}%\n`
      + `Active Learners (30d),${analytics.active_learners_30d}\n`;

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${tenant.subdomain}_lms_analytics_report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download PDF Report
  const handleExportPDF = () => {
    window.print();
  };

  const filteredUsers = users.filter(u => {
    if (userRoleFilter === 'all') return true;
    return u.role === userRoleFilter;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <img
            src={tenant.logo_url}
            alt={tenant.name}
            className="w-10 h-10 rounded-xl object-cover border border-slate-700 shadow-md"
          />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-lg text-white">{tenant.name}</h1>
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                {tenant.subdomain}.trileza.com
              </span>
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                tenant.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400'
              }`}>
                {tenant.status}
              </span>
            </div>
            <p className="text-xs text-slate-400">Institutional Administration & Multi-Tenant Portal</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate('/')}
            className="text-xs bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
          >
            ← Main App Portal
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsImportModalOpen(true)}
            className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white"
          >
            📥 Bulk CSV Import
          </Button>
        </div>
      </header>

      {/* Tabs Bar */}
      <div className="bg-slate-900/60 border-b border-slate-800/80 px-6 flex items-center gap-2 overflow-x-auto">
        {[
          { id: 'overview', label: '📊 Overview', desc: 'Key Metrics' },
          { id: 'users', label: '👥 User Management', desc: 'Roles & Access' },
          { id: 'courses', label: '📚 Course Hierarchy', desc: 'Curriculum' },
          { id: 'billing', label: '💳 Billing & Tier', desc: 'Subscriptions' },
          { id: 'analytics', label: '📈 Reports & Export', desc: 'Analytics' },
          { id: 'settings', label: '⚙️ Branding & Settings', desc: 'Domain & Colors' }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={`py-3.5 px-4 font-semibold text-xs transition border-b-2 whitespace-nowrap flex items-center gap-2 ${
              activeTab === t.id
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Main Content Area */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        {loading ? (
          <div className="py-20 text-center text-slate-400">Loading tenant statistics...</div>
        ) : (
          <>
            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && (
              <div className="space-y-6 animate-fade-in">
                {/* Metric Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Enrolled Users</p>
                    <div className="flex items-baseline justify-between mt-2">
                      <span className="text-3xl font-extrabold text-white">{analytics?.total_users || users.length}</span>
                      <span className="text-xs font-bold text-emerald-400">+12% vs last mo</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-2">{analytics?.total_students} Learners, {analytics?.total_tutors} Tutors</p>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Published Courses</p>
                    <div className="flex items-baseline justify-between mt-2">
                      <span className="text-3xl font-extrabold text-white">{analytics?.total_courses || courses.length}</span>
                      <span className="text-xs font-mono text-indigo-400">Active Tenant</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-2">Course Hierarchy: Module → Topic → Subtopic</p>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Average Completion</p>
                    <div className="flex items-baseline justify-between mt-2">
                      <span className="text-3xl font-extrabold text-emerald-400">{analytics?.completion_rate}%</span>
                      <span className="text-xs text-slate-400">Target 80%</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-2">{analytics?.active_learners_30d} Active learners in last 30d</p>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Gross Course Revenue</p>
                    <div className="flex items-baseline justify-between mt-2">
                      <span className="text-3xl font-extrabold text-indigo-400">${analytics?.total_revenue?.toLocaleString()}</span>
                      <span className="text-xs font-bold text-emerald-400">Paid</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-2">Plan: {tenant.plan.toUpperCase()} Tier</p>
                  </div>
                </div>

                {/* Subdomain & Data Isolation Status Banner */}
                <div className="p-6 rounded-2xl bg-gradient-to-r from-indigo-950/60 to-purple-950/40 border border-indigo-800/40 flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="font-bold text-white text-base flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
                      Row Level Security (RLS) & Tenant Data Isolation Active
                    </h3>
                    <p className="text-xs text-slate-300">
                      All queries and endpoints are isolated with <code className="bg-slate-950 px-2 py-0.5 rounded text-indigo-300">tenant_id = '{tenant.id}'</code>. Cross-tenant queries are blocked.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400">Custom Domain:</span>
                    <span className="text-xs font-mono font-bold px-3 py-1 rounded-lg bg-slate-900 border border-slate-700 text-indigo-300">
                      {tenant.custom_domain || 'Not Configured'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* USERS TAB */}
            {activeTab === 'users' && (
              <div className="space-y-6 animate-fade-in">
                {/* Filter and Add Single User */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Add User Card */}
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                    <h3 className="font-bold text-white text-sm uppercase tracking-wider">Add Single User</h3>
                    <form onSubmit={handleAddSingleUser} className="space-y-3">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Full Name</label>
                        <input
                          type="text"
                          required
                          value={newUserName}
                          onChange={(e) => setNewUserName(e.target.value)}
                          placeholder="Prof. Alex Smith"
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Email Address</label>
                        <input
                          type="email"
                          required
                          value={newUserEmail}
                          onChange={(e) => setNewUserEmail(e.target.value)}
                          placeholder="alex@institution.edu"
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Role Scoped to Tenant</label>
                        <select
                          value={newUserRole}
                          onChange={(e) => setNewUserRole(e.target.value as any)}
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                        >
                          <option value="student">Learner / Student</option>
                          <option value="tutor">Instructor / Tutor</option>
                          <option value="tenant_admin">Tenant Administrator</option>
                          <option value="support_staff">Support Staff</option>
                        </select>
                      </div>
                      <Button
                        type="submit"
                        variant="primary"
                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs py-2.5"
                      >
                        + Add User to {tenant.name}
                      </Button>
                    </form>
                  </div>

                  {/* Users Table */}
                  <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="font-bold text-white text-sm uppercase tracking-wider">
                        Institutional Users ({filteredUsers.length})
                      </h3>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">Filter:</span>
                        <select
                          value={userRoleFilter}
                          onChange={(e) => setUserRoleFilter(e.target.value)}
                          className="bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-lg px-2.5 py-1"
                        >
                          <option value="all">All Roles</option>
                          <option value="student">Learners</option>
                          <option value="tutor">Instructors</option>
                          <option value="tenant_admin">Tenant Admins</option>
                          <option value="support_staff">Support Staff</option>
                        </select>
                      </div>
                    </div>

                    <div className="border border-slate-800 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                          <tr>
                            <th className="py-3 px-4">User</th>
                            <th className="py-3 px-4">Role</th>
                            <th className="py-3 px-4">Tenant Scope</th>
                            <th className="py-3 px-4 text-right">Added Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 text-slate-300">
                          {filteredUsers.map((u) => (
                            <tr key={u.id} className="hover:bg-slate-800/40">
                              <td className="py-3 px-4">
                                <div className="font-semibold text-white">{u.full_name}</div>
                                <div className="text-[11px] text-slate-400 font-mono">{u.email}</div>
                              </td>
                              <td className="py-3 px-4">
                                <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase ${
                                  u.role === 'tenant_admin'
                                    ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                                    : u.role === 'tutor'
                                    ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                                    : 'bg-slate-800 text-slate-300 border border-slate-700'
                                }`}>
                                  {u.role.replace('_', ' ')}
                                </span>
                              </td>
                              <td className="py-3 px-4 font-mono text-[11px] text-indigo-400">
                                {tenant.subdomain}
                              </td>
                              <td className="py-3 px-4 text-right text-slate-400">
                                {new Date(u.created_at).toLocaleDateString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* COURSES TAB */}
            {activeTab === 'courses' && (
              <div className="space-y-6 animate-fade-in">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white">Institutional Course Catalog</h3>
                    <p className="text-xs text-slate-400">
                      Curriculum structure configured as: <span className="text-indigo-400 font-semibold">Module → Topic → Subtopic</span>
                    </p>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => navigate('/tutor/course/new')}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs"
                  >
                    + Create Institutional Course
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {courses.map((c) => (
                    <div key={c.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 flex flex-col justify-between">
                      <div className="flex items-start gap-4">
                        <img
                          src={c.thumbnail_url}
                          alt={c.title}
                          className="w-20 h-20 rounded-xl object-cover border border-slate-800"
                        />
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            {c.category}
                          </span>
                          <h4 className="font-bold text-white text-sm line-clamp-1">{c.title}</h4>
                          <p className="text-xs text-slate-400 line-clamp-2">{c.description}</p>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                        <span className="text-slate-400">Enrolled Learners: <strong className="text-white">{c.enrolled_count}</strong></span>
                        <span className="font-bold text-emerald-400">${c.price_tiers?.standard || 0} USD</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* BILLING TAB */}
            {activeTab === 'billing' && billing && (
              <div className="space-y-6 animate-fade-in">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-800">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">Current Subscription</span>
                      <h3 className="text-2xl font-extrabold text-white mt-1 capitalize">{billing.plan} Tier</h3>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-slate-400">Next Billing Date</span>
                      <p className="font-mono text-sm font-bold text-white">{billing.next_billing_date}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                      <p className="text-xs text-slate-400">Base Subscription</p>
                      <p className="text-xl font-bold text-white mt-1">${billing.monthly_subscription_fee}/mo</p>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                      <p className="text-xs text-slate-400">Per-User Fee</p>
                      <p className="text-xl font-bold text-white mt-1">${billing.per_user_fee} / active user</p>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                      <p className="text-xs text-slate-400">Current Cycle Total</p>
                      <p className="text-xl font-extrabold text-indigo-400 mt-1">${billing.current_billing_cycle_amount}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ANALYTICS & REPORTS TAB */}
            {activeTab === 'analytics' && (
              <div className="space-y-6 animate-fade-in">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-white">Institutional Analytics & PDF Export</h3>
                    <p className="text-xs text-slate-400">Download formatted data reports for compliance & academic reviews.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button variant="secondary" size="sm" onClick={handleExportCSV} className="text-xs bg-slate-800 text-indigo-300">
                      📄 Export CSV Data
                    </Button>
                    <Button variant="primary" size="sm" onClick={handleExportPDF} className="text-xs bg-indigo-600 text-white">
                      🖨️ Print / Save PDF
                    </Button>
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
                  <h4 className="font-bold text-white text-sm uppercase tracking-wider">Metrics Summary</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-slate-400">Total Users</span>
                      <p className="text-lg font-bold text-white mt-1">{analytics?.total_users}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-slate-400">Total Enrollments</span>
                      <p className="text-lg font-bold text-white mt-1">{analytics?.total_enrollments}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-slate-400">Completion Rate</span>
                      <p className="text-lg font-bold text-emerald-400 mt-1">{analytics?.completion_rate}%</p>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-slate-400">Gross Revenue</span>
                      <p className="text-lg font-bold text-indigo-400 mt-1">${analytics?.total_revenue}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SETTINGS TAB */}
            {activeTab === 'settings' && (
              <div className="space-y-6 animate-fade-in max-w-2xl">
                <form onSubmit={handleSaveSettings} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
                  <h3 className="font-bold text-white text-base">Branding & Custom Domain Settings</h3>

                  {settingsSaved && (
                    <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 text-xs font-semibold border border-emerald-500/20">
                      ✓ Tenant settings updated successfully!
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Institution Name</label>
                    <input
                      type="text"
                      required
                      value={settingsName}
                      onChange={(e) => setSettingsName(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Subdomain (Read-only)</label>
                    <input
                      type="text"
                      disabled
                      value={`${tenant.subdomain}.trileza.com`}
                      className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800/80 rounded-xl text-xs font-mono text-slate-400 cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Custom Domain Mapping</label>
                    <input
                      type="text"
                      value={settingsCustomDomain}
                      onChange={(e) => setSettingsCustomDomain(e.target.value)}
                      placeholder="lms.institution.edu"
                      className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Primary Theme Color</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={settingsPrimaryColor}
                        onChange={(e) => setSettingsPrimaryColor(e.target.value)}
                        className="w-12 h-10 rounded-lg border border-slate-800 bg-slate-950 cursor-pointer"
                      />
                      <span className="font-mono text-xs text-slate-300">{settingsPrimaryColor}</span>
                    </div>
                  </div>

                  <Button type="submit" variant="primary" className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-6 py-2.5">
                    Save Branding Updates
                  </Button>
                </form>
              </div>
            )}
          </>
        )}
      </main>

      {/* Bulk Import Modal */}
      <BulkUserImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        tenantId={tenant.id}
        onImportComplete={() => loadDashboardData(tenant.subdomain)}
      />
    </div>
  );
};

export default TenantAdminDashboard;
