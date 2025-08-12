import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import VulnerabilityDashboard from "./vulnerability-dashboard";
import FileViewer from "./file-viewer";
import { Download, RefreshCw, Search, Play, Eye, Pause, RotateCcw } from "lucide-react";

interface ResultsTabsProps {
  selectedTargetId: string | null;
}

export default function ResultsTabs({ selectedTargetId }: ResultsTabsProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: executions = [], refetch: refetchExecutions } = useQuery<any[]>({
    queryKey: ["/api/executions", selectedTargetId],
    enabled: !!selectedTargetId,
  });

  const { data: files = [] } = useQuery<any[]>({
    queryKey: ["/api/files", selectedTargetId],
    enabled: !!selectedTargetId,
  });

  const { data: vulnerabilities = [] } = useQuery<any[]>({
    queryKey: ["/api/vulnerabilities", selectedTargetId],
    enabled: !!selectedTargetId,
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'text-status-running';
      case 'completed': return 'text-status-completed';
      case 'failed': return 'text-status-failed';
      default: return 'text-gray-400';
    }
  };

  const getStatusDot = (status: string) => {
    switch (status) {
      case 'running': return 'bg-status-running animate-pulse';
      case 'completed': return 'bg-status-completed';
      case 'failed': return 'bg-status-failed';
      default: return 'bg-status-available';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical': return 'text-red-500 bg-red-500/10';
      case 'high': return 'text-orange-500 bg-orange-500/10';
      case 'medium': return 'text-yellow-500 bg-yellow-500/10';
      case 'low': return 'text-blue-500 bg-blue-500/10';
      default: return 'text-gray-500 bg-gray-500/10';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };



  return (
    <Card className="bg-dark-card rounded-xl">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold">Results</h3>
          <div className="flex space-x-2">
            <Button 
              size="sm"
              className="bg-brand-green text-black hover:bg-green-400 font-medium"
              disabled={!selectedTargetId}
            >
              <Download className="mr-2 w-4 h-4" />
              Export All
            </Button>
            <Button 
              size="sm"
              variant="outline"
              className="border-dark-border hover:border-gray-500"
              onClick={() => refetchExecutions()}
              disabled={!selectedTargetId}
            >
              <RefreshCw className="mr-2 w-4 h-4" />
              Refresh
            </Button>
          </div>
        </div>

        <Tabs defaultValue="vulnerabilities" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-gray-900 border border-dark-border">
            <TabsTrigger value="vulnerabilities" className="data-[state=active]:bg-brand-green data-[state=active]:text-black">
              <Eye className="mr-2 w-4 h-4" />
              Vulnerabilities ({vulnerabilities.length})
            </TabsTrigger>
            <TabsTrigger value="files" className="data-[state=active]:bg-brand-green data-[state=active]:text-black">
              <Search className="mr-2 w-4 h-4" />
              Files ({files.length})
            </TabsTrigger>
            <TabsTrigger value="executions" className="data-[state=active]:bg-brand-green data-[state=active]:text-black">
              <Play className="mr-2 w-4 h-4" />
              Executions ({executions.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="vulnerabilities" className="mt-6">
            <VulnerabilityDashboard selectedTargetId={selectedTargetId} />
          </TabsContent>

          <TabsContent value="files" className="mt-6">
            <FileViewer selectedTargetId={selectedTargetId} />
          </TabsContent>

          <TabsContent value="executions" className="space-y-4 mt-6">
            {/* Search and Filter Bar */}
            <div className="flex items-center space-x-4 mb-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  type="text"
                  placeholder="Search executions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-gray-900 border-dark-border pl-10 text-white placeholder-gray-400 focus:border-brand-green"
                />
              </div>
              <Select value={stageFilter} onValueChange={setStageFilter}>
                <SelectTrigger className="w-40 bg-gray-900 border-dark-border text-white focus:border-brand-green">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-dark-border">
                  <SelectItem value="all">All Stages</SelectItem>
                  <SelectItem value="1">Stage 1</SelectItem>
                  <SelectItem value="2">Stage 2</SelectItem>
                  <SelectItem value="3">Stage 3</SelectItem>
                  <SelectItem value="4">Stage 4</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40 bg-gray-900 border-dark-border text-white focus:border-brand-green">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-dark-border">
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="running">Running</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Execution Rows */}
            <div className="space-y-2">
              {executions.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  {selectedTargetId ? 'No executions found' : 'Select a target to view executions'}
                </div>
              ) : (
                executions.map((execution: any) => (
                  <Card key={execution.id} className="bg-gray-900 border border-dark-border hover:border-gray-500 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className={`status-dot ${getStatusDot(execution.status)}`}></div>
                          <div>
                            <div className="font-medium">{execution.toolId}</div>
                            <div className="text-sm text-gray-400">
                              Stage {execution.stage} • {execution.status === 'completed' 
                                ? `Completed ${new Date(execution.completedAt).toLocaleString()}`
                                : execution.status === 'running'
                                ? `Running for ${Math.floor((Date.now() - new Date(execution.startedAt).getTime()) / 60000)} minutes`
                                : `Failed ${new Date(execution.completedAt || execution.startedAt).toLocaleString()}`
                              }
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className="text-sm text-gray-400 font-mono max-w-md truncate">
                            {execution.command}
                          </div>
                          {execution.status === 'running' ? (
                            <div className="flex items-center space-x-2">
                              <div className="bg-gray-800 rounded-full h-2 w-20">
                                <div 
                                  className="bg-status-running h-2 rounded-full progress-fill"
                                  style={{ width: `${execution.progress}%` }}
                                ></div>
                              </div>
                              <span className="text-sm text-status-running font-medium">{execution.progress}%</span>
                            </div>
                          ) : execution.status === 'completed' ? (
                            <div className="text-sm text-brand-green font-medium">
                              {execution.output || 'Completed'}
                            </div>
                          ) : (
                            <div className="text-sm text-status-failed font-medium">
                              {execution.errorMessage || 'Failed'}
                            </div>
                          )}
                          <Button size="sm" variant="ghost" className="text-gray-400 hover:text-white">
                            {execution.status === 'running' ? <Pause className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="files" className="space-y-4 mt-6">
            <div className="space-y-2">
              {files.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  {selectedTargetId ? 'No files found' : 'Select a target to view files'}
                </div>
              ) : (
                files.map((file: any) => (
                  <Card key={file.id} className="bg-gray-900 border border-dark-border hover:border-gray-500 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="text-2xl">📄</div>
                          <div>
                            <div className="font-medium">{file.filename}</div>
                            <div className="text-sm text-gray-400">
                              {file.contentType} • {formatFileSize(file.filesize)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button size="sm" variant="ghost" className="text-gray-400 hover:text-white">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="ghost" className="text-gray-400 hover:text-white">
                            <Download className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>


        </Tabs>
      </CardContent>
    </Card>
  );
}
