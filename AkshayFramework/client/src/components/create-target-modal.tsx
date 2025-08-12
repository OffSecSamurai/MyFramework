import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface CreateTargetModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CreateTargetModal({ isOpen, onClose }: CreateTargetModalProps) {
  const [name, setName] = useState("");
  const [inputType, setInputType] = useState("domain");
  const [domain, setDomain] = useState("");
  const [urls, setUrls] = useState("");

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createTargetMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("/api/targets", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/targets"] });
      toast({
        title: "Target created successfully",
        description: `${name} has been added to your targets.`,
      });
      handleClose();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create target",
        description: error.message || "An unknown error occurred",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast({
        title: "Target name required",
        description: "Please enter a name for your target.",
        variant: "destructive",
      });
      return;
    }

    if (inputType === "domain" && !domain.trim()) {
      toast({
        title: "Domain required",
        description: "Please enter a domain for your target.",
        variant: "destructive",
      });
      return;
    }

    if (inputType === "list" && !urls.trim()) {
      toast({
        title: "URLs required",
        description: "Please enter URLs for your target.",
        variant: "destructive",
      });
      return;
    }

    const targetData = {
      name: name.trim(),
      inputType,
      ...(inputType === "domain" 
        ? { domain: domain.trim() }
        : { urls: urls.split('\n').filter(url => url.trim()) }
      )
    };

    createTargetMutation.mutate(targetData);
  };

  const handleClose = () => {
    setName("");
    setInputType("domain");
    setDomain("");
    setUrls("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-dark-card border-dark-border text-white max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Create New Target</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium text-gray-300">
              Target Name
            </Label>
            <Input
              id="name"
              type="text"
              placeholder="e.g., example.com"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-gray-900 border-dark-border text-white placeholder-gray-400 focus:border-brand-green"
            />
          </div>
          
          <div className="space-y-3">
            <Label className="text-sm font-medium text-gray-300">Input Type</Label>
            <RadioGroup 
              value={inputType} 
              onValueChange={setInputType}
              className="flex space-x-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="domain" id="domain" className="border-brand-green text-brand-green" />
                <Label htmlFor="domain" className="cursor-pointer">Single Domain</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="list" id="list" className="border-brand-green text-brand-green" />
                <Label htmlFor="list" className="cursor-pointer">URL List</Label>
              </div>
            </RadioGroup>
          </div>
          
          {inputType === "domain" ? (
            <div className="space-y-2">
              <Label htmlFor="domain" className="text-sm font-medium text-gray-300">
                Domain
              </Label>
              <Input
                id="domain"
                type="text"
                placeholder="example.com"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className="w-full bg-gray-900 border-dark-border text-white placeholder-gray-400 focus:border-brand-green"
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="urls" className="text-sm font-medium text-gray-300">
                URLs (one per line)
              </Label>
              <textarea
                id="urls"
                placeholder="https://example.com&#10;https://test.com&#10;https://demo.org"
                value={urls}
                onChange={(e) => setUrls(e.target.value)}
                className="w-full h-32 bg-gray-900 border border-dark-border rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-brand-green resize-none"
              />
            </div>
          )}
          
          <div className="flex space-x-4 pt-4">
            <Button
              type="submit"
              className="flex-1 bg-brand-green text-black hover:bg-green-400 font-medium"
              disabled={createTargetMutation.isPending}
            >
              {createTargetMutation.isPending ? "Creating..." : "Create Target"}
            </Button>
            <Button
              type="button"
              onClick={handleClose}
              className="flex-1 bg-gray-700 text-white hover:bg-gray-600 font-medium"
            >
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
