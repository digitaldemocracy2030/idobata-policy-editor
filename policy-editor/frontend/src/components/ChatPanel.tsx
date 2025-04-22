import React, { useState, useEffect, useRef, useMemo } from 'react';
import useContentStore from '../store/contentStore'; // Import the Zustand store
import { decodeBase64Content } from '../lib/github'; // Import the decoder
import type { GitHubFile } from '../lib/github'; // Import the type
import MarkdownViewer from './MarkdownViewer'; // Import the MarkdownViewer component

// Define the structure for OpenAI API messages
interface OpenAIMessage {
  role: 'user' | 'assistant' | 'system' | 'function';
  content: string | null;
  name?: string;
  function_call?: {
    name: string;
    arguments: string;
  };
}

// API base URL from environment variables
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

const ChatPanel: React.FC = () => {
  // Local state for input, loading, connection, and general errors
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false); // Loading state for API calls
  const [isConnected, setIsConnected] = useState(false); // MCP connection status
  const [error, setError] = useState<string | null>(null); // General error display
  const [userName, setUserName] = useState<string | null>(null); // State for user's name
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Get state and actions from Zustand store
  const {
    currentPath,
    contentType, // Get the content type ('file' or 'dir')
    content, // Get the raw content object
    chatThreads,
    getOrCreateChatThread,
    addMessageToThread,
    ensureBranchIdForThread,
    reloadCurrentContent, // Import the reload action
  } = useContentStore();

  // Determine if a markdown file is currently active
  const isMdFileActive = useMemo(() => {
    return contentType === 'file' && currentPath.endsWith('.md');
  }, [contentType, currentPath]);

  // Get the current chat thread and ensure branchId exists when an MD file is active
  const currentThread = useMemo(() => {
    if (isMdFileActive) {
      return getOrCreateChatThread(currentPath);
    }
    return null; // Return null if no MD file is active
  }, [isMdFileActive, currentPath, chatThreads, getOrCreateChatThread]); // chatThreads dependency is important

  const currentBranchId = useMemo(() => {
    if (isMdFileActive && currentPath) {
      // Ensure branchId exists and get it
      return ensureBranchIdForThread(currentPath);
    }
    return null;
  }, [isMdFileActive, currentPath, ensureBranchIdForThread, chatThreads]); // chatThreads dependency ensures re-run after branchId is set

  // Get messages for the current thread, or an empty array if none is active
  const messages = useMemo(() => {
      return currentThread?.messages ?? [];
  }, [currentThread]);

  // Check backend connection status on component mount
  // Check connection status and attempt auto-connect on mount
  useEffect(() => {
    const initializeConnection = async () => {
      setIsLoading(true); // Start loading indicator early
      setError(null);
      const initiallyConnected = await checkConnectionStatus(); // Check initial status

      if (!initiallyConnected) {
        // If not connected, attempt to connect
        console.log("Not connected, attempting auto-connection...");
        try {
          // connectToGithubContributionServer now primarily handles the API call and setting isConnected/error
          await connectToGithubContributionServer();
          // Check status *after* the attempt to confirm
          const connectedAfterAttempt = await checkConnectionStatus();

          // Add appropriate message only if an MD file is active *at the time the connection resolves*
          // Need to get the latest state values inside the async function
          const currentStoreState = useContentStore.getState();
          const isActiveMd = currentStoreState.contentType === 'file' && currentStoreState.currentPath.endsWith('.md');
          const pathForMessage = currentStoreState.currentPath;

          if (isActiveMd && pathForMessage) {
            if (connectedAfterAttempt) {
              addMessageToThread(pathForMessage, { text: 'GitHub Contribution MCPサーバーに自動接続しました。', sender: 'bot' });
            } else {
              // Use the error state which should have been set by connectToGithubContributionServer
              const currentError = error; // Capture error state after connect attempt
              addMessageToThread(pathForMessage, { text: `エラー：MCPサーバーへの自動接続に失敗しました。${currentError || '接続試行に失敗しました。'}`.trim(), sender: 'bot' });
            }
          } else if (!connectedAfterAttempt) {
             console.warn("自動接続に失敗しましたが、メッセージを表示するアクティブなMDファイルがありません。");
          } else {
             console.log("自動接続しましたが、メッセージを表示するアクティブなMDファイルがありません。");
          }

        } catch (err) {
          // Catch errors during the connection *process* itself (e.g., network issues before API call)
          // Errors from the API call itself are handled within connectToGithubContributionServer setting the 'error' state
          console.error("初期接続試行中にエラーが発生しました:", err);
          const errorMessage = err instanceof Error ? err.message : '不明な初期化エラー';
          setError(errorMessage); // Set error state
          await checkConnectionStatus(); // Ensure isConnected reflects failure

          // Add error message if MD file is active
          const currentStoreState = useContentStore.getState();
          const isActiveMd = currentStoreState.contentType === 'file' && currentStoreState.currentPath.endsWith('.md');
          const pathForMessage = currentStoreState.currentPath;
           if (isActiveMd && pathForMessage) {
               addMessageToThread(pathForMessage, { text: `エラー：初期化中に失敗しました。${errorMessage}`, sender: 'bot' });
           }
        } finally {
          setIsLoading(false); // Ensure loading is turned off
        }
      } else {
         console.log("マウント時に既に接続されています。");
         setIsLoading(false); // Turn off loading if already connected
      }
    };

    initializeConnection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  // Get user name on mount
  useEffect(() => {
    const storedName = localStorage.getItem('userName');
    if (storedName) {
      setUserName(storedName);
    } else {
      const name = prompt("お名前を入力してください（あなたの提案の記名に使用されます）：");
      if (name) {
        setUserName(name);
        localStorage.setItem('userName', name);
      } else {
        // Handle case where user cancels or enters nothing (optional)
        console.warn("ユーザーが名前を提供しませんでした。");
        // You might want to set a default name or handle this differently
        setUserName("匿名ユーザー");
        localStorage.setItem('userName', "匿名ユーザー");
      }
    }
  }, []); // Run only once on mount

  // Check if the backend is connected to an MCP server
  // Check if the backend is connected and return the status
  const checkConnectionStatus = async (): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE_URL}/chat/status`);
      const data = await response.json();
      const status = data.initialized as boolean;
      setIsConnected(status);
      return status; // Return the connection status
    } catch (err) {
      console.error('接続ステータスの確認に失敗しました:', err);
      setIsConnected(false);
      return false; // Return false on error
    }
  };

  // Scroll to bottom when messages update
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]); // Depends on the derived messages state

  // Connect to the weather MCP server
  const connectToGithubContributionServer = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE_URL}/chat/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // No body needed, server path is now read from backend .env
      });
      
      const data = await response.json();
      
      // Don't add messages here directly, let the check after connection handle it
      if (response.ok) {
        setIsConnected(true);
        // Message added in the .then block below
      } else {
        setError(data.error || 'MCPサーバーへの接続に失敗しました');
        // Error message added in the .then block below
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '不明なエラー';
      setError(errorMessage);
      // Add error message to the current thread if an MD file is active
      // Error state is set, message will be added by the caller (useEffect or button handler) if needed
    } finally {
      setIsLoading(false);
    }
  };

  // Add a bot message to the chat
  // Helper to add a bot message to the *currently active* thread
  const addBotMessageToCurrentThread = (text: string) => {
    if (isMdFileActive && currentPath) {
      addMessageToThread(currentPath, { text, sender: 'bot' });
    } else {
      console.warn("アクティブなMDファイルがないときにボットメッセージを追加しようとしました。");
      // Optionally display a general status message elsewhere if needed
    }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => { // Changed from HTMLInputElement
    setInputValue(event.target.value);
  };

  const handleSendMessage = async () => {
    if (inputValue.trim() === '' || !isMdFileActive || !currentPath || !currentThread) return;

    const userMessageContent = {
      text: inputValue,
      sender: 'user' as const, // Explicitly type sender
    };

    // Add user message to the store for the current thread
    addMessageToThread(currentPath, userMessageContent);

    // Clear input and set loading state
    const userInput = inputValue;
    setInputValue('');
    setIsLoading(true);
    setError(null);

    // Prepare history for the API call
    // Prepare history from the *current thread's* messages for the API call
    const historyForAPI: OpenAIMessage[] = currentThread.messages.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'assistant',
      content: msg.text,
    }));
    // Add the new user message to the history being sent
    historyForAPI.push({ role: 'user', content: userInput });

    // Prepare context: branchId and fileContent
    let fileContent: string | null = null;
    if (contentType === 'file' && content && 'content' in content) {
        try {
            fileContent = decodeBase64Content((content as GitHubFile).content);
        } catch (e) {
            console.error("ファイルコンテンツのデコードに失敗しました:", e);
            // Optionally handle the error, e.g., send null or an error message
        }
    }

    const payload = {
        message: userInput,
        history: historyForAPI,
        branchId: currentBranchId, // Add branchId
        fileContent: fileContent, // Add decoded file content (or null)
        userName: userName, // Add user name
    };

    try {
      // Send message, history, and context to backend
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload), // Send the updated payload
      });

      const data = await response.json();

      if (response.ok) {
        // Add bot response to the current thread in the store
        // Add bot response to the current thread in the store
        addMessageToThread(currentPath, { text: data.response, sender: 'bot' });
        // Reload the content after receiving the bot's response
        console.log("ボットの応答を受信しました。コンテンツを再読み込みしています...");
        reloadCurrentContent();
      } else {
        const errorMsg = data.error || '応答の取得に失敗しました';
        setError(errorMsg);
        addMessageToThread(currentPath, { text: `エラー：${errorMsg}`, sender: 'bot' });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '不明なエラー';
      setError(errorMessage);
      addMessageToThread(currentPath, { text: `エラー：${errorMessage}`, sender: 'bot' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => { // Changed from HTMLInputElement
    // event.nativeEvent.isComposing check prevents sending on IME confirmation
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault(); // Prevent default Enter behavior (new line)
      handleSendMessage();
    }
    // Shift+Enter should still insert a newline, which is the default behavior for textarea, so no specific handling needed here.
  };

  return (
    <div className="flex flex-col h-full p-4 border-l border-gray-300 relative"> {/* Added relative positioning */}
      {/* Display User Name and Branch ID at the top right */}
      <div className="absolute top-2 right-2 text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded flex items-center space-x-2">
        {userName && <span>👤 {userName}</span>}
        {isMdFileActive && currentBranchId && <span>🌿 ブランチ：{currentBranchId}</span>}
      </div>
      <div className="flex justify-between items-center mb-4 pt-2"> {/* Added padding-top */}
        <h2 className="text-lg font-semibold flex-shrink-0">チャット</h2>
        {!isConnected && (
          <button
            // Manual connect button - attempts connection and updates status.
            // Messages are handled by state changes or potentially added here if needed for manual action feedback.
            onClick={async () => {
                setIsLoading(true);
                setError(null);
                try {
                    await connectToGithubContributionServer();
                    const connected = await checkConnectionStatus(); // Check status after manual attempt
                    // Optionally add a message specific to manual connection success/failure if desired
                    if (isMdFileActive && currentPath) {
                        if (connected) {
                            addBotMessageToCurrentThread('手動接続に成功しました。');
                        } else {
                             addBotMessageToCurrentThread(`エラー：手動接続に失敗しました。${error || ''}`.trim());
                        }
                    }
                } catch (err) {
                     console.error("手動接続エラー:", err);
                     const errorMessage = err instanceof Error ? err.message : '不明なエラー';
                     setError(errorMessage);
                     await checkConnectionStatus(); // Update status
                     if (isMdFileActive && currentPath) {
                         addBotMessageToCurrentThread(`エラー：手動接続に失敗しました。${errorMessage}`);
                     }
                } finally {
                    setIsLoading(false);
                }
            }}
            disabled={isLoading}
            className="bg-green-500 text-white px-3 py-1 rounded-md text-sm hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
          >
            {isLoading ? '接続中...' : 'GitHub MCPに接続'}
          </button>
        )}
        {isConnected && (
          <span className="text-sm text-green-600 font-medium">
            ✓ MCP接続済み
          </span>
        )}
      </div>
      
      {/* Chat messages area */}
      <div ref={chatContainerRef} className="flex-grow overflow-y-auto mb-4 pr-2 space-y-2">
        {!isMdFileActive ? (
          <div className="text-gray-500 text-center py-4 h-full flex items-center justify-center">
            Markdownファイルを選択して表示またはチャットを開始してください。
          </div>
        ) : messages.length === 0 ? (
           <div className="text-gray-500 text-center py-4">
             {isConnected
               ? 'チャットスレッドが開始されました。GitHub Contribution MCPサーバーと対話してください！'
               : 'チャットを開始するにはMCPサーバーに接続してください。'}
           </div>
        ) : (
          // Render messages from the current thread
          messages.map((message) => (
            <div
              key={`${currentPath}-${message.id}`} // Use path in key for potential stability if IDs reset
              className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`p-2 rounded-lg max-w-[80%] ${ // Removed whitespace-pre-wrap as MarkdownViewer handles formatting
                  message.sender === 'user'
                    ? 'bg-blue-500 text-white chat-bubble-user' // Added chat-bubble-user class
                    : 'bg-gray-200 text-gray-800 chat-bubble-bot' // Added chat-bubble-bot class
                }`}
              >
                {/* Render message content using MarkdownViewer */}
                <MarkdownViewer content={message.text} />
              </div>
            </div>
          ))
        )}
        {/* Show loading indicator only when an MD file is active and loading */}
        {isMdFileActive && isLoading && (
          <div className="text-center py-2">
            <span className="inline-block animate-pulse">考え中...</span>
          </div>
        )}
      </div>

      {/* Input area - only enabled when an MD file is active */}
      
      <div className={`flex-shrink-0 flex ${!isMdFileActive ? 'opacity-50 cursor-not-allowed' : ''}`}>
        <textarea
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={isMdFileActive ? "メッセージを入力してください（Shift+Enterで改行）..." : "MDファイルを選択"}
          disabled={isLoading || !isConnected || !isMdFileActive} // Disable if loading, not connected, or no MD file active
          className="flex-grow border border-gray-300 rounded-l-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400 resize-none whitespace-pre-wrap" // Added resize-none and whitespace-pre-wrap
          rows={3} // Start with a reasonable height
        />
        <button
          onClick={handleSendMessage}
          disabled={isLoading || !isConnected || !isMdFileActive || inputValue.trim() === ''} // Also disable if no MD file active or input is empty
          className="bg-blue-500 text-white px-4 py-2 rounded-r-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-blue-300"
        >
          {isLoading ? '...' : '送信'}
        </button>
      </div>
    </div>
  );
};

export default ChatPanel;