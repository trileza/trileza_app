import { nexus } from '../nexus';
import { isValidSubdomain, DEFAULT_TENANT_ID } from '../../utils/tenant';
import type { SubscriptionTier, BillingInterval } from '../monetization/types';
import type { Tenant } from '../../types';

/**
 * Tier upgrades and institution provisioning.
 *
 * This exists because the checkout page and the upgrade modal each carried
 * their own copy of this flow, and the copies had drifted apart — one wrote the
 * tenant's real id onto the subscription, the other wrote a string built from
 * the subdomain, so the two records disagreed about which tenant the customer
 * belonged to. There is now one implementation.
 *
 * Two rules the previous flow broke, both enforced here:
 *
 *   1. An institution is provisioned only AFTER payment settles. Creating it
 *      first left an orphaned tenant and a claimed subdomain whenever someone
 *      closed the Paystack popup — and because subdomain is UNIQUE, their
 *      second attempt then failed permanently.
 *
 *   2. Paying never grants mentor status. Tier and vetting are separate: a
 *      learner who buys Pro gets Pro quotas, not the right to publish.
 */

export interface SubdomainCheck {
  available: boolean;
  reason?: string;
}

/**
 * The tenant an Institutional subscription is recorded against before its
 * institution exists. provisionInstitution() replaces it with the real tenant;
 * a subscription already pointing elsewhere is treated as provisioned.
 */
export const PLACEHOLDER_TENANT_ID = DEFAULT_TENANT_ID;

/** The subdomains the platform reserves for its own routes. */
const RESERVED = ['admin', 'www', 'api', 'app', 'system', 'root', 'gate', 'signin', 'signup', 'support', 'help', 'status'];

export const upgradeService = {
  /**
   * Is this subdomain both well-formed and free? Called before payment so a
   * customer never pays for a portal address they cannot have.
   */
  async checkSubdomain(subdomain: string): Promise<SubdomainCheck> {
    const slug = (subdomain || '').trim().toLowerCase();

    if (!slug) {
      return { available: false, reason: 'Choose a portal address.' };
    }
    if (slug.length < 3) {
      return { available: false, reason: 'Must be at least 3 characters.' };
    }
    if (slug.length > 30) {
      return { available: false, reason: 'Must be 30 characters or fewer.' };
    }
    if (RESERVED.includes(slug)) {
      return { available: false, reason: 'That address is reserved.' };
    }
    if (!isValidSubdomain(slug)) {
      return { available: false, reason: 'Use lowercase letters, numbers and hyphens only.' };
    }

    // A database function rather than a table read: only active tenants are
    // visible to the public, so a pending registration's address used to look
    // free here and then fail on insert.
    const { data: taken, error } = await nexus.database.rpc('subdomain_is_taken', {
      p_subdomain: slug
    });

    if (error) {
      // Don't claim availability we could not verify.
      return { available: false, reason: 'Could not check that address. Try again.' };
    }
    if (taken === true) {
      return { available: false, reason: 'That address is already taken.' };
    }

    return { available: true };
  },

  /**
   * Create the institution. Call this only once payment has settled.
   * Returns the tenant, whose `id` is the one every other record must use.
   *
   * The database function requires the caller's own active Institutional
   * subscription, creates the tenant live, and links the subscription to it in
   * the same transaction. A subscription provisions one tenant; calling again
   * with it returns that tenant, so retrying after a network error is safe.
   *
   * The subscription must have been recorded against the placeholder
   * 'default-tenant' — see PLACEHOLDER_TENANT_ID.
   */
  async provisionInstitution(params: {
    subscriptionId: string;
    institutionName: string;
    subdomain: string;
    adminEmail: string;
    website?: string;
  }): Promise<Tenant> {
    const { data, error } = await nexus.database.rpc('provision_institution', {
      p_subscription_id: params.subscriptionId,
      p_name: params.institutionName,
      p_subdomain: params.subdomain,
      p_email: params.adminEmail,
      p_custom_domain: params.website || null
    });

    if (error) {
      throw new Error(`Payment succeeded but the institution could not be created: ${error.message}`);
    }
    return data as Tenant;
  },

  /**
   * Apply a tier change to the buyer's profile.
   *
   * Metadata is merged, never replaced — an earlier version overwrote the whole
   * column, silently wiping mentor_application_status and pending_mentor_data
   * for anyone who bought a plan mid-application.
   *
   * Mentor status is deliberately untouched: `mentor_onboarded` and
   * `mentor_application_status` are set by the review flow alone.
   */
  async applyTierToProfile(params: {
    userId: string;
    tier: SubscriptionTier;
    interval: BillingInterval;
    tenantId?: string;
    tenantSubdomain?: string;
    institutionName?: string;
  }): Promise<Record<string, any>> {
    const { data: profile, error: fetchErr } = await nexus.database
      .from('profiles')
      .select('metadata, role')
      .eq('id', params.userId)
      .maybeSingle();

    if (fetchErr) {
      throw new Error(`Could not read your profile to apply the upgrade: ${fetchErr.message}`);
    }

    const existing = (profile as any)?.metadata || {};
    const now = new Date().toISOString();

    const mergedMetadata: Record<string, any> = {
      ...existing,
      subscription_tier: params.tier,
      subscription_interval: params.interval,
      subscription_status: 'active',
      subscription_updated_at: now,
      mentor_tier: params.tier
    };

    const updates: Record<string, any> = { mentor_tier: params.tier };

    if (params.tier === 'institutional') {
      // An institution admin is a distinct role, and this one IS granted by
      // purchase — they are administering their own tenant, not teaching on
      // the public marketplace.
      updates.role = 'management';
      mergedMetadata.role = 'management';
      mergedMetadata.is_tenant_admin = true;
      mergedMetadata.institution_onboarded = true;
      mergedMetadata.active_role = 'management';

      if (params.institutionName) mergedMetadata.institution_name = params.institutionName;
      if (params.tenantSubdomain) mergedMetadata.tenant_subdomain = params.tenantSubdomain;

      if (params.tenantId) {
        updates.tenant_id = params.tenantId;
        mergedMetadata.tenant_id = params.tenantId;
      }
    }

    updates.metadata = mergedMetadata;

    const { error: updateErr } = await nexus.database
      .from('profiles')
      .update(updates)
      .eq('id', params.userId);

    if (updateErr) {
      throw new Error(`Payment succeeded but your plan could not be applied: ${updateErr.message}`);
    }

    return mergedMetadata;
  },

  /**
   * Whether this account may publish to the public marketplace.
   *
   * Buying a tier is not enough — an admin must have approved the mentor
   * application. Institution admins publish inside their own tenant and are
   * not gated by marketplace vetting.
   */
  canPublishPublicly(user: { role?: string; metadata?: Record<string, any> } | null): boolean {
    if (!user) return false;
    const meta = user.metadata || {};
    if (user.role === 'management' || meta.is_tenant_admin === true) return true;
    return meta.mentor_application_status === 'approved' && meta.mentor_onboarded === true;
  }
};
