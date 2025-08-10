import { Router } from 'express';
import { prisma } from '../index';
import { logger } from '../utils/logger';
import { createError } from '../middleware/errorHandler';
import { addReportJob, JOB_TYPES } from '../services/queue';

const router = Router();

// Get all reports
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 10, targetId, type, format } = req.query;
    
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where: any = {};
    
    if (targetId) {
      where.targetId = targetId;
    }
    
    if (type) {
      where.type = type;
    }
    
    if (format) {
      where.format = format;
    }

    const [reports, total] = await Promise.all([
      prisma.report.findMany({
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
      prisma.report.count({ where })
    ]);

    res.json({
      success: true,
      data: reports,
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

// Get report by ID
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const report = await prisma.report.findUnique({
      where: { id },
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

    if (!report) {
      throw createError('Report not found', 404);
    }

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
});

// Generate new report
router.post('/', async (req, res, next) => {
  try {
    const { targetId, executionId, type, format, title, customData } = req.body;

    if (!targetId || !type || !format) {
      throw createError('Target ID, type, and format are required', 400);
    }

    // Validate target exists
    const target = await prisma.target.findUnique({
      where: { id: targetId }
    });

    if (!target) {
      throw createError('Target not found', 404);
    }

    // Validate execution if provided
    if (executionId) {
      const execution = await prisma.execution.findUnique({
        where: { id: executionId }
      });

      if (!execution) {
        throw createError('Execution not found', 404);
      }
    }

    // Create report record
    const report = await prisma.report.create({
      data: {
        targetId,
        executionId,
        type,
        title: title || `${type} Report for ${target.domain}`,
        content: '', // Will be populated by worker
        format
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

    logger.info(`Created new report: ${report.title}`);

    // Add report generation job to queue
    await addReportJob(JOB_TYPES.REPORT.GENERATE, {
      reportId: report.id,
      targetId,
      executionId,
      type,
      format,
      customData
    }, {
      jobId: `report-${report.id}`
    });

    res.status(201).json({
      success: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
});

// Download report file
router.get('/:id/download', async (req, res, next) => {
  try {
    const { id } = req.params;

    const report = await prisma.report.findUnique({
      where: { id }
    });

    if (!report) {
      throw createError('Report not found', 404);
    }

    if (!report.path) {
      throw createError('Report file not available', 404);
    }

    const fileName = `${report.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${report.format.toLowerCase()}`;
    
    res.download(report.path, fileName, (err) => {
      if (err) {
        logger.error(`Error downloading report ${id}:`, err);
      }
    });
  } catch (error) {
    next(error);
  }
});

// Delete report
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const report = await prisma.report.findUnique({
      where: { id }
    });

    if (!report) {
      throw createError('Report not found', 404);
    }

    // Delete file if it exists
    if (report.path) {
      const fs = require('fs');
      const path = require('path');
      const filePath = path.resolve(report.path);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await prisma.report.delete({
      where: { id }
    });

    logger.info(`Deleted report: ${report.title}`);

    res.json({
      success: true,
      message: 'Report deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Get report content (for HTML/JSON reports)
router.get('/:id/content', async (req, res, next) => {
  try {
    const { id } = req.params;

    const report = await prisma.report.findUnique({
      where: { id }
    });

    if (!report) {
      throw createError('Report not found', 404);
    }

    if (!['HTML', 'JSON', 'MARKDOWN'].includes(report.format)) {
      throw createError('Report content not available for this format', 400);
    }

    res.json({
      success: true,
      data: {
        report,
        content: report.content
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get reports by type
router.get('/type/:type', async (req, res, next) => {
  try {
    const { type } = req.params;
    const { page = 1, limit = 10, targetId } = req.query;
    
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where: any = { type };
    
    if (targetId) {
      where.targetId = targetId;
    }

    const [reports, total] = await Promise.all([
      prisma.report.findMany({
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
      prisma.report.count({ where })
    ]);

    res.json({
      success: true,
      data: reports,
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

// Get report statistics
router.get('/stats/overview', async (req, res, next) => {
  try {
    const { targetId } = req.query;

    const where: any = {};
    if (targetId) {
      where.targetId = targetId;
    }

    const [
      totalReports,
      executionReports,
      vulnerabilityReports,
      artifactReports,
      customReports,
      htmlReports,
      jsonReports,
      pdfReports,
      csvReports
    ] = await Promise.all([
      prisma.report.count({ where }),
      prisma.report.count({ where: { ...where, type: 'EXECUTION_SUMMARY' } }),
      prisma.report.count({ where: { ...where, type: 'VULNERABILITY_REPORT' } }),
      prisma.report.count({ where: { ...where, type: 'ARTIFACT_SUMMARY' } }),
      prisma.report.count({ where: { ...where, type: 'CUSTOM' } }),
      prisma.report.count({ where: { ...where, format: 'HTML' } }),
      prisma.report.count({ where: { ...where, format: 'JSON' } }),
      prisma.report.count({ where: { ...where, format: 'PDF' } }),
      prisma.report.count({ where: { ...where, format: 'CSV' } })
    ]);

    const stats = {
      total: totalReports,
      byType: {
        execution: executionReports,
        vulnerability: vulnerabilityReports,
        artifact: artifactReports,
        custom: customReports
      },
      byFormat: {
        html: htmlReports,
        json: jsonReports,
        pdf: pdfReports,
        csv: csvReports
      }
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