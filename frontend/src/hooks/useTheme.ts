import { useEffect, useState } from "react";
import { ThemeService } from "../services/ThemeService";
import { ApiError } from "../services/api/apiError";
import type { ThemeWithCounts } from "../types";

interface UseThemeResult {
  theme: ThemeWithCounts | null;
  loading: boolean;
  error: ApiError | null;
  refetch: () => Promise<void>;
}

export function useTheme(themeId: string): UseThemeResult {
  const [theme, setTheme] = useState<ThemeWithCounts | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchTheme = async () => {
    if (!themeId) return;

    setLoading(true);
    setError(null);

    try {
      const fetchedTheme = await ThemeService.getThemeById(themeId);
      setTheme(fetchedTheme);
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTheme();
  }, [themeId]);

  return { theme, loading, error, refetch: fetchTheme };
}
