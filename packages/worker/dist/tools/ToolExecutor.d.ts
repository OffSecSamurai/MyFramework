import { ToolConfig, ToolExecution, ToolResult } from '../types/tools';
export declare class ToolExecutor {
    private docker;
    private executionMode;
    constructor();
    executeTool(execution: ToolExecution, config: ToolConfig): Promise<ToolResult>;
    private executeInDocker;
    private executeNative;
    private buildDockerArgs;
    private getEnvironmentVariables;
    private collectArtifacts;
    private getArtifactType;
    private getMimeType;
}
//# sourceMappingURL=ToolExecutor.d.ts.map