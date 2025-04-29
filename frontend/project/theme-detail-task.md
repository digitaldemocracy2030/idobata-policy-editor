# テーマ詳細データ取得実装計画

このドキュメントでは、ThemeDetail.tsx ページのためのデータベースからのデータ取得を実装するための段階的なプロセスを概説します。

## 現状分析

ThemeDetail.tsx ページは現在、以下のハードコードされたデータを使用しています：

- テーマの詳細（タイトル、説明）
- キークエスチョン
- 課題点（問題）
- 解決策

このページには既に以下の API クライアント統合があります：

- メッセージの送信
- スレッド抽出の取得

## 利用可能なリソース

コードベースには既に以下のものがあります：

- テーマ、問題、解決策、質問を取得するためのメソッドを持つ`ApiClient`
- すべてのテーマと ID によるテーマを取得するためのメソッドを持つ`ThemeService`
- すべてのテーマを取得するための`useThemes`フック

## 実装計画

### 1. 単一テーマを取得するためのカスタムフックの作成

ID によって単一のテーマを取得する`useTheme`という新しいフックを作成します：

```typescript
// frontend/src/hooks/useTheme.ts
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
```

### 2. 問題、解決策、質問のためのカスタムフックの作成

#### 2.1 キークエスチョンを取得するためのフックの作成

```typescript
// frontend/src/hooks/useThemeQuestions.ts
import { useEffect, useState } from "react";
import { apiClient } from "../services/api/apiClient";
import { ApiError } from "../services/api/apiError";
import type { Question } from "../types";

interface UseThemeQuestionsResult {
  questions: Question[];
  loading: boolean;
  error: ApiError | null;
  refetch: () => Promise<void>;
}

export function useThemeQuestions(themeId: string): UseThemeQuestionsResult {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchQuestions = async () => {
    if (!themeId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await apiClient.getQuestionsByTheme(themeId);

      if (result.isErr()) {
        setError(result.error);
        return;
      }

      setQuestions(result.value);
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, [themeId]);

  return { questions, loading, error, refetch: fetchQuestions };
}
```

#### 2.2 問題を取得するためのフックの作成

```typescript
// frontend/src/hooks/useThemeProblems.ts
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
```

#### 2.3 解決策を取得するためのフックの作成

```typescript
// frontend/src/hooks/useThemeSolutions.ts
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
```

### 3. ThemeDetail コンポーネントの更新

ThemeDetail.tsx ファイルを新しいフックを使用するように変更します：

```typescript
// frontend/src/pages/ThemeDetail.tsx (部分的な更新)
import { useTheme } from "../hooks/useTheme";
import { useThemeQuestions } from "../hooks/useThemeQuestions";
import { useThemeProblems } from "../hooks/useThemeProblems";
import { useThemeSolutions } from "../hooks/useThemeSolutions";

const ThemeDetail = () => {
  const { themeId } = useParams<{ themeId: string }>();

  // カスタムフックを使用
  const {
    theme,
    loading: themeLoading,
    error: themeError,
  } = useTheme(themeId || "");
  const {
    questions: keyQuestions,
    loading: questionsLoading,
    error: questionsError,
  } = useThemeQuestions(themeId || "");
  const {
    problems: issues,
    loading: issuesLoading,
    error: issuesError,
  } = useThemeProblems(themeId || "");
  const {
    solutions,
    loading: solutionsLoading,
    error: solutionsError,
  } = useThemeSolutions(themeId || "");

  // コンポーネントの残りの部分...
};
```

### 4. 読み込み状態とエラー状態の処理

ThemeDetail コンポーネントに読み込み状態とエラー処理を追加します：

```typescript
// frontend/src/pages/ThemeDetail.tsx (部分的な更新)
// ...

// 全体的な読み込み状態を判断
const isLoading =
  themeLoading || questionsLoading || issuesLoading || solutionsLoading;

// エラーを結合
const errors = [themeError, questionsError, issuesError, solutionsError].filter(
  Boolean
);

// 読み込み状態の早期リターン
if (isLoading) {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-center items-center h-64">
        <p className="text-lg text-gray-600">テーマデータを読み込み中...</p>
      </div>
    </div>
  );
}

// エラー状態の早期リターン
if (errors.length > 0) {
  return (
    <div className="container mx-auto px-4 py-8">
      <div
        className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative"
        role="alert"
      >
        <strong className="font-bold">エラー:</strong>
        <span className="block sm:inline">
          {" "}
          テーマデータの読み込みに失敗しました。後でもう一度お試しください。
        </span>
      </div>
    </div>
  );
}

// テーマが見つからない場合
if (!theme) {
  return (
    <div className="container mx-auto px-4 py-8">
      <div
        className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded relative"
        role="alert"
      >
        <strong className="font-bold">見つかりません:</strong>
        <span className="block sm:inline">
          {" "}
          要求されたテーマが見つかりませんでした。
        </span>
      </div>
    </div>
  );
}

// ...
```

### 5. 取得したデータを表示するための UI の更新

ハードコードされたデータを取得したデータに置き換えます：

```typescript
// frontend/src/pages/ThemeDetail.tsx (部分的な更新)
// ...

// ハードコードされたパンくずデータを置き換え
const breadcrumbItems = [
  { label: "TOP", href: "/" },
  { label: "テーマ一覧", href: "/themes" },
  { label: theme.title, href: `/themes/${themeId}` },
];

return (
  <div className="container mx-auto px-4 py-8">
    <BreadcrumbView items={breadcrumbItems} />

    <h1 className="text-2xl md:text-3xl font-bold mb-4">{theme.title}</h1>

    <p className="text-sm text-neutral-600 mb-8">{theme.description || ""}</p>

    <div className="mb-8">
      <h2 className="text-xl font-semibold mb-4">
        キークエスチョン ({keyQuestions.length})
      </h2>
      <div className="space-y-4">
        {keyQuestions.map((question) => (
          <KeyQuestionCard
            key={question._id}
            question={question.questionText}
            voteCount={0} // APIで利用可能な場合は投票数を追加
            issueCount={0} // APIで利用可能な場合は課題数を追加
            solutionCount={0} // APIで利用可能な場合は解決策数を追加
          />
        ))}
      </div>
    </div>

    <div className="mb-12">
      <h2 className="text-xl font-semibold mb-4">寄せられた意見</h2>

      <div className="flex border-b border-neutral-200 mb-4">
        <button
          className={`py-2 px-4 text-sm font-medium ${
            activeTab === "issues"
              ? "border-b-2 border-purple-500 text-purple-700"
              : "text-neutral-500"
          }`}
          onClick={() => setActiveTab("issues")}
          type="button"
        >
          課題点 ({issues.length})
        </button>
        <button
          className={`py-2 px-4 text-sm font-medium ${
            activeTab === "solutions"
              ? "border-b-2 border-purple-500 text-purple-700"
              : "text-neutral-500"
          }`}
          onClick={() => setActiveTab("solutions")}
          type="button"
        >
          解決策 ({solutions.length})
        </button>
      </div>

      <div className="space-y-3">
        {activeTab === "issues"
          ? issues.map((issue) => (
              <CommentCard
                key={issue._id}
                text={issue.statement}
                type="issue"
              />
            ))
          : solutions.map((solution) => (
              <CommentCard
                key={solution._id}
                text={solution.statement}
                type="solution"
              />
            ))}
      </div>
    </div>

    {/* コンポーネントの残りの部分... */}
  </div>
);
```

## 潜在的な改善点

1. エントリが多い場合の問題と解決策のページネーション追加
2. パフォーマンス向上のためのキャッシュの実装
3. データ取得を手動でトリガーするための更新ボタンの追加
4. 新しい問題や解決策を追加する際の楽観的な更新の実装
5. 問題と解決策のソートとフィルタリングオプションの追加

## 結論

これらの変更を実装することで、ThemeDetail ページはハードコードされたデータの代わりにデータベースから実際のテーマデータを取得するようになります。これにより、アプリケーションはより動的になり、バックエンドからのリアルタイムデータを表示できるようになります。
