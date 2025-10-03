import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { 
  Save, 
  X, 
  Shield, 
  Activity, 
  BarChart3, 
  Calendar,
  Server,
  Key
} from 'lucide-react';
import { format } from 'date-fns';
import type { Tenant } from '@/pages/admin/TenantManagement';

const tenantFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  status: z.enum(['active', 'inactive']),
  api_key: z.string().optional(),
  edr_endpoint: z.string().url().optional().or(z.literal('')),
});

type TenantFormData = z.infer<typeof tenantFormSchema>;

interface TenantFormProps {
  tenant: Tenant;
  onSaved: () => void;
  onCancel: () => void;
}

interface TenantStats {
  assets: {
    total: number;
    online: number;
    offline: number;
    vulnerable: number;
  };
  events: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  lastActivity?: string;
}

export function TenantForm({ tenant, onSaved, onCancel }: TenantFormProps) {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<TenantStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const { toast } = useToast();

  const form = useForm<TenantFormData>({
    resolver: zodResolver(tenantFormSchema),
    defaultValues: {
      name: tenant.name,
      email: tenant.email,
      status: (tenant.settings?.status as 'active' | 'inactive') || 'active',
      api_key: tenant.settings?.api_key || '',
      edr_endpoint: tenant.settings?.edr_endpoint || '',
    },
  });

  useEffect(() => {
    fetchTenantStats();
  }, [tenant.id]);

  const fetchTenantStats = async () => {
    try {
      setStatsLoading(true);

      // Fetch assets stats
      const { data: assets, error: assetsError } = await supabase
        .from('assets')
        .select('status, vulnerabilities')
        .eq('client_id', tenant.id);

      if (assetsError) throw assetsError;

      // Fetch events stats (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: events, error: eventsError } = await supabase
        .from('logs')
        .select('severity, timestamp')
        .eq('client_id', tenant.id)
        .gte('timestamp', thirtyDaysAgo.toISOString())
        .order('timestamp', { ascending: false });

      if (eventsError) throw eventsError;

      // Process assets stats
      const assetsStats = {
        total: assets?.length || 0,
        online: assets?.filter(a => a.status === 'online').length || 0,
        offline: assets?.filter(a => a.status === 'offline').length || 0,
        vulnerable: assets?.filter(a => {
          const vulns = Array.isArray(a.vulnerabilities) ? a.vulnerabilities : [];
          return vulns.length > 0;
        }).length || 0,
      };

      // Process events stats
      const eventsStats = {
        total: events?.length || 0,
        critical: events?.filter(e => e.severity === 'critical').length || 0,
        high: events?.filter(e => e.severity === 'high').length || 0,
        medium: events?.filter(e => e.severity === 'medium').length || 0,
        low: events?.filter(e => e.severity === 'low').length || 0,
      };

      const lastActivity = events?.[0]?.timestamp;

      setStats({
        assets: assetsStats,
        events: eventsStats,
        lastActivity,
      });
    } catch (error) {
      console.error('Error fetching tenant stats:', error);
      toast({
        title: 'Warning',
        description: 'Could not load tenant statistics',
        variant: 'destructive',
      });
    } finally {
      setStatsLoading(false);
    }
  };

  const onSubmit = async (data: TenantFormData) => {
    try {
      setLoading(true);

      const updatedSettings = {
        ...tenant.settings,
        status: data.status,
        api_key: data.api_key,
        edr_endpoint: data.edr_endpoint,
      };

      const { error } = await supabase
        .from('clients')
        .update({
          name: data.name,
          email: data.email,
          settings: updatedSettings,
        })
        .eq('id', tenant.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Tenant updated successfully',
      });

      onSaved();
    } catch (error) {
      console.error('Error updating tenant:', error);
      toast({
        title: 'Error',
        description: 'Failed to update tenant',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const generateApiKey = () => {
    const newApiKey = `edr_${Math.random().toString(36).substring(2, 15)}_${Date.now()}`;
    form.setValue('api_key', newApiKey);
  };

  return (
    <div className="space-y-6">
      {/* Tenant Statistics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? '-' : stats?.assets.total || 0}
            </div>
            <div className="flex gap-1 mt-1 text-xs text-muted-foreground">
              {!statsLoading && stats && (
                <>
                  <Badge variant="outline" className="text-xs">
                    {stats.assets.online} online
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {stats.assets.offline} offline
                  </Badge>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vulnerabilities</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? '-' : stats?.assets.vulnerable || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Assets with vulnerabilities
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Events (30d)</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? '-' : stats?.events.total || 0}
            </div>
            <div className="flex gap-1 mt-1 text-xs text-muted-foreground">
              {!statsLoading && stats && (
                <>
                  <span className="text-red-600">{stats.events.critical} critical</span>
                  <span className="text-orange-600">{stats.events.high} high</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Activity</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">
              {statsLoading 
                ? '-' 
                : stats?.lastActivity 
                  ? format(new Date(stats.lastActivity), 'MMM dd, HH:mm')
                  : 'No activity'
              }
            </div>
            <p className="text-xs text-muted-foreground">
              Latest event timestamp
            </p>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Tenant Form */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5" />
                  Basic Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tenant Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* EDR Configuration */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  EDR Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="api_key"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>API Key</FormLabel>
                      <FormControl>
                        <div className="flex gap-2">
                          <Input 
                            type="password" 
                            placeholder="EDR API Key"
                            {...field} 
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={generateApiKey}
                            size="sm"
                          >
                            Generate
                          </Button>
                        </div>
                      </FormControl>
                      <FormDescription>
                        API key for connecting to tenant's EDR system
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="edr_endpoint"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>EDR Endpoint URL</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="https://edr.tenant.com/api"
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription>
                        URL endpoint for tenant's EDR system
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="pt-2">
                  <p className="text-sm text-muted-foreground">
                    Created: {format(new Date(tenant.created_at), 'PPP')}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onCancel}
              disabled={loading}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              <Save className="h-4 w-4 mr-2" />
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}