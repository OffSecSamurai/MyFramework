import Sidebar from "@/components/sidebar";
import ResultsTabs from "@/components/results-tabs";
import { Bell, UserCircle } from "lucide-react";

export default function Results() {
  return (
    <div className="flex h-screen bg-dark-bg text-white">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-dark-card border-b border-dark-border p-4 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <h2 className="text-2xl font-semibold">Results Analysis</h2>
          </div>
          <div className="flex items-center space-x-2 text-gray-400">
            <Bell className="w-5 h-5" />
            <UserCircle className="w-6 h-6" />
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            <div className="bg-dark-card border border-dark-border rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-4">Reconnaissance Results</h3>
              <p className="text-gray-400 mb-4">View and analyze your tool execution outputs and findings</p>
            </div>
            
            <ResultsTabs selectedTargetId={null} />
          </div>
        </main>
      </div>
    </div>
  );
}