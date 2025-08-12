"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redis = exports.setupQueue = exports.getQueueStats = exports.cleanQueue = exports.resumeQueue = exports.pauseQueue = exports.addReportJob = exports.addTaskJob = exports.addExecutionJob = exports.reportQueue = exports.taskQueue = exports.executionQueue = exports.JOB_TYPES = exports.QUEUE_NAMES = void 0;
const bullmq_1 = require("bullmq");
const ioredis_1 = require("ioredis");
const logger_1 = require("../utils/logger");
const redis = new ioredis_1.Redis(process.env['REDIS_URL'] || 'redis://localhost:6379');
exports.redis = redis;
exports.QUEUE_NAMES = {
    EXECUTION: 'execution',
    TASK: 'task',
    REPORT: 'report'
};
exports.JOB_TYPES = {
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
};
exports.executionQueue = new bullmq_1.Queue(exports.QUEUE_NAMES.EXECUTION, {
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
exports.taskQueue = new bullmq_1.Queue(exports.QUEUE_NAMES.TASK, {
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
exports.reportQueue = new bullmq_1.Queue(exports.QUEUE_NAMES.REPORT, {
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
exports.executionQueue.on('completed', (job) => {
    logger_1.logger.info(`Execution job ${job.id} completed successfully`);
});
exports.executionQueue.on('failed', (job, err) => {
    logger_1.logger.error(`Execution job ${job.id} failed:`, err);
});
exports.taskQueue.on('completed', (job) => {
    logger_1.logger.info(`Task job ${job.id} completed successfully`);
});
exports.taskQueue.on('failed', (job, err) => {
    logger_1.logger.error(`Task job ${job.id} failed:`, err);
});
exports.reportQueue.on('completed', (job) => {
    logger_1.logger.info(`Report job ${job.id} completed successfully`);
});
exports.reportQueue.on('failed', (job, err) => {
    logger_1.logger.error(`Report job ${job.id} failed:`, err);
});
const addExecutionJob = async (type, data, options) => {
    const job = await exports.executionQueue.add(type, data, {
        jobId: options?.jobId,
        delay: options?.delay,
        priority: options?.priority
    });
    logger_1.logger.info(`Added execution job: ${job.id} (${type})`);
    return job;
};
exports.addExecutionJob = addExecutionJob;
const addTaskJob = async (type, data, options) => {
    const job = await exports.taskQueue.add(type, data, {
        jobId: options?.jobId,
        delay: options?.delay,
        priority: options?.priority
    });
    logger_1.logger.info(`Added task job: ${job.id} (${type})`);
    return job;
};
exports.addTaskJob = addTaskJob;
const addReportJob = async (type, data, options) => {
    const job = await exports.reportQueue.add(type, data, {
        jobId: options?.jobId,
        delay: options?.delay,
        priority: options?.priority
    });
    logger_1.logger.info(`Added report job: ${job.id} (${type})`);
    return job;
};
exports.addReportJob = addReportJob;
const pauseQueue = async (queueName) => {
    const queue = getQueueByName(queueName);
    await queue.pause();
    logger_1.logger.info(`Paused queue: ${queueName}`);
};
exports.pauseQueue = pauseQueue;
const resumeQueue = async (queueName) => {
    const queue = getQueueByName(queueName);
    await queue.resume();
    logger_1.logger.info(`Resumed queue: ${queueName}`);
};
exports.resumeQueue = resumeQueue;
const cleanQueue = async (queueName, grace = 1000) => {
    const queue = getQueueByName(queueName);
    await queue.clean(grace, 'completed');
    await queue.clean(grace, 'failed');
    logger_1.logger.info(`Cleaned queue: ${queueName}`);
};
exports.cleanQueue = cleanQueue;
const getQueueStats = async (queueName) => {
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
exports.getQueueStats = getQueueStats;
const getQueueByName = (queueName) => {
    switch (queueName) {
        case exports.QUEUE_NAMES.EXECUTION:
            return exports.executionQueue;
        case exports.QUEUE_NAMES.TASK:
            return exports.taskQueue;
        case exports.QUEUE_NAMES.REPORT:
            return exports.reportQueue;
        default:
            throw new Error(`Unknown queue: ${queueName}`);
    }
};
const setupQueue = () => {
    logger_1.logger.info('BullMQ queues initialized');
};
exports.setupQueue = setupQueue;
//# sourceMappingURL=queue.js.map