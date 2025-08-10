import { Job } from 'bullmq';
export declare const setupExecutionWorker: {
    handleJob(job: Job): Promise<{
        success: boolean;
        taskCount: number;
    }>;
};
//# sourceMappingURL=executionWorker.d.ts.map