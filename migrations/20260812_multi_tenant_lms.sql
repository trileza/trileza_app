-- =============================================================================
-- TRILEZA LMS MULTI-TENANT ARCHITECTURE MIGRATION & SCHEMA
-- =============================================================================

-- 1. Create `tenants` table
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  subdomain TEXT UNIQUE NOT NULL,
  custom_domain TEXT UNIQUE,
  email TEXT NOT NULL,
  status TEXT CHECK (status IN ('active', 'suspended', 'pending')) DEFAULT 'active',
  logo_url TEXT,
  primary_color TEXT DEFAULT '#4f46e5',
  plan TEXT CHECK (plan IN ('starter', 'growth', 'enterprise')) DEFAULT 'starter',
  settings JSONB DEFAULT '{
    "allow_self_registration": true,
    "default_user_role": "learner",
    "course_hierarchy": ["Module", "Topic", "Subtopic"],
    "pricing_mode": "custom"
  }'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Seed Default Tenant ("Trileza Main LMS")
INSERT INTO tenants (id, name, subdomain, custom_domain, email, status, primary_color, plan)
VALUES (
  'default-tenant',
  'Trileza Main LMS',
  'app',
  'trileza.com',
  'admin@trileza.com',
  'active',
  '#4f46e5',
  'enterprise'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  subdomain = EXCLUDED.subdomain;

-- 3. Add `tenant_id` column to all core tables with default pointing to 'default-tenant'

-- Profiles / Users
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default-tenant' REFERENCES tenants(id) ON DELETE CASCADE;
-- Courses
ALTER TABLE courses ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default-tenant' REFERENCES tenants(id) ON DELETE CASCADE;
-- Books. Guarded: this deployment's library runs on `api_books`, and a bare
-- ALTER on a table that is not there aborts the whole migration.
DO $books$
BEGIN
  IF to_regclass('public.books') IS NOT NULL THEN
    ALTER TABLE books ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default-tenant' REFERENCES tenants(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_books_tenant_id ON books(tenant_id);
  END IF;
END
$books$;
-- Enrollments
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default-tenant' REFERENCES tenants(id) ON DELETE CASCADE;
-- Transactions
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default-tenant' REFERENCES tenants(id) ON DELETE CASCADE;
-- Support Tickets
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default-tenant' REFERENCES tenants(id) ON DELETE CASCADE;
-- Flagged Content
ALTER TABLE flagged_content ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default-tenant' REFERENCES tenants(id) ON DELETE CASCADE;
-- Payout Requests
ALTER TABLE payout_requests ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default-tenant' REFERENCES tenants(id) ON DELETE CASCADE;
-- Admin Users
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default-tenant' REFERENCES tenants(id) ON DELETE CASCADE;
-- Admin Audit Logs
ALTER TABLE admin_audit_logs ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default-tenant' REFERENCES tenants(id) ON DELETE CASCADE;

-- 4. Create Indexes on tenant_id for all tables
CREATE INDEX IF NOT EXISTS idx_profiles_tenant_id ON profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_courses_tenant_id ON courses(tenant_id);
-- (idx_books_tenant_id is created in the guarded block above.)
CREATE INDEX IF NOT EXISTS idx_enrollments_tenant_id ON enrollments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_transactions_tenant_id ON transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_tenant_id ON support_tickets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_flagged_content_tenant_id ON flagged_content(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payout_requests_tenant_id ON payout_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_tenant_id ON admin_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_tenant_id ON admin_audit_logs(tenant_id);

-- 5. Helper Function to Get Current Tenant from JWT or Default
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS TEXT AS $$
BEGIN
  RETURN COALESCE(
    current_setting('request.jwt.claims', true)::json->>'tenant_id',
    'default-tenant'
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- 6. Row-Level Security (RLS) Policies
-- Enable RLS on core tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Allow public read access to active tenant info for subdomain lookup
CREATE POLICY tenant_public_read ON tenants FOR SELECT USING (status = 'active');

-- Allow tenant admins / users access within their matching tenant_id
CREATE POLICY profiles_tenant_isolation ON profiles
  FOR ALL USING (tenant_id = current_tenant_id() OR tenant_id IS NULL);

CREATE POLICY courses_tenant_isolation ON courses
  FOR ALL USING (tenant_id = current_tenant_id() OR tenant_id IS NULL);

CREATE POLICY enrollments_tenant_isolation ON enrollments
  FOR ALL USING (tenant_id = current_tenant_id() OR tenant_id IS NULL);

CREATE POLICY transactions_tenant_isolation ON transactions
  FOR ALL USING (tenant_id = current_tenant_id() OR tenant_id IS NULL);
