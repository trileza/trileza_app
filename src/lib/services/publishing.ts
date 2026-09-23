/**
 * Publishing a book: the whole write, in one place.
 *
 * The publish path was spread across two components that had drifted apart.
 * StoreManager wrote contributor rows and queued the book for review;
 * AuthorDashboard did neither, so a book published from the author's own
 * dashboard went straight to the public library — `status` defaults to
 * 'published' — with no moderator ever seeing it, and with the co-authors the
 * form had asked for silently discarded.
 *
 * Both forms now call this. The ordering below is deliberate: the review row
 * is written before the book becomes visible, because the opposite order has
 * a window in which an unreviewed book is public.
 */

import { nexus, errorMessage } from '../nexus';
import {
  validateBookMetadata,
  normalizeIsbn,
  isValidIsbn13,
  isValidIsbn10,
  type BookMetadataInput,
  type ValidationIssue
} from '../metadata/bookMetadata';

export interface Contributor {
  contributor_name: string;
  contributor_role: string;
  contributor_bio?: string;
}

export interface PublishInput extends BookMetadataInput {
  id?: string;
  author_id: string;
  author_name: string;
  description?: string;
  cover_url?: string;
  file_url?: string;
  retail_price?: number;
  rental_price?: number;
  section?: string;
  category?: string;
  tags?: string[];
  sample_pages?: string[];
  contributors?: Contributor[];
  audience_code?: string;
  publisher_name?: string;
  edition_number?: number;
  word_count?: number;
  pages?: number;
  age_rating?: string;
  material_type?: string;
  book_file_name?: string;
  copyright_holder?: string;
  /**
   * Whether this goes live now or waits for a moderator.
   *
   * Defaults to review. An author publishing to a shared library is asking to
   * be listed, not asserting that nobody needs to look first.
   */
  publish_immediately?: boolean;
}

export interface PublishResult {
  bookId: string;
  status: 'published' | 'pending_review';
  /** Warnings that did not block, so the caller can show them afterwards. */
  warnings: ValidationIssue[];
}

/**
 * Checks a draft the way the database and a retailer both would.
 *
 * Separate from publish() so the wizard can show problems on the review step,
 * while the author can still go back and fix them, rather than after the
 * button is pressed.
 */
export const checkBeforePublish = (input: PublishInput): ValidationIssue[] =>
  validateBookMetadata(input);

export const publishingService = {
  checkBeforePublish,

  /**
   * Writes the book, its contributors and its identifiers.
   *
   * Contributors and identifiers are separate tables because a book has any
   * number of each; flattening them into columns is what forced the old form
   * to drop the co-authors it collected.
   */
  async publish(input: PublishInput): Promise<PublishResult> {
    const issues = validateBookMetadata(input);
    const errors = issues.filter(i => i.severity === 'error');

    // Refuse here rather than letting a constraint violation surface as a
    // 400 with a Postgres message in it.
    if (errors.length > 0) {
      throw new Error(
        `This book is not ready to publish: ${errors.map(e => e.message).join(' ')}`
      );
    }

    const bookId = input.id || `b-${Date.now()}`;
    const goLive = input.publish_immediately === true;

    const isbn13 = input.isbn_13 ? normalizeIsbn(input.isbn_13) : '';
    const isbn10 = input.isbn_10 ? normalizeIsbn(input.isbn_10) : '';

    const { error: bookErr } = await nexus.database.from('api_books').insert([{
      id: bookId,
      title: (input.title || '').trim(),
      subtitle_text: input.subtitle_text?.trim() || null,
      author_id: input.author_id,
      author_name: input.author_name.trim(),
      description: input.description?.trim() || '',
      cover_url: input.cover_url || '',
      file_url: input.file_url || '',
      book_file_name: input.book_file_name || null,
      retail_price: input.retail_price ?? 0,
      rental_price: input.rental_price ?? 0,
      section: input.section || null,
      category: input.category || 'E-book',
      tags: JSON.stringify(input.tags || []),
      sample_pages: JSON.stringify(input.sample_pages || []),
      isbn_13: isbn13 || null,
      isbn_10: isbn10 || null,
      language_code: input.language_code || 'en',
      bisac_codes: input.bisac_codes?.length ? input.bisac_codes : null,
      audience_code: input.audience_code || '01',
      publisher_name: input.publisher_name?.trim() || null,
      edition_number: input.edition_number ?? 1,
      publication_date_iso: input.publication_date_iso || null,
      file_format: input.file_format || null,
      file_size_bytes: input.file_size_bytes ?? null,
      word_count: input.word_count ?? null,
      pages: input.pages ?? null,
      age_rating: input.age_rating || null,
      material_type: input.material_type || null,
      rights_statement: input.rights_statement || 'World',
      copyright_year: input.copyright_year ?? new Date().getFullYear(),
      copyright_holder: input.copyright_holder?.trim() || input.author_name.trim(),
      rating: 0.0,
      // Held back until a moderator clears it, unless the caller is explicitly
      // allowed to skip that.
      status: goLive ? 'published' : 'draft',
      created_at: new Date().toISOString()
    }]);

    if (bookErr) throw new Error(errorMessage(bookErr, 'Could not save this book.'));

    // The primary author is added by a database trigger, so anyone the author
    // named beyond themselves starts at display_order 1.
    const extra = (input.contributors || [])
      .filter(c => c.contributor_name?.trim())
      .map((c, index) => ({
        book_id: bookId,
        contributor_name: c.contributor_name.trim(),
        contributor_role: c.contributor_role || 'A01',
        contributor_bio: c.contributor_bio?.trim() || null,
        display_order: index + 1
      }));

    if (extra.length > 0) {
      const { error } = await nexus.database.from('book_contributors').insert(extra);
      // The book itself is already saved. Losing a contributor row is worth
      // reporting, not worth failing the publish and stranding the upload.
      if (error) console.error('[Publishing] Could not save contributors:', error);
    }

    // Identifiers are mirrored into their own table so an ONIX export can list
    // several without the book row growing a column per scheme.
    const identifiers: Array<{ book_id: string; identifier_type: string; identifier_value: string }> = [];
    if (isbn13 && isValidIsbn13(isbn13)) {
      identifiers.push({ book_id: bookId, identifier_type: 'isbn13', identifier_value: isbn13 });
    }
    if (isbn10 && isValidIsbn10(isbn10)) {
      identifiers.push({ book_id: bookId, identifier_type: 'isbn10', identifier_value: isbn10 });
    }
    if (identifiers.length > 0) {
      const { error } = await nexus.database.from('book_identifiers').insert(identifiers);
      if (error) console.error('[Publishing] Could not save identifiers:', error);
    }

    if (!goLive) {
      const { error } = await nexus.database.from('book_reviews').insert([{
        book_id: bookId,
        submitted_by: input.author_id,
        status: 'pending',
        checklist_cover: false,
        checklist_description: false,
        checklist_readable: false,
        checklist_price: false,
        checklist_no_copyright: false
      }]);

      // Without this row the book sits at 'draft' and appears in no queue —
      // invisible to readers and to moderators alike. Say so loudly.
      if (error) {
        console.error('[Publishing] Could not queue for review:', error);
        throw new Error(
          'This book was saved but could not be sent for review. Please contact support so it is not left unseen.'
        );
      }
    }

    // Screen the manuscript for plagiarism and AI-generated text.
    //
    // Fire-and-forget: scanning takes minutes and its result reaches the
    // reviewer through a webhook. A scan that fails to start must not lose an
    // upload that already succeeded — the failure is recorded against the
    // book, so the queue shows that nothing was checked rather than implying
    // a clean result.
    //
    // This used to run only in StoreManager, so books published from the
    // author dashboard reached a reviewer with no scan evidence at all.
    try {
      nexus.functions
        .invoke('book-scan', { body: { bookId } })
        .catch((scanErr: unknown) =>
          console.error('[Publishing] Could not start scan:', scanErr)
        );
    } catch (scanErr) {
      console.error('[Publishing] Could not start scan:', scanErr);
    }

    return {
      bookId,
      status: goLive ? 'published' : 'pending_review',
      warnings: issues.filter(i => i.severity === 'warning')
    };
  }
};

export default publishingService;
