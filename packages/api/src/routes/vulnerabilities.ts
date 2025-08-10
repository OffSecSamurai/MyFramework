import express from 'express';
import { prisma } from '../index';
import { logger } from '../utils/logger';
import { createError } from '../middleware/errorHandler';

const router = express.Router();

// Get all vulnerabilities
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 50, targetId, severity, status, tool } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = {};
    if (targetId) where.targetId = targetId;
    if (severity) where.severity = severity;
    if (status) where.status = status;
    if (tool) where.tool = tool;

    const [vulnerabilities, total] = await Promise.all([
      prisma.vulnerability.findMany({
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
      prisma.vulnerability.count({ where })
    ]);

    res.json({
      vulnerabilities,
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

// Get vulnerability by ID
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const vulnerability = await prisma.vulnerability.findUnique({
      where: { id },
      include: {
        target: {
          select: { id: true, domain: true }
        }
      }
    });

    if (!vulnerability) {
      throw createError('Vulnerability not found', 404);
    }

    res.json(vulnerability);
  } catch (error) {
    next(error);
  }
});

// Update vulnerability status
router.patch('/:id/status', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      throw createError('Status is required', 400);
    }

    const vulnerability = await prisma.vulnerability.update({
      where: { id },
      data: { status }
    });

    logger.info(`Updated vulnerability status: ${id} -> ${status}`);
    res.json(vulnerability);
  } catch (error) {
    next(error);
  }
});

// Get vulnerability statistics
router.get('/stats/overview', async (req, res, next) => {
  try {
    const [total, critical, high, medium, low, info] = await Promise.all([
      prisma.vulnerability.count(),
      prisma.vulnerability.count({ where: { severity: 'CRITICAL' } }),
      prisma.vulnerability.count({ where: { severity: 'HIGH' } }),
      prisma.vulnerability.count({ where: { severity: 'MEDIUM' } }),
      prisma.vulnerability.count({ where: { severity: 'LOW' } }),
      prisma.vulnerability.count({ where: { severity: 'INFO' } })
    ]);

    const riskScore = calculateRiskScore({ critical, high, medium, low, info });

    res.json({
      total,
      bySeverity: { critical, high, medium, low, info },
      riskScore
    });
  } catch (error) {
    next(error);
  }
});

const calculateRiskScore = (counts: any): number => {
  const weights = {
    critical: 10,
    high: 8,
    medium: 5,
    low: 2,
    info: 1
  };

  const score = Object.entries(counts).reduce((total, [severity, count]) => {
    return total + (weights[severity as keyof typeof weights] * (count as number));
  }, 0);

  return Math.min(score, 100);
};

export default router;