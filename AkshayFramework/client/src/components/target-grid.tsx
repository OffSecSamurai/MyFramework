import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Plus } from "lucide-react";

interface TargetGridProps {
  selectedTargetId: string | null;
  onTargetSelect: (targetId: string | null) => void;
  onCreateTarget: () => void;
}

export default function TargetGrid({ selectedTargetId, onTargetSelect, onCreateTarget }: TargetGridProps) {
  const { data: targets = [], isLoading } = useQuery({
    queryKey: ["/api/targets"],
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-status-running animate-pulse';
      case 'completed': return 'bg-status-completed';
      case 'failed': return 'bg-status-failed';
      default: return 'bg-status-available';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'running': return 'RUNNING';
      case 'completed': return 'COMPLETED';
      case 'failed': return 'FAILED';
      default: return 'READY';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h3 className="text-xl font-semibold">Select Target</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="bg-dark-card border-dark-border animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-gray-700 rounded mb-4"></div>
                <div className="h-3 bg-gray-700 rounded mb-6"></div>
                <div className="grid grid-cols-3 gap-4">
                  {[1, 2, 3].map((j) => (
                    <div key={j} className="text-center">
                      <div className="h-6 bg-gray-700 rounded mb-1"></div>
                      <div className="h-3 bg-gray-700 rounded"></div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold">Select Target</h3>
        <button className="text-brand-green hover:text-green-400 transition-colors text-sm">
          <span className="mr-2">⚏</span>
          Grid View
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {targets?.map((target: any) => (
          <Card
            key={target.id}
            className={`cursor-pointer tool-card-hover transition-all animate-slide-in ${
              selectedTargetId === target.id
                ? 'bg-dark-card border-2 border-brand-green'
                : 'bg-dark-card border border-dark-border hover:border-gray-500'
            }`}
            onClick={() => onTargetSelect(target.id)}
          >
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h4 className="font-semibold text-lg">{target.name}</h4>
                  <p className="text-gray-400 text-sm capitalize">{target.inputType} Domain</p>
                </div>
                <div className="flex items-center space-x-2">
                  <div className={`status-dot ${getStatusColor(target.status)}`}></div>
                  <span className={`text-xs font-medium ${
                    target.status === 'running' ? 'text-status-running' :
                    target.status === 'completed' ? 'text-status-completed' :
                    target.status === 'failed' ? 'text-status-failed' :
                    'text-status-available'
                  }`}>
                    {getStatusText(target.status)}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-xl font-bold text-brand-green">{target.subdomainCount || 0}</div>
                  <div className="text-xs text-gray-400">Subdomains</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-blue-400">{target.hostCount || 0}</div>
                  <div className="text-xs text-gray-400">Live Hosts</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-red-400">{target.vulnerabilityCount || 0}</div>
                  <div className="text-xs text-gray-400">Vulnerabilities</div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-dark-border">
                <div className="text-xs text-gray-400">
                  Created: {new Date(target.createdAt).toLocaleDateString()}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        
        {/* New Target Card */}
        <Card
          className="bg-dark-card border border-dashed border-dark-border cursor-pointer hover:border-brand-green hover:bg-gray-900 transition-all flex flex-col items-center justify-center text-center min-h-[200px]"
          onClick={onCreateTarget}
        >
          <CardContent className="p-6 flex flex-col items-center justify-center">
            <Plus className="w-12 h-12 text-gray-600 mb-4" />
            <h4 className="font-semibold text-gray-400 mb-2">Create New Target</h4>
            <p className="text-sm text-gray-500">Add a domain or upload URL list</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
