# サイト設定機能実装計画

この計画では、ホスティング者がサイト名を自由に変更できる機能を実装します。

## 概要

現在、サイト名は `frontend/src/components/layout/Header.tsx` に "XX 党 みんなの政策フォーラム" としてハードコードされています。この機能では、管理者がサイト名やその他の設定を変更できるようにします。

## 実装内容

### 1. バックエンド実装

#### 1.1 SiteConfig モデルの作成

`idea-discussion/backend/models/SiteConfig.js` に新しいモデルを作成します。

```javascript
import mongoose from "mongoose";

const siteConfigSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    aboutMessage: {
      type: String,
      required: false,
    },
  },
  { timestamps: true }
);

const SiteConfig = mongoose.model("SiteConfig", siteConfigSchema);

export default SiteConfig;
```

#### 1.2 SiteConfig コントローラーの作成

`idea-discussion/backend/controllers/siteConfigController.js` に新しいコントローラーを作成します。

```javascript
import SiteConfig from "../models/SiteConfig.js";

// Get site configuration
export const getSiteConfig = async (req, res) => {
  try {
    // Always return the first (and only) site config
    let siteConfig = await SiteConfig.findOne();

    // If no config exists, create a default one
    if (!siteConfig) {
      siteConfig = await SiteConfig.create({
        title: "XX党 みんなの政策フォーラム",
        aboutMessage:
          "# このサイトについて\n\nこちらは政策フォーラムのサイトです。",
      });
    }

    res.status(200).json(siteConfig);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update site configuration
export const updateSiteConfig = async (req, res) => {
  try {
    const { title, aboutMessage } = req.body;

    // Find the first config or create a new one if it doesn't exist
    let siteConfig = await SiteConfig.findOne();

    if (siteConfig) {
      // Update existing config
      siteConfig.title = title;
      siteConfig.aboutMessage = aboutMessage;
      await siteConfig.save();
    } else {
      // Create new config
      siteConfig = await SiteConfig.create({
        title,
        aboutMessage,
      });
    }

    res.status(200).json(siteConfig);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
```

#### 1.3 SiteConfig ルートの作成

`idea-discussion/backend/routes/siteConfigRoutes.js` に新しいルートを作成します。

```javascript
import express from "express";
import {
  getSiteConfig,
  updateSiteConfig,
} from "../controllers/siteConfigController.js";
import { protect, admin } from "../middleware/authMiddleware.js";

const router = express.Router();

// Public route to get site configuration
router.get("/", getSiteConfig);

// Admin route to update site configuration
router.put("/", protect, admin, updateSiteConfig);

export default router;
```

#### 1.4 server.js にルートを登録

`idea-discussion/backend/server.js` にルートを登録します。

```javascript
import siteConfigRoutes from "./routes/siteConfigRoutes.js";

// Site configuration routes
app.use("/api/site-config", siteConfigRoutes);
```

### 2. 管理画面実装

#### 2.1 API クライアントの更新

`admin/src/services/api/types.ts` に新しい型を追加します。

```typescript
export interface SiteConfig {
  _id: string;
  title: string;
  aboutMessage: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface UpdateSiteConfigPayload {
  title: string;
  aboutMessage: string;
}
```

`admin/src/services/api/apiClient.ts` に新しいメソッドを追加します。neverthrow を使用して結果を返します。

```typescript
async getSiteConfig(): Promise<ApiResult<SiteConfig>> {
  return this.request<SiteConfig>("/site-config");
}

async updateSiteConfig(
  config: UpdateSiteConfigPayload
): Promise<ApiResult<SiteConfig>> {
  return this.request<SiteConfig>("/site-config", {
    method: "PUT",
    body: JSON.stringify(config),
  });
}
```

#### 2.2 SiteConfig フォームコンポーネントの作成

`admin/src/components/siteConfig/SiteConfigForm.tsx` を作成します。

```tsx
import React, { useState, useEffect } from "react";
import type { ChangeEvent, FC, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../../services/api/apiClient";
import { ApiErrorType } from "../../services/api/apiError";
import type {
  SiteConfig,
  UpdateSiteConfigPayload,
} from "../../services/api/types";
import Button from "../ui/Button";
import Input from "../ui/Input";

interface SiteConfigFormProps {
  siteConfig?: SiteConfig;
}

const SiteConfigForm: FC<SiteConfigFormProps> = ({ siteConfig }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<UpdateSiteConfigPayload>({
    title: "",
    aboutMessage: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (siteConfig) {
      setFormData({
        title: siteConfig.title,
        aboutMessage: siteConfig.aboutMessage || "",
      });
    }
  }, [siteConfig]);

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title) {
      newErrors.title = "サイト名は必須です";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);

    const result = await apiClient.updateSiteConfig(formData);

    result.match(
      () => {
        navigate("/dashboard");
      },
      (error) => {
        console.error("Form submission error:", error);

        if (error.type === ApiErrorType.VALIDATION_ERROR) {
          setErrors({ form: error.message });
        } else {
          alert(`エラーが発生しました: ${error.message}`);
        }
      }
    );

    setIsSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl">
      {errors.form && (
        <div className="bg-red-100 text-red-700 p-4 rounded mb-4">
          {errors.form}
        </div>
      )}

      <Input
        label="サイト名"
        name="title"
        value={formData.title}
        onChange={handleChange}
        error={errors.title}
        required
      />

      <div className="mb-4">
        <label
          htmlFor="aboutMessage"
          className="block text-gray-700 font-medium mb-2"
        >
          サイト説明（マークダウン形式）
        </label>
        <textarea
          id="aboutMessage"
          name="aboutMessage"
          value={formData.aboutMessage}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={10}
        />
        <p className="text-sm text-gray-500 mt-1">
          マークダウン形式で入力できます。
        </p>
      </div>

      <div className="flex space-x-4">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "送信中..." : "更新"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => navigate("/dashboard")}
        >
          キャンセル
        </Button>
      </div>
    </form>
  );
};

export default SiteConfigForm;
```

#### 2.3 SiteConfig 編集ページの作成

`admin/src/pages/SiteConfigEdit.tsx` を作成します。

```tsx
import React from "react";
import { useEffect, useState } from "react";
import type { FC } from "react";
import { useNavigate } from "react-router-dom";
import SiteConfigForm from "../components/siteConfig/SiteConfigForm";
import { apiClient } from "../services/api/apiClient";
import type { SiteConfig } from "../services/api/types";

const SiteConfigEdit: FC = () => {
  const navigate = useNavigate();
  const [siteConfig, setSiteConfig] = useState<SiteConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSiteConfig = async () => {
      setLoading(true);
      const result = await apiClient.getSiteConfig();

      result.match(
        (data) => {
          setSiteConfig(data);
          setError(null);
        },
        (error) => {
          console.error(`Failed to fetch site config:`, error);
          setError("サイト設定の取得に失敗しました。");
        }
      );

      setLoading(false);
    };

    fetchSiteConfig();
  }, []);

  if (loading) {
    return <div className="text-center py-4">読み込み中...</div>;
  }

  if (error) {
    return (
      <div className="bg-red-100 text-red-700 p-4 rounded mb-4">{error}</div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">サイト設定</h1>
      <SiteConfigForm siteConfig={siteConfig || undefined} />
    </div>
  );
};

export default SiteConfigEdit;
```

#### 2.4 ルーティングの更新

`admin/src/App.tsx` にルートを追加します。

```tsx
import SiteConfigEdit from "./pages/SiteConfigEdit";

// ...

<Route
  path="/siteConfig/edit"
  element={
    <ProtectedRoute>
      <SiteConfigEdit />
    </ProtectedRoute>
  }
/>;
```

#### 2.5 サイドバーにリンクを追加

`admin/src/components/layout/Sidebar.tsx` にサイト設定へのリンクを追加します。

```tsx
<li>
  <Link
    to="/siteConfig/edit"
    className="block py-2 px-4 text-gray-700 hover:bg-gray-100 rounded"
  >
    サイト設定
  </Link>
</li>
```

### 3. フロントエンド実装

#### 3.1 API クライアントの更新

`frontend/src/services/api/apiClient.ts` に新しいメソッドを追加します。neverthrow を使用して結果を返します。

```typescript
import { type Result, err, ok } from "neverthrow";

// ...

async getSiteConfig(): Promise<ApiResult<SiteConfig>> {
  return this.request<SiteConfig>("/site-config");
}
```

#### 3.2 SiteConfig コンテキストの作成

`frontend/src/contexts/SiteConfigContext.tsx` を作成します。

```tsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { apiClient } from "../services/api/apiClient";

interface SiteConfig {
  _id: string;
  title: string;
  aboutMessage: string;
}

interface SiteConfigContextType {
  siteConfig: SiteConfig | null;
  loading: boolean;
  error: string | null;
}

const SiteConfigContext = createContext<SiteConfigContextType>({
  siteConfig: null,
  loading: true,
  error: null,
});

export const useSiteConfig = () => useContext(SiteConfigContext);

export const SiteConfigProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [siteConfig, setSiteConfig] = useState<SiteConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSiteConfig = async () => {
      const result = await apiClient.getSiteConfig();

      result.match(
        (data) => {
          setSiteConfig(data);
          setError(null);
        },
        (error) => {
          console.error("Failed to fetch site config:", error);
          setError("サイト設定の取得に失敗しました");
          // Set default title if API fails
          setSiteConfig({
            _id: "default",
            title: "XX党 みんなの政策フォーラム",
            aboutMessage: "",
          });
        }
      );

      setLoading(false);
    };

    fetchSiteConfig();
  }, []);

  return (
    <SiteConfigContext.Provider value={{ siteConfig, loading, error }}>
      {children}
    </SiteConfigContext.Provider>
  );
};
```

#### 3.3 メインアプリにプロバイダーを追加

`frontend/src/main.tsx` にプロバイダーを追加します。

```tsx
import { SiteConfigProvider } from "./contexts/SiteConfigContext";

// ...

<SiteConfigProvider>
  {/* 他のプロバイダーやコンポーネント */}
</SiteConfigProvider>;
```

#### 3.4 Header.tsx の更新

`frontend/src/components/layout/Header.tsx` を更新して、動的なサイト名を使用するようにします。

```tsx
import { useSiteConfig } from "../../contexts/SiteConfigContext";

// ...

const Header = () => {
  const { siteConfig } = useSiteConfig();
  const { themes, isLoading, error } = useThemes();

  // ...

  {
    /* サイトタイトル（中央） */
  }
  <Link to="/top">
    <h1 className="text-base font-semibold text-center">
      {siteConfig?.title || "XX党 みんなの政策フォーラム"}
    </h1>
  </Link>;

  // ...
};
```

## 実装手順

1. バックエンド実装

   - SiteConfig モデルの作成
   - SiteConfig コントローラーの作成
   - SiteConfig ルートの作成
   - server.js にルートを登録

2. 管理画面実装

   - API クライアントの更新
   - SiteConfig フォームコンポーネントの作成
   - SiteConfig 編集ページの作成
   - ルーティングの更新
   - サイドバーにリンクを追加

3. フロントエンド実装
   - API クライアントの更新
   - SiteConfig コンテキストの作成
   - メインアプリにプロバイダーを追加
   - Header.tsx の更新

## テスト手順

1. バックエンドの動作確認

   - API エンドポイントが正しく動作するか確認
   - デフォルト設定が正しく作成されるか確認

2. 管理画面の動作確認

   - サイト設定ページにアクセスできるか確認
   - フォームが正しく表示されるか確認
   - 設定の更新が正しく行われるか確認

3. フロントエンドの動作確認
   - ヘッダーに設定したサイト名が表示されるか確認
   - 設定を変更した後、フロントエンドに反映されるか確認

## 注意点

- SiteConfig は単一のレコードのみを持つモデルとして実装します
- 初回アクセス時にデフォルト設定が自動的に作成されるようにします
- フロントエンドで API 取得に失敗した場合のフォールバック処理を実装します
- admin と frontend の両方の apiClient で neverthrow を使用して結果を返します

この実装により、サイト管理者はサイト名を自由に変更できるようになります。将来的には、ロゴやテーマカラーなどの追加設定も同様の方法で実装できます。
