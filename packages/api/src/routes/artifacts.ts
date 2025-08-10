import { Router } from 'express';
import { prisma } from '../index';
import { logger } from '../utils/logger';
import { createError } from '../middleware/errorHandler';
import path from 'path';
import fs from 'fs';

const router = Router();

// Get all artifacts
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, targetId, executionId, type } = req.query;
    
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where: any = {};
    
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
      prisma.artifact.findMany({
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
      prisma.artifact.count({ where })
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
      throw createError('Artifact not found', 404);
    }

    res.json({
      success: true,
      data: artifact
    });
  } catch (error) {
    next(error);
  }
});

// Download artifact file
router.get('/:id/download', async (req, res, next) => {
  try {
    const { id } = req.params;

    const artifact = await prisma.artifact.findUnique({
      where: { id }
    });

    if (!artifact) {
      throw createError('Artifact not found', 404);
    }

    const filePath = path.resolve(artifact.path);
    
    if (!fs.existsSync(filePath)) {
      throw createError('Artifact file not found', 404);
    }

    const fileName = path.basename(filePath);
    
    res.download(filePath, fileName, (err) => {
      if (err) {
        logger.error(`Error downloading artifact ${id}:`, err);
      }
    });
  } catch (error) {
    next(error);
  }
});

// Delete artifact
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const artifact = await prisma.artifact.findUnique({
      where: { id }
    });

    if (!artifact) {
      throw createError('Artifact not found', 404);
    }

    // Delete file if it exists
    const filePath = path.resolve(artifact.path);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await prisma.artifact.delete({
      where: { id }
    });

    logger.info(`Deleted artifact: ${artifact.name}`);

    res.json({
      success: true,
      message: 'Artifact deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Get artifact content (for text files)
router.get('/:id/content', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { encoding = 'utf8' } = req.query;

    const artifact = await prisma.artifact.findUnique({
      where: { id }
    });

    if (!artifact) {
      throw createError('Artifact not found', 404);
    }

    const filePath = path.resolve(artifact.path);
    
    if (!fs.existsSync(filePath)) {
      throw createError('Artifact file not found', 404);
    }

    // Check if it's a text file
    const textExtensions = ['.txt', '.json', '.csv', '.log', '.md', '.html', '.xml', '.yaml', '.yml'];
    const ext = path.extname(filePath).toLowerCase();
    
    if (!textExtensions.includes(ext)) {
      throw createError('This artifact is not a text file', 400);
    }

    const content = fs.readFileSync(filePath, encoding as BufferEncoding);

    res.json({
      success: true,
      data: {
        artifact,
        content
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get artifacts by type
router.get('/type/:type', async (req, res, next) => {
  try {
    const { type } = req.params;
    const { page = 1, limit = 20, targetId } = req.query;
    
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where: any = { type };
    
    if (targetId) {
      where.targetId = targetId;
    }

    const [artifacts, total] = await Promise.all([
      prisma.artifact.findMany({
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
      prisma.artifact.count({ where })
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
  } catch (error) {
    next(error);
  }
});

export default router;