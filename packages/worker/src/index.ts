import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { PrismaClient } from '@prisma/client';

// Import workers
import { setupExecutionWorker } from './workers/executionWorker';
import { setupTaskWorker } from './workers/taskWorker';
import { setupReportWorker } from './workers/reportWorker';

// Import utilities
import { logger } from './utils/logger';

// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

// Initialize Prisma
export const prisma = new PrismaClient();

// Initialize Redis
export const redis = new Redis(process.env['REDIS_URL'] || 'redis://localhost:6379');

// Create Express app
const app = express();
const server = createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: process.env['CORS_ORIGIN'] || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env['CORS_ORIGIN'] || "http://localhost:3000",
  credentials: true
}));
app.use(compression());
app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (_req, res) => {
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
  logger.info(`Processing execution job: ${job.id}`);
  await setupExecutionWorker.handleJob(job);
}, {
  connection: redis,
  concurrency: parseInt(process.env['WORKER_CONCURRENCY'] || '5')
});

const taskWorker = new Worker(QUEUE_NAMES.TASK, async (job) => {
  logger.info(`Processing task job: ${job.id}`);
  await setupTaskWorker.handleJob(job);
}, {
  connection: redis,
  concurrency: parseInt(process.env['WORKER_CONCURRENCY'] || '5')
});

const reportWorker = new Worker(QUEUE_NAMES.REPORT, async (job) => {
  logger.info(`Processing report job: ${job.id}`);
  await setupReportWorker.handleJob(job);
}, {
  connection: redis,
  concurrency: 2
});

// Worker event handlers
executionWorker.on('completed' as any, (job: any) => {
  logger.info(`Execution job ${job?.id} completed successfully`);
});

executionWorker.on('failed' as any, (job: any, err: any) => {
  logger.error(`Execution job ${job?.id} failed:`, err);
});

taskWorker.on('completed' as any, (job: any) => {
  logger.info(`Task job ${job?.id} completed successfully`);
});

taskWorker.on('failed' as any, (job: any, err: any) => {
  logger.error(`Task job ${job?.id} failed:`, err);
});

reportWorker.on('completed' as any, (job: any) => {
  logger.info(`Report job ${job?.id} completed successfully`);
});

reportWorker.on('failed' as any, (job: any, err: any) => {
  logger.error(`Report job ${job?.id} failed:`, err);
});

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  server.close(() => {
    logger.info('HTTP server closed');
  });
  
  await executionWorker.close();
  await taskWorker.close();
  await reportWorker.close();
  await redis.disconnect();
  await prisma.$disconnect();
  
  logger.info('Workers, Redis, and database connections closed');
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
const PORT = parseInt(process.env['WORKER_PORT'] || '3002');
const HOST = process.env['WORKER_HOST'] || '0.0.0.0';

server.listen(PORT, HOST, () => {
  logger.info(`🚀 Akshay's Framework Worker running on http://${HOST}:${PORT}`);
  logger.info(`📊 Health check available at http://${HOST}:${PORT}/health`);
});