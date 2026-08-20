/**
 * Trileza Offline Reading Cache Utility
 * ─────────────────────────────────────────────────────────────
 * Caches book metadata and extracted text pages to localStorage
 * so that users can read blueprints offline when network is down.
 */

export interface CachedBook {
  id: string;
  title: string;
  author?: string;
  cover_url?: string;
  file_url?: string;
  cachedAt: string;
}

export const offlineCache = {
  /**
   * Caches book metadata in the offline library index
   */
  cacheBookMetadata: (book: any) => {
    try {
      const existing = localStorage.getItem('trileza_offline_books');
      const list: CachedBook[] = existing ? JSON.parse(existing) : [];
      
      if (!list.some(b => b.id === book.id)) {
        list.push({
          id: book.id,
          title: book.title,
          author: book.author || book.metadata?.author || 'Unknown Author',
          cover_url: book.cover_url || book.metadata?.cover_url || '',
          file_url: book.file_url || '',
          cachedAt: new Date().toISOString()
        });
        localStorage.setItem('trileza_offline_books', JSON.stringify(list));
      }
    } catch (err) {
      console.error('[OfflineCache] Failed to cache book metadata:', err);
    }
  },

  /**
   * Retrieves all cached books metadata
   */
  getCachedBooksList: (): CachedBook[] => {
    try {
      const existing = localStorage.getItem('trileza_offline_books');
      return existing ? JSON.parse(existing) : [];
    } catch (err) {
      console.error('[OfflineCache] Failed to read cached books list:', err);
      return [];
    }
  },

  /**
   * Caches page text content for a specific book
   */
  cacheBookPages: (bookId: string, pages: Record<number, string>) => {
    try {
      const key = `trileza_book_pages_${bookId}`;
      const existingData = localStorage.getItem(key);
      const existingPages = existingData ? JSON.parse(existingData) : {};
      
      const mergedPages = {
        ...existingPages,
        ...pages
      };
      
      localStorage.setItem(key, JSON.stringify(mergedPages));
    } catch (err) {
      console.error(`[OfflineCache] Failed to cache pages for book ${bookId}:`, err);
    }
  },

  /**
   * Retrieves cached pages for a specific book
   */
  getCachedBookPages: (bookId: string): Record<number, string> => {
    try {
      const key = `trileza_book_pages_${bookId}`;
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : {};
    } catch (err) {
      console.error(`[OfflineCache] Failed to read cached pages for book ${bookId}:`, err);
      return {};
    }
  },

  /**
   * Clears cached pages and metadata for a specific book
   */
  clearBookCache: (bookId: string) => {
    try {
      localStorage.removeItem(`trileza_book_pages_${bookId}`);
      const existing = localStorage.getItem('trileza_offline_books');
      if (existing) {
        const list: CachedBook[] = JSON.parse(existing);
        const filtered = list.filter(b => b.id !== bookId);
        localStorage.setItem('trileza_offline_books', JSON.stringify(filtered));
      }
    } catch (err) {
      console.error(`[OfflineCache] Failed to clear cache for book ${bookId}:`, err);
    }
  }
};
