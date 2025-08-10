import express from 'express';
import { prisma } from '../index';
import { logger } from '../utils/logger';
import { createError } from '../middleware/errorHandler';

const router = express.Router();

// Get all artifacts
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 50, targetId, executionId, type } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = {};
    if (targetId) where.targetId = targetId;
    if (executionId) where.executionId = executionId;
    if (type) where.type = type;

    const [artifacts, total] = await Promise.all([
      prisma.artifact.findMany({
        where,
        skip,
        take: parseInt(limit as string),
        orderBy: { createdAt: 'desc' },
        include: {
          target: {
            select: { id: true, domain: true }
          }
        }
      }),
      prisma.artifact.count({ where })
    ]);

    res.json({
      artifacts,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string))
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get artifact by ID
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const artifact = await prisma.artifact.findUnique({
      where: { id },
      include: {
        target: {
          select: { id: true, domain: true }
        }
      }
    });

    if (!artifact) {
      throw createError('Artifact not found', 404);
    }

    res.json(artifact);
  } catch (error) {
    next(error);
  }
});

// Delete artifact
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const artifact = await prisma.artifact.delete({
      where: { id }
    });

    logger.info(`Deleted artifact: ${artifact.name}`);
    res.json({ message: 'Artifact deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;