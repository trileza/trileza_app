/**
 * The reading experience — bookmarks, highlights, notes and progress.
 *
 * Opening a book goes through the backend first. The proposal is explicit
 * about why: "For a borrowed license, the reader should check authorization
 * through the backend. Hiding a button in the frontend is not a security
 * control." So openBook() decides, and the component renders whatever it is
 * told — including the refusal.
 */

import { nexus, errorMessage } from '../nexus';

export interface OpenBookResult {
  allowed: boolean;
  /** ok | expired | no_license — each calls for a different next step. */
  reason: string;
  license_type: string | null;
  expires_at: string | null;
  days_left: number | null;
  last_position: string | null;
  percent_read: number;
  session_id: string | null;
}

export interface Bookmark {
  id: string;
  book_id: string;
  position: string;
  page_index: number | null;
  label: string | null;
  created_at: string;
}

export interface Highlight {
  id: string;
  book_id: string;
  passage_text: string;
  comment: string | null;
  color: string | null;
  created_at: string;
}

export interface ReaderNote {
  id: string;
  book_id: string;
  page_index: number | null;
  text: string;
  created_at: string;
}

const first = <T,>(data: unknown): T | null =>
  Array.isArray(data) ? ((data[0] as T) ?? null) : ((data as T) ?? null);

export const readerService = {
  /**
   * Asks whether this book may be opened, and where to resume.
   *
   * Also opens a reading session, so the author's read-through figures and any
   * abuse detection have something to count. Session records that a licence
   * was exercised and for how long — not what was read.
   */
  async openBook(userId: string, bookId: string): Promise<OpenBookResult> {
    const { data, error } = await nexus.database.rpc('open_book', {
      p_user_id: userId,
      p_book_id: bookId
    });

    if (error) {
      throw new Error(errorMessage(error, 'This book could not be opened.'));
    }

    const row = first<OpenBookResult>(data);
    if (!row) {
      return {
        allowed: false, reason: 'no_license', license_type: null,
        expires_at: null, days_left: null, last_position: null,
        percent_read: 0, session_id: null
      };
    }
    return row;
  },

  /** Ends a reading session. Failures are ignored — this is bookkeeping. */
  async closeSession(sessionId: string | null): Promise<void> {
    if (!sessionId) return;
    try {
      await nexus.database.rpc('close_reading_session', { p_session_id: sessionId });
    } catch {
      /* A lost session record must not interrupt reading. */
    }
  },

  /** Where the reader got to. Called as they move, so it is deliberately cheap. */
  async saveProgress(userId: string, bookId: string, percent: number, position?: string) {
    try {
      await nexus.database.from('reading_progress').upsert(
        {
          user_id: userId,
          book_id: bookId,
          percent_read: Math.max(0, Math.min(100, Math.round(percent * 100) / 100)),
          last_position: position ?? null,
          last_read_at: new Date().toISOString()
        },
        { onConflict: 'user_id,book_id' }
      );
    } catch (err) {
      console.warn('[Reader] Could not save progress:', err);
    }
  },

  // ── Bookmarks ────────────────────────────────────────────────────────

  async listBookmarks(userId: string, bookId: string): Promise<Bookmark[]> {
    const { data, error } = await nexus.database
      .from('book_bookmarks')
      .select('*')
      .eq('user_id', userId)
      .eq('book_id', bookId)
      .order('page_index', { ascending: true });

    if (error) throw error;
    return (data ?? []) as Bookmark[];
  },

  /**
   * Marks a place. Unique on (user, book, position), so pressing the button
   * twice on the same page does not stack duplicates.
   */
  async addBookmark(userId: string, bookId: string, position: string, pageIndex?: number, label?: string) {
    const { data, error } = await nexus.database
      .from('book_bookmarks')
      .insert([{
        user_id: userId,
        book_id: bookId,
        position,
        page_index: pageIndex ?? null,
        label: label ?? null
      }])
      .select()
      .single();

    if (error) {
      // A duplicate is the user asking for something they already have, not a
      // failure worth surfacing.
      if (String(error.message || '').includes('duplicate')) return null;
      throw new Error(errorMessage(error, 'Could not add that bookmark.'));
    }
    return data as Bookmark;
  },

  async removeBookmark(id: string) {
    const { error } = await nexus.database.from('book_bookmarks').delete().eq('id', id);
    if (error) throw error;
  },

  // ── Highlights ───────────────────────────────────────────────────────

  async listHighlights(userId: string, bookId: string): Promise<Highlight[]> {
    const { data, error } = await nexus.database
      .from('api_highlights')
      .select('*')
      .eq('user_id', userId)
      .eq('book_id', bookId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []) as Highlight[];
  },

  async addHighlight(userId: string, bookId: string, passage: string, comment?: string, color = 'amber') {
    const { data, error } = await nexus.database
      .from('api_highlights')
      .insert([{
        id: `h-${Date.now()}`,
        user_id: userId,
        book_id: bookId,
        passage_text: passage,
        comment: comment ?? null,
        color
      }])
      .select()
      .single();

    if (error) throw new Error(errorMessage(error, 'Could not save that highlight.'));
    return data as Highlight;
  },

  async removeHighlight(id: string) {
    const { error } = await nexus.database.from('api_highlights').delete().eq('id', id);
    if (error) throw error;
  },

  // ── Notes ────────────────────────────────────────────────────────────

  async listNotes(userId: string, bookId: string): Promise<ReaderNote[]> {
    const { data, error } = await nexus.database
      .from('api_comments')
      .select('*')
      .eq('user_id', userId)
      .eq('book_id', bookId)
      .order('page_index', { ascending: true });

    if (error) throw error;
    return (data ?? []) as ReaderNote[];
  },

  async addNote(userId: string, userName: string, bookId: string, text: string, pageIndex?: number) {
    const { data, error } = await nexus.database
      .from('api_comments')
      .insert([{
        id: `n-${Date.now()}`,
        user_id: userId,
        user_name: userName,
        book_id: bookId,
        page_index: pageIndex ?? null,
        text
      }])
      .select()
      .single();

    if (error) throw new Error(errorMessage(error, 'Could not save that note.'));
    return data as ReaderNote;
  },

  async removeNote(id: string) {
    const { error } = await nexus.database.from('api_comments').delete().eq('id', id);
    if (error) throw error;
  }
};
