import { Server } from 'socket.io';
export declare const setupWebSocket: (socketServer: Server) => void;
export declare const emitExecutionUpdate: (executionId: string, data: any) => void;
export declare const emitTaskUpdate: (executionId: string, data: any) => void;
export declare const emitTargetUpdate: (event: string, data: any) => void;
export declare const emitVulnerabilityFound: (targetId: string, data: any) => void;
export declare const emitProgressUpdate: (executionId: string, progress: number) => void;
export declare const emitLogMessage: (executionId: string, message: string, level?: string) => void;
//# sourceMappingURL=websocket.d.ts.map