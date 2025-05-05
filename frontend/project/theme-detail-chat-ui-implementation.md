# ThemeDetailページのチャットUI実装手順

## 概要

ThemeDetailページにおいて、PC版では右カラムに常時表示し、モバイル版では現在のフローティングチャットUIを維持するレスポンシブなチャットUIを実装する手順を説明します。

## 目標

1. ThemeDetailページに限定して、レスポンシブなチャットUIを実装する
2. PC版では左右分割レイアウトで、右側にチャットUIを固定表示
3. モバイル版では現在のフローティングチャットUIを維持
4. 単一のChatSheetコンポーネントを使用し、表示方法のみを切り替える

## 実装手順

### 1. ResponsiveChatWrapper コンポーネントの作成

まず、PC版とモバイル版で表示を切り替えるラッパーコンポーネントを作成します。

```tsx
// src/components/chat/ResponsiveChatWrapper.tsx
import { forwardRef, useImperativeHandle, useRef } from "react";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import type { FloatingChatRef } from "./FloatingChat";
import { FloatingChat } from "./FloatingChat";

interface ResponsiveChatWrapperProps {
  onSendMessage?: (message: string) => void;
  onClose?: () => void;
  onOpen?: () => void;
  className?: string;
}

export const ResponsiveChatWrapper = forwardRef<
  FloatingChatRef,
  ResponsiveChatWrapperProps
>(({ onSendMessage, onClose, onOpen, className = "" }, ref) => {
  const floatingChatRef = useRef<FloatingChatRef>(null);
  const isDesktop = useMediaQuery("(min-width: 768px)");

  // FloatingChatRefのメソッドをこのコンポーネントから利用できるようにする
  useImperativeHandle(ref, () => ({
    addMessage: (content, type) => {
      floatingChatRef.current?.addMessage(content, type);
    },
    startStreamingMessage: (content, type) => {
      return floatingChatRef.current?.startStreamingMessage(content, type) || "";
    },
    updateStreamingMessage: (id, content) => {
      floatingChatRef.current?.updateStreamingMessage(id, content);
    },
    endStreamingMessage: (id) => {
      floatingChatRef.current?.endStreamingMessage(id);
    },
    clearMessages: () => {
      floatingChatRef.current?.clearMessages();
    },
  }));

  if (isDesktop) {
    // PC表示: 右カラムに固定表示
    return (
      <div className={`w-80 border-l border-neutral-200 bg-white h-full flex flex-col overflow-hidden ${className}`}>
        <FloatingChat
          ref={floatingChatRef}
          onSendMessage={onSendMessage}
          onClose={onClose}
          onOpen={onOpen}
        />
      </div>
    );
  }

  // モバイル表示: 通常のフローティングチャット
  return (
    <FloatingChat
      ref={floatingChatRef}
      onSendMessage={onSendMessage}
      onClose={onClose}
      onOpen={onOpen}
    />
  );
});

ResponsiveChatWrapper.displayName = "ResponsiveChatWrapper";
```

### 2. useMediaQuery フックの作成

メディアクエリを使用して画面サイズを検出するためのカスタムフックを作成します。

```tsx
// src/hooks/useMediaQuery.ts
import { useEffect, useState } from "react";

export const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    setMatches(mediaQuery.matches);

    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, [query]);

  return matches;
};
```

### 3. ThemeDetailページの修正

ThemeDetailページを修正して、レスポンシブなレイアウトを実装します。

```tsx
// src/pages/ThemeDetail.tsx
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  type FloatingChatRef,
} from "../components/chat/FloatingChat";
import { ResponsiveChatWrapper } from "../components/chat/ResponsiveChatWrapper";
import ThemeDetailTemplate from "../components/theme/ThemeDetailTemplate";
import { useMock } from "../contexts/MockContext";
import { useThemeDetail } from "../hooks/useThemeDetail";
import type { NewExtractionEvent } from "../services/socket/socketClient";
import type { Message } from "../types";
import { SystemMessage, SystemNotification } from "../types";
import { ThemeDetailChatManager } from "./ThemeDetailChatManager";

const ThemeDetail = () => {
  // 既存のコード...

  if (isMockMode || themeDetail) {
    const templateProps = {
      // 既存のコード...
    };

    return (
      <div className="flex flex-col md:flex-row min-h-screen">
        {/* メインコンテンツ - モバイルでは全幅、PCでは左カラム */}
        <div className="flex-1 overflow-auto">
          <ThemeDetailTemplate {...templateProps} />
        </div>
        
        {/* チャットUI - モバイルではフローティング、PCでは右カラム */}
        <ResponsiveChatWrapper 
          ref={floatingChatRef} 
          onSendMessage={handleSendMessage} 
        />
      </div>
    );
  }

  // 既存のコード...
};

export default ThemeDetail;
```

### 4. FloatingChat コンポーネントの調整

FloatingChatコンポーネントがPC表示時に適切に動作するように調整します。

```tsx
// src/components/chat/FloatingChat.tsx
// 既存のコードを維持しつつ、以下の変更を加える

const FloatingChatInner = forwardRef<FloatingChatRef, FloatingChatProps>(
  ({ onSendMessage, onClose, onOpen }, ref) => {
    // isOpenの初期値をメディアクエリに基づいて設定
    const isDesktop = window.matchMedia("(min-width: 768px)").matches;
    const [isOpen, setIsOpen] = useState(isDesktop);
    // 残りの既存コード...

    // PC表示時は常に表示状態を維持
    useEffect(() => {
      const mediaQuery = window.matchMedia("(min-width: 768px)");
      
      const handleChange = (e: MediaQueryListEvent) => {
        if (e.matches) {
          setIsOpen(true);
        }
      };
      
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }, []);

    // 残りの既存コード...

    return (
      <>
        {!isOpen && (
          <FloatingChatButton onClick={handleOpen} hasUnread={hasUnread} />
        )}
        <ChatSheet
          isOpen={isOpen}
          onClose={handleClose}
          onSendMessage={handleSendMessage}
        />
      </>
    );
  }
);
```

### 5. ChatSheet コンポーネントの調整

ChatSheetコンポーネントがPC表示時に適切に表示されるように調整します。

```tsx
// src/components/chat/ChatSheet.tsx
// 既存のコードを維持しつつ、以下の変更を加える

export const ChatSheet: React.FC<ChatSheetProps> = ({
  isOpen,
  onClose,
  onSendMessage,
}) => {
  // 既存のコード...

  // メディアクエリに基づいてドラッグ設定を調整
  const isDesktop = window.matchMedia("(min-width: 768px)").matches;
  const { height, handleDragStart } = useDraggable({
    minHeight: 300,
    maxHeight: isDesktop ? window.innerHeight : window.innerHeight * 0.8,
    initialHeight: isDesktop ? window.innerHeight : 500,
  });

  // 残りの既存コード...

  return (
    <BaseChatSheet open={isOpen} onOpenChange={onClose}>
      <ChatSheetContent
        className="p-0 h-auto rounded-t-xl overflow-hidden md:rounded-none md:h-full md:border-l md:border-t-0"
        style={{ height: `${height}px` }}
      >
        {/* PC表示時はヘッダーを非表示にするオプションも検討可能 */}
        <ChatHeader onDragStart={handleDragStart} />
        <div className="flex-grow overflow-auto h-[calc(100%-120px)]">
          <ExtendedChatHistory messages={messages} />
        </div>
        <div className="p-4 border-t">
          {/* 既存のコード... */}
        </div>
      </ChatSheetContent>
    </BaseChatSheet>
  );
};
```

### 6. chat-sheet.tsx の調整

PC表示時に右側からのスライドインに対応するよう調整します。

```tsx
// src/components/ui/chat/chat-sheet.tsx
// 既存のコードを維持しつつ、以下の変更を加える

const ChatSheetContent = React.forwardRef<
  React.ElementRef<typeof SheetContent>,
  React.ComponentPropsWithoutRef<typeof SheetContent>
>(({ className, children, ...props }, ref) => {
  const isDesktop = window.matchMedia("(min-width: 768px)").matches;
  
  return (
    <SheetContent 
      ref={ref} 
      className={className} 
      side={isDesktop ? "right" : "bottom"} 
      {...props}
    >
      {children}
    </SheetContent>
  );
});
```

## テスト手順

1. 実装後、以下の点を確認してください：

   - PC表示（768px以上）:
     - ThemeDetailページで右カラムにチャットUIが固定表示されているか
     - チャットUIの高さがビューポート全体に合わせて調整されているか
     - メッセージの送受信が正常に機能するか

   - モバイル表示（768px未満）:
     - 従来通りのフローティングチャットUIが表示されるか
     - ボタンクリックでチャットシートが表示されるか
     - ドラッグで高さ調整が可能か
     - メッセージの送受信が正常に機能するか

2. レスポンシブ動作の確認:
   - ブラウザのサイズを変更して、切り替わりが正常に機能するか確認
   - デベロッパーツールのモバイルエミュレーションで各種デバイスサイズでの表示を確認

## 注意点

1. この実装はThemeDetailページのみに適用されます。他のページには影響しません。
2. 既存のFloatingChatコンポーネントの機能を維持しつつ、表示方法のみを変更します。
3. メディアクエリのブレークポイント（768px）はTailwind CSSのmdブレークポイントに合わせています。
4. PC表示時のチャットUIの幅は80（w-80）に設定していますが、必要に応じて調整可能です。
