import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2, MapPin, Landmark, BadgeCheck, GraduationCap,
  ShieldCheck, Rocket, FileSignature, UploadCloud, CheckCircle2,
  ArrowLeft, ArrowRight, Loader2, AlertCircle, Save
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { FormShell, Field } from '../../components/shared/FormShell';
import { useAuthStore } from '../../store/authStore';
import { COUNTRIES } from '../../utils/countries';
import { KYC_SECTIONS } from '../../types/institutionKyc';
import type { KycField } from '../../types/institutionKyc';
import {
  institutionKycService,
  missingRequiredFields
} from '../../lib/services/institutionKyc';
import type { KycDocument } from '../../lib/services/institutionKyc';
import type { InstitutionKyc } from '../../types/institutionKyc';

/**
 * Institutional verification.
 *
 * Eighty-odd fields across eight sections. Three decisions shape this page:
 *
 *   1. The fields are rendered from `KYC_SECTIONS`, not written out. Eighty
 *      hand-written inputs cannot be reviewed, and would drift from the columns
 *      they are saved into the first time a regulator asked for another field.
 *
 *   2. Each section saves as the applicant leaves it. A form this long WILL be
 *      abandoned halfway; losing an hour's work to a closed tab is the surest
 *      way to lose the customer too.
 *
 *   3. Required fields are checked at the section boundary, not on submit. Being
 *      told at the end that something on page two is missing is a poor way to
 *      spend someone's afternoon.
 */

const SECTION_ICONS: Record<string, LucideIcon> = {
  entity: Building2,
  address: MapPin,
  financial: Landmark,
  representative: BadgeCheck,
  profile: GraduationCap,
  compliance: ShieldCheck,
  onboarding: Rocket,
  consents: FileSignature
};

const STEPS = KYC_SECTIONS.map(s => ({ label: s.title }));

const inputClass =
  'w-full h-11 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 ' +
  'rounded-[var(--radius-control)] px-3.5 text-sm font-semibold text-slate-900 dark:text-white ' +
  'outline-none focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/15 transition-all ' +
  'placeholder:font-medium placeholder:text-slate-400';

type SectionValues = Record<string, Record<string, any>>;

const emptySections = (): SectionValues =>
  Object.fromEntries(KYC_SECTIONS.map(s => [s.id, {}]));

export const InstitutionKycForm: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [stepIndex, setStepIndex] = useState(0);
  const [values, setValues] = useState<SectionValues>(emptySections);
  const [record, setRecord] = useState<InstitutionKyc | null>(null);
  const [documents, setDocuments] = useState<KycDocument[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState<string | null>(null);

  const headingRef = useRef<HTMLDivElement>(null);

  const section = KYC_SECTIONS[stepIndex];
  const sectionValues = values[section.id] || {};
  const readOnly = record !== null && !institutionKycService.isEditable(record);

  // ── Resume an existing draft ──────────────────────────────────────────────
  useEffect(() => {
    // No account yet. Stop loading and let the sign-in prompt render — leaving
    // `loading` true here left the page spinning with nothing to wait for.
    if (!user?.id) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    (async () => {
      try {
        const existing = await institutionKycService.getMine(user.id);
        if (cancelled) return;

        if (existing) {
          setRecord(existing);
          setDocuments(existing.documents || []);
          setValues({
            ...emptySections(),
            ...Object.fromEntries(
              KYC_SECTIONS.map(s => [s.id, (existing as any)[s.column] || {}])
            )
          });
          if (!institutionKycService.isEditable(existing)) setSubmitted(true);
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Could not load your application.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user?.id]);

  // Moving between sections scrolls a long page back to the heading, and moves
  // focus there so a screen reader announces the new section rather than
  // silently landing mid-form.
  useEffect(() => {
    if (loading) return;
    headingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    headingRef.current?.focus();
  }, [stepIndex, loading]);

  const setValue = useCallback((key: string, value: any) => {
    setValues(prev => ({
      ...prev,
      [section.id]: { ...prev[section.id], [key]: value }
    }));
  }, [section.id]);

  const missing = useMemo(
    () => missingRequiredFields(section.id, sectionValues),
    [section.id, sectionValues]
  );

  /** Persist the current section. Returns the record id, or null on failure. */
  const persist = async (): Promise<string | null> => {
    if (!user?.id || readOnly) return record?.id ?? null;

    setSaving(true);
    setError(null);
    try {
      const saved = await institutionKycService.saveSection({
        userId: user.id,
        recordId: record?.id,
        sectionId: section.id,
        values: sectionValues
      });
      setRecord(saved);
      return saved.id;
    } catch (err: any) {
      setError(err?.message || 'Could not save this section.');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleNext = async () => {
    if (missing.length > 0) {
      setTouched(new Set(missing));
      setError('Please complete the highlighted fields before continuing.');
      headingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    setTouched(new Set());
    if (!(await persist())) return;

    if (stepIndex < KYC_SECTIONS.length - 1) {
      setStepIndex(stepIndex + 1);
    } else {
      await handleSubmit();
    }
  };

  const handleBack = async () => {
    // Save on the way out too — going back should not discard what was typed.
    if (!readOnly) await persist();
    if (stepIndex > 0) setStepIndex(stepIndex - 1);
    else navigate(-1);
  };

  const handleSubmit = async () => {
    const id = record?.id;
    if (!id) return;

    setSaving(true);
    setError(null);
    try {
      const done = await institutionKycService.submit({ recordId: id, sections: values });
      setRecord(done);
      setSubmitted(true);
    } catch (err: any) {
      setError(err?.message || 'Could not submit your application.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (fieldKey: string, file: File) => {
    if (!user?.id) return;

    setError(null);
    setUploading(fieldKey);
    try {
      // The row has to exist before a document can hang off it.
      const id = record?.id || (await persist());
      if (!id) return;

      const next = await institutionKycService.uploadDocument({
        userId: user.id,
        recordId: id,
        kind: fieldKey,
        file,
        existing: documents
      });
      setDocuments(next);
      setValue(fieldKey, file.name);
    } catch (err: any) {
      setError(err?.message || 'That upload did not complete.');
    } finally {
      setUploading(null);
    }
  };

  // ── Field rendering ───────────────────────────────────────────────────────
  const renderField = (field: KycField) => {
    if (field.showWhen) {
      const shown = field.showWhen.equals.includes(sectionValues[field.showWhen.field]);
      if (!shown) return null;
    }

    const id = `kyc-${section.id}-${field.key}`;
    const value = sectionValues[field.key];
    const invalid = touched.has(field.key);
    const errorText = invalid ? 'This is required.' : null;

    const control = (() => {
      switch (field.type) {
        case 'textarea':
          return (
            <textarea
              id={id}
              rows={3}
              disabled={readOnly}
              value={value ?? ''}
              placeholder={field.placeholder}
              onChange={e => setValue(field.key, e.target.value)}
              className={inputClass.replace('h-11', 'min-h-[88px] py-3') + ' resize-y leading-relaxed'}
            />
          );

        case 'select':
        case 'country': {
          const options = field.type === 'country' ? COUNTRIES : (field.options || []);
          return (
            <select
              id={id}
              disabled={readOnly}
              value={value ?? ''}
              onChange={e => setValue(field.key, e.target.value)}
              className={inputClass + ' cursor-pointer'}
            >
              <option value="">Select…</option>
              {options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          );
        }

        case 'multiselect':
          return (
            <div className="flex flex-wrap gap-2" role="group" aria-labelledby={id}>
              {(field.options || []).map(option => {
                const selected: string[] = Array.isArray(value) ? value : [];
                const on = selected.includes(option);
                return (
                  <button
                    key={option}
                    type="button"
                    disabled={readOnly}
                    aria-pressed={on}
                    onClick={() => setValue(
                      field.key,
                      on ? selected.filter(v => v !== option) : [...selected, option]
                    )}
                    className={`px-3.5 py-2 rounded-[var(--radius-control)] text-xs font-bold border transition-colors cursor-pointer accent-ring ${
                      on
                        ? 'bg-brand-primary text-white border-brand-primary'
                        : 'bg-slate-50 dark:bg-slate-950/50 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-brand-primary'
                    }`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          );

        case 'checkbox':
          return (
            <label
              htmlFor={id}
              className={`flex items-start gap-3 p-3.5 rounded-[var(--radius-control)] border transition-colors ${
                readOnly ? '' : 'cursor-pointer hover:border-brand-primary'
              } ${
                invalid
                  ? 'border-red-400 bg-red-50/50 dark:bg-red-950/20'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50'
              }`}
            >
              <input
                id={id}
                type="checkbox"
                disabled={readOnly}
                checked={value === true}
                onChange={e => setValue(field.key, e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-[var(--role-accent)] shrink-0 cursor-pointer"
              />
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 leading-snug">
                {field.label}
                {field.required && <span className="text-brand-primary ml-1" aria-hidden="true">*</span>}
              </span>
            </label>
          );

        case 'file': {
          const doc = documents.find(d => d.kind === field.key);
          const busy = uploading === field.key;
          return (
            <div className="flex flex-wrap items-center gap-3">
              <label
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-[var(--radius-control)] text-xs font-black uppercase tracking-wider transition-all ${
                  readOnly || busy
                    ? 'bg-slate-200 dark:bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-brand-primary hover:bg-brand-dark text-white cursor-pointer shadow-[var(--shadow-subtle)] active:scale-95'
                }`}
              >
                {busy
                  ? <><Loader2 size={14} className="animate-spin" aria-hidden="true" /> Uploading…</>
                  : <><UploadCloud size={14} aria-hidden="true" /> {doc ? 'Replace file' : 'Select file'}</>}
                <input
                  type="file"
                  accept=".pdf,image/*"
                  className="sr-only"
                  disabled={readOnly || busy}
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) handleUpload(field.key, file);
                    e.target.value = '';
                  }}
                />
              </label>
              {doc && !busy && (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-primary min-w-0">
                  <CheckCircle2 size={13} aria-hidden="true" />
                  <span className="truncate max-w-[16rem]">{doc.name}</span>
                </span>
              )}
            </div>
          );
        }

        default:
          return (
            <input
              id={id}
              type={field.type}
              disabled={readOnly}
              value={value ?? ''}
              placeholder={field.placeholder}
              onChange={e => setValue(field.key, e.target.value)}
              className={inputClass + (invalid ? ' border-red-400 focus:border-red-500 focus:ring-red-500/15' : '')}
            />
          );
      }
    })();

    // A checkbox carries its own label inside the control.
    if (field.type === 'checkbox') {
      return (
        <div key={field.key} className={field.wide ? 'sm:col-span-2' : ''}>
          {control}
          {(errorText || field.hint) && (
            <p className={`text-xs mt-1.5 ${errorText ? 'font-semibold text-red-600 dark:text-red-400' : 'text-slate-400'}`}>
              {errorText || field.hint}
            </p>
          )}
        </div>
      );
    }

    return (
      <div key={field.key} className={field.wide ? 'sm:col-span-2' : ''}>
        <Field
          label={field.label}
          hint={field.hint}
          error={errorText}
          required={field.required}
          htmlFor={id}
        >
          {control}
        </Field>
      </div>
    );
  };

  // ── States ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 size={26} className="animate-spin text-brand-primary" aria-label="Loading" />
      </div>
    );
  }

  // Verification is tied to the account that submits it, so there is nowhere to
  // save progress without one. Say that plainly rather than bouncing them.
  if (!user?.id) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 px-4 py-10 sm:py-16">
        <div className="max-w-2xl mx-auto">
          <FormShell
            eyebrow="Institution verification"
            title="Sign in to continue"
            description="Verification is saved against your account so you can leave and come back to it. Sign in or create an account, then return to this page to begin."
            icon={ShieldCheck}
            actions={
              <>
                <button
                  onClick={() => navigate('/')}
                  className="px-4 py-2.5 rounded-[var(--radius-control)] text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer accent-ring"
                >
                  Not now
                </button>
                <button
                  onClick={() => navigate('/login')}
                  className="px-5 py-2.5 rounded-[var(--radius-control)] bg-brand-primary hover:bg-brand-dark text-white text-xs font-black uppercase tracking-wider transition-colors cursor-pointer accent-ring"
                >
                  Sign in
                </button>
              </>
            }
          >
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              You will be asked for your registration and tax details, banking information for
              payouts, and identification for the person authorised to act for your institution.
              It takes about 20 minutes and saves as you go.
            </p>
          </FormShell>
        </div>
      </div>
    );
  }

  if (submitted) {
    const infoNeeded = record?.status === 'info_requested';
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 px-4 py-10 sm:py-16">
        <div className="max-w-2xl mx-auto">
          <FormShell
            eyebrow="Institution verification"
            title={infoNeeded ? 'We need a little more' : 'Verification submitted'}
            description={
              infoNeeded
                ? 'Our compliance team has reviewed your submission and asked for the following before they can continue.'
                : 'Your details are with our compliance team. Nothing further is needed from you right now — we will email the contact you nominated.'
            }
            icon={infoNeeded ? AlertCircle : CheckCircle2}
            actions={
              <button
                onClick={() => infoNeeded ? (setSubmitted(false), setStepIndex(0)) : navigate('/')}
                className="px-5 py-2.5 rounded-[var(--radius-control)] bg-brand-primary hover:bg-brand-dark text-white text-xs font-black uppercase tracking-wider transition-colors cursor-pointer accent-ring"
              >
                {infoNeeded ? 'Update my application' : 'Back to Trileza'}
              </button>
            }
          >
            {infoNeeded && record?.info_requested && (
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 p-4 rounded-[var(--radius-control)] bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 leading-relaxed">
                {record.info_requested}
              </p>
            )}
            {!infoNeeded && (
              <dl className="grid sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-xs font-black uppercase tracking-wider text-slate-400">Institution</dt>
                  <dd className="font-bold text-slate-900 dark:text-white mt-1">{record?.legal_name}</dd>
                </div>
                <div>
                  <dt className="text-xs font-black uppercase tracking-wider text-slate-400">Reference</dt>
                  <dd className="font-bold text-slate-900 dark:text-white mt-1 font-mono text-xs">
                    {record?.id?.slice(0, 8).toUpperCase()}
                  </dd>
                </div>
              </dl>
            )}
          </FormShell>
        </div>
      </div>
    );
  }

  const isLast = stepIndex === KYC_SECTIONS.length - 1;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 px-4 py-10 sm:py-14">
      <div className="max-w-3xl mx-auto">
        <div ref={headingRef} tabIndex={-1} className="outline-none">
          <FormShell
            eyebrow={`Institution verification · Section ${stepIndex + 1} of ${KYC_SECTIONS.length}`}
            title={section.title}
            description={section.description}
            icon={SECTION_ICONS[section.id]}
            steps={STEPS}
            currentStep={stepIndex + 1}
            actions={
              <>
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[var(--radius-control)] text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50 accent-ring"
                >
                  <ArrowLeft size={14} aria-hidden="true" />
                  {stepIndex === 0 ? 'Cancel' : 'Back'}
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={saving || Boolean(uploading)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[var(--radius-control)] bg-brand-primary hover:bg-brand-dark text-white text-xs font-black uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-60 shadow-[var(--shadow-subtle)] accent-ring"
                >
                  {saving
                    ? <><Loader2 size={14} className="animate-spin" aria-hidden="true" /> Saving…</>
                    : isLast
                      ? <><FileSignature size={14} aria-hidden="true" /> Submit for review</>
                      : <>Continue <ArrowRight size={14} aria-hidden="true" /></>}
                </button>
              </>
            }
          >
            {error && (
              <div
                role="alert"
                className="flex items-start gap-3 p-4 rounded-[var(--radius-control)] bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900"
              >
                <AlertCircle size={16} className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" aria-hidden="true" />
                <p className="text-sm font-semibold text-red-700 dark:text-red-300">{error}</p>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-5">
              {section.fields.map(renderField)}
            </div>
          </FormShell>
        </div>

        {/* Progress is saved silently; say so, so nobody feels they must finish
            in one sitting. */}
        <p className="flex items-center justify-center gap-2 text-xs text-slate-400 mt-5">
          <Save size={12} aria-hidden="true" />
          {record
            ? 'Saved. You can close this page and pick up where you left off.'
            : 'Your progress saves automatically as you move between sections.'}
        </p>
      </div>
    </div>
  );
};

export default InstitutionKycForm;
