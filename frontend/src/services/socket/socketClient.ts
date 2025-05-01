import { io, Socket } from "socket.io-client";
import type { Problem, Solution } from "../../types";

export interface NewExtractionEvent {
  type: "problem" | "solution";
  data: Problem | Solution;
}

export interface ExtractionUpdateEvent {
  type: "problem" | "solution";
  data: Problem | Solution;
}

type NewExtractionCallback = (event: NewExtractionEvent) => void;
type ExtractionUpdateCallback = (event: ExtractionUpdateEvent) => void;
type DisconnectCallback = () => void;
type ConnectCallback = () => void;

class SocketClient {
  private socket: Socket | null = null;
  private newExtractionCallbacks: NewExtractionCallback[] = [];
  private extractionUpdateCallbacks: ExtractionUpdateCallback[] = [];
  private disconnectCallbacks: DisconnectCallback[] = [];
  private connectCallbacks: ConnectCallback[] = [];
  private isConnected = false;
  private currentThemeId: string | null = null;
  private currentThreadId: string | null = null;

  constructor() {
    this.setupSocket();
  }

  private setupSocket(): void {
    if (this.socket) {
      return;
    }

    const baseUrl = typeof import.meta.env !== 'undefined' 
      ? import.meta.env.VITE_API_BASE_URL || "" 
      : "";
    this.socket = io(baseUrl, {
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    this.socket.on("connect", () => {
      console.log("Socket connected:", this.socket?.id);
      this.isConnected = true;
      
      if (this.currentThemeId) {
        this.subscribeToTheme(this.currentThemeId);
      }
      if (this.currentThreadId) {
        this.subscribeToThread(this.currentThreadId);
      }

      this.connectCallbacks.forEach((callback) => callback());
    });

    this.socket.on("disconnect", () => {
      console.log("Socket disconnected");
      this.isConnected = false;
      this.disconnectCallbacks.forEach((callback) => callback());
    });

    this.socket.on("new-extraction", (event: NewExtractionEvent) => {
      console.log("Received new extraction:", event);
      this.newExtractionCallbacks.forEach((callback) => callback(event));
    });

    this.socket.on("extraction-update", (event: ExtractionUpdateEvent) => {
      console.log("Received extraction update:", event);
      this.extractionUpdateCallbacks.forEach((callback) => callback(event));
    });
  }

  connect(): void {
    if (this.socket && !this.isConnected) {
      this.socket.connect();
    }
  }

  disconnect(): void {
    if (this.socket && this.isConnected) {
      this.socket.disconnect();
    }
  }

  subscribeToTheme(themeId: string): void {
    if (this.socket && this.isConnected) {
      this.socket.emit("subscribe-theme", themeId);
      this.currentThemeId = themeId;
      console.log(`Subscribed to theme: ${themeId}`);
    } else {
      this.currentThemeId = themeId;
      this.connect();
    }
  }

  subscribeToThread(threadId: string): void {
    if (this.socket && this.isConnected) {
      this.socket.emit("subscribe-thread", threadId);
      this.currentThreadId = threadId;
      console.log(`Subscribed to thread: ${threadId}`);
    } else {
      this.currentThreadId = threadId;
      this.connect();
    }
  }

  unsubscribeFromTheme(themeId: string): void {
    if (this.socket && this.isConnected) {
      this.socket.emit("unsubscribe-theme", themeId);
      if (this.currentThemeId === themeId) {
        this.currentThemeId = null;
      }
      console.log(`Unsubscribed from theme: ${themeId}`);
    }
  }

  unsubscribeFromThread(threadId: string): void {
    if (this.socket && this.isConnected) {
      this.socket.emit("unsubscribe-thread", threadId);
      if (this.currentThreadId === threadId) {
        this.currentThreadId = null;
      }
      console.log(`Unsubscribed from thread: ${threadId}`);
    }
  }

  onNewExtraction(callback: NewExtractionCallback): () => void {
    this.newExtractionCallbacks.push(callback);
    return () => {
      this.newExtractionCallbacks = this.newExtractionCallbacks.filter(
        (cb) => cb !== callback
      );
    };
  }

  onExtractionUpdate(callback: ExtractionUpdateCallback): () => void {
    this.extractionUpdateCallbacks.push(callback);
    return () => {
      this.extractionUpdateCallbacks = this.extractionUpdateCallbacks.filter(
        (cb) => cb !== callback
      );
    };
  }

  onDisconnect(callback: DisconnectCallback): () => void {
    this.disconnectCallbacks.push(callback);
    return () => {
      this.disconnectCallbacks = this.disconnectCallbacks.filter(
        (cb) => cb !== callback
      );
    };
  }

  onConnect(callback: ConnectCallback): () => void {
    this.connectCallbacks.push(callback);
    return () => {
      this.connectCallbacks = this.connectCallbacks.filter(
        (cb) => cb !== callback
      );
    };
  }
}

export const socketClient = new SocketClient();
