"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolExecutor = void 0;
const execa_1 = require("execa");
const dockerode_1 = __importDefault(require("dockerode"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const logger_1 = require("../utils/logger");
const tools_1 = require("../types/tools");
class ToolExecutor {
    docker;
    executionMode;
    constructor() {
        this.docker = new dockerode_1.default();
        this.executionMode = process.env.EXECUTION_MODE || 'docker';
    }
    async executeTool(execution, config) {
        const startTime = Date.now();
        logger_1.logger.info(`Starting tool execution: ${execution.tool} for target: ${execution.target}`);
        try {
            await fs_extra_1.default.ensureDir(execution.workingDir);
            let result;
            if (this.executionMode === 'docker' && config.dockerImage) {
                result = await this.executeInDocker(execution, config);
            }
            else {
                result = await this.executeNative(execution, config);
            }
            result.executionTime = Date.now() - startTime;
            logger_1.logger.info(`Tool execution completed: ${execution.tool} in ${result.executionTime}ms`);
            return result;
        }
        catch (error) {
            logger_1.logger.error(`Tool execution failed: ${execution.tool}`, error);
            return {
                success: false,
                output: '',
                error: error instanceof Error ? error.message : 'Unknown error',
                artifacts: [],
                executionTime: Date.now() - startTime
            };
        }
    }
    async executeInDocker(execution, config) {
        const containerName = `akshays-${execution.tool}-${Date.now()}`;
        try {
            const dockerArgs = this.buildDockerArgs(execution, config);
            logger_1.logger.info(`Running Docker container: ${config.dockerImage} with args: ${dockerArgs.join(' ')}`);
            const container = await this.docker.createContainer({
                Image: config.dockerImage,
                name: containerName,
                Cmd: dockerArgs,
                HostConfig: {
                    Binds: [
                        `${execution.workingDir}:/data`,
                        `${path_1.default.dirname(execution.outputPath)}:/output`
                    ],
                    Memory: 512 * 1024 * 1024,
                    MemorySwap: 1024 * 1024 * 1024,
                    CpuQuota: 50000,
                    CpuPeriod: 100000,
                    NetworkMode: 'host'
                },
                WorkingDir: '/data',
                Env: this.getEnvironmentVariables(execution)
            });
            await container.start();
            const { StatusCode } = await container.wait();
            const logs = await container.logs({
                stdout: true,
                stderr: true
            });
            const output = logs.toString();
            await container.remove();
            const success = StatusCode === 0;
            const artifacts = await this.collectArtifacts(execution.workingDir, execution.tool);
            return {
                success,
                output,
                artifacts,
                executionTime: 0
            };
        }
        catch (error) {
            logger_1.logger.error(`Docker execution failed for ${execution.tool}:`, error);
            try {
                const container = this.docker.getContainer(containerName);
                await container.remove();
            }
            catch (cleanupError) {
                logger_1.logger.warn(`Failed to clean up container ${containerName}:`, cleanupError);
            }
            throw error;
        }
    }
    async executeNative(execution, config) {
        const toolPath = config.nativePath || execution.tool;
        try {
            logger_1.logger.info(`Running native tool: ${toolPath} with args: ${execution.args.join(' ')}`);
            const { stdout, stderr, exitCode } = await (0, execa_1.execa)(toolPath, execution.args, {
                cwd: execution.workingDir,
                timeout: execution.timeout,
                env: this.getEnvironmentVariables(execution),
                maxBuffer: 1024 * 1024 * 10
            });
            const success = exitCode === 0;
            const output = stdout + (stderr ? '\n' + stderr : '');
            const artifacts = await this.collectArtifacts(execution.workingDir, execution.tool);
            return {
                success,
                output,
                artifacts,
                executionTime: 0
            };
        }
        catch (error) {
            logger_1.logger.error(`Native execution failed for ${execution.tool}:`, error);
            throw error;
        }
    }
    buildDockerArgs(execution, config) {
        const args = [...config.defaultArgs, ...execution.args];
        switch (execution.tool) {
            case 'subfinder':
                args.unshift('-d', execution.target);
                break;
            case 'assetfinder':
                args.unshift(execution.target);
                break;
            case 'findomain':
                args.unshift('-t', execution.target);
                break;
            case 'chaos':
                args.unshift('-d', execution.target);
                break;
            case 'amass':
                args.unshift('enum', '-d', execution.target);
                break;
            case 'dnsx':
                args.unshift('-l', '/data/subdomains.txt');
                break;
            case 'httpx':
                args.unshift('-l', '/data/live_hosts.txt');
                break;
            case 'aquatone':
                args.unshift('-out', '/output/aquatone_report');
                args.unshift('-in', '/data/live_urls.txt');
                break;
            case 'gau':
                args.unshift(execution.target);
                break;
            case 'waybackurls':
                args.unshift(execution.target);
                break;
            case 'katana':
                args.unshift('-list', '/data/live_urls.txt');
                break;
            case 'arjun':
                args.unshift('-i', '/data/live_urls.txt');
                break;
            case 'gobuster':
                args.unshift('dir', '-u', `https://${execution.target}`, '-w', '/usr/share/wordlists/common.txt');
                break;
            case 'ffuf':
                args.unshift('-u', `https://${execution.target}/FUZZ`, '-w', '/usr/share/wordlists/common.txt');
                break;
            case 'nuclei':
                args.unshift('-l', '/data/live_urls.txt');
                break;
            case 'nikto':
                args.unshift('-h', execution.target);
                break;
        }
        return args;
    }
    getEnvironmentVariables(execution) {
        const env = {
            ...process.env,
            TARGET: execution.target,
            OUTPUT_PATH: execution.outputPath,
            WORKING_DIR: execution.workingDir
        };
        if (process.env.CHAOS_API_KEY) {
            env.CHAOS_API_KEY = process.env.CHAOS_API_KEY;
        }
        if (process.env.GITHUB_TOKEN) {
            env.GITHUB_TOKEN = process.env.GITHUB_TOKEN;
        }
        if (process.env.SHODAN_API_KEY) {
            env.SHODAN_API_KEY = process.env.SHODAN_API_KEY;
        }
        return env;
    }
    async collectArtifacts(workingDir, toolName) {
        const artifacts = [];
        try {
            const files = await fs_extra_1.default.readdir(workingDir);
            for (const file of files) {
                const filePath = path_1.default.join(workingDir, file);
                const stats = await fs_extra_1.default.stat(filePath);
                if (stats.isFile()) {
                    const artifact = {
                        name: `${toolName}_${file}`,
                        path: filePath,
                        type: this.getArtifactType(file, toolName),
                        size: stats.size,
                        mimeType: this.getMimeType(file)
                    };
                    artifacts.push(artifact);
                }
            }
        }
        catch (error) {
            logger_1.logger.warn(`Failed to collect artifacts from ${workingDir}:`, error);
        }
        return artifacts;
    }
    getArtifactType(filename, toolName) {
        const ext = path_1.default.extname(filename).toLowerCase();
        switch (toolName) {
            case 'subfinder':
            case 'assetfinder':
            case 'findomain':
            case 'chaos':
            case 'amass':
            case 'dnsx':
                return tools_1.ArtifactType.SUBDOMAIN_LIST;
            case 'httpx':
                return tools_1.ArtifactType.LIVE_HOSTS;
            case 'aquatone':
                if (ext === '.html')
                    return tools_1.ArtifactType.SCREENSHOT;
                break;
            case 'nuclei':
            case 'nikto':
                return tools_1.ArtifactType.VULNERABILITY_REPORT;
            case 'gau':
            case 'waybackurls':
            case 'katana':
            case 'arjun':
            case 'gobuster':
            case 'ffuf':
                return tools_1.ArtifactType.CONTENT_DISCOVERY;
        }
        if (ext === '.log')
            return tools_1.ArtifactType.LOG_FILE;
        if (ext === '.json')
            return tools_1.ArtifactType.CONFIG_FILE;
        return tools_1.ArtifactType.OTHER;
    }
    getMimeType(filename) {
        const ext = path_1.default.extname(filename).toLowerCase();
        const mimeTypes = {
            '.txt': 'text/plain',
            '.json': 'application/json',
            '.csv': 'text/csv',
            '.html': 'text/html',
            '.xml': 'application/xml',
            '.log': 'text/plain',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.pdf': 'application/pdf'
        };
        return mimeTypes[ext] || 'application/octet-stream';
    }
}
exports.ToolExecutor = ToolExecutor;
//# sourceMappingURL=ToolExecutor.js.map