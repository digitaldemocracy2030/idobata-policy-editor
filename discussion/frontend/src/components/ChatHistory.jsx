import React, { useRef, useEffect } from 'react';

function ChatHistory({ messages }) {
  const messagesEndRef = useRef(null);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  return (
    <div className="flex-grow p-3 md:p-4 overflow-y-auto space-y-4 md:space-y-6 custom-scrollbar">
      {messages.length === 0 && (
        <div className="flex items-center justify-center h-full">
          <p className="text-neutral-400 text-sm">会話を始めましょう</p>
        </div>
      )}
      
      {messages.map((msg, index) => (
        <div key={index} className={`${msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'} animate-fade-in`}>
          <div className="flex flex-col max-w-[85%] sm:max-w-[75%] md:max-w-[65%]">
            <div className={`inline-block py-2 md:py-3 px-3 md:px-4 break-words ${
              msg.role === 'user'
                ? 'bg-neutral-700 text-white shadow-sm rounded-2xl rounded-tr-sm'
                : 'bg-white border border-neutral-200 text-neutral-800 shadow-sm rounded-2xl rounded-tl-sm'
            }`}>
              <div className="text-xs md:text-sm whitespace-pre-wrap">{msg.content}</div>
            </div>
            <div className={`text-xs text-neutral-500 mt-1 ${msg.role === 'user' ? 'text-right mr-1' : 'ml-1'}`}>
              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
}

export default ChatHistory;