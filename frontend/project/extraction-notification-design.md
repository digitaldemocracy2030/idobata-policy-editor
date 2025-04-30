# 課題抽出通知機能の設計と実装計画

## 概要

ThemeDetail.tsx ページのチャット機能において、ユーザーの発言から課題や解決策が抽出された場合に、その旨をチャット上に通知する機能を実装します。現在の実装では、抽出されたデータを取得するためにポーリングが必要ですが、これは設計上好ましくありません。代わりに、MongoDB の Change Streams を活用した効率的な方法を提案します。

## 現状分析

### 現在の実装

1. **フロントエンド**:

   - ThemeDetailTemplate.tsx で FloatingChat コンポーネントを使用してチャット機能を実装
   - ユーザーがメッセージを送信すると、apiClient.sendMessage を通じてバックエンドに送信
   - 現在、抽出された課題/解決策の通知機能は実装されていない

2. **バックエンド**:

   - chatController.js がメッセージを処理し、AI 応答を生成
   - メッセージ処理後、非同期で extractionWorker を呼び出して課題/解決策の抽出を行う
   - 抽出された課題/解決策は ChatThread モデルの extractedProblemIds と extractedSolutionIds に保存

3. **課題**:
   - 現在、抽出結果を確認するには定期的なポーリングが必要
   - ポーリングは効率が悪く、サーバーリソースを無駄に消費する

## 提案する解決策: MongoDB Change Streams

MongoDB の Change Streams を活用して、データベースの変更をリアルタイムで監視し、変更があった場合にクライアントに通知する方法を提案します。

### 概要

1. **バックエンド**:

   - MongoDB Change Streams を設定し、ChatThread コレクションの変更を監視
   - WebSocket サーバーを実装し、クライアントとの接続を管理
   - 抽出が完了して ChatThread が更新されたら、WebSocket を通じてクライアントに通知

2. **フロントエンド**:
   - WebSocket 接続を確立し、抽出通知を受信
   - 通知を受け取ったら、チャットに表示

### 技術的な詳細

#### MongoDB Change Streams

MongoDB Change Streams は、コレクションやデータベースの変更をリアルタイムで監視する機能です。この機能を使用するには、MongoDB がレプリカセットまたはシャードクラスタとして構成されている必要があります。

Change Streams の主な利点:

- リアルタイム通知: データベースの変更をリアルタイムで検出
- 効率性: ポーリングと比較して、サーバーリソースを大幅に節約
- 信頼性: 変更イベントは永続化され、クライアントが一時的に切断されても再接続時に取得可能

## 詳細実装計画

### バックエンド実装

1. **WebSocket サーバーの設定**:

```javascript
// websocketServer.js
import WebSocket from "ws";
import http from "http";

// WebSocketサーバーの作成
export function setupWebSocketServer(server) {
  const wss = new WebSocket.Server({ server });

  // クライアント接続を管理するマップ
  const clients = new Map();

  wss.on("connection", (ws, req) => {
    const clientId = req.url.split("/").pop(); // URLからクライアントIDを取得

    // クライアント情報を保存
    clients.set(ws, {
      id: clientId,
      threadIds: new Set(), // 監視対象のスレッドID
    });

    console.log(`WebSocket client connected: ${clientId}`);

    // メッセージ受信ハンドラ
    ws.on("message", (message) => {
      try {
        const data = JSON.parse(message);

        // スレッド監視登録メッセージ
        if (data.type === "subscribe" && data.threadId) {
          const client = clients.get(ws);
          client.threadIds.add(data.threadId);
          console.log(
            `Client ${clientId} subscribed to thread ${data.threadId}`
          );
        }

        // スレッド監視解除メッセージ
        if (data.type === "unsubscribe" && data.threadId) {
          const client = clients.get(ws);
          client.threadIds.delete(data.threadId);
          console.log(
            `Client ${clientId} unsubscribed from thread ${data.threadId}`
          );
        }
      } catch (err) {
        console.error("Invalid message format:", err);
      }
    });

    // 接続終了ハンドラ
    ws.on("close", () => {
      clients.delete(ws);
      console.log(`WebSocket client disconnected: ${clientId}`);
    });
  });

  // 特定のスレッドを監視しているクライアントにメッセージを送信する関数
  const notifyClients = (threadId, data) => {
    clients.forEach((client, ws) => {
      if (client.threadIds.has(threadId) && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
      }
    });
  };

  return { wss, notifyClients };
}
```

2. **Change Streams の設定**:

```javascript
// changeStreamManager.js
import mongoose from "mongoose";
import Problem from "../models/Problem.js";
import Solution from "../models/Solution.js";

export async function setupChangeStreams(notifyClients) {
  // ChatThreadコレクションの変更を監視
  const chatThreadCollection = mongoose.connection.collection("chatthreads");

  // パイプラインを設定: extractedProblemIdsまたはextractedSolutionIdsが変更された場合のみ通知
  const pipeline = [
    {
      $match: {
        $or: [
          {
            "updateDescription.updatedFields.extractedProblemIds": {
              $exists: true,
            },
          },
          {
            "updateDescription.updatedFields.extractedSolutionIds": {
              $exists: true,
            },
          },
        ],
        operationType: "update",
      },
    },
  ];

  // Change Streamを作成
  const changeStream = chatThreadCollection.watch(pipeline);

  // 変更イベントのハンドラ
  changeStream.on("change", async (change) => {
    try {
      const threadId = change.documentKey._id.toString();
      console.log(`Detected change in thread ${threadId}`);

      // 変更されたドキュメントの最新バージョンを取得
      const updatedThread = await mongoose.connection
        .collection("chatthreads")
        .findOne({ _id: change.documentKey._id });

      // 新しく追加された抽出IDを特定
      const newProblemIds = [];
      const newSolutionIds = [];

      // 変更フィールドを確認
      if (change.updateDescription.updatedFields.extractedProblemIds) {
        // 新しく追加された問題IDを取得
        const updatedProblemIds =
          change.updateDescription.updatedFields.extractedProblemIds;
        if (Array.isArray(updatedProblemIds) && updatedProblemIds.length > 0) {
          newProblemIds.push(...updatedProblemIds.map((id) => id.toString()));
        }
      }

      if (change.updateDescription.updatedFields.extractedSolutionIds) {
        // 新しく追加された解決策IDを取得
        const updatedSolutionIds =
          change.updateDescription.updatedFields.extractedSolutionIds;
        if (
          Array.isArray(updatedSolutionIds) &&
          updatedSolutionIds.length > 0
        ) {
          newSolutionIds.push(...updatedSolutionIds.map((id) => id.toString()));
        }
      }

      // 新しい抽出がある場合のみ通知
      if (newProblemIds.length > 0 || newSolutionIds.length > 0) {
        // 抽出された問題と解決策の詳細を取得
        const [problems, solutions] = await Promise.all([
          Problem.find({ _id: { $in: newProblemIds } }).lean(),
          Solution.find({ _id: { $in: newSolutionIds } }).lean(),
        ]);

        // クライアントに通知
        notifyClients(threadId, {
          type: "extraction_update",
          threadId,
          extractions: {
            problems: problems.map((p) => ({
              id: p._id.toString(),
              statement: p.statement,
            })),
            solutions: solutions.map((s) => ({
              id: s._id.toString(),
              statement: s.statement,
            })),
          },
        });

        console.log(
          `Notified clients about new extractions in thread ${threadId}`
        );
      }
    } catch (err) {
      console.error("Error processing change event:", err);
    }
  });

  console.log("Change stream for ChatThread collection established");

  // エラーハンドリング
  changeStream.on("error", (error) => {
    console.error("Change stream error:", error);
    // 再接続ロジックを実装
    setTimeout(() => setupChangeStreams(notifyClients), 5000);
  });

  return changeStream;
}
```

3. **サーバー起動スクリプトの修正**:

```javascript
// server.js
import express from "express";
import http from "http";
import mongoose from "mongoose";
import { setupWebSocketServer } from "./websocketServer.js";
import { setupChangeStreams } from "./changeStreamManager.js";

const app = express();
const server = http.createServer(app);

// WebSocketサーバーのセットアップ
const { notifyClients } = setupWebSocketServer(server);

// MongoDBへの接続
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    // レプリカセットが必要
    replicaSet: "rs0",
  })
  .then(async () => {
    console.log("Connected to MongoDB");

    // Change Streamsのセットアップ
    await setupChangeStreams(notifyClients);

    // サーバー起動
    server.listen(process.env.PORT, () => {
      console.log(`Server running on port ${process.env.PORT}`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
  });
```

### フロントエンド実装

1. **WebSocket クライアントの実装**:

```typescript
// src/services/websocket/websocketClient.ts
export class WebSocketClient {
  private socket: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000; // 3秒
  private subscriptions = new Map<string, Set<(data: any) => void>>();
  private threadSubscriptions = new Set<string>();

  constructor(private url: string, private clientId: string) {}

  // WebSocket接続を確立
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.socket = new WebSocket(`${this.url}/${this.clientId}`);

        this.socket.onopen = () => {
          console.log("WebSocket connected");
          this.reconnectAttempts = 0;

          // 以前に購読していたスレッドを再購読
          this.threadSubscriptions.forEach((threadId) => {
            this.subscribeToThread(threadId);
          });

          resolve();
        };

        this.socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (err) {
            console.error("Error parsing WebSocket message:", err);
          }
        };

        this.socket.onclose = () => {
          console.log("WebSocket disconnected");
          this.socket = null;
          this.attemptReconnect();
        };

        this.socket.onerror = (error) => {
          console.error("WebSocket error:", error);
          reject(error);
        };
      } catch (err) {
        console.error("Error creating WebSocket:", err);
        reject(err);
      }
    });
  }

  // 再接続を試みる
  private attemptReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(
        `Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`
      );

      this.reconnectTimer = setTimeout(() => {
        this.connect().catch(() => {
          this.attemptReconnect();
        });
      }, this.reconnectDelay);
    } else {
      console.error("Max reconnect attempts reached");
    }
  }

  // メッセージハンドラ
  private handleMessage(data: any) {
    if (data.type && this.subscriptions.has(data.type)) {
      const handlers = this.subscriptions.get(data.type);
      if (handlers) {
        handlers.forEach((handler) => handler(data));
      }
    }
  }

  // メッセージタイプに対するハンドラを登録
  subscribe(type: string, handler: (data: any) => void) {
    if (!this.subscriptions.has(type)) {
      this.subscriptions.set(type, new Set());
    }

    const handlers = this.subscriptions.get(type);
    if (handlers) {
      handlers.add(handler);
    }

    return () => {
      const handlers = this.subscriptions.get(type);
      if (handlers) {
        handlers.delete(handler);
      }
    };
  }

  // スレッドの監視を開始
  subscribeToThread(threadId: string) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      this.threadSubscriptions.add(threadId);
      return;
    }

    this.socket.send(
      JSON.stringify({
        type: "subscribe",
        threadId,
      })
    );

    this.threadSubscriptions.add(threadId);
  }

  // スレッドの監視を終了
  unsubscribeFromThread(threadId: string) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(
        JSON.stringify({
          type: "unsubscribe",
          threadId,
        })
      );
    }

    this.threadSubscriptions.delete(threadId);
  }

  // 接続を閉じる
  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

// シングルトンインスタンス
let wsClientInstance: WebSocketClient | null = null;

// WebSocketクライアントのインスタンスを取得
export function getWebSocketClient(): WebSocketClient {
  if (!wsClientInstance) {
    const wsUrl = import.meta.env.VITE_WS_URL || "ws://localhost:3000/ws";
    const clientId = localStorage.getItem("userId") || crypto.randomUUID();
    wsClientInstance = new WebSocketClient(wsUrl, clientId);
  }

  return wsClientInstance;
}
```

2. **WebSocket コンテキストの作成**:

```typescript
// src/contexts/WebSocketContext.tsx
import React, { createContext, useContext, useEffect, useState } from "react";
import {
  getWebSocketClient,
  WebSocketClient,
} from "../services/websocket/websocketClient";

interface WebSocketContextType {
  client: WebSocketClient | null;
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

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [client, setClient] = useState<WebSocketClient | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const wsClient = getWebSocketClient();
    setClient(wsClient);

    wsClient
      .connect()
      .then(() => setConnected(true))
      .catch((err) => console.error("Failed to connect to WebSocket:", err));

    return () => {
      wsClient.disconnect();
    };
  }, []);

  const subscribeToExtractions = (
    threadId: string,
    callback: (data: any) => void
  ) => {
    if (!client) return () => {};

    // スレッドを購読
    client.subscribeToThread(threadId);

    // 抽出更新イベントを購読
    const unsubscribe = client.subscribe("extraction_update", (data) => {
      if (data.threadId === threadId) {
        callback(data);
      }
    });

    // クリーンアップ関数
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
```

3. **ThemeDetailTemplate.tsx の修正**:

```typescript
import { useEffect, useRef, useState } from "react";
import { apiClient } from "../../services/api/apiClient";
import { FloatingChat, type FloatingChatRef } from "../chat/FloatingChat";
import BreadcrumbView from "../common/BreadcrumbView";
import CommentCard from "./CommentCard";
import KeyQuestionCard from "./KeyQuestionCard";
import { useWebSocket } from "../../contexts/WebSocketContext";

interface ThemeDetailTemplateProps {
  theme: {
    _id: string;
    title: string;
    description: string;
  };
  keyQuestions: {
    id: number | string;
    question: string;
    voteCount: number;
    issueCount: number;
    solutionCount: number;
  }[];
  issues: {
    id: number | string;
    text: string;
  }[];
  solutions: {
    id: number | string;
    text: string;
  }[];
}

const ThemeDetailTemplate = ({
  theme,
  keyQuestions,
  issues,
  solutions,
}: ThemeDetailTemplateProps) => {
  const [activeTab, setActiveTab] = useState<"issues" | "solutions">("issues");
  const chatRef = useRef<FloatingChatRef>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string>(
    localStorage.getItem("userId") || crypto.randomUUID()
  );

  // WebSocketコンテキストを使用
  const { subscribeToExtractions } = useWebSocket();

  // WebSocketを通じて抽出通知を受信
  useEffect(() => {
    if (!threadId) return;

    // 抽出通知を購読
    const unsubscribe = subscribeToExtractions(threadId, (data) => {
      const { extractions } = data;

      if (
        extractions &&
        (extractions.problems.length > 0 || extractions.solutions.length > 0)
      ) {
        // 抽出通知メッセージを作成
        let extractionMessage =
          "あなたのメッセージから以下の内容が抽出されました：\n";

        if (extractions.problems.length > 0) {
          extractionMessage += "\n【課題】\n";
          extractions.problems.forEach((problem) => {
            extractionMessage += `・${problem.statement}\n`;
          });
        }

        if (extractions.solutions.length > 0) {
          extractionMessage += "\n【解決策】\n";
          extractions.solutions.forEach((solution) => {
            extractionMessage += `・${solution.statement}\n`;
          });
        }

        // 通知をチャットに追加（特別なスタイルで表示）
        chatRef.current?.addMessage(extractionMessage, "notification");
      }
    });

    return unsubscribe;
  }, [threadId, subscribeToExtractions]);

  const handleSendMessage = async (message: string) => {
    console.log("Message sent:", message);

    chatRef.current?.addMessage(message, "user");

    const result = await apiClient.sendMessage(
      userId,
      message,
      theme._id,
      threadId || undefined
    );

    if (result.isErr()) {
      console.error("Failed to send message:", result.error);
      chatRef.current?.addMessage(
        `メッセージ送信エラー: ${result.error.message}`,
        "system"
      );
      return;
    }

    const responseData = result.value;

    // AIレスポンスをチャットに追加
    chatRef.current?.addMessage(responseData.response, "system");

    // threadIdとuserIdの更新
    if (responseData.threadId) {
      setThreadId(responseData.threadId);
    }

    if (responseData.userId && responseData.userId !== userId) {
      setUserId(responseData.userId);
      localStorage.setItem("userId", responseData.userId);
    }
  };

  const breadcrumbItems = [
    { label: "TOP", href: "/" },
    { label: "テーマ一覧", href: "/themes" },
    { label: theme.title, href: `/themes/${theme._id}` },
  ];

  useEffect(() => {
    if (!localStorage.getItem("userId")) {
      localStorage.setItem("userId", userId);
    }
  }, [userId]);

  return (
    <div className="container mx-auto px-4 py-8">
      <BreadcrumbView items={breadcrumbItems} />

      <h1 className="text-2xl md:text-3xl font-bold mb-4">{theme.title}</h1>

      <p className="text-sm text-neutral-600 mb-8">{theme.description}</p>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">
          キークエスチョン ({keyQuestions.length})
        </h2>
        <div className="space-y-4">
          {keyQuestions.map((question) => (
            <KeyQuestionCard
              key={question.id}
              question={question.question}
              voteCount={question.voteCount}
              issueCount={question.issueCount}
              solutionCount={question.solutionCount}
              themeId={theme._id}
              qid={question.id.toString()}
            />
          ))}
        </div>
      </div>

      <div className="mb-12">
        <h2 className="text-xl font-semibold mb-4">寄せられた意見</h2>

        <div className="flex border-b border-neutral-200 mb-4">
          <button
            className={`py-2 px-4 text-sm font-medium ${
              activeTab === "issues"
                ? "border-b-2 border-purple-500 text-purple-700"
                : "text-neutral-500"
            }`}
            onClick={() => setActiveTab("issues")}
            type="button"
          >
            課題点 ({issues.length})
          </button>
          <button
            className={`py-2 px-4 text-sm font-medium ${
              activeTab === "solutions"
                ? "border-b-2 border-purple-500 text-purple-700"
                : "text-neutral-500"
            }`}
            onClick={() => setActiveTab("solutions")}
            type="button"
          >
            解決策 ({solutions.length})
          </button>
        </div>

        <div className="space-y-3">
          {activeTab === "issues"
            ? issues.map((issue) => (
                <CommentCard key={issue.id} text={issue.text} type="issue" />
              ))
            : solutions.map((solution) => (
                <CommentCard
                  key={solution.id}
                  text={solution.text}
                  type="solution"
                />
              ))}
        </div>
      </div>

      <FloatingChat ref={chatRef} onSendMessage={handleSendMessage} />
    </div>
  );
};

export default ThemeDetailTemplate;
```

4. **FloatingChat.tsx の修正**:

```typescript
// MessageTypeに'notification'を追加
export type MessageType = "user" | "system" | "notification";

// FloatingChatRefインターフェースは変更なし
```

5. **ExtendedChatHistory.tsx の修正**:

```typescript
// 通知メッセージ用のスタイルを追加
const MessageBubble = ({ message }) => {
  if (message.type === "notification") {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 my-2 text-sm text-yellow-800 whitespace-pre-wrap">
        {message.content}
      </div>
    );
  }

  // 既存のユーザー/システムメッセージ表示コード
  // ...
};
```

6. **App.tsx の修正**:

```typescript
import { WebSocketProvider } from "./contexts/WebSocketContext";

function App() {
  return (
    <WebSocketProvider>
      {/* 既存のアプリケーションコンポーネント */}
    </WebSocketProvider>
  );
}

export default App;
```

## 実装手順

1. **バックエンド変更**:

   - MongoDB をレプリカセットとして設定（Change Streams を使用するために必要）
   - WebSocket サーバーを実装
   - Change Streams を設定し、ChatThread コレクションの変更を監視
   - 抽出が完了したら、WebSocket を通じてクライアントに通知

2. **フロントエンド変更**:

   - WebSocket クライアントを実装
   - WebSocket コンテキストを作成
   - ThemeDetailTemplate.tsx を修正して、WebSocket を通じて抽出通知を受信
   - MessageType に'notification'タイプを追加
   - ExtendedChatHistory.tsx を修正して、通知メッセージ用のスタイルを追加

3. **テスト**:
   - WebSocket 接続が正常に確立されることを確認
   - ユーザーがメッセージを送信し、課題/解決策が抽出されるシナリオをテスト
   - 抽出通知が適切に表示されることを確認
   - 接続が切断された場合の再接続機能をテスト
   - エラーケースや境界条件のテスト

## 利点

1. **リアルタイム性**: 抽出が完了次第、即座にユーザーに通知
2. **効率性**: ポーリングが不要になり、サーバーリソースを節約
3. **スケーラビリティ**: WebSocket を使用することで、多数のクライアントに効率的に通知を配信
4. **MongoDB 活用**: MongoDB の Change Streams 機能を活用して、データベースの変更をリアルタイムで検出

## 考慮事項

1. **MongoDB の設定**: Change Streams を使用するには、MongoDB がレプリカセットまたはシャードクラスタとして構成されている必要がある
2. **WebSocket の信頼性**: ネットワーク切断時の再接続ロジックを実装する必要がある
3. **スケーリング**: 多数のクライアントが接続する場合、WebSocket サーバーのスケーリングを考慮する必要がある
4. **セキュリティ**: WebSocket 接続の認証と認可を適切に実装する必要がある

この設計により、MongoDB の Change Streams 機能を活用して、ポーリングを使用せずにリアルタイムで抽出通知を実装することができます。WebSocket を使用することで、効率的かつ即時的な通知が可能になります。
