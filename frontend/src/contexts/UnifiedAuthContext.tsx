import React, { createContext, useContext, useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { apiClient } from "../services/api/apiClient";

interface User {
  id: string;
  email: string | null;
  displayName: string | null;
  profileImageUrl: string | null;
  role: "admin" | "editor" | "user";
  googleId?: string | null;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isEditor: boolean;
  loading: boolean;
  error: string | null;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  setDisplayName: (name: string) => Promise<boolean>;
  uploadProfileImage: (file: File) => Promise<boolean>;
}

const UnifiedAuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isAdmin: false,
  isEditor: false,
  loading: true,
  error: null,
  loginWithGoogle: async () => {},
  logout: async () => {},
  setDisplayName: async () => false,
  uploadProfileImage: async () => false,
});

export const useAuth = () => useContext(UnifiedAuthContext);

export const UnifiedAuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeUser = async () => {
      setLoading(true);
      setError(null);

      try {
        const tokenResult = await apiClient.getCurrentUser();

        if (tokenResult.isOk()) {
          const userData = tokenResult.value;
          setUser({
            id: userData.user.id,
            email: userData.user.email,
            displayName: userData.user.displayName,
            profileImageUrl: userData.user.profileImageUrl,
            role: userData.user.role as "admin" | "editor" | "user",
            googleId: userData.user.googleId,
          });
          setLoading(false);
          return;
        }

        let userId = localStorage.getItem("idobataUserId");

        if (!userId) {
          userId = uuidv4();
          localStorage.setItem("idobataUserId", userId);
        }

        const result = await apiClient.getUserInfo(userId);

        if (result.isErr()) {
          console.error("Failed to fetch user info:", result.error);
          setUser({
            id: userId,
            email: null,
            displayName: null,
            profileImageUrl: null,
            role: "user",
          });
          setError("ユーザー情報の取得に失敗しました");
          setLoading(false);
          return;
        }

        const data = result.value;
        setUser({
          id: userId,
          email: null,
          displayName: data.displayName,
          profileImageUrl: data.profileImagePath,
          role: "user",
        });
        setError(null);
      } catch (err) {
        console.error("Authentication initialization error:", err);
        setError("認証の初期化中にエラーが発生しました");
      } finally {
        setLoading(false);
      }
    };

    initializeUser();
  }, []);

  const loginWithGoogle = async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const urlResult = await apiClient.getGoogleAuthUrl();

      if (urlResult.isErr()) {
        setError("Google認証URLの取得に失敗しました");
        return;
      }

      window.location.href = urlResult.value.url;
    } catch (err) {
      console.error("Google login error:", err);
      setError("Google認証の開始に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const result = await apiClient.logout();

      if (result.isErr()) {
        setError("ログアウトに失敗しました");
        return;
      }

      setUser(null);

      const newUserId = uuidv4();
      localStorage.setItem("idobataUserId", newUserId);

      const userResult = await apiClient.getUserInfo(newUserId);

      if (userResult.isOk()) {
        const data = userResult.value;
        setUser({
          id: newUserId,
          email: null,
          displayName: data.displayName,
          profileImageUrl: data.profileImagePath,
          role: "user",
        });
      } else {
        setUser({
          id: newUserId,
          email: null,
          displayName: null,
          profileImageUrl: null,
          role: "user",
        });
      }
    } catch (err) {
      console.error("Logout error:", err);
      setError("ログアウト中にエラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const setDisplayName = async (name: string): Promise<boolean> => {
    if (!user) return false;

    const result = await apiClient.updateUserDisplayName(user.id, name);

    if (result.isErr()) {
      console.error("Failed to update display name:", result.error);
      setError("表示名の更新に失敗しました");
      return false;
    }

    setUser({ ...user, displayName: name });
    return true;
  };

  const uploadProfileImage = async (file: File): Promise<boolean> => {
    if (!user) return false;

    const result = await apiClient.uploadProfileImage(user.id, file);

    if (result.isErr()) {
      console.error("Failed to upload profile image:", result.error);
      setError("プロフィール画像のアップロードに失敗しました");
      return false;
    }

    setUser({ ...user, profileImageUrl: result.value.profileImageUrl });
    return true;
  };

  return (
    <UnifiedAuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user && !!user.email, // Only Google-authenticated users are considered fully authenticated
        isAdmin: !!user && user.role === "admin",
        isEditor: !!user && (user.role === "admin" || user.role === "editor"),
        loading,
        error,
        loginWithGoogle,
        logout,
        setDisplayName,
        uploadProfileImage,
      }}
    >
      {children}
    </UnifiedAuthContext.Provider>
  );
};
