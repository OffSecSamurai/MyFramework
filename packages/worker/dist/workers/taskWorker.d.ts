import { Job } from 'bullmq';
export declare const setupTaskWorker: {
    handleJob(job: Job): Promise<{
        success: boolean;
        taskId: any;
    }>;
    processToolResults(taskId: string, result: any, target: string): Promise<void>;
    processSubdomainResults(taskId: string, result: any, target: string): Promise<void>;
    processHTTPResults(taskId: string, result: any, target: string): Promise<void>;
    processVulnerabilityResults(taskId: string, result: any, target: string): Promise<void>;
    extractSubdomains(output: string): string[];
    extractLiveUrls(output: string): string[];
};
//# sourceMappingURL=taskWorker.d.ts.map