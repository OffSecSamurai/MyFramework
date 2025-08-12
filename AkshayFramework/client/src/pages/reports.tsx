import Sidebar from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell, UserCircle, Download, FileText, BarChart3 } from "lucide-react";

export default function Reports() {
  return (
    <div className="flex h-screen bg-dark-bg text-white">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-dark-card border-b border-dark-border p-4 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <h2 className="text-2xl font-semibold">Report Generation</h2>
          </div>
          <div className="flex items-center space-x-2 text-gray-400">
            <Bell className="w-5 h-5" />
            <UserCircle className="w-6 h-6" />
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="bg-dark-card border-dark-border">
              <CardHeader>
                <CardTitle className="flex items-center text-white">
                  <FileText className="w-5 h-5 mr-2" />
                  Executive Summary
                </CardTitle>
                <CardDescription>
                  Generate a high-level overview report for stakeholders
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-brand-green text-black hover:bg-green-400">
                  <Download className="w-4 h-4 mr-2" />
                  Generate Report
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-dark-card border-dark-border">
              <CardHeader>
                <CardTitle className="flex items-center text-white">
                  <BarChart3 className="w-5 h-5 mr-2" />
                  Technical Report
                </CardTitle>
                <CardDescription>
                  Detailed technical findings and vulnerability analysis
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-brand-green text-black hover:bg-green-400">
                  <Download className="w-4 h-4 mr-2" />
                  Generate Report
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-dark-card border-dark-border">
              <CardHeader>
                <CardTitle className="flex items-center text-white">
                  <FileText className="w-5 h-5 mr-2" />
                  Raw Data Export
                </CardTitle>
                <CardDescription>
                  Export all raw scan data and tool outputs
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-brand-green text-black hover:bg-green-400">
                  <Download className="w-4 h-4 mr-2" />
                  Export Data
                </Button>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}