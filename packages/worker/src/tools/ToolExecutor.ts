import { execa } from 'execa';
import Docker from 'dockerode';
import fs from 'fs-extra';
import path from 'path';
import { logger } from '../utils/logger';
import { ToolConfig, ToolExecution, ToolResult, Artifact, ArtifactType } from '../types/tools';

export class ToolExecutor {
  private docker: Docker;
  private executionMode: 'docker' | 'native';

  constructor() {
    this.docker = new Docker();
    this.executionMode = (process.env.EXECUTION_MODE as 'docker' | 'native') || 'docker';
  }

  async executeTool(execution: ToolExecution, config: ToolConfig): Promise<ToolResult> {
    const startTime = Date.now();
    logger.info(`Starting tool execution: ${execution.tool} for target: ${execution.target}`);

    try {
      // Ensure working directory exists
      await fs.ensureDir(execution.workingDir);

      let result: ToolResult;

      if (this.executionMode === 'docker' && config.dockerImage) {
        result = await this.executeInDocker(execution, config);
      } else {
        result = await this.executeNative(execution, config);
      }

      result.executionTime = Date.now() - startTime;
      logger.info(`Tool execution completed: ${execution.tool} in ${result.executionTime}ms`);

      return result;
    } catch (error) {
      logger.error(`Tool execution failed: ${execution.tool}`, error);
      
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Unknown error',
        artifacts: [],
        executionTime: Date.now() - startTime
      };
    }
  }

  private async executeInDocker(execution: ToolExecution, config: ToolConfig): Promise<ToolResult> {
    const containerName = `akshays-${execution.tool}-${Date.now()}`;
    
    try {
      // Prepare Docker run options
      const dockerArgs = this.buildDockerArgs(execution, config);
      
      logger.info(`Running Docker container: ${config.dockerImage} with args: ${dockerArgs.join(' ')}`);

      // Run Docker container
      const container = await this.docker.createContainer({
        Image: config.dockerImage,
        name: containerName,
        Cmd: dockerArgs,
        HostConfig: {
          Binds: [
            `${execution.workingDir}:/data`,
            `${path.dirname(execution.outputPath)}:/output`
          ],
          Memory: 512 * 1024 * 1024, // 512MB
          MemorySwap: 1024 * 1024 * 1024, // 1GB
          CpuQuota: 50000, // 50% CPU
          CpuPeriod: 100000,
          NetworkMode: 'host'
        },
        WorkingDir: '/data',
        Env: this.getEnvironmentVariables(execution)
      });

      await container.start();

      // Wait for container to complete
      const { StatusCode } = await container.wait();
      
      // Get container logs
      const logs = await container.logs({
        stdout: true,
        stderr: true
      });

      const output = logs.toString();

      // Remove container
      await container.remove();

      // Check if execution was successful
      const success = StatusCode === 0;
      
      // Collect artifacts
      const artifacts = await this.collectArtifacts(execution.workingDir, execution.tool);

      return {
        success,
        output,
        artifacts,
        executionTime: 0 // Will be set by caller
      };

    } catch (error) {
      logger.error(`Docker execution failed for ${execution.tool}:`, error);
      
      // Try to clean up container
      try {
        const container = this.docker.getContainer(containerName);
        await container.remove();
      } catch (cleanupError) {
        logger.warn(`Failed to clean up container ${containerName}:`, cleanupError);
      }

      throw error;
    }
  }

  private async executeNative(execution: ToolExecution, config: ToolConfig): Promise<ToolResult> {
    const toolPath = config.nativePath || execution.tool;
    
    try {
      logger.info(`Running native tool: ${toolPath} with args: ${execution.args.join(' ')}`);

      const { stdout, stderr, exitCode } = await execa(toolPath, execution.args, {
        cwd: execution.workingDir,
        timeout: execution.timeout,
        env: this.getEnvironmentVariables(execution),
        maxBuffer: 1024 * 1024 * 10 // 10MB
      });

      const success = exitCode === 0;
      const output = stdout + (stderr ? '\n' + stderr : '');

      // Collect artifacts
      const artifacts = await this.collectArtifacts(execution.workingDir, execution.tool);

      return {
        success,
        output,
        artifacts,
        executionTime: 0 // Will be set by caller
      };

    } catch (error) {
      logger.error(`Native execution failed for ${execution.tool}:`, error);
      throw error;
    }
  }

  private buildDockerArgs(execution: ToolExecution, config: ToolConfig): string[] {
    const args = [...config.defaultArgs, ...execution.args];
    
    // Add target-specific arguments
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

  private getEnvironmentVariables(execution: ToolExecution): Record<string, string> {
    const env: Record<string, string> = {
      ...process.env,
      TARGET: execution.target,
      OUTPUT_PATH: execution.outputPath,
      WORKING_DIR: execution.workingDir
    };

    // Add API keys if available
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

  private async collectArtifacts(workingDir: string, toolName: string): Promise<Artifact[]> {
    const artifacts: Artifact[] = [];

    try {
      const files = await fs.readdir(workingDir);
      
      for (const file of files) {
        const filePath = path.join(workingDir, file);
        const stats = await fs.stat(filePath);
        
        if (stats.isFile()) {
          const artifact: Artifact = {
            name: `${toolName}_${file}`,
            path: filePath,
            type: this.getArtifactType(file, toolName),
            size: stats.size,
            mimeType: this.getMimeType(file)
          };

          artifacts.push(artifact);
        }
      }
    } catch (error) {
      logger.warn(`Failed to collect artifacts from ${workingDir}:`, error);
    }

    return artifacts;
  }

  private getArtifactType(filename: string, toolName: string): ArtifactType {
    const ext = path.extname(filename).toLowerCase();
    
    switch (toolName) {
      case 'subfinder':
      case 'assetfinder':
      case 'findomain':
      case 'chaos':
      case 'amass':
      case 'dnsx':
        return ArtifactType.SUBDOMAIN_LIST;
      case 'httpx':
        return ArtifactType.LIVE_HOSTS;
      case 'aquatone':
        if (ext === '.html') return ArtifactType.SCREENSHOT;
        break;
      case 'nuclei':
      case 'nikto':
        return ArtifactType.VULNERABILITY_REPORT;
      case 'gau':
      case 'waybackurls':
      case 'katana':
      case 'arjun':
      case 'gobuster':
      case 'ffuf':
        return ArtifactType.CONTENT_DISCOVERY;
    }

    if (ext === '.log') return ArtifactType.LOG_FILE;
    if (ext === '.json') return ArtifactType.CONFIG_FILE;
    
    return ArtifactType.OTHER;
  }

  private getMimeType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    
    const mimeTypes: Record<string, string> = {
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