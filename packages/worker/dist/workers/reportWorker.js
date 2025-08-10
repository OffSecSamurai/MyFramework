"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupReportWorker = void 0;
const index_1 = require("../index");
const logger_1 = require("../utils/logger");
const path_1 = __importDefault(require("path"));
const fs_extra_1 = __importDefault(require("fs-extra"));
exports.setupReportWorker = {
    async handleJob(job) {
        try {
            const { reportId, targetId, executionId, type, format, customData } = job.data;
            logger_1.logger.info(`Generating report: ${reportId} for target: ${targetId}`);
            const content = await this.generateReport(targetId, type, format, customData);
            const fileName = `${type}_${targetId}_${Date.now()}.${format.toLowerCase()}`;
            const reportsDir = path_1.default.join(process.env['STORAGE_PATH'] || './storage', 'reports');
            await fs_extra_1.default.ensureDir(reportsDir);
            const filePath = path_1.default.join(reportsDir, fileName);
            await fs_extra_1.default.writeFile(filePath, content);
            await index_1.prisma.report.update({
                where: { id: reportId },
                data: {
                    content,
                    path: filePath
                }
            });
            logger_1.logger.info(`Report ${reportId} generated successfully`);
            return { success: true, reportId, filePath };
        }
        catch (error) {
            logger_1.logger.error(`Report generation failed:`, error);
            if (job.data.reportId) {
                await index_1.prisma.report.update({
                    where: { id: job.data.reportId },
                    data: {
                        content: `Error generating report: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }
                });
            }
            throw error;
        }
    },
    async generateReport(targetId, type, format, customData) {
        const target = await index_1.prisma.target.findUnique({
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
    async generateExecutionSummary(target, format) {
        const executions = await index_1.prisma.execution.findMany({
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
    async generateVulnerabilityReport(target, format) {
        const vulnerabilities = await index_1.prisma.vulnerability.findMany({
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
    async generateArtifactSummary(target, format) {
        const artifacts = await index_1.prisma.artifact.findMany({
            where: { targetId: target.id },
            orderBy: { createdAt: 'desc' }
        });
        const summary = {
            target: target.domain,
            totalArtifacts: artifacts.length,
            byType: artifacts.reduce((acc, artifact) => {
                acc[artifact.type] = (acc[artifact.type] || 0) + 1;
                return acc;
            }, {}),
            artifacts: artifacts.map(artifact => ({
                name: artifact.name,
                type: artifact.type,
                size: artifact.size,
                createdAt: artifact.createdAt
            }))
        };
        return format === 'JSON' ? JSON.stringify(summary, null, 2) : this.formatAsText(summary);
    },
    async generateCustomReport(target, format, customData) {
        const report = {
            target: target.domain,
            generatedAt: new Date().toISOString(),
            customData: customData || {}
        };
        return format === 'JSON' ? JSON.stringify(report, null, 2) : this.formatAsText(report);
    },
    formatAsText(data) {
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
//# sourceMappingURL=reportWorker.js.map