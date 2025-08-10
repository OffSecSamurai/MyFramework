import { PrismaClient } from '@prisma/client';
import { logger, performanceLogger } from './logger';
import { config } from './config';

// Custom Prisma client with enhanced logging and error handling
class DatabaseClient extends PrismaClient {
  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'info' },
        { emit: 'event', level: 'warn' },
      ],
      errorFormat: 'colorless',
    });

    // Log database queries (only in development or debug mode)
    if (config.isDevelopment || config.logging.level === 'debug') {
      this.$on('query', (e) => {
        performanceLogger.slowQuery({
          query: e.query,
          params: e.params,
          duration: e.duration,
          target: e.target
        });
      });
    }

    // Log database errors
    this.$on('error', (e) => {
      logger.error('Database error', {
        type: 'database',
        message: e.message,
        target: e.target,
        timestamp: e.timestamp
      });
    });

    // Log database info messages
    this.$on('info', (e) => {
      logger.info('Database info', {
        type: 'database',
        message: e.message,
        target: e.target,
        timestamp: e.timestamp
      });
    });

    // Log database warnings
    this.$on('warn', (e) => {
      logger.warn('Database warning', {
        type: 'database',
        message: e.message,
        target: e.target,
        timestamp: e.timestamp
      });
    });
  }

  async connect(): Promise<void> {
    try {
      await this.$connect();
      logger.info('Database connected successfully', {
        type: 'database',
        event: 'connect',
        url: config.database.url.replace(/\/\/.*@/, '//***:***@') // Hide credentials
      });
    } catch (error) {
      logger.error('Failed to connect to database', {
        type: 'database',
        event: 'connect_error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.$disconnect();
      logger.info('Database disconnected successfully', {
        type: 'database',
        event: 'disconnect'
      });
    } catch (error) {
      logger.error('Error disconnecting from database', {
        type: 'database',
        event: 'disconnect_error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async healthCheck(): Promise<{ status: string; latency: number }> {
    const start = Date.now();
    try {
      await this.$queryRaw`SELECT 1`;
      const latency = Date.now() - start;
      
      logger.debug('Database health check passed', {
        type: 'database',
        event: 'health_check',
        latency
      });

      return { status: 'healthy', latency };
    } catch (error) {
      const latency = Date.now() - start;
      
      logger.error('Database health check failed', {
        type: 'database',
        event: 'health_check_failed',
        latency,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return { status: 'unhealthy', latency };
    }
  }

  // Enhanced query methods with better error handling
  async executeTransaction<T>(
    operation: (tx: any) => Promise<T>,
    retries = 3
  ): Promise<T> {
    let attempt = 0;
    
    while (attempt < retries) {
      try {
        return await this.$transaction(operation);
      } catch (error) {
        attempt++;
        
        logger.warn('Transaction failed', {
          type: 'database',
          event: 'transaction_failed',
          attempt,
          maxRetries: retries,
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        if (attempt >= retries) {
          logger.error('Transaction failed after all retries', {
            type: 'database',
            event: 'transaction_failed_final',
            attempts: attempt,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          throw error;
        }

        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }

    throw new Error('Transaction failed after maximum retries');
  }

  // Utility methods for common operations
  async findTargetByDomain(domain: string) {
    return this.target.findUnique({
      where: { domain },
      include: {
        executions: {
          take: 5,
          orderBy: { createdAt: 'desc' }
        },
        subdomains: {
          take: 10,
          orderBy: { createdAt: 'desc' }
        },
        vulnerabilities: {
          where: { falsePositive: false },
          take: 10,
          orderBy: { createdAt: 'desc' }
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
  }

  async getTargetStats(targetId: string) {
    const [
      executionStats,
      subdomainStats,
      vulnerabilityStats,
      artifactStats
    ] = await Promise.all([
      this.execution.groupBy({
        by: ['status'],
        where: { targetId },
        _count: true
      }),
      this.subdomain.groupBy({
        by: ['status'],
        where: { targetId },
        _count: true
      }),
      this.vulnerability.groupBy({
        by: ['severity'],
        where: { targetId, falsePositive: false },
        _count: true
      }),
      this.artifact.groupBy({
        by: ['type'],
        where: { targetId },
        _count: true
      })
    ]);

    return {
      executions: executionStats,
      subdomains: subdomainStats,
      vulnerabilities: vulnerabilityStats,
      artifacts: artifactStats
    };
  }

  async cleanupOldData(daysOld: number = 30): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    try {
      await this.executeTransaction(async (tx) => {
        // Delete old completed executions
        const deletedExecutions = await tx.execution.deleteMany({
          where: {
            status: 'COMPLETED',
            completedAt: {
              lt: cutoffDate
            }
          }
        });

        // Delete old artifacts (orphaned)
        const deletedArtifacts = await tx.artifact.deleteMany({
          where: {
            createdAt: {
              lt: cutoffDate
            },
            AND: [
              { targetId: null },
              { executionId: null },
              { jobId: null }
            ]
          }
        });

        logger.info('Database cleanup completed', {
          type: 'database',
          event: 'cleanup',
          deletedExecutions: deletedExecutions.count,
          deletedArtifacts: deletedArtifacts.count,
          cutoffDate
        });
      });
    } catch (error) {
      logger.error('Database cleanup failed', {
        type: 'database',
        event: 'cleanup_failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }
}

// Create singleton instance
export const prisma = new DatabaseClient();

// Database utility functions
export async function initializeDatabase(): Promise<void> {
  try {
    await prisma.connect();
    
    // Run health check
    const health = await prisma.healthCheck();
    if (health.status === 'unhealthy') {
      throw new Error('Database health check failed');
    }

    logger.info('Database initialized successfully', {
      type: 'database',
      event: 'initialized',
      latency: health.latency
    });
  } catch (error) {
    logger.error('Failed to initialize database', {
      type: 'database',
      event: 'initialization_failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}

export async function shutdownDatabase(): Promise<void> {
  try {
    await prisma.disconnect();
    logger.info('Database shutdown completed', {
      type: 'database',
      event: 'shutdown'
    });
  } catch (error) {
    logger.error('Database shutdown failed', {
      type: 'database',
      event: 'shutdown_failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Export types for use in other modules
export type DatabaseClient = typeof prisma;
export type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export default prisma;