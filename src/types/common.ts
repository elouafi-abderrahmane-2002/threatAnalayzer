export type DateRange = {
  from: Date | undefined;
  to?: Date | undefined;
};

export interface ReportData {
  executiveSummary: {
    totalEvents: number;
    criticalAlerts: number;
    highAlerts: number;
    assetsMonitored: number;
    riskScore: number;
  };
  threatOverview: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  assetStatus: {
    total: number;
    online: number;
    offline: number;
    vulnerable: number;
  };
  topEvents: Array<{
    id: string;
    eventType: string;
    severity: string;
    timestamp: string;
    hostName: string;
    alertName: string;
  }>;
  vulnerabilitySummary: Array<{
    assetName: string;
    vulnerabilityCount: number;
    criticalVulns: number;
  }>;
  recommendations: string[];
  complianceMetrics: {
    eventsProcessed: number;
    avgResponseTime: number;
    systemUptime: number;
  };
}