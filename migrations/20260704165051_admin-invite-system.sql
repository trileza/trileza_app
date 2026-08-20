-- Migration: Admin Invite System

-- 1. Create admin_invites table
CREATE TABLE IF NOT EXISTS public.admin_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    roles JSONB NOT NULL DEFAULT '[]'::jsonb,
    invited_by TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
    token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    accepted_at TIMESTAMPTZ
);

-- 2. Alter admin_users table
ALTER TABLE public.admin_users 
ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS roles JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS onboarded BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS suspended BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;

-- Drop the old constraint if it exists so it doesn't break on future inserts missing a role
ALTER TABLE public.admin_users DROP CONSTRAINT IF EXISTS admin_users_role_check;

-- Migrate data
UPDATE public.admin_users
SET 
  roles = jsonb_build_array(role),
  user_id = id
WHERE role IS NOT NULL AND jsonb_array_length(roles) = 0;

-- 3. Create admin_audit_log table (as requested by prompt)
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id TEXT REFERENCES public.admin_users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    ip TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Enable RLS
ALTER TABLE public.admin_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super Admins can manage admin_invites" 
ON public.admin_invites 
FOR ALL 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.admin_users 
        WHERE user_id = auth.uid()::text 
        AND roles ? 'super_admin'
        AND suspended = false
    )
);

-- Allow public to SELECT an invite by token (for the accept page validation)
CREATE POLICY "Public can view valid invites by token"
ON public.admin_invites
FOR SELECT
TO public, anon, authenticated
USING (
    status = 'pending' AND expires_at > now()
);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super Admins can view audit logs" 
ON public.admin_audit_log 
FOR SELECT 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.admin_users 
        WHERE user_id = auth.uid()::text 
        AND roles ? 'super_admin'
        AND suspended = false
    )
);

CREATE POLICY "Admins can insert audit logs" 
ON public.admin_audit_log 
FOR INSERT 
TO authenticated 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.admin_users 
        WHERE user_id = auth.uid()::text 
        AND suspended = false
    )
);
