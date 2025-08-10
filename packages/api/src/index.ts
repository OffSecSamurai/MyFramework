import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

import { config } from '@/utils/config';
import { logger } from '@/utils/logger';
import { prisma } from '@/utils/database';
import { initializeQueues } from '@/services/queue';
import { setupSocketHandlers } from '@/services/socket';

// Route imports
import targetRoutes from '@/routes/targets';
import executionRoutes from '@/routes/executions';
import artifactRoutes from '@/routes/artifacts';
import vulnerabilityRoutes from '@/routes/vulnerabilities';
import systemRoutes from '@/routes/system';

class AkshaysFrameworkAPI {
  private app: express.Application;
  private server: any;
  private io: SocketIOServer;

  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: config.cors.origin,
        methods: ['GET', 'POST'],
        credentials: true
      }
    });

    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "blob:"],
          connectSrc: ["'self'", "ws:", "wss:"],
        },
      },
    }));

    // CORS configuration
    this.app.use(cors({
      origin: config.cors.origin,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: config.rateLimit.windowMs,
      max: config.rateLimit.maxRequests,
      message: {
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: Math.ceil(config.rateLimit.windowMs / 1000)
      },
      standardHeaders: true,
      legacyHeaders: false,
    });
    this.app.use('/api/', limiter);

    // Basic middleware
    this.app.use(compression());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Logging
    this.app.use(morgan('combined', {
      stream: { write: (message) => logger.info(message.trim()) }
    }));

    // Request ID and timing
    this.app.use((req, res, next) => {
      req.id = Math.random().toString(36).substring(2, 15);
      req.startTime = Date.now();
      res.setHeader('X-Request-ID', req.id);
      next();
    });
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0'
      });
    });

    // API routes
    this.app.use('/api/targets', targetRoutes);
    this.app.use('/api/executions', executionRoutes);
    this.app.use('/api/artifacts', artifactRoutes);
    this.app.use('/api/vulnerabilities', vulnerabilityRoutes);
    this.app.use('/api/system', systemRoutes);

    // Catch-all for undefined routes
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Route not found',
        path: req.originalUrl,
        method: req.method,
        timestamp: new Date().toISOString()
      });
    });
  }

  private setupErrorHandling(): void {
    // Global error handler
    this.app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      const requestId = req.id || 'unknown';
      const statusCode = err.statusCode || 500;
      
      logger.error('API Error', {
        requestId,
        error: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        body: req.body,
        query: req.query,
        params: req.params
      });

      // Don't leak stack traces in production
      const errorResponse: any = {
        error: err.message || 'Internal Server Error',
        requestId,
        timestamp: new Date().toISOString()
      };

      if (config.isDevelopment) {
        errorResponse.stack = err.stack;
        errorResponse.details = err.details;
      }

      res.status(statusCode).json(errorResponse);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection', { reason, promise });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
      process.exit(1);
    });
  }

  public async start(): Promise<void> {
    try {
      // Initialize database connection
      await prisma.$connect();
      logger.info('Database connected successfully');

      // Initialize job queues
      await initializeQueues();
      logger.info('Job queues initialized');

      // Setup Socket.IO handlers
      setupSocketHandlers(this.io);
      logger.info('Socket.IO handlers setup');

      // Start server
      this.server.listen(config.port, config.host, () => {
        logger.info(`🚀 Akshay's Framework API Server started`, {
          port: config.port,
          host: config.host,
          environment: config.environment,
          cors: config.cors.origin,
          pid: process.pid
        });

        logger.info('🎯 Available endpoints:', {
          health: `http://${config.host}:${config.port}/health`,
          api: `http://${config.host}:${config.port}/api`,
          websocket: `ws://${config.host}:${config.port}`
        });
      });

    } catch (error) {
      logger.error('Failed to start server', { error });
      process.exit(1);
    }
  }

  public async stop(): Promise<void> {
    try {
      logger.info('Shutting down server...');
      
      // Close database connection
      await prisma.$disconnect();
      
      // Close server
      this.server.close(() => {
        logger.info('Server shutdown complete');
      });

    } catch (error) {
      logger.error('Error during shutdown', { error });
    }
  }
}

// Graceful shutdown handling
async function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal}, starting graceful shutdown...`);
  
  try {
    await apiServer.stop();
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown', { error });
    process.exit(1);
  }
}

// Start server
const apiServer = new AkshaysFrameworkAPI();

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start the server
apiServer.start().catch((error) => {
  logger.error('Failed to start API server', { error });
  process.exit(1);
});

export default apiServer;