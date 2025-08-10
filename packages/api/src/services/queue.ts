import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { logger } from '../utils/logger';

// Initialize Redis
const redis = new Redis(process.env['REDIS_URL'] || 'redis://localhost:6379');

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

// Create queues
export const executionQueue = new Queue(QUEUE_NAMES.EXECUTION, {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    }
  }
});

export const taskQueue = new Queue(QUEUE_NAMES.TASK, {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    }
  }
});

export const reportQueue = new Queue(QUEUE_NAMES.REPORT, {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: 50,
    removeOnFail: 25,
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 1000
    }
  }
});

// Queue event handlers
executionQueue.on('completed' as any, (job: any) => {
  logger.info(`Execution job ${job.id} completed successfully`);
});

executionQueue.on('failed' as any, (job: any, err: any) => {
  logger.error(`Execution job ${job.id} failed:`, err);
});

taskQueue.on('completed' as any, (job: any) => {
  logger.info(`Task job ${job.id} completed successfully`);
});

taskQueue.on('failed' as any, (job: any, err: any) => {
  logger.error(`Task job ${job.id} failed:`, err);
});

reportQueue.on('completed' as any, (job: any) => {
  logger.info(`Report job ${job.id} completed successfully`);
});

reportQueue.on('failed' as any, (job: any, err: any) => {
  logger.error(`Report job ${job.id} failed:`, err);
});

// Utility functions
export const addExecutionJob = async (type: string, data: any, options?: any) => {
  const job = await executionQueue.add(type, data, {
    jobId: options?.jobId,
    delay: options?.delay,
    priority: options?.priority
  });
  logger.info(`Added execution job: ${job.id} (${type})`);
  return job;
};

export const addTaskJob = async (type: string, data: any, options?: any) => {
  const job = await taskQueue.add(type, data, {
    jobId: options?.jobId,
    delay: options?.delay,
    priority: options?.priority
  });
  logger.info(`Added task job: ${job.id} (${type})`);
  return job;
};

export const addReportJob = async (type: string, data: any, options?: any) => {
  const job = await reportQueue.add(type, data, {
    jobId: options?.jobId,
    delay: options?.delay,
    priority: options?.priority
  });
  logger.info(`Added report job: ${job.id} (${type})`);
  return job;
};

// Queue management functions
export const pauseQueue = async (queueName: string) => {
  const queue = getQueueByName(queueName);
  await queue.pause();
  logger.info(`Paused queue: ${queueName}`);
};

export const resumeQueue = async (queueName: string) => {
  const queue = getQueueByName(queueName);
  await queue.resume();
  logger.info(`Resumed queue: ${queueName}`);
};

export const cleanQueue = async (queueName: string, grace: number = 1000) => {
  const queue = getQueueByName(queueName);
  await queue.clean(grace, 'completed' as any);
  await queue.clean(grace, 'failed' as any);
  logger.info(`Cleaned queue: ${queueName}`);
};

export const getQueueStats = async (queueName: string) => {
  const queue = getQueueByName(queueName);
  const [waiting, active, completed, failed] = await Promise.all([
    queue.getWaiting(),
    queue.getActive(),
    queue.getCompleted(),
    queue.getFailed()
  ]);
  
  return {
    waiting: waiting.length,
    active: active.length,
    completed: completed.length,
    failed: failed.length
  };
};

const getQueueByName = (queueName: string): Queue => {
  switch (queueName) {
    case QUEUE_NAMES.EXECUTION:
      return executionQueue;
    case QUEUE_NAMES.TASK:
      return taskQueue;
    case QUEUE_NAMES.REPORT:
      return reportQueue;
    default:
      throw new Error(`Unknown queue: ${queueName}`);
  }
};

export const setupQueue = () => {
  logger.info('BullMQ queues initialized');
};

export { redis };