"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_1 = require("../index");
const logger_1 = require("../utils/logger");
const errorHandler_1 = require("../middleware/errorHandler");
const websocket_1 = require("../services/websocket");
const queue_1 = require("../services/queue");
const router = (0, express_1.Router)();
router.get('/', async (req, res, next) => {
    try {
        const { page = 1, limit = 10, status, targetId, mode } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const take = Number(limit);
        const where = {};
        if (status) {
            where.status = status;
        }
        if (targetId) {
            where.targetId = targetId;
        }
        if (mode) {
            where.mode = mode;
        }
        const [executions, total] = await Promise.all([
            index_1.prisma.execution.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: 'desc' },
                include: {
                    target: {
                        select: {
                            id: true,
                            domain: true,
                            name: true
                        }
                    },
                    tasks: {
                        orderBy: { createdAt: 'desc' },
                        take: 5
                    },
                    _count: {
                        select: {
                            tasks: true,
                            artifacts: true
                        }
                    }
                }
            }),
            index_1.prisma.execution.count({ where })
        ]);
        res.json({
            success: true,
            data: executions,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit))
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
                target: {
                    select: {
                        id: true,
                        domain: true,
                        name: true,
                        description: true
                    }
                },
                tasks: {
                    orderBy: { createdAt: 'asc' }
                },
                artifacts: {
                    orderBy: { createdAt: 'desc' }
                }
            }
        });
        if (!execution) {
            throw (0, errorHandler_1.createError)('Execution not found', 404);
        }
        res.json({
            success: true,
            data: execution
        });
    }
    catch (error) {
        next(error);
    }
});
router.post('/', async (req, res, next) => {
    try {
        const { targetId, mode, tools, metadata } = req.body;
        if (!targetId || !mode || !tools) {
            throw (0, errorHandler_1.createError)('Target ID, mode, and tools are required', 400);
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
                status: { in: ['PENDING', 'RUNNING'] }
            }
        });
        if (activeExecution) {
            throw (0, errorHandler_1.createError)('Target already has an active execution', 409);
        }
        const execution = await index_1.prisma.execution.create({
            data: {
                targetId,
                mode,
                tools: JSON.stringify(tools),
                metadata: metadata ? JSON.stringify(metadata) : null
            },
            include: {
                target: {
                    select: {
                        id: true,
                        domain: true,
                        name: true
                    }
                }
            }
        });
        logger_1.logger.info(`Created new execution for target: ${target.domain}`);
        await (0, queue_1.addExecutionJob)(queue_1.JOB_TYPES.EXECUTION.START, {
            executionId: execution.id,
            targetId,
            mode,
            tools,
            metadata
        }, {
            jobId: `execution-${execution.id}`
        });
        (0, websocket_1.emitExecutionUpdate)(execution.id, {
            type: 'execution-created',
            execution
        });
        res.status(201).json({
            success: true,
            data: execution
        });
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
        const updatedExecution = await index_1.prisma.execution.update({
            where: { id },
            data: { status: 'PAUSED' }
        });
        await (0, queue_1.addExecutionJob)(queue_1.JOB_TYPES.EXECUTION.PAUSE, {
            executionId: id
        });
        logger_1.logger.info(`Paused execution: ${id}`);
        (0, websocket_1.emitExecutionUpdate)(id, {
            type: 'execution-paused',
            execution: updatedExecution
        });
        res.json({
            success: true,
            data: updatedExecution
        });
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
        const updatedExecution = await index_1.prisma.execution.update({
            where: { id },
            data: { status: 'RUNNING' }
        });
        await (0, queue_1.addExecutionJob)(queue_1.JOB_TYPES.EXECUTION.RESUME, {
            executionId: id
        });
        logger_1.logger.info(`Resumed execution: ${id}`);
        (0, websocket_1.emitExecutionUpdate)(id, {
            type: 'execution-resumed',
            execution: updatedExecution
        });
        res.json({
            success: true,
            data: updatedExecution
        });
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
        if (!['PENDING', 'RUNNING', 'PAUSED'].includes(execution.status)) {
            throw (0, errorHandler_1.createError)('Execution cannot be stopped', 400);
        }
        const updatedExecution = await index_1.prisma.execution.update({
            where: { id },
            data: {
                status: 'CANCELLED',
                completedAt: new Date()
            }
        });
        await (0, queue_1.addExecutionJob)(queue_1.JOB_TYPES.EXECUTION.STOP, {
            executionId: id
        });
        logger_1.logger.info(`Stopped execution: ${id}`);
        (0, websocket_1.emitExecutionUpdate)(id, {
            type: 'execution-stopped',
            execution: updatedExecution
        });
        res.json({
            success: true,
            data: updatedExecution
        });
    }
    catch (error) {
        next(error);
    }
});
router.get('/:id/logs', async (req, res, next) => {
    try {
        const { id } = req.params;
        const { page = 1, limit = 50 } = req.query;
        const execution = await index_1.prisma.execution.findUnique({
            where: { id }
        });
        if (!execution) {
            throw (0, errorHandler_1.createError)('Execution not found', 404);
        }
        const tasks = await index_1.prisma.task.findMany({
            where: { executionId: id },
            select: {
                id: true,
                tool: true,
                status: true,
                output: true,
                error: true,
                startedAt: true,
                completedAt: true
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json({
            success: true,
            data: {
                execution,
                tasks
            }
        });
    }
    catch (error) {
        next(error);
    }
});
router.get('/:id/progress', async (req, res, next) => {
    try {
        const { id } = req.params;
        const execution = await index_1.prisma.execution.findUnique({
            where: { id },
            include: {
                tasks: {
                    select: {
                        id: true,
                        tool: true,
                        status: true,
                        progress: true
                    }
                }
            }
        });
        if (!execution) {
            throw (0, errorHandler_1.createError)('Execution not found', 404);
        }
        const totalTasks = execution.tasks.length;
        const completedTasks = execution.tasks.filter(task => ['COMPLETED', 'FAILED', 'SKIPPED'].includes(task.status)).length;
        const runningTasks = execution.tasks.filter(task => task.status === 'RUNNING').length;
        const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
        res.json({
            success: true,
            data: {
                executionId: id,
                progress: Math.round(progress),
                totalTasks,
                completedTasks,
                runningTasks,
                tasks: execution.tasks
            }
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=executions.js.map