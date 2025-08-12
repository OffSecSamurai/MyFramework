import { useEffect, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

interface WebSocketMessage {
  type: string;
  targetId?: string;
  toolId?: string;
  executionId?: string;
  data?: any;
}

interface UseWebSocketOptions {
  onMessage?: (message: WebSocketMessage) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
}

export function useWebSocket({ onMessage, onOpen, onClose, onError }: UseWebSocketOptions = {}) {
  const ws = useRef<WebSocket | null>(null);
  const { toast } = useToast();

  const connect = useCallback(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      console.log("WebSocket connected");
      onOpen?.();
    };

    ws.current.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        console.log("WebSocket message received:", message);
        
        // Handle different message types
        switch (message.type) {
          case 'execution_started':
            toast({
              title: "Execution Started",
              description: `${message.data?.toolName} execution has started.`,
            });
            break;
          case 'execution_progress':
            // Progress updates are handled by the components that subscribe to them
            break;
          case 'execution_completed':
            toast({
              title: "Execution Completed",
              description: `${message.data?.toolName} execution completed successfully.`,
            });
            break;
          case 'execution_failed':
            toast({
              title: "Execution Failed",
              description: `${message.data?.toolName} execution failed: ${message.data?.error}`,
              variant: "destructive",
            });
            break;
          case 'vulnerability_found':
            toast({
              title: "Vulnerability Found",
              description: `${message.data?.severity} severity vulnerability found: ${message.data?.title}`,
              variant: "destructive",
            });
            break;
          default:
            console.log("Unknown WebSocket message type:", message.type);
        }
        
        onMessage?.(message);
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error);
      }
    };

    ws.current.onclose = () => {
      console.log("WebSocket disconnected");
      onClose?.();
      // Attempt to reconnect after 3 seconds
      setTimeout(connect, 3000);
    };

    ws.current.onerror = (error) => {
      console.error("WebSocket error:", error);
      onError?.(error);
    };
  }, [onMessage, onOpen, onClose, onError, toast]);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    } else {
      console.error("WebSocket is not connected");
    }
  }, []);

  const disconnect = useCallback(() => {
    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }
  }, []);

  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    sendMessage,
    disconnect,
    isConnected: ws.current?.readyState === WebSocket.OPEN,
  };
}
