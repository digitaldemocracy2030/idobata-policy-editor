import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { getWebSocketClient } from "../services/websocket/websocketClient";

interface WebSocketContextType {
  client: ReturnType<typeof getWebSocketClient> | null;
  connected: boolean;
  subscribeToExtractions: (
    threadId: string,
    callback: (data: any) => void
  ) => () => void;
}

const WebSocketContext = createContext<WebSocketContextType>({
  client: null,
  connected: false,
  subscribeToExtractions: () => () => {},
});

export const useWebSocket = () => useContext(WebSocketContext);

interface WebSocketProviderProps {
  children: ReactNode;
}

export const WebSocketProvider = ({ children }: WebSocketProviderProps) => {
  const [client, setClient] = useState<ReturnType<typeof getWebSocketClient> | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const wsClient = getWebSocketClient();
    setClient(wsClient);

    wsClient
      .connect()
      .then(() => {
        setConnected(true);
      })
      .catch((error) => {
        console.error("Failed to connect to WebSocket:", error);
        setConnected(false);
      });

    return () => {
      wsClient.disconnect();
    };
  }, []);

  const subscribeToExtractions = (
    threadId: string,
    callback: (data: any) => void
  ) => {
    if (!client) return () => {};

    client.subscribeToThread(threadId);

    const unsubscribe = client.subscribe("extraction_update", (data) => {
      if (data.threadId === threadId) {
        callback(data);
      }
    });

    return () => {
      unsubscribe();
      client.unsubscribeFromThread(threadId);
    };
  };

  return (
    <WebSocketContext.Provider
      value={{ client, connected, subscribeToExtractions }}
    >
      {children}
    </WebSocketContext.Provider>
  );
};
