/*
  # Complete ThreatRadar Schema with Fixed RLS Policies
*/

-- Create clients table
CREATE TABLE IF NOT EXISTS public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  email text NOT NULL,
  created_at timestamptz DEFAULT now(),
  settings jsonb DEFAULT '{}'::jsonb,
  tenant_type TEXT DEFAULT 'regular' CHECK (tenant_type IN ('regular', 'msp_tenant')),
  created_by UUID REFERENCES auth.users(id),
  admin_user_id UUID REFERENCES auth.users(id)
);

-- Create assets table
CREATE TABLE IF NOT EXISTS public.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  ip_address text NOT NULL,
  status text NOT NULL CHECK (status IN ('online', 'offline', 'maintenance')),
  vulnerabilities jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create logs table
CREATE TABLE IF NOT EXISTS public.logs (
  event_id text PRIMARY KEY,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  timestamp timestamptz NOT NULL DEFAULT now(),
  event_type text,
  severity text,
  alert_name text,
  host_name text,
  host_ip text,
  status text,
  comments text,
  label text CHECK (label IN ('TP', 'TN', 'FP', 'FN'))
);

-- Create enums
DO $$ BEGIN
  CREATE TYPE public.app_permission AS ENUM (
    'manage_users',
    'manage_roles', 
    'view_all_clients',
    'manage_clients',
    'view_logs',
    'manage_logs',
    'view_assets',
    'manage_assets',
    'view_reports',
    'manage_reports'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  email TEXT,
  client_id UUID REFERENCES public.clients(id),
  tenant_level TEXT DEFAULT 'user' CHECK (tenant_level IN ('super_admin', 'tenant_admin', 'user')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create roles table
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  permissions public.app_permission[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, role_id)
);

-- Enable RLS
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Helper function
CREATE OR REPLACE FUNCTION public.is_super_admin(user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = user_uuid AND r.name = 'Super Admin'
  );
$$;

-- CLIENTS TABLE POLICIES WITH PROPER WITH CHECK
CREATE POLICY "clients_select_super_admin"
ON public.clients FOR SELECT
TO authenticated
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "clients_select_own"
ON public.clients FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.client_id = clients.id
  )
);

CREATE POLICY "clients_insert"
ON public.clients FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "clients_update"
ON public.clients FOR UPDATE
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "clients_delete"
ON public.clients FOR DELETE
TO authenticated
USING (public.is_super_admin(auth.uid()));

-- ASSETS POLICIES
CREATE POLICY "assets_all"
ON public.assets FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

-- LOGS POLICIES
CREATE POLICY "logs_all"
ON public.logs FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

-- PROFILES POLICIES
CREATE POLICY "profiles_all_super"
ON public.profiles FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "profiles_select_own"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "profiles_update_own"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "profiles_insert_own"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- ROLES POLICIES
CREATE POLICY "roles_select_all"
ON public.roles FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "roles_all_super"
ON public.roles FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

-- USER_ROLES POLICIES
CREATE POLICY "user_roles_all_super"
ON public.user_roles FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "user_roles_select_own"
ON public.user_roles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Insert default role
INSERT INTO public.roles (name, description, permissions) VALUES 
(
  'Super Admin', 
  'Full system access',
  ARRAY['manage_users', 'manage_roles', 'view_all_clients', 'manage_clients', 'view_logs', 'manage_logs', 'view_assets', 'manage_assets', 'view_reports', 'manage_reports']::public.app_permission[]
)
ON CONFLICT (name) DO NOTHING;

-- Trigger function
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
