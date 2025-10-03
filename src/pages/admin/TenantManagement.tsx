import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TenantTable } from '@/components/admin/TenantTable';
import { TenantForm } from '@/components/admin/TenantForm';
import { TenantCreateForm } from '@/components/admin/TenantCreateForm';
import { useRBAC } from '@/hooks/useRBAC';
import { Navigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { Building2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

export interface Tenant {
  id: string;
  name: string;
  email: string;
  created_at: string;
  tenant_type?: string;
  created_by?: string;
  admin_user_id?: string;
  settings: {
    api_key?: string;
    edr_endpoint?: string;
    status?: 'active' | 'inactive';
  };
}

export default function TenantManagement() {
  const { hasPermission, loading } = useRBAC();
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [activeTab, setActiveTab] = useState('list');

  // Check if user is Super Admin
  const canManageTenants = hasPermission('manage_users') && hasPermission('manage_roles');

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6">
          <Skeleton className="h-32" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!canManageTenants) {
    return <Navigate to="/" replace />;
  }

  const handleEditTenant = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setActiveTab('edit');
  };

  const handleBackToList = () => {
    setSelectedTenant(null);
    setActiveTab('list');
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/admin">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Admin
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <Building2 className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold">Tenant Management</h1>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="list">Tenant List</TabsTrigger>
          <TabsTrigger value="create">Create Tenant</TabsTrigger>
          <TabsTrigger value="edit" disabled={!selectedTenant}>
            {selectedTenant ? 'Edit Tenant' : 'Select Tenant to Edit'}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <Card>
            <CardHeader>
              <CardTitle>All Tenants</CardTitle>
            </CardHeader>
            <CardContent>
              <TenantTable onEditTenant={handleEditTenant} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="create">
          <Card>
            <CardHeader>
              <CardTitle>Create New Tenant</CardTitle>
            </CardHeader>
            <CardContent>
              <TenantCreateForm onCreated={() => setActiveTab('list')} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="edit">
          {selectedTenant && (
            <Card>
              <CardHeader>
                <CardTitle>Edit Tenant: {selectedTenant.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <TenantForm 
                  tenant={selectedTenant}
                  onSaved={handleBackToList}
                  onCancel={handleBackToList}
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}