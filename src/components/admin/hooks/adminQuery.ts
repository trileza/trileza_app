import { nexus } from '../../../lib/nexus';

/**
 * Bounded reads for the admin consoles.
 *
 * Every console fetched whole tables — `.from('profiles').select('*')` with no
 * limit — and re-ran that fetch on every realtime event. At a few hundred rows
 * that is invisible; at the scale the platform is being built for it means
 * megabytes per keystroke-triggered refresh, a browser tab that stalls, and a
 * database doing sequential scans for data nobody is looking at.
 *
 * These helpers make the bound explicit and, where the UI only needs a number,
 * fetch the number instead of the rows.
 */

/** Largest page an admin list will pull in one request. */
export const ADMIN_PAGE_SIZE = 100;

/**
 * The ceiling for a "load everything" admin view. Past this the console shows
 * the newest rows and says so, rather than silently truncating.
 */
export const ADMIN_MAX_ROWS = 1000;

export interface BoundedResult<T> {
  rows: T[];
  /** Total matching rows in the database, not the number returned. */
  total: number;
  /** True when `rows` is only the newest slice of a larger set. */
  truncated: boolean;
}

/**
 * Read at most `limit` rows plus an exact total count.
 *
 * `configure` receives the query builder so callers can add filters, ordering
 * and column selection without this helper knowing about any particular table.
 */
export async function fetchBounded<T = any>(
  table: string,
  configure?: (query: any) => any,
  limit: number = ADMIN_MAX_ROWS,
  columns: string = '*'
): Promise<BoundedResult<T>> {
  let query = nexus.database.from(table).select(columns, { count: 'exact' });
  if (configure) query = configure(query);

  const { data, error, count } = await query.limit(limit);
  if (error) throw error;

  const rows = (data || []) as T[];
  const total = typeof count === 'number' ? count : rows.length;
  return { rows, total, truncated: total > rows.length };
}

/**
 * Count rows without transferring them. Use for dashboard tiles, badges and
 * any "N pending" figure — fetching thousands of rows to call `.length` on
 * them is the single most common cause of admin lag.
 */
export async function fetchCount(
  table: string,
  configure?: (query: any) => any
): Promise<number> {
  let query = nexus.database.from(table).select('id', { count: 'exact', head: true });
  if (configure) query = configure(query);

  const { count, error } = await query;
  if (error) throw error;
  return count || 0;
}

/**
 * One page of a table, for server-side paginated lists.
 */
export async function fetchPage<T = any>(
  table: string,
  page: number,
  pageSize: number = ADMIN_PAGE_SIZE,
  configure?: (query: any) => any,
  columns: string = '*'
): Promise<BoundedResult<T>> {
  const from = Math.max(0, (page - 1) * pageSize);
  const to = from + pageSize - 1;

  let query = nexus.database.from(table).select(columns, { count: 'exact' });
  if (configure) query = configure(query);

  const { data, error, count } = await query.range(from, to);
  if (error) throw error;

  const rows = (data || []) as T[];
  const total = typeof count === 'number' ? count : rows.length;
  return { rows, total, truncated: total > to + 1 };
}
