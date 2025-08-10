"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupTaskWorker = void 0;
const index_1 = require("../index");
const logger_1 = require("../utils/logger");
const dataProcessor_1 = require("../utils/dataProcessor");
const path_1 = __importDefault(require("path"));
const fs_extra_1 = __importDefault(require("fs-extra"));
class ToolExecutor {
    async executeTool(toolName, options) {
        logger_1.logger.info(`Executing tool: ${toolName} for target: ${options.target}`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        return {
            success: true,
            output: `Sample output from ${toolName}`,
            executionTime: 2000,
            exitCode: 0,
            toolName,
            artifacts: []
        };
    }
}
const toolExecutor = new ToolExecutor();
const dataProcessor = dataProcessor_1.DataProcessor.getInstance();
exports.setupTaskWorker = {
    async handleJob(job) {
        try {
            const { taskId, executionId, targetId, toolName, target, workingDir, outputPath, args, timeout, metadata } = job.data;
            logger_1.logger.info(`Processing task: ${taskId} for tool: ${toolName}`);
            await index_1.prisma.task.update({
                where: { id: taskId },
                data: {
                    status: 'RUNNING',
                    startedAt: new Date()
                }
            });
            const result = await toolExecutor.executeTool(toolName, {
                target,
                workingDir,
                outputPath,
                args,
                timeout,
                metadata
            });
            if (result.success) {
                await this.processToolResults(taskId, result, target);
            }
            await index_1.prisma.task.update({
                where: { id: taskId },
                data: {
                    status: 'COMPLETED',
                    output: result.output,
                    completedAt: new Date(),
                    metadata: JSON.stringify({
                        executionTime: result.executionTime,
                        exitCode: result.exitCode,
                        artifacts: result.artifacts || []
                    })
                }
            });
            logger_1.logger.info(`Task ${taskId} completed successfully`);
            return { success: true, taskId };
        }
        catch (error) {
            logger_1.logger.error(`Task job failed:`, error);
            if (job.data.taskId) {
                await index_1.prisma.task.update({
                    where: { id: job.data.taskId },
                    data: {
                        status: 'FAILED',
                        error: error instanceof Error ? error.message : 'Unknown error',
                        completedAt: new Date()
                    }
                });
            }
            throw error;
        }
    },
    async processToolResults(taskId, result, target) {
        const toolName = result.toolName || 'unknown';
        switch (toolName) {
            case 'subfinder':
            case 'amass':
                await this.processSubdomainResults(taskId, result, target);
                break;
            case 'httpx':
            case 'httprobe':
                await this.processHTTPResults(taskId, result, target);
                break;
            case 'nuclei':
                await this.processVulnerabilityResults(taskId, result, target);
                break;
            default:
                logger_1.logger.info(`No specific processing for tool: ${toolName}`);
        }
    },
    async processSubdomainResults(taskId, result, target) {
        const rawSubdomains = this.extractSubdomains(result.output);
        if (rawSubdomains.length > 0) {
            const processedSubdomains = await dataProcessor.processSubdomainResults(target, rawSubdomains);
            const outputPath = path_1.default.join(process.env['STORAGE_PATH'] || './storage', 'artifacts', target, 'subdomains.txt');
            await fs_extra_1.default.writeFile(outputPath, processedSubdomains.join('\n'));
            await index_1.prisma.task.update({
                where: { id: taskId },
                data: {
                    metadata: JSON.stringify({
                        rawCount: rawSubdomains.length,
                        processedCount: processedSubdomains.length
                    })
                }
            });
            logger_1.logger.info(`Processed subdomains: ${rawSubdomains.length} → ${processedSubdomains.length} for ${taskId}`);
        }
    },
    async processHTTPResults(taskId, result, target) {
        const rawUrls = this.extractLiveUrls(result.output);
        if (rawUrls.length > 0) {
            const processedUrls = await dataProcessor.processLiveUrls(target, rawUrls);
            const outputPath = path_1.default.join(process.env['STORAGE_PATH'] || './storage', 'artifacts', target, 'live_urls.txt');
            await fs_extra_1.default.writeFile(outputPath, processedUrls.join('\n'));
            await index_1.prisma.task.update({
                where: { id: taskId },
                data: {
                    metadata: JSON.stringify({
                        rawCount: rawUrls.length,
                        processedCount: processedUrls.length
                    })
                }
            });
            logger_1.logger.info(`Processed URLs: ${rawUrls.length} → ${processedUrls.length} for ${taskId}`);
        }
    },
    async processVulnerabilityResults(taskId, result, target) {
        try {
            const rawVulnerabilities = JSON.parse(result.output);
            const processedVulnerabilities = await dataProcessor.processVulnerabilities(target, rawVulnerabilities);
            for (const vuln of processedVulnerabilities) {
                await index_1.prisma.vulnerability.create({
                    data: {
                        targetId: target,
                        tool: vuln.tool || 'nuclei',
                        type: vuln.type || 'unknown',
                        severity: vuln.severity,
                        title: vuln.title,
                        description: vuln.description,
                        evidence: JSON.stringify(vuln),
                        cve: vuln.cve || null,
                        cwe: vuln.cwe || null,
                        cvss: vuln.cvss || null,
                        status: vuln.status || 'NEW'
                    }
                });
            }
            await index_1.prisma.task.update({
                where: { id: taskId },
                data: {
                    metadata: JSON.stringify({
                        rawCount: rawVulnerabilities.length,
                        processedCount: processedVulnerabilities.length
                    })
                }
            });
            logger_1.logger.info(`Processed vulnerabilities: ${rawVulnerabilities.length} → ${processedVulnerabilities.length} for ${taskId}`);
        }
        catch (error) {
            logger_1.logger.warn(`Failed to parse vulnerability results from ${taskId}:`, error);
        }
    },
    extractSubdomains(output) {
        return output
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0 && !line.startsWith('#'))
            .map(line => line.replace(/^https?:\/\//, '').replace(/:\d+$/, ''));
    },
    extractLiveUrls(output) {
        return output
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0 && !line.startsWith('#'))
            .map(line => line.startsWith('http') ? line : `https://${line}`);
    }
};
//# sourceMappingURL=taskWorker.js.map