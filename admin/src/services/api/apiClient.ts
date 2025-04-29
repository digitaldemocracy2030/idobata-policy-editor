import { type Result, err, ok } from "neverthrow";
import { ApiError, ApiErrorType } from "./apiError";
import type {
  CreateThemePayload,
  CreateUserPayload,
  LoginCredentials,
  LoginResponse,
  Theme,
  UpdateThemePayload,
  UserResponse,
} from "./types";

export type ApiResult<T> = Result<T, ApiError>;

let csrfToken: string | null = null;

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

    if (["POST", "PUT", "DELETE"].includes(options.method || "")) {
      if (!csrfToken) {
        await this.fetchCsrfToken();
      }
      if (csrfToken) {
        (headers as Record<string, string>)["X-CSRF-Token"] = csrfToken;
      }
    }

    const config = {
      ...options,
      headers,
      credentials: "include", // クッキーを含める
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
            csrfToken = null;
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

  private async fetchCsrfToken(): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/csrf-token`, {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        csrfToken = data.csrfToken;
      }
    } catch (error) {
      console.error("Failed to fetch CSRF token:", error);
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
    credentials: LoginCredentials
  ): Promise<ApiResult<LoginResponse>> {
    return this.request<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    });
  }

  async logout(): Promise<ApiResult<{ message: string }>> {
    return this.request<{ message: string }>("/auth/logout", {
      method: "POST",
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
}

export const apiClient = new ApiClient();
