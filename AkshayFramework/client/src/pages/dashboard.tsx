import { useState } from "react";
import Sidebar from "@/components/sidebar";
import TargetGrid from "@/components/target-grid";
import ScanModeSelector from "@/components/scan-mode-selector";
import StagesGrid from "@/components/stages-grid";
import ResultsTabs from "@/components/results-tabs";
import CreateTargetModal from "@/components/create-target-modal";
import { Button } from "@/components/ui/button";
import { Bell, UserCircle } from "lucide-react";

export default function Dashboard() {
  const [isCreateTargetModalOpen, setIsCreateTargetModalOpen] = useState(false);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);

  return (
    <div className="flex h-screen bg-dark-bg text-white">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-dark-card border-b border-dark-border p-4 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <h2 className="text-2xl font-semibold">Dashboard</h2>
            <span className="px-3 py-1 bg-brand-green text-black text-sm font-medium rounded-full">
              3 Active Targets
            </span>
          </div>
          <div className="flex items-center space-x-4">
            <Button 
              onClick={() => setIsCreateTargetModalOpen(true)}
              className="bg-brand-green text-black hover:bg-green-400 font-medium"
            >
              <span className="mr-2">+</span>
              New Target
            </Button>
            <div className="flex items-center space-x-2 text-gray-400">
              <Bell className="w-5 h-5" />
              <UserCircle className="w-6 h-6" />
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          <TargetGrid 
            selectedTargetId={selectedTargetId}
            onTargetSelect={setSelectedTargetId}
            onCreateTarget={() => setIsCreateTargetModalOpen(true)}
          />
          
          <ScanModeSelector selectedTargetId={selectedTargetId} />
          
          <StagesGrid selectedTargetId={selectedTargetId} />
          
          <ResultsTabs selectedTargetId={selectedTargetId} />
        </main>
      </div>

      <CreateTargetModal
        isOpen={isCreateTargetModalOpen}
        onClose={() => setIsCreateTargetModalOpen(false)}
      />
    </div>
  );
}
