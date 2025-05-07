import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { type MessageType } from "../../types";
import { ChatProvider, useChat } from "./ChatProvider";
import { ChatRightBar } from "./ChatRightBar";
import { ChatSheet } from "./ChatSheet";
import { FloatingChatButton } from "./FloatingChatButton";
interface FloatingChatProps {
  onSendMessage?: (message: string) => void;
  onClose?: () => void;
  onOpen?: () => void;
}

export interface FloatingChatRef {
  addMessage: (content: string, type: MessageType) => void;
  startStreamingMessage: (content: string, type: MessageType) => string;
  updateStreamingMessage: (id: string, content: string) => void;
  endStreamingMessage: (id: string) => void;
  clearMessages: () => void;
}

const FloatingChatInner = forwardRef<FloatingChatRef, FloatingChatProps>(
  ({ onSendMessage, onClose, onOpen }, ref) => {
    const [isOpen, setIsOpen] = useState(false);
    const [hasUnread, setHasUnread] = useState(false);
    const {
      addMessage,
      startStreamingMessage,
      updateStreamingMessage,
      endStreamingMessage,
      clearMessages,
    } = useChat();

    const handleOpen = () => {
      setIsOpen(true);
      setHasUnread(false);
      onOpen?.();
    };

    const handleClose = () => {
      setIsOpen(false);
      onClose?.();
    };

    const handleSendMessage = (message: string) => {
      onSendMessage?.(message);
    };
    const [isXl, setIsXl] = useState(false);
    useEffect(() => {
      const mediaQueryList = window.matchMedia("(min-width: 1280px)");

      const listener = (event) => {
        if (event.matches) {
          setIsXl(true);
        } else {
          setIsXl(false);
        }
      };

      // リスナーを追加
      mediaQueryList.addEventListener("change", listener);

      // 初期状態を設定
      if (mediaQueryList.matches) {
        setIsXl(true);
      } else {
        setIsXl(false);
      }

      // クリーンアップ関数
      return () => {
        mediaQueryList.removeEventListener("change", listener);
      };
    }, []); // 空の依存配列で一度だけ実行
    useImperativeHandle(ref, () => ({
      addMessage: (content: string, type: MessageType) => {
        addMessage(content, type);
        if (!isOpen) setHasUnread(true);
      },
      startStreamingMessage: (content: string, type: MessageType) => {
        const id = startStreamingMessage(content, type);
        if (!isOpen) setHasUnread(true);
        return id;
      },
      updateStreamingMessage,
      endStreamingMessage,
      clearMessages,
    }));
    if (isXl === true) {
      return (
        <ChatRightBar
          isOpen={isOpen}
          onClose={handleClose}
          onSendMessage={handleSendMessage}
        />
      );
    }
    return (
      <div>
        {!isOpen && (
          <FloatingChatButton onClick={handleOpen} hasUnread={hasUnread} />
        )}
        <ChatSheet
          isOpen={isOpen}
          onClose={handleClose}
          onSendMessage={handleSendMessage}
        />
      </div>
    );
  }
);

export const FloatingChat = forwardRef<FloatingChatRef, FloatingChatProps>(
  (props, ref) => {
    return (
      <ChatProvider>
        <FloatingChatInner {...props} ref={ref} />
      </ChatProvider>
    );
  }
);

FloatingChat.displayName = "FloatingChat";
