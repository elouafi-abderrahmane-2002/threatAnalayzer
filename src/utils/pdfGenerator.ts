import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { ReportData, DateRange } from '@/types/common';

export const generatePDFReport = async (
  reportData: ReportData,
  clientName: string,
  dateRange: DateRange | undefined
) => {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  let yPosition = margin;

  // Helper functions
  const addHeader = () => {
    pdf.setFillColor(41, 128, 185);
    pdf.rect(0, 0, pageWidth, 40, 'F');
    
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(20);
    pdf.setFont(undefined, 'bold');
    pdf.text('Security Operations Report', margin, 25);
    
    pdf.setFontSize(12);
    pdf.setFont(undefined, 'normal');
    pdf.text(`Client: ${clientName}`, margin, 32);
    
    if (dateRange?.from && dateRange?.to) {
      const dateStr = `${format(dateRange.from, 'MMM dd, yyyy')} - ${format(dateRange.to, 'MMM dd, yyyy')}`;
      pdf.text(`Period: ${dateStr}`, pageWidth - 80, 32, { align: 'right' });
    }
  };

  const addFooter = () => {
    pdf.setFontSize(8);
    pdf.setTextColor(128, 128, 128);
    pdf.text(
      `Generated on ${format(new Date(), 'PPpp')} | Confidential - NextDefense SOC Platform`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  };

  const addSectionTitle = (title: string) => {
    yPosition += 10;
    if (yPosition > pageHeight - 40) {
      pdf.addPage();
      addHeader();
      yPosition = 50;
    }
    
    pdf.setTextColor(41, 128, 185);
    pdf.setFontSize(16);
    pdf.setFont(undefined, 'bold');
    pdf.text(title, margin, yPosition);
    yPosition += 8;
  };

  const addText = (text: string, fontSize = 10, isBold = false) => {
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(fontSize);
    pdf.setFont(undefined, isBold ? 'bold' : 'normal');
    
    const lines = pdf.splitTextToSize(text, pageWidth - 2 * margin);
    lines.forEach((line: string) => {
      if (yPosition > pageHeight - 20) {
        pdf.addPage();
        addHeader();
        yPosition = 50;
      }
      pdf.text(line, margin, yPosition);
      yPosition += 5;
    });
  };

  const addTable = (headers: string[], data: any[][]) => {
    yPosition += 5;
    if (yPosition > pageHeight - 60) {
      pdf.addPage();
      addHeader();
      yPosition = 50;
    }

    const tableWidth = pageWidth - 2 * margin;
    const colWidths = headers.map(() => tableWidth / headers.length);
    const rowHeight = 8;

    // Headers
    pdf.setFillColor(240, 240, 240);
    pdf.rect(margin, yPosition, tableWidth, rowHeight, 'F');
    
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(9);
    pdf.setFont(undefined, 'bold');
    
    headers.forEach((header, i) => {
      const xPos = margin + colWidths.slice(0, i).reduce((a, b) => a + b, 0) + 2;
      pdf.text(header, xPos, yPosition + 5);
    });

    yPosition += rowHeight;

    // Data rows
    pdf.setFont(undefined, 'normal');
    data.forEach((row, rowIndex) => {
      if (yPosition > pageHeight - 20) {
        pdf.addPage();
        addHeader();
        yPosition = 50;
      }

      if (rowIndex % 2 === 0) {
        pdf.setFillColor(248, 248, 248);
        pdf.rect(margin, yPosition, tableWidth, rowHeight, 'F');
      }

      row.forEach((cell, i) => {
        const xPos = margin + colWidths.slice(0, i).reduce((a, b) => a + b, 0) + 2;
        pdf.text(String(cell), xPos, yPosition + 5);
      });

      yPosition += rowHeight;
    });
  };

  // Start generating PDF
  addHeader();
  yPosition = 50;

  // Executive Summary
  addSectionTitle('Executive Summary');
  addText(`Risk Score: ${reportData.executiveSummary.riskScore}/100`, 12, true);
  addText(`Overall security posture assessment for the reporting period.`);
  
  yPosition += 5;
  addText(`• Total Security Events: ${reportData.executiveSummary.totalEvents}`);
  addText(`• Critical Alerts: ${reportData.executiveSummary.criticalAlerts}`);
  addText(`• High Priority Alerts: ${reportData.executiveSummary.highAlerts}`);
  addText(`• Assets Under Monitoring: ${reportData.executiveSummary.assetsMonitored}`);

  // Threat Overview
  addSectionTitle('Threat Overview');
  const threatHeaders = ['Severity', 'Count', 'Percentage'];
  const threatData = Object.entries(reportData.threatOverview).map(([severity, count]) => [
    severity.charAt(0).toUpperCase() + severity.slice(1),
    count,
    `${Math.round((count / Math.max(1, reportData.executiveSummary.totalEvents)) * 100)}%`
  ]);
  addTable(threatHeaders, threatData);

  // Asset Status
  addSectionTitle('Asset Status Summary');
  addText(`• Total Assets: ${reportData.assetStatus.total}`);
  addText(`• Online Assets: ${reportData.assetStatus.online}`);
  addText(`• Offline Assets: ${reportData.assetStatus.offline}`);
  addText(`• Vulnerable Assets: ${reportData.assetStatus.vulnerable}`);

  // Top Security Events
  if (reportData.topEvents.length > 0) {
    addSectionTitle('Top Security Events');
    const eventHeaders = ['Severity', 'Alert Name', 'Host', 'Date'];
    const eventData = reportData.topEvents.slice(0, 10).map(event => [
      event.severity.toUpperCase(),
      event.alertName.substring(0, 30) + (event.alertName.length > 30 ? '...' : ''),
      event.hostName,
      format(new Date(event.timestamp), 'MMM dd, yyyy')
    ]);
    addTable(eventHeaders, eventData);
  }

  // Vulnerability Summary
  if (reportData.vulnerabilitySummary.length > 0) {
    addSectionTitle('Vulnerable Assets Summary');
    const vulnHeaders = ['Asset Name', 'Total Vulnerabilities', 'Critical'];
    const vulnData = reportData.vulnerabilitySummary.slice(0, 10).map(asset => [
      asset.assetName,
      asset.vulnerabilityCount,
      asset.criticalVulns
    ]);
    addTable(vulnHeaders, vulnData);
  }

  // Recommendations
  addSectionTitle('Security Recommendations');
  reportData.recommendations.forEach((recommendation, index) => {
    addText(`${index + 1}. ${recommendation}`);
  });

  // Compliance Metrics
  addSectionTitle('Compliance & Performance Metrics');
  addText(`• Events Processed: ${reportData.complianceMetrics.eventsProcessed}`);
  addText(`• Average Response Time: ${reportData.complianceMetrics.avgResponseTime} seconds`);
  addText(`• System Uptime: ${reportData.complianceMetrics.systemUptime}%`);

  // Add footer to all pages
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    addFooter();
  }

  // Save the PDF
  const fileName = `security-report-${clientName.toLowerCase().replace(/\s+/g, '-')}-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
  pdf.save(fileName);
};