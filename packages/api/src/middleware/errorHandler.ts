import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export const createError = (message: string, statusCode: number = 500): AppError => {
  const error = new Error(message) as AppError;
  error.statusCode = statusCode;
  error.isOperational = true;
  return error;
};

export const errorHandler = (
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  let { statusCode = 500, message } = err;

  // Log error
  logger.error('Error occurred:', {
    error: err.message,
    stack: err.stack,
    statusCode,
    url: _req.url,
    method: _req.method,
    ip: _req.ip
  });

  // Handle specific error types
  if (err.name === 'PrismaClientKnownRequestError') {
    statusCode = 400;
    message = 'Database operation failed';
  } else if (err.name === 'PrismaClientValidationError') {
    statusCode = 400;
    message = 'Validation error';
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }

  // Send error response
  res.status(statusCode).json({
    error: {
      message: message || 'Internal server error',
      statusCode,
      ...(process.env['NODE_ENV'] === 'development' && { stack: err.stack })
    }
  });
};