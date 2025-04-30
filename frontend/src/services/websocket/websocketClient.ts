export class WebSocketClient {
  private url: string;
  private clientId: string;
  private socket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 3000; // 3秒ごとに再接続
  private subscribers = new Map<string, Set<(data: any) => void>>();
  private subscribedThreads = new Set<string>();
  private connectionPromise: Promise<void> | null = null;

  constructor(url: string, clientId: string) {
    this.url = url;
    this.clientId = clientId;
  }

  private getReconnectDelay(): number {
    return Math.min(
      30000,
      this.reconnectInterval * 2 ** this.reconnectAttempts
    );
  }

  public connect(): Promise<void> {
    if (this.connectionPromise) return this.connectionPromise;

    this.connectionPromise = new Promise((resolve, reject) => {
      try {
        this.socket = new WebSocket(`${this.url}/${this.clientId}`);

        this.socket.onopen = () => {
          console.log("WebSocket connected");
          this.reconnectAttempts = 0;

          this.subscribedThreads.forEach((threadId) => {
            this.subscribeToThread(threadId);
          });

          resolve();
        };

        this.socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            const eventType = data.type;

            if (this.subscribers.has(eventType)) {
              this.subscribers.get(eventType)?.forEach((callback) => {
                callback(data);
              });
            }
          } catch (error) {
            console.error("Error parsing WebSocket message:", error);
          }
        };

        this.socket.onerror = (error) => {
          console.error("WebSocket error:", error);
          reject(error);
        };

        this.socket.onclose = () => {
          console.log("WebSocket connection closed");
          this.connectionPromise = null;

          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            const delay = this.getReconnectDelay();
            console.log(`Attempting to reconnect in ${delay}ms...`);

            setTimeout(() => {
              this.reconnectAttempts++;
              this.connect().catch((error) => {
                console.error("Reconnection failed:", error);
              });
            }, delay);
          }
        };
      } catch (error) {
        console.error("Failed to create WebSocket:", error);
        this.connectionPromise = null;
        reject(error);
      }
    });

    return this.connectionPromise;
  }

  public disconnect(): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.close();
    }
  }

  public subscribe(
    eventType: string,
    callback: (data: any) => void
  ): () => void {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, new Set());
    }

    this.subscribers.get(eventType)?.add(callback);

    return () => {
      const callbacks = this.subscribers.get(eventType);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.subscribers.delete(eventType);
        }
      }
    };
  }

  public subscribeToThread(threadId: string): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(
        JSON.stringify({
          type: "subscribe",
          threadId,
        })
      );
      this.subscribedThreads.add(threadId);
    }
  }

  public unsubscribeFromThread(threadId: string): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(
        JSON.stringify({
          type: "unsubscribe",
          threadId,
        })
      );
      this.subscribedThreads.delete(threadId);
    }
  }
}

let wsClientInstance: WebSocketClient | null = null;

export function getWebSocketClient(): WebSocketClient {
  if (!wsClientInstance) {
    const wsUrl = "ws://localhost:3000/ws";
    const clientId = localStorage.getItem("userId") || crypto.randomUUID();
    wsClientInstance = new WebSocketClient(wsUrl, clientId);
  }

  return wsClientInstance;
}
