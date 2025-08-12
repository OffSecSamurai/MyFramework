"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const index_1 = require("../index");
const logger_1 = require("../utils/logger");
const websocket_1 = require("../services/websocket");
const errorHandler_1 = require("../middleware/errorHandler");
const router = express_1.default.Router();
router.get('/', async (req, res, next) => {
    try {
        const { page = 1, limit = 50, status, search } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const where = {};
        if (status)
            where.status = status;
        if (search) {
            where.OR = [
                { domain: { contains: search, mode: 'insensitive' } },
                { name: { contains: search, mode: 'insensitive' } }
            ];
        }
        const [targets, total] = await Promise.all([
            index_1.prisma.target.findMany({
                where,
                skip,
                take: parseInt(limit),
                orderBy: { createdAt: 'desc' }
            }),
            index_1.prisma.target.count({ where })
        ]);
        res.json({
            targets,
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
        const target = await index_1.prisma.target.findUnique({
            where: { id },
            include: {
                executions: {
                    orderBy: { createdAt: 'desc' },
                    take: 5
                },
                artifacts: {
                    orderBy: { createdAt: 'desc' },
                    take: 10
                }
            }
        });
        if (!target) {
            throw (0, errorHandler_1.createError)('Target not found', 404);
        }
        res.json(target);
    }
    catch (error) {
        next(error);
    }
});
router.post('/', async (req, res, next) => {
    try {
        const { domain, name, description, scope } = req.body;
        if (!domain) {
            throw (0, errorHandler_1.createError)('Domain is required', 400);
        }
        const existingTarget = await index_1.prisma.target.findUnique({
            where: { domain }
        });
        if (existingTarget) {
            throw (0, errorHandler_1.createError)('Target already exists', 409);
        }
        const target = await index_1.prisma.target.create({
            data: {
                domain,
                name,
                description,
                scope: scope ? JSON.stringify(scope) : null
            }
        });
        logger_1.logger.info(`Created new target: ${target.domain}`);
        (0, websocket_1.emitTargetUpdate)('target-created', target);
        res.status(201).json(target);
    }
    catch (error) {
        next(error);
    }
});
router.put('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, description, scope, status } = req.body;
        const target = await index_1.prisma.target.update({
            where: { id },
            data: {
                name,
                description,
                scope: scope ? JSON.stringify(scope) : undefined,
                status
            }
        });
        logger_1.logger.info(`Updated target: ${target.domain}`);
        (0, websocket_1.emitTargetUpdate)('target-updated', target);
        res.json(target);
    }
    catch (error) {
        next(error);
    }
});
router.delete('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const activeExecutions = await index_1.prisma.execution.findFirst({
            where: {
                targetId: id,
                status: { in: ['PENDING', 'RUNNING', 'PAUSED'] }
            }
        });
        if (activeExecutions) {
            throw (0, errorHandler_1.createError)('Cannot delete target with active executions', 400);
        }
        const target = await index_1.prisma.target.delete({
            where: { id }
        });
        logger_1.logger.info(`Deleted target: ${target.domain}`);
        (0, websocket_1.emitTargetUpdate)('target-deleted', { id });
        res.json({ message: 'Target deleted successfully' });
    }
    catch (error) {
        next(error);
    }
});
router.get('/:id/stats', async (req, res, next) => {
    try {
        const { id } = req.params;
        const [executions, vulnerabilities, artifacts] = await Promise.all([
            index_1.prisma.execution.count({ where: { targetId: id } }),
            index_1.prisma.vulnerability.count({ where: { targetId: id } }),
            index_1.prisma.artifact.count({ where: { targetId: id } })
        ]);
        const criticalVulns = await index_1.prisma.vulnerability.count({
            where: { targetId: id, severity: 'CRITICAL' }
        });
        const highVulns = await index_1.prisma.vulnerability.count({
            where: { targetId: id, severity: 'HIGH' }
        });
        res.json({
            executions,
            vulnerabilities,
            artifacts,
            criticalVulns,
            highVulns
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=targets.js.map