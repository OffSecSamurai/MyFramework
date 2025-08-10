export interface ToolConfig {
    name: string;
    description: string;
    category: ToolCategory;
    dependencies: string[];
    dockerImage?: string;
    nativePath?: string;
    defaultArgs: string[];
    outputFormats: OutputFormat[];
    timeout: number;
    maxThreads: number;
}
export interface ToolExecution {
    id: string;
    tool: string;
    target: string;
    args: string[];
    outputPath: string;
    workingDir: string;
    timeout: number;
    metadata?: Record<string, any>;
}
export interface ToolResult {
    success: boolean;
    output: string;
    error?: string;
    artifacts: Artifact[];
    executionTime: number;
    metadata?: Record<string, any>;
}
export interface Artifact {
    name: string;
    path: string;
    type: ArtifactType;
    size: number;
    mimeType?: string;
    metadata?: Record<string, any>;
}
export declare enum ToolCategory {
    SUBDOMAIN_ENUMERATION = "subdomain_enumeration",
    DNS_RESOLUTION = "dns_resolution",
    PORT_SCANNING = "port_scanning",
    WEB_DISCOVERY = "web_discovery",
    VULNERABILITY_SCANNING = "vulnerability_scanning",
    CONTENT_DISCOVERY = "content_discovery",
    VISUAL_RECONNAISSANCE = "visual_reconnaissance",
    API_DISCOVERY = "api_discovery",
    SECRET_DISCOVERY = "secret_discovery"
}
export declare enum OutputFormat {
    TEXT = "text",
    JSON = "json",
    CSV = "csv",
    XML = "xml",
    HTML = "html",
    BINARY = "binary"
}
export declare enum ArtifactType {
    SUBDOMAIN_LIST = "subdomain_list",
    LIVE_HOSTS = "live_hosts",
    SCREENSHOT = "screenshot",
    VULNERABILITY_REPORT = "vulnerability_report",
    LOG_FILE = "log_file",
    CONFIG_FILE = "config_file",
    OTHER = "other"
}
export interface ExecutionMode {
    FULL: string[];
    CUSTOM: string[];
    SINGLE_TOOL: string[];
}
export declare const TOOLS: Record<string, ToolConfig>;
export declare const EXECUTION_MODES: ExecutionMode;
export declare const TOOL_DEPENDENCIES: Record<string, string[]>;
//# sourceMappingURL=tools.d.ts.map