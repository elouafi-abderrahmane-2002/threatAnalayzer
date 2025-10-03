/*
  # Fix RLS Policies for Clients Table

  Run this migration to fix the "new row violates row-level security policy" error
  when creating tenant clients.

  ## How to Apply
  1. Go to your Supabase Dashboard → SQL Editor
  2. Copy and paste this entire script
  3. Click "Run" to apply the fixes
*/

-- Drop all existing policies on clients table
DROP POLICY IF EXISTS "Allow all operations on clients" ON public.clients;
DROP POLICY IF EXISTS "Super admins can manage all clients" ON public.clients;
DROP POLICY IF EXISTS "Super admins can view all clients" ON public.clients;
DROP POLICY IF EXISTS "Tenant admins can view their client" ON public.clients;
DROP POLICY IF EXISTS "Super admins can create clients" ON public.clients;
DROP POLICY IF EXISTS "Super admins can update clients" ON public.clients;
DROP POLICY IF EXISTS "Super admins can delete clients" ON public.clients;

-- CREATE: Super admins can view all clients
CREATE POLICY "Super admins can view all clients"
ON public.clients FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() AND r.name = 'Super Admin'
  )
);

-- CREATE: Tenant admins and users can view their own client
CREATE POLICY "Users can view their client"
ON public.clients FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.client_id = clients.id
  )
);

-- CREATE: Only super admins can insert new clients (THIS IS THE KEY FIX)
CREATE POLICY "Super admins can create clients"
ON public.clients FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() AND r.name = 'Super Admin'
  )
);

-- CREATE: Only super admins can update clients
CREATE POLICY "Super admins can update clients"
ON public.clients FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() AND r.name = 'Super Admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() AND r.name = 'Super Admin'
  )
);

-- CREATE: Only super admins can delete clients
CREATE POLICY "Super admins can delete clients"
ON public.clients FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() AND r.name = 'Super Admin'
  )
);
