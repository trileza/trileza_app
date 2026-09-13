import React, { useEffect, useState, useCallback } from 'react';
import { adminService } from '../../lib/services/admin';
import type { ComplianceRequest } from '../../types/admin';
import { Card, Button, Toast } from '../ui';
import { useAuthStore } from '../../store/authStore';
import { nexus } from '../../lib/nexus';
import { 
  Scale, 
  AlertOctagon, 
  FileCheck, 
  Trash2, 
  RefreshCcw,
  CheckCircle2,
  Download,
  AlertTriangle,
  Eye,
  EyeOff,
  Building2
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import PageHeader from '../shared/PageHeader';
import { useMultiTableSync } from './hooks/useAdminData';
import InstitutionKycQueue from './InstitutionKycQueue';

const ComplianceOfficerDashboard: React.FC = () => {
  const { user } = useAuthStore();
  const [requests, setRequests] = useState<ComplianceRequest[]>([]);
  const [loading, setLoading] = useState(true);

  /** Which half of this role's work is on screen. */
  const [view, setView] = useState<'cases' | 'kyc'>('cases');

  // Selected item state
  const [selectedReq, setSelectedReq] = useState<ComplianceRequest | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // GDPR export states
  const [gdprData, setGdprData] = useState<any>(null);
  const [loadingGdpr, setLoadingGdpr] = useState(false);
  const [showJsonTree, setShowJsonTree] = useState(false);

  const [toast, setToast] = useState<{ message: string; type?: 'success' | 'error' | 'info' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
  };

  // DMCA takedown options
  const [executeTakedown, setExecuteTakedown] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminService.getComplianceRequests();
      setRequests(data);
    } catch (err) {
      console.error('[Compliance Fetch Error]:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  // Realtime sync for compliance requests
  useMultiTableSync(
    ['compliance_requests', 'flagged_content'],
    fetchData
  );

  const parseTargetFromUrl = (url?: string) => {
    if (!url) return null;
    if (url.includes('/library/')) {
      return { type: 'book', id: url.split('/library/')[1] };
    }
    if (url.includes('/courses/')) {
      return { type: 'course', id: url.split('/courses/')[1] };
    }
    return null;
  };

  const handleResolveRequest = async (status: 'resolved' | 'dismissed' | 'under_review') => {
    if (!selectedReq || !user?.id) return;
    if (!resolutionNotes.trim()) {
      showToast('Please provide resolution notes for the ledger.', 'info');
      return;
    }
    setSubmitting(true);
    try {
      // Execute active DB takedown if copyright DMCA checked
      const targetInfo = parseTargetFromUrl(selectedReq.details.infringement_url);
      if (status === 'resolved' && executeTakedown && targetInfo) {
        if (targetInfo.type === 'course') {
          const { error } = await nexus.database.from('courses').update({ status: 'draft' }).eq('id', targetInfo.id);
          if (error) throw error;
        } else if (targetInfo.type === 'book') {
          const { error } = await nexus.database.from('book_reviews').update({ status: 'rejected', notes: `DMCA Copyright Takedown: ${resolutionNotes}` }).eq('book_id', targetInfo.id);
          if (error) throw error;
        }
      }

      await adminService.resolveCompliance(
        selectedReq.id,
        user.id,
        status,
        resolutionNotes
      );
      setSelectedReq(null);
      setResolutionNotes('');
      setGdprData(null);
      setExecuteTakedown(false);
      await fetchData();
      showToast(`Compliance request successfully updated to ${status}!`, 'success');
    } catch (err) {
      showToast('Resolution submission failed: ' + err, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompileGdpr = async () => {
    if (!selectedReq?.user_id) return;
    setLoadingGdpr(true);
    setGdprData(null);
    try {
      const compiled = await adminService.compileGdprData(selectedReq.user_id);
      setGdprData(compiled);
      setShowJsonTree(true);
    } catch (err) {
      showToast('GDPR Compilation failed: ' + err, 'error');
    } finally {
      setLoadingGdpr(false);
    }
  };

  const handleDownloadGdpr = () => {
    if (!gdprData) return;
    const blob = new Blob([JSON.stringify(gdprData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `gdpr-export-${gdprData.user_id}-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Metrics
  const pendingRequests = requests.filter(r => r.status === 'pending' || r.status === 'under_review');
  const historyRequests = requests.filter(r => r.status === 'resolved' || r.status === 'dismissed');

  const copyrightCount = requests.filter(r => r.type === 'copyright_claim' && r.status === 'pending').length;
  const gdprCount = requests.filter(r => r.type === 'gdpr_request' && r.status === 'pending').length;
  const termsCount = requests.filter(r => r.type === 'terms_violation' && r.status === 'pending').length;

  const targetInfo = selectedReq ? parseTargetFromUrl(selectedReq.details.infringement_url) : null;

  // Institution verification is the other half of this role's work, and it was
  // previously unreachable — submissions arrived with nowhere to review them.
  if (view === 'kyc') {
    return (
      <div className="space-y-8 animate-in fade-in duration-500 text-left">
        <PageHeader
          title="Institution Verification"
          description="Review KYB submissions from institutions: entity registration, tax and banking details, authorised representative identity, and compliance declarations."
          tag="Compliance Officer"
          icon={Building2}
          rightContent={
            <Button
              onClick={() => setView('cases')}
              variant="outline"
              className="h-11 rounded-xl bg-white/15 hover:bg-white/20 border-white/20 text-white shadow-sm font-bold text-xs"
            >
              ← Compliance cases
            </Button>
          }
        />
        <InstitutionKycQueue />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 text-left">

      {selectedReq ? (
        <PageHeader 
          title={`Compliance Audit: ${selectedReq.type.replace('_', ' ').toUpperCase()}`} 
          description="Verify incident report details, claimant filings, and execute takedown or resolution signoffs."
          tag="Compliance Case Details"
          icon={Scale}
          rightContent={
            <Button 
              onClick={() => setSelectedReq(null)}
              variant="outline"
              className="h-10 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs"
            >
              ← Back to Queue
            </Button>
          }
        />
      ) : (
        <PageHeader
          title="Compliance & Audit Control"
          description="Resolve copyright claims, process GDPR user deletion requests, and audit terms violations."
          tag="Compliance Officer"
          icon={Scale}
          rightContent={
            <div className="flex items-center gap-2">
              <Button onClick={() => setView('kyc')} variant="outline" className="h-11 rounded-xl bg-white/15 hover:bg-white/20 border-white/20 text-white shadow-sm flex items-center gap-2 font-bold">
                <Building2 size={14} /> Institution verification
              </Button>
              <Button onClick={fetchData} variant="outline" className="h-11 rounded-xl bg-white/15 hover:bg-white/20 border-white/20 text-white shadow-sm flex items-center gap-2 font-bold">
                <RefreshCcw size={14} className="text-emerald-450 animate-spin-slow" /> Refresh data
              </Button>
            </div>
          }
        />
      )}

      {/* ── Compliance Metrics ── */}
      {!selectedReq && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: 'Active Compliance Cases', value: pendingRequests.length, icon: Scale, color: 'text-purple-700 bg-purple-50 border-purple-250/60' },
            { label: 'Copyright DMCA Claims', value: copyrightCount, icon: AlertOctagon, color: 'text-rose-700 bg-rose-50 border-rose-250/60' },
            { label: 'GDPR User Requests', value: gdprCount, icon: Trash2, color: 'text-indigo-700 bg-indigo-50 border-indigo-250/60' },
            { label: 'Terms / Safety Violations', value: termsCount, icon: AlertOctagon, color: 'text-amber-700 bg-amber-50 border-amber-250/60' },
          ].map((stat, i) => (
            <Card key={i} className="bg-white border-slate-200/60 p-5 rounded-2xl flex flex-col justify-between shadow-sm hover:shadow-md transition-all">
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-black text-slate-450 uppercase tracking-widest">{stat.label}</span>
                <div className={`p-2 rounded-xl border ${stat.color}`}>
                  <stat.icon size={15} />
                </div>
              </div>
              <p className="text-xl font-black text-slate-900 mt-3">{stat.value}</p>
            </Card>
          ))}
        </div>
      )}

      {/* ── Grid Layout ── */}
      <div className={selectedReq ? "grid grid-cols-1 lg:grid-cols-3 gap-8" : "w-full"}>
        
        {/* Left Columns: Queues */}
        <div className={selectedReq ? "lg:col-span-2 space-y-8" : "w-full space-y-8"}>
          
          {/* Active Queue */}
          <div className="space-y-4">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Active Cases Queue ({pendingRequests.length})</h3>
            
            {loading ? (
              <Card className="p-12 text-center border-slate-200 bg-white shadow-sm">
                <p className="text-slate-400 font-bold uppercase tracking-wider text-xs">Loading compliance queues...</p>
              </Card>
            ) : pendingRequests.length === 0 ? (
              <Card className="p-12 text-center border-slate-200 bg-white rounded-2xl shadow-sm">
                <CheckCircle2 size={40} className="text-emerald-500 mx-auto mb-4 animate-bounce" />
                <h4 className="font-extrabold text-slate-800 text-base">Inboxes Clear</h4>
                <p className="text-xs text-slate-500 mt-1">There are no pending compliance operations.</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {pendingRequests.map(req => {
                  const isGDPR = req.type === 'gdpr_request';
                  const isDMCA = req.type === 'copyright_claim';
                  return (
                    <Card
                      key={req.id}
                      onClick={() => { setSelectedReq(req); setGdprData(null); setExecuteTakedown(false); }}
                      className={`p-5 bg-white border hover:border-purple-300 transition-all rounded-2xl cursor-pointer text-left flex gap-4 shadow-sm ${
                        selectedReq?.id === req.id ? 'ring-2 ring-purple-600 border-transparent bg-purple-50/10' : 'border-slate-200/60'
                      }`}
                    >
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex justify-between items-start">
                          <h4 className="font-extrabold text-sm text-slate-900 truncate">
                            {isGDPR ? 'GDPR User Data Export/Deletion' : 
                             isDMCA ? `DMCA Copyright Claim: ${req.details.claimant}` : 
                             'Terms of Service Safety Violation'}
                          </h4>
                          <span className="text-[9px] text-slate-400 font-mono shrink-0">
                            {formatDistanceToNow(new Date(req.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        
                        <p className="text-xs text-slate-650 font-medium line-clamp-2">
                          Notes: {req.details.notes || req.details.reason || 'No description provided'}
                        </p>

                        <div className="flex items-center gap-3 pt-2">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border ${
                            isGDPR ? 'text-indigo-700 bg-indigo-50 border-indigo-200' :
                            isDMCA ? 'text-rose-700 bg-rose-50 border-rose-200' :
                            'text-amber-700 bg-amber-50 border-amber-200'
                          }`}>
                            {req.type}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border border-slate-200 bg-slate-100 text-slate-500`}>
                            {req.status}
                          </span>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* History Queue */}
          <div className="space-y-4 pt-6 border-t border-slate-200">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Compliance History ({historyRequests.length})</h3>
            
            <Card className="overflow-hidden bg-white border border-slate-200/80 rounded-2xl p-0 shadow-sm">
              <div className="overflow-x-auto w-full no-scrollbar">
                <table className="w-full text-left border-collapse min-w-[650px]">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 bg-slate-50/50 text-[9px] uppercase font-black tracking-widest">
                    <th className="p-4">Case info</th>
                    <th className="p-4">Type</th>
                    <th className="p-4">Decision</th>
                    <th className="p-4">Auditor notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {historyRequests.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-4">
                        <p className="font-bold text-slate-900 truncate max-w-[200px]">
                          {r.details.claimant || r.details.request_type || 'TOS Violation'}
                        </p>
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-slate-100 border border-slate-200 text-slate-500">
                          {r.type}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border ${
                          r.status === 'resolved' ? 'text-emerald-700 bg-emerald-50 border-emerald-250/60' : 'text-slate-500 bg-slate-50 border-slate-200'
                        }`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="p-4 text-slate-650 max-w-[200px] truncate" title={r.resolution_notes}>
                        {r.resolution_notes || 'None'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                </table>
              </div>
            </Card>
          </div>

        </div>

        {/* Right Column: Case action deck */}
        {selectedReq && (
          <div className="space-y-6">
            <Card className="bg-white border border-slate-200/80 p-6 rounded-3xl sticky top-8 shadow-sm flex flex-col min-h-[450px]">
              <div className="space-y-6 flex-1 flex flex-col justify-between text-left">
                <div className="space-y-5">
                  <div>
                    <span className="text-[9px] font-black text-purple-750 bg-purple-50 px-2 py-0.5 rounded border border-purple-200/60 uppercase">Case File</span>
                    <h4 className="font-extrabold text-base text-slate-900 mt-2 leading-snug">
                      {selectedReq.type === 'gdpr_request' ? 'GDPR Deletion/Export' : 
                       selectedReq.type === 'copyright_claim' ? `DMCA Copyright Audit` : 
                       'Terms Safety Audit'}
                    </h4>
                    <p className="text-[10px] text-slate-400 font-semibold mt-1">Case UUID: {selectedReq.id}</p>
                  </div>

                  <hr className="border-slate-100" />

                  {/* GDPR compiler layout */}
                  {selectedReq.type === 'gdpr_request' && (
                    <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-200/60 shadow-inner">
                      <p className="text-[10px] font-black text-slate-550 uppercase tracking-widest flex items-center gap-1.5">
                        <Trash2 size={13} className="text-indigo-650" /> GDPR Data Exporter
                      </p>
                      
                      <Button
                        onClick={handleCompileGdpr}
                        disabled={loadingGdpr}
                        className="w-full bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs h-11 rounded-xl shadow-sm flex items-center justify-center gap-2"
                      >
                        <RefreshCcw size={13} className={loadingGdpr ? 'animate-spin text-indigo-600' : 'text-indigo-600'} />
                        {loadingGdpr ? 'Compiling Registry Tables...' : 'Compile GDPR Package'}
                      </Button>

                      {gdprData && (
                        <div className="space-y-3 pt-2">
                          <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold">
                            <span>Status: Ready to Download</span>
                            <button 
                              onClick={() => setShowJsonTree(!showJsonTree)}
                              className="text-green-700 hover:text-green-900 flex items-center gap-1"
                            >
                              {showJsonTree ? <EyeOff size={11} /> : <Eye size={11} />}
                              {showJsonTree ? 'Hide View' : 'Inspect JSON'}
                            </button>
                          </div>

                          <Button
                            onClick={handleDownloadGdpr}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-11 rounded-xl shadow-sm flex items-center justify-center gap-2 border-none"
                          >
                            <Download size={14} /> Download JSON Ledger
                          </Button>

                          {showJsonTree && (
                            <pre className="p-3 bg-slate-900 text-slate-200 text-[9px] font-mono rounded-xl overflow-x-auto max-h-40 shadow-inner">
                              {JSON.stringify(gdprData, null, 2)}
                            </pre>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Stated case details */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/60 text-xs space-y-3 leading-relaxed text-slate-700 shadow-inner">
                    {selectedReq.type === 'gdpr_request' && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-slate-500 font-bold">Request Type:</span>
                          <span className="font-extrabold text-slate-900 uppercase">{selectedReq.details.request_type}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500 font-bold">Target User Pen:</span>
                          <span className="font-semibold text-slate-800">{selectedReq.user_name}</span>
                        </div>
                        <div className="pt-2 border-t border-slate-200 text-[10px] text-indigo-650 font-black flex items-center gap-1">
                          <AlertTriangle size={12} /> GDPR deletion request is permanent.
                        </div>
                      </>
                    )}
                    {selectedReq.type === 'copyright_claim' && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-slate-500 font-bold">Claimant entity:</span>
                          <span className="font-extrabold text-slate-900">{selectedReq.details.claimant}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500 font-bold">Infringement URL:</span>
                          <span className="font-semibold text-slate-700 truncate max-w-[150px]" title={selectedReq.details.infringement_url}>
                            {selectedReq.details.infringement_url}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-550 font-bold">Justification:</span>
                          <span className="font-semibold text-slate-800">{selectedReq.details.reason}</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* DMCA Checkbox for copyright claims */}
                  {selectedReq.type === 'copyright_claim' && targetInfo && (
                    <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl space-y-3">
                      <p className="text-[10px] font-black text-rose-700 uppercase tracking-widest flex items-center gap-1.5">
                        <AlertOctagon size={13} /> DMCA Takedown Protocol
                      </p>
                      
                      <label className="flex items-start gap-3 cursor-pointer group">
                        <input 
                          type="checkbox"
                          checked={executeTakedown}
                          onChange={e => setExecuteTakedown(e.target.checked)}
                          className="w-4 h-4 bg-white border-rose-300 text-rose-600 rounded focus:ring-rose-500/20 mt-0.5 cursor-pointer"
                        />
                        <span className="text-xs text-rose-800 group-hover:text-rose-950 transition-colors font-medium">
                          Execute automatic DMCA takedown (reverts target {targetInfo.type} status to draft in database).
                        </span>
                      </label>
                    </div>
                  )}

                  {/* Resolution Notes */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                      Resolution Notes / Audit Justification
                    </label>
                    <textarea
                      placeholder="Input final assessment statement for compliance record..."
                      value={resolutionNotes}
                      onChange={e => setResolutionNotes(e.target.value)}
                      className="w-full bg-white border border-slate-200 text-xs rounded-xl p-3 text-slate-800 outline-none focus:ring-2 focus:ring-purple-550/10 min-h-[80px]"
                    />
                  </div>
                </div>

                {/* Submit Controls */}
                <div className="flex flex-col gap-2 pt-4 border-t border-slate-100 mt-auto">
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      onClick={() => handleResolveRequest('resolved')}
                      disabled={submitting || !resolutionNotes.trim()}
                      className="h-11 rounded-xl bg-purple-650 hover:bg-purple-700 text-white font-bold border-none flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <FileCheck size={14} /> Resolve Case
                    </Button>
                    <Button
                      onClick={() => handleResolveRequest('under_review')}
                      disabled={submitting || !resolutionNotes.trim()}
                      className="h-11 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-bold flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <RefreshCcw size={14} /> Under Review
                    </Button>
                  </div>
                  <Button
                    onClick={() => handleResolveRequest('dismissed')}
                    disabled={submitting || !resolutionNotes.trim()}
                    className="h-11 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-250/60 text-rose-700 font-bold flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    Dismiss Claim
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}

      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

    </div>
  );
};

export default ComplianceOfficerDashboard;
