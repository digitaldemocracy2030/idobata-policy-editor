# 管理者ログイン機能実装手順書

## 概要

本ドキュメントでは、idea-discussion バックエンドと admin フロントエンド間での管理者ログイン機能の実装手順について説明します。初期実装ではメールアドレスとパスワードによる認証を行い、将来的に Google OAuth などの認証方法にも対応できる拡張性を持たせます。セキュリティ強化のため、パスワード保護には salt と pepper の両方を使用します。

## 目次

1. [バックエンド実装](#バックエンド実装)
   - [1.1 管理者ユーザーモデルの作成](#11-管理者ユーザーモデルの作成)
   - [1.2 認証コントローラーの作成](#12-認証コントローラーの作成)
   - [1.3 認証ミドルウェアの作成](#13-認証ミドルウェアの作成)
   - [1.4 ルートの設定](#14-ルートの設定)
2. [フロントエンド実装](#フロントエンド実装)
   - [2.1 認証コンテキストの作成](#21-認証コンテキストの作成)
   - [2.2 ログインページの作成](#22-ログインページの作成)
   - [2.3 保護されたルートの実装](#23-保護されたルートの実装)
   - [2.4 API クライアントの拡張](#24-apiクライアントの拡張)
3. [拡張性の確保](#拡張性の確保)
   - [3.1 認証プロバイダーインターフェース](#31-認証プロバイダーインターフェース)
   - [3.2 Google OAuth 認証の追加](#32-google-oauth認証の追加)
4. [セキュリティ対策](#セキュリティ対策)
5. [テスト手順](#テスト手順)

## バックエンド実装

### 1.1 管理者ユーザーモデルの作成

idea-discussion/backend/models/AdminUser.js ファイルを作成し、以下の内容を実装します。

````javascript
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";

// 環境変数からpepperを取得（.envファイルに追加が必要）
const PEPPER = process.env.PASSWORD_PEPPER || "default-pepper-value-change-in-production";

/**
 * パスワードにpepperを適用してからハッシュ化する関数
 * @param {string} password - 元のパスワード
 * @returns {string} - pepperを適用した後のパスワード
 */
const applyPepper = (password) => {
  return crypto
    .createHmac("sha256", PEPPER)
    .update(password)
    .digest("hex");
};

const adminUserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["admin", "editor"],
      default: "editor",
    },
    authProvider: {
      type: String,
      enum: ["local", "google"],
      default: "local",
    },
    authProviderId: {
      type: String,
      default: null,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// パスワードハッシュ化のためのpre-saveフック
adminUserSchema.pre("save", async function (next) {
  // パスワードが変更されていない場合はスキップ
  if (!this.isModified("password")) return next();

  try {
    // パスワードにpepperを適用してからハッシュ化
    const pepperedPassword = applyPepper(this.password);
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(pepperedPassword, salt);
    next();
  } catch (error) {
    next(error);
  }
// パスワード検証メソッド
adminUserSchema.methods.comparePassword = async function (candidatePassword) {
  // 検証時も同じようにpepperを適用
  const pepperedPassword = applyPepper(candidatePassword);
  return bcrypt.compare(pepperedPassword, this.password);
};

### 1.2 認証コントローラーの作成

idea-discussion/backend/controllers/authController.js ファイルを作成し、以下の内容を実装します。

```javascript
import jwt from "jsonwebtoken";
import AdminUser from "../models/AdminUser.js";

// 環境変数からJWTシークレットを取得（.envファイルに追加が必要）
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1d";

// JWTトークンの生成
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
};

// ログイン処理
const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    // 入力検証
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "メールアドレスとパスワードを入力してください" });
    }

    // ユーザーの検索
    const user = await AdminUser.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "認証情報が無効です" });
    }

    // アカウントが無効化されていないか確認
    if (!user.isActive) {
      return res.status(401).json({ message: "アカウントが無効化されています" });
    }

    // パスワードの検証
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: "認証情報が無効です" });
    }

    // 最終ログイン日時の更新
    user.lastLogin = new Date();
    await user.save();

    // JWTトークンの生成
    const token = generateToken(user._id);

    // レスポンスの送信
    res.status(200).json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("[AuthController] Login error:", error);
    res.status(500).json({ message: "サーバーエラーが発生しました" });
  }
};

// 現在のユーザー情報の取得
const getCurrentUser = async (req, res) => {
  try {
    const user = await AdminUser.findById(req.user.id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "ユーザーが見つかりません" });
    }

    res.status(200).json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("[AuthController] Get current user error:", error);
    res.status(500).json({ message: "サーバーエラーが発生しました" });
  }
};

// 管理者ユーザーの作成（初期セットアップまたは他の管理者のみ実行可能）
const createAdminUser = async (req, res) => {
  const { email, password, name, role } = req.body;

  try {
    // 入力検証
    if (!email || !password || !name) {
      return res
        .status(400)
        .json({ message: "必須項目が入力されていません" });
    }

    // 既存ユーザーの確認
    const existingUser = await AdminUser.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "このメールアドレスは既に使用されています" });
    }

    // 新規ユーザーの作成
    const newUser = new AdminUser({
      email,
      password,
      name,
      role: role || "editor",
      authProvider: "local",
    });
### 1.3 認証ミドルウェアの作成

idea-discussion/backend/middleware/authMiddleware.js ファイルを作成し、以下の内容を実装します。

```javascript
import jwt from "jsonwebtoken";
import AdminUser from "../models/AdminUser.js";

// 環境変数からJWTシークレットを取得
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

// 認証ミドルウェア
const protect = async (req, res, next) => {
  try {
    let token;

    // Authorization ヘッダーからトークンを取得
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    // トークンが存在しない場合
    if (!token) {
      return res.status(401).json({
        message: "認証が必要です",
      });
    }

    // トークンの検証
    const decoded = jwt.verify(token, JWT_SECRET);

    // ユーザーの取得
    const user = await AdminUser.findById(decoded.id).select("-password");
    if (!user) {
      return res.status(401).json({
        message: "無効なトークンです",
      });
    }

    // アカウントが無効化されていないか確認
    if (!user.isActive) {
      return res.status(401).json({
        message: "アカウントが無効化されています",
      });
    }

    // リクエストオブジェクトにユーザー情報を追加
    req.user = user;
    next();
  } catch (error) {
    console.error("[AuthMiddleware] Error:", error);
    return res.status(401).json({
      message: "認証に失敗しました",
    });
  }
};

// 管理者権限チェックミドルウェア
const admin = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    res.status(403).json({
      message: "管理者権限が必要です",
    });
  }
};

export { protect, admin };
```

### 1.4 ルートの設定

idea-discussion/backend/routes/authRoutes.js ファイルを作成し、以下の内容を実装します。

```javascript
import express from "express";
import { login, getCurrentUser, createAdminUser } from "../controllers/authController.js";
import { protect, admin } from "../middleware/authMiddleware.js";

const router = express.Router();

// 認証ルート
router.post("/login", login);
router.get("/me", protect, getCurrentUser);
router.post("/users", protect, admin, createAdminUser);

export default router;
```

server.js ファイルに新しいルートを追加します。

```javascript
import authRoutes from "./routes/authRoutes.js";

// ...

// ルートの設定
app.use("/api/auth", authRoutes);
```
.env ファイルに以下の環境変数を追加します。

```
JWT_SECRET=your-secure-secret-key
JWT_EXPIRES_IN=1d
PASSWORD_PEPPER=your-secure-pepper-value
```

> **重要**: PASSWORD_PEPPERは非常に安全な場所に保管し、漏洩しないようにしてください。この値が漏洩すると、パスワードセキュリティが大幅に低下します。

## フロントエンド実装

### 2.1 認証コンテキストの作成

admin/src/contexts/AuthContext.tsx ファイルを作成し、以下の内容を実装します。

```tsx
import React, { createContext, useContext, useState, useEffect } from "react";
import { apiClient } from "../services/api/apiClient";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 初期化時にローカルストレージからトークンを取得
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
            // トークンが無効な場合はログアウト
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

  // ログイン処理
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

  // ログアウト処理
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
### 2.2 ログインページの作成

admin/src/pages/Login.tsx ファイルを作成し、以下の内容を実装します。

```tsx
import React, { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import Alert from "../components/ui/Alert";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";

const Login: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // 既にログインしている場合はダッシュボードにリダイレクト
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // 入力検証
    if (!email || !password) {
      setError("メールアドレスとパスワードを入力してください");
      return;
    }

    setIsLoading(true);
    try {
      const success = await login(email, password);
      if (success) {
        navigate("/");
      } else {
        setError("ログインに失敗しました。認証情報を確認してください。");
      }
    } catch (err) {
      setError("ログイン処理中にエラーが発生しました。");
      console.error("Login error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow-md">
        <div className="text-center">
          <h1 className="text-2xl font-bold">管理者ログイン</h1>
          <p className="mt-2 text-gray-600">
            アカウント情報を入力してログインしてください
          </p>
        </div>

        {error && <Alert type="error" message={error} />}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700"
            >
              メールアドレス
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@example.com"
              required
              className="mt-1"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700"
            >
              パスワード
            </label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="パスワード"
              required
### 2.3 保護されたルートの実装

admin/src/components/ProtectedRoute.tsx ファイルを作成し、以下の内容を実装します。

```tsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAdmin = false,
}) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  // 認証状態の読み込み中
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  // 未認証の場合はログインページにリダイレクト
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 管理者権限が必要な場合の確認
  if (requireAdmin && user?.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
```

App.tsx を更新して認証コンテキストとプロテクテッドルートを組み込みます。

```tsx
import React from "react";
import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Header from "./components/layout/Header";
import MainContent from "./components/layout/MainContent";
import Sidebar from "./components/layout/Sidebar";
import Dashboard from "./pages/Dashboard";
import ThemeCreate from "./pages/ThemeCreate";
import ThemeEdit from "./pages/ThemeEdit";
import ThemeList from "./pages/ThemeList";
import Login from "./pages/Login";

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <div className="flex flex-col h-screen">
                  <Header />
                  <div className="flex flex-1 overflow-hidden">
                    <Sidebar />
                    <MainContent>
                      <Routes>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/themes" element={<ThemeList />} />
                        <Route path="/themes/new" element={<ThemeCreate />} />
                        <Route path="/themes/:themeId" element={<ThemeEdit />} />
                      </Routes>
                    </MainContent>
                  </div>
                </div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
### 2.4 APIクライアントの拡張

admin/src/services/api/types.ts に認証関連の型を追加します。

```typescript
// 既存の型定義に追加

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

export interface UserResponse {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

export interface CreateUserPayload {
  email: string;
  password: string;
  name: string;
  role?: string;
}
```

admin/src/services/api/apiClient.ts に認証関連のメソッドを追加します。

```typescript
import { type Result, err, ok } from "neverthrow";
import { ApiError, ApiErrorType } from "./apiError";
import type {
  CreateThemePayload,
  Theme,
  UpdateThemePayload,
  LoginCredentials,
  LoginResponse,
  UserResponse,
  CreateUserPayload,
} from "./types";

export type ApiResult<T> = Result<T, ApiError>;

export class ApiClient {
  private baseUrl: string;
  private authToken: string | null = null;

  constructor() {
    this.baseUrl = `${import.meta.env.VITE_API_BASE_URL}/api`;
    // ローカルストレージからトークンを取得
    this.authToken = localStorage.getItem("auth_token");
  }

  // トークンを設定するメソッド
  setAuthToken(token: string | null) {
    this.authToken = token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResult<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    // 認証トークンがある場合はヘッダーに追加
    if (this.authToken) {
      headers["Authorization"] = `Bearer ${this.authToken}`;
    }

    const config = {
      ...options,
      headers,
    };

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message =
          errorData.message ||
          `API request failed with status ${response.status}`;

        let errorType: ApiErrorType;
        switch (response.status) {
          case 400:
            errorType = ApiErrorType.VALIDATION_ERROR;
            break;
          case 401:
            errorType = ApiErrorType.UNAUTHORIZED;
            break;
          case 403:
            errorType = ApiErrorType.FORBIDDEN;
            break;
          case 404:
            errorType = ApiErrorType.NOT_FOUND;
            break;
          case 500:
          case 502:
          case 503:
            errorType = ApiErrorType.SERVER_ERROR;
            break;
          default:
            errorType = ApiErrorType.UNKNOWN_ERROR;
        }

        return err(new ApiError(errorType, message, response.status));
      }

      const data = await response.json();
      return ok(data);
    } catch (error) {
      return err(
        new ApiError(
          ApiErrorType.NETWORK_ERROR,
          error instanceof Error ? error.message : "Network error occurred"
        )
      );
    }
  }

  // 認証関連のメソッド
  async login(
    email: string,
    password: string
  ): Promise<ApiResult<LoginResponse>> {
    return this.request<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  }

  async getCurrentUser(): Promise<ApiResult<UserResponse>> {
    return this.request<UserResponse>("/auth/me");
  }

  async createUser(
## 拡張性の確保

### 3.1 認証プロバイダーインターフェース

将来的に複数の認証方法に対応するため、認証プロバイダーのインターフェースを定義します。

idea-discussion/backend/services/auth/authProviderInterface.js ファイルを作成します。

```javascript
/**
 * 認証プロバイダーインターフェース
 *
 * このインターフェースは、異なる認証方法（ローカル、Google、GitHub など）を
 * 統一的に扱うためのものです。新しい認証方法を追加する際は、
 * このインターフェースに準拠した実装を行ってください。
 */
class AuthProviderInterface {
  /**
   * ユーザー認証を行います
   * @param {Object} credentials - 認証に必要な情報
   * @returns {Promise<Object>} - 認証されたユーザー情報
   */
  async authenticate(credentials) {
    throw new Error("Method 'authenticate' must be implemented");
  }

  /**
   * 認証プロバイダーの種類を返します
   * @returns {string} - プロバイダーの種類（"local", "google" など）
   */
  getProviderType() {
    throw new Error("Method 'getProviderType' must be implemented");
  }
}

export default AuthProviderInterface;
```

ローカル認証プロバイダーの実装例：

idea-discussion/backend/services/auth/localAuthProvider.js ファイルを作成します。

```javascript
import AuthProviderInterface from "./authProviderInterface.js";
import AdminUser from "../../models/AdminUser.js";

class LocalAuthProvider extends AuthProviderInterface {
  async authenticate(credentials) {
    const { email, password } = credentials;

    if (!email || !password) {
      throw new Error("メールアドレスとパスワードが必要です");
    }

    // ユーザーの検索
    const user = await AdminUser.findOne({ email });
    if (!user) {
      throw new Error("認証情報が無効です");
    }

    // アカウントが無効化されていないか確認
    if (!user.isActive) {
      throw new Error("アカウントが無効化されています");
    }

    // パスワードの検証
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new Error("認証情報が無効です");
    }

    return user;
  }

  getProviderType() {
    return "local";
  }
}

export default LocalAuthProvider;
```

認証サービスの実装：

idea-discussion/backend/services/auth/authService.js ファイルを作成します。

```javascript
import LocalAuthProvider from "./localAuthProvider.js";
import jwt from "jsonwebtoken";

// 環境変数からJWTシークレットを取得
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1d";

class AuthService {
  constructor() {
    this.providers = {
      local: new LocalAuthProvider(),
      // 将来的に他のプロバイダーを追加
    };
  }

  /**
   * 指定された認証プロバイダーを使用してユーザーを認証します
   * @param {string} providerType - 認証プロバイダーの種類
   * @param {Object} credentials - 認証に必要な情報
   * @returns {Promise<Object>} - 認証結果（ユーザー情報とトークン）
   */
  async authenticate(providerType, credentials) {
    const provider = this.providers[providerType];
    if (!provider) {
      throw new Error(`認証プロバイダー '${providerType}' が見つかりません`);
    }

    try {
      const user = await provider.authenticate(credentials);

      // 最終ログイン日時の更新
      user.lastLogin = new Date();
      await user.save();

      // JWTトークンの生成
      const token = this.generateToken(user._id);

      return {
        token,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * JWTトークンを生成します
   * @param {string} userId - ユーザーID
   * @returns {string} - 生成されたJWTトークン
   */
  generateToken(userId) {
    return jwt.sign({ id: userId }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });
  }

  /**
   * 新しい認証プロバイダーを登録します
   * @param {string} providerType - プロバイダーの種類
   * @param {AuthProviderInterface} provider - プロバイダーのインスタンス
   */
  registerProvider(providerType, provider) {
    this.providers[providerType] = provider;
  }
}

// シングルトンインスタンスをエクスポート
export default new AuthService();
```

### 3.2 Google OAuth認証の追加

Google OAuth認証を追加するための手順を示します。

1. 必要なパッケージのインストール

```bash
npm install passport passport-google-oauth20 --save
```

2. Google OAuth認証プロバイダーの実装

idea-discussion/backend/services/auth/googleAuthProvider.js ファイルを作成します。

```javascript
import AuthProviderInterface from "./authProviderInterface.js";
import AdminUser from "../../models/AdminUser.js";

class GoogleAuthProvider extends AuthProviderInterface {
  async authenticate(credentials) {
    const { googleId, email, name, picture } = credentials;

    if (!googleId || !email) {
      throw new Error("Google認証情報が不足しています");
    }

    // 既存のユーザーを検索
    let user = await AdminUser.findOne({
      $or: [
        { email, authProvider: "google" },
        { authProviderId: googleId },
      ],
    });

    // ユーザーが存在しない場合は新規作成
    if (!user) {
      user = new AdminUser({
        email,
        name,
        password: Math.random().toString(36).slice(-8), // ダミーパスワード
        authProvider: "google",
        authProviderId: googleId,
        profileImage: picture,
      });
      await user.save();
    } else {
      // アカウントが無効化されていないか確認
      if (!user.isActive) {
        throw new Error("アカウントが無効化されています");
      }

      // 既存ユーザーの情報を更新
      user.name = name || user.name;
      user.authProviderId = googleId;
      if (picture) user.profileImage = picture;
      await user.save();
    }

    return user;
  }

  getProviderType() {
    return "google";
  }
}

export default GoogleAuthProvider;
```

3. 認証サービスにGoogle認証プロバイダーを登録

idea-discussion/backend/services/auth/authService.js を更新します。

```javascript
import LocalAuthProvider from "./localAuthProvider.js";
import GoogleAuthProvider from "./googleAuthProvider.js";
import jwt from "jsonwebtoken";

// 環境変数からJWTシークレットを取得
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1d";

class AuthService {
  constructor() {
    this.providers = {
      local: new LocalAuthProvider(),
      google: new GoogleAuthProvider(),
    };
  }

  // 以下は既存のコード
}
```

4. Google OAuth用のルートを追加

idea-discussion/backend/routes/authRoutes.js を更新します。

```javascript
import express from "express";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { login, getCurrentUser, createAdminUser } from "../controllers/authController.js";
import { protect, admin } from "../middleware/authMiddleware.js";
import authService from "../services/auth/authService.js";

const router = express.Router();

// Google OAuth設定
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || "http://localhost:3000/api/auth/google/callback";

// Passportの設定
passport.use(
  new GoogleStrategy(
    {
      clientID: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      callbackURL: GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const credentials = {
          googleId: profile.id,
          email: profile.emails[0].value,
          name: profile.displayName,
          picture: profile.photos[0].value,
        };

        const result = await authService.authenticate("google", credentials);
        return done(null, result);
      } catch (error) {
        return done(error, null);
      }
    }
  )
);

// 認証ルート
router.post("/login", login);
router.get("/me", protect, getCurrentUser);
router.post("/users", protect, admin, createAdminUser);

// Google OAuth認証ルート
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
  "/google/callback",
  passport.authenticate("google", { session: false }),
  (req, res) => {
    // 認証成功時の処理
    const { token, user } = req.user;

    // フロントエンドにリダイレクト（トークンをクエリパラメータとして渡す）
    res.redirect(`${process.env.ADMIN_FRONTEND_URL}/oauth-callback?token=${token}`);
  }
);

export default router;
```

5. フロントエンドでのGoogle OAuth対応

admin/src/pages/Login.tsx にGoogle認証ボタンを追加します。

```tsx
// ...既存のコード

const Login: React.FC = () => {
  // ...既存のコード

  const handleGoogleLogin = () => {
    window.location.href = `${import.meta.env.VITE_API_BASE_URL}/api/auth/google`;
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow-md">
        {/* ...既存のコード */}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {/* ...既存のコード */}

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? "ログイン中..." : "ログイン"}
          </Button>
        </form>

        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">または</span>
            </div>
          </div>

          <div className="mt-6">
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <svg
                className="h-5 w-5 mr-2"
                viewBox="0 0 24 24"
                width="24"
                height="24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
                  <path
                    fill="#4285F4"
                    d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z"
                  />
                  <path
                    fill="#34A853"
                    d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z"
                  />
                </g>
              </svg>
              Googleでログイン
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
```

6. OAuth コールバック処理用のページを作成

admin/src/pages/OAuthCallback.tsx ファイルを作成します。

```tsx
import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
## セキュリティ対策

管理者ログイン機能を実装する際には、以下のセキュリティ対策を考慮してください。

### 4.1 パスワードセキュリティ

1. **強力なパスワードポリシーの適用**
   - 最小長（8文字以上）
   - 大文字・小文字・数字・特殊文字の組み合わせ
   - 一般的なパスワードや辞書に載っている単語の使用禁止

2. **パスワードハッシュ化**
   - bcrypt などの安全なハッシュアルゴリズムを使用（実装済み）
   - ソルトの自動生成と適用（bcrypt に組み込み済み）
   - pepperの適用（アプリケーション設定に保存される秘密の値）
   - 二重のセキュリティレイヤー（salt + pepper）による保護

3. **パスワードリセット機能の実装**
   - 安全なトークン生成
   - 有効期限の設定
   - メールによる確認

### 4.2 認証トークンセキュリティ

1. **JWTセキュリティ**
   - 強力な秘密鍵の使用
   - 適切な有効期限の設定
   - 必要最小限の情報のみをペイロードに含める

2. **トークンの安全な保存**
   - フロントエンドではローカルストレージではなく HttpOnly Cookie の使用を検討
   - CSRF 対策の実装

### 4.3 API セキュリティ

1. **レート制限の実装**
   - ブルートフォース攻撃対策として、ログイン試行回数の制限
   - IP アドレスベースのレート制限

2. **CORS 設定**
   - 許可されたオリジンのみからのリクエストを受け付ける

3. **入力検証**
   - すべてのユーザー入力の検証
   - SQLインジェクションやXSS攻撃の防止

### 4.4 監査とログ

1. **ログイン試行の記録**
   - 成功・失敗したログイン試行の記録
   - 不審なアクティビティの検出

2. **管理者アクションのログ記録**
   - 重要な操作（ユーザー作成、権限変更など）のログ記録
   - ログの改ざん防止

## テスト手順

### 5.1 バックエンドテスト

1. **ユーザーモデルのテスト**
   - ユーザー作成のバリデーション
   - パスワードハッシュ化の確認
   - パスワード比較メソッドの動作確認

```javascript
// テスト例: ユーザーモデル
import AdminUser from "../models/AdminUser.js";
import mongoose from "mongoose";
import { expect } from "chai";

describe("AdminUser Model", () => {
  before(async () => {
    // テスト用DBに接続
    await mongoose.connect("mongodb://localhost:27017/test-db");
  });

  after(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  });

  it("should hash password before saving", async () => {
    const plainPassword = "TestPassword123";
    const user = new AdminUser({
      email: "test@example.com",
      password: plainPassword,
      name: "Test User",
    });

    await user.save();
    expect(user.password).to.not.equal(plainPassword);
  });

  it("should correctly compare passwords", async () => {
    const user = await AdminUser.findOne({ email: "test@example.com" });
    const isMatch = await user.comparePassword("TestPassword123");
    expect(isMatch).to.be.true;

    const isNotMatch = await user.comparePassword("WrongPassword");
    expect(isNotMatch).to.be.false;
  });
});
```

2. **認証コントローラーのテスト**
   - ログイン機能のテスト
   - 現在のユーザー情報取得のテスト
   - ユーザー作成機能のテスト

```javascript
// テスト例: 認証コントローラー
import { expect } from "chai";
import sinon from "sinon";
import { login, getCurrentUser, createAdminUser } from "../controllers/authController.js";
import AdminUser from "../models/AdminUser.js";

describe("Auth Controller", () => {
  let req, res, statusStub, jsonStub;

  beforeEach(() => {
    statusStub = sinon.stub();
    jsonStub = sinon.stub();
    res = {
      status: statusStub,
      json: jsonStub,
    };
    statusStub.returns(res);
  });

  describe("login", () => {
    it("should return 400 if email or password is missing", async () => {
      req = { body: {} };
      await login(req, res);
      expect(statusStub.calledWith(400)).to.be.true;
    });

    it("should return 401 if user not found", async () => {
      req = { body: { email: "nonexistent@example.com", password: "password" } };
      sinon.stub(AdminUser, "findOne").resolves(null);
      await login(req, res);
      expect(statusStub.calledWith(401)).to.be.true;
      AdminUser.findOne.restore();
    });

    // 他のテストケース...
  });
});
```

3. **認証ミドルウェアのテスト**
   - トークン検証のテスト
   - 権限チェックのテスト

```javascript
// テスト例: 認証ミドルウェア
import { expect } from "chai";
import sinon from "sinon";
import jwt from "jsonwebtoken";
import { protect, admin } from "../middleware/authMiddleware.js";
import AdminUser from "../models/AdminUser.js";

describe("Auth Middleware", () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      headers: {},
    };
    res = {
      status: sinon.stub().returnsThis(),
      json: sinon.stub(),
    };
    next = sinon.stub();
  });

  describe("protect", () => {
    it("should return 401 if no token is provided", async () => {
      await protect(req, res, next);
      expect(res.status.calledWith(401)).to.be.true;
      expect(next.called).to.be.false;
    });

    // 他のテストケース...
  });
});
```

### 5.2 フロントエンドテスト

1. **認証コンテキストのテスト**
   - 初期状態のテスト
   - ログイン・ログアウト機能のテスト
   - トークン保存のテスト

```tsx
// テスト例: 認証コンテキスト
import { render, act, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "../contexts/AuthContext";
import { apiClient } from "../services/api/apiClient";
import { ok } from "neverthrow";
import { vi, describe, it, expect, beforeEach } from "vitest";

// モックの設定
vi.mock("../services/api/apiClient", () => ({
  apiClient: {
    getCurrentUser: vi.fn(),
    login: vi.fn(),
  },
}));

const TestComponent = () => {
  const auth = useAuth();
  return (
    <div>
      <div data-testid="loading">{auth.isLoading.toString()}</div>
      <div data-testid="authenticated">{auth.isAuthenticated.toString()}</div>
      <button onClick={() => auth.login("test@example.com", "password")}>
        Login
      </button>
      <button onClick={auth.logout}>Logout</button>
    </div>
  );
};

describe("AuthContext", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetAllMocks();
  });

  it("should initialize with not authenticated state", async () => {
    apiClient.getCurrentUser.mockResolvedValue(ok({ user: null }));

    const { getByTestId } = render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(getByTestId("loading").textContent).toBe("false");
      expect(getByTestId("authenticated").textContent).toBe("false");
    });
  });

  // 他のテストケース...
});
```

2. **ログインページのテスト**
   - フォーム入力のテスト
   - バリデーションのテスト
   - ログイン処理のテスト

```tsx
// テスト例: ログインページ
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "../contexts/AuthContext";
import Login from "../pages/Login";
import { vi, describe, it, expect, beforeEach } from "vitest";

// AuthContextのモック
vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    login: vi.fn().mockImplementation((email, password) => {
      if (email === "valid@example.com" && password === "password") {
        return Promise.resolve(true);
      }
      return Promise.resolve(false);
    }),
    isAuthenticated: false,
  }),
  AuthProvider: ({ children }) => <div>{children}</div>,
}));

// useNavigateのモック
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("Login Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render login form", () => {
    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );

    expect(screen.getByLabelText(/メールアドレス/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/パスワード/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ログイン/i })).toBeInTheDocument();
  });

  // 他のテストケース...
});
```

3. **保護されたルートのテスト**
   - 認証状態に基づくリダイレクトのテスト
   - 権限チェックのテスト

```tsx
// テスト例: 保護されたルート
import { render, screen } from "@testing-library/react";
import { BrowserRouter, MemoryRouter } from "react-router-dom";
import ProtectedRoute from "../components/ProtectedRoute";
import { vi, describe, it, expect } from "vitest";

// AuthContextのモック
vi.mock("../contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

// useLocationのモック
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useLocation: () => ({ pathname: "/protected" }),
  };
});

import { useAuth } from "../contexts/AuthContext";

describe("ProtectedRoute", () => {
  it("should show loading state when isLoading is true", () => {
    (useAuth as any).mockReturnValue({
      isLoading: true,
      isAuthenticated: false,
      user: null,
    });

    render(
      <BrowserRouter>
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      </BrowserRouter>
    );

    expect(screen.getByText(/読み込み中/i)).toBeInTheDocument();
    expect(screen.queryByText(/Protected Content/i)).not.toBeInTheDocument();
  });

  // 他のテストケース...
});
```

### 5.3 統合テスト

1. **ログインフロー全体のテスト**
   - バックエンドとフロントエンドの連携テスト
   - 実際のAPIリクエストとレスポンスのテスト

2. **認証が必要なAPIエンドポイントのテスト**
   - 認証トークンを使用したAPIリクエストのテスト
   - 権限に基づくアクセス制御のテスト

### 5.4 手動テスト手順

1. **ローカル認証のテスト**
   - 管理者ユーザーの作成
   ```bash
   curl -X POST http://localhost:3000/api/auth/users \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer <admin-token>" \
     -d '{"email":"admin@example.com","password":"SecurePassword123","name":"Admin User","role":"admin"}'
   ```

   - ログイン
   ```bash
   curl -X POST http://localhost:3000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@example.com","password":"SecurePassword123"}'
   ```

   - 現在のユーザー情報の取得
   ```bash
   curl -X GET http://localhost:3000/api/auth/me \
     -H "Authorization: Bearer <your-token>"
   ```

2. **Google OAuth認証のテスト**
   - ブラウザで http://localhost:5173/login にアクセス
   - 「Googleでログイン」ボタンをクリック
   - Googleアカウントでログイン
   - 管理画面にリダイレクトされることを確認

3. **保護されたルートのテスト**
   - ログアウト状態で http://localhost:5173/themes にアクセス
   - ログインページにリダイレクトされることを確認
   - ログイン後、正常にアクセスできることを確認

4. **権限チェックのテスト**
   - 編集者権限のユーザーで管理者専用機能にアクセス
   - アクセスが拒否されることを確認
import { useAuth } from "../contexts/AuthContext";

const OAuthCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    const token = searchParams.get("token");

    if (token) {
      // トークンをローカルストレージに保存
      localStorage.setItem("auth_token", token);

      // ページをリロードして認証コンテキストを更新
      window.location.href = "/";
    } else {
      setError("認証トークンが見つかりません");
    }
  }, [searchParams]);

  // 既に認証済みの場合はダッシュボードにリダイレクト
  if (isAuthenticated) {
    navigate("/");
    return null;
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow-md text-center">
        {error ? (
          <>
            <div className="text-red-500 mb-4">{error}</div>
            <button
              onClick={() => navigate("/login")}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              ログインページに戻る
            </button>
          </>
        ) : (
          <>
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="mt-4 text-gray-600">認証中...</p>
          </>
        )}
      </div>
    </div>
  );
};

export default OAuthCallback;
```

7. App.tsx にOAuthCallbackルートを追加

```tsx
import React from "react";
import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Header from "./components/layout/Header";
import MainContent from "./components/layout/MainContent";
import Sidebar from "./components/layout/Sidebar";
import Dashboard from "./pages/Dashboard";
import ThemeCreate from "./pages/ThemeCreate";
import ThemeEdit from "./pages/ThemeEdit";
import ThemeList from "./pages/ThemeList";
import Login from "./pages/Login";
import OAuthCallback from "./pages/OAuthCallback";

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/oauth-callback" element={<OAuthCallback />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                {/* 既存のコード */}
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;
```

8. 環境変数の追加

.env ファイルに以下の環境変数を追加します。

```
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback
ADMIN_FRONTEND_URL=http://localhost:5173
```
    userData: CreateUserPayload
  ): Promise<ApiResult<UserResponse>> {
    return this.request<UserResponse>("/auth/users", {
      method: "POST",
      body: JSON.stringify(userData),
    });
  }

  // 既存のテーマ関連メソッド
  async getAllThemes(): Promise<ApiResult<Theme[]>> {
    return this.request<Theme[]>("/themes");
  }

  async getThemeById(id: string): Promise<ApiResult<Theme>> {
    return this.request<Theme>(`/themes/${id}`);
  }

  async createTheme(theme: CreateThemePayload): Promise<ApiResult<Theme>> {
    return this.request<Theme>("/themes", {
      method: "POST",
      body: JSON.stringify(theme),
    });
  }

  async updateTheme(
    id: string,
    theme: UpdateThemePayload
  ): Promise<ApiResult<Theme>> {
    return this.request<Theme>(`/themes/${id}`, {
      method: "PUT",
      body: JSON.stringify(theme),
    });
  }

  async deleteTheme(id: string): Promise<ApiResult<{ message: string }>> {
    return this.request<{ message: string }>(`/themes/${id}`, {
      method: "DELETE",
    });
  }
}

export const apiClient = new ApiClient();
```
};

export default App;
```
              className="mt-1"
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? "ログイン中..." : "ログイン"}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default Login;
```
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
```

.env ファイルに以下の環境変数を追加します。

```
JWT_SECRET=your-secure-secret-key
JWT_EXPIRES_IN=1d
```

    await newUser.save();

    res.status(201).json({
      message: "管理者ユーザーが正常に作成されました",
      user: {
        id: newUser._id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
      },
    });
  } catch (error) {
    console.error("[AuthController] Create admin user error:", error);
    res.status(500).json({ message: "サーバーエラーが発生しました" });
  }
};

export { login, getCurrentUser, createAdminUser };
````

// パスワード検証メソッド
adminUserSchema.methods.comparePassword = async function (candidatePassword) {
return bcrypt.compare(candidatePassword, this.password);
};

const AdminUser = mongoose.model("AdminUser", adminUserSchema);

export default AdminUser;

```

```
