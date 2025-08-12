import winston from 'winston';
import path from 'path';

// Create logs directory if it doesn't exist
const logsDir = process.env['LOG_FILE'] ? path.dirname(process.env['LOG_FILE']) : './storage/logs';

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

// Create logger instance
export const logger = winston.createLogger({
  level: process.env['LOG_LEVEL'] || 'info',
  format: logFormat,
  defaultMeta: { service: 'akshays-framework-api' },
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: consoleFormat,
      level: process.env['NODE_ENV'] === 'production' ? 'warn' : 'debug'
    }),
    
    // File transport for all logs
    new winston.transports.File({
      filename: path.join(logsDir, 'akshays-framework-api.log'),
      level: 'info'
    }),
    
    // Error file transport
    new winston.transports.File({
      filename: path.join(logsDir, 'akshays-framework-api-error.log'),
      level: 'error'
    })
  ],
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'akshays-framework-api-exception.log')
    })
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'akshays-framework-api-rejection.log')
    })
  ]
});

// Stream for Morgan integration
export const stream = {
  write: (message: string) => {
    logger.info(message.trim());
  }
};

export default logger;