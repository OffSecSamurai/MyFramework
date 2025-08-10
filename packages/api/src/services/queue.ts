import { Queue, Worker, QueueScheduler } from 'bullmq';
import { redis } from '../index';
import { logger } from '../utils/logger';

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
    removeOnComplete: 200,
    removeOnFail: 100,
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 1000
    }
  }
});

export const reportQueue = new Queue(QUEUE_NAMES.REPORT, {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: 50,
    removeOnFail: 25,
    attempts: 2
  }
});

// Create schedulers for delayed jobs
export const executionScheduler = new QueueScheduler(QUEUE_NAMES.EXECUTION, {
  connection: redis
});

export const taskScheduler = new QueueScheduler(QUEUE_NAMES.TASK, {
  connection: redis
});

// Queue event handlers
executionQueue.on('completed', (job) => {
  logger.info(`Execution job ${job.id} completed successfully`);
});

executionQueue.on('failed', (job, err) => {
  logger.error(`Execution job ${job.id} failed:`, err);
});

executionQueue.on('stalled', (job) => {
  logger.warn(`Execution job ${job.id} stalled`);
});

taskQueue.on('completed', (job) => {
  logger.info(`Task job ${job.id} completed successfully`);
});

taskQueue.on('failed', (job, err) => {
  logger.error(`Task job ${job.id} failed:`, err);
});

taskQueue.on('stalled', (job) => {
  logger.warn(`Task job ${job.id} stalled`);
});

// Utility functions for adding jobs
export const addExecutionJob = async (
  type: string,
  data: any,
  options?: {
    delay?: number;
    priority?: number;
    jobId?: string;
  }
) => {
  try {
    const job = await executionQueue.add(type, data, {
      jobId: options?.jobId,
      delay: options?.delay,
      priority: options?.priority
    });
    logger.info(`Added execution job ${job.id} of type ${type}`);
    return job;
  } catch (error) {
    logger.error(`Failed to add execution job:`, error);
    throw error;
  }
};

export const addTaskJob = async (
  type: string,
  data: any,
  options?: {
    delay?: number;
    priority?: number;
    jobId?: string;
  }
) => {
  try {
    const job = await taskQueue.add(type, data, {
      jobId: options?.jobId,
      delay: options?.delay,
      priority: options?.priority
    });
    logger.info(`Added task job ${job.id} of type ${type}`);
    return job;
  } catch (error) {
    logger.error(`Failed to add task job:`, error);
    throw error;
  }
};

export const addReportJob = async (
  type: string,
  data: any,
  options?: {
    delay?: number;
    priority?: number;
    jobId?: string;
  }
) => {
  try {
    const job = await reportQueue.add(type, data, {
      jobId: options?.jobId,
      delay: options?.delay,
      priority: options?.priority
    });
    logger.info(`Added report job ${job.id} of type ${type}`);
    return job;
  } catch (error) {
    logger.error(`Failed to add report job:`, error);
    throw error;
  }
};

// Queue management functions
export const getQueueStats = async () => {
  try {
    const [executionStats, taskStats, reportStats] = await Promise.all([
      executionQueue.getJobCounts(),
      taskQueue.getJobCounts(),
      reportQueue.getJobCounts()
    ]);

    return {
      execution: executionStats,
      task: taskStats,
      report: reportStats
    };
  } catch (error) {
    logger.error('Failed to get queue stats:', error);
    throw error;
  }
};

export const pauseQueue = async (queueName: string) => {
  try {
    const queue = getQueueByName(queueName);
    await queue.pause();
    logger.info(`Queue ${queueName} paused`);
  } catch (error) {
    logger.error(`Failed to pause queue ${queueName}:`, error);
    throw error;
  }
};

export const resumeQueue = async (queueName: string) => {
  try {
    const queue = getQueueByName(queueName);
    await queue.resume();
    logger.info(`Queue ${queueName} resumed`);
  } catch (error) {
    logger.error(`Failed to resume queue ${queueName}:`, error);
    throw error;
  }
};

export const cleanQueue = async (queueName: string, grace: number = 1000 * 60 * 60 * 24) => {
  try {
    const queue = getQueueByName(queueName);
    await queue.clean(grace, 'completed');
    await queue.clean(grace, 'failed');
    logger.info(`Queue ${queueName} cleaned`);
  } catch (error) {
    logger.error(`Failed to clean queue ${queueName}:`, error);
    throw error;
  }
};

const getQueueByName = (queueName: string) => {
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
  logger.info('Queue system initialized');
};

export default setupQueue;