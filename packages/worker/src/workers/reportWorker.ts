import { prisma } from '../index';
import { logger } from '../utils/logger';
import path from 'path';
import fs from 'fs-extra';

export const setupReportWorker = {
  async handleGenerateReport(data: any) {
    const { reportId, targetId, executionId, type, format, customData } = data;
    
    logger.info(`Generating report ${reportId} for target ${targetId}`);

    try {
      // Get target information
      const target = await prisma.target.findUnique({
        where: { id: targetId }
      });

      if (!target) {
        throw new Error(`Target ${targetId} not found`);
      }

      // Get execution information if provided
      let execution = null;
      if (executionId) {
        execution = await prisma.execution.findUnique({
          where: { id: executionId },
          include: {
            tasks: true
          }
        });
      }

      // Generate report content based on type
      let content = '';
      let reportPath = '';

      switch (type) {
        case 'EXECUTION_SUMMARY':
          content = await this.generateExecutionSummary(target, execution);
          break;
        case 'VULNERABILITY_REPORT':
          content = await this.generateVulnerabilityReport(target, execution);
          break;
        case 'ARTIFACT_SUMMARY':
          content = await this.generateArtifactSummary(target, execution);
          break;
        case 'CUSTOM':
          content = await this.generateCustomReport(target, execution, customData);
          break;
        default:
          throw new Error(`Unknown report type: ${type}`);
      }

      // Save report file if needed
      if (format === 'PDF' || format === 'HTML') {
        reportPath = await this.saveReportFile(reportId, content, format);
      }

      // Update report record
      await prisma.report.update({
        where: { id: reportId },
        data: {
          content,
          path: reportPath || null
        }
      });

      logger.info(`Report ${reportId} generated successfully`);

      return {
        success: true,
        reportId,
        contentLength: content.length,
        reportPath
      };

    } catch (error) {
      logger.error(`Failed to generate report ${reportId}:`, error);
      
      // Update report status to failed
      await prisma.report.update({
        where: { id: reportId },
        data: {
          content: `Error generating report: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      });

      throw error;
    }
  },

  async generateExecutionSummary(target: any, execution: any): Promise<string> {
    const vulnerabilities = await prisma.vulnerability.findMany({
      where: { targetId: target.id }
    });

    const artifacts = await prisma.artifact.findMany({
      where: { targetId: target.id }
    });

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Execution Summary - ${target.domain}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #333; border-bottom: 2px solid #10b981; padding-bottom: 10px; }
        h2 { color: #555; margin-top: 30px; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .stat-card { background: #f8f9fa; padding: 20px; border-radius: 6px; text-align: center; }
        .stat-number { font-size: 2em; font-weight: bold; color: #10b981; }
        .stat-label { color: #666; margin-top: 5px; }
        .vulnerability { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; margin: 10px 0; border-radius: 4px; }
        .critical { background: #f8d7da; border-color: #f5c6cb; }
        .high { background: #fff3cd; border-color: #ffeaa7; }
        .medium { background: #d1ecf1; border-color: #bee5eb; }
        .low { background: #d4edda; border-color: #c3e6cb; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f8f9fa; font-weight: bold; }
        .timestamp { color: #666; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Execution Summary</h1>
        <p class="timestamp">Generated on: ${new Date().toISOString()}</p>
        
        <h2>Target Information</h2>
        <p><strong>Domain:</strong> ${target.domain}</p>
        <p><strong>Name:</strong> ${target.name || 'N/A'}</p>
        <p><strong>Description:</strong> ${target.description || 'N/A'}</p>
        
        <div class="stats">
            <div class="stat-card">
                <div class="stat-number">${vulnerabilities.length}</div>
                <div class="stat-label">Vulnerabilities</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${artifacts.length}</div>
                <div class="stat-label">Artifacts</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${vulnerabilities.filter(v => v.severity === 'CRITICAL').length}</div>
                <div class="stat-label">Critical</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${vulnerabilities.filter(v => v.severity === 'HIGH').length}</div>
                <div class="stat-label">High</div>
            </div>
        </div>

        ${execution ? `
        <h2>Execution Details</h2>
        <p><strong>Mode:</strong> ${execution.mode}</p>
        <p><strong>Status:</strong> ${execution.status}</p>
        <p><strong>Progress:</strong> ${execution.progress}%</p>
        <p><strong>Started:</strong> ${execution.startedAt ? new Date(execution.startedAt).toLocaleString() : 'N/A'}</p>
        <p><strong>Completed:</strong> ${execution.completedAt ? new Date(execution.completedAt).toLocaleString() : 'N/A'}</p>
        
        <h3>Tasks</h3>
        <table>
            <thead>
                <tr>
                    <th>Tool</th>
                    <th>Status</th>
                    <th>Started</th>
                    <th>Completed</th>
                </tr>
            </thead>
            <tbody>
                ${execution.tasks.map((task: any) => `
                <tr>
                    <td>${task.tool}</td>
                    <td>${task.status}</td>
                    <td>${task.startedAt ? new Date(task.startedAt).toLocaleString() : 'N/A'}</td>
                    <td>${task.completedAt ? new Date(task.completedAt).toLocaleString() : 'N/A'}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>
        ` : ''}

        <h2>Vulnerabilities</h2>
        ${vulnerabilities.length > 0 ? vulnerabilities.map((vuln: any) => `
        <div class="vulnerability ${vuln.severity.toLowerCase()}">
            <h3>${vuln.title}</h3>
            <p><strong>Severity:</strong> ${vuln.severity}</p>
            <p><strong>Type:</strong> ${vuln.type}</p>
            <p><strong>Tool:</strong> ${vuln.tool}</p>
            ${vuln.description ? `<p><strong>Description:</strong> ${vuln.description}</p>` : ''}
            ${vuln.cve ? `<p><strong>CVE:</strong> ${vuln.cve}</p>` : ''}
            ${vuln.cwe ? `<p><strong>CWE:</strong> ${vuln.cwe}</p>` : ''}
        </div>
        `).join('') : '<p>No vulnerabilities found.</p>'}

        <h2>Artifacts</h2>
        ${artifacts.length > 0 ? `
        <table>
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Size</th>
                    <th>Created</th>
                </tr>
            </thead>
            <tbody>
                ${artifacts.map((artifact: any) => `
                <tr>
                    <td>${artifact.name}</td>
                    <td>${artifact.type}</td>
                    <td>${this.formatBytes(artifact.size)}</td>
                    <td>${new Date(artifact.createdAt).toLocaleString()}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>
        ` : '<p>No artifacts found.</p>'}
    </div>
</body>
</html>`;

    return html;
  },

  async generateVulnerabilityReport(target: any, execution: any): Promise<string> {
    const vulnerabilities = await prisma.vulnerability.findMany({
      where: { targetId: target.id },
      orderBy: [
        { severity: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    const criticalCount = vulnerabilities.filter(v => v.severity === 'CRITICAL').length;
    const highCount = vulnerabilities.filter(v => v.severity === 'HIGH').length;
    const mediumCount = vulnerabilities.filter(v => v.severity === 'MEDIUM').length;
    const lowCount = vulnerabilities.filter(v => v.severity === 'LOW').length;
    const infoCount = vulnerabilities.filter(v => v.severity === 'INFO').length;

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Vulnerability Report - ${target.domain}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #333; border-bottom: 2px solid #dc3545; padding-bottom: 10px; }
        h2 { color: #555; margin-top: 30px; }
        .severity-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin: 20px 0; }
        .severity-card { padding: 15px; border-radius: 6px; text-align: center; color: white; }
        .critical { background: #dc3545; }
        .high { background: #fd7e14; }
        .medium { background: #ffc107; color: #333; }
        .low { background: #28a745; }
        .info { background: #17a2b8; }
        .severity-number { font-size: 1.5em; font-weight: bold; }
        .vulnerability { margin: 20px 0; padding: 20px; border-radius: 6px; border-left: 4px solid; }
        .vulnerability.critical { background: #f8d7da; border-color: #dc3545; }
        .vulnerability.high { background: #fff3cd; border-color: #fd7e14; }
        .vulnerability.medium { background: #d1ecf1; border-color: #ffc107; }
        .vulnerability.low { background: #d4edda; border-color: #28a745; }
        .vulnerability.info { background: #d1ecf1; border-color: #17a2b8; }
        .vuln-header { display: flex; justify-content: between; align-items: center; margin-bottom: 10px; }
        .vuln-title { font-size: 1.2em; font-weight: bold; margin: 0; }
        .vuln-severity { padding: 4px 8px; border-radius: 4px; color: white; font-size: 0.8em; }
        .vuln-meta { color: #666; font-size: 0.9em; margin: 10px 0; }
        .timestamp { color: #666; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Vulnerability Report</h1>
        <p class="timestamp">Generated on: ${new Date().toISOString()}</p>
        
        <h2>Target Information</h2>
        <p><strong>Domain:</strong> ${target.domain}</p>
        <p><strong>Name:</strong> ${target.name || 'N/A'}</p>
        
        <h2>Vulnerability Summary</h2>
        <div class="severity-stats">
            <div class="severity-card critical">
                <div class="severity-number">${criticalCount}</div>
                <div>Critical</div>
            </div>
            <div class="severity-card high">
                <div class="severity-number">${highCount}</div>
                <div>High</div>
            </div>
            <div class="severity-card medium">
                <div class="severity-number">${mediumCount}</div>
                <div>Medium</div>
            </div>
            <div class="severity-card low">
                <div class="severity-number">${lowCount}</div>
                <div>Low</div>
            </div>
            <div class="severity-card info">
                <div class="severity-number">${infoCount}</div>
                <div>Info</div>
            </div>
        </div>

        <h2>Vulnerability Details</h2>
        ${vulnerabilities.length > 0 ? vulnerabilities.map((vuln: any) => `
        <div class="vulnerability ${vuln.severity.toLowerCase()}">
            <div class="vuln-header">
                <h3 class="vuln-title">${vuln.title}</h3>
                <span class="vuln-severity ${vuln.severity.toLowerCase()}">${vuln.severity}</span>
            </div>
            <div class="vuln-meta">
                <strong>Type:</strong> ${vuln.type} | 
                <strong>Tool:</strong> ${vuln.tool} | 
                <strong>Found:</strong> ${new Date(vuln.createdAt).toLocaleString()}
            </div>
            ${vuln.description ? `<p><strong>Description:</strong> ${vuln.description}</p>` : ''}
            ${vuln.cve ? `<p><strong>CVE:</strong> ${vuln.cve}</p>` : ''}
            ${vuln.cwe ? `<p><strong>CWE:</strong> ${vuln.cwe}</p>` : ''}
            ${vuln.cvss ? `<p><strong>CVSS Score:</strong> ${vuln.cvss}</p>` : ''}
            ${vuln.evidence ? `<details><summary>Evidence</summary><pre>${vuln.evidence}</pre></details>` : ''}
        </div>
        `).join('') : '<p>No vulnerabilities found.</p>'}
    </div>
</body>
</html>`;

    return html;
  },

  async generateArtifactSummary(target: any, execution: any): Promise<string> {
    const artifacts = await prisma.artifact.findMany({
      where: { targetId: target.id },
      orderBy: { createdAt: 'desc' }
    });

    const artifactsByType = artifacts.reduce((acc: any, artifact: any) => {
      acc[artifact.type] = (acc[artifact.type] || 0) + 1;
      return acc;
    }, {});

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Artifact Summary - ${target.domain}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #333; border-bottom: 2px solid #10b981; padding-bottom: 10px; }
        h2 { color: #555; margin-top: 30px; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .stat-card { background: #f8f9fa; padding: 20px; border-radius: 6px; text-align: center; }
        .stat-number { font-size: 2em; font-weight: bold; color: #10b981; }
        .stat-label { color: #666; margin-top: 5px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f8f9fa; font-weight: bold; }
        .artifact-type { padding: 4px 8px; border-radius: 4px; font-size: 0.8em; color: white; }
        .subdomain_list { background: #007bff; }
        .live_hosts { background: #28a745; }
        .screenshot { background: #ffc107; color: #333; }
        .vulnerability_report { background: #dc3545; }
        .log_file { background: #6c757d; }
        .config_file { background: #17a2b8; }
        .other { background: #6f42c1; }
        .timestamp { color: #666; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Artifact Summary</h1>
        <p class="timestamp">Generated on: ${new Date().toISOString()}</p>
        
        <h2>Target Information</h2>
        <p><strong>Domain:</strong> ${target.domain}</p>
        <p><strong>Name:</strong> ${target.name || 'N/A'}</p>
        
        <h2>Artifact Statistics</h2>
        <div class="stats">
            <div class="stat-card">
                <div class="stat-number">${artifacts.length}</div>
                <div class="stat-label">Total Artifacts</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${this.formatBytes(artifacts.reduce((sum: number, a: any) => sum + a.size, 0))}</div>
                <div class="stat-label">Total Size</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${Object.keys(artifactsByType).length}</div>
                <div class="stat-label">Artifact Types</div>
            </div>
        </div>

        <h2>Artifacts by Type</h2>
        <table>
            <thead>
                <tr>
                    <th>Type</th>
                    <th>Count</th>
                    <th>Total Size</th>
                </tr>
            </thead>
            <tbody>
                ${Object.entries(artifactsByType).map(([type, count]) => {
                  const typeArtifacts = artifacts.filter((a: any) => a.type === type);
                  const totalSize = typeArtifacts.reduce((sum: number, a: any) => sum + a.size, 0);
                  return `
                  <tr>
                      <td><span class="artifact-type ${type.toLowerCase()}">${type}</span></td>
                      <td>${count}</td>
                      <td>${this.formatBytes(totalSize)}</td>
                  </tr>
                  `;
                }).join('')}
            </tbody>
        </table>

        <h2>All Artifacts</h2>
        <table>
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Size</th>
                    <th>Created</th>
                </tr>
            </thead>
            <tbody>
                ${artifacts.map((artifact: any) => `
                <tr>
                    <td>${artifact.name}</td>
                    <td><span class="artifact-type ${artifact.type.toLowerCase()}">${artifact.type}</span></td>
                    <td>${this.formatBytes(artifact.size)}</td>
                    <td>${new Date(artifact.createdAt).toLocaleString()}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>
    </div>
</body>
</html>`;

    return html;
  },

  async generateCustomReport(target: any, execution: any, customData: any): Promise<string> {
    // Generate custom report based on customData
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Custom Report - ${target.domain}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #333; border-bottom: 2px solid #10b981; padding-bottom: 10px; }
        .timestamp { color: #666; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Custom Report</h1>
        <p class="timestamp">Generated on: ${new Date().toISOString()}</p>
        
        <h2>Target Information</h2>
        <p><strong>Domain:</strong> ${target.domain}</p>
        <p><strong>Name:</strong> ${target.name || 'N/A'}</p>
        
        <h2>Custom Data</h2>
        <pre>${JSON.stringify(customData, null, 2)}</pre>
    </div>
</body>
</html>`;
  },

  async saveReportFile(reportId: string, content: string, format: string): Promise<string> {
    const reportsDir = path.join(process.env.STORAGE_PATH || './storage', 'reports');
    await fs.ensureDir(reportsDir);

    const filename = `report_${reportId}_${Date.now()}.${format.toLowerCase()}`;
    const filePath = path.join(reportsDir, filename);

    await fs.writeFile(filePath, content);

    return filePath;
  },

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
};