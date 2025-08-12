import { Redis } from 'ioredis';
import { PrismaClient } from '@prisma/client';
export declare const prisma: PrismaClient<import(".prisma/client").Prisma.PrismaClientOptions, never, import("@prisma/client/runtime/library").DefaultArgs>;
export declare const redis: Redis;
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
//# sourceMappingURL=index.d.ts.map