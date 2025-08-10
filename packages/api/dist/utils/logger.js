"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stream = exports.logger = void 0;
const winston_1 = __importDefault(require("winston"));
const path_1 = __importDefault(require("path"));
const logsDir = process.env['LOG_FILE'] ? path_1.default.dirname(process.env['LOG_FILE']) : './storage/logs';
const logFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
}), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json());
const consoleFormat = winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.timestamp({
    format: 'HH:mm:ss'
}), winston_1.default.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
        msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
}));
exports.logger = winston_1.default.createLogger({
    level: process.env['LOG_LEVEL'] || 'info',
    format: logFormat,
    defaultMeta: { service: 'akshays-framework-api' },
    transports: [
        new winston_1.default.transports.Console({
            format: consoleFormat,
            level: process.env['NODE_ENV'] === 'production' ? 'warn' : 'debug'
        }),
        new winston_1.default.transports.File({
            filename: path_1.default.join(logsDir, 'akshays-framework-api.log'),
            level: 'info'
        }),
        new winston_1.default.transports.File({
            filename: path_1.default.join(logsDir, 'akshays-framework-api-error.log'),
            level: 'error'
        })
    ],
    exceptionHandlers: [
        new winston_1.default.transports.File({
            filename: path_1.default.join(logsDir, 'akshays-framework-api-exception.log')
        })
    ],
    rejectionHandlers: [
        new winston_1.default.transports.File({
            filename: path_1.default.join(logsDir, 'akshays-framework-api-rejection.log')
        })
    ]
});
exports.stream = {
    write: (message) => {
        exports.logger.info(message.trim());
    }
};
exports.default = exports.logger;
//# sourceMappingURL=logger.js.map