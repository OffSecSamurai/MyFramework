import { storage } from "../storage";
import { promises as fs } from "fs";
import path from "path";

export class ResultParser {
  
  async parseToolOutput(executionId: string, toolId: string, targetId: string, outputFiles: string[], workspaceDir: string): Promise<void> {
    try {
      switch (toolId) {
        case 'nuclei':
          await this.parseNucleiResults(executionId, targetId, outputFiles, workspaceDir);
          break;
        case 'dalfox':
          await this.parseDalfoxResults(executionId, targetId, outputFiles, workspaceDir);
          break;
        case 'sqlmap':
          await this.parseSqlmapResults(executionId, targetId, outputFiles, workspaceDir);
          break;
        case 'nmap':
        case 'naabu':
          await this.parsePortScanResults(executionId, targetId, outputFiles, workspaceDir);
          break;
        case 'httpx':
          await this.parseHttpxResults(executionId, targetId, outputFiles, workspaceDir);
          break;
        case 'aquatone':
          await this.parseAquatoneResults(executionId, targetId, outputFiles, workspaceDir);
          break;
        default:
          await this.parseGenericResults(executionId, targetId, outputFiles, workspaceDir);
          break;
      }
    } catch (error) {
      console.error(`Failed to parse results for ${toolId}:`, error);
    }
  }

  private async parseNucleiResults(executionId: string, targetId: string, outputFiles: string[], workspaceDir: string): Promise<void> {
    const nucleiFile = path.join(workspaceDir, targetId, 'nuclei_results.txt');
    
    try {
      const content = await fs.readFile(nucleiFile, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        if (line.includes('[') && line.includes(']')) {
          try {
            const parts = line.split(' ');
            const severityMatch = line.match(/\[(info|low|medium|high|critical)\]/i);
            const urlMatch = line.match(/https?:\/\/[^\s]+/);
            const templateMatch = line.match(/\[([^\]]+)\]/);
            
            if (severityMatch && urlMatch && templateMatch) {
              await storage.createVulnerability({
                targetId,
                executionId,
                toolId: 'nuclei',
                severity: severityMatch[1].toLowerCase(),
                title: templateMatch[1],
                url: urlMatch[0],
                description: line.trim(),
                evidence: line
              });
            }
          } catch (parseError) {
            console.error('Error parsing nuclei line:', parseError);
          }
        }
      }
      
      // Store the file
      await storage.createFile({
        targetId,
        executionId,
        filename: 'nuclei_results.txt',
        filepath: nucleiFile,
        content: content,
        contentType: 'text/plain',
        filesize: content.length
      });
      
    } catch (error) {
      console.error('Error reading nuclei results:', error);
    }
  }

  private async parseDalfoxResults(executionId: string, targetId: string, outputFiles: string[], workspaceDir: string): Promise<void> {
    const dalfoxFile = path.join(workspaceDir, targetId, 'xss_results.txt');
    
    try {
      const content = await fs.readFile(dalfoxFile, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        if (line.includes('[V]') || line.includes('[POC]')) {
          const urlMatch = line.match(/https?:\/\/[^\s]+/);
          if (urlMatch) {
            await storage.createVulnerability({
              targetId,
              executionId,
              toolId: 'dalfox',
              severity: 'medium',
              title: 'Cross-Site Scripting (XSS)',
              url: urlMatch[0],
              description: 'XSS vulnerability detected by Dalfox',
              evidence: line
            });
          }
        }
      }
      
      await storage.createFile({
        targetId,
        executionId,
        filename: 'xss_results.txt',
        filepath: dalfoxFile,
        content: content,
        contentType: 'text/plain',
        filesize: content.length
      });
      
    } catch (error) {
      console.error('Error reading dalfox results:', error);
    }
  }

  private async parseSqlmapResults(executionId: string, targetId: string, outputFiles: string[], workspaceDir: string): Promise<void> {
    const sqlmapDir = path.join(workspaceDir, targetId, 'sqlmap_results');
    
    try {
      const files = await fs.readdir(sqlmapDir);
      
      for (const file of files) {
        if (file.endsWith('.log')) {
          const logPath = path.join(sqlmapDir, file);
          const content = await fs.readFile(logPath, 'utf-8');
          
          if (content.includes('injectable') || content.includes('SQL injection')) {
            const urlMatch = content.match(/https?:\/\/[^\s]+/);
            if (urlMatch) {
              await storage.createVulnerability({
                targetId,
                executionId,
                toolId: 'sqlmap',
                severity: 'high',
                title: 'SQL Injection',
                url: urlMatch[0],
                description: 'SQL injection vulnerability detected by SQLMap',
                evidence: content.substring(0, 500) + '...'
              });
            }
          }
          
          await storage.createFile({
            targetId,
            executionId,
            filename: file,
            filepath: logPath,
            content: content,
            contentType: 'text/plain',
            filesize: content.length
          });
        }
      }
      
    } catch (error) {
      console.error('Error reading sqlmap results:', error);
    }
  }

  private async parsePortScanResults(executionId: string, targetId: string, outputFiles: string[], workspaceDir: string): Promise<void> {
    for (const outputFile of outputFiles) {
      const filePath = path.join(workspaceDir, targetId, outputFile);
      
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        
        await storage.createFile({
          targetId,
          executionId,
          filename: outputFile,
          filepath: filePath,
          content: content,
          contentType: 'text/plain',
          filesize: content.length
        });
        
      } catch (error) {
        console.error(`Error reading port scan file ${outputFile}:`, error);
      }
    }
  }

  private async parseHttpxResults(executionId: string, targetId: string, outputFiles: string[], workspaceDir: string): Promise<void> {
    const httpxFile = path.join(workspaceDir, targetId, 'live_urls.txt');
    
    try {
      const content = await fs.readFile(httpxFile, 'utf-8');
      const urls = content.split('\n').filter(line => line.trim());
      
      // Update target statistics
      const target = await storage.getTarget(targetId);
      if (target) {
        await storage.updateTarget(targetId, {
          hostCount: urls.length,
          status: 'running'
        });
      }
      
      await storage.createFile({
        targetId,
        executionId,
        filename: 'live_urls.txt',
        filepath: httpxFile,
        content: content,
        contentType: 'text/plain',
        filesize: content.length
      });
      
    } catch (error) {
      console.error('Error reading httpx results:', error);
    }
  }

  private async parseAquatoneResults(executionId: string, targetId: string, outputFiles: string[], workspaceDir: string): Promise<void> {
    const aquatoneDir = path.join(workspaceDir, targetId, 'aquatone_report');
    
    try {
      const files = await fs.readdir(aquatoneDir);
      
      for (const file of files) {
        const filePath = path.join(aquatoneDir, file);
        const stats = await fs.stat(filePath);
        
        if (stats.isFile()) {
          let content = '';
          let contentType = 'application/octet-stream';
          
          if (file.endsWith('.html')) {
            content = await fs.readFile(filePath, 'utf-8');
            contentType = 'text/html';
          } else if (file.endsWith('.png') || file.endsWith('.jpg')) {
            contentType = `image/${file.split('.').pop()}`;
          }
          
          await storage.createFile({
            targetId,
            executionId,
            filename: file,
            filepath: filePath,
            content: content,
            contentType: contentType,
            filesize: stats.size
          });
        }
      }
      
    } catch (error) {
      console.error('Error reading aquatone results:', error);
    }
  }

  private async parseGenericResults(executionId: string, targetId: string, outputFiles: string[], workspaceDir: string): Promise<void> {
    for (const outputFile of outputFiles) {
      const filePath = path.join(workspaceDir, targetId, outputFile);
      
      try {
        const stats = await fs.stat(filePath);
        if (stats.isFile()) {
          const content = await fs.readFile(filePath, 'utf-8');
          
          await storage.createFile({
            targetId,
            executionId,
            filename: outputFile,
            filepath: filePath,
            content: content,
            contentType: 'text/plain',
            filesize: content.length
          });
        }
      } catch (error) {
        console.error(`Error reading file ${outputFile}:`, error);
      }
    }
  }
}

export const resultParser = new ResultParser();