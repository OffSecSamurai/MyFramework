import { Router } from 'express';
import { prisma } from '../index';
import { logger } from '../utils/logger';
import { createError } from '../middleware/errorHandler';
import { emitExecutionUpdate, emitProgressUpdate } from '../services/websocket';
import { addExecutionJob, JOB_TYPES } from '../services/queue';

const router = Router();

// Get all executions
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, targetId, mode } = req.query;
    
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where: any = {};
    
    if (status) {
      where.status = status;
    }
    
    if (targetId) {
      where.targetId = targetId;
    }
    
    if (mode) {
      where.mode = mode;
    }

    const [executions, total] = await Promise.all([
      prisma.execution.findMany({
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
          tasks: {
            orderBy: { createdAt: 'desc' },
            take: 5
          },
          _count: {
            select: {
              tasks: true,
              artifacts: true
            }
          }
        }
      }),
      prisma.execution.count({ where })
    ]);

    res.json({
      success: true,
      data: executions,
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

// Get execution by ID
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const execution = await prisma.execution.findUnique({
      where: { id },
      include: {
        target: {
          select: {
            id: true,
            domain: true,
            name: true,
            description: true
          }
        },
        tasks: {
          orderBy: { createdAt: 'asc' }
        },
        artifacts: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!execution) {
      throw createError('Execution not found', 404);
    }

    res.json({
      success: true,
      data: execution
    });
  } catch (error) {
    next(error);
  }
});

// Create new execution
router.post('/', async (req, res, next) => {
  try {
    const { targetId, mode, tools, metadata } = req.body;

    if (!targetId || !mode || !tools) {
      throw createError('Target ID, mode, and tools are required', 400);
    }

    // Validate target exists
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
        status: { in: ['PENDING', 'RUNNING'] }
      }
    });

    if (activeExecution) {
      throw createError('Target already has an active execution', 409);
    }

    // Create execution
    const execution = await prisma.execution.create({
      data: {
        targetId,
        mode,
        tools: JSON.stringify(tools),
        metadata: metadata ? JSON.stringify(metadata) : null
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

    logger.info(`Created new execution for target: ${target.domain}`);

    // Add execution job to queue
    await addExecutionJob(JOB_TYPES.EXECUTION.START, {
      executionId: execution.id,
      targetId,
      mode,
      tools,
      metadata
    }, {
      jobId: `execution-${execution.id}`
    });

    // Emit WebSocket update
    emitExecutionUpdate(execution.id, {
      type: 'execution-created',
      execution
    });

    res.status(201).json({
      success: true,
      data: execution
    });
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

    const updatedExecution = await prisma.execution.update({
      where: { id },
      data: { status: 'PAUSED' }
    });

    // Add pause job to queue
    await addExecutionJob(JOB_TYPES.EXECUTION.PAUSE, {
      executionId: id
    });

    logger.info(`Paused execution: ${id}`);

    // Emit WebSocket update
    emitExecutionUpdate(id, {
      type: 'execution-paused',
      execution: updatedExecution
    });

    res.json({
      success: true,
      data: updatedExecution
    });
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

    const updatedExecution = await prisma.execution.update({
      where: { id },
      data: { status: 'RUNNING' }
    });

    // Add resume job to queue
    await addExecutionJob(JOB_TYPES.EXECUTION.RESUME, {
      executionId: id
    });

    logger.info(`Resumed execution: ${id}`);

    // Emit WebSocket update
    emitExecutionUpdate(id, {
      type: 'execution-resumed',
      execution: updatedExecution
    });

    res.json({
      success: true,
      data: updatedExecution
    });
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

    if (!['PENDING', 'RUNNING', 'PAUSED'].includes(execution.status)) {
      throw createError('Execution cannot be stopped', 400);
    }

    const updatedExecution = await prisma.execution.update({
      where: { id },
      data: { 
        status: 'CANCELLED',
        completedAt: new Date()
      }
    });

    // Add stop job to queue
    await addExecutionJob(JOB_TYPES.EXECUTION.STOP, {
      executionId: id
    });

    logger.info(`Stopped execution: ${id}`);

    // Emit WebSocket update
    emitExecutionUpdate(id, {
      type: 'execution-stopped',
      execution: updatedExecution
    });

    res.json({
      success: true,
      data: updatedExecution
    });
  } catch (error) {
    next(error);
  }
});

// Get execution logs
router.get('/:id/logs', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const execution = await prisma.execution.findUnique({
      where: { id }
    });

    if (!execution) {
      throw createError('Execution not found', 404);
    }

    // Get tasks with their outputs (logs)
    const tasks = await prisma.task.findMany({
      where: { executionId: id },
      select: {
        id: true,
        tool: true,
        status: true,
        output: true,
        error: true,
        startedAt: true,
        completedAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      data: {
        execution,
        tasks
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get execution progress
router.get('/:id/progress', async (req, res, next) => {
  try {
    const { id } = req.params;

    const execution = await prisma.execution.findUnique({
      where: { id },
      include: {
        tasks: {
          select: {
            id: true,
            tool: true,
            status: true,
            progress: true
          }
        }
      }
    });

    if (!execution) {
      throw createError('Execution not found', 404);
    }

    const totalTasks = execution.tasks.length;
    const completedTasks = execution.tasks.filter(task => 
      ['COMPLETED', 'FAILED', 'SKIPPED'].includes(task.status)
    ).length;
    const runningTasks = execution.tasks.filter(task => 
      task.status === 'RUNNING'
    ).length;

    const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    res.json({
      success: true,
      data: {
        executionId: id,
        progress: Math.round(progress),
        totalTasks,
        completedTasks,
        runningTasks,
        tasks: execution.tasks
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;