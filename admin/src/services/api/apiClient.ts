import { type Result, err, ok } from "neverthrow";
import { ApiError, ApiErrorType } from "./apiError";
import type {
  ClusteringParams,
  ClusteringResult,
  CreateThemePayload,
  CreateUserPayload,
  LoginCredentials,
  LoginResponse,
  Question,
  SiteConfig,
  Theme,
  UpdateSiteConfigPayload,
  UpdateThemePayload,
  UserResponse,
  VectorSearchParams,
  VectorSearchResult,
} from "./types";

export type ApiResult<T> = Result<T, ApiError>;

export class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = `${import.meta.env.VITE_API_BASE_URL}/api`;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResult<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    const token = localStorage.getItem("auth_token");
    if (token) {
      (headers as Record<string, string>).Authorization = `Bearer ${token}`;
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
    userData: CreateUserPayload
  ): Promise<ApiResult<UserResponse>> {
    return this.request<UserResponse>("/auth/users", {
      method: "POST",
      body: JSON.stringify(userData),
    });
  }

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

  async generateThemeEmbeddings(
    themeId: string,
    itemType?: "problem" | "solution"
  ): Promise<ApiResult<{ status: string; processedCount: number }>> {
    return this.request<{ status: string; processedCount: number }>(
      `/themes/${themeId}/embeddings/generate`,
      {
        method: "POST",
        body: JSON.stringify({ itemType }),
      }
    );
  }

  async searchTheme(
    themeId: string,
    params: VectorSearchParams
  ): Promise<ApiResult<VectorSearchResult[]>> {
    // Manually encode the query parameters to ensure proper handling of non-ASCII characters
    const queryText = encodeURIComponent(params.queryText);
    const itemType = encodeURIComponent(params.itemType);
    const kParam = params.k
      ? `&k=${encodeURIComponent(params.k.toString())}`
      : "";

    const queryString = `queryText=${queryText}&itemType=${itemType}${kParam}`;

    return this.request<VectorSearchResult[]>(
      `/themes/${themeId}/search?${queryString}`
    );
  }

  async clusterTheme(
    themeId: string,
    params: ClusteringParams
  ): Promise<ApiResult<ClusteringResult>> {
    return this.request<ClusteringResult>(`/themes/${themeId}/cluster`, {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  async getQuestionsByTheme(themeId: string): Promise<ApiResult<Question[]>> {
    return this.request<Question[]>(`/themes/${themeId}/questions`);
  }

  async generateQuestions(themeId: string): Promise<ApiResult<void>> {
    return this.request<void>(`/themes/${themeId}/generate-questions`, {
      method: "POST",
    });
  }
}

export const apiClient = new ApiClient();
