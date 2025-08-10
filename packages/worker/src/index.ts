import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import express from 'express';
import { createServer } from 'http';
import { logger } from './utils/logger';
import { setupExecutionWorker } from './workers/executionWorker';
import { setupTaskWorker } from './workers/taskWorker';
import { setupReportWorker } from './workers/reportWorker';

// Load environment variables
dotenv.config();

// Initialize Prisma
export const prisma = new PrismaClient();

// Initialize Redis
export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Create Express app for health checks
const app = express();
const server = createServer(app);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Queue names
export const QUEUE_NAMES = {
  EXECUTION: 'execution',
  TASK: 'task',
  REPORT: 'report'
} as const;

// Job types
export const JOB_TYPES = {
  EXECUTION: {
    START: 'start-execution',
    PAUSE: 'pause-execution',
    STOP: 'stop-execution',
    RESUME: 'resume-execution'
  },
  TASK: {
    RUN_TOOL: 'run-tool',
    PROCESS_RESULT: 'process-result'
  },
  REPORT: {
    GENERATE: 'generate-report'
  }
} as const;

// Create workers
const executionWorker = new Worker(QUEUE_NAMES.EXECUTION, async (job) => {
  logger.info(`Processing execution job: ${job.id} (${job.name})`);
  
  try {
    switch (job.name) {
      case JOB_TYPES.EXECUTION.START:
        return await setupExecutionWorker.handleStartExecution(job.data);
      case JOB_TYPES.EXECUTION.PAUSE:
        return await setupExecutionWorker.handlePauseExecution(job.data);
      case JOB_TYPES.EXECUTION.STOP:
        return await setupExecutionWorker.handleStopExecution(job.data);
      case JOB_TYPES.EXECUTION.RESUME:
        return await setupExecutionWorker.handleResumeExecution(job.data);
      default:
        throw new Error(`Unknown execution job type: ${job.name}`);
    }
  } catch (error) {
    logger.error(`Execution job ${job.id} failed:`, error);
    throw error;
  }
}, {
  connection: redis,
  concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5')
});

const taskWorker = new Worker(QUEUE_NAMES.TASK, async (job) => {
  logger.info(`Processing task job: ${job.id} (${job.name})`);
  
  try {
    switch (job.name) {
      case JOB_TYPES.TASK.RUN_TOOL:
        return await setupTaskWorker.handleRunTool(job.data);
      case JOB_TYPES.TASK.PROCESS_RESULT:
        return await setupTaskWorker.handleProcessResult(job.data);
      default:
        throw new Error(`Unknown task job type: ${job.name}`);
    }
  } catch (error) {
    logger.error(`Task job ${job.id} failed:`, error);
    throw error;
  }
}, {
  connection: redis,
  concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5')
});

const reportWorker = new Worker(QUEUE_NAMES.REPORT, async (job) => {
  logger.info(`Processing report job: ${job.id} (${job.name})`);
  
  try {
    switch (job.name) {
      case JOB_TYPES.REPORT.GENERATE:
        return await setupReportWorker.handleGenerateReport(job.data);
      default:
        throw new Error(`Unknown report job type: ${job.name}`);
    }
  } catch (error) {
    logger.error(`Report job ${job.id} failed:`, error);
    throw error;
  }
}, {
  connection: redis,
  concurrency: 2
});

// Worker event handlers
executionWorker.on('completed', (job) => {
  logger.info(`Execution job ${job.id} completed successfully`);
});

executionWorker.on('failed', (job, err) => {
  logger.error(`Execution job ${job.id} failed:`, err);
});

taskWorker.on('completed', (job) => {
  logger.info(`Task job ${job.id} completed successfully`);
});

taskWorker.on('failed', (job, err) => {
  logger.error(`Task job ${job.id} failed:`, err);
});

reportWorker.on('completed', (job) => {
  logger.info(`Report job ${job.id} completed successfully`);
});

reportWorker.on('failed', (job, err) => {
  logger.error(`Report job ${job.id} failed:`, err);
});

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  await executionWorker.close();
  await taskWorker.close();
  await reportWorker.close();
  
  await prisma.$disconnect();
  logger.info('Database connection closed');
  
  await redis.quit();
  logger.info('Redis connection closed');
  
  server.close(() => {
    logger.info('HTTP server closed');
  });
  
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start HTTP server for health checks
const PORT = process.env.WORKER_PORT || 3002;
const HOST = process.env.WORKER_HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  logger.info(`🚀 Akshay's Framework Worker started on http://${HOST}:${PORT}`);
  logger.info(`📊 Health check available at http://${HOST}:${PORT}/health`);
  logger.info(`📊 Execution worker concurrency: ${executionWorker.concurrency}`);
  logger.info(`📊 Task worker concurrency: ${taskWorker.concurrency}`);
  logger.info(`📊 Report worker concurrency: ${reportWorker.concurrency}`);
});

export { executionWorker, taskWorker, reportWorker };