"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupQueue = exports.cleanQueue = exports.resumeQueue = exports.pauseQueue = exports.getQueueStats = exports.addReportJob = exports.addTaskJob = exports.addExecutionJob = exports.taskScheduler = exports.executionScheduler = exports.reportQueue = exports.taskQueue = exports.executionQueue = exports.JOB_TYPES = exports.QUEUE_NAMES = void 0;
const bullmq_1 = require("bullmq");
const index_1 = require("../index");
const logger_1 = require("../utils/logger");
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
    connection: index_1.redis,
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
    connection: index_1.redis,
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
exports.reportQueue = new bullmq_1.Queue(exports.QUEUE_NAMES.REPORT, {
    connection: index_1.redis,
    defaultJobOptions: {
        removeOnComplete: 50,
        removeOnFail: 25,
        attempts: 2
    }
});
exports.executionScheduler = new bullmq_1.QueueScheduler(exports.QUEUE_NAMES.EXECUTION, {
    connection: index_1.redis
});
exports.taskScheduler = new bullmq_1.QueueScheduler(exports.QUEUE_NAMES.TASK, {
    connection: index_1.redis
});
exports.executionQueue.on('completed', (job) => {
    logger_1.logger.info(`Execution job ${job.id} completed successfully`);
});
exports.executionQueue.on('failed', (job, err) => {
    logger_1.logger.error(`Execution job ${job.id} failed:`, err);
});
exports.executionQueue.on('stalled', (job) => {
    logger_1.logger.warn(`Execution job ${job.id} stalled`);
});
exports.taskQueue.on('completed', (job) => {
    logger_1.logger.info(`Task job ${job.id} completed successfully`);
});
exports.taskQueue.on('failed', (job, err) => {
    logger_1.logger.error(`Task job ${job.id} failed:`, err);
});
exports.taskQueue.on('stalled', (job) => {
    logger_1.logger.warn(`Task job ${job.id} stalled`);
});
const addExecutionJob = async (type, data, options) => {
    try {
        const job = await exports.executionQueue.add(type, data, {
            jobId: options?.jobId,
            delay: options?.delay,
            priority: options?.priority
        });
        logger_1.logger.info(`Added execution job ${job.id} of type ${type}`);
        return job;
    }
    catch (error) {
        logger_1.logger.error(`Failed to add execution job:`, error);
        throw error;
    }
};
exports.addExecutionJob = addExecutionJob;
const addTaskJob = async (type, data, options) => {
    try {
        const job = await exports.taskQueue.add(type, data, {
            jobId: options?.jobId,
            delay: options?.delay,
            priority: options?.priority
        });
        logger_1.logger.info(`Added task job ${job.id} of type ${type}`);
        return job;
    }
    catch (error) {
        logger_1.logger.error(`Failed to add task job:`, error);
        throw error;
    }
};
exports.addTaskJob = addTaskJob;
const addReportJob = async (type, data, options) => {
    try {
        const job = await exports.reportQueue.add(type, data, {
            jobId: options?.jobId,
            delay: options?.delay,
            priority: options?.priority
        });
        logger_1.logger.info(`Added report job ${job.id} of type ${type}`);
        return job;
    }
    catch (error) {
        logger_1.logger.error(`Failed to add report job:`, error);
        throw error;
    }
};
exports.addReportJob = addReportJob;
const getQueueStats = async () => {
    try {
        const [executionStats, taskStats, reportStats] = await Promise.all([
            exports.executionQueue.getJobCounts(),
            exports.taskQueue.getJobCounts(),
            exports.reportQueue.getJobCounts()
        ]);
        return {
            execution: executionStats,
            task: taskStats,
            report: reportStats
        };
    }
    catch (error) {
        logger_1.logger.error('Failed to get queue stats:', error);
        throw error;
    }
};
exports.getQueueStats = getQueueStats;
const pauseQueue = async (queueName) => {
    try {
        const queue = getQueueByName(queueName);
        await queue.pause();
        logger_1.logger.info(`Queue ${queueName} paused`);
    }
    catch (error) {
        logger_1.logger.error(`Failed to pause queue ${queueName}:`, error);
        throw error;
    }
};
exports.pauseQueue = pauseQueue;
const resumeQueue = async (queueName) => {
    try {
        const queue = getQueueByName(queueName);
        await queue.resume();
        logger_1.logger.info(`Queue ${queueName} resumed`);
    }
    catch (error) {
        logger_1.logger.error(`Failed to resume queue ${queueName}:`, error);
        throw error;
    }
};
exports.resumeQueue = resumeQueue;
const cleanQueue = async (queueName, grace = 1000 * 60 * 60 * 24) => {
    try {
        const queue = getQueueByName(queueName);
        await queue.clean(grace, 'completed');
        await queue.clean(grace, 'failed');
        logger_1.logger.info(`Queue ${queueName} cleaned`);
    }
    catch (error) {
        logger_1.logger.error(`Failed to clean queue ${queueName}:`, error);
        throw error;
    }
};
exports.cleanQueue = cleanQueue;
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
    logger_1.logger.info('Queue system initialized');
};
exports.setupQueue = setupQueue;
exports.default = exports.setupQueue;
//# sourceMappingURL=queue.js.map