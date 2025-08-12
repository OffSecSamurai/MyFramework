"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const index_1 = require("../index");
const logger_1 = require("../utils/logger");
const queue_1 = require("../services/queue");
const errorHandler_1 = require("../middleware/errorHandler");
const router = express_1.default.Router();
router.get('/', async (req, res, next) => {
    try {
        const { page = 1, limit = 50, targetId, type, format } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const where = {};
        if (targetId)
            where.targetId = targetId;
        if (type)
            where.type = type;
        if (format)
            where.format = format;
        const [reports, total] = await Promise.all([
            index_1.prisma.report.findMany({
                where,
                skip,
                take: parseInt(limit),
                orderBy: { createdAt: 'desc' }
            }),
            index_1.prisma.report.count({ where })
        ]);
        res.json({
            reports,
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
        const report = await index_1.prisma.report.findUnique({
            where: { id }
        });
        if (!report) {
            throw (0, errorHandler_1.createError)('Report not found', 404);
        }
        res.json(report);
    }
    catch (error) {
        next(error);
    }
});
router.post('/', async (req, res, next) => {
    try {
        const { targetId, executionId, type, format, customData } = req.body;
        if (!targetId || !type || !format) {
            throw (0, errorHandler_1.createError)('Target ID, type, and format are required', 400);
        }
        const target = await index_1.prisma.target.findUnique({
            where: { id: targetId }
        });
        if (!target) {
            throw (0, errorHandler_1.createError)('Target not found', 404);
        }
        const report = await index_1.prisma.report.create({
            data: {
                targetId,
                executionId,
                type,
                format,
                content: null,
                path: null
            }
        });
        await (0, queue_1.addReportJob)('generate-report', {
            reportId: report.id,
            targetId,
            executionId,
            type,
            format,
            customData
        });
        logger_1.logger.info(`Created new report: ${report.id} for target: ${target.domain}`);
        res.status(201).json(report);
    }
    catch (error) {
        next(error);
    }
});
router.delete('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const report = await index_1.prisma.report.delete({
            where: { id }
        });
        logger_1.logger.info(`Deleted report: ${report.id}`);
        res.json({ message: 'Report deleted successfully' });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=reports.js.map