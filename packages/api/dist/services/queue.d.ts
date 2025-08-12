import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
declare const redis: Redis;
export declare const QUEUE_NAMES: {
    readonly EXECUTION: "execution";
    readonly TASK: "task";
    readonly REPORT: "report";
};
export declare const JOB_TYPES: {
    readonly EXECUTION: {
        readonly START: "start-execution";
        readonly PAUSE: "pause-execution";
        readonly STOP: "stop-execution";
        readonly RESUME: "resume-execution";
    };
    readonly TASK: {
        readonly RUN_TOOL: "run-tool";
        readonly PROCESS_RESULT: "process-result";
    };
    readonly REPORT: {
        readonly GENERATE: "generate-report";
    };
};
export declare const executionQueue: Queue<any, any, string, any, any, string>;
export declare const taskQueue: Queue<any, any, string, any, any, string>;
export declare const reportQueue: Queue<any, any, string, any, any, string>;
export declare const addExecutionJob: (type: string, data: any, options?: any) => Promise<import("bullmq").Job<any, any, string>>;
export declare const addTaskJob: (type: string, data: any, options?: any) => Promise<import("bullmq").Job<any, any, string>>;
export declare const addReportJob: (type: string, data: any, options?: any) => Promise<import("bullmq").Job<any, any, string>>;
export declare const pauseQueue: (queueName: string) => Promise<void>;
export declare const resumeQueue: (queueName: string) => Promise<void>;
export declare const cleanQueue: (queueName: string, grace?: number) => Promise<void>;
export declare const getQueueStats: (queueName: string) => Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
}>;
export declare const setupQueue: () => void;
export { redis };
//# sourceMappingURL=queue.d.ts.map