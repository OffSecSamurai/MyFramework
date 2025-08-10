import { Router } from 'express';
import { prisma } from '../index';
import { logger } from '../utils/logger';
import { createError } from '../middleware/errorHandler';
import { emitTargetUpdate } from '../services/websocket';
import fs from 'fs-extra';

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

// Get processed data for a target
router.get('/:id/processed-data', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const target = await prisma.target.findUnique({
      where: { id }
    });

    if (!target) {
      throw createError('Target not found', 404);
    }

    // Get all data for the target
    const [subdomains, liveHosts, liveUrls, vulnerabilities, artifacts] = await Promise.all([
      prisma.artifact.findMany({
        where: { targetId: id, type: 'SUBDOMAIN_LIST' },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.artifact.findMany({
        where: { targetId: id, type: 'LIVE_HOSTS' },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.artifact.findMany({
        where: { targetId: id, type: 'LIVE_URLS' },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.vulnerability.findMany({
        where: { targetId: id },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.artifact.findMany({
        where: { targetId: id },
        orderBy: { createdAt: 'desc' }
      })
    ]);

    // Process and extract data from artifacts
    const processedData = {
      subdomains: await extractSubdomainData(subdomains),
      liveHosts: await extractLiveHostData(liveHosts),
      liveUrls: await extractLiveUrlData(liveUrls),
      vulnerabilities,
      artifacts,
      statistics: {
        totalSubdomains: subdomains.length,
        uniqueSubdomains: new Set(await extractSubdomainData(subdomains)).size,
        liveHosts: liveHosts.length,
        liveUrls: liveUrls.length,
        vulnerabilities: vulnerabilities.length,
        criticalVulns: vulnerabilities.filter(v => v.severity === 'CRITICAL').length,
        highVulns: vulnerabilities.filter(v => v.severity === 'HIGH').length,
        mediumVulns: vulnerabilities.filter(v => v.severity === 'MEDIUM').length,
        lowVulns: vulnerabilities.filter(v => v.severity === 'LOW').length
      }
    };

    res.json({
      success: true,
      data: processedData
    });
  } catch (error) {
    next(error);
  }
});

// Download data for a target
router.get('/:id/download/:type', async (req, res, next) => {
  try {
    const { id, type } = req.params;
    
    const target = await prisma.target.findUnique({
      where: { id }
    });

    if (!target) {
      throw createError('Target not found', 404);
    }

    let data: any = {};

    switch (type) {
      case 'subdomains':
        const subdomains = await prisma.artifact.findMany({
          where: { targetId: id, type: 'SUBDOMAIN_LIST' }
        });
        data = await extractSubdomainData(subdomains);
        break;
      case 'hosts':
        const hosts = await prisma.artifact.findMany({
          where: { targetId: id, type: 'LIVE_HOSTS' }
        });
        data = await extractLiveHostData(hosts);
        break;
      case 'urls':
        const urls = await prisma.artifact.findMany({
          where: { targetId: id, type: 'LIVE_URLS' }
        });
        data = await extractLiveUrlData(urls);
        break;
      case 'vulnerabilities':
        data = await prisma.vulnerability.findMany({
          where: { targetId: id }
        });
        break;
      case 'artifacts':
        data = await prisma.artifact.findMany({
          where: { targetId: id }
        });
        break;
      case 'all':
        const [subdomainsAll, hostsAll, urlsAll, vulnsAll, artifactsAll] = await Promise.all([
          prisma.artifact.findMany({ where: { targetId: id, type: 'SUBDOMAIN_LIST' } }),
          prisma.artifact.findMany({ where: { targetId: id, type: 'LIVE_HOSTS' } }),
          prisma.artifact.findMany({ where: { targetId: id, type: 'LIVE_URLS' } }),
          prisma.vulnerability.findMany({ where: { targetId: id } }),
          prisma.artifact.findMany({ where: { targetId: id } })
        ]);
        data = {
          subdomains: await extractSubdomainData(subdomainsAll),
          liveHosts: await extractLiveHostData(hostsAll),
          liveUrls: await extractLiveUrlData(urlsAll),
          vulnerabilities: vulnsAll,
          artifacts: artifactsAll
        };
        break;
      default:
        throw createError('Invalid data type', 400);
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${type}_${target.domain}.json"`);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// Helper functions to extract data from artifacts
async function extractSubdomainData(artifacts: any[]): Promise<string[]> {
  const subdomains: string[] = [];
  
  for (const artifact of artifacts) {
    try {
      const content = await fs.readFile(artifact.path, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());
      subdomains.push(...lines);
    } catch (error) {
      logger.warn(`Failed to read artifact ${artifact.id}:`, error);
    }
  }
  
  return [...new Set(subdomains)]; // Remove duplicates
}

async function extractLiveHostData(artifacts: any[]): Promise<string[]> {
  const hosts: string[] = [];
  
  for (const artifact of artifacts) {
    try {
      const content = await fs.readFile(artifact.path, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());
      hosts.push(...lines);
    } catch (error) {
      logger.warn(`Failed to read artifact ${artifact.id}:`, error);
    }
  }
  
  return [...new Set(hosts)]; // Remove duplicates
}

async function extractLiveUrlData(artifacts: any[]): Promise<string[]> {
  const urls: string[] = [];
  
  for (const artifact of artifacts) {
    try {
      const content = await fs.readFile(artifact.path, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());
      urls.push(...lines);
    } catch (error) {
      logger.warn(`Failed to read artifact ${artifact.id}:`, error);
    }
  }
  
  return [...new Set(urls)]; // Remove duplicates
}

export default router;