import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type Permission = 
  | 'manage_users'
  | 'manage_roles' 
  | 'view_all_clients'
  | 'manage_clients'
  | 'view_logs'
  | 'manage_logs'
  | 'view_assets'
  | 'manage_assets'
  | 'view_reports'
  | 'manage_reports';

export interface UserProfile {
  id: string;
  user_id: string;
  display_name: string | null;
  email: string | null;
  client_id: string | null;
  tenant_level: string | null;
  created_at: string;
  updated_at: string;
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  permissions: Permission[];
  created_at: string;
  updated_at: string;
}

export function useRBAC() {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      fetchUserProfileAndPermissions();
    } else {
      setPermissions([]);
      setUserProfile(null);
      setLoading(false);
    }
  }, [user?.id]);

  const fetchUserProfileAndPermissions = async () => {
    if (!user?.id) return;

    try {
      // Fetch user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      setUserProfile(profile);

      // Call the function to get user permissions
      const { data: permissionsData } = await supabase.rpc('get_user_permissions', {
        user_uuid: user.id
      });

      setPermissions(permissionsData || []);
    } catch (error) {
      console.error('Error fetching user permissions:', error);
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  };

  const hasPermission = (permission: Permission): boolean => {
    return permissions.includes(permission);
  };

  const hasAnyPermission = (requiredPermissions: Permission[]): boolean => {
    return requiredPermissions.some(permission => permissions.includes(permission));
  };

  const isSuperAdmin = (): boolean => {
    return hasPermission('manage_users') && hasPermission('manage_roles');
  };

  const isTenantAdmin = (): boolean => {
    return userProfile?.tenant_level === 'tenant_admin' || 
           (hasPermission('manage_users') && userProfile?.client_id && !isSuperAdmin());
  };

  const canAccessClient = (clientId: string): boolean => {
    return isSuperAdmin() || userProfile?.client_id === clientId;
  };

  const getUserClientId = (): string | null => {
    return userProfile?.client_id || null;
  };

  return {
    permissions,
    userProfile,
    loading,
    hasPermission,
    hasAnyPermission,
    isSuperAdmin,
    isTenantAdmin,
    canAccessClient,
    getUserClientId,
    refetch: fetchUserProfileAndPermissions
  };
}