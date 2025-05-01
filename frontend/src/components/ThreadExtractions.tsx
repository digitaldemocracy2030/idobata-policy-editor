import { useEffect, useState } from "react";
import { apiClient } from "../services/api/apiClient";
import { socketClient } from "../services/socket/socketClient";
import type { Problem, Solution } from "../types";

interface ThreadExtractionsProps {
  threadId: string | null;
  themeId?: string | null;
}

const ThreadExtractions = ({ threadId, themeId }: ThreadExtractionsProps) => {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [solutions, setSolutions] = useState<Solution[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Don't fetch if threadId or themeId is not available
    if (!threadId || !themeId) {
      setProblems([]);
      setSolutions([]);
      return;
    }

    const fetchExtractions = async (): Promise<void> => {
      setError(null);

      const result = await apiClient.getThreadExtractions(threadId, themeId);

      if (result.isErr()) {
        const apiError = result.error;
        console.error("Failed to fetch extractions:", apiError);

        if (apiError.statusCode === 404) {
          console.warn(
            `No extractions found for thread ${threadId} or thread does not exist.`
          );
          setProblems([]);
          setSolutions([]);
          return;
        }

        setError("抽出結果の読み込みに失敗しました。");
        return;
      }

      const data = result.value;
      setProblems(data.problems || []);
      setSolutions(data.solutions || []);
    };

    // Fetch immediately on threadId change
    fetchExtractions();

    if (threadId && themeId) {
      console.log("ThreadExtractions subscribing to WebSocket", {
        threadId,
        themeId,
      });
      socketClient.subscribeToThread(threadId);
      socketClient.subscribeToTheme(themeId);

      const unsubscribeNew = socketClient.onNewExtraction((event) => {
        if (event.type === "problem") {
          setProblems((prev) => [...prev, event.data as Problem]);
        } else if (event.type === "solution") {
          setSolutions((prev) => [...prev, event.data as Solution]);
        }
      });

      const unsubscribeUpdate = socketClient.onExtractionUpdate((event) => {
        if (event.type === "problem") {
          const updatedProblem = event.data as Problem;
          setProblems((prev) =>
            prev.map((p) => (p._id === updatedProblem._id ? updatedProblem : p))
          );
        } else if (event.type === "solution") {
          const updatedSolution = event.data as Solution;
          setSolutions((prev) =>
            prev.map((s) =>
              s._id === updatedSolution._id ? updatedSolution : s
            )
          );
        }
      });

      // Clean up subscriptions when component unmounts or threadId/themeId changes
      return () => {
        console.log("ThreadExtractions useEffect cleanup", {
          threadId,
          themeId,
        });
        if (threadId) socketClient.unsubscribeFromThread(threadId);
        if (themeId) socketClient.unsubscribeFromTheme(themeId);
        unsubscribeNew();
        unsubscribeUpdate();
      };
    }
  }, [threadId, themeId]); // Re-run effect when threadId or themeId changes

  // Do not render anything if there's no threadId or themeId
  if (!threadId || !themeId) {
    return null;
  }

  // Optional: Show loading state
  // if (isLoading) {
  //     return <div className="p-2 text-sm text-gray-500">Loading extractions...</div>;
  // }

  // Show error state
  if (error) {
    return <div className="p-2 text-sm text-red-600">{error}</div>; // Slightly darker red
  }

  // Show extractions if available
  const hasExtractions = problems.length > 0 || solutions.length > 0;

  return (
    <div className="text-xs md:text-sm text-neutral-700 animate-slide-up custom-scrollbar">
      <div className="flex items-center justify-between mb-2 md:mb-3">
        <h3 className="font-semibold text-primary text-sm md:text-base">
          抽出されたインサイト
        </h3>
        <span className="badge badge-secondary text-xs">自動抽出</span>
      </div>

      {!hasExtractions && (
        <div className="p-4 bg-white rounded-lg border border-neutral-200 text-neutral-500 italic text-center">
          このスレッドからはまだインサイトが抽出されていません
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {problems.length > 0 && (
          <div className="bg-white p-2 md:p-3 border border-neutral-200 rounded-lg shadow-sm">
            <h4 className="font-medium text-primary-dark flex items-center gap-1 md:gap-2 mb-1 md:mb-2 text-xs md:text-sm">
              <span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-primary inline-block" />
              課題 ({problems.length})
            </h4>
            <ul className="space-y-2">
              {problems.map((p) => (
                <li
                  key={p._id}
                  className="bg-neutral-50 p-1.5 md:p-2 rounded-md border border-neutral-200 text-neutral-800 text-xs md:text-sm"
                >
                  {p.statement || "ステートメントが見つかりません"}
                </li>
              ))}
            </ul>
          </div>
        )}

        {solutions.length > 0 && (
          <div className="bg-white p-2 md:p-3 border border-neutral-200 rounded-lg shadow-sm">
            <h4 className="font-medium text-success flex items-center gap-1 md:gap-2 mb-1 md:mb-2 text-xs md:text-sm">
              <span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-success inline-block" />
              解決策 ({solutions.length})
            </h4>
            <ul className="space-y-2">
              {solutions.map((s) => (
                <li
                  key={s._id}
                  className="bg-neutral-50 p-1.5 md:p-2 rounded-md border border-neutral-200 text-neutral-800 text-xs md:text-sm"
                >
                  {s.statement || "ステートメントが見つかりません"}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default ThreadExtractions;
