import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
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
import { useAuth } from '@/hooks/useAuth';
import { 
  Save, 
  X, 
  Building2, 
  User, 
  Key,
  CheckCircle,
  Copy
} from 'lucide-react';

const tenantCreateSchema = z.object({
  tenantName: z.string().min(1, 'Tenant name is required'),
  tenantEmail: z.string().email('Invalid email address'),
  adminName: z.string().min(1, 'Admin name is required'),
  adminEmail: z.string().email('Invalid admin email address'),
  generatePassword: z.boolean().default(true),
  customPassword: z.string().optional(),
  tenantType: z.enum(['regular', 'msp_tenant']).default('regular'),
});

type TenantCreateData = z.infer<typeof tenantCreateSchema>;

interface TenantCreateFormProps {
  onCreated: () => void;
}

interface CreatedCredentials {
  tenantId: string;
  tenantName: string;
  adminEmail: string;
  adminPassword: string;
  adminUserId?: string;
}

export function TenantCreateForm({ onCreated }: TenantCreateFormProps) {
  const [loading, setLoading] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<CreatedCredentials | null>(null);
  const [step, setStep] = useState<'form' | 'credentials'>('form');
  const { toast } = useToast();
  const { user } = useAuth();

  const form = useForm<TenantCreateData>({
    resolver: zodResolver(tenantCreateSchema),
    defaultValues: {
      tenantName: '',
      tenantEmail: '',
      adminName: '',
      adminEmail: '',
      generatePassword: true,
      customPassword: '',
      tenantType: 'regular',
    },
  });

  const generateSecurePassword = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied',
      description: 'Copied to clipboard',
    });
  };

  const onSubmit = async (data: TenantCreateData) => {
    if (!user?.id) {
      toast({
        title: 'Error',
        description: 'You must be logged in to create tenants',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);

      // Step 1: Create the tenant client
      const { data: tenantData, error: tenantError } = await supabase
        .from('clients')
        .insert({
          name: data.tenantName,
          email: data.tenantEmail,
          tenant_type: data.tenantType,
          created_by: user.id,
          settings: {
            status: 'active',
            created_via: 'msp_admin_panel'
          }
        })
        .select()
        .single();

      if (tenantError) throw tenantError;

      // Step 2: Generate admin password
      const adminPassword = data.generatePassword 
        ? generateSecurePassword() 
        : data.customPassword || generateSecurePassword();

      // Step 3: Create admin user via Edge Function (service role)
      const { data: fnResult, error: fnError } = await supabase.functions.invoke('create-tenant-user', {
        body: {
          email: data.adminEmail,
          password: adminPassword,
          display_name: data.adminName,
          client_id: tenantData.id,
          tenant_level: 'tenant_admin',
          role_names: ['Tenant Admin']
        }
      });

      if (fnError) throw fnError;

      // Step 4: Update tenant with admin user ID
      const { error: updateError } = await supabase
        .from('clients')
        .update({
          admin_user_id: fnResult?.user_id
        })
        .eq('id', tenantData.id);

      if (updateError) throw updateError;

      // Profile update and role assignment are handled inside the Edge Function

      // Step 7: Log the action
      await supabase
        .from('tenant_audit_log')
        .insert({
          tenant_id: tenantData.id,
          performed_by: user.id,
          action: 'tenant_created',
          details: {
            tenant_name: data.tenantName,
            admin_email: data.adminEmail,
            admin_name: data.adminName
          }
        });

      // Show credentials
      setCreatedCredentials({
        tenantId: tenantData.id,
        tenantName: data.tenantName,
        adminEmail: data.adminEmail,
        adminPassword: adminPassword,
        adminUserId: fnResult?.user_id
      });

      setStep('credentials');

      toast({
        title: 'Success',
        description: 'Tenant and admin account created successfully',
      });

    } catch (error: any) {
      console.error('Error creating tenant:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create tenant',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = () => {
    setCreatedCredentials(null);
    setStep('form');
    form.reset();
    onCreated();
  };

  if (step === 'credentials' && createdCredentials) {
    return (
      <div className="space-y-6">
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            Tenant and admin account created successfully! Please save these credentials securely.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Admin Login Credentials
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              <div>
                <label className="text-sm font-medium">Tenant Name</label>
                <div className="flex items-center gap-2">
                  <Input value={createdCredentials.tenantName} readOnly />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(createdCredentials.tenantName)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Admin Email</label>
                <div className="flex items-center gap-2">
                  <Input value={createdCredentials.adminEmail} readOnly />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(createdCredentials.adminEmail)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Admin Password</label>
                <div className="flex items-center gap-2">
                  <Input type="password" value={createdCredentials.adminPassword} readOnly />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(createdCredentials.adminPassword)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Tenant ID</label>
                <div className="flex items-center gap-2">
                  <Input value={createdCredentials.tenantId} readOnly className="font-mono text-xs" />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(createdCredentials.tenantId)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <Alert>
              <AlertDescription>
                <strong>Important:</strong> These credentials will not be shown again. Please save them securely 
                and share them with the tenant administrator through a secure channel.
              </AlertDescription>
            </Alert>

            <Button onClick={handleFinish} className="w-full">
              Continue
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Tenant Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Tenant Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="tenantName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tenant Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Acme Corporation" {...field} />
                    </FormControl>
                    <FormDescription>
                      The name of the client organization
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tenantEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tenant Contact Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="contact@acme.com" {...field} />
                    </FormControl>
                    <FormDescription>
                      Primary contact email for the tenant
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tenantType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tenant Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select tenant type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="regular">Regular Client</SelectItem>
                        <SelectItem value="msp_tenant">MSP Tenant</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Type of tenant organization
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Admin User Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Admin User Setup
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="adminName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Admin Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" {...field} />
                    </FormControl>
                    <FormDescription>
                      Display name for the tenant administrator
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="adminEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Admin Email Address</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="admin@acme.com" {...field} />
                    </FormControl>
                    <FormDescription>
                      Login email for the tenant administrator
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Separator />

              <FormField
                control={form.control}
                name="generatePassword"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Auto-generate Password</FormLabel>
                      <FormDescription>
                        Generate a secure password automatically
                      </FormDescription>
                    </div>
                    <FormControl>
                      <input
                        type="checkbox"
                        checked={field.value}
                        onChange={field.onChange}
                        className="data-[state=checked]:bg-primary"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {!form.watch('generatePassword') && (
                <FormField
                  control={form.control}
                  name="customPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Custom Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Enter custom password" {...field} />
                      </FormControl>
                      <FormDescription>
                        Minimum 8 characters, include numbers and symbols
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => form.reset()}
            disabled={loading}
          >
            <X className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Button type="submit" disabled={loading}>
            <Save className="h-4 w-4 mr-2" />
            {loading ? 'Creating Tenant...' : 'Create Tenant & Admin'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
