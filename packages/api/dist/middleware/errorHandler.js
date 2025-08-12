"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = exports.createError = void 0;
const logger_1 = require("../utils/logger");
const createError = (message, statusCode = 500) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    error.isOperational = true;
    return error;
};
exports.createError = createError;
const errorHandler = (err, _req, res, _next) => {
    let { statusCode = 500, message } = err;
    logger_1.logger.error('Error occurred:', {
        error: err.message,
        stack: err.stack,
        statusCode,
        url: _req.url,
        method: _req.method,
        ip: _req.ip
    });
    if (err.name === 'PrismaClientKnownRequestError') {
        statusCode = 400;
        message = 'Database operation failed';
    }
    else if (err.name === 'PrismaClientValidationError') {
        statusCode = 400;
        message = 'Validation error';
    }
    else if (err.name === 'JsonWebTokenError') {
        statusCode = 401;
        message = 'Invalid token';
    }
    else if (err.name === 'TokenExpiredError') {
        statusCode = 401;
        message = 'Token expired';
    }
    res.status(statusCode).json({
        error: {
            message: message || 'Internal server error',
            statusCode,
            ...(process.env['NODE_ENV'] === 'development' && { stack: err.stack })
        }
    });
};
exports.errorHandler = errorHandler;
//# sourceMappingURL=errorHandler.js.map