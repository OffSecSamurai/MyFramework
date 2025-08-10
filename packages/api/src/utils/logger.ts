import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { config } from './config';

// Define log levels
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each log level
const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

// Add colors to winston
winston.addColors(logColors);

// Custom format for structured logging
const structuredFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    // Handle both string messages and object messages
    let logMessage: string;
    let metadata: any = {};

    if (typeof message === 'string') {
      logMessage = message;
      metadata = meta;
    } else {
      logMessage = message.message || 'No message';
      metadata = { ...message, ...meta };
    }

    // Remove empty metadata
    const cleanMeta = Object.keys(metadata).length > 0 ? metadata : undefined;

    const logEntry: any = {
      timestamp,
      level,
      message: logMessage,
      pid: process.pid,
      service: 'akshays-framework-api'
    };

    if (cleanMeta) {
      logEntry.meta = cleanMeta;
    }

    return JSON.stringify(logEntry);
  })
);

// Custom format for console output (more readable)
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let logMessage: string;
    let metadata: any = {};

    if (typeof message === 'string') {
      logMessage = message;
      metadata = meta;
    } else {
      logMessage = message.message || 'No message';
      metadata = { ...message, ...meta };
    }

    // Format metadata for console display
    const metaStr = Object.keys(metadata).length > 0 
      ? `\n${JSON.stringify(metadata, null, 2)}` 
      : '';

    return `${timestamp} [${level}]: ${logMessage}${metaStr}`;
  })
);

// Ensure log directory exists
const logDir = path.dirname(config.logging.file);

// Create transports array
const transports: winston.transport[] = [];

// Console transport (always enabled in development)
if (config.isDevelopment) {
  transports.push(
    new winston.transports.Console({
      level: config.logging.level,
      format: consoleFormat,
      handleExceptions: true,
      handleRejections: true
    })
  );
}

// File transport with daily rotation
transports.push(
  new DailyRotateFile({
    filename: config.logging.file.replace('.log', '-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: config.logging.maxSize,
    maxFiles: `${config.logging.maxFiles}d`, // Keep logs for N days
    format: structuredFormat,
    level: config.logging.level,
    handleExceptions: true,
    handleRejections: true
  })
);

// Error-specific log file
transports.push(
  new DailyRotateFile({
    filename: path.join(logDir, 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: config.logging.maxSize,
    maxFiles: `${config.logging.maxFiles}d`,
    format: structuredFormat,
    level: 'error',
    handleExceptions: true,
    handleRejections: true
  })
);

// Performance/HTTP log file
transports.push(
  new DailyRotateFile({
    filename: path.join(logDir, 'access-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: config.logging.maxSize,
    maxFiles: `${config.logging.maxFiles}d`,
    format: structuredFormat,
    level: 'http'
  })
);

// Create the logger instance
export const logger = winston.createLogger({
  level: config.logging.level,
  levels: logLevels,
  format: structuredFormat,
  transports,
  exitOnError: false
});

// Custom logging methods for common use cases
export const securityLogger = {
  authFailure: (data: any) => logger.warn('Authentication failure', { 
    type: 'security', 
    event: 'auth_failure', 
    ...data 
  }),
  
  authSuccess: (data: any) => logger.info('Authentication success', { 
    type: 'security', 
    event: 'auth_success', 
    ...data 
  }),
  
  rateLimitHit: (data: any) => logger.warn('Rate limit exceeded', { 
    type: 'security', 
    event: 'rate_limit', 
    ...data 
  }),
  
  suspiciousActivity: (data: any) => logger.error('Suspicious activity detected', { 
    type: 'security', 
    event: 'suspicious_activity', 
    ...data 
  })
};

export const toolLogger = {
  toolStart: (data: any) => logger.info('Tool execution started', { 
    type: 'tool', 
    event: 'start', 
    ...data 
  }),
  
  toolComplete: (data: any) => logger.info('Tool execution completed', { 
    type: 'tool', 
    event: 'complete', 
    ...data 
  }),
  
  toolError: (data: any) => logger.error('Tool execution failed', { 
    type: 'tool', 
    event: 'error', 
    ...data 
  }),
  
  toolOutput: (data: any) => logger.debug('Tool output', { 
    type: 'tool', 
    event: 'output', 
    ...data 
  })
};

export const performanceLogger = {
  requestStart: (data: any) => logger.http('Request started', { 
    type: 'performance', 
    event: 'request_start', 
    ...data 
  }),
  
  requestComplete: (data: any) => logger.http('Request completed', { 
    type: 'performance', 
    event: 'request_complete', 
    ...data 
  }),
  
  slowQuery: (data: any) => logger.warn('Slow database query', { 
    type: 'performance', 
    event: 'slow_query', 
    ...data 
  }),
  
  memoryUsage: (data: any) => logger.debug('Memory usage', { 
    type: 'performance', 
    event: 'memory_usage', 
    ...data 
  })
};

// Utility function to log function execution time
export function logExecutionTime<T extends any[], R>(
  fn: (...args: T) => R,
  name: string
): (...args: T) => R {
  return (...args: T): R => {
    const start = Date.now();
    try {
      const result = fn(...args);
      const duration = Date.now() - start;
      
      if (result instanceof Promise) {
        return result.then((res) => {
          performanceLogger.requestComplete({ 
            function: name, 
            duration, 
            success: true 
          });
          return res;
        }).catch((error) => {
          performanceLogger.requestComplete({ 
            function: name, 
            duration, 
            success: false, 
            error: error.message 
          });
          throw error;
        }) as R;
      } else {
        performanceLogger.requestComplete({ 
          function: name, 
          duration, 
          success: true 
        });
        return result;
      }
    } catch (error) {
      const duration = Date.now() - start;
      performanceLogger.requestComplete({ 
        function: name, 
        duration, 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  };
}

// Log system information at startup
export function logSystemInfo(): void {
  logger.info('System information', {
    type: 'system',
    event: 'startup',
    node_version: process.version,
    platform: process.platform,
    arch: process.arch,
    memory: {
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      external: Math.round(process.memoryUsage().external / 1024 / 1024)
    },
    uptime: process.uptime(),
    pid: process.pid
  });
}

// Enhanced error logging
export function logError(error: Error | any, context?: any): void {
  logger.error('Application error', {
    type: 'error',
    message: error.message || 'Unknown error',
    stack: error.stack,
    name: error.name,
    code: error.code,
    statusCode: error.statusCode,
    context,
    timestamp: new Date().toISOString()
  });
}

// Setup error handlers for the logger itself
logger.on('error', (error) => {
  console.error('Logger error:', error);
});

// Export default logger
export default logger;