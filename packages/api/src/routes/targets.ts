import { Router } from 'express';
import Joi from 'joi';
import { prisma } from '@/utils/database';
import { logger } from '@/utils/logger';
import { validateRequest } from '@/middleware/validation';
import { asyncHandler } from '@/middleware/async';

const router = Router();

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const createTargetSchema = Joi.object({
  domain: Joi.string()
    .hostname()
    .required()
    .messages({
      'string.hostname': 'Domain must be a valid hostname',
      'any.required': 'Domain is required'
    }),
  name: Joi.string().optional().allow(''),
  description: Joi.string().optional().allow(''),
  scope: Joi.object({
    includeSubdomains: Joi.boolean().default(true),
    subdomainPatterns: Joi.array().items(Joi.string()).optional(),
    excludePatterns: Joi.array().items(Joi.string()).optional(),
    ipRanges: Joi.array().items(Joi.string().pattern(/^(?:\d{1,3}\.){3}\d{1,3}(?:\/\d{1,2})?$/)).optional(),
    ports: Joi.array().items(Joi.number().port()).optional(),
    protocols: Joi.array().items(Joi.string().valid('http', 'https', 'ftp', 'ssh')).optional()
  }).optional(),
  tags: Joi.array().items(Joi.string()).optional(),
  priority: Joi.string().valid('LOW', 'MEDIUM', 'HIGH', 'CRITICAL').default('MEDIUM')
});

const updateTargetSchema = Joi.object({
  name: Joi.string().optional().allow(''),
  description: Joi.string().optional().allow(''),
  scope: Joi.object({
    includeSubdomains: Joi.boolean().optional(),
    subdomainPatterns: Joi.array().items(Joi.string()).optional(),
    excludePatterns: Joi.array().items(Joi.string()).optional(),
    ipRanges: Joi.array().items(Joi.string().pattern(/^(?:\d{1,3}\.){3}\d{1,3}(?:\/\d{1,2})?$/)).optional(),
    ports: Joi.array().items(Joi.number().port()).optional(),
    protocols: Joi.array().items(Joi.string().valid('http', 'https', 'ftp', 'ssh')).optional()
  }).optional(),
  tags: Joi.array().items(Joi.string()).optional(),
  priority: Joi.string().valid('LOW', 'MEDIUM', 'HIGH', 'CRITICAL').optional(),
  status: Joi.string().valid('ACTIVE', 'PAUSED', 'ARCHIVED').optional()
});

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function validateDomain(domain: string): { isValid: boolean; message?: string } {
  // Basic domain validation
  const domainRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;
  
  if (!domainRegex.test(domain)) {
    return { isValid: false, message: 'Invalid domain format' };
  }

  // Check for malicious patterns
  const maliciousPatterns = [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '::1',
    'internal',
    'intranet'
  ];

  for (const pattern of maliciousPatterns) {
    if (domain.toLowerCase().includes(pattern)) {
      return { isValid: false, message: `Domain contains restricted pattern: ${pattern}` };
    }
  }

  return { isValid: true };
}

function validateScope(scope: any): { isValid: boolean; message?: string } {
  if (!scope) return { isValid: true };

  // Validate IP ranges
  if (scope.ipRanges) {
    for (const range of scope.ipRanges) {
      // Check for private/internal IP ranges
      const privateRanges = [
        /^10\./,
        /^172\.(1[6-9]|2[0-9]|3[01])\./,
        /^192\.168\./,
        /^127\./,
        /^169\.254\./
      ];

      if (privateRanges.some(regex => regex.test(range))) {
        return { isValid: false, message: `Private IP range not allowed: ${range}` };
      }
    }
  }

  return { isValid: true };
}

// =============================================================================
// ROUTES
// =============================================================================

/**
 * @route   GET /api/targets
 * @desc    Get all targets with filtering and pagination
 * @access  Public
 */
router.get('/', asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    status,
    priority,
    tags,
    search
  } = req.query;

  const offset = (Number(page) - 1) * Number(limit);

  // Build filter conditions
  const where: any = {};

  if (status) {
    where.status = status;
  }

  if (priority) {
    where.priority = priority;
  }

  if (tags) {
    const tagArray = Array.isArray(tags) ? tags : [tags];
    where.tags = {
      hasSome: tagArray
    };
  }

  if (search) {
    where.OR = [
      { domain: { contains: String(search), mode: 'insensitive' } },
      { name: { contains: String(search), mode: 'insensitive' } },
      { description: { contains: String(search), mode: 'insensitive' } }
    ];
  }

  const [targets, total] = await Promise.all([
    prisma.target.findMany({
      where,
      include: {
        _count: {
          select: {
            executions: true,
            subdomains: true,
            vulnerabilities: true,
            artifacts: true
          }
        }
      },
      orderBy: [
        { priority: 'desc' },
        { lastScanned: 'desc' },
        { createdAt: 'desc' }
      ],
      take: Number(limit),
      skip: offset
    }),
    prisma.target.count({ where })
  ]);

  const totalPages = Math.ceil(total / Number(limit));

  res.json({
    targets,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages,
      hasNext: Number(page) < totalPages,
      hasPrev: Number(page) > 1
    }
  });

  logger.info('Targets retrieved', {
    type: 'target',
    event: 'list',
    total,
    page: Number(page),
    filters: { status, priority, tags, search }
  });
}));

/**
 * @route   GET /api/targets/:id
 * @desc    Get target by ID with detailed information
 * @access  Public
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const target = await prisma.target.findUnique({
    where: { id },
    include: {
      executions: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          _count: {
            select: {
              jobs: true,
              artifacts: true
            }
          }
        }
      },
      subdomains: {
        orderBy: { createdAt: 'desc' },
        take: 20
      },
      vulnerabilities: {
        where: { falsePositive: false },
        orderBy: { createdAt: 'desc' },
        take: 20
      },
      artifacts: {
        orderBy: { createdAt: 'desc' },
        take: 20
      },
      _count: {
        select: {
          executions: true,
          subdomains: true,
          vulnerabilities: true,
          artifacts: true
        }
      }
    }
  });

  if (!target) {
    return res.status(404).json({
      error: 'Target not found',
      id
    });
  }

  // Get additional statistics
  const stats = await prisma.getTargetStats(id);

  res.json({
    target,
    stats
  });

  logger.info('Target retrieved', {
    type: 'target',
    event: 'get',
    targetId: id,
    domain: target.domain
  });
}));

/**
 * @route   POST /api/targets
 * @desc    Create a new target
 * @access  Public
 */
router.post('/', validateRequest(createTargetSchema), asyncHandler(async (req, res) => {
  const { domain, name, description, scope, tags, priority } = req.body;

  // Validate domain
  const domainValidation = validateDomain(domain);
  if (!domainValidation.isValid) {
    return res.status(400).json({
      error: 'Invalid domain',
      message: domainValidation.message
    });
  }

  // Validate scope
  const scopeValidation = validateScope(scope);
  if (!scopeValidation.isValid) {
    return res.status(400).json({
      error: 'Invalid scope configuration',
      message: scopeValidation.message
    });
  }

  // Check if target already exists
  const existingTarget = await prisma.target.findUnique({
    where: { domain }
  });

  if (existingTarget) {
    return res.status(409).json({
      error: 'Target already exists',
      domain,
      existingTargetId: existingTarget.id
    });
  }

  // Create target
  const target = await prisma.target.create({
    data: {
      domain,
      name: name || domain,
      description,
      scope: scope || {},
      tags: tags || [],
      priority
    },
    include: {
      _count: {
        select: {
          executions: true,
          subdomains: true,
          vulnerabilities: true,
          artifacts: true
        }
      }
    }
  });

  res.status(201).json({
    message: 'Target created successfully',
    target
  });

  logger.info('Target created', {
    type: 'target',
    event: 'create',
    targetId: target.id,
    domain,
    priority
  });
}));

/**
 * @route   PUT /api/targets/:id
 * @desc    Update target
 * @access  Public
 */
router.put('/:id', validateRequest(updateTargetSchema), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  // Check if target exists
  const existingTarget = await prisma.target.findUnique({
    where: { id }
  });

  if (!existingTarget) {
    return res.status(404).json({
      error: 'Target not found',
      id
    });
  }

  // Validate scope if provided
  if (updateData.scope) {
    const scopeValidation = validateScope(updateData.scope);
    if (!scopeValidation.isValid) {
      return res.status(400).json({
        error: 'Invalid scope configuration',
        message: scopeValidation.message
      });
    }
  }

  // Update target
  const target = await prisma.target.update({
    where: { id },
    data: updateData,
    include: {
      _count: {
        select: {
          executions: true,
          subdomains: true,
          vulnerabilities: true,
          artifacts: true
        }
      }
    }
  });

  res.json({
    message: 'Target updated successfully',
    target
  });

  logger.info('Target updated', {
    type: 'target',
    event: 'update',
    targetId: id,
    domain: target.domain,
    updates: Object.keys(updateData)
  });
}));

/**
 * @route   DELETE /api/targets/:id
 * @desc    Delete target (soft delete - archive)
 * @access  Public
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { force } = req.query;

  const existingTarget = await prisma.target.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          executions: true,
          subdomains: true,
          vulnerabilities: true,
          artifacts: true
        }
      }
    }
  });

  if (!existingTarget) {
    return res.status(404).json({
      error: 'Target not found',
      id
    });
  }

  if (force === 'true') {
    // Hard delete (permanently remove)
    await prisma.target.delete({
      where: { id }
    });

    res.json({
      message: 'Target permanently deleted',
      targetId: id
    });

    logger.warn('Target permanently deleted', {
      type: 'target',
      event: 'delete_permanent',
      targetId: id,
      domain: existingTarget.domain
    });
  } else {
    // Soft delete (archive)
    const target = await prisma.target.update({
      where: { id },
      data: { status: 'ARCHIVED' }
    });

    res.json({
      message: 'Target archived successfully',
      target
    });

    logger.info('Target archived', {
      type: 'target',
      event: 'archive',
      targetId: id,
      domain: existingTarget.domain
    });
  }
}));

/**
 * @route   POST /api/targets/:id/validate
 * @desc    Validate target configuration and scope
 * @access  Public
 */
router.post('/:id/validate', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const target = await prisma.target.findUnique({
    where: { id }
  });

  if (!target) {
    return res.status(404).json({
      error: 'Target not found',
      id
    });
  }

  const validationResults = {
    domain: validateDomain(target.domain),
    scope: validateScope(target.scope),
    overall: true,
    warnings: [],
    recommendations: []
  };

  // Check overall validation
  validationResults.overall = validationResults.domain.isValid && validationResults.scope.isValid;

  // Add warnings and recommendations
  if (target.scope && (target.scope as any).includeSubdomains) {
    validationResults.warnings.push('Subdomain enumeration enabled - this may take longer');
  }

  if (!target.description) {
    validationResults.recommendations.push('Add a description to help identify the target purpose');
  }

  if (target.tags.length === 0) {
    validationResults.recommendations.push('Add tags to categorize this target');
  }

  res.json({
    message: 'Target validation completed',
    validation: validationResults
  });

  logger.info('Target validated', {
    type: 'target',
    event: 'validate',
    targetId: id,
    isValid: validationResults.overall
  });
}));

/**
 * @route   GET /api/targets/:id/summary
 * @desc    Get target summary with key metrics
 * @access  Public
 */
router.get('/:id/summary', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const target = await prisma.target.findUnique({
    where: { id },
    select: {
      id: true,
      domain: true,
      name: true,
      priority: true,
      status: true,
      createdAt: true,
      lastScanned: true,
      _count: {
        select: {
          executions: true,
          subdomains: true,
          vulnerabilities: true,
          artifacts: true
        }
      }
    }
  });

  if (!target) {
    return res.status(404).json({
      error: 'Target not found',
      id
    });
  }

  // Get latest execution
  const latestExecution = await prisma.execution.findFirst({
    where: { targetId: id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      mode: true,
      status: true,
      progress: true,
      startedAt: true,
      completedAt: true
    }
  });

  // Get vulnerability summary
  const vulnerabilitySummary = await prisma.vulnerability.groupBy({
    by: ['severity'],
    where: { 
      targetId: id,
      falsePositive: false
    },
    _count: true
  });

  res.json({
    target,
    latestExecution,
    vulnerabilitySummary,
    lastUpdated: new Date().toISOString()
  });
}));

export default router;