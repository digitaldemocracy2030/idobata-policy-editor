import { useEffect, useRef } from "react";
import { cn } from "../../lib/utils";
import type { ExtendedMessage } from "../../types";
import { StreamingText } from "./StreamingText";

interface ExtendedChatHistoryProps {
  messages: ExtendedMessage[];
}

function ExtendedChatHistory({ messages }: ExtendedChatHistoryProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const initialMessages =
    messages.length > 0
      ? messages
      : [
          {
            role: "assistant",
            content:
              "「どうすれば若者が安心してキャリアを築ける社会を実現できるか？」がチャット対象になったよ。",
            type: "system-message",
            timestamp: new Date(),
          },
        ];

  return (
    <div className="flex-grow p-3 overflow-y-auto space-y-4 custom-scrollbar">
      {initialMessages.map((msg, index) => (
        <div
          key={`${msg.timestamp}-${index}`}
          className={cn("animate-fade-in mb-3", {
            "flex justify-end": msg.type === "user",
            "flex justify-start": msg.type === "system",
            "flex justify-center": msg.type === "system-message" || msg.type === "notification",
          })}
        >
          <div
            className={cn("flex flex-col max-w-[90%]", {
              "items-end": msg.type === "user",
              "items-start": msg.type === "system",
              "items-center": msg.type === "system-message" || msg.type === "notification",
            })}
          >
            <div
              className={cn("inline-block py-2 px-3 break-words", {
                "bg-neutral-700 text-white rounded-2xl rounded-tr-sm":
                  msg.type === "user",
                "bg-white border border-neutral-200 text-neutral-800 rounded-2xl rounded-tl-sm":
                  msg.type === "system",
                "bg-neutral-100 border border-neutral-200 text-neutral-800 rounded-2xl":
                  msg.type === "system-message",
                "bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-2xl":
                  msg.type === "notification",
              })}
            >
              <div className="text-sm whitespace-pre-wrap">
                {msg.isStreaming ? (
                  <StreamingText content={msg.content} />
                ) : (
                  msg.content
                )}
              </div>
            </div>
            {/* タイムスタンプは表示しない */}
          </div>
        </div>
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
}

export default ExtendedChatHistory;
