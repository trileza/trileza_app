/**
 * Institutional KYC / KYB.
 *
 * Eight sections, mirroring the JSONB columns on `institution_kyc`. The field
 * lists are data rather than JSX so the form renders itself — eighty hand-written
 * inputs would be unreviewable and would drift from the schema the first time a
 * regulator asked for another field.
 */

export type KycStatus =
  | 'draft' | 'submitted' | 'in_review' | 'info_requested' | 'approved' | 'rejected';

export type FieldType =
  | 'text' | 'email' | 'tel' | 'number' | 'date' | 'textarea'
  | 'select' | 'multiselect' | 'checkbox' | 'file' | 'country';

export interface KycField {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  hint?: string;
  placeholder?: string;
  options?: string[];
  /** Only shown when this other field has one of these values. */
  showWhen?: { field: string; equals: (string | boolean)[] };
  /** Renders across both columns rather than one. */
  wide?: boolean;
}

export interface KycSection {
  id: string;
  /** The JSONB column this section is stored in. */
  column: string;
  title: string;
  description: string;
  fields: KycField[];
}

// ─── Shared option lists ────────────────────────────────────────────────────

export const ENTITY_TYPES = [
  'University', 'College', 'Training Center', 'Corporate Training',
  'Non-Profit', 'Government Agency', 'Other'
];

export const ID_TYPES = ['Passport', 'National ID', 'Driver\'s License', 'Other'];

export const PRIVACY_FRAMEWORKS = ['GDPR', 'FERPA', 'PIPEDA', 'APPI', 'NDPR', 'POPIA', 'Other', 'None'];

export const PROGRAM_TYPES = [
  'Degree', 'Diploma', 'Certificate', 'Short Courses',
  'Professional Development', 'Other'
];

export const FOCUS_AREAS = [
  'Education', 'Vocational Training', 'Corporate Development',
  'Healthcare Training', 'Technology', 'Other'
];

export const BUDGET_RANGES = [
  'Under $100k', '$100k – $500k', '$500k – $2m', '$2m – $10m', 'Over $10m', 'Prefer not to say'
];

// ─── The eight sections ─────────────────────────────────────────────────────

export const KYC_SECTIONS: KycSection[] = [
  {
    id: 'entity',
    column: 'entity_registration',
    title: 'Legal entity & registration',
    description: 'How your institution is constituted and who regulates it.',
    fields: [
      { key: 'legal_name', label: 'Full legal entity name', type: 'text', required: true, hint: 'Exactly as it appears on your registration documents', wide: true },
      { key: 'entity_type', label: 'Legal entity type', type: 'select', required: true, options: ENTITY_TYPES },
      { key: 'entity_type_other', label: 'Please specify', type: 'text', showWhen: { field: 'entity_type', equals: ['Other'] } },
      { key: 'country_of_incorporation', label: 'Country of incorporation', type: 'country', required: true },
      { key: 'registration_number', label: 'Registration / incorporation number', type: 'text', required: true },
      { key: 'established_year', label: 'Year established', type: 'number', required: true, placeholder: '1998' },
      { key: 'regulatory_body', label: 'Regulatory or accreditation body', type: 'text', hint: 'The authority you answer to, if any', wide: true },
      { key: 'doc_incorporation', label: 'Certificate of incorporation or registration', type: 'file', required: true, hint: 'PDF or image, up to 10 MB' },
      { key: 'doc_accreditation', label: 'Proof of accreditation or regulatory approval', type: 'file', hint: 'If your jurisdiction issues one' }
    ]
  },
  {
    id: 'address',
    column: 'address_contact',
    title: 'Address & contacts',
    description: 'Where the institution is registered, and who we speak to.',
    fields: [
      { key: 'reg_street', label: 'Registered street address', type: 'text', required: true, wide: true },
      { key: 'reg_city', label: 'City', type: 'text', required: true },
      { key: 'reg_state', label: 'State / province', type: 'text' },
      { key: 'reg_postal', label: 'Postal code', type: 'text' },
      { key: 'reg_country', label: 'Country', type: 'country', required: true },
      { key: 'mailing_same', label: 'Mailing address is the same as registered', type: 'checkbox', wide: true },
      { key: 'mail_street', label: 'Mailing address', type: 'text', wide: true, showWhen: { field: 'mailing_same', equals: [false] } },
      { key: 'switchboard', label: 'Main institution phone', type: 'tel', required: true, placeholder: '+234 800 000 0000' },

      { key: 'primary_name', label: 'Primary contact — full name', type: 'text', required: true },
      { key: 'primary_title', label: 'Primary contact — job title', type: 'text', required: true },
      { key: 'primary_phone', label: 'Primary contact — direct phone', type: 'tel', required: true, hint: 'Include country code' },
      { key: 'primary_email', label: 'Primary contact — work email', type: 'email', required: true },

      { key: 'secondary_name', label: 'Secondary contact — full name', type: 'text' },
      { key: 'secondary_title', label: 'Secondary contact — job title', type: 'text' },
      { key: 'secondary_phone', label: 'Secondary contact — phone', type: 'tel' },
      { key: 'secondary_email', label: 'Secondary contact — email', type: 'email' }
    ]
  },
  {
    id: 'financial',
    column: 'tax_financial',
    title: 'Tax & banking',
    description: 'Used for invoicing, payouts and tax reporting. Handled confidentially.',
    fields: [
      { key: 'tax_id', label: 'Tax identification number', type: 'text', required: true, hint: 'VAT, GST, EIN, TIN or your local equivalent' },
      { key: 'tax_country', label: 'Country of tax residence', type: 'country', required: true },
      { key: 'doc_tax_certificate', label: 'Tax registration certificate', type: 'file', wide: true },

      { key: 'bank_account_name', label: 'Bank account name', type: 'text', required: true, hint: 'Must match the legal entity name' },
      { key: 'bank_name', label: 'Bank name', type: 'text', required: true },
      { key: 'bank_branch', label: 'Branch', type: 'text' },
      { key: 'bank_account_number', label: 'Account number or IBAN', type: 'text', required: true },
      { key: 'bank_swift', label: 'SWIFT / BIC code', type: 'text', hint: 'Required for international transfers' },
      { key: 'bank_country', label: 'Bank country', type: 'country', required: true },
      { key: 'bank_currency', label: 'Account currency', type: 'text', required: true, placeholder: 'NGN, USD, EUR…' },
      { key: 'doc_bank_confirmation', label: 'Bank confirmation letter or voided cheque', type: 'file', required: true, wide: true },

      { key: 'billing_currency', label: 'Preferred billing currency', type: 'text', required: true, placeholder: 'NGN' },
      { key: 'funding_source', label: 'Primary payment method', type: 'select', required: true, options: ['Bank transfer', 'Credit card', 'Other'] }
    ]
  },
  {
    id: 'representative',
    column: 'authorized_rep',
    title: 'Authorised representative',
    description: 'The individual signing on behalf of the institution. We verify this person’s identity.',
    fields: [
      { key: 'rep_legal_name', label: 'Full legal name', type: 'text', required: true, hint: 'Must match the government ID exactly', wide: true },
      { key: 'rep_id_type', label: 'ID type', type: 'select', required: true, options: ID_TYPES },
      { key: 'rep_id_number', label: 'ID number', type: 'text', required: true },
      { key: 'rep_id_issued', label: 'Issue date', type: 'date', required: true },
      { key: 'rep_id_expiry', label: 'Expiry date', type: 'date', required: true },
      { key: 'rep_id_country', label: 'Country of issuance', type: 'country', required: true },
      { key: 'doc_rep_id', label: 'Copy of government-issued ID', type: 'file', required: true },
      { key: 'doc_rep_photo', label: 'Passport-sized photograph', type: 'file', required: true },
      { key: 'doc_authority', label: 'Proof of authority to act', type: 'file', required: true, wide: true, hint: 'Board resolution, power of attorney or letter of authorisation' }
    ]
  },
  {
    id: 'profile',
    column: 'institutional_profile',
    title: 'Institution profile',
    description: 'Helps us size your portal and understand what you teach.',
    fields: [
      { key: 'native_name', label: 'Official name in native language', type: 'text', hint: 'If different from the legal name above', wide: true },
      { key: 'acronym', label: 'Acronym or abbreviation', type: 'text' },
      { key: 'campuses', label: 'Number of campuses or locations', type: 'number' },
      { key: 'student_count', label: 'Students enrolled', type: 'number', required: true },
      { key: 'faculty_count', label: 'Faculty or instructors', type: 'number', required: true },
      { key: 'admin_staff_count', label: 'Administrative staff', type: 'number' },
      { key: 'budget_range', label: 'Annual budget or revenue', type: 'select', options: BUDGET_RANGES },
      { key: 'focus_area', label: 'Primary focus area', type: 'select', required: true, options: FOCUS_AREAS },
      { key: 'programs', label: 'Programmes offered', type: 'multiselect', options: PROGRAM_TYPES, wide: true },
      { key: 'mission', label: 'Mission statement', type: 'textarea', wide: true, hint: 'A sentence or two is plenty' }
    ]
  },
  {
    id: 'compliance',
    column: 'compliance',
    title: 'Compliance & data protection',
    description: 'Where you operate and the rules your data must follow.',
    fields: [
      { key: 'primary_jurisdiction', label: 'Primary jurisdiction of operation', type: 'country', required: true },
      { key: 'other_jurisdictions', label: 'Other countries you operate in', type: 'text', hint: 'Comma separated', wide: true },
      { key: 'data_residency', label: 'Data residency requirement', type: 'text', hint: 'Where your data must physically be stored, if mandated', wide: true },
      { key: 'privacy_framework', label: 'Privacy framework you follow', type: 'select', required: true, options: PRIVACY_FRAMEWORKS },
      { key: 'handles_sensitive_data', label: 'We handle sensitive data categories', type: 'checkbox', hint: 'Health, biometric, minors, or similar' },
      { key: 'has_dpo', label: 'We have a Data Protection Officer', type: 'checkbox' },
      { key: 'dpo_name', label: 'DPO name', type: 'text', showWhen: { field: 'has_dpo', equals: [true] } },
      { key: 'dpo_contact', label: 'DPO contact', type: 'email', showWhen: { field: 'has_dpo', equals: [true] } },
      { key: 'regulatory_investigation', label: 'Subject to a regulatory investigation in the last 5 years', type: 'checkbox', wide: true },
      { key: 'investigation_detail', label: 'Please give brief details', type: 'textarea', wide: true, showWhen: { field: 'regulatory_investigation', equals: [true] } },
      { key: 'aml_policy', label: 'We maintain an AML / CTF policy', type: 'checkbox', wide: true }
    ]
  },
  {
    id: 'onboarding',
    column: 'risk_onboarding',
    title: 'Your rollout',
    description: 'How you plan to use Trileza, so we can prepare the right support.',
    fields: [
      { key: 'primary_use_case', label: 'Primary use case', type: 'textarea', required: true, wide: true },
      { key: 'initial_users', label: 'Users onboarding immediately', type: 'number', required: true },
      { key: 'growth_12m', label: 'Expected users within 12 months', type: 'number' },
      { key: 'revenue_generation', label: 'We will sell courses through the platform', type: 'checkbox' },
      { key: 'needs_integration', label: 'We need to integrate other systems', type: 'checkbox' },
      { key: 'integration_list', label: 'Which systems?', type: 'text', wide: true, showWhen: { field: 'needs_integration', equals: [true] } },
      { key: 'needs_white_label', label: 'We need custom development or white-labelling', type: 'checkbox' },
      { key: 'industry_requirements', label: 'Compliance requirements specific to your region or sector', type: 'textarea', wide: true },
      { key: 'support_timezone', label: 'Preferred timezone for support', type: 'text', placeholder: 'WAT (UTC+1)' },
      { key: 'support_language', label: 'Preferred language', type: 'text', placeholder: 'English' }
    ]
  },
  {
    id: 'consents',
    column: 'consents',
    title: 'Declarations',
    description: 'Confirm the information above and authorise us to verify it.',
    fields: [
      { key: 'agree_terms', label: 'I agree to the Terms of Service', type: 'checkbox', required: true, wide: true },
      { key: 'agree_privacy', label: 'I agree to the Privacy Policy', type: 'checkbox', required: true, wide: true },
      { key: 'agree_dpa', label: 'I agree to the Data Processing Agreement', type: 'checkbox', required: true, wide: true },
      { key: 'confirm_accurate', label: 'I confirm all information provided is accurate and complete', type: 'checkbox', required: true, wide: true },
      { key: 'consent_kyc', label: 'I consent to verification checks on this institution and on me as its representative', type: 'checkbox', required: true, wide: true },
      { key: 'confirm_authority', label: 'I confirm I am authorised to bind this institution to these agreements', type: 'checkbox', required: true, wide: true },
      { key: 'consent_marketing', label: 'Send me product updates and offers (optional)', type: 'checkbox', wide: true },
      { key: 'signature_name', label: 'Digital signature — type your full name', type: 'text', required: true, hint: 'Typing your name here has the same effect as signing' },
      { key: 'signature_date', label: 'Date', type: 'date', required: true }
    ]
  }
];

/** Sections that must be complete before the record can be submitted. */
export const REQUIRED_SECTION_IDS = KYC_SECTIONS.map(s => s.id);

export interface InstitutionKyc {
  id: string;
  tenant_id?: string | null;
  submitted_by: string;
  legal_name: string;
  legal_entity_type?: string | null;
  country_of_incorporation?: string | null;
  registration_number?: string | null;
  tax_identification_number?: string | null;
  tax_residence_country?: string | null;
  status: KycStatus;
  risk_rating?: 'low' | 'medium' | 'high' | null;

  entity_registration: Record<string, any>;
  address_contact: Record<string, any>;
  tax_financial: Record<string, any>;
  authorized_rep: Record<string, any>;
  institutional_profile: Record<string, any>;
  compliance: Record<string, any>;
  risk_onboarding: Record<string, any>;
  consents: Record<string, any>;

  documents: Array<{
    kind: string;
    name: string;
    path: string;
    type?: string;
    size?: number;
    uploaded_at: string;
  }>;

  reviewed_by?: string | null;
  review_notes?: string | null;
  info_requested?: string | null;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  expires_at?: string | null;
  created_at: string;
  updated_at?: string;
}
