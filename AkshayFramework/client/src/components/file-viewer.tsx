import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { 
  FileText, 
  Download, 
  Search, 
  Image, 
  Code, 
  Database, 
  Globe,
  Calendar,
  HardDrive,
  Filter,
  Target
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface FileViewerProps {
  selectedTargetId: string | null;
}

const fileTypeIcons = {
  'text/plain': <FileText className="w-4 h-4" />,
  'text/html': <Code className="w-4 h-4" />,
  'application/json': <Database className="w-4 h-4" />,
  'image/png': <Image className="w-4 h-4" />,
  'image/jpeg': <Image className="w-4 h-4" />,
  'default': <FileText className="w-4 h-4" />
};

const getFileTypeIcon = (contentType: string) => {
  return fileTypeIcons[contentType as keyof typeof fileTypeIcons] || fileTypeIcons.default;
};

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const getToolStage = (filename: string) => {
  if (filename.includes('subdomain') || filename.includes('amass') || filename.includes('chaos')) return 1;
  if (filename.includes('nmap') || filename.includes('httpx') || filename.includes('aquatone')) return 2;
  if (filename.includes('gau') || filename.includes('wayback') || filename.includes('katana')) return 3;
  if (filename.includes('nuclei') || filename.includes('sqlmap') || filename.includes('xss')) return 4;
  return 0;
};

export default function FileViewer({ selectedTargetId }: FileViewerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStage, setSelectedStage] = useState<number | null>(null);
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const { toast } = useToast();

  const { data: files = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/files", selectedTargetId],
    enabled: !!selectedTargetId,
  });

  const { data: fileContent, isLoading: isLoadingContent } = useQuery({
    queryKey: ["/api/files", selectedFile?.id, "content"],
    queryFn: async () => {
      if (!selectedFile) return null;
      const response = await fetch(`/api/files/${selectedFile.id}/content`);
      return await response.text();
    },
    enabled: !!selectedFile,
  });

  const filteredFiles = files.filter(file => {
    const matchesSearch = file.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         file.filepath.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStage = selectedStage === null || getToolStage(file.filename) === selectedStage;
    return matchesSearch && matchesStage;
  });

  const groupedFiles = filteredFiles.reduce((acc, file) => {
    const stage = getToolStage(file.filename);
    const stageKey = stage === 0 ? 'other' : `stage${stage}`;
    if (!acc[stageKey]) acc[stageKey] = [];
    acc[stageKey].push(file);
    return acc;
  }, {} as Record<string, any[]>);

  const downloadFile = async (file: any) => {
    try {
      const response = await fetch(`/api/files/${file.id}/content`);
      const content = await response.text();
      const blob = new Blob([content], { type: file.contentType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.filename;
      a.click();
      URL.revokeObjectURL(url);
      
      toast({
        title: "Download started",
        description: `Downloading ${file.filename}`,
      });
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Failed to download file",
        variant: "destructive",
      });
    }
  };

  if (!selectedTargetId) {
    return (
      <Card className="border-gray-800 bg-black">
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center text-gray-400">
            <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Select a target to view generated files</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="border-gray-800 bg-black">
        <CardContent className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-gray-800 bg-black">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-400" />
            File Explorer
          </CardTitle>
          <CardDescription className="text-gray-400">
            Browse and analyze reconnaissance tool outputs
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search and Filter Controls */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search files..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-gray-900 border-gray-700 text-white"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={selectedStage === null ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedStage(null)}
                className="bg-gray-800 border-gray-700"
              >
                All Stages
              </Button>
              {[1, 2, 3, 4].map(stage => (
                <Button
                  key={stage}
                  variant={selectedStage === stage ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedStage(stage)}
                  className="bg-gray-800 border-gray-700"
                >
                  Stage {stage}
                </Button>
              ))}
            </div>
          </div>

          {filteredFiles.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No files found</p>
              <p className="text-sm">Run reconnaissance tools to generate output files</p>
            </div>
          ) : (
            <Tabs defaultValue="all" className="w-full">
              <TabsList className="grid w-full grid-cols-5 bg-gray-900">
                <TabsTrigger value="all">All ({filteredFiles.length})</TabsTrigger>
                <TabsTrigger value="stage1">Stage 1 ({groupedFiles.stage1?.length || 0})</TabsTrigger>
                <TabsTrigger value="stage2">Stage 2 ({groupedFiles.stage2?.length || 0})</TabsTrigger>
                <TabsTrigger value="stage3">Stage 3 ({groupedFiles.stage3?.length || 0})</TabsTrigger>
                <TabsTrigger value="stage4">Stage 4 ({groupedFiles.stage4?.length || 0})</TabsTrigger>
              </TabsList>

              <ScrollArea className="h-96 mt-4">
                <TabsContent value="all" className="space-y-2">
                  {filteredFiles.map((file) => (
                    <FileItem key={file.id} file={file} onDownload={downloadFile} onView={setSelectedFile} />
                  ))}
                </TabsContent>
                
                {[1, 2, 3, 4].map(stage => (
                  <TabsContent key={stage} value={`stage${stage}`} className="space-y-2">
                    {groupedFiles[`stage${stage}`]?.map((file) => (
                      <FileItem key={file.id} file={file} onDownload={downloadFile} onView={setSelectedFile} />
                    )) || <p className="text-gray-400 text-center py-4">No files for this stage</p>}
                  </TabsContent>
                ))}
              </ScrollArea>
            </Tabs>
          )}
        </CardContent>
      </Card>

      {/* File Content Dialog */}
      <Dialog open={!!selectedFile} onOpenChange={() => setSelectedFile(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] bg-gray-900 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              {selectedFile && getFileTypeIcon(selectedFile.contentType)}
              {selectedFile?.filename}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              {selectedFile && (
                <div className="flex items-center gap-4 text-sm">
                  <span>{formatFileSize(selectedFile.filesize)}</span>
                  <span>{selectedFile.contentType}</span>
                  <span>{new Date(selectedFile.createdAt).toLocaleString()}</span>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="h-[60vh] w-full">
            {isLoadingContent ? (
              <div className="flex items-center justify-center h-32">
                <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <pre className="text-sm text-gray-300 bg-gray-800 p-4 rounded whitespace-pre-wrap">
                {fileContent || 'No content available'}
              </pre>
            )}
          </ScrollArea>
          
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => selectedFile && downloadFile(selectedFile)}
              className="bg-gray-800 border-gray-700 text-white"
            >
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FileItem({ file, onDownload, onView }: { 
  file: any; 
  onDownload: (file: any) => void; 
  onView: (file: any) => void; 
}) {
  const stage = getToolStage(file.filename);
  
  return (
    <div className="flex items-center justify-between p-3 border border-gray-700 rounded-lg bg-gray-900/50 hover:bg-gray-800/50 transition-colors">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {getFileTypeIcon(file.contentType)}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-white font-medium truncate">{file.filename}</h4>
            {stage > 0 && (
              <Badge variant="outline" className="text-xs">
                Stage {stage}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <HardDrive className="w-3 h-3" />
              {formatFileSize(file.filesize)}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {new Date(file.createdAt).toLocaleString()}
            </span>
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onView(file)}
          className="text-gray-400 hover:text-white"
        >
          <FileText className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDownload(file)}
          className="text-gray-400 hover:text-white"
        >
          <Download className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}