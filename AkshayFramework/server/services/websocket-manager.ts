import { WebSocket } from 'ws';

interface WebSocketMessage {
  type: string;
  targetId?: string;
  toolId?: string;
  executionId?: string;
  data?: any;
}

export class WebSocketManager {
  private clients: Set<WebSocket> = new Set();

  addClient(ws: WebSocket): void {
    this.clients.add(ws);
    console.log(`WebSocket client added. Total clients: ${this.clients.size}`);

    ws.on('close', () => {
      this.removeClient(ws);
    });

    ws.on('error', (error) => {
      console.error('WebSocket client error:', error);
      this.removeClient(ws);
    });
  }

  removeClient(ws: WebSocket): void {
    this.clients.delete(ws);
    console.log(`WebSocket client removed. Total clients: ${this.clients.size}`);
  }

  broadcast(message: WebSocketMessage): void {
    const messageStr = JSON.stringify(message);
    const clientsToRemove: WebSocket[] = [];

    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(messageStr);
        } catch (error) {
          console.error('Failed to send message to WebSocket client:', error);
          clientsToRemove.push(client);
        }
      } else {
        clientsToRemove.push(client);
      }
    });

    // Remove dead connections
    clientsToRemove.forEach((client) => {
      this.removeClient(client);
    });
  }

  sendToClient(ws: WebSocket, message: WebSocketMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('Failed to send message to specific WebSocket client:', error);
        this.removeClient(ws);
      }
    }
  }

  getClientCount(): number {
    return this.clients.size;
  }
}
