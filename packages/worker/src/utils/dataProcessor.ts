import { logger } from './logger';
import fs from 'fs-extra';
import path from 'path';

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

export class DataProcessor {
  private static instance: DataProcessor;
  private processedData: Map<string, ProcessedData> = new Map();

  static getInstance(): DataProcessor {
    if (!DataProcessor.instance) {
      DataProcessor.instance = new DataProcessor();
    }
    return DataProcessor.instance;
  }

  async processSubdomainResults(target: string, rawData: string[]): Promise<string[]> {
    logger.info(`Processing subdomain results for ${target}`);
    
    const cleaned = this.cleanSubdomains(rawData);
    const deduplicated = this.deduplicateSubdomains(cleaned);
    const validated = this.validateSubdomains(deduplicated);
    
    logger.info(`Subdomain processing: ${rawData.length} → ${cleaned.length} → ${deduplicated.length} → ${validated.length}`);
    
    return validated;
  }

  async processLiveHosts(target: string, rawData: string[]): Promise<string[]> {
    logger.info(`Processing live hosts for ${target}`);
    
    const cleaned = this.cleanLiveHosts(rawData);
    const deduplicated = this.deduplicateHosts(cleaned);
    const validated = this.validateLiveHosts(deduplicated);
    
    logger.info(`Live host processing: ${rawData.length} → ${cleaned.length} → ${deduplicated.length} → ${validated.length}`);
    
    return validated;
  }

  async processLiveUrls(target: string, rawData: string[]): Promise<string[]> {
    logger.info(`Processing live URLs for ${target}`);
    
    const cleaned = this.cleanUrls(rawData);
    const deduplicated = this.deduplicateUrls(cleaned);
    const validated = this.validateUrls(deduplicated);
    
    logger.info(`Live URL processing: ${rawData.length} → ${cleaned.length} → ${deduplicated.length} → ${validated.length}`);
    
    return validated;
  }

  async processVulnerabilities(target: string, rawData: any[]): Promise<any[]> {
    logger.info(`Processing vulnerabilities for ${target}`);
    
    const cleaned = this.cleanVulnerabilities(rawData);
    const deduplicated = this.deduplicateVulnerabilities(cleaned);
    const enriched = this.enrichVulnerabilities(deduplicated);
    
    logger.info(`Vulnerability processing: ${rawData.length} → ${cleaned.length} → ${deduplicated.length} → ${enriched.length}`);
    
    return enriched;
  }

  async saveProcessedData(target: string, data: ProcessedData): Promise<void> {
    const storagePath = path.join(process.env.STORAGE_PATH || './storage', 'processed', target);
    await fs.ensureDir(storagePath);

    // Save processed data as JSON
    await fs.writeJson(path.join(storagePath, 'processed_data.json'), data, { spaces: 2 });

    // Save individual files
    await fs.writeFile(path.join(storagePath, 'subdomains.txt'), data.subdomains.join('\n'));
    await fs.writeFile(path.join(storagePath, 'live_hosts.txt'), data.liveHosts.join('\n'));
    await fs.writeFile(path.join(storagePath, 'live_urls.txt'), data.liveUrls.join('\n'));
    await fs.writeJson(path.join(storagePath, 'vulnerabilities.json'), data.vulnerabilities, { spaces: 2 });

    this.processedData.set(target, data);
    logger.info(`Processed data saved for ${target}`);
  }

  async getProcessedData(target: string): Promise<ProcessedData | null> {
    if (this.processedData.has(target)) {
      return this.processedData.get(target)!;
    }

    const storagePath = path.join(process.env.STORAGE_PATH || './storage', 'processed', target, 'processed_data.json');
    
    if (await fs.pathExists(storagePath)) {
      const data = await fs.readJson(storagePath);
      this.processedData.set(target, data);
      return data;
    }

    return null;
  }

  // Subdomain processing methods
  private cleanSubdomains(data: string[]): string[] {
    return data
      .map(item => item.trim().toLowerCase())
      .filter(item => item.length > 0)
      .map(item => {
        // Remove protocol prefixes
        item = item.replace(/^https?:\/\//, '');
        // Remove port numbers
        item = item.replace(/:\d+$/, '');
        // Remove trailing slashes
        item = item.replace(/\/+$/, '');
        return item;
      })
      .filter(item => this.isValidDomain(item));
  }

  private deduplicateSubdomains(data: string[]): string[] {
    return [...new Set(data)];
  }

  private validateSubdomains(data: string[]): string[] {
    return data.filter(item => {
      const domainRegex = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
      return domainRegex.test(item);
    });
  }

  // Live host processing methods
  private cleanLiveHosts(data: string[]): string[] {
    return data
      .map(item => item.trim())
      .filter(item => item.length > 0)
      .map(item => {
        // Extract domain from various formats
        const match = item.match(/^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}/);
        return match ? match[0] : item;
      })
      .filter(item => this.isValidDomain(item));
  }

  private deduplicateHosts(data: string[]): string[] {
    return [...new Set(data)];
  }

  private validateLiveHosts(data: string[]): string[] {
    return data.filter(item => {
      const domainRegex = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
      return domainRegex.test(item);
    });
  }

  // URL processing methods
  private cleanUrls(data: string[]): string[] {
    return data
      .map(item => item.trim())
      .filter(item => item.length > 0)
      .map(item => {
        // Normalize URLs
        if (!item.startsWith('http://') && !item.startsWith('https://')) {
          item = 'https://' + item;
        }
        // Remove fragments
        item = item.split('#')[0];
        // Remove query parameters (optional)
        // item = item.split('?')[0];
        return item;
      })
      .filter(item => this.isValidUrl(item));
  }

  private deduplicateUrls(data: string[]): string[] {
    return [...new Set(data)];
  }

  private validateUrls(data: string[]): string[] {
    return data.filter(item => {
      try {
        new URL(item);
        return true;
      } catch {
        return false;
      }
    });
  }

  // Vulnerability processing methods
  private cleanVulnerabilities(data: any[]): any[] {
    return data
      .filter(item => item && typeof item === 'object')
      .map(item => ({
        ...item,
        title: item.title?.trim() || 'Unknown',
        description: item.description?.trim() || '',
        severity: this.normalizeSeverity(item.severity),
        type: item.type?.trim() || 'unknown',
        tool: item.tool?.trim() || 'unknown'
      }))
      .filter(item => item.title !== 'Unknown' || item.description !== '');
  }

  private deduplicateVulnerabilities(data: any[]): any[] {
    const seen = new Set();
    return data.filter(item => {
      const key = `${item.title}-${item.type}-${item.severity}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  private enrichVulnerabilities(data: any[]): any[] {
    return data.map(item => ({
      ...item,
      id: this.generateVulnerabilityId(item),
      timestamp: new Date().toISOString(),
      status: 'NEW',
      riskScore: this.calculateRiskScore(item),
      tags: this.generateTags(item)
    }));
  }

  // Utility methods
  private isValidDomain(domain: string): boolean {
    const domainRegex = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
    return domainRegex.test(domain);
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  private normalizeSeverity(severity: string): string {
    const severityMap: Record<string, string> = {
      'critical': 'CRITICAL',
      'high': 'HIGH',
      'medium': 'MEDIUM',
      'low': 'LOW',
      'info': 'INFO',
      'information': 'INFO'
    };
    
    return severityMap[severity?.toLowerCase()] || 'INFO';
  }

  private generateVulnerabilityId(vuln: any): string {
    const hash = require('crypto').createHash('md5');
    hash.update(`${vuln.title}-${vuln.type}-${vuln.severity}`);
    return hash.digest('hex').substring(0, 8);
  }

  private calculateRiskScore(vuln: any): number {
    const severityScores = {
      'CRITICAL': 10,
      'HIGH': 8,
      'MEDIUM': 5,
      'LOW': 2,
      'INFO': 1
    };
    
    let score = severityScores[vuln.severity] || 1;
    
    // Bonus for CVE
    if (vuln.cve) score += 2;
    
    // Bonus for CWE
    if (vuln.cwe) score += 1;
    
    return Math.min(score, 10);
  }

  private generateTags(vuln: any): string[] {
    const tags = [];
    
    if (vuln.cve) tags.push('cve');
    if (vuln.cwe) tags.push('cwe');
    if (vuln.type) tags.push(vuln.type.toLowerCase());
    if (vuln.tool) tags.push(vuln.tool.toLowerCase());
    
    return tags;
  }

  // Statistics calculation
  calculateStatistics(data: ProcessedData): ProcessedData['statistics'] {
    const vulns = data.vulnerabilities;
    
    return {
      totalSubdomains: data.subdomains.length,
      uniqueSubdomains: new Set(data.subdomains).size,
      liveHosts: data.liveHosts.length,
      liveUrls: data.liveUrls.length,
      vulnerabilities: vulns.length,
      criticalVulns: vulns.filter(v => v.severity === 'CRITICAL').length,
      highVulns: vulns.filter(v => v.severity === 'HIGH').length,
      mediumVulns: vulns.filter(v => v.severity === 'MEDIUM').length,
      lowVulns: vulns.filter(v => v.severity === 'LOW').length
    };
  }
}