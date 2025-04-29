import { useEffect, useState } from "react";
import { apiClient } from "../services/api/apiClient";
import { ApiError } from "../services/api/apiError";
import type { Problem } from "../types";

interface UseThemeProblemsResult {
  problems: Problem[];
  loading: boolean;
  error: ApiError | null;
  refetch: () => Promise<void>;
}

export function useThemeProblems(themeId: string): UseThemeProblemsResult {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchProblems = async () => {
    if (!themeId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await apiClient.getProblemsByTheme(themeId);

      if (result.isErr()) {
        setError(result.error);
        return;
      }

      setProblems(result.value);
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProblems();
  }, [themeId]);

  return { problems, loading, error, refetch: fetchProblems };
}
