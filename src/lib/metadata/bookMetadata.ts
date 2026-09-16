/**
 * Book metadata: validation and ONIX 3.0 export.
 *
 * Implements the parts of NISO RP-29-2022 and ONIX for Books 3.0 that a
 * retailer or library system actually refuses a record without — a checksummed
 * ISBN, a contributor with a role, a language code, a subject classification,
 * a rights statement.
 *
 * Validation is duplicated here and in the database on purpose. The database
 * constraint is what makes bad data impossible; this is what makes the problem
 * legible while the author is still looking at the form, rather than as a
 * constraint violation after they press Publish.
 */

// ── ISBN ───────────────────────────────────────────────────────────────

/**
 * Whether an ISBN-13 checksums correctly.
 *
 * The check digit is the point of an ISBN: it is what separates a real
 * registration from a typo or an invented number. The upload form used to
 * fabricate `978-` plus nine random digits when the field was left blank,
 * which produces a number that looks plausible, fails this check, and — if it
 * ever reached a retailer feed — would be indistinguishable from a genuine
 * registration until it collided with someone else's book.
 */
export const isValidIsbn13 = (isbn: string): boolean => {
  const digits = (isbn || '').replace(/[^0-9]/g, '');
  if (digits.length !== 13) return false;

  // Alternating weights of 1 and 3 across the first twelve digits; the
  // thirteenth brings the total to a multiple of ten.
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(digits[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return ((10 - (sum % 10)) % 10) === Number(digits[12]);
};

/** Whether an ISBN-10 checksums correctly. X in the last position means ten. */
export const isValidIsbn10 = (isbn: string): boolean => {
  const chars = (isbn || '').replace(/[^0-9Xx]/g, '').toUpperCase();
  if (chars.length !== 10) return false;

  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const c = chars[i];
    if (c === 'X') {
      if (i !== 9) return false; // X is only ever the check digit
      sum += 10 * (10 - i);
    } else {
      sum += Number(c) * (10 - i);
    }
  }
  return sum % 11 === 0;
};

/** Strips hyphens and spaces, which are presentation rather than data. */
export const normalizeIsbn = (isbn: string): string =>
  (isbn || '').replace(/[^0-9Xx]/g, '').toUpperCase();

/** Converts a valid ISBN-10 to its ISBN-13 equivalent, or null. */
export const isbn10To13 = (isbn10: string): string | null => {
  if (!isValidIsbn10(isbn10)) return null;
  const body = '978' + normalizeIsbn(isbn10).slice(0, 9);

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(body[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return body + String((10 - (sum % 10)) % 10);
};

// ── Language (ISO 639-1) ───────────────────────────────────────────────

/**
 * The languages this platform actually serves, with their ISO 639-1 codes.
 *
 * Deliberately not the full 184-entry list: an author picking from a huge
 * dropdown is more likely to mis-select than to find something missing, and an
 * unlisted language can be added when someone asks for it. Nigerian languages
 * are included because that is where most of these books come from.
 */
export const LANGUAGES: Array<{ code: string; name: string }> = [
  { code: 'en', name: 'English' },
  { code: 'fr', name: 'French' },
  { code: 'ar', name: 'Arabic' },
  { code: 'es', name: 'Spanish' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'de', name: 'German' },
  { code: 'sw', name: 'Swahili' },
  { code: 'yo', name: 'Yoruba' },
  { code: 'ig', name: 'Igbo' },
  { code: 'ha', name: 'Hausa' },
  { code: 'zh', name: 'Chinese' },
  { code: 'hi', name: 'Hindi' }
];

export const isValidLanguageCode = (code: string): boolean =>
  LANGUAGES.some(l => l.code === code);

/** Maps a display name to its code, for migrating older records. */
export const languageNameToCode = (name: string): string | null =>
  LANGUAGES.find(l => l.name.toLowerCase() === (name || '').trim().toLowerCase())?.code ?? null;

// ── BISAC subject headings ─────────────────────────────────────────────

/**
 * A BISAC code is three letters then six digits, e.g. FIC009000.
 *
 * Only the shape is checked. The authoritative list is licensed by the Book
 * Industry Study Group and cannot be redistributed, so whether a
 * well-formed code is also a real one is the publisher's responsibility.
 */
export const isValidBisacShape = (code: string): boolean =>
  /^[A-Z]{3}\d{6}$/.test((code || '').trim().toUpperCase());

/** The top-level BISAC subjects, enough for a first-pass classification. */
export const BISAC_CATEGORIES: Array<{ code: string; label: string }> = [
  { code: 'FIC000000', label: 'Fiction / General' },
  { code: 'BIO000000', label: 'Biography & Autobiography' },
  { code: 'BUS000000', label: 'Business & Economics' },
  { code: 'COM000000', label: 'Computers' },
  { code: 'EDU000000', label: 'Education' },
  { code: 'HIS000000', label: 'History' },
  { code: 'JUV000000', label: "Children's Fiction" },
  { code: 'MED000000', label: 'Medical' },
  { code: 'POL000000', label: 'Political Science' },
  { code: 'REL000000', label: 'Religion' },
  { code: 'SCI000000', label: 'Science' },
  { code: 'SEL000000', label: 'Self-Help' },
  { code: 'SOC000000', label: 'Social Science' },
  { code: 'TEC000000', label: 'Technology & Engineering' },
  { code: 'LAW000000', label: 'Law' },
  { code: 'ART000000', label: 'Art' }
];

// ── ONIX contributor roles (codelist 17) ───────────────────────────────

export const CONTRIBUTOR_ROLES: Array<{ code: string; label: string }> = [
  { code: 'A01', label: 'Author' },
  { code: 'A12', label: 'Illustrator' },
  { code: 'A15', label: 'Preface by' },
  { code: 'B01', label: 'Editor' },
  { code: 'B06', label: 'Translator' },
  { code: 'E07', label: 'Narrator' }
];

/** ONIX codelist 28. 01 is the general trade adult audience. */
export const AUDIENCE_CODES: Array<{ code: string; label: string }> = [
  { code: '01', label: 'General / trade' },
  { code: '02', label: 'Children / juvenile' },
  { code: '03', label: 'Young adult' },
  { code: '04', label: 'Primary & secondary education' },
  { code: '05', label: 'College / higher education' },
  { code: '06', label: 'Professional & scholarly' }
];

// ── Limits ─────────────────────────────────────────────────────────────

/**
 * Upload ceilings. EPUB is compressed text and rarely approaches this; PDF
 * carries page images and legitimately can.
 */
export const MAX_FILE_BYTES = {
  EPUB: 100 * 1024 * 1024,
  PDF: 500 * 1024 * 1024
} as const;

// ── Validation ─────────────────────────────────────────────────────────

export interface BookMetadataInput {
  title?: string;
  subtitle_text?: string;
  isbn_13?: string;
  isbn_10?: string;
  language_code?: string;
  bisac_codes?: string[];
  publication_date_iso?: string;
  file_format?: string;
  file_size_bytes?: number;
  copyright_year?: number;
  rights_statement?: string;
  contributors?: Array<{ contributor_name?: string; contributor_role?: string }>;
}

export interface ValidationIssue {
  field: string;
  message: string;
  /** An error blocks publication; a warning is worth fixing but does not. */
  severity: 'error' | 'warning';
}

/**
 * Checks a book record against the metadata standards.
 *
 * Errors are things a retailer or library would reject the record for.
 * Warnings are things that make it harder to discover but do not make it
 * invalid — a book with no BISAC code still sells, it just surfaces less.
 */
export const validateBookMetadata = (book: BookMetadataInput): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];

  if (!book.title || !book.title.trim()) {
    issues.push({ field: 'title', message: 'A title is required.', severity: 'error' });
  }

  // An ISBN is optional — most self-published authors do not have one — but a
  // supplied one must be real.
  if (book.isbn_13) {
    if (!isValidIsbn13(book.isbn_13)) {
      issues.push({
        field: 'isbn_13',
        message: 'This ISBN-13 is not valid — check the digits against your registration.',
        severity: 'error'
      });
    }
  } else {
    issues.push({
      field: 'isbn_13',
      message: 'No ISBN. Retailers and libraries cannot list this book without one.',
      severity: 'warning'
    });
  }

  if (book.isbn_10 && !isValidIsbn10(book.isbn_10)) {
    issues.push({ field: 'isbn_10', message: 'This ISBN-10 is not valid.', severity: 'error' });
  }

  if (!book.language_code) {
    issues.push({ field: 'language_code', message: 'A language is required.', severity: 'error' });
  } else if (!isValidLanguageCode(book.language_code)) {
    issues.push({
      field: 'language_code',
      message: `"${book.language_code}" is not a supported language code.`,
      severity: 'error'
    });
  }

  const authors = (book.contributors || []).filter(c => c.contributor_role === 'A01');
  if (authors.length === 0) {
    issues.push({
      field: 'contributors',
      message: 'At least one contributor must be listed as the author.',
      severity: 'error'
    });
  }
  if ((book.contributors || []).some(c => !c.contributor_name?.trim())) {
    issues.push({
      field: 'contributors',
      message: 'Every contributor needs a name.',
      severity: 'error'
    });
  }

  const bisac = book.bisac_codes || [];
  if (bisac.length === 0) {
    issues.push({
      field: 'bisac_codes',
      message: 'No subject category. The book will be much harder to find.',
      severity: 'warning'
    });
  }
  for (const code of bisac) {
    if (!isValidBisacShape(code)) {
      issues.push({
        field: 'bisac_codes',
        message: `"${code}" is not a BISAC code — expected three letters and six digits.`,
        severity: 'error'
      });
    }
  }

  if (book.publication_date_iso) {
    const date = new Date(book.publication_date_iso);
    if (Number.isNaN(date.getTime())) {
      issues.push({
        field: 'publication_date_iso',
        message: 'The publication date is not a valid date.',
        severity: 'error'
      });
    } else if (date.getTime() > Date.now()) {
      // Not an error: a pre-order legitimately publishes in the future.
      issues.push({
        field: 'publication_date_iso',
        message: 'The publication date is in the future — this will list as a pre-order.',
        severity: 'warning'
      });
    }
  }

  if (book.file_format && !['EPUB', 'PDF'].includes(book.file_format)) {
    issues.push({
      field: 'file_format',
      message: 'Only EPUB and PDF are supported.',
      severity: 'error'
    });
  }

  if (book.file_format && book.file_size_bytes) {
    const cap = MAX_FILE_BYTES[book.file_format as keyof typeof MAX_FILE_BYTES];
    if (cap && book.file_size_bytes > cap) {
      issues.push({
        field: 'file_size_bytes',
        message: `This file is larger than the ${Math.round(cap / 1024 / 1024)}MB limit for ${book.file_format}.`,
        severity: 'error'
      });
    }
  }

  if (!book.rights_statement?.trim()) {
    issues.push({
      field: 'rights_statement',
      message: 'No territory rights stated. "World" is the usual default.',
      severity: 'warning'
    });
  }

  if (book.copyright_year) {
    const year = new Date().getFullYear();
    if (book.copyright_year < 1450 || book.copyright_year > year + 1) {
      issues.push({
        field: 'copyright_year',
        message: 'That copyright year does not look right.',
        severity: 'warning'
      });
    }
  }

  return issues;
};

/** True when nothing would stop this book being published. */
export const canPublish = (book: BookMetadataInput): boolean =>
  validateBookMetadata(book).every(i => i.severity !== 'error');

// ── ONIX 3.0 export ────────────────────────────────────────────────────

export interface OnixBook extends BookMetadataInput {
  id?: string;
  description?: string;
  publisher_name?: string;
  edition_number?: number;
  audience_code?: string;
  copyright_holder?: string;
  retail_price?: number;
  page_count?: number;
  pages?: number;
  author_name?: string;
}

/** XML-escapes a value; undefined becomes an empty string. */
const esc = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

/**
 * Renders one book as an ONIX 3.0 <Product>.
 *
 * Reference tags rather than short tags: both are valid, and the long form is
 * readable when someone has to debug a rejected feed by eye.
 *
 * Elements are omitted when their data is missing rather than emitted empty —
 * an empty <ISBN></ISBN> is a malformed record, while an absent one is simply
 * a record without an ISBN.
 */
export const toOnixProduct = (book: OnixBook): string => {
  const parts: string[] = [];

  parts.push('  <Product>');
  parts.push(`    <RecordReference>${esc(book.id)}</RecordReference>`);
  // 03 = notification confirmed on publication.
  parts.push('    <NotificationType>03</NotificationType>');

  // ── Identifiers ──
  if (book.isbn_13) {
    parts.push('    <ProductIdentifier>');
    parts.push('      <ProductIDType>15</ProductIDType>'); // 15 = ISBN-13
    parts.push(`      <IDValue>${esc(normalizeIsbn(book.isbn_13))}</IDValue>`);
    parts.push('    </ProductIdentifier>');
  }
  if (book.id) {
    parts.push('    <ProductIdentifier>');
    parts.push('      <ProductIDType>01</ProductIDType>'); // 01 = proprietary
    parts.push('      <IDTypeName>Trileza</IDTypeName>');
    parts.push(`      <IDValue>${esc(book.id)}</IDValue>`);
    parts.push('    </ProductIdentifier>');
  }

  // ── Form ──
  parts.push('    <DescriptiveDetail>');
  parts.push('      <ProductComposition>00</ProductComposition>'); // single item
  parts.push('      <ProductForm>ED</ProductForm>'); // ED = digital download
  if (book.file_format) {
    // E101 = EPUB, E107 = PDF.
    parts.push(
      `      <ProductFormDetail>${book.file_format === 'EPUB' ? 'E101' : 'E107'}</ProductFormDetail>`
    );
  }

  // ── Title ──
  parts.push('      <TitleDetail>');
  parts.push('        <TitleType>01</TitleType>'); // distinctive title
  parts.push('        <TitleElement>');
  parts.push('          <TitleElementLevel>01</TitleElementLevel>');
  parts.push(`          <TitleText>${esc(book.title)}</TitleText>`);
  if (book.subtitle_text) {
    parts.push(`          <Subtitle>${esc(book.subtitle_text)}</Subtitle>`);
  }
  parts.push('        </TitleElement>');
  parts.push('      </TitleDetail>');

  // ── Contributors ──
  const contributors = book.contributors?.length
    ? book.contributors
    : book.author_name
      ? [{ contributor_name: book.author_name, contributor_role: 'A01' }]
      : [];

  contributors.forEach((c, index) => {
    parts.push('      <Contributor>');
    parts.push(`        <SequenceNumber>${index + 1}</SequenceNumber>`);
    parts.push(`        <ContributorRole>${esc(c.contributor_role || 'A01')}</ContributorRole>`);
    parts.push(`        <PersonName>${esc(c.contributor_name)}</PersonName>`);
    parts.push('      </Contributor>');
  });

  if (book.edition_number && book.edition_number > 1) {
    parts.push(`      <EditionNumber>${esc(book.edition_number)}</EditionNumber>`);
  }

  if (book.language_code) {
    parts.push('      <Language>');
    parts.push('        <LanguageRole>01</LanguageRole>'); // language of text
    parts.push(`        <LanguageCode>${esc(book.language_code)}</LanguageCode>`);
    parts.push('      </Language>');
  }

  const pageCount = book.page_count ?? book.pages;
  if (pageCount) {
    parts.push('      <Extent>');
    parts.push('        <ExtentType>00</ExtentType>'); // main content page count
    parts.push(`        <ExtentValue>${esc(pageCount)}</ExtentValue>`);
    parts.push('        <ExtentUnit>03</ExtentUnit>'); // pages
    parts.push('      </Extent>');
  }

  for (const code of book.bisac_codes || []) {
    parts.push('      <Subject>');
    parts.push('        <SubjectSchemeIdentifier>10</SubjectSchemeIdentifier>'); // BISAC
    parts.push(`        <SubjectCode>${esc(code)}</SubjectCode>`);
    parts.push('      </Subject>');
  }

  if (book.audience_code) {
    parts.push('      <Audience>');
    parts.push('        <AudienceCodeType>01</AudienceCodeType>');
    parts.push(`        <AudienceCodeValue>${esc(book.audience_code)}</AudienceCodeValue>`);
    parts.push('      </Audience>');
  }
  parts.push('    </DescriptiveDetail>');

  // ── Description ──
  if (book.description) {
    parts.push('    <CollateralDetail>');
    parts.push('      <TextContent>');
    parts.push('        <TextType>03</TextType>'); // long description
    parts.push('        <ContentAudience>00</ContentAudience>');
    parts.push(`        <Text>${esc(book.description)}</Text>`);
    parts.push('      </TextContent>');
    parts.push('    </CollateralDetail>');
  }

  // ── Publisher and rights ──
  parts.push('    <PublishingDetail>');
  if (book.publisher_name) {
    parts.push('      <Publisher>');
    parts.push('        <PublishingRole>01</PublishingRole>');
    parts.push(`        <PublisherName>${esc(book.publisher_name)}</PublisherName>`);
    parts.push('      </Publisher>');
  }
  if (book.publication_date_iso) {
    parts.push('      <PublishingDate>');
    parts.push('        <PublishingDateRole>01</PublishingDateRole>');
    // ONIX dateformat 00 is YYYYMMDD.
    parts.push(
      `        <Date dateformat="00">${esc(book.publication_date_iso.replace(/-/g, ''))}</Date>`
    );
    parts.push('      </PublishingDate>');
  }
  if (book.rights_statement) {
    parts.push('      <SalesRights>');
    parts.push('        <SalesRightsType>01</SalesRightsType>');
    parts.push('        <Territory>');
    parts.push(
      `          <RegionsIncluded>${
        book.rights_statement.toLowerCase().includes('world') ? 'WORLD' : esc(book.rights_statement)
      }</RegionsIncluded>`
    );
    parts.push('        </Territory>');
    parts.push('      </SalesRights>');
  }
  parts.push('    </PublishingDetail>');

  // ── Price ──
  if (book.retail_price) {
    parts.push('    <ProductSupply>');
    parts.push('      <SupplyDetail>');
    parts.push('        <ProductAvailability>20</ProductAvailability>'); // available
    parts.push('        <Price>');
    parts.push('          <PriceType>02</PriceType>'); // RRP including tax
    parts.push(`          <PriceAmount>${esc(Number(book.retail_price).toFixed(2))}</PriceAmount>`);
    parts.push('          <CurrencyCode>NGN</CurrencyCode>');
    parts.push('        </Price>');
    parts.push('      </SupplyDetail>');
    parts.push('    </ProductSupply>');
  }

  parts.push('  </Product>');
  return parts.join('\n');
};

/** Wraps products in a complete ONIX 3.0 message, ready to send to a retailer. */
export const toOnixMessage = (books: OnixBook[], sender = 'Trileza'): string => {
  const now = new Date();
  const stamp =
    now.toISOString().slice(0, 10).replace(/-/g, '') +
    String(now.getUTCHours()).padStart(2, '0') +
    String(now.getUTCMinutes()).padStart(2, '0');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<ONIXMessage release="3.0" xmlns="http://ns.editeur.org/onix/3.0/reference">',
    '  <Header>',
    '    <Sender>',
    `      <SenderName>${esc(sender)}</SenderName>`,
    '    </Sender>',
    `    <SentDateTime>${stamp}</SentDateTime>`,
    '  </Header>',
    ...books.map(toOnixProduct),
    '</ONIXMessage>'
  ].join('\n');
};
