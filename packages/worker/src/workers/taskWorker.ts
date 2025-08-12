import { Job } from 'bullmq';
import { prisma } from '../index';
import { logger } from '../utils/logger';
import { DataProcessor } from '../utils/dataProcessor';
import path from 'path';
import fs from 'fs-extra';

// Simple ToolExecutor class
class ToolExecutor {
  async executeTool(toolName: string, options: any) {
    logger.info(`Executing tool: ${toolName} for target: ${options.target}`);
    
    // Simulate tool execution
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
const dataProcessor = DataProcessor.getInstance();

export const setupTaskWorker = {
  async handleJob(job: Job) {
    try {
      const { taskId, executionId, targetId, toolName, target, workingDir, outputPath, args, timeout, metadata } = job.data;

      logger.info(`Processing task: ${taskId} for tool: ${toolName}`);

      // Update task status to RUNNING
      await prisma.task.update({
        where: { id: taskId },
        data: {
          status: 'RUNNING',
          startedAt: new Date()
        }
      });

      // Execute tool
      const result = await toolExecutor.executeTool(toolName, {
        target,
        workingDir,
        outputPath,
        args,
        timeout,
        metadata
      });

      // Process results based on tool type
      if (result.success) {
        await this.processToolResults(taskId, result, target);
      }

      // Update task status to COMPLETED
      await prisma.task.update({
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

      logger.info(`Task ${taskId} completed successfully`);
      return { success: true, taskId };

    } catch (error) {
      logger.error(`Task job failed:`, error);
      
      // Update task status to FAILED
      if (job.data.taskId) {
        await prisma.task.update({
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

  async processToolResults(taskId: string, result: any, target: string) {
    // Process results based on tool type
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
        logger.info(`No specific processing for tool: ${toolName}`);
    }
  },

  async processSubdomainResults(taskId: string, result: any, target: string) {
    const rawSubdomains = this.extractSubdomains(result.output);

    if (rawSubdomains.length > 0) {
      const processedSubdomains = await dataProcessor.processSubdomainResults(target, rawSubdomains);

      const outputPath = path.join(process.env['STORAGE_PATH'] || './storage', 'artifacts', target, 'subdomains.txt');
      await fs.writeFile(outputPath, processedSubdomains.join('\n'));

      await prisma.task.update({
        where: { id: taskId },
        data: {
          metadata: JSON.stringify({
            rawCount: rawSubdomains.length,
            processedCount: processedSubdomains.length
          })
        }
      });

      logger.info(`Processed subdomains: ${rawSubdomains.length} → ${processedSubdomains.length} for ${taskId}`);
    }
  },

  async processHTTPResults(taskId: string, result: any, target: string) {
    const rawUrls = this.extractLiveUrls(result.output);

    if (rawUrls.length > 0) {
      const processedUrls = await dataProcessor.processLiveUrls(target, rawUrls);

      const outputPath = path.join(process.env['STORAGE_PATH'] || './storage', 'artifacts', target, 'live_urls.txt');
      await fs.writeFile(outputPath, processedUrls.join('\n'));

      await prisma.task.update({
        where: { id: taskId },
        data: {
          metadata: JSON.stringify({
            rawCount: rawUrls.length,
            processedCount: processedUrls.length
          })
        }
      });

      logger.info(`Processed URLs: ${rawUrls.length} → ${processedUrls.length} for ${taskId}`);
    }
  },

  async processVulnerabilityResults(taskId: string, result: any, target: string) {
    try {
      const rawVulnerabilities = JSON.parse(result.output);
      const processedVulnerabilities = await dataProcessor.processVulnerabilities(target, rawVulnerabilities);

      for (const vuln of processedVulnerabilities) {
        await prisma.vulnerability.create({
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

      await prisma.task.update({
        where: { id: taskId },
        data: {
          metadata: JSON.stringify({
            rawCount: rawVulnerabilities.length,
            processedCount: processedVulnerabilities.length
          })
        }
      });

      logger.info(`Processed vulnerabilities: ${rawVulnerabilities.length} → ${processedVulnerabilities.length} for ${taskId}`);
    } catch (error) {
      logger.warn(`Failed to parse vulnerability results from ${taskId}:`, error);
    }
  },

  extractSubdomains(output: string): string[] {
    return output
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('#'))
      .map(line => line.replace(/^https?:\/\//, '').replace(/:\d+$/, ''));
  },

  extractLiveUrls(output: string): string[] {
    return output
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('#'))
      .map(line => line.startsWith('http') ? line : `https://${line}`);
  }
};