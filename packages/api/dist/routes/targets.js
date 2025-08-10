"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_1 = require("../index");
const logger_1 = require("../utils/logger");
const errorHandler_1 = require("../middleware/errorHandler");
const websocket_1 = require("../services/websocket");
const fs_extra_1 = __importDefault(require("fs-extra"));
const router = (0, express_1.Router)();
router.get('/', async (req, res, next) => {
    try {
        const { page = 1, limit = 10, status, search } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const take = Number(limit);
        const where = {};
        if (status) {
            where.status = status;
        }
        if (search) {
            where.OR = [
                { domain: { contains: search, mode: 'insensitive' } },
                { name: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } }
            ];
        }
        const [targets, total] = await Promise.all([
            index_1.prisma.target.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: 'desc' },
                include: {
                    _count: {
                        select: {
                            executions: true,
                            artifacts: true
                        }
                    }
                }
            }),
            index_1.prisma.target.count({ where })
        ]);
        res.json({
            success: true,
            data: targets,
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
        const target = await index_1.prisma.target.findUnique({
            where: { id },
            include: {
                executions: {
                    orderBy: { createdAt: 'desc' },
                    take: 10
                },
                artifacts: {
                    orderBy: { createdAt: 'desc' },
                    take: 20
                },
                _count: {
                    select: {
                        executions: true,
                        artifacts: true
                    }
                }
            }
        });
        if (!target) {
            throw (0, errorHandler_1.createError)('Target not found', 404);
        }
        res.json({
            success: true,
            data: target
        });
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
        const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
        if (!domainRegex.test(domain)) {
            throw (0, errorHandler_1.createError)('Invalid domain format', 400);
        }
        const existingTarget = await index_1.prisma.target.findUnique({
            where: { domain }
        });
        if (existingTarget) {
            throw (0, errorHandler_1.createError)('Target with this domain already exists', 409);
        }
        const target = await index_1.prisma.target.create({
            data: {
                domain,
                name,
                description,
                scope: scope ? JSON.stringify(scope) : null
            },
            include: {
                _count: {
                    select: {
                        executions: true,
                        artifacts: true
                    }
                }
            }
        });
        logger_1.logger.info(`Created new target: ${domain}`);
        (0, websocket_1.emitTargetUpdate)(target.id, {
            type: 'target-created',
            target
        });
        res.status(201).json({
            success: true,
            data: target
        });
    }
    catch (error) {
        next(error);
    }
});
router.put('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, description, scope, status } = req.body;
        const target = await index_1.prisma.target.findUnique({
            where: { id }
        });
        if (!target) {
            throw (0, errorHandler_1.createError)('Target not found', 404);
        }
        const updatedTarget = await index_1.prisma.target.update({
            where: { id },
            data: {
                name,
                description,
                scope: scope ? JSON.stringify(scope) : target.scope,
                status
            },
            include: {
                _count: {
                    select: {
                        executions: true,
                        artifacts: true
                    }
                }
            }
        });
        logger_1.logger.info(`Updated target: ${target.domain}`);
        (0, websocket_1.emitTargetUpdate)(id, {
            type: 'target-updated',
            target: updatedTarget
        });
        res.json({
            success: true,
            data: updatedTarget
        });
    }
    catch (error) {
        next(error);
    }
});
router.delete('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const target = await index_1.prisma.target.findUnique({
            where: { id }
        });
        if (!target) {
            throw (0, errorHandler_1.createError)('Target not found', 404);
        }
        const activeExecutions = await index_1.prisma.execution.findFirst({
            where: {
                targetId: id,
                status: { in: ['PENDING', 'RUNNING'] }
            }
        });
        if (activeExecutions) {
            throw (0, errorHandler_1.createError)('Cannot delete target with active executions', 400);
        }
        await index_1.prisma.target.delete({
            where: { id }
        });
        logger_1.logger.info(`Deleted target: ${target.domain}`);
        (0, websocket_1.emitTargetUpdate)(id, {
            type: 'target-deleted',
            targetId: id
        });
        res.json({
            success: true,
            message: 'Target deleted successfully'
        });
    }
    catch (error) {
        next(error);
    }
});
router.get('/:id/stats', async (req, res, next) => {
    try {
        const { id } = req.params;
        const target = await index_1.prisma.target.findUnique({
            where: { id }
        });
        if (!target) {
            throw (0, errorHandler_1.createError)('Target not found', 404);
        }
        const [totalExecutions, completedExecutions, failedExecutions, totalVulnerabilities, criticalVulnerabilities, highVulnerabilities, totalArtifacts] = await Promise.all([
            index_1.prisma.execution.count({ where: { targetId: id } }),
            index_1.prisma.execution.count({
                where: {
                    targetId: id,
                    status: 'COMPLETED'
                }
            }),
            index_1.prisma.execution.count({
                where: {
                    targetId: id,
                    status: 'FAILED'
                }
            }),
            index_1.prisma.vulnerability.count({ where: { targetId: id } }),
            index_1.prisma.vulnerability.count({
                where: {
                    targetId: id,
                    severity: 'CRITICAL'
                }
            }),
            index_1.prisma.vulnerability.count({
                where: {
                    targetId: id,
                    severity: 'HIGH'
                }
            }),
            index_1.prisma.artifact.count({ where: { targetId: id } })
        ]);
        const stats = {
            totalExecutions,
            completedExecutions,
            failedExecutions,
            successRate: totalExecutions > 0 ? (completedExecutions / totalExecutions) * 100 : 0,
            totalVulnerabilities,
            criticalVulnerabilities,
            highVulnerabilities,
            totalArtifacts,
            lastExecution: await index_1.prisma.execution.findFirst({
                where: { targetId: id },
                orderBy: { createdAt: 'desc' },
                select: { createdAt: true, status: true }
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
router.get('/:id/processed-data', async (req, res, next) => {
    try {
        const { id } = req.params;
        const target = await index_1.prisma.target.findUnique({
            where: { id }
        });
        if (!target) {
            throw (0, errorHandler_1.createError)('Target not found', 404);
        }
        const [subdomains, liveHosts, liveUrls, vulnerabilities, artifacts] = await Promise.all([
            index_1.prisma.artifact.findMany({
                where: { targetId: id, type: 'SUBDOMAIN_LIST' },
                orderBy: { createdAt: 'desc' }
            }),
            index_1.prisma.artifact.findMany({
                where: { targetId: id, type: 'LIVE_HOSTS' },
                orderBy: { createdAt: 'desc' }
            }),
            index_1.prisma.artifact.findMany({
                where: { targetId: id, type: 'LIVE_URLS' },
                orderBy: { createdAt: 'desc' }
            }),
            index_1.prisma.vulnerability.findMany({
                where: { targetId: id },
                orderBy: { createdAt: 'desc' }
            }),
            index_1.prisma.artifact.findMany({
                where: { targetId: id },
                orderBy: { createdAt: 'desc' }
            })
        ]);
        const processedData = {
            subdomains: await extractSubdomainData(subdomains),
            liveHosts: await extractLiveHostData(liveHosts),
            liveUrls: await extractLiveUrlData(liveUrls),
            vulnerabilities,
            artifacts,
            statistics: {
                totalSubdomains: subdomains.length,
                uniqueSubdomains: new Set(await extractSubdomainData(subdomains)).size,
                liveHosts: liveHosts.length,
                liveUrls: liveUrls.length,
                vulnerabilities: vulnerabilities.length,
                criticalVulns: vulnerabilities.filter(v => v.severity === 'CRITICAL').length,
                highVulns: vulnerabilities.filter(v => v.severity === 'HIGH').length,
                mediumVulns: vulnerabilities.filter(v => v.severity === 'MEDIUM').length,
                lowVulns: vulnerabilities.filter(v => v.severity === 'LOW').length
            }
        };
        res.json({
            success: true,
            data: processedData
        });
    }
    catch (error) {
        next(error);
    }
});
router.get('/:id/download/:type', async (req, res, next) => {
    try {
        const { id, type } = req.params;
        const target = await index_1.prisma.target.findUnique({
            where: { id }
        });
        if (!target) {
            throw (0, errorHandler_1.createError)('Target not found', 404);
        }
        let data = {};
        switch (type) {
            case 'subdomains':
                const subdomains = await index_1.prisma.artifact.findMany({
                    where: { targetId: id, type: 'SUBDOMAIN_LIST' }
                });
                data = await extractSubdomainData(subdomains);
                break;
            case 'hosts':
                const hosts = await index_1.prisma.artifact.findMany({
                    where: { targetId: id, type: 'LIVE_HOSTS' }
                });
                data = await extractLiveHostData(hosts);
                break;
            case 'urls':
                const urls = await index_1.prisma.artifact.findMany({
                    where: { targetId: id, type: 'LIVE_URLS' }
                });
                data = await extractLiveUrlData(urls);
                break;
            case 'vulnerabilities':
                data = await index_1.prisma.vulnerability.findMany({
                    where: { targetId: id }
                });
                break;
            case 'artifacts':
                data = await index_1.prisma.artifact.findMany({
                    where: { targetId: id }
                });
                break;
            case 'all':
                const [subdomainsAll, hostsAll, urlsAll, vulnsAll, artifactsAll] = await Promise.all([
                    index_1.prisma.artifact.findMany({ where: { targetId: id, type: 'SUBDOMAIN_LIST' } }),
                    index_1.prisma.artifact.findMany({ where: { targetId: id, type: 'LIVE_HOSTS' } }),
                    index_1.prisma.artifact.findMany({ where: { targetId: id, type: 'LIVE_URLS' } }),
                    index_1.prisma.vulnerability.findMany({ where: { targetId: id } }),
                    index_1.prisma.artifact.findMany({ where: { targetId: id } })
                ]);
                data = {
                    subdomains: await extractSubdomainData(subdomainsAll),
                    liveHosts: await extractLiveHostData(hostsAll),
                    liveUrls: await extractLiveUrlData(urlsAll),
                    vulnerabilities: vulnsAll,
                    artifacts: artifactsAll
                };
                break;
            default:
                throw (0, errorHandler_1.createError)('Invalid data type', 400);
        }
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${type}_${target.domain}.json"`);
        res.json(data);
    }
    catch (error) {
        next(error);
    }
});
async function extractSubdomainData(artifacts) {
    const subdomains = [];
    for (const artifact of artifacts) {
        try {
            const content = await fs_extra_1.default.readFile(artifact.path, 'utf-8');
            const lines = content.split('\n').filter(line => line.trim());
            subdomains.push(...lines);
        }
        catch (error) {
            logger_1.logger.warn(`Failed to read artifact ${artifact.id}:`, error);
        }
    }
    return [...new Set(subdomains)];
}
async function extractLiveHostData(artifacts) {
    const hosts = [];
    for (const artifact of artifacts) {
        try {
            const content = await fs_extra_1.default.readFile(artifact.path, 'utf-8');
            const lines = content.split('\n').filter(line => line.trim());
            hosts.push(...lines);
        }
        catch (error) {
            logger_1.logger.warn(`Failed to read artifact ${artifact.id}:`, error);
        }
    }
    return [...new Set(hosts)];
}
async function extractLiveUrlData(artifacts) {
    const urls = [];
    for (const artifact of artifacts) {
        try {
            const content = await fs_extra_1.default.readFile(artifact.path, 'utf-8');
            const lines = content.split('\n').filter(line => line.trim());
            urls.push(...lines);
        }
        catch (error) {
            logger_1.logger.warn(`Failed to read artifact ${artifact.id}:`, error);
        }
    }
    return [...new Set(urls)];
}
exports.default = router;
//# sourceMappingURL=targets.js.map