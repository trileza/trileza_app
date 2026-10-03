/**
 * Author Studio data (§22, §30.1).
 *
 * Both figures come from database functions rather than being assembled here.
 * An author with a dozen books would otherwise issue sixty round trips to draw
 * one table, and — more importantly — the headline and the per-book rows have
 * to agree. Computing revenue in the browser while the ledger says something
 * else is the exact failure the earnings work was done to end.
 */

import { nexus, errorMessage } from '../nexus';

export interface AuthorSummary {
  books_total: number;
  books_published: number;
  books_pending: number;
  purchases: number;
  borrows: number;
  active_loans: number;
  active_readers: number;
  revenue_minor: number;
  earned_minor: number;
  available_minor: number;
  paid_minor: number;
}

export interface BookAnalytics {
  book_id: string;
  title: string;
  cover_url: string | null;
  status: string;
  retail_price: number;
  purchases: number;
  borrows: number;
  active_loans: number;
  conversions: number;
  active_readers: number;
  avg_progress: number;
  completions: number;
  revenue_minor: number;
  earnings_minor: number;
}

const first = <T,>(data: unknown): T | null =>
  Array.isArray(data) ? ((data[0] as T) ?? null) : ((data as T) ?? null);

const rows = <T,>(data: unknown): T[] =>
  Array.isArray(data) ? (data as T[]) : data ? [data as T] : [];

/** Minor units to naira. Money is stored in kobo so it never meets a float. */
export const toNaira = (minor: number): number => (Number(minor) || 0) / 100;

export const authorStudio = {
  async summary(authorId: string): Promise<AuthorSummary> {
    const { data, error } = await nexus.database.rpc('author_dashboard_summary', {
      p_author_id: authorId
    });

    if (error) throw new Error(errorMessage(error, 'Could not load your figures.'));

    return (
      first<AuthorSummary>(data) ?? {
        books_total: 0, books_published: 0, books_pending: 0,
        purchases: 0, borrows: 0, active_loans: 0, active_readers: 0,
        revenue_minor: 0, earned_minor: 0, available_minor: 0, paid_minor: 0
      }
    );
  },

  async books(authorId: string): Promise<BookAnalytics[]> {
    const { data, error } = await nexus.database.rpc('author_book_analytics', {
      p_author_id: authorId
    });

    if (error) throw new Error(errorMessage(error, 'Could not load your books.'));
    return rows<BookAnalytics>(data);
  }
};

export default authorStudio;
