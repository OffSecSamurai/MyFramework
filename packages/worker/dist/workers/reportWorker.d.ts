import { Job } from 'bullmq';
export declare const setupReportWorker: {
    handleJob(job: Job): Promise<{
        success: boolean;
        reportId: any;
        filePath: string;
    }>;
    generateReport(targetId: string, type: string, format: string, customData?: any): Promise<string>;
    generateExecutionSummary(target: any, format: string): Promise<string>;
    generateVulnerabilityReport(target: any, format: string): Promise<string>;
    generateArtifactSummary(target: any, format: string): Promise<string>;
    generateCustomReport(target: any, format: string, customData?: any): Promise<string>;
    formatAsText(data: any): string;
};
//# sourceMappingURL=reportWorker.d.ts.map