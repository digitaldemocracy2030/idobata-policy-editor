export interface Theme {
  _id: string;
  title: string;
  description?: string;
  slug: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateThemePayload {
  title: string;
  description?: string;
  slug: string;
  isActive?: boolean;
}

export interface UpdateThemePayload {
  title?: string;
  description?: string;
  slug?: string;
  isActive?: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface UserResponse {
  user: User;
}

export interface CreateUserPayload {
  name: string;
  email: string;
  password: string;
  role?: string;
}
