"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEPENDENCIES = exports.EXECUTION_MODES = exports.TOOLS = exports.ArtifactType = exports.OutputFormat = exports.ToolCategory = void 0;
var ToolCategory;
(function (ToolCategory) {
    ToolCategory["SUBDOMAIN_ENUMERATION"] = "subdomain_enumeration";
    ToolCategory["DNS_RESOLUTION"] = "dns_resolution";
    ToolCategory["PORT_SCANNING"] = "port_scanning";
    ToolCategory["WEB_DISCOVERY"] = "web_discovery";
    ToolCategory["VULNERABILITY_SCANNING"] = "vulnerability_scanning";
    ToolCategory["CONTENT_DISCOVERY"] = "content_discovery";
    ToolCategory["VISUAL_RECONNAISSANCE"] = "visual_reconnaissance";
    ToolCategory["API_DISCOVERY"] = "api_discovery";
    ToolCategory["SECRET_DISCOVERY"] = "secret_discovery";
})(ToolCategory || (exports.ToolCategory = ToolCategory = {}));
var OutputFormat;
(function (OutputFormat) {
    OutputFormat["TEXT"] = "text";
    OutputFormat["JSON"] = "json";
    OutputFormat["CSV"] = "csv";
    OutputFormat["XML"] = "xml";
    OutputFormat["HTML"] = "html";
    OutputFormat["BINARY"] = "binary";
})(OutputFormat || (exports.OutputFormat = OutputFormat = {}));
var ArtifactType;
(function (ArtifactType) {
    ArtifactType["SUBDOMAIN_LIST"] = "subdomain_list";
    ArtifactType["LIVE_HOSTS"] = "live_hosts";
    ArtifactType["SCREENSHOT"] = "screenshot";
    ArtifactType["VULNERABILITY_REPORT"] = "vulnerability_report";
    ArtifactType["LOG_FILE"] = "log_file";
    ArtifactType["CONFIG_FILE"] = "config_file";
    ArtifactType["OTHER"] = "other";
})(ArtifactType || (exports.ArtifactType = ArtifactType = {}));
exports.TOOLS = {
    subfinder: {
        name: 'Subfinder',
        description: 'Fast subdomain enumeration tool',
        category: ToolCategory.SUBDOMAIN_ENUMERATION,
        dependencies: [],
        dockerImage: 'projectdiscovery/subfinder:latest',
        defaultArgs: ['-silent', '-o', 'subdomains.txt'],
        outputFormats: [OutputFormat.TEXT],
        timeout: 300000,
        maxThreads: 50
    },
    assetfinder: {
        name: 'Assetfinder',
        description: 'Find domains and subdomains potentially related to a given domain',
        category: ToolCategory.SUBDOMAIN_ENUMERATION,
        dependencies: [],
        dockerImage: 'tomnomnom/assetfinder:latest',
        defaultArgs: ['--subs-only'],
        outputFormats: [OutputFormat.TEXT],
        timeout: 300000,
        maxThreads: 50
    },
    findomain: {
        name: 'Findomain',
        description: 'Fastest and cross-platform subdomain enumerator',
        category: ToolCategory.SUBDOMAIN_ENUMERATION,
        dependencies: [],
        dockerImage: 'findomain/findomain:latest',
        defaultArgs: ['--output'],
        outputFormats: [OutputFormat.TEXT],
        timeout: 300000,
        maxThreads: 50
    },
    chaos: {
        name: 'Chaos',
        description: 'Cloud asset discovery tool',
        category: ToolCategory.SUBDOMAIN_ENUMERATION,
        dependencies: [],
        dockerImage: 'projectdiscovery/chaos-client:latest',
        defaultArgs: ['-silent'],
        outputFormats: [OutputFormat.TEXT],
        timeout: 300000,
        maxThreads: 50
    },
    amass: {
        name: 'Amass',
        description: 'In-depth attack surface mapping and asset discovery',
        category: ToolCategory.SUBDOMAIN_ENUMERATION,
        dependencies: [],
        dockerImage: 'caffix/amass:latest',
        defaultArgs: ['-passive', '-json', 'amass.json'],
        outputFormats: [OutputFormat.JSON, OutputFormat.TEXT],
        timeout: 600000,
        maxThreads: 50
    },
    dnsx: {
        name: 'DNSx',
        description: 'Fast and multi-purpose DNS toolkit',
        category: ToolCategory.DNS_RESOLUTION,
        dependencies: ['subfinder', 'assetfinder', 'findomain', 'chaos', 'amass'],
        dockerImage: 'projectdiscovery/dnsx:latest',
        defaultArgs: ['-a', '-cname', '-resp', '-silent'],
        outputFormats: [OutputFormat.TEXT],
        timeout: 300000,
        maxThreads: 50
    },
    httpx: {
        name: 'HTTPx',
        description: 'Fast and multi-purpose HTTP toolkit',
        category: ToolCategory.WEB_DISCOVERY,
        dependencies: ['dnsx'],
        dockerImage: 'projectdiscovery/httpx:latest',
        defaultArgs: ['-status-code', '-tech-detect', '-silent'],
        outputFormats: [OutputFormat.TEXT],
        timeout: 300000,
        maxThreads: 50
    },
    aquatone: {
        name: 'Aquatone',
        description: 'A tool for visual reconnaissance of websites',
        category: ToolCategory.VISUAL_RECONNAISSANCE,
        dependencies: ['httpx'],
        dockerImage: 'michenriksen/aquatone:latest',
        defaultArgs: ['-chrome-path', '/usr/bin/chromium-browser'],
        outputFormats: [OutputFormat.HTML],
        timeout: 600000,
        maxThreads: 10
    },
    gau: {
        name: 'Gau',
        description: 'Fetch known URLs from AlienVault\'s Open Threat Exchange, the Wayback Machine, and Common Crawl',
        category: ToolCategory.CONTENT_DISCOVERY,
        dependencies: ['httpx'],
        dockerImage: 'lc/gau:latest',
        defaultArgs: ['--subs'],
        outputFormats: [OutputFormat.TEXT],
        timeout: 300000,
        maxThreads: 50
    },
    waybackurls: {
        name: 'Waybackurls',
        description: 'Fetch all the URLs that the Wayback Machine knows about for a domain',
        category: ToolCategory.CONTENT_DISCOVERY,
        dependencies: ['httpx'],
        dockerImage: 'tomnomnom/waybackurls:latest',
        defaultArgs: [],
        outputFormats: [OutputFormat.TEXT],
        timeout: 300000,
        maxThreads: 50
    },
    katana: {
        name: 'Katana',
        description: 'A next-generation crawling and spidering framework',
        category: ToolCategory.CONTENT_DISCOVERY,
        dependencies: ['httpx'],
        dockerImage: 'projectdiscovery/katana:latest',
        defaultArgs: ['-silent'],
        outputFormats: [OutputFormat.TEXT],
        timeout: 600000,
        maxThreads: 20
    },
    arjun: {
        name: 'Arjun',
        description: 'HTTP parameter discovery suite',
        category: ToolCategory.API_DISCOVERY,
        dependencies: ['httpx'],
        dockerImage: 's0md3v/arjun:latest',
        defaultArgs: ['-oJ'],
        outputFormats: [OutputFormat.JSON],
        timeout: 300000,
        maxThreads: 20
    },
    gobuster: {
        name: 'Gobuster',
        description: 'Directory/file & DNS busting tool',
        category: ToolCategory.CONTENT_DISCOVERY,
        dependencies: ['httpx'],
        dockerImage: 'gobuster/gobuster:latest',
        defaultArgs: ['-q'],
        outputFormats: [OutputFormat.TEXT],
        timeout: 600000,
        maxThreads: 50
    },
    ffuf: {
        name: 'FFUF',
        description: 'Fast web fuzzer written in Go',
        category: ToolCategory.CONTENT_DISCOVERY,
        dependencies: ['httpx'],
        dockerImage: 'ffuf/ffuf:latest',
        defaultArgs: ['-v', '-o', 'ffuf.json', '-of', 'json'],
        outputFormats: [OutputFormat.JSON],
        timeout: 600000,
        maxThreads: 50
    },
    nuclei: {
        name: 'Nuclei',
        description: 'Fast and customizable vulnerability scanner',
        category: ToolCategory.VULNERABILITY_SCANNING,
        dependencies: ['httpx'],
        dockerImage: 'projectdiscovery/nuclei:latest',
        defaultArgs: ['-silent', '-o', 'nuclei.json', '-json'],
        outputFormats: [OutputFormat.JSON],
        timeout: 900000,
        maxThreads: 50
    },
    nikto: {
        name: 'Nikto',
        description: 'Web server scanner',
        category: ToolCategory.VULNERABILITY_SCANNING,
        dependencies: ['httpx'],
        dockerImage: 'sullo/nikto:latest',
        defaultArgs: ['-Format', 'json', '-output', 'nikto.json'],
        outputFormats: [OutputFormat.JSON],
        timeout: 600000,
        maxThreads: 20
    }
};
exports.EXECUTION_MODES = {
    FULL: [
        'subfinder',
        'assetfinder',
        'findomain',
        'chaos',
        'amass',
        'dnsx',
        'httpx',
        'aquatone',
        'gau',
        'waybackurls',
        'katana',
        'arjun',
        'gobuster',
        'ffuf',
        'nuclei',
        'nikto'
    ],
    CUSTOM: [],
    SINGLE_TOOL: []
};
exports.TOOL_DEPENDENCIES = {
    dnsx: ['subfinder', 'assetfinder', 'findomain', 'chaos', 'amass'],
    httpx: ['dnsx'],
    aquatone: ['httpx'],
    gau: ['httpx'],
    waybackurls: ['httpx'],
    katana: ['httpx'],
    arjun: ['httpx'],
    gobuster: ['httpx'],
    ffuf: ['httpx'],
    nuclei: ['httpx'],
    nikto: ['httpx']
};
//# sourceMappingURL=tools.js.map