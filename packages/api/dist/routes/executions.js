"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const index_1 = require("../index");
const logger_1 = require("../utils/logger");
const queue_1 = require("../services/queue");
const websocket_1 = require("../services/websocket");
const errorHandler_1 = require("../middleware/errorHandler");
const router = express_1.default.Router();
router.get('/', async (req, res, next) => {
    try {
        const { page = 1, limit = 50, status, targetId, mode } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const where = {};
        if (status)
            where.status = status;
        if (targetId)
            where.targetId = targetId;
        if (mode)
            where.mode = mode;
        const [executions, total] = await Promise.all([
            index_1.prisma.execution.findMany({
                where,
                skip,
                take: parseInt(limit),
                orderBy: { createdAt: 'desc' },
                include: {
                    target: {
                        select: { id: true, domain: true, name: true }
                    }
                }
            }),
            index_1.prisma.execution.count({ where })
        ]);
        res.json({
            executions,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    }
    catch (error) {
        next(error);
    }
});
router.get('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const execution = await index_1.prisma.execution.findUnique({
            where: { id },
            include: {
                target: true,
                tasks: {
                    orderBy: { createdAt: 'asc' }
                }
            }
        });
        if (!execution) {
            throw (0, errorHandler_1.createError)('Execution not found', 404);
        }
        res.json(execution);
    }
    catch (error) {
        next(error);
    }
});
router.post('/', async (req, res, next) => {
    try {
        const { targetId, mode, tools } = req.body;
        if (!targetId || !mode) {
            throw (0, errorHandler_1.createError)('Target ID and mode are required', 400);
        }
        const target = await index_1.prisma.target.findUnique({
            where: { id: targetId }
        });
        if (!target) {
            throw (0, errorHandler_1.createError)('Target not found', 404);
        }
        const activeExecution = await index_1.prisma.execution.findFirst({
            where: {
                targetId,
                status: { in: ['PENDING', 'RUNNING', 'PAUSED'] }
            }
        });
        if (activeExecution) {
            throw (0, errorHandler_1.createError)('Target already has an active execution', 409);
        }
        const execution = await index_1.prisma.execution.create({
            data: {
                targetId,
                mode,
                metadata: JSON.stringify({ tools })
            },
            include: {
                target: {
                    select: { id: true, domain: true, name: true }
                }
            }
        });
        await (0, queue_1.addExecutionJob)('start-execution', {
            executionId: execution.id,
            targetId,
            mode,
            tools
        });
        logger_1.logger.info(`Created new execution: ${execution.id} for target: ${target.domain}`);
        (0, websocket_1.emitExecutionUpdate)(execution.id, { type: 'execution-created', execution });
        res.status(201).json(execution);
    }
    catch (error) {
        next(error);
    }
});
router.post('/:id/pause', async (req, res, next) => {
    try {
        const { id } = req.params;
        const execution = await index_1.prisma.execution.findUnique({
            where: { id }
        });
        if (!execution) {
            throw (0, errorHandler_1.createError)('Execution not found', 404);
        }
        if (execution.status !== 'RUNNING') {
            throw (0, errorHandler_1.createError)('Execution is not running', 400);
        }
        await index_1.prisma.execution.update({
            where: { id },
            data: { status: 'PAUSED' }
        });
        (0, websocket_1.emitExecutionUpdate)(id, { type: 'execution-paused', executionId: id });
        res.json({ message: 'Execution paused successfully' });
    }
    catch (error) {
        next(error);
    }
});
router.post('/:id/resume', async (req, res, next) => {
    try {
        const { id } = req.params;
        const execution = await index_1.prisma.execution.findUnique({
            where: { id }
        });
        if (!execution) {
            throw (0, errorHandler_1.createError)('Execution not found', 404);
        }
        if (execution.status !== 'PAUSED') {
            throw (0, errorHandler_1.createError)('Execution is not paused', 400);
        }
        await index_1.prisma.execution.update({
            where: { id },
            data: { status: 'RUNNING' }
        });
        (0, websocket_1.emitExecutionUpdate)(id, { type: 'execution-resumed', executionId: id });
        res.json({ message: 'Execution resumed successfully' });
    }
    catch (error) {
        next(error);
    }
});
router.post('/:id/stop', async (req, res, next) => {
    try {
        const { id } = req.params;
        const execution = await index_1.prisma.execution.findUnique({
            where: { id }
        });
        if (!execution) {
            throw (0, errorHandler_1.createError)('Execution not found', 404);
        }
        if (!['RUNNING', 'PAUSED'].includes(execution.status)) {
            throw (0, errorHandler_1.createError)('Execution is not active', 400);
        }
        await index_1.prisma.execution.update({
            where: { id },
            data: {
                status: 'CANCELLED',
                completedAt: new Date()
            }
        });
        (0, websocket_1.emitExecutionUpdate)(id, { type: 'execution-stopped', executionId: id });
        res.json({ message: 'Execution stopped successfully' });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=executions.js.map