import { Job } from 'bullmq';
import { prisma } from '../index';
import { logger } from '../utils/logger';

export const setupExecutionWorker = {
  async handleJob(job: Job) {
    try {
      const { executionId, targetId, mode, tools } = job.data;

      logger.info(`Starting execution: ${executionId} for target: ${targetId}`);

      // Update execution status to RUNNING
      await prisma.execution.update({
        where: { id: executionId },
        data: { 
          status: 'RUNNING',
          startedAt: new Date()
        }
      });

      // Create tasks for each tool
      const tasks = [];
      for (const tool of tools) {
        const task = await prisma.task.create({
          data: {
            executionId,
            tool,
            status: 'PENDING'
          }
        });
        tasks.push(task);
      }

      // Update execution with task count
      await prisma.execution.update({
        where: { id: executionId },
        data: { 
          metadata: JSON.stringify({ 
            totalTasks: tasks.length,
            completedTasks: 0,
            failedTasks: 0
          })
        }
      });

      logger.info(`Created ${tasks.length} tasks for execution: ${executionId}`);
      return { success: true, taskCount: tasks.length };

    } catch (error) {
      logger.error(`Execution job failed:`, error);
      
      // Update execution status to FAILED
      if (job.data.executionId) {
        await prisma.execution.update({
          where: { id: job.data.executionId },
          data: { 
            status: 'FAILED',
            completedAt: new Date()
          }
        });
      }
      
      throw error;
    }
  }
};