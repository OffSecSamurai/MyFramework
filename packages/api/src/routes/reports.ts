import express from 'express';
import { prisma } from '../index';
import { logger } from '../utils/logger';
import { addReportJob } from '../services/queue';
import { createError } from '../middleware/errorHandler';

const router = express.Router();

// Get all reports
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 50, targetId, type, format } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = {};
    if (targetId) where.targetId = targetId;
    if (type) where.type = type;
    if (format) where.format = format;

    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        where,
        skip,
        take: parseInt(limit as string),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.report.count({ where })
    ]);

    res.json({
      reports,
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

// Get report by ID
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const report = await prisma.report.findUnique({
      where: { id }
    });

    if (!report) {
      throw createError('Report not found', 404);
    }

    res.json(report);
  } catch (error) {
    next(error);
  }
});

// Create new report
router.post('/', async (req, res, next) => {
  try {
    const { targetId, executionId, type, format, customData } = req.body;

    if (!targetId || !type || !format) {
      throw createError('Target ID, type, and format are required', 400);
    }

    // Check if target exists
    const target = await prisma.target.findUnique({
      where: { id: targetId }
    });

    if (!target) {
      throw createError('Target not found', 404);
    }

    // Create report record
    const report = await prisma.report.create({
      data: {
        targetId,
        executionId,
        type,
        format,
        content: null,
        path: null
      }
    });

    // Add report generation job to queue
    await addReportJob('generate-report', {
      reportId: report.id,
      targetId,
      executionId,
      type,
      format,
      customData
    });

    logger.info(`Created new report: ${report.id} for target: ${target.domain}`);

    res.status(201).json(report);
  } catch (error) {
    next(error);
  }
});

// Delete report
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const report = await prisma.report.delete({
      where: { id }
    });

    logger.info(`Deleted report: ${report.id}`);
    res.json({ message: 'Report deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;