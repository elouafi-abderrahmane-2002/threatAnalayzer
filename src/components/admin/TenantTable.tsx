import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Search, Eye, Edit2, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import type { Tenant } from '@/pages/admin/TenantManagement';

interface TenantTableProps {
  onEditTenant: (tenant: Tenant) => void;
}

export function TenantTable({ onEditTenant }: TenantTableProps) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [filteredTenants, setFilteredTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [tenantStats, setTenantStats] = useState<Record<string, { assets: number; events: number }>>({});
  const { toast } = useToast();

  const itemsPerPage = 10;

  useEffect(() => {
    fetchTenants();
  }, []);

  useEffect(() => {
    filterTenants();
  }, [tenants, searchTerm, statusFilter]);

  const fetchTenants = async () => {
    try {
      setLoading(true);
      
      // Fetch clients
      const { data: clients, error } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const tenantsData: Tenant[] = clients?.map(client => {
        // Safely parse settings from Json type
        let settings: { api_key?: string; edr_endpoint?: string; status?: 'active' | 'inactive' } = { status: 'active' };
        if (client.settings && typeof client.settings === 'object' && !Array.isArray(client.settings)) {
          settings = { status: 'active', ...client.settings as any };
        }
        
        return {
          id: client.id,
          name: client.name,
          email: client.email,
          created_at: client.created_at,
          settings
        };
      }) || [];

      setTenants(tenantsData);
      
      // Fetch stats for each tenant
      await fetchTenantStats(tenantsData);
    } catch (error) {
      console.error('Error fetching tenants:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch tenants',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchTenantStats = async (tenantsList: Tenant[]) => {
    const stats: Record<string, { assets: number; events: number }> = {};
    
    for (const tenant of tenantsList) {
      try {
        // Fetch assets count
        const { count: assetsCount } = await supabase
          .from('assets')
          .select('*', { count: 'exact', head: true })
          .eq('client_id', tenant.id);

        // Fetch events count (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const { count: eventsCount } = await supabase
          .from('logs')
          .select('*', { count: 'exact', head: true })
          .eq('client_id', tenant.id)
          .gte('timestamp', thirtyDaysAgo.toISOString());

        stats[tenant.id] = {
          assets: assetsCount || 0,
          events: eventsCount || 0
        };
      } catch (error) {
        console.error(`Error fetching stats for tenant ${tenant.id}:`, error);
        stats[tenant.id] = { assets: 0, events: 0 };
      }
    }
    
    setTenantStats(stats);
  };

  const filterTenants = () => {
    let filtered = tenants;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(tenant =>
        tenant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tenant.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(tenant => {
        const status = tenant.settings?.status || 'active';
        return status === statusFilter;
      });
    }

    setFilteredTenants(filtered);
    setCurrentPage(1); // Reset to first page when filtering
  };

  const deleteTenant = async (tenantId: string) => {
    try {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', tenantId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Tenant deleted successfully',
      });

      fetchTenants();
    } catch (error) {
      console.error('Error deleting tenant:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete tenant',
        variant: 'destructive',
      });
    }
  };

  // Pagination calculations
  const totalPages = Math.ceil(filteredTenants.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentTenants = filteredTenants.slice(startIndex, endIndex);

  const getStatusBadge = (status: string | undefined) => {
    const actualStatus = status || 'active';
    return (
      <Badge variant={actualStatus === 'active' ? 'default' : 'secondary'}>
        {actualStatus}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="h-10 w-64 bg-muted animate-pulse rounded"></div>
          <div className="h-10 w-32 bg-muted animate-pulse rounded"></div>
        </div>
        <div className="h-64 bg-muted animate-pulse rounded"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Results summary */}
      <div className="text-sm text-muted-foreground">
        Showing {currentTenants.length} of {filteredTenants.length} tenants
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assets</TableHead>
                <TableHead>Events (30d)</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentTenants.map((tenant) => (
                <TableRow key={tenant.id}>
                  <TableCell className="font-medium">{tenant.name}</TableCell>
                  <TableCell>{tenant.email}</TableCell>
                  <TableCell>{getStatusBadge(tenant.settings?.status)}</TableCell>
                  <TableCell>{tenantStats[tenant.id]?.assets || 0}</TableCell>
                  <TableCell>{tenantStats[tenant.id]?.events || 0}</TableCell>
                  <TableCell>
                    {format(new Date(tenant.created_at), 'MMM dd, yyyy')}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => onEditTenant(tenant)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Tenant</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{tenant.name}"? This action cannot be undone and will remove all associated data.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteTenant(tenant.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}