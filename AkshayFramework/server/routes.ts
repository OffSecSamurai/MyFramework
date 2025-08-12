import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertTargetSchema, insertExecutionSchema } from "@shared/schema";
import { ToolExecutor } from "./services/tool-executor";
import { WebSocketManager } from "./services/websocket-manager";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  const wsManager = new WebSocketManager();
  const toolExecutor = new ToolExecutor(wsManager);

  // WebSocket connection handling
  wss.on('connection', (ws: WebSocket) => {
    console.log('WebSocket client connected');
    wsManager.addClient(ws);

    ws.on('close', () => {
      console.log('WebSocket client disconnected');
      wsManager.removeClient(ws);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });

  // Initialize default tools
  await storage.initializeTools();

  // Targets API
  app.get("/api/targets", async (req, res) => {
    try {
      const targets = await storage.getTargets();
      res.json(targets);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/targets", async (req, res) => {
    try {
      const parsed = insertTargetSchema.parse(req.body);
      const target = await storage.createTarget(parsed);
      res.json(target);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/targets/:id", async (req, res) => {
    try {
      const target = await storage.getTarget(req.params.id);
      if (!target) {
        return res.status(404).json({ error: "Target not found" });
      }
      res.json(target);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/targets/:id", async (req, res) => {
    try {
      await storage.deleteTarget(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Tools API
  app.get("/api/tools", async (req, res) => {
    try {
      const tools = await storage.getTools();
      res.json(tools);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Executions API
  app.get("/api/executions", async (req, res) => {
    try {
      const executions = await storage.getExecutions();
      res.json(executions);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/executions/:targetId", async (req, res) => {
    try {
      const executions = await storage.getExecutionsByTarget(req.params.targetId);
      res.json(executions);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/executions", async (req, res) => {
    try {
      const { targetId, toolId } = req.body;
      
      if (!targetId || !toolId) {
        return res.status(400).json({ error: "targetId and toolId are required" });
      }

      const target = await storage.getTarget(targetId);
      const tool = await storage.getTool(toolId);

      if (!target) {
        return res.status(404).json({ error: "Target not found" });
      }

      if (!tool) {
        return res.status(404).json({ error: "Tool not found" });
      }

      // Create execution record
      const execution = await storage.createExecution({
        targetId,
        toolId,
        command: tool.command,
        status: 'pending',
      });

      // Start tool execution asynchronously
      setImmediate(() => {
        toolExecutor.executeToolAsync(execution.id, tool, target);
      });

      res.json(execution);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/executions/:id/stop", async (req, res) => {
    try {
      await toolExecutor.stopExecution(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Bulk execute with scan modes
  app.post("/api/execute-bulk", async (req, res) => {
    try {
      const { targetId, toolIds, scanMode = "custom", stage } = req.body;
      
      if (!targetId) {
        return res.status(400).json({ error: "Target ID is required" });
      }

      const target = await storage.getTarget(targetId);
      if (!target) {
        return res.status(404).json({ error: "Target not found" });
      }

      let toolsToExecute: string[] = [];

      // Determine tools based on scan mode
      switch (scanMode) {
        case "full":
          // Full reconnaissance: all tools in order
          const allTools = await storage.getTools();
          toolsToExecute = allTools
            .sort((a, b) => a.stage - b.stage)
            .map(t => t.id);
          break;
        
        case "stage":
          // Stage-wise scan: all tools in specified stage
          if (!stage) {
            return res.status(400).json({ error: "Stage number required for stage-wise scan" });
          }
          const stageTools = await storage.getTools();
          toolsToExecute = stageTools
            .filter(t => t.stage === stage)
            .map(t => t.id);
          break;
        
        case "custom":
        case "pick":
          // Custom/Pick & Choose: use provided tool IDs
          if (!toolIds || !Array.isArray(toolIds)) {
            return res.status(400).json({ error: "Tool IDs are required for custom scan" });
          }
          toolsToExecute = toolIds;
          break;
        
        default:
          return res.status(400).json({ error: "Invalid scan mode" });
      }

      // Check if concurrent execution is enabled (from settings)
      const concurrent = req.body.concurrent || false;
      
      const executions = [];
      for (const toolId of toolsToExecute) {
        const tool = await storage.getTool(toolId);
        if (!tool) {
          continue;
        }

        const execution = await storage.createExecution({
          targetId,
          toolId,
          command: tool.command,
          status: "pending",
        });

        executions.push(execution);
      }

      // Execute tools sequentially by default (not concurrent)
      if (concurrent) {
        // Execute all tools simultaneously
        for (let i = 0; i < executions.length; i++) {
          const tool = await storage.getTool(toolsToExecute[i]);
          if (tool) {
            toolExecutor.executeToolAsync(executions[i].id, tool, target);
          }
        }
      } else {
        // Execute tools one by one (sequential)
        setImmediate(async () => {
          for (let i = 0; i < executions.length; i++) {
            const execution = executions[i];
            const tool = await storage.getTool(toolsToExecute[i]);
            
            if (!tool) continue;
            
            try {
              // Execute current tool and wait for completion
              await toolExecutor.executeToolAsync(execution.id, tool, target);
              
              // Wait for completion before next tool
              await new Promise<void>((resolve) => {
                const checkStatus = async () => {
                  try {
                    const exec = await storage.getExecution(execution.id);
                    if (!exec || exec.status === 'completed' || exec.status === 'failed') {
                      resolve();
                    } else {
                      setTimeout(checkStatus, 1000);
                    }
                  } catch (error) {
                    resolve();
                  }
                };
                checkStatus();
              });
            } catch (error) {
              console.error(`Sequential execution failed for ${tool.name}:`, error);
              // Continue to next tool even if current fails
            }
          }
        });
      }

      res.json({ 
        executions,
        scanMode,
        message: `Started ${scanMode} scan with ${executions.length} tools`
      });
    } catch (error) {
      console.error("Execute bulk tools error:", error);
      res.status(500).json({ error: "Failed to execute tools" });
    }
  });

  // Cancel execution endpoint
  app.post("/api/cancel/:targetId", async (req, res) => {
    try {
      const { targetId } = req.params;
      const executions = await storage.getExecutionsByTarget(targetId);
      
      let cancelledCount = 0;
      for (const execution of executions) {
        if (execution.status === 'running' || execution.status === 'pending') {
          // Cancel running process
          toolExecutor.cancelExecution(execution.id);
          
          // Update status
          await storage.updateExecution(execution.id, {
            status: 'failed',
            errorMessage: 'Cancelled by user',
            completedAt: new Date()
          });
          
          cancelledCount++;
        }
      }
      
      wsManager.broadcast({
        type: 'scan_cancelled',
        targetId,
        data: { cancelledCount }
      });
      
      res.json({ message: `Cancelled ${cancelledCount} executions`, cancelledCount });
    } catch (error: any) {
      console.error("Cancel executions error:", error);
      res.status(500).json({ error: "Failed to cancel executions" });
    }
  });

  // Skip current tool endpoint
  app.post("/api/skip/:targetId", async (req, res) => {
    try {
      const { targetId } = req.params;
      const executions = await storage.getExecutionsByTarget(targetId);
      const runningExecution = executions.find(e => e.status === 'running');
      
      if (runningExecution) {
        // Cancel current running tool
        toolExecutor.cancelExecution(runningExecution.id);
        
        await storage.updateExecution(runningExecution.id, {
          status: 'failed',
          errorMessage: 'Skipped by user',
          completedAt: new Date()
        });
        
        wsManager.broadcast({
          type: 'tool_skipped',
          targetId,
          executionId: runningExecution.id
        });
        
        res.json({ message: 'Current tool skipped', executionId: runningExecution.id });
      } else {
        res.json({ message: 'No running tool to skip' });
      }
    } catch (error: any) {
      console.error("Skip tool error:", error);
      res.status(500).json({ error: "Failed to skip tool" });
    }
  });

  // Files API
  app.get("/api/files/:targetId", async (req, res) => {
    try {
      const files = await storage.getFilesByTarget(req.params.targetId);
      res.json(files);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/files/:id/content", async (req, res) => {
    try {
      const file = await storage.getFile(req.params.id);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }

      res.setHeader('Content-Type', file.contentType || 'text/plain');
      res.send(file.content || '');
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Vulnerabilities API
  app.get("/api/vulnerabilities/:targetId", async (req, res) => {
    try {
      const vulnerabilities = await storage.getVulnerabilitiesByTarget(req.params.targetId);
      res.json(vulnerabilities);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return httpServer;
}
