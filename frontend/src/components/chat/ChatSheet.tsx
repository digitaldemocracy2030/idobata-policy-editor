import { Loader2, Send } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { useDraggable } from "../../hooks/useDraggable";
import { Button } from "../ui/button";
import {
  ChatSheet as BaseChatSheet,
  ChatSheetContent,
} from "../ui/chat/chat-sheet";
import { ChatHeader } from "./ChatHeader";
import { useChat } from "./ChatProvider";
import ExtendedChatHistory from "./ExtendedChatHistory";

interface ChatSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSendMessage?: (message: string) => void;
}

export const ChatSheet: React.FC<ChatSheetProps> = ({
  isOpen,
  onClose,
  onSendMessage,
}) => {
  const { messages, addMessage } = useChat();
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const { height, handleDragStart } = useDraggable({
    minHeight: 300,
    maxHeight: window.innerHeight * 0.8,
    initialHeight: 500,
  });

  const handleSendMessage = () => {
    if (inputValue.trim() && !isSending) {
      setIsSending(true);

      const message = inputValue;
      setInputValue("");

      if (onSendMessage) {
        try {
          onSendMessage(message);
          setTimeout(() => {
            setIsSending(false);
          }, 1000);
        } catch (error) {
          console.error("Error sending message:", error);
          setIsSending(false);
        }
      } else {
        addMessage(message, "user");
        setTimeout(() => {
          setIsSending(false);
        }, 1000);
      }
    }
  };

  const handleKeyDown = (
    e: React.KeyboardEvent & {
      isComposing?: boolean;
      nativeEvent: { isComposing?: boolean };
    }
  ) => {
    if (
      e.key === "Enter" &&
      !e.shiftKey &&
      !isSending &&
      !e.isComposing &&
      !e.nativeEvent.isComposing
    ) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <BaseChatSheet open={isOpen} onOpenChange={onClose}>
      <ChatSheetContent
        className="p-0 h-auto rounded-t-xl overflow-hidden"
        style={{ height: `${height}px` }}
      >
        <ChatHeader
          onDragStart={handleDragStart}
          onSendMessage={onSendMessage}
        />
        <div className="flex-grow overflow-auto h-[calc(100%-120px)]">
          <ExtendedChatHistory messages={messages} />
        </div>
        <div className="p-4 border-t">
          <div className="bg-accentGradient rounded-full p-1">
            <div className="flex items-center bg-white rounded-full p-1">
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="気になること・思ったことを伝える"
                className="flex-grow px-5 py-3 bg-transparent border-none focus:outline-none text-base resize-none min-h-[40px] max-h-[120px] overflow-y-auto"
                disabled={isSending}
                rows={1}
              />
              <Button
                onClick={handleSendMessage}
                variant="ghost"
                size="icon"
                className="rounded-full h-10 w-10 mr-1 flex items-center justify-center"
                disabled={!inputValue.trim() || isSending}
              >
                {isSending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </ChatSheetContent>
    </BaseChatSheet>
  );
};
