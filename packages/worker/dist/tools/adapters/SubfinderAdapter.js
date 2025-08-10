"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubfinderAdapter = void 0;
const ToolExecutor_1 = require("../ToolExecutor");
const logger_1 = require("../../utils/logger");
class SubfinderAdapter {
    executor;
    constructor() {
        this.executor = new ToolExecutor_1.ToolExecutor();
    }
    async execute(execution) {
        logger_1.logger.info(`Executing Subfinder for target: ${execution.target}`);
        const config = {
            name: 'Subfinder',
            description: 'Fast subdomain enumeration tool',
            category: 'subdomain_enumeration',
            dependencies: [],
            dockerImage: 'projectdiscovery/subfinder:latest',
            defaultArgs: ['-silent', '-o', 'subdomains.txt'],
            outputFormats: ['text'],
            timeout: 300000,
            maxThreads: 50
        };
        const args = ['-d', execution.target, ...config.defaultArgs];
        const modifiedExecution = {
            ...execution,
            args
        };
        return await this.executor.executeTool(modifiedExecution, config);
    }
    async processResults(result, target) {
        if (!result.success) {
            logger_1.logger.warn('Subfinder execution failed, skipping result processing');
            return null;
        }
        const subdomains = this.extractSubdomains(result.output);
        logger_1.logger.info(`Subfinder found ${subdomains.length} subdomains for ${target}`);
        return {
            subdomains,
            count: subdomains.length,
            target
        };
    }
    extractSubdomains(output) {
        const lines = output.split('\n').filter(line => line.trim());
        const subdomains = new Set();
        for (const line of lines) {
            const match = line.match(/^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/);
            if (match) {
                subdomains.add(match[0]);
            }
        }
        return Array.from(subdomains);
    }
}
exports.SubfinderAdapter = SubfinderAdapter;
//# sourceMappingURL=SubfinderAdapter.js.map