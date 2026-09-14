import React, { useEffect, useState, useCallback } from 'react';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Download,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { Card, Button } from '../../components/ui';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { analyticsService, type AnalyticsSnapshot } from '../../lib/services/analytics';
import { useTenant } from '../../lib/tenantContext';
import { exportToCSV } from '../../components/admin/hooks/useExport';

const COLORS = ['#43A047', '#34d399', '#6ee7b7', '#a7f3d0', '#64748b', '#cbd5e1'];

const formatNaira = (n: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);

/** Period-over-period delta, or a neutral dash when there is no prior period. */
const Delta: React.FC<{ pct: number | null }> = ({ pct }) => {
  if (pct === null) {
    return <div className="text-slate-400 text-[10px] font-bold mt-1">No prior period</div>;
  }
  const up = pct >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <div className={`flex items-center gap-1 text-[10px] font-bold mt-1 ${up ? 'text-emerald-500' : 'text-red-400'}`}>
      <Icon size={12} /> {up ? '+' : ''}{pct}%
    </div>
  );
};

const Analytics: React.FC = () => {
  const { tenant } = useTenant();
  const [snapshot, setSnapshot] = useState<AnalyticsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const snap = await analyticsService.getSnapshot(tenant?.id);
      setSnapshot(snap);
    } catch (err: any) {
      console.error('[Analytics] Failed to load snapshot:', err);
      setError(err?.message || 'Could not load analytics. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [tenant?.id]);

  useEffect(() => { load(); }, [load]);

  const handleExport = () => {
    if (!snapshot) return;
    exportToCSV(
      snapshot.series.map(p => ({
        month: p.monthKey,
        revenue_ngn: p.revenue,
        new_learners: p.learners
      })),
      [
        { key: 'month', header: 'Month' },
        { key: 'revenue_ngn', header: 'Revenue (NGN)' },
        { key: 'new_learners', header: 'New Learners' }
      ],
      `${tenant?.subdomain || 'platform'}_analytics`
    );
  };

  const monthsCovered = snapshot?.series.length ?? 6;

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-wrap justify-between items-center gap-4 px-4">
        <div>
          <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">Platform Analytics Center</h1>
          <p className="text-slate-500 font-medium text-lg mt-1">
            {tenant?.name ? `${tenant.name} · ` : ''}Live figures from enrollments and settled transactions.
          </p>
        </div>
        <div className="flex flex-wrap gap-4">
          <Button variant="outline" className="gap-2 rounded-2xl h-14 px-6 border-slate-200 dark:border-slate-700" disabled>
            <Calendar size={18} /> Last {monthsCovered} months
          </Button>
          <Button
            onClick={handleExport}
            disabled={!snapshot || snapshot.isEmpty}
            className="gap-2 bg-brand-primary hover:bg-brand-primary-hover text-white border-none shadow-xl shadow-emerald-500/20 rounded-2xl h-14 px-8 disabled:opacity-40"
          >
            <Download size={18} /> Export CSV
          </Button>
        </div>
      </div>

      {error && (
        <Card className="p-6 rounded-[2rem] border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 flex items-start gap-3">
          <AlertCircle size={20} className="text-red-500 mt-0.5 flex-none" />
          <div>
            <p className="font-bold text-red-900 dark:text-red-200">Analytics unavailable</p>
            <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
            <Button onClick={load} variant="outline" size="sm" className="mt-3 rounded-xl">Retry</Button>
          </div>
        </Card>
      )}

      {loading && !snapshot && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card className="lg:col-span-2 p-10 rounded-[3rem] border-none shadow-2xl shadow-slate-200/40 dark:shadow-none h-[560px] animate-pulse bg-slate-100 dark:bg-slate-900" />
          <Card className="p-10 rounded-[3rem] border-none h-[560px] animate-pulse bg-slate-100 dark:bg-slate-900" />
        </div>
      )}

      {snapshot && snapshot.isEmpty && !error && (
        <Card className="p-12 rounded-[3rem] border-none shadow-xl text-center">
          <BarChart3 size={40} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-xl font-black text-slate-900 dark:text-white">No activity to report yet</h3>
          <p className="text-slate-500 font-medium mt-2 max-w-md mx-auto">
            Charts appear here once learners enroll and transactions settle. Nothing is estimated — an
            empty institution shows an empty report.
          </p>
        </Card>
      )}

      {snapshot && !snapshot.isEmpty && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Growth matrix */}
          <Card className="lg:col-span-2 p-6 sm:p-10 rounded-[3rem] border-none shadow-2xl shadow-slate-200/40 dark:shadow-none">
            <div className="mb-10">
              <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Platform Growth Matrix</h3>
              <p className="text-sm text-slate-400 font-bold uppercase tracking-widest mt-1">
                Monthly revenue vs new learners
              </p>
            </div>

            <div className="h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={snapshot.series} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
                  <defs>
                    <linearGradient id="colorPrimary" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#43A047" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#43A047" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-slate-200 dark:text-slate-800" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }} dy={10} />
                  <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }} width={70} />
                  <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }} width={40} />
                  <Tooltip
                    formatter={(value: any, name: any) =>
                      name === 'revenue' ? [formatNaira(Number(value)), 'Revenue'] : [value, 'New learners']
                    }
                    contentStyle={{ borderRadius: '18px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)', padding: '14px' }}
                  />
                  <Area yAxisId="left" type="monotone" dataKey="revenue" stroke="#43A047" strokeWidth={3} fillOpacity={1} fill="url(#colorPrimary)" />
                  <Area yAxisId="right" type="monotone" dataKey="learners" stroke="#64748b" strokeWidth={2} strokeDasharray="5 5" fillOpacity={0} fill="transparent" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-10 pt-8 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-8">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Total Revenue</p>
                <p className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">{formatNaira(snapshot.totalRevenue.value)}</p>
                <Delta pct={snapshot.totalRevenue.deltaPct} />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Learners Enrolled</p>
                <p className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">{snapshot.totalLearners.value.toLocaleString()}</p>
                <Delta pct={snapshot.totalLearners.deltaPct} />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Avg Order Value</p>
                <p className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">{formatNaira(snapshot.averageOrderValue.value)}</p>
                <Delta pct={snapshot.averageOrderValue.deltaPct} />
              </div>
            </div>
          </Card>

          {/* Category distribution */}
          <div className="space-y-8">
            <Card className="p-8 rounded-[3rem] border-none shadow-2xl shadow-slate-200/40 dark:shadow-none">
              <h3 className="font-black text-xl mb-8 tracking-tight text-slate-900 dark:text-white">Enrollments by Category</h3>
              {snapshot.categories.length === 0 ? (
                <p className="text-sm text-slate-500 font-medium py-8 text-center">
                  No course enrollments in this period.
                </p>
              ) : (
                <>
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={snapshot.categories} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                        <XAxis dataKey="name" hide />
                        <Tooltip
                          cursor={{ fill: 'transparent' }}
                          contentStyle={{ borderRadius: '14px', border: 'none', boxShadow: '0 20px 40px -12px rgb(0 0 0 / 0.15)', padding: '12px' }}
                        />
                        <Bar dataKey="value" radius={[10, 10, 10, 10]}>
                          {snapshot.categories.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-8 space-y-4">
                    {snapshot.categories.map((s, i) => (
                      <div key={s.name} className="flex justify-between items-center text-sm font-bold gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-2.5 h-2.5 rounded-full flex-none" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                          <span className="text-slate-600 dark:text-slate-300 truncate">{s.name}</span>
                        </div>
                        <span className="text-slate-900 dark:text-white tabular-nums flex-none">{s.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};

export default Analytics;
