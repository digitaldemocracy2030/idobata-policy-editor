import { useCallback, useEffect, useState } from "react";
import { Link, Outlet, useOutletContext } from "react-router-dom";
import { apiClient } from "../services/api/apiClient";
import type {
  Message,
  NotificationType,
  OutletContext,
  PreviousExtractions,
} from "../types";
import { SystemMessage, UserMessage } from "../types";
import ChatHistory from "./ChatHistory";
import ChatInput from "./ChatInput";
import Notification from "./Notification";
import ThreadExtractions from "./ThreadExtractions";

function AppLayout() {
  const { userId, setUserId } = useOutletContext<OutletContext>();

  // Initialize currentThreadId from localStorage if available
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(
    localStorage.getItem("currentThreadId") || null
  );
  const [currentThemeId, setCurrentThemeId] = useState<string | null>(
    localStorage.getItem("currentThemeId") || null
  );
  const [showExtractions, setShowExtractions] = useState<boolean>(false);
  const [notification, setNotification] = useState<NotificationType | null>(
    null
  );
  const [previousExtractions, setPreviousExtractions] =
    useState<PreviousExtractions>({
      problems: [],
      solutions: [],
    });
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleSendMessage = async (
    newMessageContent: string
  ): Promise<void> => {
    const currentUserId = userId;

    const newUserMessage = new UserMessage(newMessageContent);

    setMessages((prevMessages) => [...prevMessages, newUserMessage]);

    try {
      // テーマIDがない場合はデフォルトのテーマを取得
      if (!currentThemeId) {
        const themeResult = await apiClient.getDefaultTheme();
        if (themeResult.isOk()) {
          const defaultTheme = themeResult.value;
          setCurrentThemeId(defaultTheme._id);
          localStorage.setItem("currentThemeId", defaultTheme._id);
        } else {
          throw new Error(
            `テーマの取得に失敗しました: ${themeResult.error.message}`
          );
        }
      }

      const result = await apiClient.sendMessage(
        currentUserId,
        newUserMessage.content,
        currentThemeId || "",
        currentThreadId || undefined
      );

      if (result.isErr()) {
        const apiError = result.error;
        throw new Error(`API error: ${apiError.message}`);
      }

      const responseData = result.value;

      const assistantMessage = new SystemMessage(responseData.response);

      setMessages((prevMessages) => [...prevMessages, assistantMessage]);

      if (responseData.threadId) {
        setCurrentThreadId(responseData.threadId);
        // Store threadId in localStorage for persistence
        localStorage.setItem("currentThreadId", responseData.threadId);
      }
      if (responseData.userId && !userId) {
        setUserId(responseData.userId);
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      const errorMessage = new SystemMessage(
        `メッセージ送信エラー: ${error.message}`
      );
      setMessages((prevMessages) => [...prevMessages, errorMessage]);
    }
  };

  // Function to check for new extractions and show notifications
  const checkForNewExtractions = useCallback(async (): Promise<void> => {
    if (!currentThreadId || !currentThemeId) return;

    try {
      const result = await apiClient.getThreadExtractions(
        currentThreadId,
        currentThemeId
      );

      if (result.isErr()) {
        const apiError = result.error;
        throw new Error(`API error: ${apiError.message}`);
      }

      const data = result.value;
      const currentProblems = data.problems || [];
      const currentSolutions = data.solutions || [];

      // Check for new problems
      for (const problem of currentProblems) {
        const existingProblem = previousExtractions.problems.find(
          (p) => p._id === problem._id
        );

        if (!existingProblem) {
          // New problem added
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
          // Problem updated
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

      // If no new/updated problems, check for new solutions
      if (!notification) {
        for (const solution of currentSolutions) {
          const existingSolution = previousExtractions.solutions.find(
            (s) => s._id === solution._id
          );

          if (!existingSolution) {
            // New solution added
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
            // Solution updated
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

      // Update previous extractions for next comparison
      setPreviousExtractions({
        problems: currentProblems,
        solutions: currentSolutions,
      });
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
    const loadThreadMessages = async (): Promise<void> => {
      if (!currentThreadId || !currentThemeId) return;

      setIsLoading(true);
      try {
        const result = await apiClient.getThreadMessages(
          currentThreadId,
          currentThemeId
        );

        if (result.isErr()) {
          const apiError = result.error;

          // If thread not found, clear the stored threadId
          if (apiError.statusCode === 404) {
            localStorage.removeItem("currentThreadId");
            setCurrentThreadId(null);
          }

          throw new Error(`API error: ${apiError.message}`);
        }

        const data = result.value;
        if (data.messages && data.messages.length > 0) {
          // unknown[]型からMessage[]型にキャスト
          setMessages(data.messages as Message[]);
        }
      } catch (error) {
        console.error("Failed to load thread messages:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadThreadMessages();
  }, [currentThreadId]);

  // Load default theme when component mounts if no theme is set
  useEffect(() => {
    const loadDefaultTheme = async () => {
      if (!currentThemeId) {
        try {
          const themeResult = await apiClient.getDefaultTheme();
          if (themeResult.isOk()) {
            const defaultTheme = themeResult.value;
            setCurrentThemeId(defaultTheme._id);
            localStorage.setItem("currentThemeId", defaultTheme._id);
          }
        } catch (error) {
          console.error("Failed to load default theme:", error);
        }
      }
    };

    loadDefaultTheme();
  }, [currentThemeId]);

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
              to="/legacy/data"
              className="px-3 py-1 rounded-md text-sm transition-colors duration-200 text-neutral-600 hover:text-primary hover:bg-neutral-100"
            >
              データ一覧
            </Link>
            <Link
              to="/legacy/"
              className="px-3 py-1 rounded-md text-sm transition-colors duration-200 text-neutral-600 hover:text-primary hover:bg-neutral-100"
            >
              シャープな問いとインサイト
            </Link>
            <Link
              to="/"
              className="px-3 py-1 rounded-md text-sm transition-colors duration-200 text-neutral-600 hover:text-primary hover:bg-neutral-100"
            >
              新UI
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
          <div className="absolute top-2 left-2 z-10 flex space-x-2 ">
            {/* Extraction Toggle Button */}
            <button
              onClick={() => setShowExtractions(!showExtractions)}
              disabled={!currentThreadId}
              className={`px-2 py-1 rounded-md text-xs border border-neutral-300 transition-colors duration-200 ${
                !currentThreadId
                  ? "bg-neutral-100 text-neutral-300 cursor-not-allowed"
                  : showExtractions
                    ? "bg-neutral-200 text-neutral-700 hover:bg-neutral-300" // Active state
                    : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200" // Default state
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

            {/* New Conversation Button */}
            {currentThreadId && (
              <button
                onClick={() => {
                  // Clear current thread and start a new conversation
                  localStorage.removeItem("currentThreadId");
                  setCurrentThreadId(null);
                  setMessages([]);
                  setPreviousExtractions({ problems: [], solutions: [] });
                  // テーマIDはリセットしない
                }}
                className="px-2 py-1 rounded-md text-xs border border-neutral-300 transition-colors duration-200 bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                title="新しい会話"
                type="button"
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
              <ThreadExtractions
                threadId={currentThreadId}
                themeId={currentThemeId}
              />
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
