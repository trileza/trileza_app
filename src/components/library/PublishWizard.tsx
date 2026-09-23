/**
 * The publishing wizard.
 *
 * The old form put every field on one page: an author met roughly thirty
 * inputs at once, most of them optional, with no sense of which mattered. The
 * fields the schema actually needs — a subject code, an audience, a rights
 * statement, contributors beyond the first — were either absent or, in the
 * case of co-authors, collected and then dropped on submit.
 *
 * Five steps, grouped by the question each answers rather than by which table
 * the column lives in:
 *
 *   1. The book        — what it is called and what it is about
 *   2. The people      — who wrote it, and in what role
 *   3. The files       — the manuscript, its cover, a sample
 *   4. Cataloguing     — how a shop or library would find and shelve it
 *   5. Review          — what is wrong, what is merely missing, and the price
 *
 * Only the last step can publish. Validation runs continuously, but its
 * results are shown on the review step, where there is room to explain them
 * and the author can still go back.
 */

import React, { useMemo, useState } from 'react';
import {
  BookOpen, Users, UploadCloud, Tags, CheckCircle2, AlertTriangle,
  ChevronLeft, ChevronRight, Plus, Trash2, Loader2, Info
} from 'lucide-react';
import { cn } from '../../utils';
import {
  LANGUAGES, BISAC_CATEGORIES, CONTRIBUTOR_ROLES, AUDIENCE_CODES,
  MAX_FILE_BYTES, normalizeIsbn, isValidIsbn13
} from '../../lib/metadata/bookMetadata';
import {
  publishingService, type Contributor, type PublishInput
} from '../../lib/services/publishing';
import type { ValidationIssue } from '../../lib/metadata/bookMetadata';

export interface WizardDraft {
  title: string;
  subtitle_text: string;
  description: string;
  contributors: Contributor[];
  publisher_name: string;
  edition_number: string;
  isbn_13: string;
  language_code: string;
  bisac_codes: string[];
  audience_code: string;
  publication_date_iso: string;
  pages: string;
  word_count: string;
  rights_statement: string;
  copyright_year: string;
  copyright_holder: string;
  age_rating: string;
  section: string;
  tags: string;
  retail_price: string;
  publish_immediately: boolean;
}

const emptyDraft = (authorName: string): WizardDraft => ({
  title: '',
  subtitle_text: '',
  description: '',
  contributors: [{ contributor_name: authorName, contributor_role: 'A01' }],
  publisher_name: '',
  edition_number: '1',
  isbn_13: '',
  language_code: 'en',
  bisac_codes: [],
  audience_code: '01',
  publication_date_iso: new Date().toISOString().split('T')[0],
  pages: '',
  word_count: '',
  rights_statement: 'World',
  copyright_year: String(new Date().getFullYear()),
  copyright_holder: authorName,
  age_rating: 'All Ages / G',
  section: '',
  tags: '',
  retail_price: '5000',
  publish_immediately: false
});

interface Props {
  userId: string;
  authorName: string;
  sections: string[];
  /** Uploads a file and returns its URL. Supplied by the host dashboard. */
  uploadFile: (kind: 'books' | 'covers' | 'samples', file: File) => Promise<string>;
  /** True only for roles allowed to skip moderation. */
  canSkipReview?: boolean;
  onPublished: (bookId: string, status: string) => void;
  onCancel: () => void;
}

const STEPS = [
  { key: 'book',    label: 'The book',   icon: BookOpen },
  { key: 'people',  label: 'People',     icon: Users },
  { key: 'files',   label: 'Files',      icon: UploadCloud },
  { key: 'catalog', label: 'Cataloguing', icon: Tags },
  { key: 'review',  label: 'Review',     icon: CheckCircle2 }
] as const;

const label = 'block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5';
const field =
  'w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white ' +
  'placeholder-slate-500 focus:outline-none focus:border-brand-secondary transition-colors';

export const PublishWizard: React.FC<Props> = ({
  userId, authorName, sections, uploadFile, canSkipReview, onPublished, onCancel
}) => {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<WizardDraft>(() => emptyDraft(authorName));
  const [bookFile, setBookFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [sampleFile, setSampleFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [failure, setFailure] = useState<string | null>(null);

  const set = <K extends keyof WizardDraft>(key: K, value: WizardDraft[K]) =>
    setDraft(d => ({ ...d, [key]: value }));

  /**
   * The draft as the validator sees it.
   *
   * File facts come from the picked file rather than from anything typed, so
   * the format and size that get validated are the ones that will be stored.
   */
  const asInput = useMemo((): PublishInput => ({
    author_id: userId,
    author_name: authorName,
    title: draft.title,
    subtitle_text: draft.subtitle_text,
    description: draft.description,
    contributors: draft.contributors,
    publisher_name: draft.publisher_name,
    edition_number: Number(draft.edition_number) || 1,
    isbn_13: draft.isbn_13 ? normalizeIsbn(draft.isbn_13) : undefined,
    language_code: draft.language_code,
    bisac_codes: draft.bisac_codes,
    audience_code: draft.audience_code,
    publication_date_iso: draft.publication_date_iso,
    pages: Number(draft.pages) || undefined,
    word_count: Number(draft.word_count) || undefined,
    rights_statement: draft.rights_statement,
    copyright_year: Number(draft.copyright_year) || undefined,
    copyright_holder: draft.copyright_holder,
    age_rating: draft.age_rating,
    section: draft.section || sections[0],
    tags: draft.tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean),
    retail_price: Number(draft.retail_price) || 0,
    file_format: bookFile ? (/\.epub$/i.test(bookFile.name) ? 'EPUB' : 'PDF') : undefined,
    file_size_bytes: bookFile?.size,
    book_file_name: bookFile?.name,
    publish_immediately: canSkipReview ? draft.publish_immediately : false
  }), [draft, bookFile, userId, authorName, sections, canSkipReview]);

  const issues = useMemo(() => publishingService.checkBeforePublish(asInput), [asInput]);
  const errors = issues.filter(i => i.severity === 'error');
  const warnings = issues.filter(i => i.severity === 'warning');

  // A file is required to publish, but it is not metadata, so the validator
  // does not know about it. Checked separately.
  const missingFile = !bookFile;

  const oversized = useMemo(() => {
    if (!bookFile) return false;
    const cap = /\.epub$/i.test(bookFile.name) ? MAX_FILE_BYTES.EPUB : MAX_FILE_BYTES.PDF;
    return typeof cap === 'number' && bookFile.size > cap;
  }, [bookFile]);

  const addContributor = () =>
    setDraft(d => ({
      ...d,
      contributors: [...d.contributors, { contributor_name: '', contributor_role: 'A01' }]
    }));

  const updateContributor = (index: number, patch: Partial<Contributor>) =>
    setDraft(d => ({
      ...d,
      contributors: d.contributors.map((c, i) => (i === index ? { ...c, ...patch } : c))
    }));

  const removeContributor = (index: number) =>
    setDraft(d => ({ ...d, contributors: d.contributors.filter((_, i) => i !== index) }));

  const toggleBisac = (code: string) =>
    setDraft(d => ({
      ...d,
      bisac_codes: d.bisac_codes.includes(code)
        ? d.bisac_codes.filter(c => c !== code)
        : [...d.bisac_codes, code]
    }));

  const submit = async () => {
    if (!bookFile) return;
    setBusy(true);
    setFailure(null);

    try {
      setProgress('Uploading the manuscript…');
      const fileUrl = await uploadFile('books', bookFile);

      let coverUrl = '';
      if (coverFile) {
        setProgress('Uploading the cover…');
        coverUrl = await uploadFile('covers', coverFile);
      }

      let sampleUrl = '';
      if (sampleFile) {
        setProgress('Uploading the sample…');
        sampleUrl = await uploadFile('samples', sampleFile);
      }

      setProgress('Saving…');
      const result = await publishingService.publish({
        ...asInput,
        file_url: fileUrl,
        cover_url: coverUrl,
        sample_pages: sampleUrl ? [sampleUrl] : [],
        rental_price: Number((Number(draft.retail_price) * 0.1).toFixed(2))
      });

      onPublished(result.bookId, result.status);
    } catch (err: any) {
      // The upload may have succeeded and the save failed. Say what happened
      // rather than dropping the author back to a blank form.
      setFailure(err?.message || 'This book could not be published.');
    } finally {
      setBusy(false);
      setProgress('');
    }
  };

  const canAdvance = (): boolean => {
    if (step === 0) return draft.title.trim().length > 0;
    if (step === 1) return draft.contributors.some(c => c.contributor_name.trim());
    if (step === 2) return !missingFile && !oversized;
    return true;
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* Progress rail. Steps already passed stay clickable so a correction
          does not mean walking forward through everything again. */}
      <div className="flex items-center gap-1 mb-8">
        {STEPS.map((s, i) => (
          <React.Fragment key={s.key}>
            <button
              onClick={() => i < step && setStep(i)}
              disabled={i > step}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border-none transition-colors',
                i === step
                  ? 'bg-brand-primary text-white'
                  : i < step
                    ? 'bg-slate-800 text-slate-300 cursor-pointer hover:bg-slate-700'
                    : 'bg-transparent text-slate-600 cursor-default'
              )}
            >
              <s.icon size={12} />
              <span className="hidden sm:inline">{s.label}</span>
            </button>
            {i < STEPS.length - 1 && <div className="flex-1 h-px bg-slate-800" />}
          </React.Fragment>
        ))}
      </div>

      <div className="space-y-5 min-h-[340px]">
        {/* ── 1. The book ─────────────────────────────────────────────── */}
        {step === 0 && (
          <>
            <div>
              <label className={label}>Title <span className="text-rose-500">*</span></label>
              <input
                className={field}
                value={draft.title}
                onChange={e => set('title', e.target.value)}
                placeholder="The title as it appears on the cover"
              />
            </div>

            <div>
              <label className={label}>Subtitle</label>
              <input
                className={field}
                value={draft.subtitle_text}
                onChange={e => set('subtitle_text', e.target.value)}
                placeholder="Optional"
              />
            </div>

            <div>
              <label className={label}>Description</label>
              <textarea
                className={cn(field, 'resize-none')}
                rows={5}
                value={draft.description}
                onChange={e => set('description', e.target.value)}
                placeholder="What a reader sees before they decide. A few sentences is plenty."
              />
              <p className="text-[10px] text-slate-500 mt-1">
                {draft.description.length} characters
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={label}>Section</label>
                <select
                  className={field}
                  value={draft.section || sections[0]}
                  onChange={e => set('section', e.target.value)}
                >
                  {sections.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className={label}>Language</label>
                <select
                  className={field}
                  value={draft.language_code}
                  onChange={e => set('language_code', e.target.value)}
                >
                  {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
                </select>
              </div>
            </div>
          </>
        )}

        {/* ── 2. People ───────────────────────────────────────────────── */}
        {step === 1 && (
          <>
            <p className="text-xs text-slate-400 leading-relaxed">
              Everyone credited on the title page, in the order they appear. The
              old form asked for co-authors and then discarded them; these are
              saved as proper contributor records, each with a role, so a
              catalogue can tell an editor from a translator.
            </p>

            {draft.contributors.map((c, i) => (
              <div key={i} className="flex gap-2 items-start">
                <input
                  className={cn(field, 'flex-1')}
                  value={c.contributor_name}
                  onChange={e => updateContributor(i, { contributor_name: e.target.value })}
                  placeholder="Full name"
                />
                <select
                  className={cn(field, 'w-40')}
                  value={c.contributor_role}
                  onChange={e => updateContributor(i, { contributor_role: e.target.value })}
                >
                  {CONTRIBUTOR_ROLES.map(r => (
                    <option key={r.code} value={r.code}>{r.label}</option>
                  ))}
                </select>
                {draft.contributors.length > 1 && (
                  <button
                    onClick={() => removeContributor(i)}
                    aria-label="Remove contributor"
                    className="p-2.5 rounded-xl text-slate-600 hover:text-red-400 border-none bg-transparent cursor-pointer"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}

            <button
              onClick={addContributor}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border-none cursor-pointer"
            >
              <Plus size={13} /> Add another
            </button>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div>
                <label className={label}>Publisher</label>
                <input
                  className={field}
                  value={draft.publisher_name}
                  onChange={e => set('publisher_name', e.target.value)}
                  placeholder="Self-published if blank"
                />
              </div>
              <div>
                <label className={label}>Edition</label>
                <input
                  className={field}
                  type="number"
                  min={1}
                  value={draft.edition_number}
                  onChange={e => set('edition_number', e.target.value)}
                />
              </div>
            </div>
          </>
        )}

        {/* ── 3. Files ────────────────────────────────────────────────── */}
        {step === 2 && (
          <>
            <FilePick
              title="The manuscript"
              hint="EPUB or PDF. This is what a reader opens."
              accept=".epub,.pdf"
              file={bookFile}
              required
              onPick={setBookFile}
            />
            {oversized && (
              <p className="text-[11px] text-red-400 font-bold">
                This file is larger than the limit for its format. A smaller
                export will also open faster for readers on slow connections.
              </p>
            )}

            <FilePick
              title="Cover image"
              hint="Shown everywhere the book is listed."
              accept="image/*"
              file={coverFile}
              onPick={setCoverFile}
            />

            <FilePick
              title="Sample"
              hint="Readable without buying. Optional, but it sells the book."
              accept=".epub,.pdf"
              file={sampleFile}
              onPick={setSampleFile}
            />
          </>
        )}

        {/* ── 4. Cataloguing ──────────────────────────────────────────── */}
        {step === 3 && (
          <>
            <div>
              <label className={label}>Subjects</label>
              <p className="text-[11px] text-slate-500 mb-2.5">
                How a shop shelves it. Pick at least one — without a subject a
                book is only findable by someone who already knows its name.
              </p>
              <div className="flex flex-wrap gap-2">
                {BISAC_CATEGORIES.map(b => (
                  <button
                    key={b.code}
                    onClick={() => toggleBisac(b.code)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-colors cursor-pointer',
                      draft.bisac_codes.includes(b.code)
                        ? 'bg-brand-primary border-transparent text-white'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                    )}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={label}>Audience</label>
                <select
                  className={field}
                  value={draft.audience_code}
                  onChange={e => set('audience_code', e.target.value)}
                >
                  {AUDIENCE_CODES.map(a => (
                    <option key={a.code} value={a.code}>{a.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={label}>Published on</label>
                <input
                  className={field}
                  type="date"
                  value={draft.publication_date_iso}
                  onChange={e => set('publication_date_iso', e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className={label}>ISBN-13</label>
              <input
                className={cn(
                  field,
                  draft.isbn_13 && !isValidIsbn13(normalizeIsbn(draft.isbn_13)) && 'border-red-500'
                )}
                value={draft.isbn_13}
                onChange={e => set('isbn_13', e.target.value)}
                placeholder="978… — leave empty if the book has none"
              />
              <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                Only a real, registered number. Leaving this blank is fine; an
                invented one fails its checksum and can collide with someone
                else&rsquo;s registration.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={label}>Pages</label>
                <input className={field} type="number" value={draft.pages}
                       onChange={e => set('pages', e.target.value)} />
              </div>
              <div>
                <label className={label}>Words</label>
                <input className={field} type="number" value={draft.word_count}
                       onChange={e => set('word_count', e.target.value)} />
              </div>
              <div>
                <label className={label}>Copyright year</label>
                <input className={field} type="number" value={draft.copyright_year}
                       onChange={e => set('copyright_year', e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={label}>Rights</label>
                <select
                  className={field}
                  value={draft.rights_statement}
                  onChange={e => set('rights_statement', e.target.value)}
                >
                  <option value="World">World</option>
                  <option value="Nigeria">Nigeria only</option>
                  <option value="Africa">Africa</option>
                  <option value="World excluding US">World excluding US</option>
                </select>
              </div>
              <div>
                <label className={label}>Copyright holder</label>
                <input
                  className={field}
                  value={draft.copyright_holder}
                  onChange={e => set('copyright_holder', e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className={label}>Tags</label>
              <input
                className={field}
                value={draft.tags}
                onChange={e => set('tags', e.target.value)}
                placeholder="Comma separated"
              />
            </div>
          </>
        )}

        {/* ── 5. Review ───────────────────────────────────────────────── */}
        {step === 4 && (
          <>
            {errors.length > 0 && (
              <IssueList
                tone="error"
                heading="These must be fixed before publishing"
                issues={errors}
              />
            )}

            {missingFile && (
              <IssueList
                tone="error"
                heading="These must be fixed before publishing"
                issues={[{ field: 'file', severity: 'error', message: 'No manuscript has been chosen.' }]}
              />
            )}

            {warnings.length > 0 && (
              <IssueList
                tone="warning"
                heading="Worth fixing, but not blocking"
                issues={warnings}
              />
            )}

            {errors.length === 0 && !missingFile && warnings.length === 0 && (
              <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-emerald-500/10 text-emerald-300">
                <CheckCircle2 size={15} />
                <span className="text-xs font-bold">
                  This record is complete and would pass a retailer feed.
                </span>
              </div>
            )}

            <div className="pt-1">
              <label className={label}>Price (₦)</label>
              <input
                className={field}
                type="number"
                min={0}
                step="0.01"
                value={draft.retail_price}
                onChange={e => set('retail_price', e.target.value)}
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Borrowing is priced at a tenth of this.
              </p>
            </div>

            {canSkipReview ? (
              <label className="flex items-start gap-3 px-4 py-3 rounded-xl bg-slate-800/60 border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 accent-brand-primary"
                  checked={draft.publish_immediately}
                  onChange={e => set('publish_immediately', e.target.checked)}
                />
                <span className="text-[11px] text-slate-300 leading-relaxed">
                  Publish immediately, without review.
                  <span className="block text-slate-500 mt-0.5">
                    Only available to your role. Left unticked, this book waits
                    in the moderation queue like any other.
                  </span>
                </span>
              </label>
            ) : (
              <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-slate-800/60 border border-slate-800">
                <Info size={14} className="text-slate-500 mt-0.5 shrink-0" />
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  This book goes to a moderator before it appears in the public
                  library. You will be told when it is cleared.
                </p>
              </div>
            )}

            {failure && (
              <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-red-500/10 text-red-300">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                <p className="text-[11px] font-bold leading-relaxed">{failure}</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Navigation ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 mt-8 pt-5 border-t border-slate-800">
        <button
          onClick={step === 0 ? onCancel : () => setStep(s => s - 1)}
          disabled={busy}
          className="px-4 py-2.5 rounded-xl text-slate-400 hover:text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 border-none bg-transparent cursor-pointer disabled:opacity-40"
        >
          <ChevronLeft size={13} /> {step === 0 ? 'Cancel' : 'Back'}
        </button>

        {step < STEPS.length - 1 ? (
          <button
            onClick={() => setStep(s => s + 1)}
            disabled={!canAdvance()}
            className="px-6 py-3 rounded-xl bg-brand-primary hover:bg-brand-primary-hover disabled:opacity-40 disabled:cursor-not-allowed text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 border-none cursor-pointer"
          >
            Continue <ChevronRight size={13} />
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={busy || errors.length > 0 || missingFile || oversized}
            className="px-6 py-3 rounded-xl bg-brand-primary hover:bg-brand-primary-hover disabled:opacity-40 disabled:cursor-not-allowed text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border-none cursor-pointer"
          >
            {busy ? (
              <><Loader2 size={13} className="animate-spin" /> {progress || 'Working…'}</>
            ) : (
              <><UploadCloud size={13} /> {draft.publish_immediately ? 'Publish' : 'Send for review'}</>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

/** One file row. Kept separate because the three differ only in wording. */
const FilePick: React.FC<{
  title: string;
  hint: string;
  accept: string;
  file: File | null;
  required?: boolean;
  onPick: (f: File | null) => void;
}> = ({ title, hint, accept, file, required, onPick }) => (
  <div className="px-4 py-4 rounded-2xl bg-slate-800/50 border border-slate-800">
    <div className="flex items-center justify-between gap-3 mb-1">
      <h4 className="text-xs font-black text-white">
        {title} {required && <span className="text-rose-500">*</span>}
      </h4>
      {file && (
        <span className="text-[10px] font-bold text-emerald-400 truncate max-w-[45%]">
          {file.name}
        </span>
      )}
    </div>
    <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">{hint}</p>
    <input
      type="file"
      accept={accept}
      onChange={e => onPick(e.target.files?.[0] || null)}
      className="block w-full text-[11px] text-slate-400 file:mr-3 file:px-3.5 file:py-2 file:rounded-lg file:border-0 file:bg-slate-700 file:text-slate-200 file:text-[10px] file:font-black file:uppercase file:tracking-widest file:cursor-pointer cursor-pointer"
    />
  </div>
);

const IssueList: React.FC<{
  tone: 'error' | 'warning';
  heading: string;
  issues: ValidationIssue[];
}> = ({ tone, heading, issues }) => (
  <div
    className={cn(
      'px-4 py-3.5 rounded-xl space-y-2',
      tone === 'error' ? 'bg-red-500/10' : 'bg-amber-500/10'
    )}
  >
    <div className={cn(
      'flex items-center gap-2 text-[10px] font-black uppercase tracking-widest',
      tone === 'error' ? 'text-red-300' : 'text-amber-300'
    )}>
      <AlertTriangle size={12} /> {heading}
    </div>
    <ul className="space-y-1">
      {issues.map((issue, i) => (
        <li
          key={`${issue.field}-${i}`}
          className={cn(
            'text-[11px] leading-relaxed',
            tone === 'error' ? 'text-red-200' : 'text-amber-200'
          )}
        >
          {issue.message}
        </li>
      ))}
    </ul>
  </div>
);

export default PublishWizard;
