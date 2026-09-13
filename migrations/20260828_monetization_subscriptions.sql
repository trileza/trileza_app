-- =============================================================================
-- TRILEZA LMS MONETIZATION & THREE-TIER SUBSCRIPTIONS SCHEMA
-- =============================================================================

-- 1. Create `subscriptions` table
CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
  tenant_id TEXT DEFAULT 'default-tenant' REFERENCES tenants(id) ON DELETE CASCADE,
  tier TEXT CHECK (tier IN ('free', 'pro', 'institutional')) NOT NULL DEFAULT 'free',
  interval TEXT CHECK (interval IN ('monthly', 'yearly')) NOT NULL DEFAULT 'monthly',
  status TEXT CHECK (status IN ('active', 'canceled', 'past_due', 'incomplete')) NOT NULL DEFAULT 'active',
  amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'NGN',
  current_period_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  current_period_end TIMESTAMP WITH TIME ZONE,
  paystack_reference TEXT,
  paystack_customer_code TEXT,
  paystack_subscription_code TEXT,
  paystack_plan_code TEXT,
  features JSONB DEFAULT '{
    "max_courses": 1,
    "max_students_per_course": 50,
    "has_advanced_analytics": false,
    "has_certificate_issuance": false,
    "has_multi_instructor": false,
    "has_custom_branding": false,
    "has_custom_subdomain": false,
    "has_bulk_enrollment": false,
    "has_sla_support": false
  }'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create Indexes on subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant_id ON subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tier ON subscriptions(tier);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- 3. Row-Level Security (RLS) Policies on subscriptions
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own subscriptions or tenant admins to view tenant subscriptions
CREATE POLICY subscriptions_read_policy ON subscriptions
  FOR SELECT USING (
    auth.uid()::text = user_id 
    OR tenant_id = current_tenant_id()
    OR auth.role() = 'service_role'
  );

CREATE POLICY subscriptions_insert_policy ON subscriptions
  FOR INSERT WITH CHECK (
    auth.uid()::text = user_id 
    OR tenant_id = current_tenant_id()
    OR auth.role() = 'service_role'
  );

CREATE POLICY subscriptions_update_policy ON subscriptions
  FOR UPDATE USING (
    auth.uid()::text = user_id 
    OR tenant_id = current_tenant_id()
    OR auth.role() = 'service_role'
  );

-- 4. Seed default Free subscription records for existing users if none exist
INSERT INTO subscriptions (id, user_id, tenant_id, tier, interval, status, amount, currency)
SELECT 
  'sub-free-' || p.id,
  p.id,
  COALESCE(p.tenant_id, 'default-tenant'),
  'free',
  'monthly',
  'active',
  0,
  'NGN'
FROM profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM subscriptions s WHERE s.user_id = p.id
)
ON CONFLICT (id) DO NOTHING;
