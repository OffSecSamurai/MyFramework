"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emitLogMessage = exports.emitProgressUpdate = exports.emitVulnerabilityFound = exports.emitTargetUpdate = exports.emitTaskUpdate = exports.emitExecutionUpdate = exports.setupWebSocket = void 0;
const logger_1 = require("../utils/logger");
const setupWebSocket = (io) => {
    io.on('connection', (socket) => {
        logger_1.logger.info(`Client connected: ${socket.id}`);
        socket.on('join-execution', (executionId) => {
            socket.join(`execution-${executionId}`);
            logger_1.logger.info(`Client ${socket.id} joined execution room: ${executionId}`);
        });
        socket.on('join-target', (targetId) => {
            socket.join(`target-${targetId}`);
            logger_1.logger.info(`Client ${socket.id} joined target room: ${targetId}`);
        });
        socket.on('disconnect', () => {
            logger_1.logger.info(`Client disconnected: ${socket.id}`);
        });
        socket.on('error', (error) => {
            logger_1.logger.error(`Socket error for ${socket.id}:`, error);
        });
    });
    global.io = io;
    logger_1.logger.info('WebSocket server setup complete');
};
exports.setupWebSocket = setupWebSocket;
const emitExecutionUpdate = (executionId, data) => {
    const io = global.io;
    if (io) {
        io.to(`execution-${executionId}`).emit('execution-update', data);
        logger_1.logger.debug(`Emitted execution update for ${executionId}:`, data);
    }
};
exports.emitExecutionUpdate = emitExecutionUpdate;
const emitTaskUpdate = (executionId, taskId, data) => {
    const io = global.io;
    if (io) {
        io.to(`execution-${executionId}`).emit('task-update', {
            taskId,
            ...data
        });
        logger_1.logger.debug(`Emitted task update for ${taskId}:`, data);
    }
};
exports.emitTaskUpdate = emitTaskUpdate;
const emitTargetUpdate = (targetId, data) => {
    const io = global.io;
    if (io) {
        io.to(`target-${targetId}`).emit('target-update', data);
        logger_1.logger.debug(`Emitted target update for ${targetId}:`, data);
    }
};
exports.emitTargetUpdate = emitTargetUpdate;
const emitVulnerabilityFound = (targetId, vulnerability) => {
    const io = global.io;
    if (io) {
        io.to(`target-${targetId}`).emit('vulnerability-found', vulnerability);
        logger_1.logger.info(`Emitted vulnerability found for ${targetId}:`, vulnerability);
    }
};
exports.emitVulnerabilityFound = emitVulnerabilityFound;
const emitProgressUpdate = (executionId, progress) => {
    const io = global.io;
    if (io) {
        io.to(`execution-${executionId}`).emit('progress-update', { progress });
        logger_1.logger.debug(`Emitted progress update for ${executionId}: ${progress}%`);
    }
};
exports.emitProgressUpdate = emitProgressUpdate;
const emitLogMessage = (executionId, message, level = 'info') => {
    const io = global.io;
    if (io) {
        io.to(`execution-${executionId}`).emit('log-message', {
            message,
            level,
            timestamp: new Date().toISOString()
        });
        logger_1.logger.debug(`Emitted log message for ${executionId}: ${message}`);
    }
};
exports.emitLogMessage = emitLogMessage;
exports.default = exports.setupWebSocket;
//# sourceMappingURL=websocket.js.map