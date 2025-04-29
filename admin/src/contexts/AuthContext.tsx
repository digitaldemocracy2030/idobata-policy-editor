import React, { createContext, useContext, useState, useEffect } from "react";
import { apiClient } from "../services/api/apiClient";
import type { User } from "../services/api/types";

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem("auth_token");

      if (storedToken) {
        setToken(storedToken);
        try {
          const result = await apiClient.getCurrentUser();
          if (result.isOk()) {
            setUser(result.value.user);
          } else {
            localStorage.removeItem("auth_token");
            setToken(null);
          }
        } catch (error) {
          console.error("Failed to get current user:", error);
          localStorage.removeItem("auth_token");
          setToken(null);
        }
      }

      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const result = await apiClient.login(email, password);
      if (result.isOk()) {
        const { token, user } = result.value;
        localStorage.setItem("auth_token", token);
        setToken(token);
        setUser(user);
        return true;
      }
      return false;
    } catch (error) {
      console.error("Login failed:", error);
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem("auth_token");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
