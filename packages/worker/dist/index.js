"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JOB_TYPES = exports.QUEUE_NAMES = exports.redis = exports.prisma = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const morgan_1 = __importDefault(require("morgan"));
const bullmq_1 = require("bullmq");
const ioredis_1 = require("ioredis");
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const client_1 = require("@prisma/client");
const executionWorker_1 = require("./workers/executionWorker");
const taskWorker_1 = require("./workers/taskWorker");
const reportWorker_1 = require("./workers/reportWorker");
const logger_1 = require("./utils/logger");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.prisma = new client_1.PrismaClient();
exports.redis = new ioredis_1.Redis(process.env['REDIS_URL'] || 'redis://localhost:6379');
const app = (0, express_1.default)();
const server = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: process.env['CORS_ORIGIN'] || "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: process.env['CORS_ORIGIN'] || "http://localhost:3000",
    credentials: true
}));
app.use((0, compression_1.default)());
app.use((0, morgan_1.default)('combined', { stream: { write: (message) => logger_1.logger.info(message.trim()) } }));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
app.get('/health', (_req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});
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
const executionWorker = new bullmq_1.Worker(exports.QUEUE_NAMES.EXECUTION, async (job) => {
    logger_1.logger.info(`Processing execution job: ${job.id}`);
    await executionWorker_1.setupExecutionWorker.handleJob(job);
}, {
    connection: exports.redis,
    concurrency: parseInt(process.env['WORKER_CONCURRENCY'] || '5')
});
const taskWorker = new bullmq_1.Worker(exports.QUEUE_NAMES.TASK, async (job) => {
    logger_1.logger.info(`Processing task job: ${job.id}`);
    await taskWorker_1.setupTaskWorker.handleJob(job);
}, {
    connection: exports.redis,
    concurrency: parseInt(process.env['WORKER_CONCURRENCY'] || '5')
});
const reportWorker = new bullmq_1.Worker(exports.QUEUE_NAMES.REPORT, async (job) => {
    logger_1.logger.info(`Processing report job: ${job.id}`);
    await reportWorker_1.setupReportWorker.handleJob(job);
}, {
    connection: exports.redis,
    concurrency: 2
});
executionWorker.on('completed', (job) => {
    logger_1.logger.info(`Execution job ${job?.id} completed successfully`);
});
executionWorker.on('failed', (job, err) => {
    logger_1.logger.error(`Execution job ${job?.id} failed:`, err);
});
taskWorker.on('completed', (job) => {
    logger_1.logger.info(`Task job ${job?.id} completed successfully`);
});
taskWorker.on('failed', (job, err) => {
    logger_1.logger.error(`Task job ${job?.id} failed:`, err);
});
reportWorker.on('completed', (job) => {
    logger_1.logger.info(`Report job ${job?.id} completed successfully`);
});
reportWorker.on('failed', (job, err) => {
    logger_1.logger.error(`Report job ${job?.id} failed:`, err);
});
const gracefulShutdown = async (signal) => {
    logger_1.logger.info(`Received ${signal}. Starting graceful shutdown...`);
    server.close(() => {
        logger_1.logger.info('HTTP server closed');
    });
    await executionWorker.close();
    await taskWorker.close();
    await reportWorker.close();
    await exports.redis.disconnect();
    await exports.prisma.$disconnect();
    logger_1.logger.info('Workers, Redis, and database connections closed');
    process.exit(0);
};
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
const PORT = parseInt(process.env['WORKER_PORT'] || '3002');
const HOST = process.env['WORKER_HOST'] || '0.0.0.0';
server.listen(PORT, HOST, () => {
    logger_1.logger.info(`🚀 Akshay's Framework Worker running on http://${HOST}:${PORT}`);
    logger_1.logger.info(`📊 Health check available at http://${HOST}:${PORT}/health`);
});
//# sourceMappingURL=index.js.map