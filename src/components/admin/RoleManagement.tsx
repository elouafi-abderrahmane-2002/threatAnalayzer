import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Role, Permission } from '@/hooks/useRBAC';

const AVAILABLE_PERMISSIONS: { value: Permission; label: string; description: string }[] = [
  { value: 'manage_users', label: 'Manage Users', description: 'Create, edit, and delete user accounts' },
  { value: 'manage_roles', label: 'Manage Roles', description: 'Create and modify user roles' },
  { value: 'view_all_clients', label: 'View All Clients', description: 'Access data from all clients' },
  { value: 'manage_clients', label: 'Manage Clients', description: 'Create and modify client accounts' },
  { value: 'view_logs', label: 'View Logs', description: 'Access security logs and events' },
  { value: 'manage_logs', label: 'Manage Logs', description: 'Create, modify, and delete logs' },
  { value: 'view_assets', label: 'View Assets', description: 'View asset information and status' },
  { value: 'manage_assets', label: 'Manage Assets', description: 'Create and modify assets' },
  { value: 'view_reports', label: 'View Reports', description: 'Access security reports' },
  { value: 'manage_reports', label: 'Manage Reports', description: 'Create and modify reports' },
];

export function RoleManagement() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      const { data, error } = await supabase
        .from('roles')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setRoles(data || []);
    } catch (error) {
      console.error('Error fetching roles:', error);
      toast({
        title: "Error",
        description: "Failed to fetch roles",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createRole = async (roleData: Omit<Role, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { error } = await supabase
        .from('roles')
        .insert(roleData);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Role created successfully",
      });
      setIsDialogOpen(false);
      fetchRoles();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create role",
        variant: "destructive",
      });
    }
  };

  const updateRole = async (roleId: string, roleData: Partial<Role>) => {
    try {
      const { error } = await supabase
        .from('roles')
        .update(roleData)
        .eq('id', roleId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Role updated successfully",
      });
      setIsDialogOpen(false);
      setEditingRole(null);
      fetchRoles();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update role",
        variant: "destructive",
      });
    }
  };

  const deleteRole = async (roleId: string, roleName: string) => {
    if (!confirm(`Are you sure you want to delete the role "${roleName}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('roles')
        .delete()
        .eq('id', roleId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Role deleted successfully",
      });
      fetchRoles();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete role",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <div>Loading roles...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Roles</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingRole(null)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Role
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingRole ? 'Edit Role' : 'Create New Role'}
              </DialogTitle>
            </DialogHeader>
            <RoleForm
              role={editingRole}
              onSubmit={editingRole ? updateRole : createRole}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Permissions</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {roles.map((role) => (
            <TableRow key={role.id}>
              <TableCell className="font-medium">{role.name}</TableCell>
              <TableCell>{role.description}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {role.permissions.slice(0, 3).map((permission) => (
                    <Badge key={permission} variant="outline" className="text-xs">
                      {AVAILABLE_PERMISSIONS.find(p => p.value === permission)?.label || permission}
                    </Badge>
                  ))}
                  {role.permissions.length > 3 && (
                    <Badge variant="secondary" className="text-xs">
                      +{role.permissions.length - 3} more
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingRole(role);
                      setIsDialogOpen(true);
                    }}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => deleteRole(role.id, role.name)}
                    disabled={['Super Admin', 'SOC Admin', 'Client User'].includes(role.name)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

interface RoleFormProps {
  role: Role | null;
  onSubmit: ((roleId: string, roleData: any) => Promise<void>) | ((roleData: any) => Promise<void>);
}

function RoleForm({ role, onSubmit }: RoleFormProps) {
  const [name, setName] = useState(role?.name || '');
  const [description, setDescription] = useState(role?.description || '');
  const [selectedPermissions, setSelectedPermissions] = useState<Permission[]>(
    role?.permissions || []
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const roleData = {
      name,
      description,
      permissions: selectedPermissions,
    };

    if (role) {
      (onSubmit as (roleId: string, roleData: any) => Promise<void>)(role.id, roleData);
    } else {
      (onSubmit as (roleData: any) => Promise<void>)(roleData);
    }
  };

  const handlePermissionToggle = (permission: Permission) => {
    setSelectedPermissions(prev =>
      prev.includes(permission)
        ? prev.filter(p => p !== permission)
        : [...prev, permission]
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <Label htmlFor="name">Role Name</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter role name"
          required
        />
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Enter role description"
          rows={3}
        />
      </div>

      <div>
        <Label>Permissions</Label>
        <Card className="mt-2">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {AVAILABLE_PERMISSIONS.map((permission) => (
                <div key={permission.value} className="flex items-start space-x-2">
                  <Checkbox
                    id={permission.value}
                    checked={selectedPermissions.includes(permission.value)}
                    onCheckedChange={() => handlePermissionToggle(permission.value)}
                  />
                  <div className="grid gap-1.5 leading-none">
                    <label
                      htmlFor={permission.value}
                      className="text-sm font-medium cursor-pointer"
                    >
                      {permission.label}
                    </label>
                    <p className="text-xs text-muted-foreground">
                      {permission.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Button type="submit" className="w-full">
        {role ? 'Update Role' : 'Create Role'}
      </Button>
    </form>
  );
}