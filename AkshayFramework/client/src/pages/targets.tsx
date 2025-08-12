import { useState } from "react";
import Sidebar from "@/components/sidebar";
import TargetGrid from "@/components/target-grid";
import CreateTargetModal from "@/components/create-target-modal";
import { Button } from "@/components/ui/button";
import { Plus, Bell, UserCircle } from "lucide-react";

export default function Targets() {
  const [isCreateTargetModalOpen, setIsCreateTargetModalOpen] = useState(false);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);

  return (
    <div className="flex h-screen bg-dark-bg text-white">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-dark-card border-b border-dark-border p-4 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <h2 className="text-2xl font-semibold">Target Management</h2>
          </div>
          <div className="flex items-center space-x-4">
            <Button 
              onClick={() => setIsCreateTargetModalOpen(true)}
              className="bg-brand-green text-black hover:bg-green-400 font-medium"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Target
            </Button>
            <div className="flex items-center space-x-2 text-gray-400">
              <Bell className="w-5 h-5" />
              <UserCircle className="w-6 h-6" />
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <TargetGrid 
            selectedTargetId={selectedTargetId}
            onTargetSelect={setSelectedTargetId}
            onCreateTarget={() => setIsCreateTargetModalOpen(true)}
          />
        </main>
      </div>

      <CreateTargetModal
        isOpen={isCreateTargetModalOpen}
        onClose={() => setIsCreateTargetModalOpen(false)}
      />
    </div>
  );
}