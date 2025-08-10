import { Router } from 'express';
import { asyncHandler } from '@/middleware/async';
import { prisma } from '@/utils/database';
import { config } from '@/utils/config';

const router = Router();

/**
 * @route   GET /api/system/health
 * @desc    System health check
 * @access  Public
 */
router.get('/health', asyncHandler(async (req, res) => {
  const healthData = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    environment: config.environment,
    services: {
      database: { status: 'unknown', latency: 0 },
      redis: { status: 'unknown' },
      worker: { status: 'unknown' }
    },
    system: {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        external: Math.round(process.memoryUsage().external / 1024 / 1024)
      },
      cpu: {
        cores: require('os').cpus().length,
        loadAverage: require('os').loadavg()
      }
    }
  };

  try {
    // Check database health
    const dbHealth = await prisma.healthCheck();
    healthData.services.database = {
      status: dbHealth.status,
      latency: dbHealth.latency
    };
  } catch (error) {
    healthData.services.database = {
      status: 'unhealthy',
      latency: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
    healthData.status = 'degraded';
  }

  // TODO: Add Redis health check when implemented
  // TODO: Add Worker health check when implemented

  const httpStatus = healthData.status === 'healthy' ? 200 : 503;
  res.status(httpStatus).json(healthData);
}));

/**
 * @route   GET /api/system/stats
 * @desc    System statistics and metrics
 * @access  Public
 */
router.get('/stats', asyncHandler(async (req, res) => {
  const [
    targetCount,
    executionCount,
    vulnerabilityCount,
    artifactCount
  ] = await Promise.all([
    prisma.target.count(),
    prisma.execution.count(),
    prisma.vulnerability.count(),
    prisma.artifact.count()
  ]);

  // Get execution statistics
  const executionStats = await prisma.execution.groupBy({
    by: ['status'],
    _count: true
  });

  // Get vulnerability statistics
  const vulnerabilityStats = await prisma.vulnerability.groupBy({
    by: ['severity'],
    where: { falsePositive: false },
    _count: true
  });

  // Get recent activity
  const recentTargets = await prisma.target.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: {
      id: true,
      domain: true,
      createdAt: true,
      priority: true
    }
  });

  const recentExecutions = await prisma.execution.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: {
      id: true,
      mode: true,
      status: true,
      createdAt: true,
      target: {
        select: {
          domain: true
        }
      }
    }
  });

  res.json({
    overview: {
      targets: targetCount,
      executions: executionCount,
      vulnerabilities: vulnerabilityCount,
      artifacts: artifactCount
    },
    statistics: {
      executions: executionStats,
      vulnerabilities: vulnerabilityStats
    },
    recent: {
      targets: recentTargets,
      executions: recentExecutions
    },
    timestamp: new Date().toISOString()
  });
}));

/**
 * @route   GET /api/system/config
 * @desc    Get system configuration (sanitized)
 * @access  Public
 */
router.get('/config', asyncHandler(async (req, res) => {
  const sanitizedConfig = {
    environment: config.environment,
    version: process.env.npm_package_version || '1.0.0',
    features: {
      nativeTools: config.tools.useNative,
      dockerFallback: config.tools.dockerFallback,
      burpProxy: config.proxy.burp.enabled,
      zapProxy: config.proxy.zap.enabled
    },
    limits: {
      maxThreads: config.worker.maxThreads,
      maxMemoryMB: config.hardware.maxMemoryMB,
      concurrentScans: config.hardware.concurrentScans
    },
    storage: {
      basePath: config.storage.basePath,
      ssdOptimization: config.hardware.enableSsdOptimization
    }
  };

  res.json({
    config: sanitizedConfig,
    timestamp: new Date().toISOString()
  });
}));

/**
 * @route   GET /api/system/phases
 * @desc    Get current implementation phases status
 * @access  Public
 */
router.get('/phases', asyncHandler(async (req, res) => {
  const phases = [
    {
      id: 1,
      name: 'Initial Assessment',
      description: 'Target and scope configuration',
      status: 'completed',
      features: [
        'Target creation and management',
        'Scope configuration',
        'Domain validation',
        'Target prioritization'
      ],
      endpoints: [
        'POST /api/targets',
        'GET /api/targets',
        'PUT /api/targets/:id',
        'DELETE /api/targets/:id'
      ]
    },
    {
      id: 2,
      name: 'Reconnaissance',
      description: 'Information gathering (Subfinder, dnsx, HTTPx)',
      status: 'pending',
      features: [
        'Subdomain enumeration',
        'DNS resolution',
        'Live host detection',
        'Technology fingerprinting'
      ],
      endpoints: [
        'POST /api/executions',
        'GET /api/executions/:id/status',
        'POST /api/executions/:id/pause',
        'POST /api/executions/:id/resume'
      ]
    },
    {
      id: 3,
      name: 'Vulnerability Discovery',
      description: 'Bug hunting (Nuclei, Dirsearch, Gf-Patterns)',
      status: 'pending',
      features: [
        'Vulnerability scanning',
        'Directory fuzzing',
        'Pattern matching',
        'False positive filtering'
      ],
      endpoints: [
        'GET /api/vulnerabilities',
        'POST /api/vulnerabilities/:id/verify',
        'PUT /api/vulnerabilities/:id',
        'GET /api/artifacts'
      ]
    },
    {
      id: 4,
      name: 'Exploitation',
      description: 'Proof of Concept development',
      status: 'pending',
      features: [
        'PoC generation',
        'Exploit validation',
        'Impact assessment',
        'Chain discovery'
      ],
      endpoints: []
    },
    {
      id: 5,
      name: 'Documentation',
      description: 'Automated reporting',
      status: 'pending',
      features: [
        'Report generation',
        'Executive summaries',
        'Technical details',
        'Remediation guidance'
      ],
      endpoints: []
    }
  ];

  res.json({
    phases,
    currentPhase: phases.find(p => p.status === 'completed')?.id || 1,
    nextPhase: phases.find(p => p.status === 'pending')?.id || 2,
    progress: phases.filter(p => p.status === 'completed').length / phases.length * 100,
    timestamp: new Date().toISOString()
  });
}));

export default router;