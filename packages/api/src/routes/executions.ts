import express from 'express';
import { prisma } from '../index';
import { logger } from '../utils/logger';
import { addExecutionJob } from '../services/queue';
import { emitExecutionUpdate } from '../services/websocket';
import { createError } from '../middleware/errorHandler';

const router = express.Router();

// Get all executions
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 50, status, targetId, mode } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = {};
    if (status) where.status = status;
    if (targetId) where.targetId = targetId;
    if (mode) where.mode = mode;

    const [executions, total] = await Promise.all([
      prisma.execution.findMany({
        where,
        skip,
        take: parseInt(limit as string),
        orderBy: { createdAt: 'desc' },
        include: {
          target: {
            select: { id: true, domain: true, name: true }
          }
        }
      }),
      prisma.execution.count({ where })
    ]);

    res.json({
      executions,
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

// Get execution by ID
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const execution = await prisma.execution.findUnique({
      where: { id },
      include: {
        target: true,
        tasks: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!execution) {
      throw createError('Execution not found', 404);
    }

    res.json(execution);
  } catch (error) {
    next(error);
  }
});

// Create new execution
router.post('/', async (req, res, next) => {
  try {
    const { targetId, mode, tools } = req.body;

    if (!targetId || !mode) {
      throw createError('Target ID and mode are required', 400);
    }

    // Check if target exists
    const target = await prisma.target.findUnique({
      where: { id: targetId }
    });

    if (!target) {
      throw createError('Target not found', 404);
    }

    // Check for active executions on the same target
    const activeExecution = await prisma.execution.findFirst({
      where: {
        targetId,
        status: { in: ['PENDING', 'RUNNING', 'PAUSED'] }
      }
    });

    if (activeExecution) {
      throw createError('Target already has an active execution', 409);
    }

    // Create execution record
    const execution = await prisma.execution.create({
      data: {
        targetId,
        mode,
        metadata: JSON.stringify({ tools })
      },
      include: {
        target: {
          select: { id: true, domain: true, name: true }
        }
      }
    });

    // Add execution job to queue
    await addExecutionJob('start-execution', {
      executionId: execution.id,
      targetId,
      mode,
      tools
    });

    logger.info(`Created new execution: ${execution.id} for target: ${target.domain}`);
    emitExecutionUpdate(execution.id, { type: 'execution-created', execution });

    res.status(201).json(execution);
  } catch (error) {
    next(error);
  }
});

// Pause execution
router.post('/:id/pause', async (req, res, next) => {
  try {
    const { id } = req.params;

    const execution = await prisma.execution.findUnique({
      where: { id }
    });

    if (!execution) {
      throw createError('Execution not found', 404);
    }

    if (execution.status !== 'RUNNING') {
      throw createError('Execution is not running', 400);
    }

    await prisma.execution.update({
      where: { id },
      data: { status: 'PAUSED' }
    });

    emitExecutionUpdate(id, { type: 'execution-paused', executionId: id });

    res.json({ message: 'Execution paused successfully' });
  } catch (error) {
    next(error);
  }
});

// Resume execution
router.post('/:id/resume', async (req, res, next) => {
  try {
    const { id } = req.params;

    const execution = await prisma.execution.findUnique({
      where: { id }
    });

    if (!execution) {
      throw createError('Execution not found', 404);
    }

    if (execution.status !== 'PAUSED') {
      throw createError('Execution is not paused', 400);
    }

    await prisma.execution.update({
      where: { id },
      data: { status: 'RUNNING' }
    });

    emitExecutionUpdate(id, { type: 'execution-resumed', executionId: id });

    res.json({ message: 'Execution resumed successfully' });
  } catch (error) {
    next(error);
  }
});

// Stop execution
router.post('/:id/stop', async (req, res, next) => {
  try {
    const { id } = req.params;

    const execution = await prisma.execution.findUnique({
      where: { id }
    });

    if (!execution) {
      throw createError('Execution not found', 404);
    }

    if (!['RUNNING', 'PAUSED'].includes(execution.status)) {
      throw createError('Execution is not active', 400);
    }

    await prisma.execution.update({
      where: { id },
      data: { 
        status: 'CANCELLED',
        completedAt: new Date()
      }
    });

    emitExecutionUpdate(id, { type: 'execution-stopped', executionId: id });

    res.json({ message: 'Execution stopped successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;