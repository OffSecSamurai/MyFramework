import { Router } from 'express';
import { prisma } from '../index';
import { logger } from '../utils/logger';
import { createError } from '../middleware/errorHandler';
import { emitTargetUpdate } from '../services/websocket';

const router = Router();

// Get all targets
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, search } = req.query;
    
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where: any = {};
    
    if (status) {
      where.status = status;
    }
    
    if (search) {
      where.OR = [
        { domain: { contains: search as string, mode: 'insensitive' } },
        { name: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    const [targets, total] = await Promise.all([
      prisma.target.findMany({
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
      prisma.target.count({ where })
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
      throw createError('Target not found', 404);
    }

    res.json({
      success: true,
      data: target
    });
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

    // Validate domain format
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    if (!domainRegex.test(domain)) {
      throw createError('Invalid domain format', 400);
    }

    // Check if target already exists
    const existingTarget = await prisma.target.findUnique({
      where: { domain }
    });

    if (existingTarget) {
      throw createError('Target with this domain already exists', 409);
    }

    const target = await prisma.target.create({
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

    logger.info(`Created new target: ${domain}`);

    // Emit WebSocket update
    emitTargetUpdate(target.id, {
      type: 'target-created',
      target
    });

    res.status(201).json({
      success: true,
      data: target
    });
  } catch (error) {
    next(error);
  }
});

// Update target
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, scope, status } = req.body;

    const target = await prisma.target.findUnique({
      where: { id }
    });

    if (!target) {
      throw createError('Target not found', 404);
    }

    const updatedTarget = await prisma.target.update({
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

    logger.info(`Updated target: ${target.domain}`);

    // Emit WebSocket update
    emitTargetUpdate(id, {
      type: 'target-updated',
      target: updatedTarget
    });

    res.json({
      success: true,
      data: updatedTarget
    });
  } catch (error) {
    next(error);
  }
});

// Delete target
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const target = await prisma.target.findUnique({
      where: { id }
    });

    if (!target) {
      throw createError('Target not found', 404);
    }

    // Check if target has active executions
    const activeExecutions = await prisma.execution.findFirst({
      where: {
        targetId: id,
        status: { in: ['PENDING', 'RUNNING'] }
      }
    });

    if (activeExecutions) {
      throw createError('Cannot delete target with active executions', 400);
    }

    await prisma.target.delete({
      where: { id }
    });

    logger.info(`Deleted target: ${target.domain}`);

    // Emit WebSocket update
    emitTargetUpdate(id, {
      type: 'target-deleted',
      targetId: id
    });

    res.json({
      success: true,
      message: 'Target deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Get target statistics
router.get('/:id/stats', async (req, res, next) => {
  try {
    const { id } = req.params;

    const target = await prisma.target.findUnique({
      where: { id }
    });

    if (!target) {
      throw createError('Target not found', 404);
    }

    const [
      totalExecutions,
      completedExecutions,
      failedExecutions,
      totalVulnerabilities,
      criticalVulnerabilities,
      highVulnerabilities,
      totalArtifacts
    ] = await Promise.all([
      prisma.execution.count({ where: { targetId: id } }),
      prisma.execution.count({ 
        where: { 
          targetId: id, 
          status: 'COMPLETED' 
        } 
      }),
      prisma.execution.count({ 
        where: { 
          targetId: id, 
          status: 'FAILED' 
        } 
      }),
      prisma.vulnerability.count({ where: { targetId: id } }),
      prisma.vulnerability.count({ 
        where: { 
          targetId: id, 
          severity: 'CRITICAL' 
        } 
      }),
      prisma.vulnerability.count({ 
        where: { 
          targetId: id, 
          severity: 'HIGH' 
        } 
      }),
      prisma.artifact.count({ where: { targetId: id } })
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
      lastExecution: await prisma.execution.findFirst({
        where: { targetId: id },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true, status: true }
      })
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
});

export default router;