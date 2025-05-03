import { err, ok } from "neverthrow";
import type { QuestionDetailResponse } from "../../hooks/useQuestionDetail";
import type {
  DigestDraft,
  PolicyDraft,
  Problem,
  Question,
  Solution,
  Theme,
} from "../../types";

// テーマ詳細データのレスポンス型
export interface ThemeDetailResponse {
  theme: Theme;
  keyQuestions: (Question & {
    voteCount: number;
    issueCount: number;
    solutionCount: number;
  })[];
  issues: Problem[];
  solutions: Solution[];
}
import { ApiError, ApiErrorType } from "./apiError";
import { HttpClient, type HttpResult } from "./httpClient";

interface RetryOptions {
  maxRetries: number;
  delayMs: number;
  shouldRetry: (error: ApiError) => boolean;
}

const defaultRetryOptions: RetryOptions = {
  maxRetries: 3,
  delayMs: 1000,
  shouldRetry: (error: ApiError) => {
    return (
      error.type === ApiErrorType.NETWORK_ERROR ||
      error.type === ApiErrorType.SERVER_ERROR
    );
  },
};

export class ApiClient {
  private httpClient: HttpClient;
  private retryOptions: RetryOptions;

  constructor() {
    const baseUrl = `${import.meta.env.VITE_API_BASE_URL}/api`;
    this.httpClient = new HttpClient({
      baseUrl,
      timeout: 30000,
    });
    this.retryOptions = defaultRetryOptions;
  }

  private async withRetry<T>(
    operation: () => Promise<HttpResult<T>>,
    options: Partial<RetryOptions> = {}
  ): Promise<HttpResult<T>> {
    const retryOpts = { ...this.retryOptions, ...options };
    let lastError: ApiError | null = null;

    for (let attempt = 0; attempt <= retryOpts.maxRetries; attempt++) {
      const result = await operation();

      if (result.isOk()) {
        return result;
      }

      lastError = result.error;

      if (
        attempt >= retryOpts.maxRetries ||
        !retryOpts.shouldRetry(lastError)
      ) {
        return err(lastError);
      }

      await new Promise((resolve) => setTimeout(resolve, retryOpts.delayMs));
    }

    return err(
      lastError ||
        new ApiError(ApiErrorType.UNKNOWN_ERROR, "Unknown error occurred")
    );
  }

  async getAllThemes(): Promise<HttpResult<Theme[]>> {
    return this.withRetry(() => this.httpClient.get<Theme[]>("/themes"));
  }

  async getThemeById(id: string): Promise<HttpResult<Theme>> {
    return this.withRetry(() => this.httpClient.get<Theme>(`/themes/${id}`));
  }

  async getDefaultTheme(): Promise<HttpResult<Theme>> {
    const themesResult = await this.getAllThemes();

    return themesResult.andThen((themes) => {
      const defaultTheme =
        themes.find((theme) => theme.slug === "default") || themes[0];
      if (!defaultTheme) {
        return err(
          new ApiError(ApiErrorType.NOT_FOUND, "Default theme not found")
        );
      }
      return ok(defaultTheme);
    });
  }

  async getAllQuestions(themeId: string): Promise<HttpResult<Question[]>> {
    return this.withRetry(() =>
      this.httpClient.get<Question[]>(`/themes/${themeId}/questions`)
    );
  }

  async getQuestionsByTheme(themeId: string): Promise<HttpResult<Question[]>> {
    return this.withRetry(() =>
      this.httpClient.get<Question[]>(`/themes/${themeId}/questions`)
    );
  }

  async getQuestionDetails(
    questionId: string,
    themeId: string
  ): Promise<HttpResult<QuestionDetailResponse>> {
    return this.withRetry(() =>
      this.httpClient.get<QuestionDetailResponse>(
        `/themes/${themeId}/questions/${questionId}/details`
      )
    );
  }

  async generateQuestions(themeId: string): Promise<HttpResult<void>> {
    return this.withRetry(() =>
      this.httpClient.post<void>(`/themes/${themeId}/generate-questions`)
    );
  }

  async getAllProblems(themeId: string): Promise<HttpResult<Problem[]>> {
    return this.withRetry(() =>
      this.httpClient.get<Problem[]>(`/themes/${themeId}/problems`)
    );
  }

  async getProblemsByTheme(themeId: string): Promise<HttpResult<Problem[]>> {
    return this.withRetry(() =>
      this.httpClient.get<Problem[]>(`/themes/${themeId}/problems`)
    );
  }

  async getAllSolutions(themeId: string): Promise<HttpResult<Solution[]>> {
    return this.withRetry(() =>
      this.httpClient.get<Solution[]>(`/themes/${themeId}/solutions`)
    );
  }

  async getSolutionsByTheme(themeId: string): Promise<HttpResult<Solution[]>> {
    return this.withRetry(() =>
      this.httpClient.get<Solution[]>(`/themes/${themeId}/solutions`)
    );
  }

  async getAllPolicyDrafts(
    themeId: string
  ): Promise<HttpResult<PolicyDraft[]>> {
    return this.withRetry(() =>
      this.httpClient.get<PolicyDraft[]>(`/themes/${themeId}/policy-drafts`)
    );
  }

  async getPolicyDraftsByTheme(
    themeId: string
  ): Promise<HttpResult<PolicyDraft[]>> {
    return this.withRetry(() =>
      this.httpClient.get<PolicyDraft[]>(`/themes/${themeId}/policy-drafts`)
    );
  }

  async getAllDigestDrafts(
    themeId: string
  ): Promise<HttpResult<DigestDraft[]>> {
    return this.withRetry(() =>
      this.httpClient.get<DigestDraft[]>(`/themes/${themeId}/digest-drafts`)
    );
  }

  async getDigestDraftsByTheme(
    themeId: string
  ): Promise<HttpResult<DigestDraft[]>> {
    return this.withRetry(() =>
      this.httpClient.get<DigestDraft[]>(`/themes/${themeId}/digest-drafts`)
    );
  }

  async getThreadExtractions(
    threadId: string,
    themeId: string
  ): Promise<HttpResult<{ problems: Problem[]; solutions: Solution[] }>> {
    return this.withRetry(() =>
      this.httpClient.get<{ problems: Problem[]; solutions: Solution[] }>(
        `/themes/${themeId}/chat/threads/${threadId}/extractions`
      )
    );
  }

  async getThreadMessages(
    threadId: string,
    themeId: string
  ): Promise<HttpResult<{ messages: unknown[] }>> {
    return this.withRetry(() =>
      this.httpClient.get<{ messages: unknown[] }>(
        `/themes/${themeId}/chat/threads/${threadId}/messages`
      )
    );
  }

  async sendMessage(
    userId: string,
    message: string,
    themeId: string,
    threadId?: string
  ): Promise<
    HttpResult<{ response: string; threadId: string; userId: string }>
  > {
    return this.withRetry(() =>
      this.httpClient.post<{
        response: string;
        threadId: string;
        userId: string;
      }>(`/themes/${themeId}/chat/messages`, {
        userId,
        message,
        threadId,
      })
    );
  }

  async getPolicyDraftsByQuestion(
    themeId: string,
    questionId: string
  ): Promise<HttpResult<PolicyDraft[]>> {
    return this.withRetry(() =>
      this.httpClient.get<PolicyDraft[]>(
        `/themes/${themeId}/policy-drafts?questionId=${questionId}`
      )
    );
  }

  async getDigestDraftsByQuestion(
    themeId: string,
    questionId: string
  ): Promise<HttpResult<DigestDraft[]>> {
    return this.withRetry(() =>
      this.httpClient.get<DigestDraft[]>(
        `/themes/${themeId}/digest-drafts?questionId=${questionId}`
      )
    );
  }

  async generatePolicy(
    themeId: string,
    questionId: string
  ): Promise<HttpResult<void>> {
    return this.withRetry(() =>
      this.httpClient.post<void>(
        `/themes/${themeId}/questions/${questionId}/generate-policy`
      )
    );
  }

  async generateDigest(
    themeId: string,
    questionId: string
  ): Promise<HttpResult<void>> {
    return this.withRetry(() =>
      this.httpClient.post<void>(
        `/themes/${themeId}/questions/${questionId}/generate-digest`
      )
    );
  }

  async getThemeDetail(id: string): Promise<HttpResult<ThemeDetailResponse>> {
    return this.withRetry(() =>
      this.httpClient.get<ThemeDetailResponse>(`/themes/${id}/detail`)
    );
  }

  async getSiteConfig(): Promise<
    HttpResult<{
      _id: string;
      title: string;
      aboutMessage: string;
    }>
  > {
    return this.withRetry(() =>
      this.httpClient.get<{
        _id: string;
        title: string;
        aboutMessage: string;
      }>("/site-config")
    );
  }

  async getUserInfo(
    userId: string
  ): Promise<
    HttpResult<{ displayName: string | null; profileImagePath: string | null }>
  > {
    return this.withRetry(() =>
      this.httpClient.get<{
        displayName: string | null;
        profileImagePath: string | null;
      }>(`/users/${userId}`)
    );
  }

  async updateUserDisplayName(
    userId: string,
    displayName: string
  ): Promise<HttpResult<void>> {
    return this.withRetry(() =>
      this.httpClient.put<void>(`/users/${userId}`, { displayName })
    );
  }

  async uploadProfileImage(
    userId: string,
    file: File
  ): Promise<HttpResult<{ profileImageUrl: string }>> {
    const formData = new FormData();
    formData.append("profileImage", file);

    return this.withRetry(() =>
      this.httpClient.postFormData<{ profileImageUrl: string }>(
        `/users/${userId}/profile-image`,
        formData
      )
    );
  }

  async getTopPageData(): Promise<
    HttpResult<{
      latestThemes: Theme[];
      latestQuestions: Question[];
    }>
  > {
    return this.withRetry(() =>
      this.httpClient.get<{
        latestThemes: Theme[];
        latestQuestions: Question[];
      }>("/top-page-data")
    );
  }

  async getGoogleAuthUrl(): Promise<HttpResult<{ url: string }>> {
    return this.withRetry(() =>
      this.httpClient.get<{ url: string }>("/auth/google/url")
    );
  }

  async getCurrentUser(): Promise<
    HttpResult<{
      user: {
        id: string;
        email: string;
        displayName: string;
        profileImageUrl: string;
        role: string;
        googleId?: string;
      };
    }>
  > {
    return this.withRetry(() => this.httpClient.get<{ user: any }>("/auth/me"));
  }

  async logout(): Promise<HttpResult<{ message: string }>> {
    return this.withRetry(() =>
      this.httpClient.post<{ message: string }>("/auth/logout", {})
    );
  }
}

export const apiClient = new ApiClient();
