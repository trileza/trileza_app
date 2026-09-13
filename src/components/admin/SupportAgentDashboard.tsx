import React, { useEffect, useState, useCallback } from 'react';
import { adminService } from '../../lib/services/admin';
import type { SupportTicket } from '../../types/admin';
import { Card, Button, Toast } from '../ui';
import { useAuthStore } from '../../store/authStore';
import { 
  LifeBuoy, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  RefreshCcw,
  ShieldAlert,
  Send,
  MessageSquare
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { cn } from '../../utils';
import PageHeader from '../shared/PageHeader';
import { useMultiTableSync } from './hooks/useAdminData';

const SupportAgentDashboard: React.FC = () => {
  const { user } = useAuthStore();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected item state
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [toast, setToast] = useState<{ message: string; type?: 'success' | 'error' | 'info' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const ticketData = await adminService.getSupportTickets();
      setTickets(ticketData);
      
      // Keep selected ticket updated if open
      if (selectedTicket) {
        const found = ticketData.find(t => t.id === selectedTicket.id);
        if (found) setSelectedTicket(found);
      }
    } catch (err) {
      console.error('[Support Fetch Error]:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedTicket]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Realtime sync for support tickets
  useMultiTableSync(
    ['support_tickets'],
    fetchData
  );

  const handleUpdateTicketStatus = async (status: SupportTicket['status'], priority?: SupportTicket['priority']) => {
    if (!selectedTicket || !user?.id) return;
    setSubmitting(true);
    try {
      const updated = await adminService.updateTicket(
        selectedTicket.id,
        user.id,
        status,
        priority
      );
      setSelectedTicket(updated);
      await fetchData();
      showToast(`Ticket status updated to: ${status}`, 'success');
    } catch (err) {
      showToast('Failed to update ticket: ' + err, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendReply = async () => {
    if (!selectedTicket || !replyText.trim() || !user?.id) return;
    setSubmitting(true);
    try {
      const updated = await adminService.submitTicketReply(
        selectedTicket.id,
        user.id,
        user.full_name || 'Support Agent',
        replyText
      );
      setReplyText('');
      setSelectedTicket(updated);
      await fetchData();
    } catch (err) {
      showToast('Failed to submit reply: ' + err, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Metrics calculations
  const activeTickets = tickets.filter(t => t.status !== 'closed');
  const closedTickets = tickets.filter(t => t.status === 'closed');
  const escalatedCount = tickets.filter(t => t.status === 'escalated').length;
  const urgentCount = tickets.filter(t => (t.status === 'open' || t.status === 'in_progress') && t.priority === 'urgent').length;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 text-left">
      
      {selectedTicket ? (
        <PageHeader 
          title={`Ticket #${selectedTicket.id.slice(0, 8)}: ${selectedTicket.title}`} 
          description="Verify end-user query, priority tier, and ticket thread log for applicant."
          tag="Support Ticket Details"
          icon={LifeBuoy}
          rightContent={
            <Button 
              onClick={() => setSelectedTicket(null)}
              variant="outline"
              className="h-10 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs"
            >
              ← Back to Helpdesk
            </Button>
          }
        />
      ) : (
        <PageHeader
          title="Support Helpdesk"
          description="Resolve end-user queries, triage tickets, and escalate infrastructure errors."
          tag="Support Helpdesk"
          icon={LifeBuoy}
          rightContent={
            <Button onClick={fetchData} variant="outline" className="h-11 rounded-xl bg-white/15 hover:bg-white/20 border-white/20 text-white shadow-sm flex items-center gap-2 font-bold">
              <RefreshCcw size={14} className="text-emerald-450 animate-spin-slow" /> Refresh data
            </Button>
          }
        />
      )}

      {/* ── Support Cards ── */}
      {!selectedTicket && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: 'Active Support Tickets', value: activeTickets.length, icon: LifeBuoy, color: 'text-cyan-700 bg-cyan-50 border-cyan-250/60' },
            { label: 'Escalated Issues', value: escalatedCount, icon: ShieldAlert, color: 'text-rose-700 bg-rose-50 border-rose-250/60' },
            { label: 'Urgent SLA (1hr response)', value: urgentCount, icon: AlertTriangle, color: `text-red-700 bg-red-50 border-red-250/60 ${urgentCount > 0 ? 'animate-pulse' : ''}` },
            { label: 'Average Response Time', value: '18 mins', icon: Clock, color: 'text-emerald-700 bg-emerald-50 border-emerald-250/60' },
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
      <div className={selectedTicket ? "grid grid-cols-1 lg:grid-cols-3 gap-8" : "w-full"}>
        
        {/* Left Columns: Ticket Queue */}
        <div className={selectedTicket ? "lg:col-span-2 space-y-8" : "w-full space-y-8"}>
          
          {/* Active Tickets List */}
          <div className="space-y-4">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Active Tickets Queue ({activeTickets.length})</h3>
            
            {loading ? (
              <Card className="p-12 text-center border-slate-200 bg-white shadow-sm">
                <p className="text-slate-400 font-bold uppercase tracking-wider text-xs">Loading support tickets...</p>
              </Card>
            ) : activeTickets.length === 0 ? (
              <Card className="p-12 text-center border-slate-200 bg-white rounded-2xl shadow-sm">
                <CheckCircle size={40} className="text-emerald-500 mx-auto mb-4 animate-bounce" />
                <h4 className="font-extrabold text-slate-800 text-base">Inboxes Clear</h4>
                <p className="text-xs text-slate-500 mt-1">There are no open support tickets in queue.</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {activeTickets.map(ticket => {
                  const isUrgent = ticket.priority === 'urgent';
                  const isHigh = ticket.priority === 'high';
                  return (
                    <Card
                      key={ticket.id}
                      onClick={() => { setSelectedTicket(ticket); }}
                      className={`p-5 bg-white border hover:border-cyan-300 transition-all rounded-2xl cursor-pointer text-left flex gap-4 shadow-sm ${
                        selectedTicket?.id === ticket.id ? 'ring-2 ring-cyan-600 border-transparent bg-cyan-50/10' : 'border-slate-200/60'
                      } ${isUrgent ? 'border-red-200 bg-red-50/10' : ''}`}
                    >
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex justify-between items-start">
                          <h4 className="font-extrabold text-sm text-slate-900 truncate">{ticket.title}</h4>
                          <span className="text-[9px] text-slate-400 font-mono shrink-0">
                            {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        
                        <p className="text-xs text-slate-600 font-medium line-clamp-2">{ticket.description}</p>
                        
                        <div className="flex items-center gap-3 pt-2">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border ${
                            isUrgent ? 'text-red-700 bg-red-50 border-red-200' :
                            isHigh ? 'text-orange-700 bg-orange-50 border-orange-200' :
                            ticket.priority === 'medium' ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-slate-550 bg-slate-50 border-slate-200'
                          }`}>
                            {ticket.priority} SLA
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border ${
                            ticket.status === 'open' ? 'text-cyan-700 bg-cyan-50 border-cyan-200' :
                            ticket.status === 'in_progress' ? 'text-amber-700 bg-amber-50 border-amber-200' :
                            'text-rose-700 bg-rose-50 border-rose-200'
                          }`}>
                            {ticket.status}
                          </span>
                          <span className="text-[10px] text-slate-500 font-bold truncate">Submitted by: {ticket.user_name}</span>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Closed Tickets History */}
          <div className="space-y-4 pt-6 border-t border-slate-200">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Closed Ticket History ({closedTickets.length})</h3>
            
            <Card className="overflow-hidden bg-white border border-slate-200/80 rounded-2xl p-0 shadow-sm">
              <div className="overflow-x-auto w-full no-scrollbar">
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 bg-slate-50/50 text-[9px] uppercase font-black tracking-widest">
                      <th className="p-4">Ticket details</th>
                      <th className="p-4">Priority</th>
                      <th className="p-4">Resolved by</th>
                      <th className="p-4">Closed Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                  {closedTickets.map(t => (
                    <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-4">
                        <p className="font-bold text-slate-900">{t.title}</p>
                        <p className="text-[10px] text-slate-500 truncate max-w-[250px] mt-0.5">{t.description}</p>
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-slate-100 border border-slate-200 text-slate-550">
                          {t.priority}
                        </span>
                      </td>
                      <td className="p-4 text-slate-650 font-bold">{t.assigned_to || 'System'}</td>
                      <td className="p-4 text-slate-500 font-mono">
                        {t.closed_at ? new Date(t.closed_at).toLocaleDateString() : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        </div>

        {/* Right Column: Ticket triage panel */}
        {selectedTicket && (
          <div className="space-y-6">
            <Card className="bg-white border border-slate-200/80 p-6 rounded-3xl sticky top-8 shadow-sm flex flex-col min-h-[500px]">
              <div className="space-y-5 flex-1 flex flex-col justify-between text-left">
                <div className="space-y-4 flex-1 flex flex-col">
                  <div>
                    <span className="text-[9px] font-black text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200/60 uppercase">Triage Deck</span>
                    <h4 className="font-extrabold text-base text-slate-900 mt-2 leading-snug">{selectedTicket.title}</h4>
                    <p className="text-[10px] text-slate-400 font-semibold mt-1">Ticket UUID: {selectedTicket.id}</p>
                  </div>

                  <hr className="border-slate-100" />

                  {/* Conversational replies log */}
                  <div className="space-y-3 flex-1 flex flex-col">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                      <MessageSquare size={13} className="text-cyan-600" /> Ticket Message History
                    </p>
                    
                    <div className="flex-1 overflow-y-auto max-h-56 p-3 bg-slate-50 border border-slate-200/60 rounded-2xl space-y-3 shadow-inner">
                      {/* Ticket Description (Initial Message) */}
                      <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs text-slate-750 font-medium">
                        <div className="flex justify-between items-center mb-1 pb-1 border-b border-slate-50 text-[9px] text-slate-400">
                          <span className="font-bold text-slate-650">{selectedTicket.user_name} (Stated Issue)</span>
                          <span>{format(new Date(selectedTicket.created_at), 'hh:mm a')}</span>
                        </div>
                        <p>{selectedTicket.description}</p>
                      </div>

                      {/* Ticket replies */}
                      {selectedTicket.replies?.map((rep, idx) => {
                        const isAgent = rep.sender_id === user?.id;
                        return (
                          <div 
                            key={idx} 
                            className={`p-3 rounded-xl border text-xs text-slate-750 font-medium max-w-[90%] ${
                              isAgent 
                                ? 'bg-cyan-50 border-cyan-100 ml-auto text-slate-800' 
                                : 'bg-white border-slate-200'
                            }`}
                          >
                            <div className="flex justify-between items-center mb-1 pb-1 border-b border-slate-100/30 text-[9px] text-slate-400">
                              <span className="font-bold text-slate-650">{rep.sender_name}</span>
                              <span>{format(new Date(rep.created_at), 'hh:mm a')}</span>
                            </div>
                            <p className="break-words">{rep.text}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Reply Input Form */}
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <textarea
                        placeholder="Write message reply..."
                        value={replyText}
                        onChange={e => setReplyText(e.target.value)}
                        className="flex-1 bg-white border border-slate-200 text-xs rounded-xl p-3 text-slate-800 outline-none focus:ring-2 focus:ring-cyan-500/10 min-h-[44px] max-h-16"
                      />
                      <button
                        onClick={handleSendReply}
                        disabled={submitting || !replyText.trim()}
                        className="px-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl flex items-center justify-center transition-all shadow-sm disabled:opacity-50"
                      >
                        <Send size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Re-triage SLA priorities */}
                  <div className="space-y-2 pt-2">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Adjust SLA Priority</p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {([
                        { key: 'low', label: 'Low', color: 'border-slate-200 hover:border-slate-300 hover:bg-slate-50' },
                        { key: 'medium', label: 'Med', color: 'border-slate-200 hover:border-amber-300 hover:bg-amber-50/20' },
                        { key: 'high', label: 'High', color: 'border-slate-200 hover:border-orange-300 hover:bg-orange-50/20' },
                        { key: 'urgent', label: 'Urgent', color: 'border-slate-200 hover:border-red-300 hover:bg-red-50/20' },
                      ] as const).map(p => (
                        <button
                          key={p.key}
                          onClick={() => handleUpdateTicketStatus(selectedTicket.status, p.key)}
                          disabled={submitting}
                          className={cn(
                            "py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all text-center",
                            selectedTicket.priority === p.key
                              ? "bg-cyan-50 border-cyan-500 text-cyan-700 font-bold"
                              : `text-slate-500 bg-white ${p.color}`
                          )}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* State changes */}
                <div className="flex flex-col gap-2 pt-4 border-t border-slate-100 mt-auto">
                  {selectedTicket.status === 'open' && (
                    <Button
                      onClick={() => handleUpdateTicketStatus('in_progress')}
                      disabled={submitting}
                      className="h-11 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold border-none shadow-sm"
                    >
                      Claim & Begin Progress
                    </Button>
                  )}
                  {selectedTicket.status === 'in_progress' && (
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        onClick={() => handleUpdateTicketStatus('closed')}
                        disabled={submitting}
                        className="h-11 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold border-none shadow-sm"
                      >
                        Close Ticket
                      </Button>
                      <Button
                        onClick={() => handleUpdateTicketStatus('escalated')}
                        disabled={submitting}
                        className="h-11 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold shadow-sm"
                      >
                        Escalate
                      </Button>
                    </div>
                  )}
                  {selectedTicket.status === 'escalated' && (
                    <Button
                      onClick={() => handleUpdateTicketStatus('closed')}
                      disabled={submitting}
                      className="h-11 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold border-none shadow-sm"
                    >
                      Resolve Escalated Ticket
                    </Button>
                  )}
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

export default SupportAgentDashboard;
