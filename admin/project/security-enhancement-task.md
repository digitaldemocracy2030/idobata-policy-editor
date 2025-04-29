# HttpOnly Cookie 認証と CSRF 保護の実装計画

## 現状の問題点

現在の admin ページのログイン機構には以下のセキュリティ上の問題があります：

1. **JWT トークンが localStorage に保存されている**

   - XSS（クロスサイトスクリプティング）攻撃に対して脆弱
   - JavaScript からアクセス可能なため、攻撃者がトークンを盗むことが可能

2. **CSRF 保護の欠如**

   - クロスサイトリクエストフォージェリ攻撃に対して脆弱
   - 認証済みユーザーの権限で悪意のあるリクエストが実行される可能性

3. **その他のセキュリティリスク**
   - レート制限の欠如（ブルートフォース攻撃に脆弱）
   - 多要素認証の欠如
   - トークン無効化メカニズムの欠如

## 改善策：HttpOnly Cookie 認証と CSRF 保護

### ライブラリの選択

#### バックエンド（Node.js/Express）

1. **Cookie 管理**

   - **cookie-parser**: Express でクッキーを解析するための標準ライブラリ
   - **express-session**: セッション管理のための包括的なソリューション（より高度な機能が必要な場合）

2. **CSRF 保護**

   - **csrf-csrf**: 柔軟で設定可能な CSRF 保護ライブラリ（二重送信クッキーパターン）

3. **認証管理**
   - **jsonwebtoken**: JWT の生成と検証のためのライブラリ（現在使用中）

## 実装計画

### 1. バックエンドの実装

#### a. 必要なライブラリのインストール

```bash
npm install cookie-parser csrf-csrf
```

#### b. サーバー設定（server.js）

```javascript
import express from "express";
import cookieParser from "cookie-parser";
import { doubleCsrf } from "csrf-csrf";
import cors from "cors";

const app = express();

// ミドルウェアの設定
app.use(express.json());
app.use(cookieParser(process.env.COOKIE_SECRET)); // クッキーの署名に使用する秘密鍵

// CORS設定（開発環境と本番環境で分ける）
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? "https://yourdomain.com"
        : "http://localhost:5173",
    credentials: true, // クッキーを許可
  })
);

// CSRF保護の設定
const { generateToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET,
  cookieName: "csrf_token",
  cookieOptions: {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  },
  size: 64, // トークンのサイズ
  ignoredMethods: ["GET", "HEAD", "OPTIONS"],
});

// CSRFトークン取得エンドポイント
app.get("/api/auth/csrf-token", (req, res) => {
  res.json({ csrfToken: generateToken(req, res) });
});

// CSRF保護を適用するルート
app.use("/api/auth", doubleCsrfProtection, authRoutes);

// その他のルート設定
// ...

export default app;
```

#### c. 認証コントローラーの修正（authController.js）

```javascript
import jwt from "jsonwebtoken";
import AdminUser from "../models/AdminUser.js";
import authService from "../services/auth/authService.js";

// ログイン処理
const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({
        message: "メールアドレスとパスワードを入力してください",
      });
    }

    try {
      const { user, token } = await authService.authenticate("local", {
        email,
        password,
      });

      // JWTをHttpOnly Cookieとして設定
      res.cookie("auth_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
        maxAge: parseInt(process.env.JWT_EXPIRES_IN || "86400") * 1000, // ミリ秒に変換
        path: "/",
      });

      // ユーザー情報のみを返す（トークンはCookieに設定済み）
      res.json({
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      });
    } catch (error) {
      console.error("[AuthController] Authentication error:", error);
      return res.status(401).json({ message: "認証に失敗しました" });
    }
  } catch (error) {
    console.error("[AuthController] Login error:", error);
    res.status(500).json({ message: "サーバーエラーが発生しました" });
  }
};

// ログアウト処理
const logout = (req, res) => {
  res.cookie("auth_token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    expires: new Date(0),
    path: "/",
  });

  res.json({ message: "ログアウトしました" });
};

// 現在のユーザー情報取得
const getCurrentUser = async (req, res) => {
  // 既存の実装と同じ
};

// 他のメソッドも同様に実装

export { login, logout, getCurrentUser, createAdminUser, initializeAdminUser };
```

#### d. 認証ミドルウェアの修正（authMiddleware.js）

```javascript
import AdminUser from "../models/AdminUser.js";
import authService from "../services/auth/authService.js";

export const protect = async (req, res, next) => {
  try {
    // Cookieからトークンを取得
    const token = req.cookies.auth_token;

    if (!token) {
      return res.status(401).json({ message: "認証が必要です" });
    }

    try {
      const decoded = authService.verifyToken(token);

      const user = await AdminUser.findById(decoded.id);

      if (!user) {
        return res.status(401).json({ message: "ユーザーが見つかりません" });
      }

      req.user = {
        id: user._id,
        email: user.email,
        role: user.role,
      };

      next();
    } catch (error) {
      return res.status(401).json({ message: "トークンが無効です" });
    }
  } catch (error) {
    console.error("[AuthMiddleware] Protect error:", error);
    res.status(500).json({ message: "サーバーエラーが発生しました" });
  }
};

export const admin = (req, res, next) => {
  // 既存の実装と同じ
};
```

### 2. フロントエンドの実装

#### a. フロントエンド設定

#### b. API クライアントの修正

フロントエンドの API クライアントを修正して、以下の変更を行います：

1. **Cookie の送受信を有効にする**

   - リクエスト時に`credentials: 'include'`を設定し、Cookie を自動的に送信
   - これにより、HttpOnly Cookie に保存された認証トークンがリクエストに含まれる

2. **CSRF トークンの管理**

   - CSRF トークンを取得するメソッドを追加
   - 状態変更を伴うリクエスト（POST、PUT、DELETE など）に CSRF トークンを含める
   - 401 エラー時に CSRF トークンを再取得する仕組み

3. **localStorage の使用を削除**
   - トークンの保存と取得に localStorage を使用しない

#### c. 認証コンテキストの修正

認証コンテキスト（AuthContext.tsx）を修正して、以下の変更を行います：

1. **localStorage の使用を削除**

   - トークンの保存と取得に localStorage を使用しない
   - 認証状態はユーザー情報のみで管理

2. **ログアウト機能の追加**

   - サーバーサイドのログアウトエンドポイントを呼び出す
   - サーバー側で Cookie を削除する

3. **初期認証チェックの修正**
   - アプリケーション起動時に Cookie ベースの認証状態を確認

## この実装のメリット

1. **セキュリティの向上**:

   - HttpOnly Cookie によるトークン保存で XSS 攻撃からの保護
   - 二重送信クッキーパターンによる強力な CSRF 保護
   - SameSite 属性によるクロスサイトリクエスト制限

2. **保守性の向上**:

   - 明確な責任分離
   - モジュール化された設計
   - 標準的なライブラリの使用

3. **拡張性**:
   - 将来的な認証方法の追加が容易（OAuth、多要素認証など）
   - 異なる環境（開発/本番）での適切な設定

## 注意点

1. **環境変数の設定**:

   - `COOKIE_SECRET`: クッキーの署名に使用する秘密鍵
   - `CSRF_SECRET`: CSRF トークン生成に使用する秘密鍵
   - `JWT_SECRET`: JWT 署名に使用する秘密鍵
   - `JWT_EXPIRES_IN`: JWT の有効期限（秒）

2. **クロスドメイン設定**:

   - フロントエンドとバックエンドが異なるドメインの場合、CORS 設定が重要
   - 開発環境と本番環境で適切な設定が必要

3. **移行戦略**:
   - 既存のユーザーセッションを考慮した段階的な移行計画が必要

## 将来的な拡張

1. **多要素認証（2FA）の導入**:

   - TOTP（Time-based One-Time Password）の実装
   - SMS/メールによるワンタイムコード

2. **レート制限の実装**:

   - ログイン試行回数の制限
   - IP ベースのレート制限

3. **セッション管理の強化**:

   - アクティブセッションの一覧表示と管理
   - 不審なログインの検出と通知

4. **パスワードポリシーの強化**:
   - 強力なパスワード要件の設定
   - 定期的なパスワード変更の促進
   - パスワード漏洩チェック（Have I Been Pwned API との連携）
