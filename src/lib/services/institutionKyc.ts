import { nexus } from '../nexus';
import { KYC_SECTIONS } from '../../types/institutionKyc';
import type { InstitutionKyc, KycStatus } from '../../types/institutionKyc';

/**
 * Institutional KYC / KYB.
 *
 * The form is long — eight sections, roughly eighty fields, several document
 * uploads — so it is built to be abandoned and resumed. Every section saves to
 * a `draft` row as the applicant leaves it; nothing is lost by closing the tab,
 * and nothing enters the review queue until they submit deliberately.
 *
 * Two things this deliberately does NOT do:
 *
 *   1. It never provisions a tenant. Approval is a compliance decision recorded
 *      here; turning that into a live portal stays in `upgradeService`, after
 *      payment. Conflating the two is how the old flow produced tenants for
 *      institutions that were never verified.
 *
 *   2. It never returns public URLs for documents. The `institution-kyc` bucket
 *      holds passports, bank letters and incorporation certificates. Reviewers
 *      get short-lived signed URLs; the paths stored on the row are useless on
 *      their own.
 */

const BUCKET = 'institution-kyc';
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

/** Statuses in which the applicant may still edit their own record. */
const EDITABLE: KycStatus[] = ['draft', 'info_requested'];

/** Fields promoted out of JSONB so the review queue can filter and sort. */
const ENTITY_TYPE_SLUGS: Record<string, string> = {
  'University': 'university',
  'College': 'college',
  'Training Center': 'training_center',
  'Corporate Training': 'corporate_training',
  'Non-Profit': 'non_profit',
  'Government Agency': 'government_agency',
  'Other': 'other'
};

export interface KycDocument {
  kind: string;
  name: string;
  path: string;
  type?: string;
  size?: number;
  uploaded_at: string;
}

/** A section is complete when every field marked required has a value. */
export function missingRequiredFields(
  sectionId: string,
  values: Record<string, any>
): string[] {
  const section = KYC_SECTIONS.find(s => s.id === sectionId);
  if (!section) return [];

  return section.fields
    .filter(f => {
      if (!f.required) return false;

      // A conditional field is only required when it is actually on screen.
      if (f.showWhen) {
        const shown = f.showWhen.equals.includes(values[f.showWhen.field]);
        if (!shown) return false;
      }

      const v = values[f.key];
      if (f.type === 'checkbox') return v !== true;
      if (Array.isArray(v)) return v.length === 0;
      return v === undefined || v === null || String(v).trim() === '';
    })
    .map(f => f.key);
}

export const institutionKycService = {
  /**
   * The caller's own KYC record, if they have one. Returns null rather than
   * throwing when there is none — not having applied yet is the normal case.
   */
  async getMine(userId: string): Promise<InstitutionKyc | null> {
    const { data, error } = await nexus.database
      .from('institution_kyc')
      .select('*')
      .eq('submitted_by', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(`Could not load your verification details: ${error.message}`);
    }
    return (data as InstitutionKyc) || null;
  },

  isEditable(record: InstitutionKyc | null): boolean {
    if (!record) return true;
    return EDITABLE.includes(record.status);
  },

  /**
   * Save one section. Creates the draft row on first call.
   *
   * Sections are saved individually rather than the whole form at once so that
   * a failure on section seven does not discard sections one through six.
   */
  async saveSection(params: {
    userId: string;
    recordId?: string | null;
    sectionId: string;
    values: Record<string, any>;
  }): Promise<InstitutionKyc> {
    const section = KYC_SECTIONS.find(s => s.id === params.sectionId);
    if (!section) throw new Error(`Unknown section: ${params.sectionId}`);

    const patch: Record<string, any> = {
      [section.column]: params.values,
      updated_at: new Date().toISOString()
    };

    // Mirror the queue columns whenever their source section is the one saved.
    if (section.id === 'entity') {
      patch.legal_name = params.values.legal_name || 'Unnamed institution';
      patch.legal_entity_type = ENTITY_TYPE_SLUGS[params.values.entity_type] || null;
      patch.country_of_incorporation = params.values.country_of_incorporation || null;
      patch.registration_number = params.values.registration_number || null;
    }
    if (section.id === 'financial') {
      patch.tax_identification_number = params.values.tax_id || null;
      patch.tax_residence_country = params.values.tax_country || null;
    }

    if (params.recordId) {
      const { data, error } = await nexus.database
        .from('institution_kyc')
        .update(patch)
        .eq('id', params.recordId)
        .select('*')
        .maybeSingle();

      if (error) throw new Error(`Could not save this section: ${error.message}`);
      if (!data) {
        // RLS refused the update — the record has moved out of an editable state.
        throw new Error('This application is being reviewed and can no longer be edited.');
      }
      return data as InstitutionKyc;
    }

    const { data, error } = await nexus.database
      .from('institution_kyc')
      .insert({
        submitted_by: params.userId,
        status: 'draft',
        // NOT NULL, and the applicant may not have reached section one yet.
        legal_name: patch.legal_name || 'Draft application',
        ...patch
      })
      .select('*')
      .maybeSingle();

    if (error) {
      throw new Error(`Could not start your application: ${error.message}`);
    }
    return data as InstitutionKyc;
  },

  /**
   * Upload one supporting document to the private bucket and record it on the
   * row. `kind` is the field key it satisfies, so a reviewer can tell a bank
   * letter from a passport without opening either.
   */
  async uploadDocument(params: {
    userId: string;
    recordId: string;
    kind: string;
    file: File;
    existing: KycDocument[];
  }): Promise<KycDocument[]> {
    if (params.file.size > MAX_DOCUMENT_BYTES) {
      throw new Error('That file is larger than 10 MB. Please upload a smaller scan or photo.');
    }

    const safeName = params.file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${params.userId}/${params.kind}/${Date.now()}_${safeName}`;

    const { error: upErr } = await nexus.storage.from(BUCKET).upload(path, params.file);
    if (upErr) {
      throw new Error(`That upload did not complete: ${upErr.message}`);
    }

    const entry: KycDocument = {
      kind: params.kind,
      name: params.file.name,
      path,
      type: params.file.type || 'unknown',
      size: params.file.size,
      uploaded_at: new Date().toISOString()
    };

    // One document per kind — re-uploading replaces rather than accumulates,
    // otherwise a reviewer sees three passports and cannot tell which is current.
    const documents = [...params.existing.filter(d => d.kind !== params.kind), entry];

    const { error } = await nexus.database
      .from('institution_kyc')
      .update({ documents, updated_at: new Date().toISOString() })
      .eq('id', params.recordId);

    if (error) {
      throw new Error(`The file uploaded but could not be attached: ${error.message}`);
    }
    return documents;
  },

  /**
   * Hand the application to compliance.
   *
   * Validation runs here as well as in the form, because the form's checks are
   * a convenience and this is the boundary that matters.
   */
  async submit(params: {
    recordId: string;
    sections: Record<string, Record<string, any>>;
  }): Promise<InstitutionKyc> {
    const incomplete = KYC_SECTIONS
      .map(s => ({ id: s.id, title: s.title, missing: missingRequiredFields(s.id, params.sections[s.id] || {}) }))
      .filter(s => s.missing.length > 0);

    if (incomplete.length > 0) {
      throw new Error(
        `Some required details are still missing in: ${incomplete.map(s => s.title).join(', ')}.`
      );
    }

    const now = new Date().toISOString();
    const { data, error } = await nexus.database
      .from('institution_kyc')
      .update({
        status: 'submitted',
        submitted_at: now,
        updated_at: now,
        // Clear any previous request for more information — it has been answered.
        info_requested: null
      })
      .eq('id', params.recordId)
      .select('*')
      .maybeSingle();

    if (error) throw new Error(`Could not submit your application: ${error.message}`);
    if (!data) throw new Error('This application can no longer be submitted.');
    return data as InstitutionKyc;
  },

  // ─── Compliance side ──────────────────────────────────────────────────────

  /** The review queue. Oldest submission first — nobody should wait longest. */
  async listForReview(status?: KycStatus): Promise<InstitutionKyc[]> {
    let query = nexus.database
      .from('institution_kyc')
      .select('*')
      .order('submitted_at', { ascending: true });

    query = status
      ? query.eq('status', status)
      : query.in('status', ['submitted', 'in_review', 'info_requested']);

    const { data, error } = await query;
    if (error) throw new Error(`Could not load the review queue: ${error.message}`);
    return (data as InstitutionKyc[]) || [];
  },

  /**
   * Fetch one uploaded document for viewing.
   *
   * Returns a blob object URL, not a link to the file. The bucket is private,
   * so the download is authorised by the reviewer's own session and the URL it
   * produces is same-origin and dies with the tab — nothing shareable is
   * created. **The caller must revoke the URL when done with it.**
   */
  async downloadDocument(path: string): Promise<string> {
    const { data, error } = await nexus.storage.from(BUCKET).download(path);

    if (error || !data) {
      throw new Error(`Could not open that document: ${error?.message || 'no file returned'}`);
    }
    return URL.createObjectURL(data);
  },

  /**
   * Record a review decision.
   *
   * `approved` sets an expiry, because KYC goes stale — a certificate of good
   * standing from four years ago proves nothing today.
   */
  async review(params: {
    recordId: string;
    reviewerId: string;
    status: Extract<KycStatus, 'in_review' | 'info_requested' | 'approved' | 'rejected'>;
    notes?: string;
    infoRequested?: string;
    riskRating?: 'low' | 'medium' | 'high';
    /** Months until re-verification is due. Applies to approvals only. */
    validForMonths?: number;
  }): Promise<InstitutionKyc> {
    if (params.status === 'info_requested' && !params.infoRequested?.trim()) {
      throw new Error('Say what is needed — an applicant cannot act on a blank request.');
    }
    if (params.status === 'rejected' && !params.notes?.trim()) {
      throw new Error('A rejection needs a reason on the record.');
    }

    const now = new Date();
    const patch: Record<string, any> = {
      status: params.status,
      reviewed_by: params.reviewerId,
      reviewed_at: now.toISOString(),
      updated_at: now.toISOString()
    };

    if (params.notes !== undefined) patch.review_notes = params.notes;
    if (params.riskRating) patch.risk_rating = params.riskRating;
    patch.info_requested = params.status === 'info_requested' ? params.infoRequested : null;

    if (params.status === 'approved') {
      const expires = new Date(now);
      expires.setMonth(expires.getMonth() + (params.validForMonths ?? 24));
      patch.expires_at = expires.toISOString();
    }

    const { data, error } = await nexus.database
      .from('institution_kyc')
      .update(patch)
      .eq('id', params.recordId)
      .select('*')
      .maybeSingle();

    if (error) throw new Error(`Could not record that decision: ${error.message}`);
    if (!data) throw new Error('That application could not be updated.');
    return data as InstitutionKyc;
  },

  /** Link an approved record to the tenant provisioned from it. */
  async attachTenant(recordId: string, tenantId: string): Promise<void> {
    const { error } = await nexus.database
      .from('institution_kyc')
      .update({ tenant_id: tenantId, updated_at: new Date().toISOString() })
      .eq('id', recordId);

    if (error) {
      throw new Error(`The institution was created but its verification record could not be linked: ${error.message}`);
    }
  }
};
