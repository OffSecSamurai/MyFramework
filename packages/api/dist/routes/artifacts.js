"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_1 = require("../index");
const logger_1 = require("../utils/logger");
const errorHandler_1 = require("../middleware/errorHandler");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const router = (0, express_1.Router)();
router.get('/', async (req, res, next) => {
    try {
        const { page = 1, limit = 20, targetId, executionId, type } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const take = Number(limit);
        const where = {};
        if (targetId) {
            where.targetId = targetId;
        }
        if (executionId) {
            where.executionId = executionId;
        }
        if (type) {
            where.type = type;
        }
        const [artifacts, total] = await Promise.all([
            index_1.prisma.artifact.findMany({
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
                    execution: {
                        select: {
                            id: true,
                            mode: true,
                            status: true
                        }
                    }
                }
            }),
            index_1.prisma.artifact.count({ where })
        ]);
        res.json({
            success: true,
            data: artifacts,
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
        const artifact = await index_1.prisma.artifact.findUnique({
            where: { id },
            include: {
                target: {
                    select: {
                        id: true,
                        domain: true,
                        name: true
                    }
                },
                execution: {
                    select: {
                        id: true,
                        mode: true,
                        status: true
                    }
                }
            }
        });
        if (!artifact) {
            throw (0, errorHandler_1.createError)('Artifact not found', 404);
        }
        res.json({
            success: true,
            data: artifact
        });
    }
    catch (error) {
        next(error);
    }
});
router.get('/:id/download', async (req, res, next) => {
    try {
        const { id } = req.params;
        const artifact = await index_1.prisma.artifact.findUnique({
            where: { id }
        });
        if (!artifact) {
            throw (0, errorHandler_1.createError)('Artifact not found', 404);
        }
        const filePath = path_1.default.resolve(artifact.path);
        if (!fs_1.default.existsSync(filePath)) {
            throw (0, errorHandler_1.createError)('Artifact file not found', 404);
        }
        const fileName = path_1.default.basename(filePath);
        res.download(filePath, fileName, (err) => {
            if (err) {
                logger_1.logger.error(`Error downloading artifact ${id}:`, err);
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
        const artifact = await index_1.prisma.artifact.findUnique({
            where: { id }
        });
        if (!artifact) {
            throw (0, errorHandler_1.createError)('Artifact not found', 404);
        }
        const filePath = path_1.default.resolve(artifact.path);
        if (fs_1.default.existsSync(filePath)) {
            fs_1.default.unlinkSync(filePath);
        }
        await index_1.prisma.artifact.delete({
            where: { id }
        });
        logger_1.logger.info(`Deleted artifact: ${artifact.name}`);
        res.json({
            success: true,
            message: 'Artifact deleted successfully'
        });
    }
    catch (error) {
        next(error);
    }
});
router.get('/:id/content', async (req, res, next) => {
    try {
        const { id } = req.params;
        const { encoding = 'utf8' } = req.query;
        const artifact = await index_1.prisma.artifact.findUnique({
            where: { id }
        });
        if (!artifact) {
            throw (0, errorHandler_1.createError)('Artifact not found', 404);
        }
        const filePath = path_1.default.resolve(artifact.path);
        if (!fs_1.default.existsSync(filePath)) {
            throw (0, errorHandler_1.createError)('Artifact file not found', 404);
        }
        const textExtensions = ['.txt', '.json', '.csv', '.log', '.md', '.html', '.xml', '.yaml', '.yml'];
        const ext = path_1.default.extname(filePath).toLowerCase();
        if (!textExtensions.includes(ext)) {
            throw (0, errorHandler_1.createError)('This artifact is not a text file', 400);
        }
        const content = fs_1.default.readFileSync(filePath, encoding);
        res.json({
            success: true,
            data: {
                artifact,
                content
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
        const { page = 1, limit = 20, targetId } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const take = Number(limit);
        const where = { type };
        if (targetId) {
            where.targetId = targetId;
        }
        const [artifacts, total] = await Promise.all([
            index_1.prisma.artifact.findMany({
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
            index_1.prisma.artifact.count({ where })
        ]);
        res.json({
            success: true,
            data: artifacts,
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
exports.default = router;
//# sourceMappingURL=artifacts.js.map