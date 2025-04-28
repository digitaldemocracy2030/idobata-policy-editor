# チャット機能と論点抽出機能の実装手順

このドキュメントでは、旧UIである `MainPage.tsx` で実現できているチャットによる意見表明と論点抽出を、新UIである `ThemeDetail.tsx` に実装する手順を説明します。

## 現状の理解

1. 旧UI（`MainPage.tsx`）では、`VisualizationArea` コンポーネントを通じて表示される画面と、`AppLayout` コンポーネントが提供するチャット機能が連携しています。
2. 新UI（`ThemeDetail.tsx`）には既に基本的なチャット機能（`FloatingChat`）が実装されていますが、意見表明と論点抽出の連携機能が欠けています。
3. **重要**: この実装では、既存の `FloatingChat` コンポーネントを使用して、チャット機能と論点抽出機能を連携させます。新しいチャットコンポーネントは作成せず、既存のものを活用します。

## 実装手順

### 1. 必要なコンポーネントのインポート

`ThemeDetail.tsx` に以下のコンポーネントをインポートします：

```tsx
import { useEffect, useState } from "react";
import { apiClient } from "../services/api/apiClient";
import ThreadExtractions from "../components/ThreadExtractions";
import type { PreviousExtractions } from "../types";
```

### 2. 状態管理の追加

`ThemeDetail` コンポーネント内に以下の状態を追加します：

```tsx
const [currentThreadId, setCurrentThreadId] = useState<string | null>(
  localStorage.getItem("currentThreadId") || null
);
const [showExtractions, setShowExtractions] = useState<boolean>(false);
const [notification, setNotification] = useState<NotificationType | null>(null);
const [previousExtractions, setPreviousExtractions] = useState<PreviousExtractions>({
  problems: [],
  solutions: [],
});
```

### 3. メッセージ送信ハンドラの拡張

既存の `handleSendMessage` 関数を拡張して、スレッドIDの管理とAPIとの連携を追加します：

```tsx
const handleSendMessage = async (message: string) => {
  console.log("Message sent:", message);

  try {
    // テーマIDがない場合はthemeIdを使用
    const currentThemeId = themeId;
    
    if (!currentThemeId) {
      throw new Error("テーマIDが見つかりません。");
    }

    const result = await apiClient.sendMessage(
      "user123", // ユーザーID管理が必要な場合は適切に設定
      message,
      currentThemeId,
      currentThreadId || undefined
    );

    if (result.isErr()) {
      const apiError = result.error;
      throw new Error(`API error: ${apiError.message}`);
    }

    const responseData = result.value;

    // システムからの応答をチャットに追加
    setTimeout(() => {
      chatRef.current?.addMessage(responseData.response, "system");
    }, 500);

    // スレッドIDを保存
    if (responseData.threadId) {
      setCurrentThreadId(responseData.threadId);
      localStorage.setItem("currentThreadId", responseData.threadId);
    }
  } catch (error) {
    console.error("Failed to send message:", error);
    // エラーメッセージをチャットに表示
    setTimeout(() => {
      chatRef.current?.addMessage(`エラー: ${error.message}`, "system");
    }, 500);
  }
};
```

### 4. 抽出結果の確認機能の追加

`AppLayout` の `checkForNewExtractions` 関数を参考に、新しい抽出結果を確認する機能を追加します：

```tsx
const checkForNewExtractions = useCallback(async (): Promise<void> => {
  if (!currentThreadId || !themeId) return;

  try {
    const result = await apiClient.getThreadExtractions(
      currentThreadId,
      themeId
    );

    if (result.isErr()) {
      const apiError = result.error;
      throw new Error(`API error: ${apiError.message}`);
    }

    const data = result.value;
    const currentProblems = data.problems || [];
    const currentSolutions = data.solutions || [];

    // 新しい課題のチェック
    for (const problem of currentProblems) {
      const existingProblem = previousExtractions.problems.find(
        (p) => p._id === problem._id
      );

      if (!existingProblem) {
        // 新しい課題が追加された
        setNotification({
          message: `ありがとうございます！新しい課題「${problem.statement.substring(
            0,
            30
          )}${
            problem.statement.length > 30 ? "..." : ""
          }」についてのあなたの声が追加されました。`,
          type: "problem",
          id: problem._id,
        });
        break;
      }
      if (existingProblem.version !== problem.version) {
        // 課題が更新された
        setNotification({
          message: `ありがとうございます！課題「${problem.statement.substring(
            0,
            30
          )}${
            problem.statement.length > 30 ? "..." : ""
          }」についてのあなたの声が更新されました。`,
          type: "problem",
          id: problem._id,
        });
        break;
      }
    }

    // 新しい解決策のチェック
    if (!notification) {
      for (const solution of currentSolutions) {
        const existingSolution = previousExtractions.solutions.find(
          (s) => s._id === solution._id
        );

        if (!existingSolution) {
          // 新しい解決策が追加された
          setNotification({
            message: `ありがとうございます！新しい解決策「${solution.statement.substring(
              0,
              30
            )}${
              solution.statement.length > 30 ? "..." : ""
            }」についてのあなたの声が追加されました。`,
            type: "solution",
            id: solution._id,
          });
          break;
        }
        if (existingSolution.version !== solution.version) {
          // 解決策が更新された
          setNotification({
            message: `ありがとうございます！解決策「${solution.statement.substring(
              0,
              30
            )}${
              solution.statement.length > 30 ? "..." : ""
            }」についてのあなたの声が更新されました。`,
            type: "solution",
            id: solution._id,
          });
          break;
        }
      }
    }

    // 次回の比較のために前回の抽出結果を更新
    setPreviousExtractions({
      problems: currentProblems,
      solutions: currentSolutions,
    });
  } catch (error) {
    console.error("Failed to check for new extractions:", error);
  }
}, [currentThreadId, themeId, previousExtractions, notification]);
```

### 5. useEffect フックの追加

定期的に抽出結果をチェックするための useEffect フックを追加します：

```tsx
// 通知を一定時間後に削除
useEffect(() => {
  if (notification) {
    const timer = setTimeout(() => {
      setNotification(null);
    }, 5000);

    return () => clearTimeout(timer);
  }
}, [notification]);

// 定期的に新しい抽出結果をチェック
useEffect(() => {
  if (!currentThreadId) return;

  // 初回チェック
  checkForNewExtractions();

  // 定期的なチェックのためのインターバル設定
  const intervalId = setInterval(checkForNewExtractions, 5000); // 5秒ごとにチェック

  return () => clearInterval(intervalId);
}, [currentThreadId, checkForNewExtractions]);
```

### 6. 通知コンポーネントの追加

通知を表示するための Notification コンポーネントをインポートし、使用します：

```tsx
import Notification from "../components/Notification";

// JSX内で通知を表示
{notification && (
  <Notification
    message={notification.message}
    onClose={() => setNotification(null)}
    duration={4000}
  />
)}
```

### 7. 抽出結果表示の切り替えボタンの追加

抽出結果の表示/非表示を切り替えるボタンを追加します：

```tsx
<button
  onClick={() => setShowExtractions(!showExtractions)}
  disabled={!currentThreadId}
  className={`px-2 py-1 rounded-md text-xs border border-neutral-300 transition-colors duration-200 ${
    !currentThreadId
      ? "bg-neutral-100 text-neutral-300 cursor-not-allowed"
      : showExtractions
        ? "bg-neutral-200 text-neutral-700 hover:bg-neutral-300"
        : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
  }`}
  title={
    !currentThreadId
      ? "最初にメッセージを送信してください"
      : showExtractions
        ? "抽出結果を非表示"
        : "抽出結果を表示"
  }
  type="button"
>
  抽出された課題/解決策を表示
</button>
```

### 8. ThreadExtractions コンポーネントの追加

抽出結果を表示するための ThreadExtractions コンポーネントを追加します：

```tsx
{showExtractions && (
  <div className="bg-neutral-100 shadow-inner border-t border-neutral-200">
    <div className="p-2 md:p-4 max-h-32 md:max-h-48 overflow-y-auto custom-scrollbar">
      <ThreadExtractions
        threadId={currentThreadId}
        themeId={themeId}
      />
    </div>
  </div>
)}
```

### 9. レイアウトの調整

既存の FloatingChat コンポーネントを含むレイアウトを調整して、抽出結果の表示領域を確保します。既存のコンポーネントを再利用することで、UIの一貫性を保ちます：

```tsx
<div className="relative">
  {/* 通知 */}
  {notification && (
    <div className="absolute top-2 right-2 z-50">
      <Notification
        message={notification.message}
        onClose={() => setNotification(null)}
        duration={4000}
      />
    </div>
  )}

  {/* 抽出結果表示切り替えボタン */}
  <div className="absolute bottom-20 right-4 z-40">
    <button
      onClick={() => setShowExtractions(!showExtractions)}
      disabled={!currentThreadId}
      className={`px-2 py-1 rounded-md text-xs border border-neutral-300 transition-colors duration-200 ${
        !currentThreadId
          ? "bg-neutral-100 text-neutral-300 cursor-not-allowed"
          : showExtractions
            ? "bg-neutral-200 text-neutral-700 hover:bg-neutral-300"
            : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
      }`}
      type="button"
    >
      抽出された課題/解決策を表示
    </button>
  </div>

  {/* 抽出結果表示エリア */}
  {showExtractions && (
    <div className="fixed bottom-20 right-4 w-80 bg-white border border-neutral-200 rounded-lg shadow-lg z-30">
      <div className="p-3 max-h-60 overflow-y-auto custom-scrollbar">
        <ThreadExtractions
          threadId={currentThreadId}
          themeId={themeId}
        />
      </div>
    </div>
  )}

  {/* フローティングチャット */}
  <FloatingChat ref={chatRef} onSendMessage={handleSendMessage} />
</div>
```

### 10. 型定義の追加

必要な型定義が不足している場合は、types.ts に追加します：

```tsx
// types.ts に追加
export interface NotificationType {
  message: string;
  type: "problem" | "solution";
  id: string;
}
```

## 注意点

1. この実装では、ユーザーIDの管理が簡略化されています。実際の実装では、適切なユーザー認証・管理が必要です。
2. APIクライアントの実装によっては、一部のメソッド名やパラメータが異なる可能性があります。
3. CSSクラス名やスタイリングは、既存のデザインシステムに合わせて調整してください。
4. エラーハンドリングは、より詳細に実装することをお勧めします。
5. パフォーマンス最適化のため、useCallback や useMemo の使用を検討してください。
