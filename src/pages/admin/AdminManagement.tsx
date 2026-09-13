import { useState, useEffect } from 'react';
import { Shield, AlertTriangle, CheckCircle2, XCircle, Loader2, Trash2 } from 'lucide-react';
import PageHeader from '../../components/shared/PageHeader';
import { adminService } from '../../lib/services/admin';
import { useAuthStore } from '../../store/authStore';
import { nexus } from '../../lib/nexus';

export default function AdminManagement() {
  const { adminRoles } = useAuthStore();
  const isSuperAdmin = adminRoles?.includes('super_admin');
  
  const [admins, setAdmins] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (isSuperAdmin) {
      loadData();
    }
  }, [isSuperAdmin]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Active admins
      const { data: adminData } = await nexus.database
        .from('admin_users')
        .select('*, profiles(full_name, email)')
        .order('created_at', { ascending: false });
        
      if (adminData) setAdmins(adminData);

      // 3. Load Audit Logs
      const { data: logData } = await nexus.database
        .from('admin_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
        
      if (logData) setAuditLogs(logData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="p-8 animate-in fade-in duration-350">
        <PageHeader title="Admin Management" description="Manage platform administrators" tag="RBAC" icon={Shield} />
        <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5" />
          <p>Access Denied. Only Super Admins can access this section.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 pb-32 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <PageHeader 
        title="Admin Management" 
        description="Manage active administrators and review the platform audit trail. Admin access is granted by invitation only." 
        tag="RBAC"
        icon={Shield}
      />

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 flex items-center gap-3">
          <XCircle className="w-5 h-5 shrink-0" />
          <p className="font-bold text-sm">{error}</p>
        </div>
      )}
      
      {success && (
        <div className="bg-emerald-50 text-emerald-600 p-4 rounded-xl border border-emerald-100 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <p className="font-bold text-sm">{success}</p>
        </div>
      )}

      {/* 1. Active Administrators */}
      <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-500" />
            Active Administrators
          </h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-bold border-b border-gray-100">
              <tr>
                <th className="px-6 py-4">Admin</th>
                <th className="px-6 py-4">Roles</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-gray-500">
                    <div className="flex items-center gap-2 justify-center">
                      <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" /> Loading...
                    </div>
                  </td>
                </tr>
              ) : admins.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-gray-500 font-medium">
                    No active administrators found.
                  </td>
                </tr>
              ) : (
                admins.map((admin) => (
                  <tr key={admin.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900">{admin.profiles?.full_name || 'Unknown'}</div>
                      <div className="text-xs text-gray-500">{admin.profiles?.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {admin.roles?.map((r: string) => (
                          <span key={r} className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-xs font-bold">
                            {r.replace('_', ' ').toUpperCase()}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {admin.suspended ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-600">
                          Suspended
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600">
                          Active
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Audit Trail */}
      <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-rose-500" />
            System Audit Trail
          </h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-bold border-b border-gray-100">
              <tr>
                <th className="px-6 py-4">Timestamp</th>
                <th className="px-6 py-4">Action</th>
                <th className="px-6 py-4">Target Type</th>
                <th className="px-6 py-4">Details / Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    <div className="flex items-center gap-2 justify-center">
                      <Loader2 className="w-5 h-5 text-rose-500 animate-spin" /> Loading...
                    </div>
                  </td>
                </tr>
              ) : auditLogs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500 font-medium">
                    No system audit logs found.
                  </td>
                </tr>
              ) : (
                auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-xs text-gray-400">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded-md text-xs font-bold">
                        {(log.action_type || 'unknown').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">
                      {log.target_type}
                    </td>
                    <td className="px-6 py-4 text-gray-600 text-xs">
                      {log.reason || JSON.stringify(log.new_state)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
