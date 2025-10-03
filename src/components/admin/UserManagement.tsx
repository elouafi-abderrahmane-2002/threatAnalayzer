import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { UserProfile, Role } from '@/hooks/useRBAC';
import { useRBAC } from '@/hooks/useRBAC';

interface UserWithRoles extends UserProfile {
  roles: Role[];
  clients: { name: string } | null;
}

export function UserManagement() {
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<UserWithRoles | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { toast } = useToast();
  const { isSuperAdmin, isTenantAdmin, getUserClientId } = useRBAC();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const userClientId = getUserClientId();
      
      // If user is tenant admin, only fetch users from their client
      const usersQuery = supabase
        .from('profiles')
        .select(`
          *,
          clients(name)
        `);
      
      if (isTenantAdmin() && !isSuperAdmin() && userClientId) {
        usersQuery.eq('client_id', userClientId);
      }

      const [usersResponse, rolesResponse, clientsResponse] = await Promise.all([
        usersQuery,
        supabase.from('roles').select('*'),
        isSuperAdmin() 
          ? supabase.from('clients').select('*')
          : supabase.from('clients').select('*').eq('id', userClientId || '')
      ]);

      // Fetch user roles separately
      const { data: userRolesData } = await supabase
        .from('user_roles')
        .select(`
          user_id,
          roles(*)
        `);

      if (usersResponse.data) {
        const usersWithRoles = usersResponse.data.map(user => {
          const userRoles = userRolesData?.filter(ur => ur.user_id === user.user_id) || [];
          return {
            ...user,
            roles: userRoles.map((ur: any) => ur.roles).filter(Boolean)
          };
        });
        setUsers(usersWithRoles);
      }

      setRoles(rolesResponse.data || []);
      setClients(clientsResponse.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to fetch user data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const assignRole = async (userId: string, roleId: string) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role_id: roleId });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Role assigned successfully",
      });
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to assign role",
        variant: "destructive",
      });
    }
  };

  const removeRole = async (userId: string, roleId: string) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .match({ user_id: userId, role_id: roleId });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Role removed successfully",
      });
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to remove role",
        variant: "destructive",
      });
    }
  };

  const updateUserProfile = async (userId: string, updates: Partial<UserProfile>) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "User updated successfully",
      });
      setIsDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update user",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <div>Loading users...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Users</h2>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
            </DialogHeader>
            <UserCreateForm
              roles={roles}
              clients={clients}
              onCreated={() => {
                setIsCreateDialogOpen(false);
                fetchData();
              }}
              isSuperAdmin={isSuperAdmin()}
              userClientId={getUserClientId()}
            />
          </DialogContent>
        </Dialog>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" disabled={!editingUser}>
              Edit Selected User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
            </DialogHeader>
            {editingUser && (
              <UserForm
                user={editingUser}
                roles={roles}
                clients={clients}
                onSubmit={updateUserProfile}
                onAssignRole={assignRole}
                onRemoveRole={removeRole}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Display Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Roles</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell>{user.display_name}</TableCell>
              <TableCell>{user.email}</TableCell>
              <TableCell>{user.clients?.name || 'No Client'}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {user.roles.map((role) => (
                    <Badge key={role.id} variant="secondary">
                      {role.name}
                    </Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingUser(user);
                    setIsDialogOpen(true);
                  }}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

interface UserFormProps {
  user: UserWithRoles | null;
  roles: Role[];
  clients: any[];
  onSubmit: (userId: string, updates: Partial<UserProfile>) => Promise<void>;
  onAssignRole: (userId: string, roleId: string) => Promise<void>;
  onRemoveRole: (userId: string, roleId: string) => Promise<void>;
}

interface UserCreateFormProps {
  roles: Role[];
  clients: any[];
  onCreated: () => void;
  isSuperAdmin: boolean;
  userClientId: string | null;
}

function UserCreateForm({ roles, clients, onCreated, isSuperAdmin, userClientId }: UserCreateFormProps) {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [clientId, setClientId] = useState(userClientId || '');
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [generatePassword, setGeneratePassword] = useState(true);
  const [customPassword, setCustomPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Filter roles based on user permissions
  const availableRoles = roles.filter(role => {
    if (isSuperAdmin) return true;
    // Tenant admins can only assign non-admin roles
    return !['Super Admin', 'Tenant Admin'].includes(role.name);
  });

  const generateSecurePassword = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !displayName) return;

    try {
      setLoading(true);

      const password = generatePassword ? generateSecurePassword() : customPassword;

      // Create user via Edge Function (service role)
      const roleNames = roles
        .filter(r => selectedRoleIds.includes(r.id))
        .map(r => r.name);

      const { data: fnResult, error: fnError } = await supabase.functions.invoke('create-tenant-user', {
        body: {
          email,
          password,
          display_name: displayName,
          client_id: clientId === 'none' ? null : clientId,
          tenant_level: 'user',
          role_names: roleNames
        }
      });

      if (fnError) throw fnError;

      toast({
        title: 'Success',
        description: `User created successfully. Password: ${password}`,
      });

      onCreated();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create user',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="email">Email Address</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter email address"
          required
        />
      </div>

      <div>
        <Label htmlFor="displayName">Display Name</Label>
        <Input
          id="displayName"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Enter display name"
          required
        />
      </div>

      <div>
        <Label htmlFor="client">Client</Label>
        <Select value={clientId} onValueChange={setClientId} disabled={!isSuperAdmin}>
          <SelectTrigger>
            <SelectValue placeholder="Select a client" />
          </SelectTrigger>
          <SelectContent>
            {isSuperAdmin && <SelectItem value="none">No Client</SelectItem>}
            {clients.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Assign Roles</Label>
        <div className="space-y-2">
          {availableRoles.map((role) => (
            <div key={role.id} className="flex items-center space-x-2">
              <input
                type="checkbox"
                id={role.id}
                checked={selectedRoleIds.includes(role.id)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedRoleIds([...selectedRoleIds, role.id]);
                  } else {
                    setSelectedRoleIds(selectedRoleIds.filter(id => id !== role.id));
                  }
                }}
              />
              <Label htmlFor={role.id}>{role.name}</Label>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="generatePassword"
            checked={generatePassword}
            onChange={(e) => setGeneratePassword(e.target.checked)}
          />
          <Label htmlFor="generatePassword">Auto-generate password</Label>
        </div>
        {!generatePassword && (
          <div>
            <Label htmlFor="customPassword">Custom Password</Label>
            <Input
              id="customPassword"
              type="password"
              value={customPassword}
              onChange={(e) => setCustomPassword(e.target.value)}
              placeholder="Enter custom password"
              required={!generatePassword}
            />
          </div>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Creating User...' : 'Create User'}
      </Button>
    </form>
  );
}

function UserForm({ user, roles, clients, onSubmit, onAssignRole, onRemoveRole }: UserFormProps) {
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [clientId, setClientId] = useState(user?.client_id || '');
  const [selectedRoleId, setSelectedRoleId] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (user) {
      onSubmit(user.user_id, {
        display_name: displayName,
        client_id: clientId === 'none' ? null : clientId
      });
    }
  };

  const handleAssignRole = () => {
    if (user && selectedRoleId) {
      onAssignRole(user.user_id, selectedRoleId);
      setSelectedRoleId('');
    }
  };

  const handleRemoveRole = (roleId: string) => {
    if (user) {
      onRemoveRole(user.user_id, roleId);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="displayName">Display Name</Label>
        <Input
          id="displayName"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Enter display name"
        />
      </div>

      <div>
        <Label htmlFor="client">Client</Label>
        <Select value={clientId} onValueChange={setClientId}>
          <SelectTrigger>
            <SelectValue placeholder="Select a client" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No Client</SelectItem>
            {clients.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button type="submit" className="w-full">
        {user ? 'Update User' : 'Create User'}
      </Button>

      {user && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Role Management</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role to assign" />
                </SelectTrigger>
                <SelectContent>
                  {roles
                    .filter(role => !user.roles.some(userRole => userRole.id === role.id))
                    .map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Button onClick={handleAssignRole} disabled={!selectedRoleId}>
                Assign
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Current Roles</Label>
              <div className="flex flex-wrap gap-2">
                {user.roles.map((role) => (
                  <Badge key={role.id} variant="secondary" className="flex items-center gap-1">
                    {role.name}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0"
                      onClick={() => handleRemoveRole(role.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </form>
  );
}