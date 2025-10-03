-- Create app roles enum
CREATE TYPE public.app_role AS ENUM ('super_admin', 'soc_admin', 'client_user');

-- Create app permissions enum
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

-- Create profiles table for additional user information
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  email TEXT,
  client_id UUID REFERENCES public.clients(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create roles table
CREATE TABLE public.roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  permissions public.app_permission[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_roles junction table
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, role_id)
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer functions to avoid RLS recursion
CREATE OR REPLACE FUNCTION public.get_user_permissions(user_uuid UUID)
RETURNS public.app_permission[]
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(DISTINCT perm), '{}')
  FROM public.user_roles ur
  JOIN public.roles r ON ur.role_id = r.id
  CROSS JOIN LATERAL unnest(r.permissions) AS perm
  WHERE ur.user_id = user_uuid;
$$;

CREATE OR REPLACE FUNCTION public.has_permission(user_uuid UUID, permission_name public.app_permission)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT permission_name = ANY(public.get_user_permissions(user_uuid));
$$;

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

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile" 
ON public.profiles FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Super admins can view all profiles"
ON public.profiles FOR SELECT
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can manage all profiles"
ON public.profiles FOR ALL
USING (public.is_super_admin(auth.uid()));

-- RLS Policies for roles
CREATE POLICY "Super admins can manage all roles"
ON public.roles FOR ALL
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Users can view roles for permission checking"
ON public.roles FOR SELECT
USING (true);

-- RLS Policies for user_roles
CREATE POLICY "Super admins can manage all user roles"
ON public.user_roles FOR ALL
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

-- Create function to handle new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, email)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email), 
    NEW.email
  );
  RETURN NEW;
END;
$$;

-- Create trigger for automatic profile creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_roles_updated_at
  BEFORE UPDATE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default roles
INSERT INTO public.roles (name, description, permissions) VALUES 
(
  'Super Admin', 
  'Full system access and administration',
  ARRAY['manage_users', 'manage_roles', 'view_all_clients', 'manage_clients', 'view_logs', 'manage_logs', 'view_assets', 'manage_assets', 'view_reports', 'manage_reports']::public.app_permission[]
),
(
  'SOC Admin', 
  'Security Operations Center administrator',
  ARRAY['view_all_clients', 'manage_clients', 'view_logs', 'manage_logs', 'view_assets', 'manage_assets', 'view_reports', 'manage_reports']::public.app_permission[]
),
(
  'Client User', 
  'Standard client access',
  ARRAY['view_logs', 'view_assets', 'view_reports']::public.app_permission[]
);