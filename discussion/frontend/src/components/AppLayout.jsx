import React, { useState, useEffect, useCallback } from 'react';
import { Link, Outlet } from 'react-router-dom';
import ChatInput from './ChatInput';
import ChatHistory from './ChatHistory';
import ThreadExtractions from './ThreadExtractions';
import Notification from './Notification';

function AppLayout({ userId, setUserId }) {
  // Initialize currentThreadId from localStorage if available
  const [messages, setMessages] = useState([]);
  const [currentThreadId, setCurrentThreadId] = useState(
    localStorage.getItem('currentThreadId') || null
  );
  const [showExtractions, setShowExtractions] = useState(false);
  const [notification, setNotification] = useState(null);
  const [previousExtractions, setPreviousExtractions] = useState({ problems: [], solutions: [] });
  const [isLoading, setIsLoading] = useState(false);

  const handleSendMessage = async (newMessageContent) => {
    const currentUserId = userId;

    const newUserMessage = {
      role: 'user',
      content: newMessageContent,
      timestamp: new Date(),
    };

    setMessages(prevMessages => [...prevMessages, newUserMessage]);

    try {
      const backendUrl = 'http://localhost:3000/api/chat/messages';
      const response = await fetch(backendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: currentUserId,
          message: newUserMessage.content,
          threadId: currentThreadId
        }),
      });

      if (!response.ok) {
        let errorBody = 'Unknown error';
        try {
          errorBody = await response.text();
        } catch (e) { /* ignore */ }
        throw new Error(`HTTP error! status: ${response.status}, Body: ${errorBody}`);
      }

      const responseData = await response.json();

      const assistantMessage = {
        role: 'assistant',
        content: responseData.response,
        timestamp: new Date(),
      };

      setMessages(prevMessages => [...prevMessages, assistantMessage]);

      if (responseData.threadId) {
        setCurrentThreadId(responseData.threadId);
        // Store threadId in localStorage for persistence
        localStorage.setItem('currentThreadId', responseData.threadId);
      }
      if (responseData.userId && !userId) {
        setUserId(responseData.userId);
      }

    } catch (error) {
      console.error("Failed to send message:", error);
      const errorMessage = {
        role: 'assistant',
        content: `メッセージ送信エラー: ${error.message}`,
        timestamp: new Date(),
      };
      setMessages(prevMessages => [...prevMessages, errorMessage]);
    }
  };
  
  // Function to check for new extractions and show notifications
  const checkForNewExtractions = useCallback(async () => {
    if (!currentThreadId) return;
  
    try {
      const response = await fetch(`http://localhost:3000/api/chat/threads/${currentThreadId}/extractions`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      const currentProblems = data.problems || [];
      const currentSolutions = data.solutions || [];
      
      // Check for new problems
      for (const problem of currentProblems) {
        const existingProblem = previousExtractions.problems.find(p => p._id === problem._id);
        
        if (!existingProblem) {
          // New problem added
          setNotification({
            message: `ありがとうございます！新しい課題「${problem.statement.substring(0, 30)}${problem.statement.length > 30 ? '...' : ''}」についてのあなたの声が追加されました。`,
            type: 'problem',
            id: problem._id
          });
          break;
        } else if (existingProblem.version !== problem.version) {
          // Problem updated
          setNotification({
            message: `ありがとうございます！課題「${problem.statement.substring(0, 30)}${problem.statement.length > 30 ? '...' : ''}」についてのあなたの声が更新されました。`,
            type: 'problem',
            id: problem._id
          });
          break;
        }
      }
      
      // If no new/updated problems, check for new solutions
      if (!notification) {
        for (const solution of currentSolutions) {
          const existingSolution = previousExtractions.solutions.find(s => s._id === solution._id);
          
          if (!existingSolution) {
            // New solution added
            setNotification({
              message: `ありがとうございます！新しい解決策「${solution.statement.substring(0, 30)}${solution.statement.length > 30 ? '...' : ''}」についてのあなたの声が追加されました。`,
              type: 'solution',
              id: solution._id
            });
            break;
          } else if (existingSolution.version !== solution.version) {
            // Solution updated
            setNotification({
              message: `ありがとうございます！解決策「${solution.statement.substring(0, 30)}${solution.statement.length > 30 ? '...' : ''}」についてのあなたの声が更新されました。`,
              type: 'solution',
              id: solution._id
            });
            break;
          }
        }
      }
      
      // Update previous extractions for next comparison
      setPreviousExtractions({ problems: currentProblems, solutions: currentSolutions });
      
    } catch (error) {
      console.error("Failed to check for new extractions:", error);
    }
  }, [currentThreadId, previousExtractions, notification]);

  // Force notification to be removed after duration
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 5000); // Slightly longer than the component's internal timer to ensure it's removed
      
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Check for new extractions periodically
  useEffect(() => {
    if (!currentThreadId) return;
    
    // Initial check
    checkForNewExtractions();
    
    // Set up interval for periodic checks
    const intervalId = setInterval(checkForNewExtractions, 5000); // Check every 5 seconds
    
    return () => clearInterval(intervalId);
  }, [currentThreadId, checkForNewExtractions]);

  // Load thread messages when component mounts or currentThreadId changes
  useEffect(() => {
    const loadThreadMessages = async () => {
      if (!currentThreadId) return;
      
      setIsLoading(true);
      try {
        const response = await fetch(`http://localhost:3000/api/chat/threads/${currentThreadId}/messages`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        if (data.messages && data.messages.length > 0) {
          setMessages(data.messages);
        }
      } catch (error) {
        console.error("Failed to load thread messages:", error);
        // If there's an error loading the thread (e.g., it was deleted), clear the stored threadId
        if (error.message.includes('404')) {
          localStorage.removeItem('currentThreadId');
          setCurrentThreadId(null);
        }
      } finally {
        setIsLoading(false);
      }
    };
    
    loadThreadMessages();
  }, [currentThreadId]);

  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden bg-neutral-50 text-neutral-800">
      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute top-16 left-0 right-0 z-30 flex justify-center">
          <div className="bg-neutral-800 text-white px-4 py-2 rounded-md shadow-md text-sm">
            会話を読み込み中...
          </div>
        </div>
      )}
      
      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-20 border-b border-neutral-200 bg-white py-2 px-4 shadow-sm">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-lg font-semibold text-primary">
            いどばた新分析システム案
          </h1>
          <nav className="flex items-center space-x-4">
            <Link
              to="/data"
              className="px-3 py-1 rounded-md text-sm transition-colors duration-200 text-neutral-600 hover:text-primary hover:bg-neutral-100"
            >
              データ一覧
            </Link>
            <Link
              to="/"
              className="px-3 py-1 rounded-md text-sm transition-colors duration-200 text-neutral-600 hover:text-primary hover:bg-neutral-100"
            >
              シャープな問いとインサイト
            </Link>
          </nav>
        </div>
      </header>

      {/* Chat UI - Left pane on desktop, bottom half on mobile */}
      <div className="md:w-80 md:border-r border-t md:border-t-0 border-neutral-200 bg-white pt-12 flex flex-col md:h-full h-[50vh] order-2 md:order-1 z-10 overflow-hidden">
        {/* Chat History with Extraction Toggle */}
        <div className="flex-grow overflow-hidden relative h-full">
          {/* Notification */}
          {notification && (
            <Notification
              message={notification.message}
              onClose={() => setNotification(null)}
              duration={4000}
            />
          )}
          
          {/* Control Buttons */}
          <div className="absolute top-2 left-2 z-10 flex space-x-2">
            {/* Extraction Toggle Button */}
            <button
              onClick={() => setShowExtractions(!showExtractions)}
              disabled={!currentThreadId}
              className={`px-2 py-1 rounded-md text-xs border border-neutral-300 transition-colors duration-200 ${
                !currentThreadId
                  ? 'bg-neutral-100 text-neutral-300 cursor-not-allowed'
                  : showExtractions
                    ? 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300' // Active state
                    : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200' // Default state
              }`}
              title={!currentThreadId ? "最初にメッセージを送信してください" : (showExtractions ? "抽出結果を非表示" : "抽出結果を表示")}
            >
              抽出された課題/解決策を表示
            </button>
            
            {/* New Conversation Button */}
            {currentThreadId && (
              <button
                onClick={() => {
                  // Clear current thread and start a new conversation
                  localStorage.removeItem('currentThreadId');
                  setCurrentThreadId(null);
                  setMessages([]);
                  setPreviousExtractions({ problems: [], solutions: [] });
                }}
                className="px-2 py-1 rounded-md text-xs border border-neutral-300 transition-colors duration-200 bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                title="新しい会話"
              >
                会話をリセット
              </button>
            )}
          </div>
          
          <div className="h-full overflow-y-auto px-2 pt-10 pb-2 custom-scrollbar">
            <ChatHistory messages={messages} />
          </div>
        </div>

        {/* Extraction Area (conditionally rendered) */}
        {showExtractions && (
          <div className="bg-neutral-100 shadow-inner border-t border-neutral-200">
            <div className="p-2 md:p-4 max-h-32 md:max-h-48 overflow-y-auto custom-scrollbar">
              <ThreadExtractions threadId={currentThreadId} />
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="bg-white shadow-inner border-t border-neutral-200 p-3 md:p-4">
          <ChatInput onSendMessage={handleSendMessage} />
        </div>
      </div>

      {/* Main Content Area - Right side on desktop, top half on mobile */}
      <div className="flex-1 pt-12 overflow-auto h-[50vh] md:h-auto order-1 md:order-2 custom-scrollbar">
        <Outlet />
      </div>
    </div>
  );
}

export default AppLayout;