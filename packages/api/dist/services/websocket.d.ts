import { Server as SocketIOServer } from 'socket.io';
export declare const setupWebSocket: (io: SocketIOServer) => void;
export declare const emitExecutionUpdate: (executionId: string, data: any) => void;
export declare const emitTaskUpdate: (executionId: string, taskId: string, data: any) => void;
export declare const emitTargetUpdate: (targetId: string, data: any) => void;
export declare const emitVulnerabilityFound: (targetId: string, vulnerability: any) => void;
export declare const emitProgressUpdate: (executionId: string, progress: number) => void;
export declare const emitLogMessage: (executionId: string, message: string, level?: "info" | "warn" | "error") => void;
export default setupWebSocket;
//# sourceMappingURL=websocket.d.ts.map