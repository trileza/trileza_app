import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui';
import { tenantService } from '../../lib/services/tenants';
import type { Tenant } from '../../types';

export const SuperAdminTenantsView: React.FC = () => {
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    loadTenants();
  }, []);

  const loadTenants = async () => {
    setLoading(true);
    try {
      const data = await tenantService.getTenants();
      setTenants(data);
    } catch (e) {
      console.error('[SuperAdminTenantsView] Failed to load tenants:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveTenant = async (tenantId: string) => {
    await tenantService.approveTenant(tenantId);
    await loadTenants();
  };

  const handleToggleStatus = async (tenantId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    await tenantService.updateTenant(tenantId, { status: newStatus as any });
    await loadTenants();
  };

  const handleDeleteTenant = async (tenantId: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete tenant "${name}"? This action removes all tenant records.`)) {
      return;
    }
    await tenantService.deleteTenant(tenantId);
    await loadTenants();
  };

  const filteredTenants = tenants.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.subdomain.toLowerCase().includes(search.toLowerCase()) ||
      t.email.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">🏢</span>
            Global Multi-Tenant Management
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Super admin controls for all registered institutions, subdomains, RLS isolation policies, and enterprise subscriptions.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/institution-signup')}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-4 py-2"
          >
            + Provision New Tenant
          </Button>
        </div>
      </div>

      {/* Filter and Search controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 p-4 rounded-xl border border-slate-800">
        <div className="flex items-center gap-3 flex-1 min-w-[240px]">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by institution name, subdomain, or admin email..."
            className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-xl px-3 py-2"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="pending">Pending</option>
          </select>
        </div>
      </div>

      {/* Tenants Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-sm">Loading tenants list...</div>
        ) : (
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Institution Name</th>
                <th className="py-3.5 px-4">Subdomain & Routing</th>
                <th className="py-3.5 px-4">Tier Plan</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Created Date</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredTenants.map((t) => (
                <tr key={t.id} className="hover:bg-slate-800/40 transition">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={t.logo_url}
                        alt={t.name}
                        className="w-8 h-8 rounded-lg object-cover border border-slate-800"
                      />
                      <div>
                        <div className="font-bold text-white text-sm">{t.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{t.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-mono text-indigo-400 font-bold">{t.subdomain}.trileza.com</div>
                    {t.custom_domain && (
                      <div className="text-[10px] text-slate-400 font-mono">Custom: {t.custom_domain}</div>
                    )}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase ${
                      t.plan === 'enterprise' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                      t.plan === 'growth' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                      'bg-slate-800 text-slate-300'
                    }`}>
                      {t.plan}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                      t.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                      t.status === 'pending' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                      'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-400">
                    {new Date(t.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {t.status === 'pending' ? (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleApproveTenant(t.id)}
                          className="text-[11px] bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 font-bold"
                        >
                          ✓ Approve Institution
                        </Button>
                      ) : (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => navigate(`/tenant-admin/${t.subdomain}`)}
                            className="text-[11px] bg-slate-800 text-slate-200 hover:bg-slate-700 px-2.5 py-1"
                          >
                            Manage ⚙️
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleStatus(t.id, t.status)}
                            className={`text-[11px] px-2.5 py-1 ${
                              t.status === 'active' ? 'text-amber-400 hover:bg-amber-500/10' : 'text-emerald-400 hover:bg-emerald-500/10'
                            }`}
                          >
                            {t.status === 'active' ? 'Suspend' : 'Activate'}
                          </Button>
                        </>
                      )}
                      {t.id !== 'default-tenant' && (
                        <button
                          onClick={() => handleDeleteTenant(t.id, t.name)}
                          className="text-rose-400 hover:text-rose-300 p-1.5 rounded-lg hover:bg-rose-500/10 transition text-xs"
                          title="Delete Tenant"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default SuperAdminTenantsView;
