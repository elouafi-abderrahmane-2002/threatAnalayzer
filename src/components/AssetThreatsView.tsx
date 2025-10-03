import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Server, AlertTriangle, Clock, User, Network, FileText, Shield } from 'lucide-react';
import { format } from 'date-fns';

interface AssetThreatsViewProps {
  assetId: string;
  onBack: () => void;
}

export const AssetThreatsView: React.FC<AssetThreatsViewProps> = ({ assetId, onBack }) => {
  // Fetch asset details
  const { data: asset } = useQuery({
    queryKey: ['asset', assetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assets')
        .select('*')
        .eq('id', assetId)
        .single();
      
      if (error) throw error;
      return data;
    }
  });

  // Fetch threats/logs for this asset
  const { data: threats = [] } = useQuery({
    queryKey: ['asset-threats', assetId],
    queryFn: async () => {
      if (!asset) return [];
      
      const { data, error } = await supabase
        .from('logs')
        .select('*')
        .or(`host_ip.eq.${asset.ip_address},host_name.eq.${asset.name}`)
        .order('timestamp', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!asset
  });

  const getSeverityColor = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'critical': return 'bg-red-500 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-black';
      case 'low': return 'bg-blue-500 text-white';
      case 'info': return 'bg-gray-500 text-white';
      default: return 'bg-gray-400 text-white';
    }
  };

  const getLabelColor = (label: string) => {
    switch (label) {
      case 'TP': return 'bg-green-500 text-white';
      case 'TN': return 'bg-green-600 text-white';
      case 'FP': return 'bg-red-500 text-white';
      case 'FN': return 'bg-orange-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getLabelText = (label: string) => {
    switch (label) {
      case 'TP': return 'True Positive';
      case 'TN': return 'True Negative';
      case 'FP': return 'False Positive';
      case 'FN': return 'False Negative';
      default: return 'Unclassified';
    }
  };

  if (!asset) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Server className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Loading asset details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button 
                variant="ghost" 
                onClick={onBack}
                className="text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Assets
              </Button>
              <div className="h-6 w-px bg-border" />
              <div className="flex items-center space-x-3">
                <Server className="h-6 w-6 text-primary" />
                <div>
                  <h1 className="text-xl font-bold">{asset.name}</h1>
                  <p className="text-muted-foreground text-sm">Threat Analysis</p>
                </div>
              </div>
            </div>
            <Badge className={asset.status === 'online' ? 'bg-soc-success' : 'bg-soc-danger'}>
              {asset.status}
            </Badge>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-6 space-y-6">
        {/* Asset Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">IP Address</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-mono">{asset.ip_address}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Total Threats</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-bold text-soc-danger">{threats.length}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Critical Threats</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-bold text-red-500">
                {threats.filter(t => t.severity === 'critical').length}
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Vulnerabilities</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-bold text-orange-500">
                {Array.isArray(asset.vulnerabilities) ? asset.vulnerabilities.length : 0}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Threats Table */}
        <Card className="shadow-elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Threat Events for {asset.name}
            </CardTitle>
            <CardDescription>
              Detailed view of all security events detected on this asset
            </CardDescription>
          </CardHeader>
          <CardContent>
            {threats.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Event Type</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Alert Name</TableHead>
                      <TableHead>Label</TableHead>
                      <TableHead>Process</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Source IP</TableHead>
                      <TableHead>Protocol</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Comments</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {threats.map((threat) => (
                      <TableRow key={threat.event_id}>
                        <TableCell className="font-mono text-xs">
                          {format(new Date(threat.timestamp), 'MMM dd, yyyy HH:mm:ss')}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {threat.event_type || 'Unknown'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={getSeverityColor(threat.severity)}>
                            {threat.severity || 'Unknown'}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {threat.alert_name || 'No alert name'}
                        </TableCell>
                        <TableCell>
                          <Badge className={getLabelColor(threat.label)}>
                            {getLabelText(threat.label)}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {threat.process_name || 'N/A'}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {threat.user_name || 'N/A'}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {threat.source_ip || 'N/A'}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {threat.protocol || 'N/A'}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline"
                            className={
                              threat.status === 'active' ? 'border-soc-danger text-soc-danger' :
                              threat.status === 'resolved' ? 'border-soc-success text-soc-success' :
                              'border-soc-warning text-soc-warning'
                            }
                          >
                            {threat.status || 'Unknown'}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {threat.comments || 'No comments'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12">
                <AlertTriangle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Threats Detected</h3>
                <p className="text-muted-foreground">
                  This asset has no recorded security events or threats.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Vulnerabilities Section */}
        {Array.isArray(asset.vulnerabilities) && asset.vulnerabilities.length > 0 && (
          <Card className="shadow-elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Known Vulnerabilities
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {asset.vulnerabilities.map((vuln: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{vuln.cve || 'Unknown CVE'}</p>
                      <p className="text-sm text-muted-foreground">
                        {vuln.description || 'No description available'}
                      </p>
                    </div>
                    <Badge className={getSeverityColor(vuln.severity)}>
                      {vuln.severity || 'Unknown'}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};