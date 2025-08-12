import express from 'express';
import { prisma } from '../index';
import { logger } from '../utils/logger';
import { emitTargetUpdate } from '../services/websocket';
import { createError } from '../middleware/errorHandler';

const router = express.Router();

// Get all targets
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 50, status, search } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { domain: { contains: search as string, mode: 'insensitive' } },
        { name: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    const [targets, total] = await Promise.all([
      prisma.target.findMany({
        where,
        skip,
        take: parseInt(limit as string),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.target.count({ where })
    ]);

    res.json({
      targets,
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

// Get target by ID
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const target = await prisma.target.findUnique({
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
      throw createError('Target not found', 404);
    }

    res.json(target);
  } catch (error) {
    next(error);
  }
});

// Create new target
router.post('/', async (req, res, next) => {
  try {
    const { domain, name, description, scope } = req.body;

    if (!domain) {
      throw createError('Domain is required', 400);
    }

    // Check if target already exists
    const existingTarget = await prisma.target.findUnique({
      where: { domain }
    });

    if (existingTarget) {
      throw createError('Target already exists', 409);
    }

    const target = await prisma.target.create({
      data: {
        domain,
        name,
        description,
        scope: scope ? JSON.stringify(scope) : null
      }
    });

    logger.info(`Created new target: ${target.domain}`);
    emitTargetUpdate('target-created', target);

    res.status(201).json(target);
  } catch (error) {
    next(error);
  }
});

// Update target
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, scope, status } = req.body;

    const target = await prisma.target.update({
      where: { id },
      data: {
        name,
        description,
        scope: scope ? JSON.stringify(scope) : undefined,
        status
      }
    });

    logger.info(`Updated target: ${target.domain}`);
    emitTargetUpdate('target-updated', target);

    res.json(target);
  } catch (error) {
    next(error);
  }
});

// Delete target
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if target has active executions
    const activeExecutions = await prisma.execution.findFirst({
      where: {
        targetId: id,
        status: { in: ['PENDING', 'RUNNING', 'PAUSED'] }
      }
    });

    if (activeExecutions) {
      throw createError('Cannot delete target with active executions', 400);
    }

    const target = await prisma.target.delete({
      where: { id }
    });

    logger.info(`Deleted target: ${target.domain}`);
    emitTargetUpdate('target-deleted', { id });

    res.json({ message: 'Target deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Get target statistics
router.get('/:id/stats', async (req, res, next) => {
  try {
    const { id } = req.params;

    const [executions, vulnerabilities, artifacts] = await Promise.all([
      prisma.execution.count({ where: { targetId: id } }),
      prisma.vulnerability.count({ where: { targetId: id } }),
      prisma.artifact.count({ where: { targetId: id } })
    ]);

    const criticalVulns = await prisma.vulnerability.count({
      where: { targetId: id, severity: 'CRITICAL' }
    });

    const highVulns = await prisma.vulnerability.count({
      where: { targetId: id, severity: 'HIGH' }
    });

    res.json({
      executions,
      vulnerabilities,
      artifacts,
      criticalVulns,
      highVulns
    });
  } catch (error) {
    next(error);
  }
});

export default router;