import { useEffect, useState } from "react";
import { apiClient } from "../services/api/apiClient";
import { ApiError } from "../services/api/apiError";
import type { Solution } from "../types";

interface UseThemeSolutionsResult {
  solutions: Solution[];
  loading: boolean;
  error: ApiError | null;
  refetch: () => Promise<void>;
}

export function useThemeSolutions(themeId: string): UseThemeSolutionsResult {
  const [solutions, setSolutions] = useState<Solution[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchSolutions = async () => {
    if (!themeId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await apiClient.getSolutionsByTheme(themeId);

      if (result.isErr()) {
        setError(result.error);
        return;
      }

      setSolutions(result.value);
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSolutions();
  }, [themeId]);

  return { solutions, loading, error, refetch: fetchSolutions };
}
