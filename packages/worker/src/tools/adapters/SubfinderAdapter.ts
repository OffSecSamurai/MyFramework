import { ToolConfig, ToolExecution, ToolResult } from '../../types/tools';
import { ToolExecutor } from '../ToolExecutor';
import { logger } from '../../utils/logger';

export class SubfinderAdapter {
  private executor: ToolExecutor;

  constructor() {
    this.executor = new ToolExecutor();
  }

  async execute(execution: ToolExecution): Promise<ToolResult> {
    logger.info(`Executing Subfinder for target: ${execution.target}`);

    const config: ToolConfig = {
      name: 'Subfinder',
      description: 'Fast subdomain enumeration tool',
      category: 'subdomain_enumeration' as any,
      dependencies: [],
      dockerImage: 'projectdiscovery/subfinder:latest',
      defaultArgs: ['-silent', '-o', 'subdomains.txt'],
      outputFormats: ['text'] as any,
      timeout: 300000,
      maxThreads: 50
    };

    // Add target-specific arguments
    const args = ['-d', execution.target, ...config.defaultArgs];

    const modifiedExecution: ToolExecution = {
      ...execution,
      args
    };

    return await this.executor.executeTool(modifiedExecution, config);
  }

  async processResults(result: ToolResult, target: string): Promise<any> {
    if (!result.success) {
      logger.warn('Subfinder execution failed, skipping result processing');
      return null;
    }

    // Extract subdomains from output
    const subdomains = this.extractSubdomains(result.output);
    
    logger.info(`Subfinder found ${subdomains.length} subdomains for ${target}`);

    return {
      subdomains,
      count: subdomains.length,
      target
    };
  }

  private extractSubdomains(output: string): string[] {
    const lines = output.split('\n').filter(line => line.trim());
    const subdomains = new Set<string>();
    
    for (const line of lines) {
      // Match domain patterns
      const match = line.match(/^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/);
      if (match) {
        subdomains.add(match[0]);
      }
    }
    
    return Array.from(subdomains);
  }
}