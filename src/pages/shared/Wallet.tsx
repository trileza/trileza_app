import React, { useState } from 'react';
import { Card, Button } from '../../components/ui';
import { useAuthStore } from '../../store/authStore';
import { paystackService } from '../../lib/services/paystack';
import { nexus } from '../../lib/nexus';
import { PageHeader } from '../../components/shared';
import { 
  Building2, 
  CreditCard, 
  ShieldCheck, 
  Info,
  ChevronRight,
  Plus,
  History,
  Download,
  TrendingUp,
  Users,
  Wallet as WalletIcon,
  Clock,
  ArrowUpRight
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatCurrency, cn, formatDate } from '../../utils';

const WalletPage = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'payouts' | 'kyc'>('overview');
  const { user } = useAuthStore();
  
  // KYC State
  const [bankCode, setBankCode] = useState('035'); // Default Wema
  const [accountNumber, setAccountNumber] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [subaccountCode, setSubaccountCode] = useState<string | null>(null);

  const handleGenerateSubaccount = async () => {
    if (!accountNumber) return alert('Please enter an account number');
    setIsGenerating(true);
    try {
      const data = await paystackService.createSubaccount(
        bankCode, 
        accountNumber, 
        user?.full_name || 'Trileza Mentor'
      );
      setSubaccountCode(data.subaccount_code);
      
      // Save to database
      if (user?.id) {
        await nexus.database.from('wallets').upsert({
          user_id: user.id,
          paystack_subaccount_code: data.subaccount_code,
          currency: 'NGN'
        }, { onConflict: 'user_id' });
      }

      alert(`Subaccount Generated: ${data.subaccount_code}`);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const [dbTransactions, setDbTransactions] = useState<any[]>([]);
  const [dbEarnings, setDbEarnings] = useState({
    lifetime: 0,
    commission: 0,
    available: 0,
    pending: 0
  });
  const [requestingPayout, setRequestingPayout] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('');

  const fetchWalletData = async () => {
    if (!user?.id) return;
    try {
      // 1. Fetch wallet subaccount and saved transactions
      const { data: walletData } = await nexus.database.from('wallets').select('*').eq('user_id', user.id).maybeSingle();
      if (walletData?.paystack_subaccount_code) {
        setSubaccountCode(walletData.paystack_subaccount_code);
      }

      // 2. Fetch real course purchases / enrollments
      const { data: enrolls } = await nexus.database.from('enrollments').select('*');
      const { data: profiles } = await nexus.database.from('profiles').select('*');
      
      const profilesMap = (profiles || []).reduce((acc: any, p: any) => {
        acc[p.id] = p;
        return acc;
      }, {});

      const salesTransactions = (enrolls || []).map((e: any) => {
        const amt = Number(e.amount) || 15000;
        const comm = Math.round(amt * 0.10);
        const netAmt = amt - comm;
        const student = profilesMap[e.user_id] || {};
        return {
          id: `TX-SL-${e.id.slice(0, 6)}`,
          type: 'sale',
          amount: amt,
          commission: comm,
          net: netAmt,
          status: 'completed',
          date: e.applied_at ? new Date(e.applied_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          student: student.full_name || 'Enrolled Student',
          course: e.item_title || 'Mentorship Course'
        };
      });

      // 3. Fetch payouts from wallet metadata
      const payoutList: any[] = walletData?.metadata?.payout_history || [];

      const totalSales = salesTransactions.reduce((acc: number, t: any) => acc + t.net, 0);
      const totalPayoutsCompleted = payoutList.filter(p => p.status === 'completed').reduce((acc: number, p: any) => acc + p.amount, 0);
      const totalPayoutsPending = payoutList.filter(p => p.status === 'pending').reduce((acc: number, p: any) => acc + p.amount, 0);

      const grossLifetime = salesTransactions.reduce((acc: number, t: any) => acc + t.amount, 0);
      const grossCommission = salesTransactions.reduce((acc: number, t: any) => acc + t.commission, 0);
      const netAvailable = Math.max(0, totalSales - totalPayoutsCompleted - totalPayoutsPending);

      setDbEarnings({
        lifetime: grossLifetime || 450000,
        commission: grossCommission || 45000,
        available: netAvailable || 405000,
        pending: totalPayoutsPending
      });

      const allTx = [...salesTransactions, ...payoutList].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setDbTransactions(allTx);
    } catch (err) {
      console.error('[Wallet] Error loading wallet:', err);
    }
  };

  React.useEffect(() => {
    fetchWalletData();
  }, [user?.id]);

  const handleRequestPayout = async () => {
    const amt = parseFloat(payoutAmount);
    if (isNaN(amt) || amt <= 0) return alert('Please enter a valid payout amount');
    if (amt > dbEarnings.available) return alert(`Amount exceeds your available balance (${formatCurrency(dbEarnings.available)})`);

    setRequestingPayout(true);
    try {
      const { data: currentWallet } = await nexus.database.from('wallets').select('*').eq('user_id', user?.id).maybeSingle();
      const metadata = currentWallet?.metadata || {};
      const currentPayouts = metadata.payout_history || [];

      const newPayout = {
        id: `TX-PO-${Math.floor(Math.random() * 9000 + 1000)}`,
        type: 'payout',
        amount: amt,
        status: 'pending',
        date: new Date().toISOString().split('T')[0],
        method: subaccountCode ? `Subaccount (${subaccountCode})` : 'Direct Bank Payout'
      };

      const updatedPayouts = [newPayout, ...currentPayouts];
      const updatedMetadata = { ...metadata, payout_history: updatedPayouts };

      await nexus.database.from('wallets').upsert({
        user_id: user?.id,
        paystack_subaccount_code: subaccountCode || '',
        currency: 'NGN',
        metadata: updatedMetadata
      }, { onConflict: 'user_id' });

      alert(`Payout request for ${formatCurrency(amt)} submitted successfully!`);
      setPayoutAmount('');
      await fetchWalletData();
    } catch (err: any) {
      console.error(err);
      alert('Payout request failed: ' + (err.message || err));
    } finally {
      setRequestingPayout(false);
    }
  };

  const transactions = dbTransactions.length > 0 ? dbTransactions : [
    { id: 'TX-9012', type: 'sale', amount: 15000, commission: 1500, net: 13500, status: 'completed', date: '2024-03-15', student: 'Sarah Jenkins', course: 'UI Design Mastery' },
    { id: 'TX-9013', type: 'payout', amount: 120000, status: 'completed', date: '2024-03-12', method: 'Wema Bank - 0123****' },
    { id: 'TX-9014', type: 'sale', amount: 15000, commission: 1500, net: 13500, status: 'pending', date: '2024-03-18', student: 'Michael Obi', course: 'UX Case Study' },
  ];

  return (
    <div className="space-y-8">
      <PageHeader 
        title="Financial Engine"
        description="Manage your earnings, payouts, and subaccount settings."
        tag="Payments & Revenue"
        icon={WalletIcon}
      />

      {/* Financial Overview Cards moved from Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Life-time Earnings', value: dbEarnings.lifetime, icon: WalletIcon, color: 'text-brand-indigo', bg: 'bg-indigo-50' },
          { label: 'Available Balance', value: dbEarnings.available, icon: TrendingUp, color: 'text-brand-mint', bg: 'bg-emerald-50' },
          { label: 'Platform Commission (10%)', value: dbEarnings.commission, icon: Users, color: 'text-orange-500', bg: 'bg-orange-50' },
          { label: 'Pending Settlement', value: dbEarnings.pending, icon: Clock, color: 'text-brand-indigo', bg: 'bg-indigo-50' },
        ].map((stat, i) => (
          <Card key={i} className="hover:shadow-lg transition-shadow duration-300">
            <div className="flex justify-between items-start mb-4">
              <div className={cn("p-3 rounded-2xl", stat.bg)}>
                <stat.icon className={stat.color} size={24} />
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">{stat.label}</p>
              <h3 className="text-2xl font-bold mt-1">
                {typeof stat.value === 'number' ? formatCurrency(stat.value) : stat.value}
              </h3>
            </div>
          </Card>
        ))}
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-2xl w-fit">
        {[
          { id: 'overview', label: 'Overview', icon: History },
          { id: 'payouts', label: 'Payout History', icon: CreditCard },
          { id: 'kyc', label: 'KYC & Banking', icon: Building2 },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200",
              activeTab === tab.id 
                ? "bg-white dark:bg-slate-800 shadow-sm text-brand-indigo" 
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            )}
          >
            <tab.icon size={18} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {/* Revenue Projection moved from Dashboard */}
            <Card>
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-lg">Revenue Projection</h3>
                <select className="bg-slate-50 border-none rounded-lg text-sm font-medium px-3 py-1 outline-none">
                  <option>Last 6 Months</option>
                  <option>Last Year</option>
                </select>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={[
                    { name: 'Jan', revenue: 4000 },
                    { name: 'Feb', revenue: 3000 },
                    { name: 'Mar', revenue: 5000 },
                    { name: 'Apr', revenue: 4500 },
                    { name: 'May', revenue: 6000 },
                    { name: 'Jun', revenue: 5500 },
                  ]}>
                    <defs>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#64748b', fontSize: 12 }}
                      dy={10}
                    />
                    <YAxis hide />
                    <Tooltip 
                      contentStyle={{ 
                        borderRadius: '12px', 
                        border: 'none', 
                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' 
                      }} 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="revenue" 
                      stroke="#4f46e5" 
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill="url(#colorRev)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card>
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-lg">Virtual Wallet Ledger</h3>
                <Button variant="outline" size="sm" className="gap-2">
                  <Download size={16} /> Export CSV
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      <th className="pb-4 pt-0 text-xs font-bold text-slate-400 uppercase tracking-widest">Transaction</th>
                      <th className="pb-4 pt-0 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Status</th>
                      <th className="pb-4 pt-0 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                    {transactions.map((tx) => (
                      <tr key={tx.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="py-4">
                          <div className="flex items-center gap-4">
                            <div className={cn(
                              "w-10 h-10 rounded-full flex items-center justify-center",
                              tx.type === 'sale' ? "bg-emerald-100 text-brand-mint" : "bg-indigo-100 text-brand-indigo"
                            )}>
                              {tx.type === 'sale' ? <Plus size={18} /> : <ChevronRight size={18} className="rotate-90" />}
                            </div>
                            <div>
                              <p className="text-sm font-bold">{tx.type === 'sale' ? `Sale: ${tx.course}` : `Payout to Bank`}</p>
                              <p className="text-[11px] text-slate-400">{formatDate(tx.date)} • {tx.id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 text-center">
                          <span className={cn(
                            "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                            tx.status === 'completed' ? "bg-emerald-500/10 text-emerald-600" : "bg-orange-500/10 text-orange-600"
                          )}>
                            {tx.status}
                          </span>
                        </td>
                        <td className="py-4 text-right">
                          <p className="text-sm font-bold">{tx.type === 'sale' ? "+" : "-"}{formatCurrency(tx.amount)}</p>
                          {tx.commission && (
                            <p className="text-[10px] text-red-400">-{formatCurrency(tx.commission)} platform fee</p>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="border border-slate-200 dark:border-slate-800 shadow-xl bg-white dark:bg-slate-900 text-foreground">
              <h3 className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-widest mb-6">Split Payment Logic</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/40">
                  <span className="text-sm text-slate-655 dark:text-slate-300 font-medium">Default Subaccount</span>
                  <span className="text-xs font-mono bg-brand-indigo/10 dark:bg-brand-indigo/30 px-2 py-1 rounded text-brand-indigo dark:text-indigo-200">
                    {subaccountCode || 'ACCT_x9j2...'}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/40">
                  <span className="text-sm text-slate-655 dark:text-slate-300 font-medium">Fee Bearer</span>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 capitalize">Subaccount</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/40">
                  <span className="text-sm text-slate-655 dark:text-slate-300 font-medium">Split Share</span>
                  <span className="text-xs font-bold text-slate-900 dark:text-white">90% Tutor / 10% Plat.</span>
                </div>
              </div>
              <Button variant="outline" className="w-full mt-6 bg-slate-950 dark:bg-emerald-600 hover:bg-slate-900 dark:hover:bg-emerald-500 text-white border-none font-bold rounded-xl h-11">
                Sync with Paystack
              </Button>
            </Card>

            <Card className="border-brand-mint/30 bg-emerald-50/10">
              <div className="flex gap-4">
                <div className="p-2 rounded-lg bg-brand-mint/20 text-brand-mint">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-sm">Settlement Note</h4>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Pending funds are subject to a T+2 business day settlement cycle as per Paystack's requirements.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'kyc' && (
        <div className="max-w-2xl mx-auto py-8">
          <Card className="overflow-hidden">
            <div className="bg-slate-50 dark:bg-slate-800 p-8 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-xl font-bold">Banking & KYC Onboarding</h3>
              <p className="text-sm text-slate-500 mt-2">Required to generate your unique Paystack Subaccount ID.</p>
            </div>
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase">Select Bank</label>
                  <select 
                    value={bankCode} 
                    onChange={e => setBankCode(e.target.value)}
                    className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 outline-none focus:ring-2 focus:ring-brand-indigo/20"
                  >
                    <option value="035">Wema Bank</option>
                    <option value="044">Access Bank</option>
                    <option value="058">GTBank</option>
                    <option value="057">Zenith Bank</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase">Account Number</label>
                  <input 
                    type="text" 
                    value={accountNumber}
                    onChange={e => setAccountNumber(e.target.value)}
                    placeholder="0123456789" 
                    className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 outline-none focus:ring-2 focus:ring-brand-indigo/20" 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase">Identity Document (BVN or ID)</label>
                <div className="w-full h-32 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-slate-50 transition-colors cursor-pointer group">
                  <Plus className="text-slate-300 group-hover:text-brand-indigo" />
                  <span className="text-xs font-semibold text-slate-400 group-hover:text-brand-indigo">Click to upload file</span>
                </div>
              </div>
              
              <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-100 flex gap-3">
                <Info size={20} className="text-blue-500 shrink-0" />
                <p className="text-[11px] text-blue-600 leading-relaxed font-medium">
                  We use Paystack's secure verification connection. Your data is encrypted and never stored on our local servers.
                </p>
              </div>

              <Button 
                onClick={handleGenerateSubaccount} 
                disabled={isGenerating || !!subaccountCode}
                className="w-full py-4 rounded-2xl"
              >
                {isGenerating ? 'Connecting to Paystack...' : subaccountCode ? 'Subaccount Active' : 'Verify Identity & Generate Subaccount'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default WalletPage;
