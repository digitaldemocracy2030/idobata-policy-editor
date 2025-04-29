import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import ThreadExtractions from "../components/ThreadExtractions";
import {
  FloatingChat,
  type FloatingChatRef,
} from "../components/chat/FloatingChat";
import BreadcrumbView from "../components/common/BreadcrumbView";
import CommentCard from "../components/theme/CommentCard";
import KeyQuestionCard from "../components/theme/KeyQuestionCard";
import { apiClient } from "../services/api/apiClient";
import type { NotificationType, PreviousExtractions } from "../types";
import { useTheme } from "../hooks/useTheme";
import { useThemeQuestions } from "../hooks/useThemeQuestions";
import { useThemeProblems } from "../hooks/useThemeProblems";
import { useThemeSolutions } from "../hooks/useThemeSolutions";

const ThemeDetail = () => {
  const { themeId } = useParams<{ themeId: string }>();
  const [activeTab, setActiveTab] = useState<"issues" | "solutions">("issues");
  const chatRef = useRef<FloatingChatRef>(null);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [messageHasBeenSent, setMessageHasBeenSent] = useState<boolean>(false);
  const [showExtractions, setShowExtractions] = useState<boolean>(true);
  const [notifications, setNotifications] = useState<NotificationType[]>([]);
  const [previousExtractions, setPreviousExtractions] =
    useState<PreviousExtractions>({
      problems: [],
      solutions: [],
    });
    
  const {
    theme,
    loading: themeLoading,
    error: themeError,
  } = useTheme(themeId || "");
  const {
    questions: keyQuestions,
    loading: questionsLoading,
    error: questionsError,
  } = useThemeQuestions(themeId || "");
  const {
    problems: issues,
    loading: issuesLoading,
    error: issuesError,
  } = useThemeProblems(themeId || "");
  const {
    solutions,
    loading: solutionsLoading,
    error: solutionsError,
  } = useThemeSolutions(themeId || "");

  const isLoading =
    themeLoading || questionsLoading || issuesLoading || solutionsLoading;
  const errors = [themeError, questionsError, issuesError, solutionsError].filter(
    Boolean
  );

  useEffect(() => {
    const storedUserId = localStorage.getItem("userId");
    if (storedUserId) {
      setUserId(storedUserId);
    } else {
      const newUserId = uuidv4();
      localStorage.setItem("userId", newUserId);
      setUserId(newUserId);
    }
  }, []);

  useEffect(() => {
    const newThreadId = uuidv4();
    setCurrentThreadId(newThreadId);
  }, []);

  const handleSendMessage = async (message: string) => {
    if (!userId || !themeId || !currentThreadId) {
      console.error("Missing required data for sending message");
      return;
    }

    console.log("Message sent:", message);

    try {
      const result = await apiClient.sendMessage(
        userId,
        message,
        themeId,
        currentThreadId
      );

      if (result.isErr()) {
        console.error("Failed to send message:", result.error);
        chatRef.current?.addMessage(
          "メッセージの送信に失敗しました。もう一度お試しください。",
          "system"
        );
        return;
      }

      const { response } = result.value;
      chatRef.current?.addMessage(response, "system");
      setMessageHasBeenSent(true); // メッセージが正常に送信された後にフラグを設定

      checkForNewExtractions();
    } catch (error) {
      console.error("Error sending message:", error);
      chatRef.current?.addMessage(
        "エラーが発生しました。もう一度お試しください。",
        "system"
      );
    }
  };

  const checkForNewExtractions = async () => {
    if (!currentThreadId || !themeId) {
      console.warn("Missing threadId or themeId for extraction check");
      return;
    }

    if (!messageHasBeenSent) {
      return;
    }

    try {
      const result = await apiClient.getThreadExtractions(
        currentThreadId,
        themeId
      );

      if (result.isErr()) {
        console.error("Failed to fetch extractions:", result.error);
        return;
      }

      const { problems, solutions } = result.value;
      const newProblems = problems.filter(
        (p) => !previousExtractions.problems.some((prev) => prev._id === p._id)
      );
      const newSolutions = solutions.filter(
        (s) => !previousExtractions.solutions.some((prev) => prev._id === s._id)
      );

      if (newProblems.length > 0 || newSolutions.length > 0) {
        const newNotification = {
          message: `新しいインサイトが抽出されました: ${newProblems.length}件の課題と${newSolutions.length}件の解決策`,
          type: "info",
          id: uuidv4(),
        };
        setNotifications((prev) => [...prev, newNotification]);

        setPreviousExtractions({
          problems,
          solutions,
        });
      }
    } catch (error) {
      console.error("Error checking for new extractions:", error);
    }
  };

  useEffect(() => {
    if (notifications.length > 0) {
      const timer = setTimeout(() => {
        setNotifications((prev) => prev.slice(1));
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [notifications]);

  useEffect(() => {
    if (!currentThreadId || !themeId || !messageHasBeenSent) return;

    checkForNewExtractions();

    const intervalId = setInterval(checkForNewExtractions, 5000); // 5秒ごとにチェック

    return () => clearInterval(intervalId);
  }, [currentThreadId, themeId, messageHasBeenSent]);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center h-64">
          <p className="text-lg text-gray-600">テーマデータを読み込み中...</p>
        </div>
      </div>
    );
  }

  if (errors.length > 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div
          className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative"
          role="alert"
        >
          <strong className="font-bold">エラー:</strong>
          <span className="block sm:inline">
            {" "}
            テーマデータの読み込みに失敗しました。後でもう一度お試しください。
          </span>
        </div>
      </div>
    );
  }

  if (!theme) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div
          className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded relative"
          role="alert"
        >
          <strong className="font-bold">見つかりません:</strong>
          <span className="block sm:inline">
            {" "}
            要求されたテーマが見つかりませんでした。
          </span>
        </div>
      </div>
    );
  }

  const breadcrumbItems = [
    { label: "TOP", href: "/" },
    { label: "テーマ一覧", href: "/themes" },
    { label: theme.title, href: `/themes/${themeId}` },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <BreadcrumbView items={breadcrumbItems} />

      <h1 className="text-2xl md:text-3xl font-bold mb-4">{theme.title}</h1>

      <p className="text-sm text-neutral-600 mb-8">{theme.description || ""}</p>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">
          キークエスチョン ({keyQuestions.length})
        </h2>
        <div className="space-y-4">
          {keyQuestions.map((question) => (
            <KeyQuestionCard
              key={question._id}
              question={question.questionText}
              voteCount={0} // APIで利用可能な場合は投票数を追加
              issueCount={0} // APIで利用可能な場合は課題数を追加
              solutionCount={0} // APIで利用可能な場合は解決策数を追加
            />
          ))}
        </div>
      </div>

      <div className="mb-12">
        <h2 className="text-xl font-semibold mb-4">寄せられた意見</h2>

        <div className="flex border-b border-neutral-200 mb-4">
          <button
            className={`py-2 px-4 text-sm font-medium ${
              activeTab === "issues"
                ? "border-b-2 border-purple-500 text-purple-700"
                : "text-neutral-500"
            }`}
            onClick={() => setActiveTab("issues")}
            type="button"
          >
            課題点 ({issues.length})
          </button>
          <button
            className={`py-2 px-4 text-sm font-medium ${
              activeTab === "solutions"
                ? "border-b-2 border-purple-500 text-purple-700"
                : "text-neutral-500"
            }`}
            onClick={() => setActiveTab("solutions")}
            type="button"
          >
            解決策 ({solutions.length})
          </button>
        </div>

        <div className="space-y-3">
          {activeTab === "issues"
            ? issues.map((issue) => (
                <CommentCard
                  key={issue._id}
                  text={issue.statement}
                  type="issue"
                />
              ))
            : solutions.map((solution) => (
                <CommentCard
                  key={solution._id}
                  text={solution.statement}
                  type="solution"
                />
              ))}
        </div>
      </div>

      {/* 通知表示エリア */}
      {notifications.length > 0 && (
        <div className="fixed top-4 right-4 z-50 space-y-2">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`p-3 rounded-lg shadow-md text-sm ${
                notification.type === "info"
                  ? "bg-blue-100 text-blue-800"
                  : "bg-red-100 text-red-800"
              }`}
            >
              {notification.message}
              <button
                type="button"
                className="ml-2 text-xs"
                onClick={() => {
                  setNotifications((prev) =>
                    prev.filter((n) => n.id !== notification.id)
                  );
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 抽出結果表示エリア */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-xl font-semibold">AIによる自動抽出</h2>
          <button
            type="button"
            className="text-sm text-purple-600 hover:text-purple-800"
            onClick={() => setShowExtractions(!showExtractions)}
          >
            {showExtractions ? "非表示" : "表示"}
          </button>
        </div>

        {showExtractions && currentThreadId && themeId && (
          <div className="bg-neutral-50 p-4 rounded-lg border border-neutral-200">
            <ThreadExtractions threadId={currentThreadId} themeId={themeId} />
          </div>
        )}
      </div>

      {/* フローティングチャットと抽出結果表示エリア */}
      <div className="relative">
        {/* 抽出結果表示切り替えボタン */}
        <div className="fixed bottom-20 right-4 z-40">
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
            抽出された課題/解決策を{showExtractions ? "非表示" : "表示"}
          </button>
        </div>

        {/* 抽出結果表示エリア */}
        {showExtractions && currentThreadId && themeId && (
          <div className="fixed bottom-20 right-4 w-80 bg-white border border-neutral-200 rounded-lg shadow-lg z-30">
            <div className="p-3 max-h-60 overflow-y-auto custom-scrollbar">
              <ThreadExtractions threadId={currentThreadId} themeId={themeId} />
            </div>
          </div>
        )}

        {/* フローティングチャット */}
        <FloatingChat ref={chatRef} onSendMessage={handleSendMessage} />
      </div>
    </div>
  );
};

export default ThemeDetail;
