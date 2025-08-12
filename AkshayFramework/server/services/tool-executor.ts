import { spawn, ChildProcess } from 'child_process';
import { promises as fs, existsSync, mkdirSync } from 'fs';
import path from 'path';
import { storage } from '../storage';
import { WebSocketManager } from './websocket-manager';
import { resultParser } from './result-parser';
import { Tool, Target, Execution } from '@shared/schema';

export class ToolExecutor {
  private runningProcesses: Map<string, ChildProcess> = new Map();
  private workspaceDir: string;

  constructor(private wsManager: WebSocketManager) {
    this.workspaceDir = path.join(process.cwd(), 'workspace');
    this.ensureWorkspaceDir();
  }

  private async ensureWorkspaceDir(): Promise<void> {
    try {
      await fs.mkdir(this.workspaceDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create workspace directory:', error);
    }
  }

  async cancelExecution(executionId: string): Promise<void> {
    const process = this.runningProcesses.get(executionId);
    if (process && !process.killed) {
      process.kill('SIGTERM');
      this.runningProcesses.delete(executionId);
    }
  }

  async executeToolAsync(executionId: string, tool: Tool, target: Target): Promise<void> {
    const execution = await storage.getExecution(executionId);
    if (!execution) {
      console.error(`Execution ${executionId} not found`);
      return;
    }

    try {
      // Update execution status to running
      await storage.updateExecution(executionId, {
        status: 'running',
        startedAt: new Date(),
        progress: 0,
      });

      // Send WebSocket notification
      this.wsManager.broadcast({
        type: 'execution_started',
        executionId,
        targetId: target.id,
        toolId: tool.id,
        data: {
          toolName: tool.name,
          targetName: target.name,
        },
      });

      // Auto-execute dependencies if missing
      await this.executeRequiredDependencies(tool, target);

      // Prepare command and workspace
      const targetDir = path.join(this.workspaceDir, target.id);
      await fs.mkdir(targetDir, { recursive: true });

      // Create initial input files if they don't exist
      await this.createInitialFiles(target, targetDir);

      // Execute the tool
      const command = await this.prepareCommand(tool, target, targetDir);
      const process = await this.executeCommand(command, targetDir);
      
      this.runningProcesses.set(executionId, process);

      // Monitor execution progress
      await this.monitorExecution(executionId, process, tool, target);

    } catch (error: any) {
      console.error(`Tool execution failed for ${tool.name}:`, error);
      
      await storage.updateExecution(executionId, {
        status: 'failed',
        errorMessage: error.message,
        completedAt: new Date(),
      });

      this.wsManager.broadcast({
        type: 'execution_failed',
        executionId,
        targetId: target.id,
        toolId: tool.id,
        data: {
          toolName: tool.name,
          error: error.message,
        },
      });
    }
  }

  private async executeRequiredDependencies(tool: Tool, target: Target): Promise<void> {
    if (!tool.dependencies || tool.dependencies.length === 0) return;

    const existingExecutions = await storage.getExecutionsByTarget(target.id);
    const completedTools = existingExecutions
      .filter(exec => exec.status === 'completed')
      .map(exec => exec.toolId);

    const allTools = await storage.getTools();
    const toolsMap = new Map(allTools.map(t => [t.id, t]));

    // Build execution chain for missing dependencies
    const executionChain = this.buildDependencyChain(tool, toolsMap, completedTools);

    // Execute missing dependencies in order
    for (const dependencyId of executionChain) {
      if (!completedTools.includes(dependencyId)) {
        const dependencyTool = toolsMap.get(dependencyId);
        if (dependencyTool) {
          console.log(`Auto-executing dependency: ${dependencyTool.name} for ${tool.name}`);
          
          const depExecution = await storage.createExecution({
            targetId: target.id,
            toolId: dependencyId,
            command: dependencyTool.command,
            status: 'pending',
          });

          await this.executeToolAsync(depExecution.id, dependencyTool, target);
          
          // Wait for completion before proceeding
          await this.waitForExecution(depExecution.id);
        }
      }
    }
  }

  private buildDependencyChain(tool: Tool, toolsMap: Map<string, Tool>, completedTools: string[]): string[] {
    const chain: string[] = [];
    const visited = new Set<string>();

    const addDependencies = (currentTool: Tool) => {
      if (visited.has(currentTool.id)) return;
      visited.add(currentTool.id);

      if (currentTool.dependencies) {
        for (const depId of currentTool.dependencies) {
          const depTool = toolsMap.get(depId);
          if (depTool && !completedTools.includes(depId)) {
            addDependencies(depTool);
            if (!chain.includes(depId)) {
              chain.push(depId);
            }
          }
        }
      }
    };

    addDependencies(tool);
    return chain;
  }

  private async waitForExecution(executionId: string): Promise<void> {
    return new Promise((resolve) => {
      const checkStatus = async () => {
        const execution = await storage.getExecution(executionId);
        if (execution && (execution.status === 'completed' || execution.status === 'failed')) {
          resolve();
        } else {
          setTimeout(checkStatus, 1000);
        }
      };
      checkStatus();
    });
  }

  private async checkDependencies(tool: Tool, targetId: string): Promise<string[]> {
    const missingDeps: string[] = [];
    
    if (tool.dependencies && tool.dependencies.length > 0) {
      const executions = await storage.getExecutionsByTarget(targetId);
      const completedTools = executions
        .filter(exec => exec.status === 'completed')
        .map(exec => exec.toolId);

      for (const dep of tool.dependencies) {
        if (!completedTools.includes(dep)) {
          missingDeps.push(dep);
        }
      }
    }

    // Check if required input files exist
    if (tool.inputFiles && tool.inputFiles.length > 0) {
      const targetDir = path.join(this.workspaceDir, targetId);
      
      for (const inputFile of tool.inputFiles) {
        const filePath = path.join(targetDir, inputFile);
        try {
          await fs.access(filePath);
        } catch {
          // If file doesn't exist and it's not a base input file, mark as missing
          if (!['roots.txt', 'domains.txt'].includes(inputFile)) {
            missingDeps.push(`file:${inputFile}`);
          }
        }
      }
    }

    return missingDeps;
  }

  private async createInitialFiles(target: Target, targetDir: string): Promise<void> {
    // Create roots.txt file
    const rootsFile = path.join(targetDir, 'roots.txt');
    try {
      await fs.access(rootsFile);
    } catch {
      // File doesn't exist, create it
      let content = '';
      if (target.domain) {
        content = target.domain;
      } else if (target.urls) {
        content = target.urls.join('\n');
      }
      
      if (content) {
        await fs.writeFile(rootsFile, content);
      }
    }

    // Create domains.txt file (same as roots.txt for compatibility)
    const domainsFile = path.join(targetDir, 'domains.txt');
    try {
      await fs.access(domainsFile);
    } catch {
      const rootsContent = await fs.readFile(rootsFile, 'utf-8').catch(() => '');
      if (rootsContent) {
        await fs.writeFile(domainsFile, rootsContent);
      }
    }
  }

  private async prepareCommand(tool: Tool, target: Target, targetDir: string): Promise<string> {
    let command = tool.command;

    // Check if we're in demo mode (Replit environment)
    const isDemo = !existsSync('/usr/bin/subfinder') && !existsSync('/usr/local/bin/subfinder');
    
    if (isDemo) {
      // Use demo tools for Replit demonstration
      const demoScript = path.join(process.cwd(), 'demo-tools.sh');
      const inputFile = path.join(targetDir, tool.inputFiles?.[0] || 'roots.txt');
      const outputFile = path.join(targetDir, tool.outputFiles?.[0] || `${tool.id}_output.txt`);
      
      // Create input file if it doesn't exist
      if (!existsSync(inputFile) && target.domain) {
        await fs.writeFile(inputFile, target.domain);
      }
      
      return `bash ${demoScript} ${tool.id} ${inputFile} ${outputFile}`;
    }

    // Production mode - use real tools
    // Handle Aquatone Chrome path for Windows
    const chromePath = process.env.AQUATONE_CHROME_PATH || 'C:\\Users\\aksha\\Documents\\Docker\\chrome-win\\chrome.exe';
    command = command.replace(/{chrome_path}/g, chromePath);

    // Replace standard placeholders
    command = command.replace(/{input}/g, path.join(targetDir, tool.inputFiles?.[0] || 'roots.txt'));
    command = command.replace(/{output}/g, path.join(targetDir, tool.outputFiles?.[0] || `${tool.id}_output.txt`));
    command = command.replace(/{api_key}/g, process.env[`${tool.id.toUpperCase()}_API_KEY`] || process.env.CHAOS_API_KEY || 'missing_api_key');

    // Handle specific tool command patterns
    if (tool.id === 'amass') {
      const amassOutput = path.join(targetDir, 'amass_raw_output.json');
      const finalOutput = path.join(targetDir, tool.outputFiles?.[0] || 'subdomains_amass.txt');
      command = command.replace(/{amass_output}/g, amassOutput);
      command = command.replace(/{output}/g, finalOutput);
    }

    if (tool.id === 'dns-resolution') {
      const unresolvedOutput = path.join(targetDir, 'unresolved_hosts.txt');
      const finalOutput = path.join(targetDir, 'resolved_hosts.txt');
      command = command.replace(/{unresolved_output}/g, unresolvedOutput);
      command = command.replace(/{output}/g, finalOutput);
    }

    if (tool.id === 'httpx') {
      const techOutput = path.join(targetDir, 'live_hosts_with_tech.txt');
      const urlsOutput = path.join(targetDir, 'live_urls.txt');
      command = command.replace(/{output}/g, `${techOutput} && cat ${techOutput} | grep -E "https?://" > ${urlsOutput}`);
    }

    if (tool.id === 'naabu') {
      const naabuOutput = path.join(targetDir, 'naabu_all_ports.txt');
      const finalOutput = path.join(targetDir, 'high_value_ports.txt');
      command = command.replace(/{naabu_output}/g, naabuOutput);
      command = command.replace(/{output}/g, finalOutput);
    }

    if (tool.id === 'aquatone') {
      const outputDir = path.join(targetDir, 'aquatone_report');
      command = command.replace(/{output_dir}/g, outputDir);
    }

    if (tool.id === 'url-compilation') {
      const gauInput = path.join(targetDir, 'gau_urls.txt');
      const waybackInput = path.join(targetDir, 'wayback_urls.txt');
      const katanaInput = path.join(targetDir, 'katana_urls.txt');
      command = command.replace(/{gau_input}/g, gauInput);
      command = command.replace(/{wayback_input}/g, waybackInput);
      command = command.replace(/{katana_input}/g, katanaInput);
    }

    if (tool.id === 'gau' || tool.id === 'wayback') {
      // Extract domains from resolved_hosts.txt for URL discovery tools
      const domainsFile = path.join(targetDir, 'domains_for_urls.txt');
      command = `cat ${path.join(targetDir, 'resolved_hosts.txt')} | cut -d':' -f1 | sort -u > ${domainsFile} && ` + command.replace(/{domains}/g, `$(cat ${domainsFile})`);
    }

    if (tool.id === 'sqlmap') {
      const outputDir = path.join(targetDir, 'sqlmap_results');
      command = command.replace(/{output_dir}/g, outputDir);
    }

    // Handle multiple input files
    if (tool.inputFiles && tool.inputFiles.length > 1) {
      const inputFiles = tool.inputFiles.map(file => path.join(targetDir, file)).join(' ');
      command = command.replace(/{input}/g, inputFiles);
    }

    return command;
  }

  private async executeCommand(command: string, workingDir: string): Promise<ChildProcess> {
    return new Promise((resolve, reject) => {
      console.log(`[TOOL-EXECUTOR] Executing command: ${command}`);
      console.log(`[TOOL-EXECUTOR] Working directory: ${workingDir}`);
      
      // Ensure working directory exists
      if (!existsSync(workingDir)) {
        mkdirSync(workingDir, { recursive: true });
      }

      // Expand environment variables and paths
      const expandedCommand: string = command
        .replace(/\$HOME/g, process.env.HOME || '/home/user')
        .replace(/\$GOPATH/g, process.env.GOPATH || `${process.env.HOME}/go`)
        .replace(/\$PATH/g, process.env.PATH || '');

      console.log(`[TOOL-EXECUTOR] Expanded command: ${expandedCommand}`);
      
      const childProcess = spawn('bash', ['-c', expandedCommand], {
        cwd: workingDir,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          PATH: `/usr/bin:/usr/local/bin:${process.env.HOME}/go/bin:${process.env.HOME}/.local/bin:${process.env.PATH}`,
          GOPATH: process.env.GOPATH || `${process.env.HOME}/go`,
          HOME: process.env.HOME || '/home/user'
        }
      });

      childProcess.on('error', (error: any) => {
        console.error(`[TOOL-EXECUTOR] Process error:`, error);
        reject(new Error(`Failed to start process: ${error.message}`));
      });

      // Return process immediately for monitoring
      setTimeout(() => resolve(childProcess), 100);
    });
  }

  private async monitorExecution(
    executionId: string,
    process: ChildProcess,
    tool: Tool,
    target: Target
  ): Promise<void> {
    let output = '';
    let errorOutput = '';

    // Simulate progress updates
    const progressInterval = setInterval(async () => {
      const execution = await storage.getExecution(executionId);
      if (!execution || execution.status !== 'running') {
        clearInterval(progressInterval);
        return;
      }

      const newProgress = Math.min(100, (execution.progress || 0) + Math.random() * 10);
      await storage.updateExecution(executionId, { progress: Math.floor(newProgress) });

      this.wsManager.broadcast({
        type: 'execution_progress',
        executionId,
        targetId: target.id,
        toolId: tool.id,
        data: {
          progress: Math.floor(newProgress),
          toolName: tool.name,
        },
      });
    }, 2000);

    // Collect output
    if (process.stdout) {
      process.stdout.on('data', (data) => {
        output += data.toString();
      });
    }

    if (process.stderr) {
      process.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
    }

    process.on('close', async (code) => {
      clearInterval(progressInterval);
      this.runningProcesses.delete(executionId);

      if (code === 0) {
        // Success
        await storage.updateExecution(executionId, {
          status: 'completed',
          progress: 100,
          output: `Completed successfully`,
          completedAt: new Date(),
        });

        // Parse and store results
        if (tool.outputFiles) {
          await resultParser.parseToolOutput(executionId, tool.id, target.id, tool.outputFiles, this.workspaceDir);
        }

        this.wsManager.broadcast({
          type: 'execution_completed',
          executionId,
          targetId: target.id,
          toolId: tool.id,
          data: {
            toolName: tool.name,
            output: output || 'Completed successfully',
          },
        });

        // Update target statistics
        await this.updateTargetStatistics(target.id);

      } else {
        // Failure
        await storage.updateExecution(executionId, {
          status: 'failed',
          errorMessage: errorOutput || `Process exited with code ${code}`,
          completedAt: new Date(),
        });

        this.wsManager.broadcast({
          type: 'execution_failed',
          executionId,
          targetId: target.id,
          toolId: tool.id,
          data: {
            toolName: tool.name,
            error: errorOutput || `Process exited with code ${code}`,
          },
        });
      }
    });

    process.on('error', async (error) => {
      clearInterval(progressInterval);
      this.runningProcesses.delete(executionId);

      await storage.updateExecution(executionId, {
        status: 'failed',
        errorMessage: error.message,
        completedAt: new Date(),
      });

      this.wsManager.broadcast({
        type: 'execution_failed',
        executionId,
        targetId: target.id,
        toolId: tool.id,
        data: {
          toolName: tool.name,
          error: error.message,
        },
      });
    });
  }

  private async processOutputFiles(executionId: string, tool: Tool, target: Target): Promise<void> {
    if (!tool.outputFiles) return;

    const targetDir = path.join(this.workspaceDir, target.id);

    for (const outputFile of tool.outputFiles) {
      const filePath = path.join(targetDir, outputFile);
      
      try {
        const stats = await fs.stat(filePath);
        const content = await fs.readFile(filePath, 'utf-8');

        await storage.createFile({
          targetId: target.id,
          executionId,
          filename: outputFile,
          filepath: filePath,
          filesize: stats.size,
          contentType: 'text/plain',
          content: content.slice(0, 50000), // Limit content size
        });

        // Parse results for vulnerabilities (simplified)
        if (tool.id === 'nuclei') {
          await this.parseNucleiResults(content, target.id, executionId, tool.id);
        }

      } catch (error) {
        console.error(`Failed to process output file ${outputFile}:`, error);
      }
    }
  }

  private async parseNucleiResults(content: string, targetId: string, executionId: string, toolId: string): Promise<void> {
    // Simple parsing for demonstration - in production, you'd want proper JSON parsing
    const lines = content.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      if (line.includes('[') && line.includes(']')) {
        try {
          // Extract basic vulnerability info
          const severityMatch = line.match(/\[(low|medium|high|critical)\]/i);
          const urlMatch = line.match(/(https?:\/\/[^\s]+)/);
          const titleMatch = line.match(/\[([^\]]+)\]/g);

          if (severityMatch && urlMatch) {
            await storage.createVulnerability({
              targetId,
              executionId,
              toolId,
              severity: severityMatch[1].toLowerCase(),
              title: titleMatch?.[titleMatch.length - 1]?.replace(/[\[\]]/g, '') || 'Unknown vulnerability',
              description: line,
              url: urlMatch[1],
              host: new URL(urlMatch[1]).hostname,
              evidence: line,
            });

            this.wsManager.broadcast({
              type: 'vulnerability_found',
              targetId,
              toolId,
              data: {
                severity: severityMatch[1].toLowerCase(),
                title: titleMatch?.[titleMatch.length - 1]?.replace(/[\[\]]/g, '') || 'Unknown vulnerability',
                host: new URL(urlMatch[1]).hostname,
              },
            });
          }
        } catch (error) {
          console.error('Failed to parse vulnerability result:', error);
        }
      }
    }
  }

  private async updateTargetStats(targetId: string): Promise<void> {
    const files = await storage.getFilesByTarget(targetId);
    const vulnerabilities = await storage.getVulnerabilitiesByTarget(targetId);

    // Count subdomains and hosts from files
    let subdomainCount = 0;
    let hostCount = 0;

    for (const file of files) {
      if (file.filename.includes('subdomains') && file.content) {
        const lines = file.content.split('\n').filter(line => line.trim());
        subdomainCount = Math.max(subdomainCount, lines.length);
      }
      if (file.filename.includes('resolved') && file.content) {
        const lines = file.content.split('\n').filter(line => line.trim());
        hostCount = Math.max(hostCount, lines.length);
      }
    }

    await storage.updateTarget(targetId, {
      subdomainCount,
      hostCount,
      vulnerabilityCount: vulnerabilities.length,
      status: 'completed', // This would be more sophisticated in production
    });
  }

  private async updateTargetStatistics(targetId: string): Promise<void> {
    try {
      const files = await storage.getFilesByTarget(targetId);
      const vulnerabilities = await storage.getVulnerabilitiesByTarget(targetId);
      
      // Count subdomains from subdomain files
      let subdomainCount = 0;
      let hostCount = 0;
      
      for (const file of files) {
        if (file.filename.includes('subdomain') || file.filename.includes('hosts')) {
          if (file.content) {
            const lines = file.content.split('\n').filter(line => line.trim());
            if (file.filename.includes('subdomain')) {
              subdomainCount = Math.max(subdomainCount, lines.length);
            } else if (file.filename.includes('live_urls')) {
              hostCount = Math.max(hostCount, lines.length);
            }
          }
        }
      }
      
      await storage.updateTarget(targetId, {
        subdomainCount,
        hostCount,
        vulnerabilityCount: vulnerabilities.length,
        status: vulnerabilities.length > 0 ? 'completed' : 'running'
      });
      
    } catch (error) {
      console.error('Error updating target statistics:', error);
    }
  }

  async stopExecution(executionId: string): Promise<void> {
    const process = this.runningProcesses.get(executionId);
    if (process) {
      process.kill('SIGTERM');
      this.runningProcesses.delete(executionId);

      await storage.updateExecution(executionId, {
        status: 'failed',
        errorMessage: 'Stopped by user',
        completedAt: new Date(),
      });
    }
  }
}
