import { nexus } from '../nexus';

/**
 * Platform analytics computed from real rows.
 *
 * Everything here aggregates client-side over tenant-scoped selects rather than
 * calling a stored procedure, because InsForge exposes PostgREST and the row
 * counts at this stage are small. If a tenant ever outgrows that, these three
 * functions are the only place that has to change.
 */

export interface MonthPoint {
  name: string;        // 'Jan'
  monthKey: string;    // '2026-01'
  revenue: number;
  learners: number;    // distinct learners who enrolled that month
}

export interface CategorySlice {
  name: string;
  value: number;
}

export interface HeadlineMetric {
  value: number;
  /** Percent change against the preceding period of equal length. */
  deltaPct: number | null;
}

export interface AnalyticsSnapshot {
  series: MonthPoint[];
  categories: CategorySlice[];
  totalRevenue: HeadlineMetric;
  totalLearners: HeadlineMetric;
  averageOrderValue: HeadlineMetric;
  currency: string;
  isEmpty: boolean;
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const monthKeyOf = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};

/** Percent change, or null when there is no prior period to compare against. */
const delta = (current: number, previous: number): number | null => {
  if (previous <= 0) return null;
  return Number((((current - previous) / previous) * 100).toFixed(1));
};

/** The last `count` months as {key,label}, oldest first, ending with this month. */
const recentMonths = (count: number) => {
  const out: Array<{ key: string; label: string }> = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push({
      key: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`,
      label: MONTH_LABELS[d.getUTCMonth()]
    });
  }
  return out;
};

export const analyticsService = {
  /**
   * A full snapshot for the analytics page. `tenantId` scopes every query; pass
   * undefined only from a platform-wide (super admin) context.
   */
  async getSnapshot(tenantId?: string, months = 6): Promise<AnalyticsSnapshot> {
    const scope = <T extends { eq: (c: string, v: any) => T }>(q: T): T =>
      tenantId ? q.eq('tenant_id', tenantId) : q;

    const [enrollRes, txRes, courseRes] = await Promise.all([
      scope(nexus.database.from('enrollments').select('user_id, applied_at, item_id, amount') as any),
      scope(nexus.database.from('transactions').select('amount, type, status, created_at') as any),
      scope(nexus.database.from('courses').select('id, category') as any)
    ]);

    const enrollments = (enrollRes.data || []) as any[];
    const transactions = (txRes.data || []) as any[];
    const courses = (courseRes.data || []) as any[];

    const window = recentMonths(months);
    const windowKeys = new Set(window.map(m => m.key));

    // --- Monthly series -----------------------------------------------------
    const revenueByMonth = new Map<string, number>();
    const learnersByMonth = new Map<string, Set<string>>();

    transactions
      .filter(t => t.status === 'completed' && t.type === 'sale')
      .forEach(t => {
        const k = monthKeyOf(t.created_at);
        if (!k) return;
        revenueByMonth.set(k, (revenueByMonth.get(k) || 0) + Number(t.amount || 0));
      });

    enrollments.forEach(e => {
      const k = monthKeyOf(e.applied_at);
      if (!k) return;
      if (!learnersByMonth.has(k)) learnersByMonth.set(k, new Set());
      if (e.user_id) learnersByMonth.get(k)!.add(e.user_id);
    });

    const series: MonthPoint[] = window.map(m => ({
      name: m.label,
      monthKey: m.key,
      revenue: Math.round(revenueByMonth.get(m.key) || 0),
      learners: learnersByMonth.get(m.key)?.size || 0
    }));

    // --- Category distribution ---------------------------------------------
    const categoryOfCourse = new Map<string, string>();
    courses.forEach(c => categoryOfCourse.set(String(c.id), c.category || 'Uncategorised'));

    const categoryCounts = new Map<string, number>();
    enrollments.forEach(e => {
      const cat = categoryOfCourse.get(String(e.item_id));
      if (!cat) return; // enrollment in a book or programme, not a course
      categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
    });

    const categories: CategorySlice[] = Array.from(categoryCounts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    // --- Headline metrics, current window vs the one before it --------------
    const priorWindow = recentMonths(months * 2).slice(0, months);
    const priorKeys = new Set(priorWindow.map(m => m.key));

    const sumRevenue = (keys: Set<string>) =>
      Array.from(revenueByMonth.entries())
        .filter(([k]) => keys.has(k))
        .reduce((s, [, v]) => s + v, 0);

    const countLearners = (keys: Set<string>) => {
      const set = new Set<string>();
      learnersByMonth.forEach((users, k) => {
        if (keys.has(k)) users.forEach(u => set.add(u));
      });
      return set.size;
    };

    const currentRevenue = sumRevenue(windowKeys);
    const previousRevenue = sumRevenue(priorKeys);
    const currentLearners = countLearners(windowKeys);
    const previousLearners = countLearners(priorKeys);

    const paidCurrent = transactions.filter(
      t => t.status === 'completed' && t.type === 'sale' && windowKeys.has(monthKeyOf(t.created_at))
    );
    const paidPrevious = transactions.filter(
      t => t.status === 'completed' && t.type === 'sale' && priorKeys.has(monthKeyOf(t.created_at))
    );
    const aovCurrent = paidCurrent.length ? currentRevenue / paidCurrent.length : 0;
    const aovPrevious = paidPrevious.length ? previousRevenue / paidPrevious.length : 0;

    return {
      series,
      categories,
      totalRevenue: { value: Math.round(currentRevenue), deltaPct: delta(currentRevenue, previousRevenue) },
      totalLearners: { value: currentLearners, deltaPct: delta(currentLearners, previousLearners) },
      averageOrderValue: { value: Math.round(aovCurrent), deltaPct: delta(aovCurrent, aovPrevious) },
      currency: 'NGN',
      isEmpty: enrollments.length === 0 && transactions.length === 0
    };
  }
};
