"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const index_1 = require("../index");
const logger_1 = require("../utils/logger");
const errorHandler_1 = require("../middleware/errorHandler");
const router = express_1.default.Router();
router.get('/', async (req, res, next) => {
    try {
        const { page = 1, limit = 50, targetId, severity, status, tool } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const where = {};
        if (targetId)
            where.targetId = targetId;
        if (severity)
            where.severity = severity;
        if (status)
            where.status = status;
        if (tool)
            where.tool = tool;
        const [vulnerabilities, total] = await Promise.all([
            index_1.prisma.vulnerability.findMany({
                where,
                skip,
                take: parseInt(limit),
                orderBy: { createdAt: 'desc' },
                include: {
                    target: {
                        select: { id: true, domain: true }
                    }
                }
            }),
            index_1.prisma.vulnerability.count({ where })
        ]);
        res.json({
            vulnerabilities,
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
        const vulnerability = await index_1.prisma.vulnerability.findUnique({
            where: { id },
            include: {
                target: {
                    select: { id: true, domain: true }
                }
            }
        });
        if (!vulnerability) {
            throw (0, errorHandler_1.createError)('Vulnerability not found', 404);
        }
        res.json(vulnerability);
    }
    catch (error) {
        next(error);
    }
});
router.patch('/:id/status', async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        if (!status) {
            throw (0, errorHandler_1.createError)('Status is required', 400);
        }
        const vulnerability = await index_1.prisma.vulnerability.update({
            where: { id },
            data: { status }
        });
        logger_1.logger.info(`Updated vulnerability status: ${id} -> ${status}`);
        res.json(vulnerability);
    }
    catch (error) {
        next(error);
    }
});
router.get('/stats/overview', async (req, res, next) => {
    try {
        const [total, critical, high, medium, low, info] = await Promise.all([
            index_1.prisma.vulnerability.count(),
            index_1.prisma.vulnerability.count({ where: { severity: 'CRITICAL' } }),
            index_1.prisma.vulnerability.count({ where: { severity: 'HIGH' } }),
            index_1.prisma.vulnerability.count({ where: { severity: 'MEDIUM' } }),
            index_1.prisma.vulnerability.count({ where: { severity: 'LOW' } }),
            index_1.prisma.vulnerability.count({ where: { severity: 'INFO' } })
        ]);
        const riskScore = calculateRiskScore({ critical, high, medium, low, info });
        res.json({
            total,
            bySeverity: { critical, high, medium, low, info },
            riskScore
        });
    }
    catch (error) {
        next(error);
    }
});
const calculateRiskScore = (counts) => {
    const weights = {
        critical: 10,
        high: 8,
        medium: 5,
        low: 2,
        info: 1
    };
    const score = Object.entries(counts).reduce((total, [severity, count]) => {
        return total + (weights[severity] * count);
    }, 0);
    return Math.min(score, 100);
};
exports.default = router;
//# sourceMappingURL=vulnerabilities.js.map