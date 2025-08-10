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
        const { page = 1, limit = 50, targetId, executionId, type } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const where = {};
        if (targetId)
            where.targetId = targetId;
        if (executionId)
            where.executionId = executionId;
        if (type)
            where.type = type;
        const [artifacts, total] = await Promise.all([
            index_1.prisma.artifact.findMany({
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
            index_1.prisma.artifact.count({ where })
        ]);
        res.json({
            artifacts,
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
        const artifact = await index_1.prisma.artifact.findUnique({
            where: { id },
            include: {
                target: {
                    select: { id: true, domain: true }
                }
            }
        });
        if (!artifact) {
            throw (0, errorHandler_1.createError)('Artifact not found', 404);
        }
        res.json(artifact);
    }
    catch (error) {
        next(error);
    }
});
router.delete('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const artifact = await index_1.prisma.artifact.delete({
            where: { id }
        });
        logger_1.logger.info(`Deleted artifact: ${artifact.name}`);
        res.json({ message: 'Artifact deleted successfully' });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=artifacts.js.map