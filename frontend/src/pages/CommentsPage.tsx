import { useState } from "react";
import { useParams } from "react-router-dom";
import BreadcrumbView from "../components/common/BreadcrumbView";
import OpinionCard from "../components/question/OpinionCard";
import { Button } from "../components/ui/button";
import { useMock, useNavigate } from "../contexts/MockContext";
import { useQuestionDetail } from "../hooks/useQuestionDetail";

const CommentsPage = () => {
  const { themeId, qId } = useParams<{ themeId: string; qId: string }>();
  const { isMockMode } = useMock();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"issues" | "solutions">("issues");

  const { questionDetail, isLoading, error } = isMockMode
    ? { questionDetail: null, isLoading: false, error: null }
    : useQuestionDetail(themeId || "", qId || "");
  const mockQuestionData = {
    question: {
      _id: qId,
      questionText:
        "どうすれば若者が安心してキャリアを築ける社会を実現できるか？",
      themeId: themeId,
      voteCount: 42,
    },
    relatedProblems: [
      {
        _id: "p1",
        statement: "新卒一括採用の仕組みが、若者のキャリア選択の幅を狭めている",
        relevanceScore: 0.95,
      },
      {
        _id: "p2",
        statement: "大学教育と実社会で求められるスキルにギャップがある",
        relevanceScore: 0.87,
      },
      {
        _id: "p3",
        statement: "若者の非正規雇用が増加し、将来設計が立てにくい",
        relevanceScore: 0.82,
      },
      {
        _id: "p4",
        statement:
          "キャリア教育が不十分で、自分に合った仕事を見つけられない若者が多い",
        relevanceScore: 0.78,
      },
      {
        _id: "p5",
        statement: "地方の若者は都市部に比べて就職機会が限られている",
        relevanceScore: 0.75,
      },
    ],
    relatedSolutions: [
      {
        _id: "s1",
        statement: "インターンシップ制度の拡充と単位認定の推進",
        relevanceScore: 0.92,
      },
      {
        _id: "s2",
        statement: "職業体験プログラムを中高生から段階的に導入する",
        relevanceScore: 0.88,
      },
      {
        _id: "s3",
        statement: "若者向けのキャリアカウンセリングサービスの無料提供",
        relevanceScore: 0.84,
      },
      {
        _id: "s4",
        statement: "リモートワークの推進による地方在住若者の就業機会拡大",
        relevanceScore: 0.79,
      },
      {
        _id: "s5",
        statement: "若者の起業支援と失敗しても再チャレンジできる制度の整備",
        relevanceScore: 0.76,
      },
    ],
  };

  if (!isMockMode && isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-8">
          <p>コメントを読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!isMockMode && error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (isMockMode || questionDetail) {
    const currentQuestionDetail = isMockMode
      ? mockQuestionData
      : questionDetail;
    const breadcrumbItems = [
      { label: "TOP", href: "/" },
      { label: "テーマ一覧", href: "/themes" },
      {
        label: "テーマ詳細",
        href: `/themes/${themeId}`,
      },
      {
        label: currentQuestionDetail.question.questionText,
        href: `/themes/${themeId}/questions/${qId}`,
      },
      {
        label: "コメント一覧",
        href: `/themes/${themeId}/questions/${qId}/comments`,
      },
    ];

    const mapProblemToOpinion = (p) => ({
      id: p._id,
      text: p.statement,
      relevance: Math.round(p.relevanceScore * 100) || 0,
    });

    const mapSolutionToOpinion = (s) => ({
      id: s._id,
      text: s.statement,
      relevance: Math.round(s.relevanceScore * 100) || 0,
    });

    const issuesData = currentQuestionDetail.relatedProblems.map(mapProblemToOpinion);
    const solutionsData = currentQuestionDetail.relatedSolutions.map(mapSolutionToOpinion);

    const opinions = {
      issues: issuesData,
      solutions: solutionsData,
    };

    return (
      <div className="container mx-auto px-4 py-8">
        <BreadcrumbView items={breadcrumbItems} />

        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-semibold">コメント一覧</h1>
            <Button
              variant="outline"
              size="sm"
              className="text-sm"
              onClick={() => navigate(-1)}
            >
              質問ページに戻る
            </Button>
          </div>

          <div className="flex border-b border-neutral-200 mb-4 sticky top-[66px] bg-white z-10 w-full">
            <button
              className={`flex-1 py-2 px-4 text-base font-bold ${activeTab === "issues" ? "border-b-4 border-primary-500 text-primary-700" : "text-neutral-700"}`}
              onClick={() => setActiveTab("issues")}
              type="button"
            >
              課題点 ({opinions.issues.length})
            </button>
            <button
              className={`flex-1 py-2 px-4 text-base font-bold ${activeTab === "solutions" ? "border-b-4 border-primary-500 text-primary-700" : "text-neutral-700"}`}
              onClick={() => setActiveTab("solutions")}
              type="button"
            >
              解決策 ({opinions.solutions.length})
            </button>
          </div>

          <div className="space-y-3">
            {activeTab === "issues"
              ? opinions.issues.map((issue) => (
                  <OpinionCard
                    key={issue.id}
                    id={issue.id}
                    text={issue.text}
                    type="課題点"
                    relevance={issue.relevance || 0}
                  />
                ))
              : opinions.solutions.map((solution) => (
                  <OpinionCard
                    key={solution.id}
                    id={solution.id}
                    text={solution.text}
                    type="解決策"
                    relevance={solution.relevance || 0}
                  />
                ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center py-8">
        <p>コメントを表示できません。</p>
      </div>
    </div>
  );
};

export default CommentsPage;
