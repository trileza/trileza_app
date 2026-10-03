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
   * What the author offers (§12). The database already carried these and
   * book_actions_for_user already honoured them; nothing set them, so every
   * book silently took the defaults and §3.1's "chooses whether purchase,
   * mentor-sponsored purchase, borrowing and borrow-to-own are available" was
   * not something an author could do.
   */
  allow_purchase?: boolean;
  allow_mentor_gift?: boolean;
  allow_borrow?: boolean;
  allow_borrow_to_own?: boolean;
  /** §13 fixes this at five for now; stored explicitly so it can change. */
  borrow_days?: number;
  /** Fraction of a borrow payment that becomes ownership credit (§14). */
  borrow_credit_rate?: number;

  /** The rights declaration (§11), stored against the publication (§45). */
  rights?: {
    owns_rights: boolean;
    grants_hosting: boolean;
    grants_display: boolean;
    grants_sale: boolean;
    grants_lending: boolean;
    grants_borrow_to_own: boolean;
    territory: string;
    agreement_version: string;
  };
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
export const checkBeforePublish = (input: PublishInput): ValidationIssue[] => {
  const issues = validateBookMetadata(input);

  // §11 and §45: the platform must hold a rights declaration before a book is
  // published. The metadata validator knows nothing about rights, so this is
  // checked here rather than bolted into it.
  if (!input.rights?.owns_rights) {
    issues.push({
      field: 'rights',
      message: 'You must confirm you hold the rights to publish this book.',
      severity: 'error'
    });
  } else if (!input.rights.grants_hosting || !input.rights.grants_display) {
    issues.push({
      field: 'rights',
      message: 'Hosting and display permission are needed for the book to be readable at all.',
      severity: 'error'
    });
  }

  // Selling a book nobody granted the right to sell, or lending one with no
  // lending grant, is the specific mismatch §11 asks the agreement to cover.
  if (input.allow_purchase !== false && input.rights && !input.rights.grants_sale) {
    issues.push({
      field: 'rights',
      message: 'This book is offered for sale, but the rights declaration does not grant sale.',
      severity: 'error'
    });
  }

  if (input.allow_borrow !== false && input.rights && !input.rights.grants_lending) {
    issues.push({
      field: 'rights',
      message: 'This book is offered for borrowing, but the rights declaration does not grant lending.',
      severity: 'error'
    });
  }

  if (input.allow_borrow_to_own && input.rights && !input.rights.grants_borrow_to_own) {
    issues.push({
      field: 'rights',
      message: 'Borrow-to-own is enabled, but the rights declaration does not grant it.',
      severity: 'error'
    });
  }

  // Mirrors the database trigger, so the author sees the problem on the review
  // step rather than as a constraint violation after pressing publish.
  if (
    input.allow_purchase === false &&
    input.allow_mentor_gift === false &&
    input.allow_borrow === false
  ) {
    issues.push({
      field: 'commercial',
      message: 'This book offers no way to acquire it. Enable purchase, mentor gift or borrowing.',
      severity: 'error'
    });
  }

  if (input.allow_borrow_to_own && input.allow_borrow === false) {
    issues.push({
      field: 'commercial',
      message: 'Borrow-to-own needs borrowing enabled: the credit comes from borrow payments.',
      severity: 'error'
    });
  }

  return issues;
};

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
      // What the author offers. A database trigger refuses a combination that
      // cannot be honoured — borrow-to-own with no borrowing, or a published
      // book offering nothing at all.
      allow_purchase: input.allow_purchase ?? true,
      allow_mentor_gift: input.allow_mentor_gift ?? true,
      allow_borrow: input.allow_borrow ?? true,
      allow_borrow_to_own: input.allow_borrow_to_own ?? false,
      borrow_days: input.borrow_days ?? 5,
      borrow_credit_rate: input.borrow_credit_rate ?? 1.0,
      rights_statement: input.rights?.territory || input.rights_statement || 'World',
      copyright_year: input.copyright_year ?? new Date().getFullYear(),
      copyright_holder: input.copyright_holder?.trim() || input.author_name.trim(),
      rating: 0.0,
      // Held back until a moderator clears it, unless the caller is explicitly
      // allowed to skip that.
      status: goLive ? 'published' : 'draft',
      created_at: new Date().toISOString()
    }]);

    if (bookErr) throw new Error(errorMessage(bookErr, 'Could not save this book.'));

    // The rights declaration, stored against the publication (§11, §45).
    //
    // Written immediately after the book and before anything else, because a
    // published book with no record of what its author agreed to is exactly
    // what the launch criterion exists to prevent. A failure here is raised,
    // not logged: unlike a missing contributor row, this one matters legally.
    if (input.rights) {
      const { error: rightsErr } = await nexus.database.from('rights_agreements').insert([{
        book_id: bookId,
        accepted_by: input.author_id,
        agreement_version: input.rights.agreement_version,
        owns_rights: input.rights.owns_rights,
        grants_hosting: input.rights.grants_hosting,
        grants_display: input.rights.grants_display,
        grants_sale: input.rights.grants_sale,
        grants_lending: input.rights.grants_lending,
        grants_borrow_to_own: input.rights.grants_borrow_to_own,
        territory: input.rights.territory,
        copyright_holder: input.copyright_holder?.trim() || input.author_name.trim(),
        copyright_year: input.copyright_year ?? new Date().getFullYear()
      }]);

      if (rightsErr) {
        console.error('[Publishing] Could not store the rights declaration:', rightsErr);
        throw new Error(
          'This book was saved but its rights declaration could not be recorded. Please contact support before it is reviewed.'
        );
      }
    }

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
