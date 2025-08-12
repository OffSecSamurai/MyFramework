"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataProcessor = void 0;
const logger_1 = require("./logger");
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
class DataProcessor {
    static instance;
    processedData = new Map();
    static getInstance() {
        if (!DataProcessor.instance) {
            DataProcessor.instance = new DataProcessor();
        }
        return DataProcessor.instance;
    }
    async processSubdomainResults(target, rawData) {
        logger_1.logger.info(`Processing subdomain results for ${target}`);
        const cleaned = this.cleanSubdomains(rawData);
        const deduplicated = this.deduplicateSubdomains(cleaned);
        const validated = this.validateSubdomains(deduplicated);
        logger_1.logger.info(`Subdomain processing: ${rawData.length} → ${cleaned.length} → ${deduplicated.length} → ${validated.length}`);
        return validated;
    }
    async processLiveHosts(target, rawData) {
        logger_1.logger.info(`Processing live hosts for ${target}`);
        const cleaned = this.cleanLiveHosts(rawData);
        const deduplicated = this.deduplicateHosts(cleaned);
        const validated = this.validateLiveHosts(deduplicated);
        logger_1.logger.info(`Live host processing: ${rawData.length} → ${cleaned.length} → ${deduplicated.length} → ${validated.length}`);
        return validated;
    }
    async processLiveUrls(target, rawData) {
        logger_1.logger.info(`Processing live URLs for ${target}`);
        const cleaned = this.cleanUrls(rawData);
        const deduplicated = this.deduplicateUrls(cleaned);
        const validated = this.validateUrls(deduplicated);
        logger_1.logger.info(`Live URL processing: ${rawData.length} → ${cleaned.length} → ${deduplicated.length} → ${validated.length}`);
        return validated;
    }
    async processVulnerabilities(target, rawData) {
        logger_1.logger.info(`Processing vulnerabilities for ${target}`);
        const cleaned = this.cleanVulnerabilities(rawData);
        const deduplicated = this.deduplicateVulnerabilities(cleaned);
        const enriched = this.enrichVulnerabilities(deduplicated);
        logger_1.logger.info(`Vulnerability processing: ${rawData.length} → ${cleaned.length} → ${deduplicated.length} → ${enriched.length}`);
        return enriched;
    }
    async saveProcessedData(target, data) {
        const storagePath = path_1.default.join(process.env['STORAGE_PATH'] || './storage', 'processed', target);
        await fs_extra_1.default.ensureDir(storagePath);
        await fs_extra_1.default.writeJson(path_1.default.join(storagePath, 'processed_data.json'), data, { spaces: 2 });
        await fs_extra_1.default.writeFile(path_1.default.join(storagePath, 'subdomains.txt'), data.subdomains.join('\n'));
        await fs_extra_1.default.writeFile(path_1.default.join(storagePath, 'live_hosts.txt'), data.liveHosts.join('\n'));
        await fs_extra_1.default.writeFile(path_1.default.join(storagePath, 'live_urls.txt'), data.liveUrls.join('\n'));
        await fs_extra_1.default.writeJson(path_1.default.join(storagePath, 'vulnerabilities.json'), data.vulnerabilities, { spaces: 2 });
        this.processedData.set(target, data);
        logger_1.logger.info(`Processed data saved for ${target}`);
    }
    async getProcessedData(target) {
        if (this.processedData.has(target)) {
            return this.processedData.get(target);
        }
        const storagePath = path_1.default.join(process.env['STORAGE_PATH'] || './storage', 'processed', target, 'processed_data.json');
        if (await fs_extra_1.default.pathExists(storagePath)) {
            const data = await fs_extra_1.default.readJson(storagePath);
            this.processedData.set(target, data);
            return data;
        }
        return null;
    }
    cleanSubdomains(data) {
        return data
            .map(item => item.trim().toLowerCase())
            .filter(item => item.length > 0)
            .map(item => {
            item = item.replace(/^https?:\/\//, '');
            item = item.replace(/:\d+$/, '');
            item = item.replace(/\/+$/, '');
            return item;
        })
            .filter(item => this.isValidDomain(item));
    }
    deduplicateSubdomains(data) {
        return [...new Set(data)];
    }
    validateSubdomains(data) {
        return data.filter(item => {
            const domainRegex = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
            return domainRegex.test(item);
        });
    }
    cleanLiveHosts(data) {
        return data
            .map(item => item.trim())
            .filter(item => item.length > 0)
            .map(item => {
            const match = item.match(/^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}/);
            return match ? match[0] : item;
        })
            .filter(item => this.isValidDomain(item));
    }
    deduplicateHosts(data) {
        return [...new Set(data)];
    }
    validateLiveHosts(data) {
        return data.filter(item => {
            const domainRegex = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
            return domainRegex.test(item);
        });
    }
    cleanUrls(data) {
        return data
            .map(item => item.trim())
            .filter(item => item.length > 0)
            .map(item => {
            if (!item.startsWith('http://') && !item.startsWith('https://')) {
                item = 'https://' + item;
            }
            const cleanItem = item.split('#')[0];
            return cleanItem;
        })
            .filter(item => this.isValidUrl(item));
    }
    deduplicateUrls(data) {
        return [...new Set(data)];
    }
    validateUrls(data) {
        return data.filter(item => {
            try {
                new URL(item);
                return true;
            }
            catch {
                return false;
            }
        });
    }
    cleanVulnerabilities(data) {
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
    deduplicateVulnerabilities(data) {
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
    enrichVulnerabilities(data) {
        return data.map(item => ({
            ...item,
            id: this.generateVulnerabilityId(item),
            timestamp: new Date().toISOString(),
            status: 'NEW',
            riskScore: this.calculateRiskScore(item),
            tags: this.generateTags(item)
        }));
    }
    isValidDomain(domain) {
        const domainRegex = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
        return domainRegex.test(domain);
    }
    isValidUrl(url) {
        try {
            new URL(url);
            return true;
        }
        catch {
            return false;
        }
    }
    normalizeSeverity(severity) {
        const severityMap = {
            'critical': 'CRITICAL',
            'high': 'HIGH',
            'medium': 'MEDIUM',
            'low': 'LOW',
            'info': 'INFO',
            'information': 'INFO'
        };
        return severityMap[severity?.toLowerCase()] || 'INFO';
    }
    generateVulnerabilityId(vuln) {
        const hash = require('crypto').createHash('md5');
        hash.update(`${vuln.title}-${vuln.type}-${vuln.severity}`);
        return hash.digest('hex').substring(0, 8);
    }
    calculateRiskScore(vuln) {
        const severityScores = {
            'CRITICAL': 10,
            'HIGH': 8,
            'MEDIUM': 5,
            'LOW': 2,
            'INFO': 1
        };
        let score = severityScores[vuln.severity] || 1;
        if (vuln.cve)
            score += 2;
        if (vuln.cwe)
            score += 1;
        return Math.min(score, 10);
    }
    generateTags(vuln) {
        const tags = [];
        if (vuln.cve)
            tags.push('cve');
        if (vuln.cwe)
            tags.push('cwe');
        if (vuln.type)
            tags.push(vuln.type.toLowerCase());
        if (vuln.tool)
            tags.push(vuln.tool.toLowerCase());
        return tags;
    }
    calculateStatistics(data) {
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
exports.DataProcessor = DataProcessor;
//# sourceMappingURL=dataProcessor.js.map