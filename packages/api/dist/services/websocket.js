"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emitLogMessage = exports.emitProgressUpdate = exports.emitVulnerabilityFound = exports.emitTargetUpdate = exports.emitTaskUpdate = exports.emitExecutionUpdate = exports.setupWebSocket = void 0;
const logger_1 = require("../utils/logger");
let io;
const setupWebSocket = (socketServer) => {
    io = socketServer;
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
        socket.on('leave-execution', (executionId) => {
            socket.leave(`execution-${executionId}`);
            logger_1.logger.info(`Client ${socket.id} left execution room: ${executionId}`);
        });
        socket.on('leave-target', (targetId) => {
            socket.leave(`target-${targetId}`);
            logger_1.logger.info(`Client ${socket.id} left target room: ${targetId}`);
        });
        socket.on('disconnect', () => {
            logger_1.logger.info(`Client disconnected: ${socket.id}`);
        });
    });
    logger_1.logger.info('WebSocket server initialized');
};
exports.setupWebSocket = setupWebSocket;
const emitExecutionUpdate = (executionId, data) => {
    if (io) {
        io.to(`execution-${executionId}`).emit('execution-update', data);
    }
};
exports.emitExecutionUpdate = emitExecutionUpdate;
const emitTaskUpdate = (executionId, data) => {
    if (io) {
        io.to(`execution-${executionId}`).emit('task-update', data);
    }
};
exports.emitTaskUpdate = emitTaskUpdate;
const emitTargetUpdate = (event, data) => {
    if (io) {
        io.emit('target-update', { event, data });
    }
};
exports.emitTargetUpdate = emitTargetUpdate;
const emitVulnerabilityFound = (targetId, data) => {
    if (io) {
        io.to(`target-${targetId}`).emit('vulnerability-found', data);
    }
};
exports.emitVulnerabilityFound = emitVulnerabilityFound;
const emitProgressUpdate = (executionId, progress) => {
    if (io) {
        io.to(`execution-${executionId}`).emit('progress-update', { progress });
    }
};
exports.emitProgressUpdate = emitProgressUpdate;
const emitLogMessage = (executionId, message, level = 'info') => {
    if (io) {
        io.to(`execution-${executionId}`).emit('log-message', { message, level, timestamp: new Date().toISOString() });
    }
};
exports.emitLogMessage = emitLogMessage;
//# sourceMappingURL=websocket.js.map