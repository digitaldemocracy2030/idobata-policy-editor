import { useEffect, useState } from "react";
import { apiClient } from "../services/api/apiClient";
import { ApiError } from "../services/api/apiError";
import type { Question } from "../types";

interface UseThemeQuestionsResult {
  questions: Question[];
  loading: boolean;
  error: ApiError | null;
  refetch: () => Promise<void>;
}

export function useThemeQuestions(themeId: string): UseThemeQuestionsResult {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchQuestions = async () => {
    if (!themeId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await apiClient.getQuestionsByTheme(themeId);

      if (result.isErr()) {
        setError(result.error);
        return;
      }

      setQuestions(result.value);
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, [themeId]);

  return { questions, loading, error, refetch: fetchQuestions };
}
