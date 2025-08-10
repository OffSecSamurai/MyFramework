"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_1 = require("../index");
const logger_1 = require("../utils/logger");
const errorHandler_1 = require("../middleware/errorHandler");
const router = (0, express_1.Router)();
router.get('/', async (req, res, next) => {
    try {
        const { page = 1, limit = 20, targetId, severity, status, tool } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const take = Number(limit);
        const where = {};
        if (targetId) {
            where.targetId = targetId;
        }
        if (severity) {
            where.severity = severity;
        }
        if (status) {
            where.status = status;
        }
        if (tool) {
            where.tool = tool;
        }
        const [vulnerabilities, total] = await Promise.all([
            index_1.prisma.vulnerability.findMany({
                where,
                skip,
                take,
                orderBy: [
                    { severity: 'desc' },
                    { createdAt: 'desc' }
                ],
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
            index_1.prisma.vulnerability.count({ where })
        ]);
        res.json({
            success: true,
            data: vulnerabilities,
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
        const vulnerability = await index_1.prisma.vulnerability.findUnique({
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
        if (!vulnerability) {
            throw (0, errorHandler_1.createError)('Vulnerability not found', 404);
        }
        res.json({
            success: true,
            data: vulnerability
        });
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
        const vulnerability = await index_1.prisma.vulnerability.findUnique({
            where: { id }
        });
        if (!vulnerability) {
            throw (0, errorHandler_1.createError)('Vulnerability not found', 404);
        }
        const updatedVulnerability = await index_1.prisma.vulnerability.update({
            where: { id },
            data: { status },
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
        logger_1.logger.info(`Updated vulnerability status: ${id} -> ${status}`);
        res.json({
            success: true,
            data: updatedVulnerability
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
        const [totalVulnerabilities, criticalVulnerabilities, highVulnerabilities, mediumVulnerabilities, lowVulnerabilities, infoVulnerabilities, openVulnerabilities, confirmedVulnerabilities, falsePositives, fixedVulnerabilities] = await Promise.all([
            index_1.prisma.vulnerability.count({ where }),
            index_1.prisma.vulnerability.count({ where: { ...where, severity: 'CRITICAL' } }),
            index_1.prisma.vulnerability.count({ where: { ...where, severity: 'HIGH' } }),
            index_1.prisma.vulnerability.count({ where: { ...where, severity: 'MEDIUM' } }),
            index_1.prisma.vulnerability.count({ where: { ...where, severity: 'LOW' } }),
            index_1.prisma.vulnerability.count({ where: { ...where, severity: 'INFO' } }),
            index_1.prisma.vulnerability.count({ where: { ...where, status: 'OPEN' } }),
            index_1.prisma.vulnerability.count({ where: { ...where, status: 'CONFIRMED' } }),
            index_1.prisma.vulnerability.count({ where: { ...where, status: 'FALSE_POSITIVE' } }),
            index_1.prisma.vulnerability.count({ where: { ...where, status: 'FIXED' } })
        ]);
        const stats = {
            total: totalVulnerabilities,
            bySeverity: {
                critical: criticalVulnerabilities,
                high: highVulnerabilities,
                medium: mediumVulnerabilities,
                low: lowVulnerabilities,
                info: infoVulnerabilities
            },
            byStatus: {
                open: openVulnerabilities,
                confirmed: confirmedVulnerabilities,
                falsePositive: falsePositives,
                fixed: fixedVulnerabilities
            },
            riskScore: calculateRiskScore({
                critical: criticalVulnerabilities,
                high: highVulnerabilities,
                medium: mediumVulnerabilities,
                low: lowVulnerabilities,
                info: infoVulnerabilities
            })
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
router.get('/severity/:severity', async (req, res, next) => {
    try {
        const { severity } = req.params;
        const { page = 1, limit = 20, targetId } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const take = Number(limit);
        const where = { severity };
        if (targetId) {
            where.targetId = targetId;
        }
        const [vulnerabilities, total] = await Promise.all([
            index_1.prisma.vulnerability.findMany({
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
            index_1.prisma.vulnerability.count({ where })
        ]);
        res.json({
            success: true,
            data: vulnerabilities,
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
router.get('/tool/:tool', async (req, res, next) => {
    try {
        const { tool } = req.params;
        const { page = 1, limit = 20, targetId } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const take = Number(limit);
        const where = { tool };
        if (targetId) {
            where.targetId = targetId;
        }
        const [vulnerabilities, total] = await Promise.all([
            index_1.prisma.vulnerability.findMany({
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
            index_1.prisma.vulnerability.count({ where })
        ]);
        res.json({
            success: true,
            data: vulnerabilities,
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
router.patch('/bulk/status', async (req, res, next) => {
    try {
        const { ids, status } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            throw (0, errorHandler_1.createError)('IDs array is required', 400);
        }
        if (!status) {
            throw (0, errorHandler_1.createError)('Status is required', 400);
        }
        const result = await index_1.prisma.vulnerability.updateMany({
            where: {
                id: { in: ids }
            },
            data: { status }
        });
        logger_1.logger.info(`Bulk updated ${result.count} vulnerabilities to status: ${status}`);
        res.json({
            success: true,
            data: {
                updatedCount: result.count
            }
        });
    }
    catch (error) {
        next(error);
    }
});
function calculateRiskScore(severities) {
    const weights = {
        critical: 10,
        high: 7,
        medium: 4,
        low: 2,
        info: 1
    };
    const score = Object.entries(severities).reduce((total, [severity, count]) => {
        return total + (count * weights[severity]);
    }, 0);
    return Math.min(100, Math.max(0, score));
}
exports.default = router;
//# sourceMappingURL=vulnerabilities.js.map