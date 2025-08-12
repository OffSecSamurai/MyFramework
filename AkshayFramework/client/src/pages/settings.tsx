import Sidebar from "@/components/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Bell, UserCircle, Key, Database, Shield } from "lucide-react";

export default function Settings() {
  return (
    <div className="flex h-screen bg-dark-bg text-white">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-dark-card border-b border-dark-border p-4 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <h2 className="text-2xl font-semibold">Application Settings</h2>
          </div>
          <div className="flex items-center space-x-2 text-gray-400">
            <Bell className="w-5 h-5" />
            <UserCircle className="w-6 h-6" />
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            <Card className="bg-dark-card border-dark-border">
              <CardHeader>
                <CardTitle className="flex items-center text-white">
                  <Key className="w-5 h-5 mr-2" />
                  API Configuration
                </CardTitle>
                <CardDescription>
                  Configure API keys for enhanced tool functionality
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="chaos-api">Chaos API Key</Label>
                    <Input 
                      id="chaos-api" 
                      type="password" 
                      placeholder="Enter Chaos API key"
                      className="bg-gray-900 border-dark-border text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="shodan-api">Shodan API Key</Label>
                    <Input 
                      id="shodan-api" 
                      type="password" 
                      placeholder="Enter Shodan API key"
                      className="bg-gray-900 border-dark-border text-white"
                    />
                  </div>
                </div>
                <Button className="bg-brand-green text-black hover:bg-green-400">
                  Save API Keys
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-dark-card border-dark-border">
              <CardHeader>
                <CardTitle className="flex items-center text-white">
                  <Shield className="w-5 h-5 mr-2" />
                  Tool Settings
                </CardTitle>
                <CardDescription>
                  Configure tool execution and security settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="concurrent-tools">Enable Concurrent Tool Execution</Label>
                    <p className="text-sm text-gray-400">Allow multiple tools to run simultaneously</p>
                  </div>
                  <Switch id="concurrent-tools" />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="auto-backup">Auto-backup Results</Label>
                    <p className="text-sm text-gray-400">Automatically backup scan results</p>
                  </div>
                  <Switch id="auto-backup" defaultChecked />
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}