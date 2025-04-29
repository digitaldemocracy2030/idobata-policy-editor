export enum ApiErrorType {
  NETWORK_ERROR = "NETWORK_ERROR",
  NOT_FOUND = "NOT_FOUND",
  VALIDATION_ERROR = "VALIDATION_ERROR",
  SERVER_ERROR = "SERVER_ERROR",
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

export class ApiError extends Error {
  type: ApiErrorType;
  status?: number;

  constructor(type: ApiErrorType, message: string, status?: number) {
    super(message);
    this.type = type;
    this.status = status;
    this.name = "ApiError";
  }
}
