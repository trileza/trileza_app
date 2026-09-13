import { nexus } from '../nexus';
import type { Tenant, TenantAnalytics, TenantBilling, UserProfile, Course } from '../../types';

/** Outcome of a CSV import, with a per-row reason for everything rejected. */
export interface BulkImportResult {
  imported: number;
  failed: number;
  errors: Array<{ email: string; reason: string }>;
}

export const INITIAL_DEFAULT_TENANT: Tenant = {
  id: 'default-tenant',
  name: 'Trileza Main LMS',
  subdomain: 'app',
  custom_domain: 'trileza.com',
  email: 'admin@trileza.com',
  status: 'active',
  logo_url: 'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?auto=format&fit=crop&q=80&w=200',
  primary_color: '#4f46e5',
  plan: 'enterprise',
  settings: {
    allow_self_registration: true,
    default_user_role: 'mentee',
    course_hierarchy: ['Module', 'Topic', 'Subtopic'],
    pricing_mode: 'custom',
    custom_categories: ['Engineering', 'Design', 'Business', 'Healthcare', 'Computer Science'],
    max_users: 10000,
    max_courses: 500
  },
  created_at: new Date().toISOString()
};

export const tenantService = {
  /**
   * Fetch tenant by subdomain. Falls back to default tenant if not found.
   */
  async getTenantBySubdomain(subdomain: string): Promise<Tenant> {
    const { data, error } = await nexus.database
      .from('tenants')
      .select('*')
      .eq('subdomain', subdomain.toLowerCase())
      .maybeSingle();

    if (!error && data) {
      return data as Tenant;
    }

    // This one read keeps a fallback on purpose: it runs on every page load via
    // TenantProvider, and an unknown subdomain is a normal condition (the
    // marketing host, a typo). Returning the default tenant keeps the app
    // bootable; it never masks a write.
    if (error) {
      console.warn('[TenantService] Subdomain lookup failed, serving default tenant:', error.message);
    }
    return INITIAL_DEFAULT_TENANT;
  },

  /**
   * Fetch all tenants (Super Admin access)
   */
  async getTenants(): Promise<Tenant[]> {
    // Through a super-admin function, because the table's own read policy
    // exposes active tenants only — so a plain select returned an empty
    // approval queue no matter how many registrations were waiting, and
    // suspended institutions vanished from the console entirely.
    const { data, error } = await nexus.database.rpc('admin_list_tenants', { p_status: null });

    if (error) {
      throw new Error(`Could not load institutions: ${error.message}`);
    }
    return (data || []) as Tenant[];
  },

  /**
   * Counts for one institution, computed in the database.
   */
  async getTenantStats(tenantId: string): Promise<{
    users: number;
    courses: number;
    enrollments: number;
    classes: number;
    active_subscription: string | null;
  }> {
    const { data, error } = await nexus.database.rpc('admin_tenant_stats', { p_tenant_id: tenantId });
    if (error) {
      throw new Error(`Could not load institution statistics: ${error.message}`);
    }
    return {
      users: 0, courses: 0, enrollments: 0, classes: 0, active_subscription: null,
      ...((data as any) || {})
    };
  },

  /**
   * Get single tenant by ID
   */
  async getTenantById(tenantId: string): Promise<Tenant | null> {
    const { data, error } = await nexus.database
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .maybeSingle();

    if (error) {
      throw new Error(`Could not load institution: ${error.message}`);
    }
    return (data as Tenant) || null;
  },

  /**
   * Fetch all active institutions for dropdown selectors & public directory
   */
  async getInstitutions(): Promise<Tenant[]> {
    const { data, error } = await nexus.database
      .from('tenants')
      .select('*')
      .eq('status', 'active');

    if (error) {
      throw new Error(`Could not load institutions: ${error.message}`);
    }
    return (data || []) as Tenant[];
  },

  /**
   * Approve a pending institutional registration (Super Admin)
   */
  async approveTenant(tenantId: string): Promise<Tenant> {
    return this.updateTenant(tenantId, { status: 'active' });
  },

  /**
   * Suspend an active institution (Super Admin)
   */
  async suspendTenant(tenantId: string): Promise<Tenant> {
    return this.updateTenant(tenantId, { status: 'suspended' });
  },

  /**
   * Submit a self-serve institution registration. It is always created
   * 'pending' and goes live only when a super admin approves it.
   *
   * Runs as a database function because the tenants table only accepts writes
   * from super admins, so a direct insert from this page was always refused.
   * Plan limits are set server-side, not taken from the client.
   */
  async registerInstitution(payload: {
    name: string;
    subdomain: string;
    custom_domain?: string;
    email: string;
    plan: 'starter' | 'growth' | 'enterprise';
    primary_color?: string;
  }): Promise<{ id: string; subdomain: string; status: 'pending' }> {
    const { data, error } = await nexus.database.rpc('register_institution', {
      p_name: payload.name,
      p_subdomain: payload.subdomain,
      p_email: payload.email,
      p_plan: payload.plan,
      p_primary_color: payload.primary_color || null,
      p_custom_domain: payload.custom_domain || null
    });

    // No catch-and-continue here. A tenant that failed to persist must not be
    // reported as created — the caller has to be able to show a real error.
    if (error) {
      throw new Error(`Could not submit institution: ${error.message}`);
    }
    return data as { id: string; subdomain: string; status: 'pending' };
  },

  /**
   * Update tenant settings or domain details
   */
  async updateTenant(tenantId: string, updates: Partial<Tenant>): Promise<Tenant> {
    const { data, error } = await nexus.database
      .from('tenants')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', tenantId)
      .select()
      .single();

    if (error) {
      throw new Error(`Could not save institution settings: ${error.message}`);
    }
    return data as Tenant;
  },

  /**
   * Delete or suspend tenant
   */
  async deleteTenant(tenantId: string): Promise<boolean> {
    const { error } = await nexus.database
      .from('tenants')
      .delete()
      .eq('id', tenantId);

    if (error) {
      throw new Error(`Could not delete institution: ${error.message}`);
    }
    return true;
  },

  /**
   * Fetch users belonging to a tenant
   */
  async getTenantUsers(tenantId: string, limit = 500): Promise<UserProfile[]> {
    // No mock fallback. This list previously invented four fictional staff
    // members ("Dr. Sarah Vance" and colleagues) whenever the query returned
    // nothing or failed, so an institution admin looking at an empty or broken
    // user list saw four people who do not exist and could not tell the
    // difference. An error here must surface as an error.
    const { data, error } = await nexus.database
      .from('profiles')
      .select('id, email, full_name, role, tenant_id, avatar_url, created_at, last_active_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Could not load institution members: ${error.message}`);
    }
    return (data || []) as UserProfile[];
  },

  /**
   * Bulk import users via parsed CSV records
   */
  async bulkImportTenantUsers(
    tenantId: string,
    rows: Array<{ email: string; full_name: string; role: string }>
  ): Promise<BulkImportResult> {
    const result: BulkImportResult = { imported: 0, failed: 0, errors: [] };
    if (rows.length === 0) return result;

    // Rows are inserted one at a time so a single bad address (duplicate email,
    // malformed row) cannot silently discard the rest of the file — and so the
    // caller gets a per-row reason it can show the person who uploaded it.
    for (const row of rows) {
      const email = (row.email || '').trim().toLowerCase();
      const fullName = (row.full_name || '').trim();

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        result.failed++;
        result.errors.push({ email: row.email || '(blank)', reason: 'Not a valid email address' });
        continue;
      }
      if (!fullName) {
        result.failed++;
        result.errors.push({ email, reason: 'Full name is required' });
        continue;
      }

      const { error } = await nexus.database
        .from('profiles')
        .insert([{
          id: crypto.randomUUID(),
          email,
          full_name: fullName,
          role: (row.role || 'mentee').toLowerCase() as UserProfile['role'],
          tenant_id: tenantId,
          metadata: { invited: true, invited_at: new Date().toISOString() },
          created_at: new Date().toISOString()
        }]);

      if (error) {
        result.failed++;
        result.errors.push({
          email,
          reason: /duplicate|unique/i.test(error.message)
            ? 'Already a member of this institution'
            : error.message
        });
      } else {
        result.imported++;
      }
    }

    return result;
  },

  /**
   * Fetch courses scoped to a tenant
   */
  async getTenantCourses(tenantId: string): Promise<Partial<Course>[]> {
    try {
      const { data, error } = await nexus.database
        .from('courses')
        .select('*')
        .eq('tenant_id', tenantId);

      if (!error && data && data.length > 0) {
        return data as Partial<Course>[];
      }
    } catch (e) {
      console.warn('[TenantService] getTenantCourses DB fallback');
    }

    return [
      {
        id: `c-${tenantId}-101`,
        title: 'Institutional Foundations of Machine Learning',
        description: 'Advanced curriculum tailored for institution accredited degree path.',
        category: 'Computer Science',
        rating: 4.9,
        enrolled_count: 340,
        price_tiers: { standard: 150, elite: 450 },
        tenant_id: tenantId,
        thumbnail_url: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=400'
      },
      {
        id: `c-${tenantId}-102`,
        title: 'Enterprise Cyber Defense & Strategy',
        description: 'Comprehensive security frameworks and threat analysis module.',
        category: 'Cybersecurity',
        rating: 4.8,
        enrolled_count: 180,
        price_tiers: { standard: 200, elite: 500 },
        tenant_id: tenantId,
        thumbnail_url: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&q=80&w=400'
      }
    ];
  },

  /**
   * Generate tenant analytics summary report
   */
  async getTenantAnalytics(tenantId: string): Promise<TenantAnalytics> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [profilesRes, coursesRes, enrollmentsRes, transactionsRes] = await Promise.all([
      nexus.database.from('profiles').select('id, role, last_active_at').eq('tenant_id', tenantId),
      nexus.database.from('courses').select('id').eq('tenant_id', tenantId),
      nexus.database.from('enrollments').select('user_id, progress, last_accessed').eq('tenant_id', tenantId),
      nexus.database.from('transactions').select('amount, type, status').eq('tenant_id', tenantId)
    ]);

    const profiles = (profilesRes.data || []) as any[];
    const courses = (coursesRes.data || []) as any[];
    const enrollments = (enrollmentsRes.data || []) as any[];
    const transactions = (transactionsRes.data || []) as any[];

    const isTutor = (r: string) => r === 'mentor' || r === 'tutor';
    const isStudent = (r: string) => r === 'mentee' || r === 'student';

    // "Completed" means the learner finished the material, so measure it off
    // progress rather than a status column that several flows never set.
    const completed = enrollments.filter(e => Number(e.progress || 0) >= 100).length;
    const completionRate = enrollments.length > 0
      ? Number(((completed / enrollments.length) * 100).toFixed(1))
      : 0;

    // Active = touched a course in the last 30 days. Falls back to the profile's
    // own activity stamp for learners who are enrolled in nothing yet.
    const activeLearners = new Set<string>();
    enrollments.forEach(e => {
      if (e.last_accessed && e.last_accessed >= thirtyDaysAgo) activeLearners.add(e.user_id);
    });
    profiles.forEach(p => {
      if (p.last_active_at && p.last_active_at >= thirtyDaysAgo) activeLearners.add(p.id);
    });

    const revenue = transactions
      .filter(t => t.status === 'completed' && t.type === 'sale')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);

    return {
      tenant_id: tenantId,
      total_users: profiles.length,
      total_students: profiles.filter(p => isStudent(p.role)).length,
      total_tutors: profiles.filter(p => isTutor(p.role)).length,
      total_courses: courses.length,
      total_enrollments: enrollments.length,
      total_revenue: revenue,
      completion_rate: completionRate,
      active_learners_30d: activeLearners.size
    };
  },

  /**
   * Fetch tenant billing and platform usage state
   */
  async getTenantBilling(tenantId: string): Promise<TenantBilling> {
    const tenant = await this.getTenantById(tenantId);
    const plan = tenant?.plan || 'starter';

    const baseRate = plan === 'enterprise' ? 1499 : plan === 'growth' ? 499 : 149;
    const userFee = plan === 'enterprise' ? 2 : plan === 'growth' ? 4 : 6;

    // Billed seats are the tenant's real non-suspended profiles, not a constant.
    const { data: seatRows } = await nexus.database
      .from('profiles')
      .select('id, metadata')
      .eq('tenant_id', tenantId);

    const activeUsers = (seatRows || []).filter(
      (p: any) => p?.metadata?.suspended !== true
    ).length;

    return {
      tenant_id: tenantId,
      plan,
      monthly_subscription_fee: baseRate,
      per_user_fee: userFee,
      total_active_users: activeUsers,
      current_billing_cycle_amount: baseRate + (activeUsers * userFee),
      next_billing_date: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'paid'
    };
  }
};
