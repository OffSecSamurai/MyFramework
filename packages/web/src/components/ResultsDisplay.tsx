import React, { useEffect, useState } from 'react';
import { Download, Eye, Filter, Search, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

interface Vulnerability {
  id: string;
  title: string;
  description: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  type: string;
  tool: string;
  cve?: string;
  cwe?: string;
  cvss?: number;
  status: string;
  createdAt: string;
  metadata?: string;
}

interface Artifact {
  id: string;
  name: string;
  type: string;
  size: number;
  mimeType?: string;
  createdAt: string;
  path: string;
}

interface ProcessedData {
  subdomains: string[];
  liveHosts: string[];
  liveUrls: string[];
  vulnerabilities: Vulnerability[];
  artifacts: Artifact[];
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

interface ResultsDisplayProps {
  targetId: string;
  executionId?: string;
}

export const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ targetId, executionId }) => {
  const [data, setData] = useState<ProcessedData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'subdomains' | 'hosts' | 'urls' | 'vulnerabilities' | 'artifacts'>('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [toolFilter, setToolFilter] = useState<string>('all');

  useEffect(() => {
    fetchResults();
  }, [targetId, executionId]);

  const fetchResults = async () => {
    try {
      setIsLoading(true);
      
      // Fetch processed data
      const response = await fetch(`/api/targets/${targetId}/processed-data`);
      if (response.ok) {
        const result = await response.json();
        setData(result);
      } else {
        // Fallback to individual endpoints
        await fetchIndividualData();
      }
    } catch (error) {
      console.error('Failed to fetch results:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchIndividualData = async () => {
    try {
      const [subdomainsRes, hostsRes, urlsRes, vulnsRes, artifactsRes] = await Promise.all([
        fetch(`/api/artifacts?targetId=${targetId}&type=subdomain_list`),
        fetch(`/api/artifacts?targetId=${targetId}&type=live_hosts`),
        fetch(`/api/artifacts?targetId=${targetId}&type=live_urls`),
        fetch(`/api/vulnerabilities?targetId=${targetId}`),
        fetch(`/api/artifacts?targetId=${targetId}`)
      ]);

      const subdomains = await subdomainsRes.json();
      const hosts = await hostsRes.json();
      const urls = await urlsRes.json();
      const vulnerabilities = await vulnsRes.json();
      const artifacts = await artifactsRes.json();

      setData({
        subdomains: subdomains.data || [],
        liveHosts: hosts.data || [],
        liveUrls: urls.data || [],
        vulnerabilities: vulnerabilities.data || [],
        artifacts: artifacts.data || [],
        statistics: {
          totalSubdomains: subdomains.data?.length || 0,
          uniqueSubdomains: new Set(subdomains.data || []).size,
          liveHosts: hosts.data?.length || 0,
          liveUrls: urls.data?.length || 0,
          vulnerabilities: vulnerabilities.data?.length || 0,
          criticalVulns: (vulnerabilities.data || []).filter((v: Vulnerability) => v.severity === 'CRITICAL').length,
          highVulns: (vulnerabilities.data || []).filter((v: Vulnerability) => v.severity === 'HIGH').length,
          mediumVulns: (vulnerabilities.data || []).filter((v: Vulnerability) => v.severity === 'MEDIUM').length,
          lowVulns: (vulnerabilities.data || []).filter((v: Vulnerability) => v.severity === 'LOW').length
        }
      });
    } catch (error) {
      console.error('Failed to fetch individual data:', error);
    }
  };

  const downloadData = async (type: string) => {
    try {
      const response = await fetch(`/api/targets/${targetId}/download/${type}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${type}_${targetId}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Failed to download data:', error);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'text-red-500 bg-red-100 border-red-200';
      case 'HIGH':
        return 'text-orange-500 bg-orange-100 border-orange-200';
      case 'MEDIUM':
        return 'text-yellow-500 bg-yellow-100 border-yellow-200';
      case 'LOW':
        return 'text-green-500 bg-green-100 border-green-200';
      case 'INFO':
        return 'text-blue-500 bg-blue-100 border-blue-200';
      default:
        return 'text-gray-500 bg-gray-100 border-gray-200';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'HIGH':
        return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      case 'MEDIUM':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'LOW':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'INFO':
        return <CheckCircle className="w-4 h-4 text-blue-500" />;
      default:
        return <XCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const filteredVulnerabilities = data?.vulnerabilities.filter(vuln => {
    const matchesSearch = vuln.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         vuln.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         vuln.tool.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSeverity = severityFilter === 'all' || vuln.severity === severityFilter;
    const matchesTool = toolFilter === 'all' || vuln.tool === toolFilter;
    
    return matchesSearch && matchesSeverity && matchesTool;
  }) || [];

  if (isLoading) {
    return (
      <div className="bg-dark-800 rounded-lg p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-dark-700 rounded w-1/4 mb-4"></div>
          <div className="h-2 bg-dark-700 rounded w-full mb-2"></div>
          <div className="h-2 bg-dark-700 rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-dark-800 rounded-lg p-6">
        <div className="text-center text-gray-400">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4" />
          <p>No results available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-dark-800 rounded-lg">
      {/* Header */}
      <div className="p-6 border-b border-dark-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">Reconnaissance Results</h2>
          <div className="flex space-x-2">
            <button
              onClick={() => downloadData('all')}
              className="btn btn-secondary btn-sm"
            >
              <Download className="w-4 h-4" />
              Export All
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1">
          {[
            { key: 'overview', label: 'Overview' },
            { key: 'subdomains', label: `Subdomains (${data.statistics.uniqueSubdomains})` },
            { key: 'hosts', label: `Live Hosts (${data.statistics.liveHosts})` },
            { key: 'urls', label: `Live URLs (${data.statistics.liveUrls})` },
            { key: 'vulnerabilities', label: `Vulnerabilities (${data.statistics.vulnerabilities})` },
            { key: 'artifacts', label: `Artifacts (${data.artifacts.length})` }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-primary text-white'
                  : 'text-gray-400 hover:text-white hover:bg-dark-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Statistics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-dark-700 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-primary">{data.statistics.uniqueSubdomains}</div>
                <div className="text-sm text-gray-400">Unique Subdomains</div>
              </div>
              <div className="bg-dark-700 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-blue-400">{data.statistics.liveHosts}</div>
                <div className="text-sm text-gray-400">Live Hosts</div>
              </div>
              <div className="bg-dark-700 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-green-400">{data.statistics.liveUrls}</div>
                <div className="text-sm text-gray-400">Live URLs</div>
              </div>
              <div className="bg-dark-700 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-red-400">{data.statistics.vulnerabilities}</div>
                <div className="text-sm text-gray-400">Vulnerabilities</div>
              </div>
            </div>

            {/* Vulnerability Severity Breakdown */}
            <div className="bg-dark-700 rounded-lg p-4">
              <h3 className="text-lg font-medium text-white mb-4">Vulnerability Severity</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-xl font-bold text-red-500">{data.statistics.criticalVulns}</div>
                  <div className="text-sm text-gray-400">Critical</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-orange-500">{data.statistics.highVulns}</div>
                  <div className="text-sm text-gray-400">High</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-yellow-500">{data.statistics.mediumVulns}</div>
                  <div className="text-sm text-gray-400">Medium</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-green-500">{data.statistics.lowVulns}</div>
                  <div className="text-sm text-gray-400">Low</div>
                </div>
              </div>
            </div>

            {/* Recent Vulnerabilities */}
            <div className="bg-dark-700 rounded-lg p-4">
              <h3 className="text-lg font-medium text-white mb-4">Recent Vulnerabilities</h3>
              <div className="space-y-2">
                {data.vulnerabilities.slice(0, 5).map(vuln => (
                  <div key={vuln.id} className="flex items-center justify-between p-3 bg-dark-600 rounded">
                    <div className="flex items-center space-x-3">
                      {getSeverityIcon(vuln.severity)}
                      <div>
                        <div className="font-medium text-white">{vuln.title}</div>
                        <div className="text-sm text-gray-400">{vuln.tool}</div>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium border ${getSeverityColor(vuln.severity)}`}>
                      {vuln.severity}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'subdomains' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium text-white">Subdomains</h3>
              <button
                onClick={() => downloadData('subdomains')}
                className="btn btn-secondary btn-sm"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
            <div className="bg-dark-700 rounded-lg p-4 max-h-96 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {data.subdomains.map((subdomain, index) => (
                  <div key={index} className="p-2 bg-dark-600 rounded text-sm font-mono">
                    {subdomain}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'hosts' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium text-white">Live Hosts</h3>
              <button
                onClick={() => downloadData('hosts')}
                className="btn btn-secondary btn-sm"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
            <div className="bg-dark-700 rounded-lg p-4 max-h-96 overflow-y-auto">
              <div className="space-y-2">
                {data.liveHosts.map((host, index) => (
                  <div key={index} className="p-3 bg-dark-600 rounded flex items-center justify-between">
                    <span className="font-mono text-white">{host}</span>
                    <span className="text-green-400 text-sm">Live</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'urls' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium text-white">Live URLs</h3>
              <button
                onClick={() => downloadData('urls')}
                className="btn btn-secondary btn-sm"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
            <div className="bg-dark-700 rounded-lg p-4 max-h-96 overflow-y-auto">
              <div className="space-y-2">
                {data.liveUrls.map((url, index) => (
                  <div key={index} className="p-3 bg-dark-600 rounded">
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 break-all"
                    >
                      {url}
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'vulnerabilities' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium text-white">Vulnerabilities</h3>
              <button
                onClick={() => downloadData('vulnerabilities')}
                className="btn btn-secondary btn-sm"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>

            {/* Filters */}
            <div className="flex space-x-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search vulnerabilities..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:border-primary"
              >
                <option value="all">All Severities</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
                <option value="INFO">Info</option>
              </select>
              <select
                value={toolFilter}
                onChange={(e) => setToolFilter(e.target.value)}
                className="px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:border-primary"
              >
                <option value="all">All Tools</option>
                {Array.from(new Set(data.vulnerabilities.map(v => v.tool))).map(tool => (
                  <option key={tool} value={tool}>{tool}</option>
                ))}
              </select>
            </div>

            {/* Vulnerabilities List */}
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {filteredVulnerabilities.map(vuln => (
                <div key={vuln.id} className="bg-dark-700 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      {getSeverityIcon(vuln.severity)}
                      <h4 className="font-medium text-white">{vuln.title}</h4>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium border ${getSeverityColor(vuln.severity)}`}>
                      {vuln.severity}
                    </span>
                  </div>
                  <p className="text-gray-400 text-sm mb-2">{vuln.description}</p>
                  <div className="flex items-center space-x-4 text-xs text-gray-500">
                    <span>Tool: {vuln.tool}</span>
                    <span>Type: {vuln.type}</span>
                    {vuln.cve && <span>CVE: {vuln.cve}</span>}
                    {vuln.cwe && <span>CWE: {vuln.cwe}</span>}
                    {vuln.cvss && <span>CVSS: {vuln.cvss}</span>}
                    <span>{new Date(vuln.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'artifacts' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium text-white">Artifacts</h3>
              <button
                onClick={() => downloadData('artifacts')}
                className="btn btn-secondary btn-sm"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
            <div className="bg-dark-700 rounded-lg p-4">
              <div className="space-y-2">
                {data.artifacts.map(artifact => (
                  <div key={artifact.id} className="flex items-center justify-between p-3 bg-dark-600 rounded">
                    <div className="flex items-center space-x-3">
                      <Eye className="w-4 h-4 text-gray-400" />
                      <div>
                        <div className="font-medium text-white">{artifact.name}</div>
                        <div className="text-sm text-gray-400">{artifact.type}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-400">{(artifact.size / 1024).toFixed(1)} KB</div>
                      <div className="text-xs text-gray-500">{new Date(artifact.createdAt).toLocaleDateString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};