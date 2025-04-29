# Theme Detail Data Fetching Implementation Plan

This document outlines the step-by-step process for implementing data fetching from the database for the ThemeDetail.tsx page.

## Current State Analysis

The ThemeDetail.tsx page currently uses hardcoded data for:

- Theme details (title, description)
- Key questions
- Issues (problems)
- Solutions

The page already has API client integration for:

- Sending messages
- Getting thread extractions

## Available Resources

The codebase already has:

- `ApiClient` with methods for fetching themes, problems, solutions, and questions
- `ThemeService` with methods for getting all themes and a theme by ID
- `useThemes` hook for fetching all themes

## Implementation Plan

### 1. Create a Custom Hook for Fetching a Single Theme

Create a new hook called `useTheme` that fetches a single theme by ID:

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

### 2. Create Custom Hooks for Problems, Solutions, and Questions

#### 2.1 Create a Hook for Fetching Key Questions

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

#### 2.2 Create a Hook for Fetching Problems

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

#### 2.3 Create a Hook for Fetching Solutions

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

### 3. Update ThemeDetail Component

Modify the ThemeDetail.tsx file to use the new hooks:

```typescript
// frontend/src/pages/ThemeDetail.tsx (partial update)
import { useTheme } from "../hooks/useTheme";
import { useThemeQuestions } from "../hooks/useThemeQuestions";
import { useThemeProblems } from "../hooks/useThemeProblems";
import { useThemeSolutions } from "../hooks/useThemeSolutions";

const ThemeDetail = () => {
  const { themeId } = useParams<{ themeId: string }>();

  // Use the custom hooks
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

  // Rest of the component...
};
```

### 4. Handle Loading and Error States

Add loading and error handling to the ThemeDetail component:

```typescript
// frontend/src/pages/ThemeDetail.tsx (partial update)
// ...

// Determine overall loading state
const isLoading =
  themeLoading || questionsLoading || issuesLoading || solutionsLoading;

// Combine errors
const errors = [themeError, questionsError, issuesError, solutionsError].filter(
  Boolean
);

// Early return for loading state
if (isLoading) {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-center items-center h-64">
        <p className="text-lg text-gray-600">Loading theme data...</p>
      </div>
    </div>
  );
}

// Early return for error state
if (errors.length > 0) {
  return (
    <div className="container mx-auto px-4 py-8">
      <div
        className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative"
        role="alert"
      >
        <strong className="font-bold">Error:</strong>
        <span className="block sm:inline">
          {" "}
          Failed to load theme data. Please try again later.
        </span>
      </div>
    </div>
  );
}

// If theme is not found
if (!theme) {
  return (
    <div className="container mx-auto px-4 py-8">
      <div
        className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded relative"
        role="alert"
      >
        <strong className="font-bold">Not Found:</strong>
        <span className="block sm:inline">
          {" "}
          The requested theme could not be found.
        </span>
      </div>
    </div>
  );
}

// ...
```

### 5. Update UI to Display Fetched Data

Replace the hardcoded data with the fetched data:

```typescript
// frontend/src/pages/ThemeDetail.tsx (partial update)
// ...

// Replace hardcoded breadcrumb data
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
            voteCount={0} // Add vote count if available in the API
            issueCount={0} // Add issue count if available in the API
            solutionCount={0} // Add solution count if available in the API
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

    {/* Rest of the component... */}
  </div>
);
```

## Testing the Implementation

1. Create the new hook files in the appropriate directories
2. Update the ThemeDetail.tsx file with the changes outlined above
3. Test the implementation by navigating to a theme detail page
4. Verify that the data is being fetched from the database and displayed correctly
5. Test error handling by temporarily introducing an error (e.g., incorrect API endpoint)
6. Test loading state by adding a delay to the API responses

## Potential Enhancements

1. Add pagination for problems and solutions if there are many entries
2. Implement caching to improve performance
3. Add a refresh button to manually trigger data fetching
4. Implement optimistic updates when adding new problems or solutions
5. Add sorting and filtering options for problems and solutions

## Conclusion

By implementing these changes, the ThemeDetail page will fetch actual theme data from the database instead of using hardcoded data. This will make the application more dynamic and allow it to display real-time data from the backend.
