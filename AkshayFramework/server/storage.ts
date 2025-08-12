import { 
  type Target, 
  type InsertTarget, 
  type Tool, 
  type InsertTool,
  type Execution,
  type InsertExecution,
  type File,
  type InsertFile,
  type Vulnerability,
  type InsertVulnerability
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Targets
  getTargets(): Promise<Target[]>;
  getTarget(id: string): Promise<Target | undefined>;
  createTarget(target: InsertTarget): Promise<Target>;
  updateTarget(id: string, target: Partial<Target>): Promise<Target>;
  deleteTarget(id: string): Promise<void>;
  
  // Tools
  getTools(): Promise<Tool[]>;
  getTool(id: string): Promise<Tool | undefined>;
  createTool(tool: InsertTool): Promise<Tool>;
  updateTool(id: string, tool: Partial<Tool>): Promise<Tool>;
  initializeTools(): Promise<void>;
  
  // Executions
  getExecutions(): Promise<Execution[]>;
  getExecutionsByTarget(targetId: string): Promise<Execution[]>;
  getExecution(id: string): Promise<Execution | undefined>;
  createExecution(execution: InsertExecution): Promise<Execution>;
  updateExecution(id: string, execution: Partial<Execution>): Promise<Execution>;
  deleteExecution(id: string): Promise<void>;
  
  // Files
  getFiles(): Promise<File[]>;
  getFilesByTarget(targetId: string): Promise<File[]>;
  getFile(id: string): Promise<File | undefined>;
  createFile(file: InsertFile): Promise<File>;
  updateFile(id: string, file: Partial<File>): Promise<File>;
  deleteFile(id: string): Promise<void>;
  
  // Vulnerabilities
  getVulnerabilities(): Promise<Vulnerability[]>;
  getVulnerabilitiesByTarget(targetId: string): Promise<Vulnerability[]>;
  getVulnerability(id: string): Promise<Vulnerability | undefined>;
  createVulnerability(vulnerability: InsertVulnerability): Promise<Vulnerability>;
  updateVulnerability(id: string, vulnerability: Partial<Vulnerability>): Promise<Vulnerability>;
  deleteVulnerability(id: string): Promise<void>;
}

export class MemStorage implements IStorage {
  private targets: Map<string, Target> = new Map();
  private tools: Map<string, Tool> = new Map();
  private executions: Map<string, Execution> = new Map();
  private files: Map<string, File> = new Map();
  private vulnerabilities: Map<string, Vulnerability> = new Map();

  async initializeTools(): Promise<void> {
    const defaultTools: InsertTool[] = [
      // Stage 1: Passive Reconnaissance
      { id: 'subfinder', name: 'Subfinder', stage: 1, icon: '🔍', description: 'Fast passive subdomain discovery', command: 'subfinder -dL {input} -o {output}', dependencies: [], inputFiles: ['roots.txt'], outputFiles: ['subdomains_subfinder.txt'] },
      { id: 'assetfinder', name: 'Assetfinder', stage: 1, icon: '🎯', description: 'Find domains and subdomains', command: 'cat {input} | assetfinder --subs-only > {output}', dependencies: [], inputFiles: ['roots.txt'], outputFiles: ['subdomains_assetfinder.txt'] },
      { id: 'findomain', name: 'Findomain', stage: 1, icon: '📡', description: 'Fast subdomain enumeration', command: 'findomain --file {input} --output', dependencies: [], inputFiles: ['roots.txt'], outputFiles: ['subdomains_findomain.txt'] },
      { id: 'chaos', name: 'Chaos', stage: 1, icon: '⚡', description: 'ProjectDiscovery passive DNS data', command: 'chaos -key {api_key} -dL {input} -o {output}', dependencies: [], inputFiles: ['roots.txt'], outputFiles: ['subdomains_chaos.txt'] },
      { id: 'amass', name: 'Amass', stage: 1, icon: '🌐', description: 'Network mapping and external asset discovery', command: 'amass enum -passive -df {input} -json {amass_output} && cat {amass_output} | jq -r ".name" > {output}', dependencies: [], inputFiles: ['roots.txt'], outputFiles: ['amass_raw_output.json', 'subdomains_amass.txt'] },
      { id: 'subdomain-compilation', name: 'Subdomain Compilation', stage: 1, icon: '📋', description: 'Combine and deduplicate all subdomains', command: 'cat subdomains_*.txt *.com.txt 2>/dev/null | cut -d " " -f 1 | sed "s/:\\([0-9]\\+\\)//g" | sed "s/https\\?:\\/\\////" | sort -u > {output}', dependencies: ['subfinder', 'assetfinder', 'findomain', 'chaos', 'amass'], inputFiles: ['subdomains_subfinder.txt', 'subdomains_assetfinder.txt', 'subdomains_findomain.txt', 'subdomains_chaos.txt', 'subdomains_amass.txt'], outputFiles: ['all_subdomains_raw.txt'] },
      { id: 'dns-resolution', name: 'DNS Resolution', stage: 1, icon: '🔗', description: 'Resolve subdomains to IP addresses with wildcard filtering', command: 'wget -O resolvers.txt https://raw.githubusercontent.com/trickest/resolvers/main/resolvers.txt && dnsx -l {input} -r resolvers.txt -a -cname -resp -o {unresolved_output} -silent && cat {unresolved_output} | awk "{print $1}" | sort -u > {output}', dependencies: ['subdomain-compilation'], inputFiles: ['all_subdomains_raw.txt'], outputFiles: ['unresolved_hosts.txt', 'resolved_hosts.txt'] },
      
      // Stage 2: Active Reconnaissance
      { id: 'httpx', name: 'HTTPx', stage: 2, icon: '🌐', description: 'Fast and multi-purpose HTTP toolkit', command: 'httpx -l {input} -o {output} -title -status-code -content-length -tech-detect', dependencies: ['dns-resolution'], inputFiles: ['resolved_hosts.txt'], outputFiles: ['live_hosts_with_tech.txt', 'live_urls.txt'] },
      { id: 'waf-detection', name: 'WAF Detection', stage: 2, icon: '🛡️', description: 'Web application firewall detection', command: 'wafw00f -i {input} -o {output}', dependencies: ['httpx'], inputFiles: ['live_urls.txt'], outputFiles: ['waf_report.txt'] },
      { id: 'naabu', name: 'Port Scanning (Naabu)', stage: 2, icon: '🔬', description: 'Fast port scanner with SYN/CONNECT/UDP probe modes', command: 'naabu -list {input} -o {naabu_output} -p - && grep -E ":(80|443|8080|8443|3000|5000|8000|9000)" {naabu_output} > {output}', dependencies: ['dns-resolution'], inputFiles: ['resolved_hosts.txt'], outputFiles: ['naabu_all_ports.txt', 'high_value_ports.txt'] },
      { id: 'service-detection', name: 'Service Detection', stage: 2, icon: '⚙️', description: 'Detect services on open ports', command: 'nmap -iL {input} -sV -oN {output}', dependencies: ['naabu'], inputFiles: ['high_value_ports.txt'], outputFiles: ['services.txt'] },
      { id: 'aquatone', name: 'Aquatone', stage: 2, icon: '🖼️', description: 'Visual inspection of websites across large scale', command: 'cat {input} | aquatone -out {output_dir} -chrome-path {chrome_path} -ports xlarge', dependencies: ['httpx'], inputFiles: ['live_urls.txt'], outputFiles: ['aquatone_report/'] },
      
      // Stage 3: Spidering & Discovery
      { id: 'gau', name: 'GAU (GetAllURLs)', stage: 3, icon: '🕷️', description: 'Fetch known URLs from AlienVault OTX, Wayback, Common Crawl, and URLScan', command: 'echo {domains} | gau | tee {output}', dependencies: ['dns-resolution'], inputFiles: ['resolved_hosts.txt'], outputFiles: ['gau_urls.txt'] },
      { id: 'wayback', name: 'Wayback URLs', stage: 3, icon: '⏰', description: 'Fetch URLs from Wayback Machine', command: 'echo {domains} | waybackurls | tee {output}', dependencies: ['dns-resolution'], inputFiles: ['resolved_hosts.txt'], outputFiles: ['wayback_urls.txt'] },
      { id: 'katana', name: 'Katana', stage: 3, icon: '🗡️', description: 'Next-generation crawling and spidering framework', command: 'katana -list {input} -o {output} -d 3 -jc -js-crawl -headless', dependencies: ['httpx'], inputFiles: ['live_urls.txt'], outputFiles: ['katana_urls.txt'] },
      { id: 'arjun', name: 'Arjun', stage: 3, icon: '🔍', description: 'HTTP parameter discovery suite', command: 'arjun -i {input} -o {output} -t 10', dependencies: ['httpx'], inputFiles: ['live_urls.txt'], outputFiles: ['parameters.txt'] },
      { id: 'url-compilation', name: 'URL Compilation', stage: 3, icon: '📋', description: 'Compile and deduplicate URLs from all sources', command: 'cat {gau_input} {wayback_input} {katana_input} 2>/dev/null | sort -u | tee {output}', dependencies: ['gau', 'wayback', 'katana'], inputFiles: ['gau_urls.txt', 'wayback_urls.txt', 'katana_urls.txt'], outputFiles: ['all_urls.txt'] },
      { id: 'gf-patterns', name: 'GF Patterns', stage: 3, icon: '🎯', description: 'Filter URLs for specific vulnerability patterns', command: 'cat {input} | gf xss sqli ssrf redirect lfi rce idor | tee {output}', dependencies: ['url-compilation'], inputFiles: ['all_urls.txt'], outputFiles: ['filtered_urls.txt'] },
      
      // Stage 4: Vulnerability Scanning
      { id: 'nuclei', name: 'Nuclei', stage: 4, icon: '☢️', description: 'Fast and customizable vulnerability scanner based on simple YAML DSL', command: 'nuclei -list {input} -o {output} -severity low,medium,high,critical -c 50 -rl 100', dependencies: ['httpx'], inputFiles: ['live_urls.txt'], outputFiles: ['nuclei_results.txt'] },
      { id: 'dalfox', name: 'Dalfox', stage: 4, icon: '⚔️', description: 'Parameter analysis and XSS scanning tool', command: 'dalfox file {input} -o {output} --deep-domxss --grep', dependencies: ['gf-patterns'], inputFiles: ['filtered_urls.txt'], outputFiles: ['xss_results.txt'] },
      { id: 'sqlmap', name: 'SQLMap', stage: 4, icon: '💉', description: 'Automatic SQL injection and database takeover tool', command: 'sqlmap -m {input} --batch --output-dir={output_dir} --level=3 --risk=2', dependencies: ['gf-patterns'], inputFiles: ['filtered_urls.txt'], outputFiles: ['sqlmap_results/'] },
      { id: 'nikto', name: 'Nikto', stage: 4, icon: '🛡️', description: 'Web server scanner for multiple items', command: 'nikto -host {input} -output {output} -Format txt', dependencies: ['httpx'], inputFiles: ['live_urls.txt'], outputFiles: ['nikto_results.txt'] },
    ];

    for (const tool of defaultTools) {
      if (!this.tools.has(tool.id)) {
        await this.createTool(tool);
      }
    }
  }

  // Targets implementation
  async getTargets(): Promise<Target[]> {
    return Array.from(this.targets.values());
  }

  async getTarget(id: string): Promise<Target | undefined> {
    return this.targets.get(id);
  }

  async createTarget(insertTarget: InsertTarget): Promise<Target> {
    const id = randomUUID();
    const now = new Date();
    const target: Target = {
      ...insertTarget,
      id,
      domain: insertTarget.domain || null,
      urls: insertTarget.urls || null,
      status: 'created',
      subdomainCount: 0,
      hostCount: 0,
      vulnerabilityCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.targets.set(id, target);
    return target;
  }

  async updateTarget(id: string, updates: Partial<Target>): Promise<Target> {
    const target = this.targets.get(id);
    if (!target) throw new Error('Target not found');
    
    const updated: Target = { ...target, ...updates, updatedAt: new Date() };
    this.targets.set(id, updated);
    return updated;
  }

  async deleteTarget(id: string): Promise<void> {
    this.targets.delete(id);
    // Also delete related records
    Array.from(this.executions.entries()).forEach(([execId, execution]) => {
      if (execution.targetId === id) {
        this.executions.delete(execId);
      }
    });
    Array.from(this.files.entries()).forEach(([fileId, file]) => {
      if (file.targetId === id) {
        this.files.delete(fileId);
      }
    });
    Array.from(this.vulnerabilities.entries()).forEach(([vulnId, vuln]) => {
      if (vuln.targetId === id) {
        this.vulnerabilities.delete(vulnId);
      }
    });
  }

  // Tools implementation
  async getTools(): Promise<Tool[]> {
    return Array.from(this.tools.values());
  }

  async getTool(id: string): Promise<Tool | undefined> {
    return this.tools.get(id);
  }

  async createTool(insertTool: InsertTool): Promise<Tool> {
    const tool: Tool = { 
      ...insertTool, 
      enabled: insertTool.enabled ?? true,
      dependencies: insertTool.dependencies || null,
      inputFiles: insertTool.inputFiles || null,
      outputFiles: insertTool.outputFiles || null
    };
    this.tools.set(tool.id, tool);
    return tool;
  }

  async updateTool(id: string, updates: Partial<Tool>): Promise<Tool> {
    const tool = this.tools.get(id);
    if (!tool) throw new Error('Tool not found');
    
    const updated: Tool = { ...tool, ...updates };
    this.tools.set(id, updated);
    return updated;
  }

  // Executions implementation
  async getExecutions(): Promise<Execution[]> {
    return Array.from(this.executions.values());
  }

  async getExecutionsByTarget(targetId: string): Promise<Execution[]> {
    return Array.from(this.executions.values()).filter(exec => exec.targetId === targetId);
  }

  async getExecution(id: string): Promise<Execution | undefined> {
    return this.executions.get(id);
  }

  async createExecution(insertExecution: InsertExecution): Promise<Execution> {
    const id = randomUUID();
    const now = new Date();
    const execution: Execution = {
      ...insertExecution,
      id,
      status: 'pending',
      progress: 0,
      createdAt: now,
      startedAt: null,
      completedAt: null,
      output: null,
      errorMessage: null,
    };
    this.executions.set(id, execution);
    return execution;
  }

  async updateExecution(id: string, updates: Partial<Execution>): Promise<Execution> {
    const execution = this.executions.get(id);
    if (!execution) throw new Error('Execution not found');
    
    const updated: Execution = { ...execution, ...updates };
    this.executions.set(id, updated);
    return updated;
  }

  async deleteExecution(id: string): Promise<void> {
    this.executions.delete(id);
  }

  // Files implementation
  async getFiles(): Promise<File[]> {
    return Array.from(this.files.values());
  }

  async getFilesByTarget(targetId: string): Promise<File[]> {
    return Array.from(this.files.values()).filter(file => file.targetId === targetId);
  }

  async getFile(id: string): Promise<File | undefined> {
    return this.files.get(id);
  }

  async createFile(insertFile: InsertFile): Promise<File> {
    const id = randomUUID();
    const now = new Date();
    const file: File = {
      ...insertFile,
      id,
      executionId: insertFile.executionId || null,
      filesize: insertFile.filesize || 0,
      contentType: insertFile.contentType || 'text/plain',
      content: insertFile.content || null,
      createdAt: now,
    };
    this.files.set(id, file);
    return file;
  }

  async updateFile(id: string, updates: Partial<File>): Promise<File> {
    const file = this.files.get(id);
    if (!file) throw new Error('File not found');
    
    const updated: File = { ...file, ...updates };
    this.files.set(id, updated);
    return updated;
  }

  async deleteFile(id: string): Promise<void> {
    this.files.delete(id);
  }

  // Vulnerabilities implementation
  async getVulnerabilities(): Promise<Vulnerability[]> {
    return Array.from(this.vulnerabilities.values());
  }

  async getVulnerabilitiesByTarget(targetId: string): Promise<Vulnerability[]> {
    return Array.from(this.vulnerabilities.values()).filter(vuln => vuln.targetId === targetId);
  }

  async getVulnerability(id: string): Promise<Vulnerability | undefined> {
    return this.vulnerabilities.get(id);
  }

  async createVulnerability(insertVulnerability: InsertVulnerability): Promise<Vulnerability> {
    const id = randomUUID();
    const now = new Date();
    const vulnerability: Vulnerability = {
      ...insertVulnerability,
      id,
      description: insertVulnerability.description || null,
      url: insertVulnerability.url || null,
      host: insertVulnerability.host || null,
      evidence: insertVulnerability.evidence || null,
      executionId: insertVulnerability.executionId || null,
      createdAt: now,
    };
    this.vulnerabilities.set(id, vulnerability);
    return vulnerability;
  }

  async updateVulnerability(id: string, updates: Partial<Vulnerability>): Promise<Vulnerability> {
    const vulnerability = this.vulnerabilities.get(id);
    if (!vulnerability) throw new Error('Vulnerability not found');
    
    const updated: Vulnerability = { ...vulnerability, ...updates };
    this.vulnerabilities.set(id, updated);
    return updated;
  }

  async deleteVulnerability(id: string): Promise<void> {
    this.vulnerabilities.delete(id);
  }
}

export const storage = new MemStorage();
