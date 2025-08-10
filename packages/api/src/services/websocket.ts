import { Server, Socket } from 'socket.io';
import { logger } from '../utils/logger';

let io: Server;

export const setupWebSocket = (socketServer: Server) => {
  io = socketServer;
  
  io.on('connection', (socket: Socket) => {
    logger.info(`Client connected: ${socket.id}`);
    
    // Join execution room
    socket.on('join-execution', (executionId: string) => {
      socket.join(`execution-${executionId}`);
      logger.info(`Client ${socket.id} joined execution room: ${executionId}`);
    });
    
    // Join target room
    socket.on('join-target', (targetId: string) => {
      socket.join(`target-${targetId}`);
      logger.info(`Client ${socket.id} joined target room: ${targetId}`);
    });
    
    // Leave execution room
    socket.on('leave-execution', (executionId: string) => {
      socket.leave(`execution-${executionId}`);
      logger.info(`Client ${socket.id} left execution room: ${executionId}`);
    });
    
    // Leave target room
    socket.on('leave-target', (targetId: string) => {
      socket.leave(`target-${targetId}`);
      logger.info(`Client ${socket.id} left target room: ${targetId}`);
    });
    
    socket.on('disconnect', () => {
      logger.info(`Client disconnected: ${socket.id}`);
    });
  });
  
  logger.info('WebSocket server initialized');
};

// Utility functions for emitting events
export const emitExecutionUpdate = (executionId: string, data: any) => {
  if (io) {
    io.to(`execution-${executionId}`).emit('execution-update', data);
  }
};

export const emitTaskUpdate = (executionId: string, data: any) => {
  if (io) {
    io.to(`execution-${executionId}`).emit('task-update', data);
  }
};

export const emitTargetUpdate = (event: string, data: any) => {
  if (io) {
    io.emit('target-update', { event, data });
  }
};

export const emitVulnerabilityFound = (targetId: string, data: any) => {
  if (io) {
    io.to(`target-${targetId}`).emit('vulnerability-found', data);
  }
};

export const emitProgressUpdate = (executionId: string, progress: number) => {
  if (io) {
    io.to(`execution-${executionId}`).emit('progress-update', { progress });
  }
};

export const emitLogMessage = (executionId: string, message: string, level: string = 'info') => {
  if (io) {
    io.to(`execution-${executionId}`).emit('log-message', { message, level, timestamp: new Date().toISOString() });
  }
};