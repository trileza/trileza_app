/**
 * Book licensing — the Worthy of Note model.
 *
 * The product's central distinction: a book is the content, a licence is what
 * a user may do with it. Everything here is about licences.
 *
 * Two rules drive the whole surface, and both are enforced in the database
 * rather than here:
 *
 *   A mentee buys or asks a mentor. They cannot borrow for themselves.
 *   A mentor buys for themselves, buys for a mentee, or borrows for a mentee.
 *
 * The proposal is explicit that hiding a button is not a security control, so
 * these functions describe what the UI should offer; the backend decides what
 * actually happens.
 */

import { nexus, errorMessage } from '../nexus';

/** What the current user may do with a given book. */
export interface BookActions {
  can_buy_self: boolean;
  can_buy_for_mentee: boolean;
  can_borrow_for_mentee: boolean;
  can_request: boolean;
  can_read: boolean;
  is_mentor: boolean;
  already_owns: boolean;
  has_active_loan: boolean;
}

/** A row of My Library, already sorted into its section. */
export interface LibraryEntry {
  book_id: string;
  title: string;
  author_name: string;
  cover_url: string;
  /** owned | borrowed | expiring | expired */
  section: string;
  license_type: 'owned' | 'borrowed' | 'granted';
  status: string;
  expires_at: string | null;
  days_left: number | null;
  payer_id: string;
  /** True when someone else paid — a mentor sponsorship. */
  sponsored: boolean;
  percent_read: number;
}

/** One sponsorship, from the paying mentor's point of view. */
export interface Sponsorship {
  license_id: string;
  book_id: string;
  title: string;
  cover_url: string;
  mentee_id: string;
  mentee_name: string;
  license_type: string;
  status: string;
  expires_at: string | null;
  days_left: number | null;
  percent_read: number;
  amount_minor: number;
  credit_minor: number;
}

export interface Mentee {
  mentee_id: string;
  full_name: string;
  email?: string;
}

const unwrap = <T,>(data: unknown): T[] =>
  Array.isArray(data) ? (data as T[]) : data ? [data as T] : [];

export const licensingService = {
  /**
   * Which actions to offer for this book.
   *
   * The proposal states the library should not display actions a role cannot
   * initiate, so the book page renders from this rather than from role guesses
   * scattered through the component.
   */
  async getBookActions(userId: string, bookId: string): Promise<BookActions | null> {
    const { data, error } = await nexus.database.rpc('book_actions_for_user', {
      p_user_id: userId,
      p_book_id: bookId
    });
    if (error) throw new Error(errorMessage(error, 'Could not check your access.'));
    return unwrap<BookActions>(data)[0] ?? null;
  },

  /** Whether the reader should serve this book. Decided server-side. */
  async canRead(userId: string, bookId: string): Promise<boolean> {
    const { data, error } = await nexus.database.rpc('can_read_book', {
      p_user_id: userId,
      p_book_id: bookId
    });
    if (error) return false;
    return data === true;
  },

  /**
   * My Library, in the proposal's sections.
   *
   * Sweeps lapsed loans first, so a book that expired while the page was
   * closed is filed under Expired rather than still showing as Borrowed.
   */
  async myLibrary(userId: string): Promise<LibraryEntry[]> {
    // try/catch rather than .catch(): the SDK returns a builder, not a
    // promise, until awaited — calling .catch() on it throws. A failed sweep
    // must not stop the library rendering.
    try {
      await nexus.database.rpc('expire_lapsed_licenses', {});
    } catch (sweepErr) {
      console.warn('[Licensing] Could not sweep lapsed loans:', sweepErr);
    }

    const { data, error } = await nexus.database.rpc('my_library', { p_user_id: userId });
    if (error) throw new Error(errorMessage(error, 'Could not load your library.'));
    return unwrap<LibraryEntry>(data);
  },

  /** What a mentor has sponsored, and how it is going. */
  async mentorSponsorships(mentorId: string): Promise<Sponsorship[]> {
    const { data, error } = await nexus.database.rpc('mentor_sponsorships', {
      p_mentor_id: mentorId
    });
    if (error) throw new Error(errorMessage(error, 'Could not load your sponsorships.'));
    return unwrap<Sponsorship>(data);
  },

  /** The mentees a mentor may sponsor. */
  async myMentees(mentorId: string): Promise<Mentee[]> {
    const { data, error } = await nexus.database
      .from('mentor_mentees')
      .select('mentee_id')
      .eq('mentor_id', mentorId)
      .eq('status', 'active');

    if (error) throw error;
    const ids = (data ?? []).map((r: any) => r.mentee_id);
    if (ids.length === 0) return [];

    const { data: profiles } = await nexus.database
      .from('profiles')
      .select('id, full_name, email')
      .in('id', ids);

    return (profiles ?? []).map((p: any) => ({
      mentee_id: p.id,
      full_name: p.full_name || p.email || 'Mentee',
      email: p.email
    }));
  },

  /** The mentors a mentee may ask. */
  async myMentors(menteeId: string): Promise<Mentee[]> {
    const { data, error } = await nexus.database
      .from('mentor_mentees')
      .select('mentor_id')
      .eq('mentee_id', menteeId)
      .eq('status', 'active');

    if (error) throw error;
    const ids = (data ?? []).map((r: any) => r.mentor_id);
    if (ids.length === 0) return [];

    const { data: profiles } = await nexus.database
      .from('profiles')
      .select('id, full_name, email')
      .in('id', ids);

    return (profiles ?? []).map((p: any) => ({
      mentee_id: p.id,
      full_name: p.full_name || p.email || 'Mentor',
      email: p.email
    }));
  },

  /**
   * "Ask my mentor to get this."
   *
   * RLS refuses a request naming a mentor the user is not actually paired
   * with, so this cannot be used to message strangers.
   */
  async requestFromMentor(bookId: string, menteeId: string, mentorId: string, message?: string) {
    const { data, error } = await nexus.database
      .from('book_requests')
      .insert([{ book_id: bookId, mentee_id: menteeId, mentor_id: mentorId, message: message || null }])
      .select()
      .single();

    if (error) throw new Error(errorMessage(error, 'Could not send your request.'));
    return data;
  },

  /** Requests waiting on this mentor. */
  async pendingRequests(mentorId: string) {
    const { data, error } = await nexus.database
      .from('book_requests')
      .select('*')
      .eq('mentor_id', mentorId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  },

  /** Requests a mentee has sent. */
  async myRequests(menteeId: string) {
    const { data, error } = await nexus.database
      .from('book_requests')
      .select('*')
      .eq('mentee_id', menteeId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  },

  /** A mentor declines a request. Fulfilment happens through payment instead. */
  async declineRequest(requestId: string) {
    const { error } = await nexus.database
      .from('book_requests')
      .update({ status: 'declined', resolved_at: new Date().toISOString() })
      .eq('id', requestId);
    if (error) throw error;
  },

  /** Saves where the reader got to. */
  async saveProgress(userId: string, bookId: string, percent: number, position?: string) {
    const { error } = await nexus.database
      .from('reading_progress')
      .upsert(
        {
          user_id: userId,
          book_id: bookId,
          percent_read: Math.max(0, Math.min(100, percent)),
          last_position: position || null,
          last_read_at: new Date().toISOString()
        },
        { onConflict: 'user_id,book_id' }
      );
    if (error) console.error('[Licensing] Could not save reading progress:', error);
  },

  /** How much ownership credit a borrow-to-own book has accumulated. */
  async ownershipCredit(userId: string, bookId: string): Promise<number> {
    const { data, error } = await nexus.database
      .from('ownership_credits')
      .select('credit_minor')
      .eq('beneficiary_id', userId)
      .eq('book_id', bookId)
      .eq('status', 'available');

    if (error) return 0;
    return (data ?? []).reduce((sum: number, r: any) => sum + Number(r.credit_minor || 0), 0);
  }
};
