import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Play, Target, Search, Settings, Zap } from "lucide-react";

interface ScanModeSelectorProps {
  selectedTargetId: string | null;
}

const scanModes = [
  {
    id: "full",
    name: "Full Reconnaissance",
    description: "Complete 4-stage reconnaissance workflow with all 24+ tools",
    icon: <Target className="w-5 h-5" />,
    color: "bg-red-600 hover:bg-red-700",
    tools: "24+ tools across 4 stages",
    duration: "30-60 minutes"
  },
  {
    id: "stage",
    name: "Stage-wise Scan",
    description: "Execute all tools in a specific reconnaissance stage",
    icon: <Search className="w-5 h-5" />,
    color: "bg-blue-600 hover:bg-blue-700",
    tools: "6-8 tools per stage",
    duration: "10-20 minutes"
  },
  {
    id: "custom",
    name: "Custom Scan",
    description: "Select specific tools for targeted reconnaissance",
    icon: <Settings className="w-5 h-5" />,
    color: "bg-purple-600 hover:bg-purple-700",
    tools: "User-defined selection",
    duration: "5-30 minutes"
  },
  {
    id: "pick",
    name: "Pick & Choose Tools",
    description: "Individual tool execution with automatic dependency handling",
    icon: <Zap className="w-5 h-5" />,
    color: "bg-emerald-600 hover:bg-emerald-700",
    tools: "Single or multiple tools",
    duration: "2-15 minutes"
  }
];

const stages = [
  { value: 1, label: "Stage 1: Passive Reconnaissance", tools: "Subdomain discovery, DNS resolution" },
  { value: 2, label: "Stage 2: Active Reconnaissance", tools: "Port scanning, service detection, screenshots" },
  { value: 3, label: "Stage 3: Spidering & Discovery", tools: "URL crawling, parameter discovery" },
  { value: 4, label: "Stage 4: Vulnerability Scanning", tools: "Nuclei, XSS, SQL injection testing" }
];

export default function ScanModeSelector({ selectedTargetId }: ScanModeSelectorProps) {
  const [selectedMode, setSelectedMode] = useState<string>("");
  const [selectedStage, setSelectedStage] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const executeScanMutation = useMutation({
    mutationFn: async (data: { scanMode: string; stage?: number }) => {
      return apiRequest("/api/execute-bulk", {
        method: "POST",
        body: JSON.stringify({
          targetId: selectedTargetId,
          scanMode: data.scanMode,
          stage: data.stage
        }),
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Scan Started",
        description: data.message || `Started ${data.scanMode} scan with ${data.executions?.length || 0} tools`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/executions", selectedTargetId] });
    },
    onError: (error: any) => {
      toast({
        title: "Scan Failed",
        description: error.message || "Failed to start scan",
        variant: "destructive",
      });
    },
  });

  const handleStartScan = () => {
    if (!selectedTargetId) {
      toast({
        title: "No Target Selected",
        description: "Please select a target before starting a scan",
        variant: "destructive",
      });
      return;
    }

    if (!selectedMode) {
      toast({
        title: "No Scan Mode Selected",
        description: "Please select a scan mode",
        variant: "destructive",
      });
      return;
    }

    if (selectedMode === "stage" && !selectedStage) {
      toast({
        title: "No Stage Selected",
        description: "Please select a stage for stage-wise scanning",
        variant: "destructive",
      });
      return;
    }

    executeScanMutation.mutate({
      scanMode: selectedMode,
      stage: selectedStage || undefined
    });
  };

  return (
    <Card className="border-gray-800 bg-black">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Play className="w-5 h-5 text-emerald-400" />
          Scan Mode Selection
        </CardTitle>
        <CardDescription className="text-gray-400">
          Choose your reconnaissance approach for {selectedTargetId ? "the selected target" : "a target"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Scan Mode Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {scanModes.map((mode) => (
            <div
              key={mode.id}
              className={`border rounded-lg p-4 cursor-pointer transition-all ${
                selectedMode === mode.id
                  ? "border-emerald-400 bg-emerald-400/10"
                  : "border-gray-700 hover:border-gray-600 bg-gray-900/50"
              }`}
              onClick={() => setSelectedMode(mode.id)}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={`p-2 rounded ${mode.color.split(' ')[0]} text-white`}>
                  {mode.icon}
                </div>
                <h3 className="font-semibold text-white text-sm">{mode.name}</h3>
              </div>
              <p className="text-xs text-gray-400 mb-3">{mode.description}</p>
              <div className="space-y-1">
                <Badge variant="outline" className="text-xs">
                  {mode.tools}
                </Badge>
                <div className="text-xs text-gray-500">~{mode.duration}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Stage Selection for Stage-wise Scan */}
        {selectedMode === "stage" && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-white">Select Stage</label>
            <Select onValueChange={(value) => setSelectedStage(parseInt(value))}>
              <SelectTrigger className="bg-gray-900 border-gray-700 text-white">
                <SelectValue placeholder="Choose a reconnaissance stage" />
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-gray-700">
                {stages.map((stage) => (
                  <SelectItem key={stage.value} value={stage.value.toString()}>
                    <div>
                      <div className="font-medium">{stage.label}</div>
                      <div className="text-xs text-gray-400">{stage.tools}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-800">
          <div className="text-sm text-gray-400">
            {selectedTargetId ? (
              <span className="text-emerald-400">Target selected</span>
            ) : (
              <span className="text-yellow-400">Select a target to continue</span>
            )}
          </div>
          <Button 
            onClick={handleStartScan}
            disabled={!selectedTargetId || !selectedMode || executeScanMutation.isPending}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {executeScanMutation.isPending ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Starting...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Start Scan
              </>
            )}
          </Button>
        </div>

        {/* Mode-specific Information */}
        {selectedMode && (
          <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800">
            <h4 className="text-white font-medium mb-2">
              {scanModes.find(m => m.id === selectedMode)?.name} Details
            </h4>
            <div className="text-sm text-gray-400 space-y-1">
              {selectedMode === "full" && (
                <div>
                  <p>• Executes all 24+ tools in sequential order across 4 stages</p>
                  <p>• Includes automatic dependency management and tool chaining</p>
                  <p>• Comprehensive reconnaissance with visual inspection (Aquatone)</p>
                </div>
              )}
              {selectedMode === "stage" && (
                <div>
                  <p>• Runs all tools within the selected reconnaissance stage</p>
                  <p>• Automatically handles inter-tool dependencies within the stage</p>
                  <p>• Perfect for targeted analysis of specific reconnaissance phases</p>
                </div>
              )}
              {selectedMode === "custom" && (
                <div>
                  <p>• Select specific tools from the stages grid below</p>
                  <p>• Dependencies are automatically resolved and executed</p>
                  <p>• Ideal for follow-up scans or specific vulnerability testing</p>
                </div>
              )}
              {selectedMode === "pick" && (
                <div>
                  <p>• Click individual tools in the stages grid for immediate execution</p>
                  <p>• Intelligent dependency checking runs required prerequisite tools</p>
                  <p>• Best for quick testing or running single reconnaissance tools</p>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}