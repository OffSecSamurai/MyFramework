import { ToolExecution, ToolResult } from '../../types/tools';
export declare class SubfinderAdapter {
    private executor;
    constructor();
    execute(execution: ToolExecution): Promise<ToolResult>;
    processResults(result: ToolResult, target: string): Promise<any>;
    private extractSubdomains;
}
//# sourceMappingURL=SubfinderAdapter.d.ts.map