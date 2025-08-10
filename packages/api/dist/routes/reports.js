"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_1 = require("../index");
const logger_1 = require("../utils/logger");
const errorHandler_1 = require("../middleware/errorHandler");
const queue_1 = require("../services/queue");
const router = (0, express_1.Router)();
router.get('/', async (req, res, next) => {
    try {
        const { page = 1, limit = 10, targetId, type, format } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const take = Number(limit);
        const where = {};
        if (targetId) {
            where.targetId = targetId;
        }
        if (type) {
            where.type = type;
        }
        if (format) {
            where.format = format;
        }
        const [reports, total] = await Promise.all([
            index_1.prisma.report.findMany({
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
                    }
                }
            }),
            index_1.prisma.report.count({ where })
        ]);
        res.json({
            success: true,
            data: reports,
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
        const report = await index_1.prisma.report.findUnique({
            where: { id },
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
        if (!report) {
            throw (0, errorHandler_1.createError)('Report not found', 404);
        }
        res.json({
            success: true,
            data: report
        });
    }
    catch (error) {
        next(error);
    }
});
router.post('/', async (req, res, next) => {
    try {
        const { targetId, executionId, type, format, title, customData } = req.body;
        if (!targetId || !type || !format) {
            throw (0, errorHandler_1.createError)('Target ID, type, and format are required', 400);
        }
        const target = await index_1.prisma.target.findUnique({
            where: { id: targetId }
        });
        if (!target) {
            throw (0, errorHandler_1.createError)('Target not found', 404);
        }
        if (executionId) {
            const execution = await index_1.prisma.execution.findUnique({
                where: { id: executionId }
            });
            if (!execution) {
                throw (0, errorHandler_1.createError)('Execution not found', 404);
            }
        }
        const report = await index_1.prisma.report.create({
            data: {
                targetId,
                executionId,
                type,
                title: title || `${type} Report for ${target.domain}`,
                content: '',
                format
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
        logger_1.logger.info(`Created new report: ${report.title}`);
        await (0, queue_1.addReportJob)(queue_1.JOB_TYPES.REPORT.GENERATE, {
            reportId: report.id,
            targetId,
            executionId,
            type,
            format,
            customData
        }, {
            jobId: `report-${report.id}`
        });
        res.status(201).json({
            success: true,
            data: report
        });
    }
    catch (error) {
        next(error);
    }
});
router.get('/:id/download', async (req, res, next) => {
    try {
        const { id } = req.params;
        const report = await index_1.prisma.report.findUnique({
            where: { id }
        });
        if (!report) {
            throw (0, errorHandler_1.createError)('Report not found', 404);
        }
        if (!report.path) {
            throw (0, errorHandler_1.createError)('Report file not available', 404);
        }
        const fileName = `${report.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${report.format.toLowerCase()}`;
        res.download(report.path, fileName, (err) => {
            if (err) {
                logger_1.logger.error(`Error downloading report ${id}:`, err);
            }
        });
    }
    catch (error) {
        next(error);
    }
});
router.delete('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const report = await index_1.prisma.report.findUnique({
            where: { id }
        });
        if (!report) {
            throw (0, errorHandler_1.createError)('Report not found', 404);
        }
        if (report.path) {
            const fs = require('fs');
            const path = require('path');
            const filePath = path.resolve(report.path);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
        await index_1.prisma.report.delete({
            where: { id }
        });
        logger_1.logger.info(`Deleted report: ${report.title}`);
        res.json({
            success: true,
            message: 'Report deleted successfully'
        });
    }
    catch (error) {
        next(error);
    }
});
router.get('/:id/content', async (req, res, next) => {
    try {
        const { id } = req.params;
        const report = await index_1.prisma.report.findUnique({
            where: { id }
        });
        if (!report) {
            throw (0, errorHandler_1.createError)('Report not found', 404);
        }
        if (!['HTML', 'JSON', 'MARKDOWN'].includes(report.format)) {
            throw (0, errorHandler_1.createError)('Report content not available for this format', 400);
        }
        res.json({
            success: true,
            data: {
                report,
                content: report.content
            }
        });
    }
    catch (error) {
        next(error);
    }
});
router.get('/type/:type', async (req, res, next) => {
    try {
        const { type } = req.params;
        const { page = 1, limit = 10, targetId } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const take = Number(limit);
        const where = { type };
        if (targetId) {
            where.targetId = targetId;
        }
        const [reports, total] = await Promise.all([
            index_1.prisma.report.findMany({
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
                    }
                }
            }),
            index_1.prisma.report.count({ where })
        ]);
        res.json({
            success: true,
            data: reports,
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
router.get('/stats/overview', async (req, res, next) => {
    try {
        const { targetId } = req.query;
        const where = {};
        if (targetId) {
            where.targetId = targetId;
        }
        const [totalReports, executionReports, vulnerabilityReports, artifactReports, customReports, htmlReports, jsonReports, pdfReports, csvReports] = await Promise.all([
            index_1.prisma.report.count({ where }),
            index_1.prisma.report.count({ where: { ...where, type: 'EXECUTION_SUMMARY' } }),
            index_1.prisma.report.count({ where: { ...where, type: 'VULNERABILITY_REPORT' } }),
            index_1.prisma.report.count({ where: { ...where, type: 'ARTIFACT_SUMMARY' } }),
            index_1.prisma.report.count({ where: { ...where, type: 'CUSTOM' } }),
            index_1.prisma.report.count({ where: { ...where, format: 'HTML' } }),
            index_1.prisma.report.count({ where: { ...where, format: 'JSON' } }),
            index_1.prisma.report.count({ where: { ...where, format: 'PDF' } }),
            index_1.prisma.report.count({ where: { ...where, format: 'CSV' } })
        ]);
        const stats = {
            total: totalReports,
            byType: {
                execution: executionReports,
                vulnerability: vulnerabilityReports,
                artifact: artifactReports,
                custom: customReports
            },
            byFormat: {
                html: htmlReports,
                json: jsonReports,
                pdf: pdfReports,
                csv: csvReports
            }
        };
        res.json({
            success: true,
            data: stats
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=reports.js.map