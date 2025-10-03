import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  Settings, 
  Key, 
  Database, 
  Shield, 
  CheckCircle, 
  AlertCircle,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';

interface SettingsTabProps {
  apiKeyConfigured: boolean;
  onApiKeyConfigured: (configured: boolean) => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({ 
  apiKeyConfigured, 
  onApiKeyConfigured 
}) => {
  const [apiKey, setApiKey] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleApiKeySubmit = async () => {
    if (!apiKey.trim()) {
      setValidationError('Please enter an API key');
      return;
    }

    setIsValidating(true);
    setValidationError(null);

    // Simulate API validation
    await new Promise(resolve => setTimeout(resolve, 1500));

    const correctKey = 'sb_publishable__8DM0jjNknjvwE7yz0usSA_VDO5RgMP';
    
    if (apiKey === correctKey) {
      localStorage.setItem('threatradar_api_key', apiKey);
      onApiKeyConfigured(true);
      toast.success('API key configured successfully!');
      setApiKey('');
    } else {
      setValidationError('Invalid API key. Please check your credentials and try again.');
    }

    setIsValidating(false);
  };

  const handleDisconnect = () => {
    localStorage.removeItem('threatradar_api_key');
    onApiKeyConfigured(false);
    toast.success('API connection disconnected');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Settings</h2>
        <p className="text-muted-foreground">
          Configure your ThreatRadar platform settings
        </p>
      </div>

      <Tabs defaultValue="connection" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="connection">Connection</TabsTrigger>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="connection" className="space-y-6">
          <Card className="shadow-elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                API Connection
              </CardTitle>
              <CardDescription>
                Configure your ThreatRadar API connection to access tenant client data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Connection Status */}
              <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
                <div className="flex items-center gap-3">
                  {apiKeyConfigured ? (
                    <CheckCircle className="h-5 w-5 text-soc-success" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-soc-warning" />
                  )}
                  <div>
                    <p className="font-medium">
                      {apiKeyConfigured ? 'Connected' : 'Not Connected'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {apiKeyConfigured 
                        ? 'Your API connection is active and working' 
                        : 'API key required to access tenant client data'
                      }
                    </p>
                  </div>
                </div>
                <Badge 
                  className={apiKeyConfigured ? 'bg-soc-success' : 'bg-soc-warning'}
                >
                  {apiKeyConfigured ? 'Active' : 'Inactive'}
                </Badge>
              </div>

              {/* API Key Configuration */}
              {!apiKeyConfigured ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="apiKey">ThreatRadar API Key</Label>
                    <div className="relative">
                      <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="apiKey"
                        type="password"
                        placeholder="Enter your API key"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        className="pl-10"
                        disabled={isValidating}
                      />
                    </div>
                    {validationError && (
                      <Alert variant="destructive">
                        <AlertDescription>{validationError}</AlertDescription>
                      </Alert>
                    )}
                  </div>

                  <Button 
                    onClick={handleApiKeySubmit}
                    disabled={isValidating || !apiKey.trim()}
                    className="w-full bg-gradient-primary hover:opacity-90"
                  >
                    {isValidating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Validating...
                      </>
                    ) : (
                      <>
                        <Shield className="mr-2 h-4 w-4" />
                        Connect API
                      </>
                    )}
                  </Button>

                  <div className="p-4 rounded-lg bg-muted/50 border">
                    <h4 className="font-medium mb-2">How to get your API key:</h4>
                    <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                      <li>Contact your NextDefense administrator</li>
                      <li>Request access to the ThreatRadar platform</li>
                      <li>Copy the provided API key</li>
                      <li>Paste it in the field above</li>
                    </ol>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-soc-success/10 border border-soc-success/20">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="h-4 w-4 text-soc-success" />
                      <span className="font-medium text-soc-success">API Connected</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Your ThreatRadar API is connected and actively monitoring tenant clients.
                    </p>
                  </div>

                  <Button 
                    variant="destructive"
                    onClick={handleDisconnect}
                    className="w-full"
                  >
                    Disconnect API
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="general" className="space-y-6">
          <Card className="shadow-elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                General Settings
              </CardTitle>
              <CardDescription>
                Configure general platform preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Settings className="h-12 w-12 mx-auto mb-4" />
                <p>General settings configuration coming soon</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <Card className="shadow-elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security Settings
              </CardTitle>
              <CardDescription>
                Manage security and access control settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Shield className="h-12 w-12 mx-auto mb-4" />
                <p>Security settings configuration coming soon</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};