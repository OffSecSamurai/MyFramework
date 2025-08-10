import { prisma } from '../index';
import { logger } from '../utils/logger';
import { TOOLS, EXECUTION_MODES, TOOL_DEPENDENCIES } from '../types/tools';
import { ToolExecutor } from '../tools/ToolExecutor';
import { addTaskJob, JOB_TYPES } from '../index';
import path from 'path';
import fs from 'fs-extra';

export const setupExecutionWorker = {
  async handleStartExecution(data: any) {
    const { executionId, targetId, mode, tools, metadata } = data;
    
    logger.info(`Starting execution ${executionId} for target ${targetId} in ${mode} mode`);

    try {
      // Update execution status
      await prisma.execution.update({
        where: { id: executionId },
        data: { 
          status: 'RUNNING',
          startedAt: new Date()
        }
      });

      // Get target information
      const target = await prisma.target.findUnique({
        where: { id: targetId }
      });

      if (!target) {
        throw new Error(`Target ${targetId} not found`);
      }

      // Determine tools to run based on mode
      let toolsToRun: string[];
      
      switch (mode) {
        case 'FULL':
          toolsToRun = EXECUTION_MODES.FULL;
          break;
        case 'CUSTOM':
          toolsToRun = Array.isArray(tools) ? tools : [];
          break;
        case 'SINGLE_TOOL':
          toolsToRun = Array.isArray(tools) && tools.length > 0 ? [tools[0]] : [];
          break;
        default:
          throw new Error(`Unknown execution mode: ${mode}`);
      }

      if (toolsToRun.length === 0) {
        throw new Error('No tools specified for execution');
      }

      // Create working directory
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const workingDir = path.join(
        process.env.STORAGE_PATH || './storage',
        'artifacts',
        target.domain,
        timestamp
      );

      await fs.ensureDir(workingDir);

      // Sort tools by dependencies
      const sortedTools = this.sortToolsByDependencies(toolsToRun);

      // Create tasks for each tool
      const taskPromises = sortedTools.map(async (toolName, index) => {
        const toolConfig = TOOLS[toolName];
        if (!toolConfig) {
          logger.warn(`Unknown tool: ${toolName}`);
          return;
        }

        // Create task record
        const task = await prisma.task.create({
          data: {
            executionId,
            tool: toolName,
            status: 'PENDING',
            metadata: JSON.stringify({
              target: target.domain,
              workingDir,
              dependencies: toolConfig.dependencies
            })
          }
        });

        // Add task job to queue
        await addTaskJob(JOB_TYPES.TASK.RUN_TOOL, {
          taskId: task.id,
          executionId,
          targetId,
          toolName,
          target: target.domain,
          workingDir,
          outputPath: path.join(workingDir, `${toolName}_output.txt`),
          args: toolConfig.defaultArgs,
          timeout: toolConfig.timeout,
          metadata: {
            dependencies: toolConfig.dependencies,
            category: toolConfig.category
          }
        }, {
          delay: index * 1000 // Stagger task execution by 1 second
        });

        logger.info(`Created task ${task.id} for tool ${toolName}`);
      });

      await Promise.all(taskPromises);

      // Update execution metadata
      await prisma.execution.update({
        where: { id: executionId },
        data: {
          metadata: JSON.stringify({
            mode,
            tools: toolsToRun,
            workingDir,
            timestamp
          })
        }
      });

      logger.info(`Execution ${executionId} started with ${toolsToRun.length} tools`);

      return {
        success: true,
        executionId,
        toolsCount: toolsToRun.length,
        workingDir
      };

    } catch (error) {
      logger.error(`Failed to start execution ${executionId}:`, error);
      
      // Update execution status to failed
      await prisma.execution.update({
        where: { id: executionId },
        data: { 
          status: 'FAILED',
          error: error instanceof Error ? error.message : 'Unknown error',
          completedAt: new Date()
        }
      });

      throw error;
    }
  },

  async handlePauseExecution(data: any) {
    const { executionId } = data;
    
    logger.info(`Pausing execution ${executionId}`);

    try {
      // Update execution status
      await prisma.execution.update({
        where: { id: executionId },
        data: { status: 'PAUSED' }
      });

      // Pause all running tasks
      await prisma.task.updateMany({
        where: {
          executionId,
          status: 'RUNNING'
        },
        data: { status: 'PAUSED' }
      });

      logger.info(`Execution ${executionId} paused`);

      return { success: true, executionId };

    } catch (error) {
      logger.error(`Failed to pause execution ${executionId}:`, error);
      throw error;
    }
  },

  async handleStopExecution(data: any) {
    const { executionId } = data;
    
    logger.info(`Stopping execution ${executionId}`);

    try {
      // Update execution status
      await prisma.execution.update({
        where: { id: executionId },
        data: { 
          status: 'CANCELLED',
          completedAt: new Date()
        }
      });

      // Cancel all pending/running tasks
      await prisma.task.updateMany({
        where: {
          executionId,
          status: { in: ['PENDING', 'RUNNING'] }
        },
        data: { status: 'CANCELLED' }
      });

      logger.info(`Execution ${executionId} stopped`);

      return { success: true, executionId };

    } catch (error) {
      logger.error(`Failed to stop execution ${executionId}:`, error);
      throw error;
    }
  },

  async handleResumeExecution(data: any) {
    const { executionId } = data;
    
    logger.info(`Resuming execution ${executionId}`);

    try {
      // Update execution status
      await prisma.execution.update({
        where: { id: executionId },
        data: { status: 'RUNNING' }
      });

      // Resume paused tasks
      const pausedTasks = await prisma.task.findMany({
        where: {
          executionId,
          status: 'PAUSED'
        }
      });

      for (const task of pausedTasks) {
        await prisma.task.update({
          where: { id: task.id },
          data: { status: 'PENDING' }
        });

        // Re-add task job to queue
        const metadata = JSON.parse(task.metadata || '{}');
        
        await addTaskJob(JOB_TYPES.TASK.RUN_TOOL, {
          taskId: task.id,
          executionId,
          targetId: metadata.targetId,
          toolName: task.tool,
          target: metadata.target,
          workingDir: metadata.workingDir,
          outputPath: path.join(metadata.workingDir, `${task.tool}_output.txt`),
          args: TOOLS[task.tool]?.defaultArgs || [],
          timeout: TOOLS[task.tool]?.timeout || 300000,
          metadata: {
            dependencies: TOOLS[task.tool]?.dependencies || [],
            category: TOOLS[task.tool]?.category
          }
        });
      }

      logger.info(`Execution ${executionId} resumed with ${pausedTasks.length} tasks`);

      return { success: true, executionId, resumedTasks: pausedTasks.length };

    } catch (error) {
      logger.error(`Failed to resume execution ${executionId}:`, error);
      throw error;
    }
  },

  sortToolsByDependencies(tools: string[]): string[] {
    const sorted: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (tool: string) => {
      if (visiting.has(tool)) {
        throw new Error(`Circular dependency detected: ${tool}`);
      }
      if (visited.has(tool)) {
        return;
      }

      visiting.add(tool);

      // Visit dependencies first
      const dependencies = TOOL_DEPENDENCIES[tool] || [];
      for (const dep of dependencies) {
        if (tools.includes(dep)) {
          visit(dep);
        }
      }

      visiting.delete(tool);
      visited.add(tool);
      sorted.push(tool);
    };

    for (const tool of tools) {
      visit(tool);
    }

    return sorted;
  }
};