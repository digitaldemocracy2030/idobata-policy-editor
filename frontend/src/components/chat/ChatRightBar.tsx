import { Loader2, Send } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { Button } from "../ui/button";
import { useChat } from "./ChatProvider";
import ExtendedChatHistory from "./ExtendedChatHistory";

interface ChatSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSendMessage?: (message: string) => void;
}

export const ChatRightBar: React.FC<ChatSheetProps> = ({ onSendMessage }) => {
  const { messages, addMessage } = useChat();
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);

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
    <div className="fixed right-0 top-16 bottom-0 w-[400px] shadow-md shadow-gray-400 bg-white overflow-y-auto">
      <div className="flex-grow overflow-auto h-[calc(100%-120px)]">
        <ExtendedChatHistory messages={messages} />
      </div>
      <div className="p-4 border-t">
        <div className="bg-accentGradient rounded-full p-1">
          <div className="flex items-center bg-white rounded-full p-1">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="気になること・思ったことを伝える"
              className="flex-grow px-5 py-3 bg-transparent border-none focus:outline-none text-base"
              disabled={isSending}
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
    </div>
  );
};
