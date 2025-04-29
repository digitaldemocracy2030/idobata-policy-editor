import {
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import { apiClient } from "./services/api/apiClient";
import { ApiErrorType } from "./services/api/apiError";

interface ThemeContextType {
  defaultThemeId: string | null;
  isLoading: boolean;
  error: string | null;
}

const ThemeContext = createContext<ThemeContextType>({
  defaultThemeId: null,
  isLoading: false,
  error: null,
});

export const useTheme = () => useContext(ThemeContext);

interface ThemeProviderProps {
  children?: ReactNode;
}

export const ThemeProvider = ({ children }: ThemeProviderProps) => {
  const [defaultThemeId, setDefaultThemeId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDefaultTheme = async () => {
      setIsLoading(true);

      const result = await apiClient.getDefaultTheme();

      if (result.isErr()) {
        const apiError = result.error;
        console.error("Failed to fetch default theme:", apiError);

        const cachedThemeId = localStorage.getItem("defaultThemeId");
        if (cachedThemeId) {
          setDefaultThemeId(cachedThemeId);
          setError(null);
        } else {
          let errorMessage =
            "テーマの取得に失敗しました。しばらく経ってからリロードしてください。";

          if (apiError.type === ApiErrorType.NETWORK_ERROR) {
            errorMessage = "ネットワーク接続を確認してください。";
          } else if (apiError.type === ApiErrorType.SERVER_ERROR) {
            errorMessage =
              "サーバーエラーが発生しました。しばらく経ってからリロードしてください。";
          }

          setError(errorMessage);
        }
        setIsLoading(false);
        return;
      }

      const defaultTheme = result.value;
      setDefaultThemeId(defaultTheme._id);
      localStorage.setItem("defaultThemeId", defaultTheme._id);
      setError(null);

      setIsLoading(false);
    };

    const cachedThemeId = localStorage.getItem("defaultThemeId");
    if (cachedThemeId) {
      setDefaultThemeId(cachedThemeId);
      setIsLoading(false);
    } else {
      fetchDefaultTheme();
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ defaultThemeId, isLoading, error }}>
      {children}
    </ThemeContext.Provider>
  );
};
