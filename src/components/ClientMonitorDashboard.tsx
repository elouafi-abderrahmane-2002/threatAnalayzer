import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  AlertTriangle, 
  Clock, 
  TrendingUp, 
  Activity, 
  Shield,
  Eye,
  Filter,
  Search
} from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ClientMonitorDashboardProps {
  clientId: string;
  logs: any[];
  assets: any[];
}

export const ClientMonitorDashboard: React.FC<ClientMonitorDashboardProps> = ({ 
  clientId, 
  logs, 
  assets 
}) => {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [severityFilter, setSeverityFilter] = React.useState('all');
  const [statusFilter, setStatusFilter] = React.useState('all');

  // Fetch extended logs data for this client
  const { data: extendedLogs = [] } = useQuery({
    queryKey: ['extended-logs', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('logs')
        .select('*')
        .eq('client_id', clientId)
        .order('timestamp', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data;
    },
    enabled: !!clientId
  });

  // Filter logs based on search and filters
  const filteredLogs = extendedLogs.filter(log => {
    const matchesSearch = !searchTerm || 
      log.alert_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.event_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.host_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.process_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesSeverity = severityFilter === 'all' || log.severity === severityFilter;
    const matchesStatus = statusFilter === 'all' || log.status === statusFilter;
    
    return matchesSearch && matchesSeverity && matchesStatus;
  });

  // Calculate dashboard stats
  const criticalAlerts = extendedLogs.filter(log => log.severity === 'critical').length;
  const highAlerts = extendedLogs.filter(log => log.severity === 'high').length;
  const activeAlerts = extendedLogs.filter(log => log.status === 'active').length;
  const resolvedAlerts = extendedLogs.filter(log => log.status === 'resolved').length;
  const recentAlerts = extendedLogs.filter(log => {
    const logTime = new Date(log.timestamp);
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return logTime > last24Hours;
  }).length;

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

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="border-soc-danger/20 bg-gradient-to-br from-card to-soc-surface">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-soc-danger" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-soc-danger">{criticalAlerts}</div>
            <p className="text-xs text-muted-foreground">Immediate attention required</p>
          </CardContent>
        </Card>

        <Card className="border-orange-500/20 bg-gradient-to-br from-card to-soc-surface">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Priority</CardTitle>
            <TrendingUp className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">{highAlerts}</div>
            <p className="text-xs text-muted-foreground">Review recommended</p>
          </CardContent>
        </Card>

        <Card className="border-soc-warning/20 bg-gradient-to-br from-card to-soc-surface">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <Activity className="h-4 w-4 text-soc-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-soc-warning">{activeAlerts}</div>
            <p className="text-xs text-muted-foreground">Currently investigating</p>
          </CardContent>
        </Card>

        <Card className="border-soc-success/20 bg-gradient-to-br from-card to-soc-surface">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolved</CardTitle>
            <Shield className="h-4 w-4 text-soc-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-soc-success">{resolvedAlerts}</div>
            <p className="text-xs text-muted-foreground">Issues closed</p>
          </CardContent>
        </Card>

        <Card className="border-soc-accent/20 bg-gradient-to-br from-card to-soc-surface">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last 24h</CardTitle>
            <Clock className="h-4 w-4 text-soc-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-soc-accent">{recentAlerts}</div>
            <p className="text-xs text-muted-foreground">Recent events</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Event Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center space-x-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search events, hosts, processes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64"
              />
            </div>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="info">Info</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="investigating">Investigating</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Security Events Table */}
      <Card className="shadow-elevated">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Security Events ({filteredLogs.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredLogs.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Event Type</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Alert Name</TableHead>
                    <TableHead>Classification</TableHead>
                    <TableHead>Host</TableHead>
                    <TableHead>Process</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Comments</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <TableRow key={log.event_id} className="hover:bg-muted/50">
                      <TableCell className="font-mono text-xs">
                        {format(new Date(log.timestamp), 'MMM dd, yyyy HH:mm:ss')}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {log.event_type || 'Unknown'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getSeverityColor(log.severity)}>
                          {log.severity || 'Unknown'}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {log.alert_name || 'No alert name'}
                      </TableCell>
                      <TableCell>
                        <Badge className={getLabelColor(log.label)}>
                          {getLabelText(log.label)}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {log.host_name || 'N/A'}
                        {log.host_ip && <div className="text-muted-foreground">({log.host_ip})</div>}
                      </TableCell>
                      <TableCell className="font-mono text-xs max-w-[150px] truncate">
                        {log.process_name || 'N/A'}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {log.user_name || 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline"
                          className={
                            log.status === 'active' ? 'border-soc-danger text-soc-danger' :
                            log.status === 'resolved' ? 'border-soc-success text-soc-success' :
                            'border-soc-warning text-soc-warning'
                          }
                        >
                          {log.status || 'Unknown'}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {log.comments || 'No comments'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12">
              <Eye className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Events Found</h3>
              <p className="text-muted-foreground">
                {searchTerm || severityFilter !== 'all' || statusFilter !== 'all'
                  ? 'Try adjusting your filters to see more events.'
                  : 'No security events have been detected for this client yet.'
                }
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};