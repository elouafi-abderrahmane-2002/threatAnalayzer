-- MSP Hierarchy Implementation
-- This migration adds the necessary structure for MSP (Managed Service Provider) functionality

-- Add tenant_type to clients table to distinguish between tenant types
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS tenant_type TEXT DEFAULT 'regular' CHECK (tenant_type IN ('regular', 'msp_tenant'));

-- Add created_by to clients table to track which super admin created the tenant
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- Add admin_user_id to clients table to track the primary admin for each tenant
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS admin_user_id UUID REFERENCES auth.users(id);

-- Add tenant_level to profiles to distinguish user hierarchy levels
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tenant_level TEXT DEFAULT 'user' CHECK (tenant_level IN ('super_admin', 'tenant_admin', 'user'));

-- Update roles to include tenant-specific roles
INSERT INTO public.roles (name, description, permissions) VALUES 
(
  'Tenant Admin', 
  'Administrator for a specific tenant with full access to tenant data and user management',
  ARRAY['manage_users', 'view_logs', 'manage_logs', 'view_assets', 'manage_assets', 'view_reports', 'manage_reports']::public.app_permission[]
),
(
  'SOC Analyst', 
  'Security Operations Center analyst with read/write access to security data',
  ARRAY['view_logs', 'manage_logs', 'view_assets', 'view_reports']::public.app_permission[]
),
(
  'SOC Viewer', 
  'Read-only access to security data for monitoring purposes',
  ARRAY['view_logs', 'view_assets', 'view_reports']::public.app_permission[]
),
(
  'Client User', 
  'Basic client user with limited access to reports and asset information',
  ARRAY['view_assets', 'view_reports']::public.app_permission[]
)
ON CONFLICT (name) DO NOTHING;

-- Create function to check if user is tenant admin for a specific client
CREATE OR REPLACE FUNCTION public.is_tenant_admin(user_uuid UUID, client_uuid UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.user_id
    JOIN public.roles r ON ur.role_id = r.id
    WHERE p.user_id = user_uuid 
    AND p.client_id = client_uuid
    AND r.name = 'Tenant Admin'
  );
$$;

-- Create function to check if user can access client data
CREATE OR REPLACE FUNCTION public.can_access_client(user_uuid UUID, client_uuid UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    -- Super admin can access all clients
    SELECT 1 FROM public.is_super_admin(user_uuid) WHERE public.is_super_admin(user_uuid) = true
    UNION
    -- User can access their own client
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = user_uuid AND p.client_id = client_uuid
  );
$$;

-- Create function to get user's client ID
CREATE OR REPLACE FUNCTION public.get_user_client_id(user_uuid UUID)
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT client_id FROM public.profiles WHERE user_id = user_uuid;
$$;

-- Update RLS policies for better tenant isolation

-- Drop existing policies that might conflict
DROP POLICY IF EXISTS "Allow all operations on clients" ON public.clients;
DROP POLICY IF EXISTS "Allow all operations on assets" ON public.assets;
DROP POLICY IF EXISTS "Allow all operations on logs" ON public.logs;

-- New RLS policies for clients table

-- SELECT: Super admins can view all, tenant admins can view their own
CREATE POLICY "Super admins can view all clients"
ON public.clients FOR SELECT
TO authenticated
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Tenant admins can view their client"
ON public.clients FOR SELECT
TO authenticated
USING (public.can_access_client(auth.uid(), id));

-- INSERT: Only super admins can create new clients
CREATE POLICY "Super admins can create clients"
ON public.clients FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin(auth.uid()));

-- UPDATE: Only super admins can update clients
CREATE POLICY "Super admins can update clients"
ON public.clients FOR UPDATE
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

-- DELETE: Only super admins can delete clients
CREATE POLICY "Super admins can delete clients"
ON public.clients FOR DELETE
TO authenticated
USING (public.is_super_admin(auth.uid()));

-- New RLS policies for assets table
CREATE POLICY "Super admins can manage all assets"
ON public.assets FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Users can manage assets for their client"
ON public.assets FOR ALL
TO authenticated
USING (public.can_access_client(auth.uid(), client_id))
WITH CHECK (public.can_access_client(auth.uid(), client_id));

-- New RLS policies for logs table
CREATE POLICY "Super admins can manage all logs"
ON public.logs FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Users can manage logs for their client"
ON public.logs FOR ALL
TO authenticated
USING (public.can_access_client(auth.uid(), client_id))
WITH CHECK (public.can_access_client(auth.uid(), client_id));

-- New RLS policies for knowledge_base table
CREATE POLICY "Super admins can manage all knowledge_base"
ON public.knowledge_base FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Users can manage knowledge_base for their client"
ON public.knowledge_base FOR ALL
TO authenticated
USING (public.can_access_client(auth.uid(), client_id))
WITH CHECK (public.can_access_client(auth.uid(), client_id));

-- Update existing profiles policies to support tenant hierarchy
DROP POLICY IF EXISTS "Super admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Super admins can manage all profiles" ON public.profiles;

CREATE POLICY "Super admins can manage all profiles"
ON public.profiles FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage profiles in their client"
ON public.profiles FOR ALL
TO authenticated
USING (
  public.is_tenant_admin(auth.uid(), client_id) AND
  client_id = public.get_user_client_id(auth.uid())
)
WITH CHECK (
  public.is_tenant_admin(auth.uid(), client_id) AND
  client_id = public.get_user_client_id(auth.uid())
);

CREATE POLICY "Users can view profiles in their client"
ON public.profiles FOR SELECT
TO authenticated
USING (client_id = public.get_user_client_id(auth.uid()));

-- Create function to generate secure credentials for new tenant admin
CREATE OR REPLACE FUNCTION public.create_tenant_admin_credentials(
  tenant_id UUID,
  admin_email TEXT,
  admin_name TEXT,
  temp_password TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_user_id UUID;
  generated_password TEXT;
  result JSON;
BEGIN
  -- Generate secure password if not provided
  IF temp_password IS NULL THEN
    generated_password := 'TenantAdmin' || floor(random() * 10000)::text || '!';
  ELSE
    generated_password := temp_password;
  END IF;

  -- This function would need to be called from the application layer
  -- since Supabase auth cannot be directly manipulated from SQL
  -- Return the credentials that need to be created
  result := json_build_object(
    'email', admin_email,
    'password', generated_password,
    'display_name', admin_name,
    'client_id', tenant_id,
    'tenant_level', 'tenant_admin'
  );

  RETURN result;
END;
$$;

-- Create audit log table for tracking tenant operations
CREATE TABLE IF NOT EXISTS public.tenant_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  performed_by UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.tenant_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view all audit logs"
ON public.tenant_audit_log FOR SELECT
TO authenticated
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Tenant admins can view their tenant audit logs"
ON public.tenant_audit_log FOR SELECT
TO authenticated
USING (public.can_access_client(auth.uid(), tenant_id));

CREATE POLICY "Super admins can insert audit logs"
ON public.tenant_audit_log FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin(auth.uid()));

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_client_id ON public.profiles(client_id);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_tenant_level ON public.profiles(tenant_level);
CREATE INDEX IF NOT EXISTS idx_clients_tenant_type ON public.clients(tenant_type);
CREATE INDEX IF NOT EXISTS idx_tenant_audit_log_tenant_id ON public.tenant_audit_log(tenant_id);

-- Update the handle_new_user function to support tenant levels
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, email, tenant_level)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email), 
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'tenant_level', 'user')
  );
  RETURN NEW;
END;
$$;
