import { useState, useEffect } from "react";
import { ThemeService } from "../services/ThemeService";
import type { ThemeWithCounts } from "../types";
import { ApiError } from "../services/api/apiError";

interface UseThemesResult {
  themes: ThemeWithCounts[];
  loading: boolean;
  error: ApiError | null;
  refetch: () => Promise<void>;
}

export function useThemes(): UseThemesResult {
  const [themes, setThemes] = useState<ThemeWithCounts[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchThemes = async () => {
    setLoading(true);
    setError(null);

    try {
      const fetchedThemes = await ThemeService.getAllThemes();
      setThemes(fetchedThemes);
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchThemes();
  }, []);

  return { themes, loading, error, refetch: fetchThemes };
}
