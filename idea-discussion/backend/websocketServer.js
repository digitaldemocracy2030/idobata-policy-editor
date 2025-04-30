import WebSocket from "ws";
import http from "node:http";

export function setupWebSocketServer(server) {
  const wss = new WebSocket.Server({ server });

  const clients = new Map();

  wss.on("connection", (ws, req) => {
    const clientId = req.url.split("/").pop();
    
    clients.set(ws, {
      id: clientId,
      threadIds: new Set(),
    });
    
    console.log(`WebSocket client connected: ${clientId}`);

    ws.on("message", (message) => {
      try {
        const data = JSON.parse(message);
        
        if (data.type === "subscribe" && data.threadId) {
          const client = clients.get(ws);
          client.threadIds.add(data.threadId);
          console.log(`Client ${clientId} subscribed to thread ${data.threadId}`);
        } else if (data.type === "unsubscribe" && data.threadId) {
          const client = clients.get(ws);
          client.threadIds.delete(data.threadId);
          console.log(`Client ${clientId} unsubscribed from thread ${data.threadId}`);
        }
      } catch (error) {
        console.error(`Invalid message from client ${clientId}:`, error);
      }
    });

    ws.on("close", () => {
      clients.delete(ws);
      console.log(`WebSocket client disconnected: ${clientId}`);
    });
  });

  const notifyClients = (threadId, data) => {
    clients.forEach((client, ws) => {
      if (client.threadIds.has(threadId) && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
      }
    });
  };

  return { notifyClients };
}
