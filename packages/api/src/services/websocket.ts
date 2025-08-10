import { Server as SocketIOServer } from 'socket.io';
import { logger } from '../utils/logger';

export const setupWebSocket = (io: SocketIOServer) => {
  io.on('connection', (socket) => {
    logger.info(`Client connected: ${socket.id}`);

    // Join execution room for real-time updates
    socket.on('join-execution', (executionId: string) => {
      socket.join(`execution-${executionId}`);
      logger.info(`Client ${socket.id} joined execution room: ${executionId}`);
    });

    // Join target room for target-specific updates
    socket.on('join-target', (targetId: string) => {
      socket.join(`target-${targetId}`);
      logger.info(`Client ${socket.id} joined target room: ${targetId}`);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      logger.info(`Client disconnected: ${socket.id}`);
    });

    // Handle errors
    socket.on('error', (error) => {
      logger.error(`Socket error for ${socket.id}:`, error);
    });
  });

  // Make io available globally for emitting events
  (global as any).io = io;

  logger.info('WebSocket server setup complete');
};

// Utility functions for emitting events
export const emitExecutionUpdate = (executionId: string, data: any) => {
  const io = (global as any).io;
  if (io) {
    io.to(`execution-${executionId}`).emit('execution-update', data);
    logger.debug(`Emitted execution update for ${executionId}:`, data);
  }
};

export const emitTaskUpdate = (executionId: string, taskId: string, data: any) => {
  const io = (global as any).io;
  if (io) {
    io.to(`execution-${executionId}`).emit('task-update', {
      taskId,
      ...data
    });
    logger.debug(`Emitted task update for ${taskId}:`, data);
  }
};

export const emitTargetUpdate = (targetId: string, data: any) => {
  const io = (global as any).io;
  if (io) {
    io.to(`target-${targetId}`).emit('target-update', data);
    logger.debug(`Emitted target update for ${targetId}:`, data);
  }
};

export const emitVulnerabilityFound = (targetId: string, vulnerability: any) => {
  const io = (global as any).io;
  if (io) {
    io.to(`target-${targetId}`).emit('vulnerability-found', vulnerability);
    logger.info(`Emitted vulnerability found for ${targetId}:`, vulnerability);
  }
};

export const emitProgressUpdate = (executionId: string, progress: number) => {
  const io = (global as any).io;
  if (io) {
    io.to(`execution-${executionId}`).emit('progress-update', { progress });
    logger.debug(`Emitted progress update for ${executionId}: ${progress}%`);
  }
};

export const emitLogMessage = (executionId: string, message: string, level: 'info' | 'warn' | 'error' = 'info') => {
  const io = (global as any).io;
  if (io) {
    io.to(`execution-${executionId}`).emit('log-message', {
      message,
      level,
      timestamp: new Date().toISOString()
    });
    logger.debug(`Emitted log message for ${executionId}: ${message}`);
  }
};

export default setupWebSocket;