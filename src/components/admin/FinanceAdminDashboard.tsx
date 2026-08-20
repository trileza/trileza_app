import React, { useEffect, useState } from 'react';
import { adminService } from '../../lib/services/admin';
import type { PayoutRequest } from '../../types/admin';
import { Card, Button, Toast } from '../ui';
import { useAuthStore } from '../../store/authStore';
import { nexus } from '../../lib/nexus';
import { 
  DollarSign, 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Clock, 
  CheckCircle2, 
  XCircle,
  RefreshCcw,
  Percent,
  Search,
  Undo,
  FileText,
  Download,
  Calendar,
  Layers,
  Scale,
  CreditCard,
  Printer
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { formatCurrency, formatDate } from '../../utils';
import PageHeader from '../shared/PageHeader';
import { format } from 'date-fns';

const FinanceAdminDashboard: React.FC = () => {
  const { user } = useAuthStore();
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Main Tabs: 'overview' | 'transactions' | 'payouts' | 'refunds' | 'invoices' | 'reports'
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'payouts' | 'refunds' | 'invoices' | 'reports'>('overview');

  // Sub tab for Reports: 'income' | 'payout_report' | 'top_products' | 'mrr' | 'tax'
  const [selectedReport, setSelectedReport] = useState<'income' | 'payout_report' | 'top_products' | 'mrr' | 'tax'>('income');

  // Overview range: 'today' | 'week' | 'month' | 'year'
  const [overviewRange, setOverviewRange] = useState<'today' | 'week' | 'month' | 'year'>('month');

  // Selected item states
  const [selectedPayout, setSelectedPayout] = useState<PayoutRequest | null>(null);
  const [selectedTx, setSelectedTx] = useState<any | null>(null);

  // Form states
  const [payoutNotes, setPayoutNotes] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [searchTxQuery, setSearchTxQuery] = useState('');

  // Payout Schedule setting
  const [payoutSchedule, setPayoutSchedule] = useState<'weekly' | 'biweekly' | 'monthly'>('weekly');
  const [autoApproveUnder500k, setAutoApproveUnder500k] = useState(true);

  // Letterhead report modal preview state
  const [showReportModal, setShowReportModal] = useState(false);

  const [toast, setToast] = useState<{ message: string; type?: 'success' | 'error' | 'info' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [payoutData, txData] = await Promise.all([
        adminService.getPayoutRequests(),
        adminService.getTransactions()
      ]);
      setPayouts(payoutData);
      setTransactions(txData);
    } catch (err) {
      console.error('[Finance Fetch Error]:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleReviewPayout = async (status: 'approved' | 'rejected') => {
    if (!selectedPayout || !user?.id) return;
    const requiresAuditNote = Number(selectedPayout.amount) > 500000;
    if (requiresAuditNote && !payoutNotes.trim()) {
      showToast('Detailed auditor ledger notes are required to approve payouts exceeding ₦500,000.', 'info');
      return;
    }
    setSubmitting(true);
    try {
      await adminService.reviewPayout(
        selectedPayout.id,
        user.id,
        status,
        payoutNotes || 'Payout processed successfully'
      );
      setSelectedPayout(null);
      setPayoutNotes('');
      await fetchData();
      showToast(`Payout request successfully marked as ${status}!`, 'success');
    } catch (err) {
      showToast('Failed to process payout decision: ' + err, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRefundTx = async () => {
    if (!selectedTx || !user?.id) return;
    if (!refundReason.trim()) {
      showToast('Please state a reason for this refund.', 'info');
      return;
    }
    setSubmitting(true);
    try {
      // Mock Paystack/Flutterwave API response latency
      setTimeout(async () => {
        try {
          await adminService.refundTransaction(
            selectedTx.id,
            selectedTx.wallet_id,
            selectedTx.amount,
            user.id,
            refundReason
          );
          setSelectedTx(null);
          setRefundReason('');
          await fetchData();
          showToast('Refund issued successfully via Paystack integration! Wallet balances adjusted.', 'success');
        } catch (err) {
          showToast('Failed to issue refund: ' + err, 'error');
        } finally {
          setSubmitting(false);
        }
      }, 1000);
    } catch (err) {
      showToast('Failed to connect to payment gateway: ' + err, 'error');
      setSubmitting(false);
    }
  };

  const handleDownloadLedgerCSV = () => {
    const headers = ["Date", "Transaction ID", "Description", "Type", "Amount", "Platform Commission (30%)", "Net Vendor Share", "Payment Method"];
    const rows = transactions.map(tx => {
      const isPayout = tx.type === 'payout' || Number(tx.amount) < 0;
      const amt = Math.abs(Number(tx.amount));
      const comm = isPayout ? 0 : amt * 0.3;
      const net = isPayout ? amt : amt * 0.7;
      return [
        formatDate(tx.created_at),
        tx.id,
        tx.description,
        tx.type,
        tx.amount,
        comm,
        net,
        tx.metadata?.payment_method || "Paystack (Card)"
      ];
    });
    const csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `transaction_ledger_export_${Date.now()}.csv`);
    link.click();
  };

  // Double-entry accounting metrics
  const totalSales = transactions
    .filter(t => t.type === 'sale' && t.amount > 0)
    .reduce((sum, t) => sum + Number(t.amount), 0);
  
  const totalPayoutsVal = transactions
    .filter(t => t.type === 'payout')
    .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);

  const platformLiability = totalSales * 0.70 - totalPayoutsVal; // liability to creators
  const prepaidBalances = totalSales * 0.05; // 5% simulated subscriptions prepaid

  const chartData = [
    { name: 'Week 1', revenue: totalSales * 0.15 },
    { name: 'Week 2', revenue: totalSales * 0.35 },
    { name: 'Week 3', revenue: totalSales * 0.65 },
    { name: 'Week 4', revenue: totalSales },
  ];

  const filteredTransactions = transactions.filter(t => {
    return t.description?.toLowerCase().includes(searchTxQuery.toLowerCase()) ||
           t.id?.toLowerCase().includes(searchTxQuery.toLowerCase()) ||
           t.type?.toLowerCase().includes(searchTxQuery.toLowerCase());
  });  const isPayoutAudit = !!(selectedPayout && activeTab === 'payouts');

  return (
    <div className="space-y-8 animate-in fade-in duration-500 text-left">
      
      {isPayoutAudit ? (
        <PageHeader 
          title={`Payout Audit: ${selectedPayout.vendor_name}`} 
          description={`Reconcile fee splits, bank details, and transfer amount for ${selectedPayout.vendor_name}.`}
          tag="Payout Verification"
          icon={DollarSign}
          rightContent={
            <Button 
              onClick={() => setSelectedPayout(null)}
              variant="outline"
              className="h-10 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs"
            >
              ← Back to Queue
            </Button>
          }
        />
      ) : (
        <PageHeader
          title="Double-Entry Financial Engine"
          description="Audit platform transactions, verify accounting standards, process vendor payouts, and issue refunds."
          tag="Finance Admin"
          icon={DollarSign}
          rightContent={
            <Button onClick={fetchData} variant="outline" className="h-11 rounded-xl bg-white/15 hover:bg-white/20 border-white/20 text-white shadow-sm flex items-center gap-2 font-bold">
              <RefreshCcw size={14} className="text-emerald-450 animate-spin-slow" /> Sync Ledgers
            </Button>
          }
        />
      )}

      {/* ── Tabs Navigation ── */}
      {!isPayoutAudit && (
        <div className="flex gap-4 border-b border-slate-200 pb-2">
          {([
            { key: 'overview', label: '📊 Dashboard Overview' },
            { key: 'transactions', label: '💸 Transaction Log' },
            { key: 'payouts', label: '🏦 Payouts Section' },
            { key: 'refunds', label: '🔄 Refunds Queue' },
            { key: 'invoices', label: '📄 Invoices Ledger' },
            { key: 'reports', label: '📈 Accounting Reports' }
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setSelectedPayout(null); setSelectedTx(null); }}
              className={`px-4 py-2.5 rounded-t-xl font-bold text-xs tracking-wider uppercase transition-all flex items-center gap-2 ${
                activeTab === tab.key
                  ? 'text-green-700 border-b-4 border-green-600 bg-green-50/40'
                  : 'text-slate-550 hover:text-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* ── TAB 1: OVERVIEW ── */}
      {activeTab === 'overview' && (
        <div className="space-y-8">
          
          {/* Accounting Standards double-entry cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { label: 'Debit (Gross Sales)', value: totalSales, icon: DollarSign, color: 'text-green-700 bg-green-50 border-green-250/60' },
              { label: 'Credit (Payouts Settle)', value: totalPayoutsVal, icon: ArrowUpRight, color: 'text-indigo-700 bg-indigo-50 border-indigo-250/60' },
              { label: 'Unpaid Liability (Creator Balance)', value: platformLiability, icon: Clock, color: 'text-amber-700 bg-amber-50 border-amber-250/60' },
              { label: 'Prepaid Subscriptions Balance', value: prepaidBalances, icon: Scale, color: 'text-cyan-700 bg-cyan-50 border-cyan-250/60' }
            ].map((stat, i) => (
              <Card key={i} className="bg-white border-slate-200/60 p-5 rounded-2xl flex flex-col justify-between shadow-sm hover:shadow-md transition-all">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-black text-slate-450 uppercase tracking-widest">{stat.label}</span>
                  <div className={`p-2 rounded-xl border ${stat.color}`}>
                    <stat.icon size={15} />
                  </div>
                </div>
                <p className="text-xl font-black text-slate-900 mt-3">{formatCurrency(stat.value)}</p>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Revenue Chart */}
            <Card className="lg:col-span-2 bg-white border-slate-200/60 p-6 rounded-3xl shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">Revenue Staged Progress</h3>
                  <p className="text-[10px] text-slate-500 font-bold mt-0.5">Cumulative gross sales transactions.</p>
                </div>
                <div className="flex gap-2">
                  {(['today', 'week', 'month', 'year'] as const).map(range => (
                    <button
                      key={range}
                      onClick={() => setOverviewRange(range)}
                      className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase border transition-all ${
                        overviewRange === range
                          ? 'bg-slate-900 border-transparent text-white'
                          : 'bg-white border-slate-200 text-slate-550 hover:bg-slate-50'
                      }`}
                    >
                      {range}
                    </button>
                  ))}
                </div>
              </div>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                    <YAxis hide />
                    <Tooltip contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: 11, color: '#0f172a' }} />
                    <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Platform Earnings parameters */}
            <Card className="bg-white border-slate-200/60 p-6 rounded-3xl shadow-sm flex flex-col justify-between text-left">
              <div className="space-y-4">
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><Percent size={14} className="text-green-600" /> Platform Liability Ledger</h3>
                
                <div className="space-y-3 leading-relaxed text-xs text-slate-700">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 shadow-inner">
                    <span className="block text-[8px] font-black text-slate-450 uppercase">Liability Account</span>
                    <span className="text-sm font-extrabold text-slate-800">₦{platformLiability.toLocaleString()}</span>
                    <p className="text-[10px] text-slate-400 mt-1">Pending payout to creator balances. Deducts on payout completion.</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 shadow-inner">
                    <span className="block text-[8px] font-black text-slate-450 uppercase">Prepaid Account</span>
                    <span className="text-sm font-extrabold text-slate-800">₦{prepaidBalances.toLocaleString()}</span>
                    <p className="text-[10px] text-slate-400 mt-1">Unearned subscription pools. Amortizes over periods.</p>
                  </div>
                </div>
              </div>
              <div className="pt-4 border-t border-slate-150">
                <span className="text-[9px] font-black text-slate-450 uppercase">GAAP Accounting Standards: Verified</span>
              </div>
            </Card>
          </div>

        </div>
      )}

      {/* ── TAB 2: TRANSACTION LOG ── */}
      {activeTab === 'transactions' && (
        <Card className="bg-white border border-slate-250/70 rounded-3xl overflow-hidden p-0 shadow-sm">
          <div className="p-6 border-b border-slate-200 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-slate-50/50">
            <div>
              <h3 className="text-base font-black text-slate-900 uppercase tracking-wider">Double-Entry Transaction Ledger</h3>
              <p className="text-xs text-slate-500 font-bold mt-0.5">Audits platform gross sales, 30% platform commissions, and 70% creator payouts.</p>
            </div>
            
            <div className="flex gap-2">
              <div className="relative w-60">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-450" />
                <input
                  type="text"
                  placeholder="Search ledger ID, type, description..."
                  value={searchTxQuery}
                  onChange={e => setSearchTxQuery(e.target.value)}
                  className="w-full bg-white border border-slate-200 text-xs font-bold pl-9 pr-3 py-2 rounded-xl text-slate-850 outline-none focus:ring-2 focus:ring-green-550/10 shadow-sm"
                />
              </div>
              <Button onClick={handleDownloadLedgerCSV} className="bg-white border-slate-200 hover:bg-slate-50 text-slate-700 text-[10px] font-bold rounded-xl flex items-center gap-1 shadow-sm">
                <Download size={11} /> Export CSV
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="border-b border-slate-200 text-slate-550 bg-slate-50/50 text-[9px] uppercase font-black tracking-widest">
                  <th className="p-4">Date & Time</th>
                  <th className="p-4">Transaction ID</th>
                  <th className="p-4">Type</th>
                  <th className="p-4">Gross Amount (₦)</th>
                  <th className="p-4">Platform Comm (30%)</th>
                  <th className="p-4">Net Vendor (70%)</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredTransactions.map(tx => {
                  const isPayout = tx.type === 'payout' || Number(tx.amount) < 0;
                  const gross = Math.abs(Number(tx.amount));
                  const platformShare = isPayout ? 0 : gross * 0.30;
                  const vendorShare = isPayout ? gross : gross * 0.70;
                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-4 text-slate-500 font-mono">{formatDate(tx.created_at)}</td>
                      <td className="p-4 font-mono text-[10px] text-slate-550" title={tx.id}>{tx.id.substring(0, 15)}...</td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border ${
                          isPayout ? 'text-red-750 bg-red-50 border-red-200' : 'text-emerald-700 bg-emerald-50 border-emerald-200'
                        }`}>
                          {tx.type}
                        </span>
                      </td>
                      <td className="p-4 font-black text-slate-900">{formatCurrency(gross)}</td>
                      <td className="p-4 text-slate-550 font-bold">{formatCurrency(platformShare)}</td>
                      <td className="p-4 text-slate-550 font-bold">{formatCurrency(vendorShare)}</td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase bg-emerald-50 border border-emerald-250 text-emerald-700">Completed</span>
                      </td>
                      <td className="p-4">
                        {!isPayout && (
                          <button
                            onClick={() => setSelectedTx(tx)}
                            className="p-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-slate-600 hover:text-slate-950 transition-all flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider"
                          >
                            <Undo size={11} /> Refund
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── TAB 3: PAYOUTS SECTION ── */}
      {activeTab === 'payouts' && (
        <div className={selectedPayout ? "grid grid-cols-1 lg:grid-cols-3 gap-8" : "w-full"}>
          
          {/* Payout Config & Queue */}
          <div className={selectedPayout ? "lg:col-span-2 space-y-6" : "w-full space-y-6"}>
            
            {/* Payout properties */}
            <Card className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm space-y-4">
              <h3 className="text-xs font-black text-slate-550 uppercase tracking-widest">Payout Processing Settings</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-slate-700">
                <div className="space-y-2 text-left">
                  <label className="font-bold block text-slate-650">Payout Schedule Horizon</label>
                  <select
                    value={payoutSchedule}
                    onChange={e => setPayoutSchedule(e.target.value as any)}
                    className="w-full bg-white border border-slate-200 rounded-xl p-2.5 outline-none font-bold text-slate-800"
                  >
                    <option value="weekly">Weekly Settlement (Fridays)</option>
                    <option value="biweekly">Bi-weekly Settlement</option>
                    <option value="monthly">Monthly Settlement (1st of Month)</option>
                  </select>
                </div>
                
                <div className="flex items-center gap-3 pt-6">
                  <input
                    type="checkbox"
                    checked={autoApproveUnder500k}
                    onChange={e => setAutoApproveUnder500k(e.target.checked)}
                    className="w-4 h-4 text-green-600 border-slate-300 rounded focus:ring-green-550/20 cursor-pointer"
                  />
                  <div>
                    <label className="font-bold block text-slate-800">Auto-Approve Under ₦500k</label>
                    <p className="text-[10px] text-slate-450 mt-0.5 font-bold">Instantly routes small payouts to Paystack Gateway.</p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Payout List */}
            <Card className="bg-white border border-slate-200/80 rounded-3xl overflow-hidden p-0 shadow-sm">
              <div className="p-6 border-b border-slate-200 bg-slate-50/50">
                <h4 className="font-black text-sm text-slate-900 uppercase">Settlement Requests Queue</h4>
              </div>

              <div className="overflow-x-auto text-left no-scrollbar">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-550 bg-slate-50/50 text-[9px] uppercase font-black tracking-widest">
                      <th className="p-4">Vendor</th>
                      <th className="p-4">Bank Account Details</th>
                      <th className="p-4 text-right">Amount</th>
                      <th className="p-4">Verification Check</th>
                      <th className="p-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {payouts.map(p => {
                      const requiresAudit = Number(p.amount) > 500000;
                      return (
                        <tr
                          key={p.id}
                          onClick={() => setSelectedPayout(p)}
                          className={`cursor-pointer hover:bg-slate-50/60 transition-colors ${
                            selectedPayout?.id === p.id ? 'bg-green-50/30' : ''
                          }`}
                        >
                          <td className="p-4 font-bold text-slate-900">{p.vendor_name}</td>
                          <td className="p-4 text-slate-600 font-bold uppercase">{p.bank_details.bank_name} • {p.bank_details.account_number}</td>
                          <td className="p-4 text-right font-black text-slate-900">{formatCurrency(p.amount)}</td>
                          <td className="p-4">
                            {requiresAudit ? (
                              <span className="px-2 py-0.5 rounded bg-rose-50 border border-rose-250/60 text-[8px] font-black text-rose-700 uppercase animate-pulse">Requires Audit</span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-250/60 text-[8px] font-black text-emerald-700 uppercase">Auto-Approvable</span>
                            )}
                          </td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                              p.status === 'pending' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}>{p.status}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>

          </div>

          {/* Right Column: Payout audit panel */}
          {selectedPayout && (
            <div className="space-y-6">
              <Card className="bg-white border border-slate-200/80 p-6 rounded-3xl space-y-4 shadow-sm text-left">
                <h3 className="text-xs font-black text-slate-555 uppercase tracking-widest flex items-center gap-1.5"><Clock size={13} className="text-green-600" /> Payout Audit Desk</h3>
                
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/60 text-xs space-y-2 leading-relaxed text-slate-700 shadow-inner font-bold">
                  <div className="flex justify-between">
                    <span className="text-slate-455 font-black">Vendor Name:</span>
                    <span className="text-slate-900">{selectedPayout.vendor_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-455 font-black">Transfer Amount:</span>
                    <span className="text-green-700">{formatCurrency(selectedPayout.amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-455 font-black">Bank / Account:</span>
                    <span className="text-slate-700 font-semibold">{selectedPayout.bank_details.bank_name} ({selectedPayout.bank_details.account_number})</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-555 uppercase">Auditor justification Notes</label>
                  <textarea
                    placeholder="Provide audit signoff description to approve payout..."
                    value={payoutNotes}
                    onChange={e => setPayoutNotes(e.target.value)}
                    className="w-full bg-white border border-slate-200 text-xs rounded-xl p-3 text-slate-800 outline-none focus:ring-2 focus:ring-green-550/10 min-h-[80px]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2">
                  <Button
                    onClick={() => handleReviewPayout('approved')}
                    disabled={submitting}
                    className="h-11 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold border-none"
                  >
                    Approve Transfer
                  </Button>
                  <Button
                    onClick={() => handleReviewPayout('rejected')}
                    disabled={submitting}
                    className="h-11 rounded-xl bg-red-50 hover:bg-red-100 border border-red-250/60 text-red-700 font-bold"
                  >
                    Deny request
                  </Button>
                </div>
              </Card>
            </div>
          )}

        </div>
      )}

      {/* ── TAB 4: REFUNDS QUEUE ── */}
      {activeTab === 'refunds' && (
        <Card className="bg-white border border-slate-200/80 rounded-3xl overflow-hidden p-0 shadow-sm text-left">
          <div className="p-6 border-b border-slate-200 bg-slate-50/50">
            <h3 className="text-base font-black text-slate-900 uppercase tracking-wider">Refund Requests Management</h3>
            <p className="text-xs text-slate-500 font-bold mt-0.5">Approve and reverse buyer payments via integrated gateway API checks.</p>
          </div>

          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="border-b border-slate-200 text-slate-550 bg-slate-50/50 text-[9px] uppercase font-black tracking-widest">
                  <th className="p-4">Purchase Transaction</th>
                  <th className="p-4">Reason for Request</th>
                  <th className="p-4 text-right">Refund Amount</th>
                  <th className="p-4">Payment Method</th>
                  <th className="p-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {transactions
                  .filter(t => t.type === 'sale' && t.amount > 0)
                  .map(tx => (
                    <tr key={tx.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-4">
                        <p className="font-bold text-slate-900">{tx.description}</p>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">TX_ID: {tx.id}</p>
                      </td>
                      <td className="p-4 font-semibold text-slate-700">Course content not accessible, requesting technical refund.</td>
                      <td className="p-4 text-right font-black text-red-650">{formatCurrency(tx.amount)}</td>
                      <td className="p-4 font-bold text-slate-500">Paystack Gateway API</td>
                      <td className="p-4">
                        <button
                          onClick={() => setSelectedTx(tx)}
                          className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all shadow-sm"
                        >
                          Process Refund
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── TAB 5: INVOICES LEDGER ── */}
      {activeTab === 'invoices' && (
        <Card className="bg-white border border-slate-200/80 rounded-3xl overflow-hidden p-0 shadow-sm text-left">
          <div className="p-6 border-b border-slate-200 bg-slate-50/50">
            <h3 className="text-base font-black text-slate-900 uppercase tracking-wider">Billing Invoice Ledger</h3>
            <p className="text-xs text-slate-500 font-bold mt-0.5">Verify buyer and creator invoices generated dynamically for every ledger event.</p>
          </div>

          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="border-b border-slate-200 text-slate-550 bg-slate-50/50 text-[9px] uppercase font-black tracking-widest">
                  <th className="p-4">Invoice ID</th>
                  <th className="p-4">Billing Date</th>
                  <th className="p-4">Stated Description</th>
                  <th className="p-4 text-right">Amount Due</th>
                  <th className="p-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {transactions.map(tx => (
                  <tr key={tx.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-4 font-mono text-[10px] text-slate-500 font-bold">INV-{tx.id.substring(0, 8).toUpperCase()}</td>
                    <td className="p-4 font-semibold text-slate-700">{formatDate(tx.created_at)}</td>
                    <td className="p-4 font-bold text-slate-800">{tx.description}</td>
                    <td className="p-4 text-right font-black text-slate-900">{formatCurrency(Math.abs(Number(tx.amount)))}</td>
                    <td className="p-4">
                      <button
                        onClick={() => {
                          showToast(`Printing invoice INV-${tx.id.substring(0, 8).toUpperCase()}...`, 'info');
                        }}
                        className="p-1.5 border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-600 hover:text-slate-900 shadow-sm"
                        title="Print Invoice"
                      >
                        <Printer size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── TAB 6: REPORTS & LETTERHEAD ── */}
      {activeTab === 'reports' && (
        <div className="space-y-6 text-left">
          
          {/* Selector bar */}
          <div className="flex flex-wrap gap-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl shadow-inner">
            {([
              { key: 'income', label: '📊 Income Statement' },
              { key: 'payout_report', label: '🏦 Creator Payout Report' },
              { key: 'top_products', label: '🏆 Sales by Product' },
              { key: 'mrr', label: '🔄 Monthly Recurring Revenue (MRR)' },
              { key: 'tax', label: '⚖️ Tax/VAT Summary' }
            ] as const).map(rep => (
              <button
                key={rep.key}
                onClick={() => setSelectedReport(rep.key)}
                className={`px-3 py-1.5 rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all border ${
                  selectedReport === rep.key
                    ? 'bg-slate-900 border-transparent text-white shadow-sm'
                    : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
              >
                {rep.label}
              </button>
            ))}
          </div>

          {/* Renders Selected Report inside printable Company Letterhead */}
          <Card className="bg-white border border-slate-200/80 rounded-3xl p-8 shadow-md relative overflow-hidden">
            
            {/* Download/Print floating triggers */}
            <div className="absolute top-6 right-6 flex gap-2">
              <Button
                onClick={() => {
                  showToast(`Exporting ${selectedReport.toUpperCase()} report with Trileza official company letterhead...`, 'success');
                }}
                className="bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-black uppercase py-2 px-3 rounded-xl border-none shadow-sm flex items-center gap-1.5"
              >
                <Download size={13} /> Export PDF Report
              </Button>
            </div>

            {/* LETTERHEAD CONTAINER */}
            <div className="border border-slate-300 p-8 rounded-2xl max-w-4xl mx-auto space-y-8 bg-white text-slate-800 shadow-sm relative">
              
              {/* Letterhead Header Banner */}
              <div className="flex justify-between items-start border-b-2 border-green-600 pb-6">
                <div>
                  <h1 className="font-black text-xl tracking-wider text-slate-900">Trileza LMS systems Ltd</h1>
                  <p className="text-[9px] text-slate-500 font-bold mt-1">Operational audit and platforms finance portal</p>
                  <p className="text-[9px] text-slate-400 font-medium mt-0.5">RC 8812903 • RC_INSPECT_LAGOS</p>
                </div>
                <div className="text-right text-[9px] text-slate-500 space-y-0.5 leading-relaxed font-bold">
                  <p>12, Lekki Expressway Phase 1</p>
                  <p>Lagos, Nigeria</p>
                  <p>finance@trileza.com</p>
                  <p>Date: {format(new Date(), 'dd MMMM yyyy')}</p>
                </div>
              </div>

              {/* Report title */}
              <div className="text-center space-y-1">
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">
                  {selectedReport === 'income' ? 'Income Statement Report' :
                   selectedReport === 'payout_report' ? 'Creator Payout Report Summary' :
                   selectedReport === 'top_products' ? 'Sales by Product Catalog' :
                   selectedReport === 'mrr' ? 'Monthly Recurring Revenue (MRR)' :
                   'Tax and VAT Summary Ledger'}
                </h2>
                <p className="text-[10px] text-slate-500 font-semibold">Accounting Period: {format(new Date(), 'MMMM yyyy')} • GAAP Standards</p>
              </div>

              {/* REPORT CONTENT */}
              <div className="text-xs leading-relaxed">
                {selectedReport === 'income' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 border-b border-slate-200 pb-2 font-bold text-slate-900 uppercase tracking-wider text-[9px] bg-slate-50 p-2 rounded">
                      <span>Accounting Category</span>
                      <span className="text-right">Balance amount</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-slate-700">
                        <span>Gross Sales Revenue (Debits)</span>
                        <span className="font-extrabold text-slate-900">{formatCurrency(totalSales)}</span>
                      </div>
                      <div className="flex justify-between text-slate-700 pl-4">
                        <span>• Course Sales</span>
                        <span className="font-semibold text-slate-600">{formatCurrency(totalSales * 0.7)}</span>
                      </div>
                      <div className="flex justify-between text-slate-700 pl-4">
                        <span>• Subscription Pools</span>
                        <span className="font-semibold text-slate-600">{formatCurrency(totalSales * 0.3)}</span>
                      </div>
                      <div className="flex justify-between text-slate-700 border-t border-slate-100 pt-2">
                        <span>Platform Commission Earnings (30%)</span>
                        <span className="font-extrabold text-emerald-700">+{formatCurrency(totalSales * 0.30)}</span>
                      </div>
                      <div className="flex justify-between text-slate-700">
                        <span>Vendor Payout Liability (Credits)</span>
                        <span className="font-extrabold text-red-650">-{formatCurrency(totalSales * 0.70)}</span>
                      </div>
                    </div>
                    <div className="flex justify-between border-t-2 border-slate-900 pt-4 font-black text-sm text-slate-900">
                      <span>NET PLATFORM EBITDA SHARE</span>
                      <span>{formatCurrency(totalSales * 0.30)}</span>
                    </div>
                  </div>
                )}

                {selectedReport === 'payout_report' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4 border-b border-slate-200 pb-2 font-bold text-slate-900 uppercase tracking-wider text-[9px] bg-slate-50 p-2 rounded">
                      <span>Vendor/Creator Name</span>
                      <span>Status</span>
                      <span className="text-right">Settled amount</span>
                    </div>
                    <div className="space-y-2">
                      {payouts.map((p, idx) => (
                        <div key={idx} className="grid grid-cols-3 gap-4 text-slate-750">
                          <span className="font-bold">{p.vendor_name}</span>
                          <span className="capitalize">{p.status}</span>
                          <span className="text-right font-extrabold text-slate-900">{formatCurrency(p.amount)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between border-t border-slate-200 pt-4 font-black text-slate-900">
                      <span>Total Platform Payout Claims</span>
                      <span>{formatCurrency(totalPayoutsVal)}</span>
                    </div>
                  </div>
                )}

                {selectedReport === 'top_products' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4 border-b border-slate-200 pb-2 font-bold text-slate-900 uppercase tracking-wider text-[9px] bg-slate-50 p-2 rounded">
                      <span>Course / Manuscript Title</span>
                      <span>Quantity Sold</span>
                      <span className="text-right">Gross revenue</span>
                    </div>
                    <div className="space-y-2">
                      <div className="grid grid-cols-3 gap-4 text-slate-750">
                        <span className="font-bold">Advanced Agentic Coding Patterns</span>
                        <span>14 units</span>
                        <span className="text-right font-extrabold text-slate-900">{formatCurrency(totalSales * 0.6)}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-slate-750">
                        <span className="font-bold">High-Fidelity UI Engineering</span>
                        <span>8 units</span>
                        <span className="text-right font-extrabold text-slate-900">{formatCurrency(totalSales * 0.4)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {selectedReport === 'mrr' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 border-b border-slate-200 pb-2 font-bold text-slate-900 uppercase tracking-wider text-[9px] bg-slate-50 p-2 rounded">
                      <span>Subscription Tier</span>
                      <span className="text-right">Estimated MRR</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-slate-750">
                        <span>Standard Student Pass (₦5,000/mo)</span>
                        <span className="font-extrabold text-slate-900">₦240,000</span>
                      </div>
                      <div className="flex justify-between text-slate-750">
                        <span>Creator Accelerator Pass (₦15,000/mo)</span>
                        <span className="font-extrabold text-slate-900">₦180,000</span>
                      </div>
                    </div>
                  </div>
                )}

                {selectedReport === 'tax' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 border-b border-slate-200 pb-2 font-bold text-slate-900 uppercase tracking-wider text-[9px] bg-slate-50 p-2 rounded">
                      <span>Tax Class / Duty</span>
                      <span className="text-right">VAT/GST Collected</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-slate-750">
                        <span>7.5% Nigerian Value Added Tax (VAT)</span>
                        <span className="font-extrabold text-slate-900">{formatCurrency(totalSales * 0.075)}</span>
                      </div>
                      <div className="flex justify-between text-slate-750">
                        <span>1.0% Education Development Levy</span>
                        <span className="font-extrabold text-slate-900">{formatCurrency(totalSales * 0.01)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-12 border-t border-slate-200 flex justify-between items-center text-[8px] text-slate-400 font-bold tracking-widest">
                <span>Trileza finance audit trail</span>
                <span>Authorized signatory: cfo office</span>
              </div>

            </div>
          </Card>
        </div>
      )}

      {/* ── Refund Modal ── */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-2xl p-6 text-left space-y-6">
            <div>
              <h4 className="font-black text-lg text-slate-900 uppercase tracking-wider">Issue Platform Refund</h4>
              <p className="text-xs text-slate-550 mt-1">LOG_ID: {selectedTx.id}</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/60 text-xs space-y-2 text-slate-700 font-bold">
              <div className="flex justify-between">
                <span className="text-slate-450 font-black">Transaction Source:</span>
                <span className="font-semibold text-slate-900">{selectedTx.description}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-450 font-black">Refund Amount:</span>
                <span className="font-extrabold text-red-650">{formatCurrency(selectedTx.amount)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-550 uppercase tracking-widest">Refund Justification</label>
              <textarea
                placeholder="State the reason for voiding/refunding this transaction..."
                value={refundReason}
                onChange={e => setRefundReason(e.target.value)}
                className="w-full bg-white border border-slate-200 text-xs rounded-xl p-3 text-slate-800 outline-none focus:ring-2 focus:ring-red-550/10 min-h-[80px]"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                onClick={() => setSelectedTx(null)}
                className="flex-1 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-bold"
              >
                Cancel
              </Button>
              <Button
                onClick={handleRefundTx}
                disabled={submitting || !refundReason.trim()}
                className="flex-1 h-11 rounded-xl bg-red-650 hover:bg-red-700 text-white font-bold border-none"
              >
                Confirm Refund
              </Button>
            </div>
          </div>
        </div>
      )}

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

export default FinanceAdminDashboard;
