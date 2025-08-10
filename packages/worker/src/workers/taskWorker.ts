import { prisma } from '../index';
import { logger } from '../utils/logger';
import { TOOLS, ToolExecution } from '../types/tools';
import { ToolExecutor } from '../tools/ToolExecutor';
import { addTaskJob, JOB_TYPES } from '../index';
import path from 'path';
import fs from 'fs-extra';

const toolExecutor = new ToolExecutor();

export const setupTaskWorker = {
  async handleRunTool(data: any) {
    const { taskId, executionId, targetId, toolName, target, workingDir, outputPath, args, timeout, metadata } = data;
    
    logger.info(`Running tool ${toolName} for task ${taskId}`);

    try {
      // Update task status to running
      await prisma.task.update({
        where: { id: taskId },
        data: { 
          status: 'RUNNING',
          startedAt: new Date()
        }
      });

      // Check if execution is still active
      const execution = await prisma.execution.findUnique({
        where: { id: executionId }
      });

      if (!execution || execution.status === 'CANCELLED') {
        await prisma.task.update({
          where: { id: taskId },
          data: { 
            status: 'CANCELLED',
            completedAt: new Date()
          }
        });
        return { success: false, reason: 'Execution cancelled' };
      }

      // Get tool configuration
      const toolConfig = TOOLS[toolName];
      if (!toolConfig) {
        throw new Error(`Unknown tool: ${toolName}`);
      }

      // Check dependencies
      if (metadata?.dependencies && metadata.dependencies.length > 0) {
        const dependencyResults = await this.checkDependencies(executionId, metadata.dependencies);
        if (!dependencyResults.allSatisfied) {
          logger.warn(`Dependencies not satisfied for ${toolName}: ${dependencyResults.missing.join(', ')}`);
          // Continue anyway, but log the warning
        }
      }

      // Prepare tool execution
      const toolExecution: ToolExecution = {
        id: taskId,
        tool: toolName,
        target,
        args: args || toolConfig.defaultArgs,
        outputPath,
        workingDir,
        timeout: timeout || toolConfig.timeout,
        metadata
      };

      // Execute tool
      const result = await toolExecutor.executeTool(toolExecution, toolConfig);

      // Update task with results
      await prisma.task.update({
        where: { id: taskId },
        data: {
          status: result.success ? 'COMPLETED' : 'FAILED',
          output: result.output,
          error: result.error,
          completedAt: new Date(),
          metadata: JSON.stringify({
            ...metadata,
            executionTime: result.executionTime,
            artifacts: result.artifacts.length
          })
        }
      });

      // Save artifacts to database
      if (result.artifacts.length > 0) {
        await this.saveArtifacts(taskId, targetId, result.artifacts);
      }

      // Process results if successful
      if (result.success) {
        await this.processToolResults(taskId, toolName, result, target);
      }

      // Check if all tasks are completed
      await this.checkExecutionCompletion(executionId);

      logger.info(`Tool ${toolName} completed for task ${taskId}`);

      return {
        success: result.success,
        taskId,
        executionTime: result.executionTime,
        artifacts: result.artifacts.length
      };

    } catch (error) {
      logger.error(`Task ${taskId} failed:`, error);
      
      // Update task status to failed
      await prisma.task.update({
        where: { id: taskId },
        data: {
          status: 'FAILED',
          error: error instanceof Error ? error.message : 'Unknown error',
          completedAt: new Date()
        }
      });

      // Check if all tasks are completed
      await this.checkExecutionCompletion(executionId);

      throw error;
    }
  },

  async handleProcessResult(data: any) {
    const { taskId, result } = data;
    
    logger.info(`Processing results for task ${taskId}`);

    try {
      // Process tool-specific results
      const task = await prisma.task.findUnique({
        where: { id: taskId }
      });

      if (!task) {
        throw new Error(`Task ${taskId} not found`);
      }

      await this.processToolResults(taskId, task.tool, result, '');

      return { success: true, taskId };

    } catch (error) {
      logger.error(`Failed to process results for task ${taskId}:`, error);
      throw error;
    }
  },

  async checkDependencies(executionId: string, dependencies: string[]): Promise<{ allSatisfied: boolean; missing: string[] }> {
    const completedTasks = await prisma.task.findMany({
      where: {
        executionId,
        tool: { in: dependencies },
        status: 'COMPLETED'
      }
    });

    const completedTools = completedTasks.map(task => task.tool);
    const missing = dependencies.filter(dep => !completedTools.includes(dep));

    return {
      allSatisfied: missing.length === 0,
      missing
    };
  },

  async saveArtifacts(taskId: string, targetId: string, artifacts: any[]) {
    for (const artifact of artifacts) {
      try {
        await prisma.artifact.create({
          data: {
            targetId,
            name: artifact.name,
            type: artifact.type,
            path: artifact.path,
            size: artifact.size,
            mimeType: artifact.mimeType,
            metadata: JSON.stringify(artifact.metadata || {})
          }
        });
      } catch (error) {
        logger.warn(`Failed to save artifact ${artifact.name}:`, error);
      }
    }
  },

  async processToolResults(taskId: string, toolName: string, result: any, target: string) {
    try {
      switch (toolName) {
        case 'subfinder':
        case 'assetfinder':
        case 'findomain':
        case 'chaos':
        case 'amass':
          await this.processSubdomainResults(taskId, result, target);
          break;
        case 'dnsx':
          await this.processDNSResults(taskId, result, target);
          break;
        case 'httpx':
          await this.processHTTPResults(taskId, result, target);
          break;
        case 'nuclei':
          await this.processVulnerabilityResults(taskId, result, target);
          break;
        case 'nikto':
          await this.processNiktoResults(taskId, result, target);
          break;
        default:
          logger.info(`No specific processing for tool: ${toolName}`);
      }
    } catch (error) {
      logger.warn(`Failed to process results for ${toolName}:`, error);
    }
  },

  async processSubdomainResults(taskId: string, result: any, target: string) {
    // Extract subdomains from output and save them
    const subdomains = this.extractSubdomains(result.output);
    
    if (subdomains.length > 0) {
      const outputPath = path.join(process.env.STORAGE_PATH || './storage', 'artifacts', target, 'subdomains.txt');
      await fs.writeFile(outputPath, subdomains.join('\n'));
      
      logger.info(`Extracted ${subdomains.length} subdomains from ${taskId}`);
    }
  },

  async processDNSResults(taskId: string, result: any, target: string) {
    // Process DNS resolution results
    const liveHosts = this.extractLiveHosts(result.output);
    
    if (liveHosts.length > 0) {
      const outputPath = path.join(process.env.STORAGE_PATH || './storage', 'artifacts', target, 'live_hosts.txt');
      await fs.writeFile(outputPath, liveHosts.join('\n'));
      
      logger.info(`Extracted ${liveHosts.length} live hosts from ${taskId}`);
    }
  },

  async processHTTPResults(taskId: string, result: any, target: string) {
    // Process HTTP discovery results
    const liveUrls = this.extractLiveUrls(result.output);
    
    if (liveUrls.length > 0) {
      const outputPath = path.join(process.env.STORAGE_PATH || './storage', 'artifacts', target, 'live_urls.txt');
      await fs.writeFile(outputPath, liveUrls.join('\n'));
      
      logger.info(`Extracted ${liveUrls.length} live URLs from ${taskId}`);
    }
  },

  async processVulnerabilityResults(taskId: string, result: any, target: string) {
    // Process vulnerability scan results
    try {
      const vulnerabilities = JSON.parse(result.output);
      
      for (const vuln of vulnerabilities) {
        await prisma.vulnerability.create({
          data: {
            targetId: target,
            tool: 'nuclei',
            type: vuln.type || 'unknown',
            severity: this.mapSeverity(vuln.info?.severity),
            title: vuln.info?.name || 'Unknown vulnerability',
            description: vuln.info?.description || '',
            evidence: JSON.stringify(vuln),
            cve: vuln.info?.cve?.[0] || null,
            cwe: vuln.info?.cwe?.[0] || null,
            cvss: vuln.info?.cvss?.score || null
          }
        });
      }
      
      logger.info(`Processed ${vulnerabilities.length} vulnerabilities from ${taskId}`);
    } catch (error) {
      logger.warn(`Failed to parse vulnerability results from ${taskId}:`, error);
    }
  },

  async processNiktoResults(taskId: string, result: any, target: string) {
    // Process Nikto scan results
    try {
      const niktoResults = JSON.parse(result.output);
      
      for (const finding of niktoResults.vulnerabilities || []) {
        await prisma.vulnerability.create({
          data: {
            targetId: target,
            tool: 'nikto',
            type: 'web_server',
            severity: this.mapSeverity(finding.severity),
            title: finding.message || 'Nikto finding',
            description: finding.description || '',
            evidence: JSON.stringify(finding)
          }
        });
      }
      
      logger.info(`Processed Nikto results from ${taskId}`);
    } catch (error) {
      logger.warn(`Failed to parse Nikto results from ${taskId}:`, error);
    }
  },

  async checkExecutionCompletion(executionId: string) {
    const tasks = await prisma.task.findMany({
      where: { executionId }
    });

    const completedTasks = tasks.filter(task => 
      ['COMPLETED', 'FAILED', 'CANCELLED'].includes(task.status)
    );

    if (completedTasks.length === tasks.length) {
      // All tasks completed, update execution status
      const failedTasks = tasks.filter(task => task.status === 'FAILED');
      const executionStatus = failedTasks.length === 0 ? 'COMPLETED' : 'FAILED';

      await prisma.execution.update({
        where: { id: executionId },
        data: {
          status: executionStatus,
          completedAt: new Date(),
          progress: 100
        }
      });

      logger.info(`Execution ${executionId} completed with status: ${executionStatus}`);
    } else {
      // Update progress
      const progress = Math.round((completedTasks.length / tasks.length) * 100);
      await prisma.execution.update({
        where: { id: executionId },
        data: { progress }
      });
    }
  },

  extractSubdomains(output: string): string[] {
    const lines = output.split('\n').filter(line => line.trim());
    const subdomains = new Set<string>();
    
    for (const line of lines) {
      const match = line.match(/^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/);
      if (match) {
        subdomains.add(match[0]);
      }
    }
    
    return Array.from(subdomains);
  },

  extractLiveHosts(output: string): string[] {
    const lines = output.split('\n').filter(line => line.trim());
    const hosts = new Set<string>();
    
    for (const line of lines) {
      const match = line.match(/^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/);
      if (match) {
        hosts.add(match[0]);
      }
    }
    
    return Array.from(hosts);
  },

  extractLiveUrls(output: string): string[] {
    const lines = output.split('\n').filter(line => line.trim());
    const urls = new Set<string>();
    
    for (const line of lines) {
      const match = line.match(/https?:\/\/[^\s]+/);
      if (match) {
        urls.add(match[0]);
      }
    }
    
    return Array.from(urls);
  },

  mapSeverity(severity: string): string {
    const severityMap: Record<string, string> = {
      'critical': 'CRITICAL',
      'high': 'HIGH',
      'medium': 'MEDIUM',
      'low': 'LOW',
      'info': 'INFO'
    };
    
    return severityMap[severity?.toLowerCase()] || 'INFO';
  }
};