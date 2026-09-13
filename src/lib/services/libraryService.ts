import { nexus } from '../nexus';
import { useAuthStore } from '../../store/authStore';

export interface Book {
  id: string;
  title: string;
  author_id: string;
  author_name: string;
  cover_url: string;
  retail_price: number;
  rental_price: number;
  category: string;
  description: string;
  rating: number;
  section: string;
  language: string;
  publication_date: string;
  pages: number | null;
  age_rating: string;
  isbn: string;
  tags: string[];
  sample_pages: string[];
  file_url?: string;
  book_file_name?: string;
  material_type: string; // 'book', 'journal', 'article'
  volume?: string;
  issue?: string;
  journal_name?: string;
  suggested_format?: string;
  uploaded_format?: string;
}

export interface UserLibraryAccess {
  id: string;
  user_id: string;
  book_id: string;
  access_type: 'own' | 'rent' | 'borrow' | 'gift';
  lifetime_rent_total: number;
  is_author_gift: boolean;
  sponsored_by?: string;
  created_at: string;
  expires_at?: string;
  returned_at?: string;
}

export interface Reservation {
  id: string;
  user_id: string;
  book_id: string;
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  created_at: string;
}

export interface Fine {
  id: string;
  user_id: string;
  book_id: string;
  amount: number;
  status: 'unpaid' | 'paid';
  created_at: string;
  paid_at?: string;
}

export interface UserReview {
  id: string;
  user_id: string;
  user_name: string;
  book_id: string;
  rating: number;
  comment: string;
  created_at: string;
}

export interface Highlight {
  id: string;
  user_id: string;
  book_id: string;
  passage_text: string;
  comment?: string;
  color: string;
  created_at: string;
}

export interface ReadingComment {
  id: string;
  user_id: string;
  user_name: string;
  book_id: string;
  page_index: number;
  text: string;
  created_at: string;
}

// A malformed value in one row (e.g. '' or legacy non-JSON text from a manual
// edit) must not take down the whole list — JSON.parse throws synchronously,
// which previously aborted the entire .map(mapDbBook) for every book in the
// response, not just the bad row.
const parseJsonArraySafe = (value: unknown): string[] => {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || value.trim() === '') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

// Helpers to serialize and map PostgreSQL fields safely
const mapDbBook = (b: any): Book => ({
  ...b,
  retail_price: Number(b.retail_price || 0),
  rental_price: Number(b.rental_price || 0),
  rating: Number(b.rating || 0),
  pages: b.pages !== null && b.pages !== undefined ? Number(b.pages) : null,
  tags: parseJsonArraySafe(b.tags),
  sample_pages: parseJsonArraySafe(b.sample_pages)
});

const mapDbAccess = (a: any): UserLibraryAccess => ({
  ...a,
  lifetime_rent_total: Number(a.lifetime_rent_total || 0),
  is_author_gift: Boolean(a.is_author_gift)
});

const mapDbFine = (f: any): Fine => ({
  ...f,
  amount: Number(f.amount || 0)
});

export const libraryService = {
  // Books CRUD
  listBooks: async (filters?: { search?: string; category?: string; section?: string; material_type?: string; user_id?: string }): Promise<Book[]> => {
    let query = nexus.database.from('api_books').select('*');
    
    if (filters?.search) {
      const s = filters.search.toLowerCase();
      query = query.or(`title.ilike.%${s}%,author_name.ilike.%${s}%`);
    }
    if (filters?.category && filters.category !== 'All') {
      query = query.eq('category', filters.category);
    }
    if (filters?.section && filters.section !== 'All') {
      query = query.eq('section', filters.section);
    }
    if (filters?.material_type && filters.material_type !== 'All') {
      query = query.eq('material_type', filters.material_type);
    }
    
    const { data: dbBooks, error } = await query;
    if (error) throw error;
    
    let booksList = (dbBooks || []).map(mapDbBook);
    
    // Fallback: If a user is logged in, fetch their library access, reservation, and fine records.
    // If they have interacted with a book that is missing from the database catalog,
    // append a placeholder book so their purchased/borrowed/reserved items are visible and readable.
    const userId = filters?.user_id || useAuthStore.getState().user?.id;
    if (userId) {
      try {
        const [accessRes, reservationsRes, finesRes] = await Promise.all([
          nexus.database.from('api_user_library_access').select('book_id').eq('user_id', userId),
          nexus.database.from('api_reservations').select('book_id').eq('user_id', userId),
          nexus.database.from('api_fines').select('book_id').eq('user_id', userId)
        ]);

        const allInteractedBookIds = new Set<string>();
        if (accessRes.data) accessRes.data.forEach(x => allInteractedBookIds.add(x.book_id));
        if (reservationsRes.data) reservationsRes.data.forEach(x => allInteractedBookIds.add(x.book_id));
        if (finesRes.data) finesRes.data.forEach(x => allInteractedBookIds.add(x.book_id));

        if (allInteractedBookIds.size > 0) {
          const existingIds = new Set(booksList.map(b => b.id));
          for (const bookId of allInteractedBookIds) {
            if (!existingIds.has(bookId)) {
              // Generate placeholder book details
              const shortId = bookId.startsWith('b-') 
                ? bookId.substring(2) 
                : bookId.substring(0, 6);
              const placeholderBook: Book = {
                id: bookId,
                title: `Blueprint Guide (Ref: #${shortId.substring(0, 4)})`,
                author_id: 'unknown',
                author_name: 'David Adamu Ileza',
                cover_url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='400' viewBox='0 0 300 400'><rect width='300' height='400' fill='%231E293B'/><g transform='translate(110, 140)' stroke='%2310B981' stroke-width='2' fill='none' stroke-linecap='round' stroke-linejoin='round'><rect x='0' y='0' width='80' height='100' rx='8'/><path d='M 20 30 L 60 30'/><path d='M 20 50 L 60 50'/><path d='M 20 70 L 40 70'/></g><text x='150' y='280' fill='%2310B981' font-family='system-ui, sans-serif' font-size='14' font-weight='800' text-anchor='middle' letter-spacing='1'>BLUEPRINT</text></svg>",
                retail_price: 3999,
                rental_price: 399,
                category: 'Case Study',
                description: 'A previously published blueprint guide stored in your account library.',
                rating: 5.0,
                section: 'Academic & Textbooks',
                language: 'English',
                publication_date: new Date().toISOString().split('T')[0],
                pages: 12,
                age_rating: 'All Ages / G',
                isbn: `978-${shortId}`,
                tags: ['Blueprint', 'LMS'],
                sample_pages: [],
                file_url: '', // Empty triggers mock pages renderer
                material_type: 'book_text'
              };
              booksList.push(placeholderBook);
              existingIds.add(bookId);
            }
          }
        }
      } catch (err) {
        console.warn("Failed to append placeholder books for library access:", err);
      }
    }
    
    return booksList;
  },

  getBook: async (id: string): Promise<Book> => {
    try {
      const { data, error } = await nexus.database
        .from('api_books')
        .select('*')
        .eq('id', id)
        .single();
        
      if (error || !data) {
        throw new Error('Not found in DB');
      }
      
      return mapDbBook(data);
    } catch (err) {
      // Return placeholder book if requested book is in user's library access list, reservations or fines
      const userId = useAuthStore.getState().user?.id;
      if (userId) {
        const [accessRes, reservationsRes, finesRes] = await Promise.all([
          nexus.database.from('api_user_library_access').select('book_id').eq('user_id', userId).eq('book_id', id),
          nexus.database.from('api_reservations').select('book_id').eq('user_id', userId).eq('book_id', id),
          nexus.database.from('api_fines').select('book_id').eq('user_id', userId).eq('book_id', id)
        ]);

        const hasInteraction = (accessRes.data && accessRes.data.length > 0) ||
                               (reservationsRes.data && reservationsRes.data.length > 0) ||
                               (finesRes.data && finesRes.data.length > 0);

        if (hasInteraction) {
          const shortId = id.startsWith('b-') ? id.substring(2) : id.substring(0, 6);
          return {
            id: id,
            title: `Blueprint Guide (Ref: #${shortId.substring(0, 4)})`,
            author_id: 'unknown',
            author_name: 'David Adamu Ileza',
            cover_url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='400' viewBox='0 0 300 400'><rect width='300' height='400' fill='%231E293B'/><g transform='translate(110, 140)' stroke='%2310B981' stroke-width='2' fill='none' stroke-linecap='round' stroke-linejoin='round'><rect x='0' y='0' width='80' height='100' rx='8'/><path d='M 20 30 L 60 30'/><path d='M 20 50 L 60 50'/><path d='M 20 70 L 40 70'/></g><text x='150' y='280' fill='%2310B981' font-family='system-ui, sans-serif' font-size='14' font-weight='800' text-anchor='middle' letter-spacing='1'>BLUEPRINT</text></svg>",
            retail_price: 3999,
            rental_price: 399,
            category: 'Case Study',
            description: 'A previously published blueprint guide stored in your account library.',
            rating: 5.0,
            section: 'Academic & Textbooks',
            language: 'English',
            publication_date: new Date().toISOString().split('T')[0],
            pages: 12,
            age_rating: 'All Ages / G',
            isbn: `978-${shortId}`,
            tags: ['Blueprint', 'LMS'],
            sample_pages: [],
            file_url: '',
            material_type: 'book_text'
          };
        }
      }
      throw new Error('Book not found');
    }
  },

  createBook: async (bookData: Partial<Book>): Promise<Book> => {
    const bookId = bookData.id || `b-${Date.now()}`;
    const payload = {
      ...bookData,
      id: bookId,
      tags: JSON.stringify(bookData.tags || []),
      sample_pages: JSON.stringify(bookData.sample_pages || []),
      rating: bookData.rating || 0.0,
      created_at: new Date().toISOString()
    };
    
    const { data, error } = await nexus.database
      .from('api_books')
      .insert([payload])
      .select()
      .single();
      
    if (error) throw error;
    return mapDbBook(data);
  },

  updateBook: async (id: string, bookData: Partial<Book>): Promise<Book> => {
    const payload = { ...bookData } as any;
    if (bookData.tags) {
      payload.tags = JSON.stringify(bookData.tags);
    }
    if (bookData.sample_pages) {
      payload.sample_pages = JSON.stringify(bookData.sample_pages);
    }
    
    const { data, error } = await nexus.database
      .from('api_books')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
      
    if (error) throw error;
    return mapDbBook(data);
  },

  deleteBook: async (id: string): Promise<void> => {
    const { error } = await nexus.database
      .from('api_books')
      .delete()
      .eq('id', id);
      
    if (error) throw error;
  },

  // Borrow / Buy / Return Access
  getAccess: async (userId: string): Promise<UserLibraryAccess[]> => {
    const { data, error } = await nexus.database
      .from('api_user_library_access')
      .select('*')
      .eq('user_id', userId);
      
    if (error) throw error;
    return (data || []).map(mapDbAccess);
  },

  borrowBook: async (userId: string, bookId: string, price: number): Promise<UserLibraryAccess> => {
    const book = await libraryService.getBook(bookId);
    
    const { data: existingRecords, error: fetchErr } = await nexus.database
      .from('api_user_library_access')
      .select('*')
      .eq('user_id', userId)
      .eq('book_id', bookId);
      
    if (fetchErr) throw fetchErr;
    const existing = existingRecords?.[0];
    
    let accumulatedRent = price;
    let isOwn = false;
    
    if (existing) {
      accumulatedRent += Number(existing.lifetime_rent_total || 0);
      if (existing.access_type === 'own') {
        isOwn = true;
      }
    }
    
    if (accumulatedRent >= book.retail_price) {
      isOwn = true;
    }
    
    const expiresAt = isOwn ? null : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    
    if (existing) {
      const { data, error } = await nexus.database
        .from('api_user_library_access')
        .update({
          access_type: isOwn ? 'own' : 'rent',
          lifetime_rent_total: accumulatedRent,
          expires_at: expiresAt,
          returned_at: null
        })
        .eq('id', existing.id)
        .select()
        .single();
        
      if (error) throw error;
      return mapDbAccess(data);
    } else {
      const { data, error } = await nexus.database
        .from('api_user_library_access')
        .insert([{
          id: `a-${Date.now()}`,
          user_id: userId,
          book_id: bookId,
          access_type: isOwn ? 'own' : 'rent',
          lifetime_rent_total: accumulatedRent,
          expires_at: expiresAt,
          is_author_gift: false
        }])
        .select()
        .single();
        
      if (error) throw error;
      return mapDbAccess(data);
    }
  },

  buyBook: async (userId: string, bookId: string): Promise<UserLibraryAccess> => {
    const { data: existingRecords, error: fetchErr } = await nexus.database
      .from('api_user_library_access')
      .select('*')
      .eq('user_id', userId)
      .eq('book_id', bookId);
      
    if (fetchErr) throw fetchErr;
    const existing = existingRecords?.[0];
    
    if (existing) {
      const { data, error } = await nexus.database
        .from('api_user_library_access')
        .update({
          access_type: 'own',
          expires_at: null,
          returned_at: null
        })
        .eq('id', existing.id)
        .select()
        .single();
        
      if (error) throw error;
      return mapDbAccess(data);
    } else {
      const { data, error } = await nexus.database
        .from('api_user_library_access')
        .insert([{
          id: `a-${Date.now()}`,
          user_id: userId,
          book_id: bookId,
          access_type: 'own',
          lifetime_rent_total: 0.0,
          is_author_gift: false
        }])
        .select()
        .single();
        
      if (error) throw error;
      return mapDbAccess(data);
    }
  },

  returnBook: async (userId: string, bookId: string): Promise<{ access: UserLibraryAccess, fine_generated: number }> => {
    const { data: existingRecords, error: fetchErr } = await nexus.database
      .from('api_user_library_access')
      .select('*')
      .eq('user_id', userId)
      .eq('book_id', bookId)
      .eq('access_type', 'rent');
      
    if (fetchErr) throw fetchErr;
    const access = existingRecords?.[0];
    if (!access) throw new Error('Active rental access not found');
    
    const returnedAt = new Date().toISOString();
    let fineAmount = 0.0;
    
    if (access.expires_at && new Date() > new Date(access.expires_at)) {
      const overdueDuration = Date.now() - new Date(access.expires_at).getTime();
      const overdueDays = Math.max(1, Math.ceil(overdueDuration / (1000 * 60 * 60 * 24)));
      fineAmount = overdueDays * 100.0;
      
      const { error: fineErr } = await nexus.database
        .from('api_fines')
        .insert([{
          id: `f-${Date.now()}`,
          user_id: userId,
          book_id: bookId,
          amount: fineAmount,
          status: 'unpaid',
          created_at: new Date().toISOString()
        }]);
        
      if (fineErr) throw fineErr;
    }
    
    const { data, error } = await nexus.database
      .from('api_user_library_access')
      .update({ returned_at: returnedAt })
      .eq('id', access.id)
      .select()
      .single();
      
    if (error) throw error;
    return { access: mapDbAccess(data), fine_generated: fineAmount };
  },

  // Reservations
  reserveBook: async (userId: string, bookId: string): Promise<Reservation> => {
    const { data, error } = await nexus.database
      .from('api_reservations')
      .insert([{
        id: `r-${Date.now()}`,
        user_id: userId,
        book_id: bookId,
        status: 'pending',
        created_at: new Date().toISOString()
      }])
      .select()
      .single();
      
    if (error) throw error;
    return data;
  },

  listReservations: async (userId: string): Promise<Reservation[]> => {
    const { data, error } = await nexus.database
      .from('api_reservations')
      .select('*')
      .eq('user_id', userId);
      
    if (error) throw error;
    return data || [];
  },

  // Fines
  listFines: async (userId: string): Promise<Fine[]> => {
    const { data, error } = await nexus.database
      .from('api_fines')
      .select('*')
      .eq('user_id', userId);
      
    if (error) throw error;
    return (data || []).map(mapDbFine);
  },

  payFine: async (fineId: string): Promise<Fine> => {
    const { data, error } = await nexus.database
      .from('api_fines')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString()
      })
      .eq('id', fineId)
      .select()
      .single();
      
    if (error) throw error;
    return mapDbFine(data);
  },

  // Content-Based Recommendations
  getRecommendations: async (userId?: string, bookId?: string): Promise<Book[]> => {
    const allBooks = await libraryService.listBooks();
    if (!allBooks || allBooks.length === 0) return [];
    
    const targetCategories = new Set<string>();
    const targetTags = new Set<string>();
    const excludeIds = new Set<string>();
    
    if (userId) {
      const userAccess = await libraryService.getAccess(userId);
      const accessedBookIds = new Set(userAccess.map(a => a.book_id));
      for (const id of accessedBookIds) {
        excludeIds.add(id);
      }
      
      for (const bId of accessedBookIds) {
        const b = allBooks.find(item => item.id === bId);
        if (b) {
          targetCategories.add(b.category);
          (b.tags || []).forEach(t => targetTags.add(t));
        }
      }
    } else if (bookId) {
      excludeIds.add(bookId);
      const refBook = allBooks.find(b => b.id === bookId);
      if (refBook) {
        targetCategories.add(refBook.category);
        (refBook.tags || []).forEach(t => targetTags.add(t));
      }
    }
    
    const scored = allBooks
      .filter(b => !excludeIds.has(b.id))
      .map(b => {
        let score = 0;
        if (targetCategories.has(b.category)) score += 5;
        (b.tags || []).forEach(t => {
          if (targetTags.has(t)) score += 2;
        });
        score += b.rating || 0;
        return { book: b, score };
      });
      
    scored.sort((a, b) => b.score - a.score);
    return scored.map(s => s.book).slice(0, 5);
  },

  // Reviews
  listReviews: async (bookId: string): Promise<UserReview[]> => {
    const { data, error } = await nexus.database
      .from('api_user_reviews')
      .select('*')
      .eq('book_id', bookId);
      
    if (error) throw error;
    return data || [];
  },

  submitReview: async (reviewData: { user_id: string; user_name: string; book_id: string; rating: number; comment: string }): Promise<UserReview> => {
    const { data, error } = await nexus.database
      .from('api_user_reviews')
      .insert([{
        id: `rev-${Date.now()}`,
        ...reviewData,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();
      
    if (error) throw error;
    
    // Recalculate book average rating
    try {
      const allRevs = await libraryService.listReviews(reviewData.book_id);
      const totalRatings = allRevs.reduce((acc, r) => acc + r.rating, 0);
      const avgRating = Number((totalRatings / allRevs.length).toFixed(1));
      await libraryService.updateBook(reviewData.book_id, { rating: avgRating });
    } catch (err) {
      console.error("Failed to recalculate book rating:", err);
    }
    
    return data;
  },

  // Highlights
  listHighlights: async (userId: string, bookId: string): Promise<Highlight[]> => {
    const { data, error } = await nexus.database
      .from('api_highlights')
      .select('*')
      .eq('user_id', userId)
      .eq('book_id', bookId);
      
    if (error) throw error;
    return data || [];
  },

  saveHighlight: async (hlData: { id?: string; user_id: string; book_id: string; passage_text: string; comment?: string; color: string }): Promise<Highlight> => {
    const hlId = hlData.id || `hl-${Date.now()}`;
    const payload = {
      ...hlData,
      id: hlId,
      created_at: new Date().toISOString()
    };
    
    const { data, error } = await nexus.database
      .from('api_highlights')
      .insert([payload])
      .select()
      .single();
      
    if (error) throw error;
    return data;
  },

  deleteHighlight: async (hlId: string): Promise<void> => {
    const { error } = await nexus.database
      .from('api_highlights')
      .delete()
      .eq('id', hlId);
      
    if (error) throw error;
  },

  // Comments
  listComments: async (userId: string, bookId: string): Promise<ReadingComment[]> => {
    const { data, error } = await nexus.database
      .from('api_comments')
      .select('*')
      .eq('user_id', userId)
      .eq('book_id', bookId);
      
    if (error) throw error;
    return data || [];
  },

  saveComment: async (commentData: { user_id: string; user_name: string; book_id: string; page_index: number; text: string }): Promise<ReadingComment> => {
    const { data, error } = await nexus.database
      .from('api_comments')
      .insert([{
        id: `c-${Date.now()}`,
        ...commentData,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();
      
    if (error) throw error;
    return data;
  }
};
