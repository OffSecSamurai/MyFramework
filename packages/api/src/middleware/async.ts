import { Request, Response, NextFunction } from 'express';
import { logger } from '@/utils/logger';

// Type definition for async route handlers
type AsyncRouteHandler = (req: Request, res: Response, next: NextFunction) => Promise<any>;

/**
 * Wrapper function to handle async route handlers and catch errors
 * This eliminates the need for try-catch blocks in every async route
 */
export function asyncHandler(fn: AsyncRouteHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Execute the async function and catch any errors
    Promise.resolve(fn(req, res, next)).catch((error) => {
      // Log the error with context
      logger.error('Async handler error', {
        type: 'async_error',
        url: req.url,
        method: req.method,
        params: req.params,
        query: req.query,
        body: req.body,
        user: (req as any).user?.id,
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name
        }
      });

      // Pass the error to the global error handler
      next(error);
    });
  };
}

/**
 * Enhanced async handler with additional features
 */
export function advancedAsyncHandler(options?: {
  timeout?: number;
  onTimeout?: (req: Request, res: Response) => void;
  beforeExecute?: (req: Request, res: Response) => void;
  afterExecute?: (req: Request, res: Response, result?: any) => void;
}) {
  return (fn: AsyncRouteHandler) => {
    return async (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      
      try {
        // Execute before hook
        if (options?.beforeExecute) {
          options.beforeExecute(req, res);
        }

        // Set up timeout if specified
        let timeoutId: NodeJS.Timeout | undefined;
        if (options?.timeout) {
          timeoutId = setTimeout(() => {
            if (!res.headersSent) {
              if (options.onTimeout) {
                options.onTimeout(req, res);
              } else {
                res.status(408).json({
                  error: 'Request timeout',
                  message: `Request took longer than ${options.timeout}ms`,
                  timestamp: new Date().toISOString()
                });
              }
            }
          }, options.timeout);
        }

        // Execute the async function
        const result = await fn(req, res, next);
        
        // Clear timeout
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        // Execute after hook
        if (options?.afterExecute && !res.headersSent) {
          options.afterExecute(req, res, result);
        }

        // Log performance
        const duration = Date.now() - startTime;
        if (duration > 1000) { // Log slow requests
          logger.warn('Slow request detected', {
            type: 'performance',
            url: req.url,
            method: req.method,
            duration,
            threshold: 1000
          });
        }

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        
        logger.error('Advanced async handler error', {
          type: 'async_error',
          url: req.url,
          method: req.method,
          duration,
          params: req.params,
          query: req.query,
          user: (req as any).user?.id,
          error: {
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            name: error instanceof Error ? error.name : 'UnknownError'
          }
        });

        next(error);
      }
    };
  };
}

/**
 * Async handler specifically for database operations
 * Includes database-specific error handling and retry logic
 */
export function dbAsyncHandler(options?: {
  retries?: number;
  retryDelay?: number;
}) {
  return (fn: AsyncRouteHandler) => {
    return async (req: Request, res: Response, next: NextFunction) => {
      const maxRetries = options?.retries || 3;
      const retryDelay = options?.retryDelay || 1000;
      let attempt = 0;

      while (attempt < maxRetries) {
        try {
          return await fn(req, res, next);
        } catch (error) {
          attempt++;
          
          // Check if it's a retryable database error
          const isRetryable = isRetryableError(error);
          
          if (!isRetryable || attempt >= maxRetries) {
            logger.error('Database operation failed', {
              type: 'database_error',
              url: req.url,
              method: req.method,
              attempt,
              maxRetries,
              isRetryable,
              error: {
                message: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined,
                code: (error as any).code
              }
            });
            
            next(error);
            return;
          }

          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
          
          logger.warn('Retrying database operation', {
            type: 'database_retry',
            url: req.url,
            method: req.method,
            attempt,
            maxRetries
          });
        }
      }
    };
  };
}

/**
 * Check if an error is retryable (database connection issues, timeouts, etc.)
 */
function isRetryableError(error: any): boolean {
  if (!error) return false;

  const retryableCodes = [
    'ECONNRESET',
    'ECONNREFUSED', 
    'ENOTFOUND',
    'ETIMEDOUT',
    'EPIPE',
    'P2024', // Prisma: connection pool timeout
    'P2025', // Prisma: record not found (sometimes retryable)
    'P2034'  // Prisma: transaction failed
  ];

  const retryableMessages = [
    'connection timeout',
    'connection refused',
    'network error',
    'server error',
    'transaction timeout'
  ];

  // Check error codes
  if (retryableCodes.includes(error.code)) {
    return true;
  }

  // Check error messages
  const errorMessage = (error.message || '').toLowerCase();
  return retryableMessages.some(msg => errorMessage.includes(msg));
}

/**
 * Async handler for file operations
 * Includes file-specific error handling
 */
export function fileAsyncHandler(fn: AsyncRouteHandler) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      return await fn(req, res, next);
    } catch (error) {
      // Enhanced file operation error logging
      logger.error('File operation error', {
        type: 'file_error',
        url: req.url,
        method: req.method,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          code: (error as any).code,
          path: (error as any).path,
          errno: (error as any).errno,
          syscall: (error as any).syscall
        }
      });

      // Convert common file errors to user-friendly messages
      if ((error as any).code === 'ENOENT') {
        const err = new Error('File not found');
        (err as any).statusCode = 404;
        next(err);
      } else if ((error as any).code === 'EACCES') {
        const err = new Error('Permission denied');
        (err as any).statusCode = 403;
        next(err);
      } else if ((error as any).code === 'ENOSPC') {
        const err = new Error('Insufficient storage space');
        (err as any).statusCode = 507;
        next(err);
      } else {
        next(error);
      }
    }
  };
}

/**
 * Rate-limited async handler
 * Prevents too many concurrent operations from the same source
 */
const concurrentOperations = new Map<string, number>();

export function rateLimitedAsyncHandler(options?: {
  maxConcurrent?: number;
  keyGenerator?: (req: Request) => string;
}) {
  const maxConcurrent = options?.maxConcurrent || 5;
  const keyGenerator = options?.keyGenerator || ((req: Request) => req.ip);

  return (fn: AsyncRouteHandler) => {
    return async (req: Request, res: Response, next: NextFunction) => {
      const key = keyGenerator(req);
      const currentCount = concurrentOperations.get(key) || 0;

      if (currentCount >= maxConcurrent) {
        const error = new Error('Too many concurrent operations');
        (error as any).statusCode = 429;
        return next(error);
      }

      // Increment counter
      concurrentOperations.set(key, currentCount + 1);

      try {
        return await fn(req, res, next);
      } finally {
        // Decrement counter
        const newCount = (concurrentOperations.get(key) || 1) - 1;
        if (newCount <= 0) {
          concurrentOperations.delete(key);
        } else {
          concurrentOperations.set(key, newCount);
        }
      }
    };
  };
}

// Export the basic asyncHandler as default
export default asyncHandler;