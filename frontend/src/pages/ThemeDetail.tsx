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

const ThemeDetail = () => {
  const { themeId } = useParams<{ themeId: string }>();
  const [activeTab, setActiveTab] = useState<"issues" | "solutions">("issues");
  const chatRef = useRef<FloatingChatRef>(null);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [showExtractions, setShowExtractions] = useState<boolean>(true);
  const [notifications, setNotifications] = useState<NotificationType[]>([]);
  const [previousExtractions, setPreviousExtractions] =
    useState<PreviousExtractions>({
      problems: [],
      solutions: [],
    });

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
    if (!currentThreadId || !themeId) return;

    checkForNewExtractions();

    const intervalId = setInterval(checkForNewExtractions, 5000); // 5秒ごとにチェック

    return () => clearInterval(intervalId);
  }, [currentThreadId, themeId]);

  const themeData = {
    id: themeId,
    title: "若者の雇用とキャリア支援",
    description:
      "若者の雇用不安や将来への不安を解消し、安心してキャリアを築ける社会の実現について議論します。新卒一括採用や終身雇用の変化、フリーランスの増加など、働き方の多様化に対応した支援策を考えます。",
  };

  const keyQuestions = [
    {
      id: 1,
      question:
        "どうすれば若者が安心して多様な働き方を選択できる社会になるか？",
      voteCount: 42,
      issueCount: 15,
      solutionCount: 23,
    },
    {
      id: 2,
      question: "新卒一括採用に代わる、若者の能力を活かせる採用の仕組みとは？",
      voteCount: 38,
      issueCount: 12,
      solutionCount: 18,
    },
    {
      id: 3,
      question: "若者のキャリア教育はどのように改善すべきか？",
      voteCount: 35,
      issueCount: 10,
      solutionCount: 16,
    },
  ];

  const issues = [
    {
      id: 1,
      text: "新卒一括採用の仕組みが、若者のキャリア選択の幅を狭めている",
    },
    { id: 2, text: "大学教育と実社会で求められるスキルにギャップがある" },
    { id: 3, text: "若者の非正規雇用が増加し、将来設計が立てにくい" },
    {
      id: 4,
      text: "キャリア教育が不十分で、自分に合った仕事を見つけられない若者が多い",
    },
    { id: 5, text: "地方の若者は都市部に比べて就職機会が限られている" },
  ];

  const solutions = [
    { id: 1, text: "インターンシップ制度の拡充と単位認定の推進" },
    { id: 2, text: "職業体験プログラムを中高生から段階的に導入する" },
    { id: 3, text: "若者向けのキャリアカウンセリングサービスの無料提供" },
    { id: 4, text: "リモートワークの推進による地方在住若者の就業機会拡大" },
    { id: 5, text: "若者の起業支援と失敗しても再チャレンジできる制度の整備" },
  ];

  const breadcrumbItems = [
    { label: "TOP", href: "/" },
    { label: "テーマ一覧", href: "/themes" },
    { label: themeData.title, href: `/themes/${themeId}` },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <BreadcrumbView items={breadcrumbItems} />

      <h1 className="text-2xl md:text-3xl font-bold mb-4">{themeData.title}</h1>

      <p className="text-sm text-neutral-600 mb-8">{themeData.description}</p>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">
          キークエスチョン ({keyQuestions.length})
        </h2>
        <div className="space-y-4">
          {keyQuestions.map((question) => (
            <KeyQuestionCard
              key={question.id}
              question={question.question}
              voteCount={question.voteCount}
              issueCount={question.issueCount}
              solutionCount={question.solutionCount}
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
                <CommentCard key={issue.id} text={issue.text} type="issue" />
              ))
            : solutions.map((solution) => (
                <CommentCard
                  key={solution.id}
                  text={solution.text}
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
