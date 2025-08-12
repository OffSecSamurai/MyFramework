export interface ProcessedData {
    subdomains: string[];
    liveHosts: string[];
    liveUrls: string[];
    vulnerabilities: any[];
    artifacts: any[];
    statistics: {
        totalSubdomains: number;
        uniqueSubdomains: number;
        liveHosts: number;
        liveUrls: number;
        vulnerabilities: number;
        criticalVulns: number;
        highVulns: number;
        mediumVulns: number;
        lowVulns: number;
    };
}
export declare class DataProcessor {
    private static instance;
    private processedData;
    static getInstance(): DataProcessor;
    processSubdomainResults(target: string, rawData: string[]): Promise<string[]>;
    processLiveHosts(target: string, rawData: string[]): Promise<string[]>;
    processLiveUrls(target: string, rawData: string[]): Promise<string[]>;
    processVulnerabilities(target: string, rawData: any[]): Promise<any[]>;
    saveProcessedData(target: string, data: ProcessedData): Promise<void>;
    getProcessedData(target: string): Promise<ProcessedData | null>;
    private cleanSubdomains;
    private deduplicateSubdomains;
    private validateSubdomains;
    private cleanLiveHosts;
    private deduplicateHosts;
    private validateLiveHosts;
    private cleanUrls;
    private deduplicateUrls;
    private validateUrls;
    private cleanVulnerabilities;
    private deduplicateVulnerabilities;
    private enrichVulnerabilities;
    private isValidDomain;
    private isValidUrl;
    private normalizeSeverity;
    private generateVulnerabilityId;
    private calculateRiskScore;
    private generateTags;
    calculateStatistics(data: ProcessedData): ProcessedData['statistics'];
}
//# sourceMappingURL=dataProcessor.d.ts.map