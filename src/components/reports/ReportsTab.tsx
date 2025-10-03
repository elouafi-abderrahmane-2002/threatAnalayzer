import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Download, TrendingUp, AlertTriangle, Shield, Server } from 'lucide-react';
import { format } from 'date-fns';
import { generatePDFReport } from '@/utils/pdfGenerator';
import { DateRange, ReportData } from '@/types/common';
import { cn } from '@/lib/utils';

interface ReportsTabProps {
  clientName: string;
  logs: any[];
  assets: any[];
}

export const ReportsTab: React.FC<ReportsTabProps> = ({ clientName, logs, assets }) => {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    to: new Date(),
  });
  const [reportType, setReportType] = useState('comprehensive');
  const [isGenerating, setIsGenerating] = useState(false);

  const reportData = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return null;

    const filteredEvents = logs.filter(event => {
      const eventDate = new Date(event.timestamp);
      return eventDate >= dateRange.from! && eventDate <= dateRange.to!;
    });

    const threatOverview = {
      critical: filteredEvents.filter(e => e.severity === 'critical').length,
      high: filteredEvents.filter(e => e.severity === 'high').length,
      medium: filteredEvents.filter(e => e.severity === 'medium').length,
      low: filteredEvents.filter(e => e.severity === 'low').length,
      info: filteredEvents.filter(e => e.severity === 'info').length,
    };

    const totalAlerts = Object.values(threatOverview).reduce((sum, count) => sum + count, 0);
    const riskScore = Math.min(100, Math.round((threatOverview.critical * 10 + threatOverview.high * 5 + threatOverview.medium * 2) / Math.max(1, totalAlerts) * 100));

    const vulnerableAssets = assets.filter(asset => 
      Array.isArray(asset.vulnerabilities) && asset.vulnerabilities.length > 0
    );

    const topEvents = filteredEvents
      .filter(e => e.severity === 'critical' || e.severity === 'high')
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10)
      .map(event => ({
        id: event.event_id,
        eventType: event.event_type || 'Unknown',
        severity: event.severity || 'unknown',
        timestamp: event.timestamp,
        hostName: event.host_name || 'Unknown',
        alertName: event.alert_name || event.event_type || 'Unknown Alert',
      }));

    const vulnerabilitySummary = vulnerableAssets
      .map(asset => ({
        assetName: asset.name,
        vulnerabilityCount: Array.isArray(asset.vulnerabilities) ? asset.vulnerabilities.length : 0,
        criticalVulns: Array.isArray(asset.vulnerabilities) ? 
          asset.vulnerabilities.filter((v: any) => v.severity === 'critical').length : 0,
      }))
      .sort((a, b) => b.criticalVulns - a.criticalVulns)
      .slice(0, 10);

    const recommendations = [
      ...(threatOverview.critical > 0 ? ['Immediate attention required for critical security alerts'] : []),
      ...(vulnerableAssets.length > 0 ? ['Schedule vulnerability patching for affected assets'] : []),
      ...(assets.filter(a => a.status === 'offline').length > 0 ? ['Investigate and restore offline assets'] : []),
      ...(threatOverview.high > 5 ? ['Review and enhance security monitoring rules'] : []),
      'Regular security awareness training for all users',
      'Implement multi-factor authentication across all systems',
      'Conduct regular penetration testing',
      'Update incident response procedures',
    ];

    return {
      executiveSummary: {
        totalEvents: totalAlerts,
        criticalAlerts: threatOverview.critical,
        highAlerts: threatOverview.high,
        assetsMonitored: assets.length,
        riskScore,
      },
      threatOverview,
      assetStatus: {
        total: assets.length,
        online: assets.filter(a => a.status === 'online').length,
        offline: assets.filter(a => a.status === 'offline').length,
        vulnerable: vulnerableAssets.length,
      },
      topEvents,
      vulnerabilitySummary,
      recommendations,
      complianceMetrics: {
        eventsProcessed: filteredEvents.length,
        avgResponseTime: Math.round(Math.random() * 300 + 60), // Mock data
        systemUptime: 99.8, // Mock data
      },
    } as ReportData;
  }, [logs, assets, dateRange]);

  const handleGeneratePDF = async () => {
    if (!reportData) return;
    
    setIsGenerating(true);
    try {
      await generatePDFReport(reportData, clientName, dateRange);
    } catch (error) {
      console.error('Failed to generate PDF:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-soc-danger text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-soc-warning text-black';
      case 'low': return 'bg-blue-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getRiskScoreColor = (score: number) => {
    if (score >= 70) return 'text-soc-danger';
    if (score >= 40) return 'text-soc-warning';
    return 'text-soc-success';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Security Reports</h2>
          <p className="text-muted-foreground">
            Generate comprehensive security reports for {clientName}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={reportType} onValueChange={setReportType}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Report type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="comprehensive">Comprehensive</SelectItem>
              <SelectItem value="executive">Executive Summary</SelectItem>
              <SelectItem value="technical">Technical Details</SelectItem>
              <SelectItem value="compliance">Compliance</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            onClick={handleGeneratePDF} 
            disabled={!reportData || isGenerating}
            className="bg-gradient-primary hover:opacity-90"
          >
            <Download className="w-4 h-4 mr-2" />
            {isGenerating ? 'Generating...' : 'Export PDF'}
          </Button>
        </div>
      </div>

      {/* Date Range Selector */}
      <Card className="shadow-elevated">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5" />
            Report Period
          </CardTitle>
          <CardDescription>
            Select the date range for your security report
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[300px] justify-start text-left font-normal",
                    !dateRange && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "LLL dd, y")} -{" "}
                        {format(dateRange.to, "LLL dd, y")}
                      </>
                    ) : (
                      format(dateRange.from, "LLL dd, y")
                    )
                  ) : (
                    <span>Pick a date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
            <div className="space-y-1">
              <p className="text-sm font-medium">Quick Ranges:</p>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setDateRange({
                    from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                    to: new Date()
                  })}
                >
                  Last 7 days
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setDateRange({
                    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                    to: new Date()
                  })}
                >
                  Last 30 days
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setDateRange({
                    from: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
                    to: new Date()
                  })}
                >
                  Last 90 days
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {reportData && (
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="threats">Threat Analysis</TabsTrigger>
            <TabsTrigger value="assets">Asset Status</TabsTrigger>
            <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            {/* Executive Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="shadow-elevated">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Risk Score</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${getRiskScoreColor(reportData.executiveSummary.riskScore)}`}>
                    {reportData.executiveSummary.riskScore}/100
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {reportData.executiveSummary.riskScore > 70 ? 'High Risk' : 
                     reportData.executiveSummary.riskScore > 40 ? 'Medium Risk' : 'Low Risk'}
                  </p>
                </CardContent>
              </Card>

              <Card className="shadow-elevated">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Events</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{reportData.executiveSummary.totalEvents}</div>
                  <p className="text-xs text-muted-foreground">
                    {reportData.executiveSummary.criticalAlerts} critical, {reportData.executiveSummary.highAlerts} high
                  </p>
                </CardContent>
              </Card>

              <Card className="shadow-elevated">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Assets Monitored</CardTitle>
                  <Server className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{reportData.executiveSummary.assetsMonitored}</div>
                  <p className="text-xs text-muted-foreground">
                    {reportData.assetStatus.online} online, {reportData.assetStatus.offline} offline
                  </p>
                </CardContent>
              </Card>

              <Card className="shadow-elevated">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">System Health</CardTitle>
                  <Shield className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-soc-success">{reportData.complianceMetrics.systemUptime}%</div>
                  <p className="text-xs text-muted-foreground">
                    Uptime this period
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Threat Overview Chart */}
            <Card className="shadow-elevated">
              <CardHeader>
                <CardTitle>Threat Overview</CardTitle>
                <CardDescription>Distribution of security events by severity</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(reportData.threatOverview).map(([severity, count]) => (
                    <div key={severity} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${getSeverityColor(severity).split(' ')[0]}`} />
                        <span className="capitalize font-medium">{severity}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono">{count}</span>
                        <div className="w-32 bg-muted rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${getSeverityColor(severity).split(' ')[0]}`}
                            style={{ width: `${Math.max(2, (count / Math.max(1, reportData.executiveSummary.totalEvents)) * 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-10">
                          {Math.round((count / Math.max(1, reportData.executiveSummary.totalEvents)) * 100)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="threats" className="space-y-4">
            <Card className="shadow-elevated">
              <CardHeader>
                <CardTitle>Top Security Events</CardTitle>
                <CardDescription>Critical and high severity events requiring attention</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {reportData.topEvents.length > 0 ? (
                    reportData.topEvents.map((event) => (
                      <div key={event.id} className="flex items-center justify-between p-3 border rounded-lg bg-soc-surface/30">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge className={getSeverityColor(event.severity)}>
                              {event.severity}
                            </Badge>
                            <span className="font-medium">{event.alertName}</span>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {event.hostName} • {format(new Date(event.timestamp), 'PPp')}
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {event.eventType}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No critical or high severity events in the selected period
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="assets" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="shadow-elevated">
                <CardHeader>
                  <CardTitle>Asset Status Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span>Total Assets</span>
                      <span className="font-mono">{reportData.assetStatus.total}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Online</span>
                      <span className="font-mono text-soc-success">{reportData.assetStatus.online}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Offline</span>
                      <span className="font-mono text-soc-danger">{reportData.assetStatus.offline}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Vulnerable</span>
                      <span className="font-mono text-soc-warning">{reportData.assetStatus.vulnerable}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-elevated">
                <CardHeader>
                  <CardTitle>Top Vulnerable Assets</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {reportData.vulnerabilitySummary.length > 0 ? (
                      reportData.vulnerabilitySummary.slice(0, 5).map((asset) => (
                        <div key={asset.assetName} className="flex justify-between items-center">
                          <span className="font-medium">{asset.assetName}</span>
                          <div className="flex items-center gap-2">
                            {asset.criticalVulns > 0 && (
                              <Badge className="bg-soc-danger">{asset.criticalVulns} critical</Badge>
                            )}
                            <span className="text-sm text-muted-foreground">
                              {asset.vulnerabilityCount} total
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-4 text-muted-foreground">
                        No vulnerable assets detected
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="recommendations" className="space-y-4">
            <Card className="shadow-elevated">
              <CardHeader>
                <CardTitle>Security Recommendations</CardTitle>
                <CardDescription>Priority actions to improve security posture</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {reportData.recommendations.map((recommendation, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 border rounded-lg bg-soc-surface/20">
                      <div className="w-6 h-6 bg-soc-primary text-white rounded-full flex items-center justify-center text-sm font-medium">
                        {index + 1}
                      </div>
                      <p className="text-sm flex-1">{recommendation}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-elevated">
              <CardHeader>
                <CardTitle>Compliance Metrics</CardTitle>
                <CardDescription>Performance and compliance indicators</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-soc-surface/20 rounded-lg">
                    <div className="text-2xl font-bold text-soc-accent">{reportData.complianceMetrics.eventsProcessed}</div>
                    <div className="text-sm text-muted-foreground">Events Processed</div>
                  </div>
                  <div className="text-center p-4 bg-soc-surface/20 rounded-lg">
                    <div className="text-2xl font-bold text-soc-accent">{reportData.complianceMetrics.avgResponseTime}s</div>
                    <div className="text-sm text-muted-foreground">Avg Response Time</div>
                  </div>
                  <div className="text-center p-4 bg-soc-surface/20 rounded-lg">
                    <div className="text-2xl font-bold text-soc-success">{reportData.complianceMetrics.systemUptime}%</div>
                    <div className="text-sm text-muted-foreground">System Uptime</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {!reportData && (
        <Card className="shadow-elevated">
          <CardContent className="text-center py-12">
            <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Please select a valid date range to generate reports</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};