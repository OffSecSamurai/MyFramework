import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Pause, OctagonMinus, SkipForward, Square, RefreshCw } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useRef } from "react";

interface StagesGridProps {
  selectedTargetId: string | null;
}

const stageColors = {
  1: 'border-stage-1',
  2: 'border-stage-2',
  3: 'border-stage-3',
  4: 'border-stage-4',
};

const stageBgColors = {
  1: 'bg-stage-1',
  2: 'bg-stage-2',
  3: 'bg-stage-3',
  4: 'bg-stage-4',
};

const stageNames = {
  1: 'Passive Reconnaissance',
  2: 'Active Reconnaissance',
  3: 'Spidering & Discovery',
  4: 'Vulnerability Scanning',
};

const toolIcons = {
  'subfinder': '🔍',
  'assetfinder': '🎯',
  'findomain': '📡',
  'chaos': '⚡',
  'amass': '🌐',
  'dns-resolution': '🔗',
  'httpx': '🌐',
  'waf-detection': '🛡️',
  'nmap': '🔬',
  'service-detection': '⚙️',
  'visual-recon': '📸',
  'aquatone': '🖼️',
  'gau': '🕷️',
  'wayback': '⏰',
  'katana': '🗡️',
  'arjun': '🔍',
  'url-compilation': '📋',
  'gf-patterns': '🎯',
  'nuclei': '☢️',
  'dalfox': '⚔️',
  'sqlmap': '💉',
  'nikto': '🛡️',
};

export default function StagesGrid({ selectedTargetId }: StagesGridProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const wsRef = useRef<WebSocket | null>(null);

  const { data: tools = [] } = useQuery<any[]>({
    queryKey: ["/api/tools"],
  });

  const { data: executions = [] } = useQuery<any[]>({
    queryKey: ["/api/executions", selectedTargetId],
    enabled: !!selectedTargetId,
    refetchInterval: 2000, // Fallback polling every 2 seconds
  });

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (!selectedTargetId) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected for real-time updates');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.targetId === selectedTargetId) {
            // Invalidate and refetch execution data for real-time updates
            queryClient.invalidateQueries({ queryKey: ["/api/executions", selectedTargetId] });
          }
        } catch (error) {
          console.error('WebSocket message parse error:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
      };
    } catch (error) {
      console.error('WebSocket connection failed:', error);
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [selectedTargetId, queryClient]);

  // Single tool execution
  const executeSingleTool = useMutation({
    mutationFn: async ({ targetId, toolId }: { targetId: string; toolId: string }) => {
      return apiRequest(`/api/executions`, {
        method: 'POST',
        body: { targetId, toolId },
      });
    },
    onSuccess: (data, variables) => {
      toast({
        title: "Tool Started",
        description: `${variables.toolId} execution started successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/executions", selectedTargetId] });
    },
    onError: (error: any) => {
      toast({
        title: "Execution Failed",
        description: error.message || "Failed to start tool execution",
        variant: "destructive",
      });
    },
  });

  // Stop/Cancel tool execution
  const stopTool = useMutation({
    mutationFn: async (executionId: string) => {
      return apiRequest(`/api/executions/${executionId}/stop`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      toast({
        title: "Tool Stopped",
        description: "Tool execution stopped successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/executions", selectedTargetId] });
    },
  });

  // Cancel all executions for target
  const cancelAllTools = useMutation({
    mutationFn: async (targetId: string) => {
      return apiRequest(`/api/cancel/${targetId}`, {
        method: 'POST',
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Cancelled",
        description: `Cancelled ${data.cancelledCount} running tools`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/executions", selectedTargetId] });
    },
  });

  // Skip current tool
  const skipCurrentTool = useMutation({
    mutationFn: async (targetId: string) => {
      return apiRequest(`/api/skip/${targetId}`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      toast({
        title: "Skipped",
        description: "Current tool skipped, moving to next",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/executions", selectedTargetId] });
    },
  });

  const getToolExecution = (toolId: string) => {
    return executions.find((exec: any) => exec.toolId === toolId);
  };

  const getStatusColor = (status: string, isNextInLine: boolean = false) => {
    if (isNextInLine && status === 'pending') return 'bg-yellow-500 animate-pulse';
    switch (status) {
      case 'running': return 'bg-status-running animate-pulse';
      case 'completed': return 'bg-status-completed';
      case 'failed': return 'bg-status-failed';
      case 'pending': return 'bg-gray-500';
      default: return 'bg-status-available';
    }
  };

  const getProgressColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-status-running';
      case 'completed': return 'bg-status-completed';
      case 'failed': return 'bg-status-failed';
      default: return 'bg-gray-600';
    }
  };

  const groupedTools = tools.reduce((acc: any, tool: any) => {
    if (!acc[tool.stage]) acc[tool.stage] = [];
    acc[tool.stage].push(tool);
    return acc;
  }, {});

  const isDisabled = !selectedTargetId;
  const runningExecution = executions.find((exec: any) => exec.status === 'running');
  const hasRunningTools = !!runningExecution;

  // Determine next in line tool
  const getNextInLine = () => {
    if (!hasRunningTools) return null;
    const pendingExecutions = executions.filter((exec: any) => exec.status === 'pending');
    if (pendingExecutions.length === 0) return null;
    // Find the tool with the earliest creation time among pending
    return pendingExecutions.reduce((earliest: any, current: any) => 
      new Date(current.createdAt) < new Date(earliest.createdAt) ? current : earliest
    );
  };

  const nextInLine = getNextInLine();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">Stages & Tools</h3>
        {hasRunningTools && (
          <div className="flex items-center space-x-3 bg-gray-900 px-4 py-2 rounded-lg">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-status-running rounded-full animate-pulse"></div>
              <span className="text-sm text-gray-300">
                {runningExecution ? `Running: ${runningExecution.toolId}` : 'Processing...'}
              </span>
              {nextInLine && (
                <span className="text-xs text-yellow-400">
                  Next: {nextInLine.toolId}
                </span>
              )}
            </div>
            <div className="flex space-x-2">
              <Button
                size="sm"
                variant="outline"
                className="border-yellow-500 text-yellow-500 hover:bg-yellow-500 hover:text-black"
                onClick={() => selectedTargetId && skipCurrentTool.mutate(selectedTargetId)}
                disabled={skipCurrentTool.isPending}
              >
                <SkipForward className="w-3 h-3 mr-1" />
                Skip Current
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                onClick={() => selectedTargetId && cancelAllTools.mutate(selectedTargetId)}
                disabled={cancelAllTools.isPending}
              >
                <Square className="w-3 h-3 mr-1" />
                Cancel All
              </Button>
            </div>
          </div>
        )}
      </div>
      
      {[1, 2, 3, 4].map((stage) => (
        <Card key={stage} className={`bg-dark-card rounded-xl border-l-4 ${stageColors[stage as keyof typeof stageColors]}`}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className={`w-3 h-3 rounded-full ${stageBgColors[stage as keyof typeof stageBgColors]}`}></div>
                <h4 className="text-xl font-semibold">
                  Stage {stage}: {stageNames[stage as keyof typeof stageNames]}
                </h4>
                <span className={`px-2 py-1 text-xs font-medium rounded text-black ${stageBgColors[stage as keyof typeof stageBgColors]}`}>
                  {groupedTools[stage]?.length || 0} TOOLS
                </span>
              </div>
              <div className="flex space-x-2">
                <Button
                  className={`font-medium ${
                    isDisabled 
                      ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      : `${stageBgColors[stage as keyof typeof stageBgColors]} ${stage === 3 || stage === 4 ? 'text-white' : 'text-black'} hover:opacity-80`
                  }`}
                  disabled={isDisabled}
                  onClick={() => {
                    if (selectedTargetId) {
                      // Execute all tools in this stage
                      const stageTools = groupedTools[stage] || [];
                      stageTools.forEach((tool: any) => {
                        executeSingleTool.mutate({ targetId: selectedTargetId, toolId: tool.id });
                      });
                    }
                  }}
                >
                  <Play className="mr-2 w-4 h-4" />
                  Run Stage
                </Button>
                
                {hasRunningTools && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                    onClick={() => selectedTargetId && cancelAllTools.mutate(selectedTargetId)}
                    disabled={cancelAllTools.isPending}
                  >
                    <Square className="w-4 h-4 mr-1" />
                    Cancel All
                  </Button>
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {groupedTools[stage]?.map((tool: any) => {
                const execution = getToolExecution(tool.id);
                const status = execution?.status || 'available';
                const progress = execution?.progress || 0;
                
                return (
                  <Card key={tool.id} className="bg-gray-900 border border-dark-border tool-card-hover transition-all">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <span className="text-xl">
                            {toolIcons[tool.id as keyof typeof toolIcons] || '🔧'}
                          </span>
                          <span className="font-medium">{tool.name}</span>
                        </div>
                        <div className={`status-dot ${getStatusColor(status, nextInLine?.toolId === tool.id)}`}></div>
                      </div>
                      
                      <div className="mb-3">
                        <div className="bg-gray-800 rounded-full h-2 mb-2">
                          <div 
                            className={`h-2 rounded-full progress-fill ${getProgressColor(status)}`}
                            style={{ width: `${progress}%` }}
                          ></div>
                        </div>
                        <div className="text-xs text-gray-400">
                          {status === 'completed' && `Completed successfully • ${new Date(execution?.completedAt).toLocaleTimeString()}`}
                          {status === 'running' && `Running • ${progress}% complete`}
                          {status === 'failed' && `Failed • ${execution?.errorMessage || 'Unknown error'}`}
                          {status === 'pending' && nextInLine?.toolId === tool.id && `Next in line • Waiting for current tool`}
                          {status === 'pending' && nextInLine?.toolId !== tool.id && `Queued • Will run after previous tools`}
                          {status === 'available' && `Ready • Click Execute to run`}
                        </div>
                      </div>
                      
                      <div className="flex space-x-1">
                        <Button
                          size="sm"
                          className={`flex-1 text-sm font-medium ${
                            status === 'running' 
                              ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                              : isDisabled
                              ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                              : `${stageBgColors[stage as keyof typeof stageBgColors]} ${stage === 3 || stage === 4 ? 'text-white' : 'text-black'} hover:opacity-80`
                          }`}
                          disabled={status === 'running' || isDisabled || executeSingleTool.isPending}
                          onClick={() => {
                            if (selectedTargetId && status !== 'running') {
                              executeSingleTool.mutate({ targetId: selectedTargetId, toolId: tool.id });
                            }
                          }}
                        >
                          {executeSingleTool.isPending ? (
                            <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                          ) : status === 'running' ? (
                            <Pause className="w-3 h-3 mr-1" />
                          ) : (
                            <Play className="w-3 h-3 mr-1" />
                          )}
                          {status === 'running' ? 'Running...' : executeSingleTool.isPending ? 'Starting...' : 'Execute'}
                        </Button>
                        
                        {status === 'running' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                            onClick={() => execution && stopTool.mutate(execution.id)}
                            disabled={stopTool.isPending}
                          >
                            <Square className="w-3 h-3" />
                          </Button>
                        )}
                        
                        {hasRunningTools && nextInLine?.toolId === tool.id && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-yellow-500 text-yellow-500 hover:bg-yellow-500 hover:text-black"
                            onClick={() => selectedTargetId && skipCurrentTool.mutate(selectedTargetId)}
                            disabled={skipCurrentTool.isPending}
                          >
                            <SkipForward className="w-3 h-3" />
                          </Button>
                        )}
                        

                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
