import { Router } from 'express';
import { prisma } from '../index';
import { logger } from '../utils/logger';
import { createError } from '../middleware/errorHandler';
import { emitVulnerabilityFound } from '../services/websocket';

const router = Router();

// Get all vulnerabilities
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, targetId, severity, status, tool } = req.query;
    
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where: any = {};
    
    if (targetId) {
      where.targetId = targetId;
    }
    
    if (severity) {
      where.severity = severity;
    }
    
    if (status) {
      where.status = status;
    }
    
    if (tool) {
      where.tool = tool;
    }

    const [vulnerabilities, total] = await Promise.all([
      prisma.vulnerability.findMany({
        where,
        skip,
        take,
        orderBy: [
          { severity: 'desc' },
          { createdAt: 'desc' }
        ],
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
      prisma.vulnerability.count({ where })
    ]);

    res.json({
      success: true,
      data: vulnerabilities,
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

// Get vulnerability by ID
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const vulnerability = await prisma.vulnerability.findUnique({
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

    if (!vulnerability) {
      throw createError('Vulnerability not found', 404);
    }

    res.json({
      success: true,
      data: vulnerability
    });
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

    const vulnerability = await prisma.vulnerability.findUnique({
      where: { id }
    });

    if (!vulnerability) {
      throw createError('Vulnerability not found', 404);
    }

    const updatedVulnerability = await prisma.vulnerability.update({
      where: { id },
      data: { status },
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

    logger.info(`Updated vulnerability status: ${id} -> ${status}`);

    res.json({
      success: true,
      data: updatedVulnerability
    });
  } catch (error) {
    next(error);
  }
});

// Get vulnerability statistics
router.get('/stats/overview', async (req, res, next) => {
  try {
    const { targetId } = req.query;

    const where: any = {};
    if (targetId) {
      where.targetId = targetId;
    }

    const [
      totalVulnerabilities,
      criticalVulnerabilities,
      highVulnerabilities,
      mediumVulnerabilities,
      lowVulnerabilities,
      infoVulnerabilities,
      openVulnerabilities,
      confirmedVulnerabilities,
      falsePositives,
      fixedVulnerabilities
    ] = await Promise.all([
      prisma.vulnerability.count({ where }),
      prisma.vulnerability.count({ where: { ...where, severity: 'CRITICAL' } }),
      prisma.vulnerability.count({ where: { ...where, severity: 'HIGH' } }),
      prisma.vulnerability.count({ where: { ...where, severity: 'MEDIUM' } }),
      prisma.vulnerability.count({ where: { ...where, severity: 'LOW' } }),
      prisma.vulnerability.count({ where: { ...where, severity: 'INFO' } }),
      prisma.vulnerability.count({ where: { ...where, status: 'OPEN' } }),
      prisma.vulnerability.count({ where: { ...where, status: 'CONFIRMED' } }),
      prisma.vulnerability.count({ where: { ...where, status: 'FALSE_POSITIVE' } }),
      prisma.vulnerability.count({ where: { ...where, status: 'FIXED' } })
    ]);

    const stats = {
      total: totalVulnerabilities,
      bySeverity: {
        critical: criticalVulnerabilities,
        high: highVulnerabilities,
        medium: mediumVulnerabilities,
        low: lowVulnerabilities,
        info: infoVulnerabilities
      },
      byStatus: {
        open: openVulnerabilities,
        confirmed: confirmedVulnerabilities,
        falsePositive: falsePositives,
        fixed: fixedVulnerabilities
      },
      riskScore: calculateRiskScore({
        critical: criticalVulnerabilities,
        high: highVulnerabilities,
        medium: mediumVulnerabilities,
        low: lowVulnerabilities,
        info: infoVulnerabilities
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

// Get vulnerabilities by severity
router.get('/severity/:severity', async (req, res, next) => {
  try {
    const { severity } = req.params;
    const { page = 1, limit = 20, targetId } = req.query;
    
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where: any = { severity };
    
    if (targetId) {
      where.targetId = targetId;
    }

    const [vulnerabilities, total] = await Promise.all([
      prisma.vulnerability.findMany({
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
      prisma.vulnerability.count({ where })
    ]);

    res.json({
      success: true,
      data: vulnerabilities,
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

// Get vulnerabilities by tool
router.get('/tool/:tool', async (req, res, next) => {
  try {
    const { tool } = req.params;
    const { page = 1, limit = 20, targetId } = req.query;
    
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where: any = { tool };
    
    if (targetId) {
      where.targetId = targetId;
    }

    const [vulnerabilities, total] = await Promise.all([
      prisma.vulnerability.findMany({
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
      prisma.vulnerability.count({ where })
    ]);

    res.json({
      success: true,
      data: vulnerabilities,
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

// Bulk update vulnerability status
router.patch('/bulk/status', async (req, res, next) => {
  try {
    const { ids, status } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      throw createError('IDs array is required', 400);
    }

    if (!status) {
      throw createError('Status is required', 400);
    }

    const result = await prisma.vulnerability.updateMany({
      where: {
        id: { in: ids }
      },
      data: { status }
    });

    logger.info(`Bulk updated ${result.count} vulnerabilities to status: ${status}`);

    res.json({
      success: true,
      data: {
        updatedCount: result.count
      }
    });
  } catch (error) {
    next(error);
  }
});

// Helper function to calculate risk score
function calculateRiskScore(severities: {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
}): number {
  const weights = {
    critical: 10,
    high: 7,
    medium: 4,
    low: 2,
    info: 1
  };

  const score = Object.entries(severities).reduce((total, [severity, count]) => {
    return total + (count * weights[severity as keyof typeof weights]);
  }, 0);

  // Normalize to 0-100 scale
  return Math.min(100, Math.max(0, score));
}

export default router;