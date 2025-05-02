import { useEffect, useRef, useState } from "react";
import { apiClient } from "../../services/api/apiClient";
import { FloatingChat, type FloatingChatRef } from "../chat/FloatingChat";
import BreadcrumbView from "../common/BreadcrumbView";
import CommentCard from "./CommentCard";
import KeyQuestionCard from "./KeyQuestionCard";

interface ThemeDetailTemplateProps {
  theme: {
    _id: string;
    title: string;
    description: string;
  };
  keyQuestions: {
    id: number | string;
    question: string;
    voteCount: number;
    issueCount: number;
    solutionCount: number;
  }[];
  issues: {
    id: number | string;
    text: string;
  }[];
  solutions: {
    id: number | string;
    text: string;
  }[];
}

const ThemeDetailTemplate = ({
  theme,
  keyQuestions,
  issues,
  solutions,
}: ThemeDetailTemplateProps) => {
  const [activeTab, setActiveTab] = useState<"issues" | "solutions">("issues");
  const chatRef = useRef<FloatingChatRef>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string>(
    localStorage.getItem("userId") || crypto.randomUUID()
  );

  const handleSendMessage = async (message: string) => {
    console.log("Message sent:", message);

    chatRef.current?.addMessage(message, "user");

    const result = await apiClient.sendMessage(
      userId,
      message,
      theme._id,
      threadId || undefined
    );

    if (result.isErr()) {
      console.error("Failed to send message:", result.error);
      chatRef.current?.addMessage(
        `メッセージ送信エラー: ${result.error.message}`,
        "system"
      );
      return;
    }

    const responseData = result.value;

    chatRef.current?.addMessage(responseData.response, "system");

    if (responseData.threadId) {
      setThreadId(responseData.threadId);
    }

    if (responseData.userId && responseData.userId !== userId) {
      setUserId(responseData.userId);
      localStorage.setItem("userId", responseData.userId);
    }
  };

  const breadcrumbItems = [
    { label: "TOP", href: "/" },
    { label: "テーマ一覧", href: "/themes" },
    { label: theme.title, href: `/themes/${theme._id}` },
  ];

  useEffect(() => {
    if (!localStorage.getItem("userId")) {
      localStorage.setItem("userId", userId);
    }
  }, [userId]);

  return (
    <div className="container mx-auto px-4 py-8">
      <BreadcrumbView items={breadcrumbItems} />

      <h1 className="text-2xl md:text-3xl font-bold mb-4">{theme.title}</h1>

      <p className="text-sm text-neutral-600 mb-8">{theme.description}</p>

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
              themeId={theme._id}
              qid={question.id.toString()}
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

      <FloatingChat ref={chatRef} onSendMessage={handleSendMessage} />
    </div>
  );
};

export default ThemeDetailTemplate;
