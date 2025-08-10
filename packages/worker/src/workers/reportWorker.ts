import { Job } from 'bullmq';
import { prisma } from '../index';
import { logger } from '../utils/logger';
import path from 'path';
import fs from 'fs-extra';

export const setupReportWorker = {
  async handleJob(job: Job) {
    try {
      const { reportId, targetId, executionId, type, format, customData } = job.data;

      logger.info(`Generating report: ${reportId} for target: ${targetId}`);

      // Generate report content
      const content = await this.generateReport(targetId, type, format, customData);

      // Save report file
      const fileName = `${type}_${targetId}_${Date.now()}.${format.toLowerCase()}`;
      const reportsDir = path.join(process.env['STORAGE_PATH'] || './storage', 'reports');
      await fs.ensureDir(reportsDir);
      
      const filePath = path.join(reportsDir, fileName);
      await fs.writeFile(filePath, content);

      // Update report with content and file path
      await prisma.report.update({
        where: { id: reportId },
        data: {
          content,
          path: filePath
        }
      });

      logger.info(`Report ${reportId} generated successfully`);
      return { success: true, reportId, filePath };

    } catch (error) {
      logger.error(`Report generation failed:`, error);
      
      // Update report with error
      if (job.data.reportId) {
        await prisma.report.update({
          where: { id: job.data.reportId },
          data: {
            content: `Error generating report: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        });
      }
      
      throw error;
    }
  },

  async generateReport(targetId: string, type: string, format: string, customData?: any): Promise<string> {
    const target = await prisma.target.findUnique({
      where: { id: targetId }
    });

    if (!target) {
      throw new Error(`Target ${targetId} not found`);
    }

    switch (type) {
      case 'EXECUTION_SUMMARY':
        return this.generateExecutionSummary(target, format);
      case 'VULNERABILITY_REPORT':
        return this.generateVulnerabilityReport(target, format);
      case 'ARTIFACT_SUMMARY':
        return this.generateArtifactSummary(target, format);
      case 'CUSTOM':
        return this.generateCustomReport(target, format, customData);
      default:
        throw new Error(`Unknown report type: ${type}`);
    }
  },

  async generateExecutionSummary(target: any, format: string): Promise<string> {
    const executions = await prisma.execution.findMany({
      where: { targetId: target.id },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    const summary = {
      target: target.domain,
      totalExecutions: executions.length,
      executions: executions.map(exec => ({
        id: exec.id,
        mode: exec.mode,
        status: exec.status,
        createdAt: exec.createdAt,
        completedAt: exec.completedAt
      }))
    };

    return format === 'JSON' ? JSON.stringify(summary, null, 2) : this.formatAsText(summary);
  },

  async generateVulnerabilityReport(target: any, format: string): Promise<string> {
    const vulnerabilities = await prisma.vulnerability.findMany({
      where: { targetId: target.id },
      orderBy: { createdAt: 'desc' }
    });

    const report = {
      target: target.domain,
      totalVulnerabilities: vulnerabilities.length,
      bySeverity: {
        CRITICAL: vulnerabilities.filter(v => v.severity === 'CRITICAL').length,
        HIGH: vulnerabilities.filter(v => v.severity === 'HIGH').length,
        MEDIUM: vulnerabilities.filter(v => v.severity === 'MEDIUM').length,
        LOW: vulnerabilities.filter(v => v.severity === 'LOW').length,
        INFO: vulnerabilities.filter(v => v.severity === 'INFO').length
      },
      vulnerabilities: vulnerabilities.map(vuln => ({
        title: vuln.title,
        severity: vuln.severity,
        type: vuln.type,
        tool: vuln.tool,
        cve: vuln.cve,
        cwe: vuln.cwe,
        createdAt: vuln.createdAt
      }))
    };

    return format === 'JSON' ? JSON.stringify(report, null, 2) : this.formatAsText(report);
  },

  async generateArtifactSummary(target: any, format: string): Promise<string> {
    const artifacts = await prisma.artifact.findMany({
      where: { targetId: target.id },
      orderBy: { createdAt: 'desc' }
    });

    const summary = {
      target: target.domain,
      totalArtifacts: artifacts.length,
      byType: artifacts.reduce((acc, artifact) => {
        acc[artifact.type] = (acc[artifact.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      artifacts: artifacts.map(artifact => ({
        name: artifact.name,
        type: artifact.type,
        size: artifact.size,
        createdAt: artifact.createdAt
      }))
    };

    return format === 'JSON' ? JSON.stringify(summary, null, 2) : this.formatAsText(summary);
  },

  async generateCustomReport(target: any, format: string, customData?: any): Promise<string> {
    const report = {
      target: target.domain,
      generatedAt: new Date().toISOString(),
      customData: customData || {}
    };

    return format === 'JSON' ? JSON.stringify(report, null, 2) : this.formatAsText(report);
  },

  formatAsText(data: any): string {
    let text = `Report for ${data.target}\n`;
    text += `Generated: ${new Date().toISOString()}\n\n`;

    if (data.totalExecutions !== undefined) {
      text += `Total Executions: ${data.totalExecutions}\n`;
    }

    if (data.totalVulnerabilities !== undefined) {
      text += `Total Vulnerabilities: ${data.totalVulnerabilities}\n`;
    }

    if (data.totalArtifacts !== undefined) {
      text += `Total Artifacts: ${data.totalArtifacts}\n`;
    }

    if (data.bySeverity) {
      text += '\nVulnerabilities by Severity:\n';
      Object.entries(data.bySeverity).forEach(([severity, count]) => {
        text += `  ${severity}: ${count}\n`;
      });
    }

    if (data.byType) {
      text += '\nArtifacts by Type:\n';
      Object.entries(data.byType).forEach(([type, count]) => {
        text += `  ${type}: ${count}\n`;
      });
    }

    return text;
  }
};