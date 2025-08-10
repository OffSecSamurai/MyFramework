import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { logger } from '@/utils/logger';

// Custom error class for validation errors
export class ValidationError extends Error {
  public statusCode: number;
  public details: any;

  constructor(message: string, details: any) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
    this.details = details;
  }
}

// Middleware factory function
export function validateRequest(schema: Joi.ObjectSchema, options?: Joi.ValidationOptions) {
  return (req: Request, res: Response, next: NextFunction) => {
    const defaultOptions: Joi.ValidationOptions = {
      abortEarly: false, // Return all validation errors
      allowUnknown: false, // Don't allow unknown fields
      stripUnknown: true, // Remove unknown fields
      ...options
    };

    const { error, value } = schema.validate(req.body, defaultOptions);

    if (error) {
      const validationErrors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value,
        type: detail.type
      }));

      logger.warn('Request validation failed', {
        type: 'validation',
        event: 'validation_failed',
        url: req.url,
        method: req.method,
        errors: validationErrors,
        body: req.body
      });

      return res.status(400).json({
        error: 'Validation failed',
        message: 'The request body contains invalid data',
        details: validationErrors,
        timestamp: new Date().toISOString(),
        path: req.path
      });
    }

    // Replace request body with validated and sanitized data
    req.body = value;
    next();
  };
}

// Validate query parameters
export function validateQuery(schema: Joi.ObjectSchema, options?: Joi.ValidationOptions) {
  return (req: Request, res: Response, next: NextFunction) => {
    const defaultOptions: Joi.ValidationOptions = {
      abortEarly: false,
      allowUnknown: true, // Allow unknown query params for flexibility
      stripUnknown: false,
      ...options
    };

    const { error, value } = schema.validate(req.query, defaultOptions);

    if (error) {
      const validationErrors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value,
        type: detail.type
      }));

      logger.warn('Query validation failed', {
        type: 'validation',
        event: 'query_validation_failed',
        url: req.url,
        method: req.method,
        errors: validationErrors,
        query: req.query
      });

      return res.status(400).json({
        error: 'Query validation failed',
        message: 'The query parameters contain invalid data',
        details: validationErrors,
        timestamp: new Date().toISOString(),
        path: req.path
      });
    }

    req.query = value;
    next();
  };
}

// Validate route parameters
export function validateParams(schema: Joi.ObjectSchema, options?: Joi.ValidationOptions) {
  return (req: Request, res: Response, next: NextFunction) => {
    const defaultOptions: Joi.ValidationOptions = {
      abortEarly: false,
      allowUnknown: false,
      stripUnknown: true,
      ...options
    };

    const { error, value } = schema.validate(req.params, defaultOptions);

    if (error) {
      const validationErrors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value,
        type: detail.type
      }));

      logger.warn('Parameters validation failed', {
        type: 'validation',
        event: 'params_validation_failed',
        url: req.url,
        method: req.method,
        errors: validationErrors,
        params: req.params
      });

      return res.status(400).json({
        error: 'Parameter validation failed',
        message: 'The route parameters contain invalid data',
        details: validationErrors,
        timestamp: new Date().toISOString(),
        path: req.path
      });
    }

    req.params = value;
    next();
  };
}

// Common validation schemas for reuse
export const commonSchemas = {
  // MongoDB-style ObjectId
  objectId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).message('Invalid ObjectId format'),
  
  // CUID (used by Prisma)
  cuid: Joi.string().pattern(/^c[a-z0-9]{24}$/).message('Invalid CUID format'),
  
  // UUID v4
  uuid: Joi.string().uuid({ version: 'uuidv4' }),
  
  // Pagination
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sort: Joi.string().optional(),
    order: Joi.string().valid('asc', 'desc').default('desc')
  }),
  
  // Common search
  search: Joi.object({
    q: Joi.string().max(200).optional(),
    status: Joi.string().optional(),
    priority: Joi.string().valid('LOW', 'MEDIUM', 'HIGH', 'CRITICAL').optional(),
    tags: Joi.alternatives().try(
      Joi.string(),
      Joi.array().items(Joi.string())
    ).optional()
  }),
  
  // Domain validation
  domain: Joi.string()
    .hostname()
    .max(253)
    .custom((value, helpers) => {
      // Additional domain validation
      if (value.includes('localhost') || value.includes('127.0.0.1')) {
        return helpers.error('any.invalid');
      }
      return value;
    })
    .messages({
      'any.invalid': 'Domain cannot be localhost or loopback address'
    }),
  
  // IP address validation
  ipAddress: Joi.string().ip({ version: ['ipv4', 'ipv6'] }),
  
  // Port validation
  port: Joi.number().integer().min(1).max(65535),
  
  // URL validation
  url: Joi.string().uri({ scheme: ['http', 'https'] }),
  
  // File path validation (basic)
  filePath: Joi.string().pattern(/^[^<>:"|?*\x00-\x1f]+$/).max(500),
  
  // Email validation
  email: Joi.string().email(),
  
  // Password validation (for future auth)
  password: Joi.string()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .messages({
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    })
};

// Helper function to create ID validation middleware
export function validateId(paramName: string = 'id') {
  return validateParams(Joi.object({
    [paramName]: commonSchemas.cuid.required()
  }));
}

// Helper function to validate pagination
export function validatePagination() {
  return validateQuery(commonSchemas.pagination);
}

// Helper function to validate search parameters
export function validateSearch() {
  return validateQuery(commonSchemas.search);
}

// Combined validation (body + query + params)
export function validateAll(schemas: {
  body?: Joi.ObjectSchema;
  query?: Joi.ObjectSchema;
  params?: Joi.ObjectSchema;
}) {
  return [
    ...(schemas.params ? [validateParams(schemas.params)] : []),
    ...(schemas.query ? [validateQuery(schemas.query)] : []),
    ...(schemas.body ? [validateRequest(schemas.body)] : [])
  ];
}

// Custom validation helpers
export const validators = {
  // Validate tool names
  toolName: (value: string, helpers: any) => {
    const validTools = [
      'subfinder',
      'assetfinder', 
      'findomain',
      'chaos',
      'amass',
      'dnsx',
      'httpx',
      'aquatone',
      'gowitness',
      'nuclei',
      'dirsearch',
      'gobuster',
      'ffuf',
      'nmap',
      'naabu',
      'gau',
      'waybackurls',
      'katana',
      'arjun',
      'paramspider',
      'linkfinder',
      'secretfinder',
      'gf',
      'sqlmap',
      'dalfox',
      'xsstrike'
    ];
    
    if (!validTools.includes(value.toLowerCase())) {
      return helpers.error('any.invalid');
    }
    
    return value.toLowerCase();
  },
  
  // Validate execution mode
  executionMode: (value: string, helpers: any) => {
    const validModes = ['FULL', 'CUSTOM', 'SINGLE_TOOL'];
    if (!validModes.includes(value.toUpperCase())) {
      return helpers.error('any.invalid');
    }
    return value.toUpperCase();
  },
  
  // Validate severity levels
  severity: (value: string, helpers: any) => {
    const validSeverities = ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    if (!validSeverities.includes(value.toUpperCase())) {
      return helpers.error('any.invalid');
    }
    return value.toUpperCase();
  }
};

export default validateRequest;