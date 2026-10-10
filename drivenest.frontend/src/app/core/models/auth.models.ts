export interface User {
  id: number;
  email: string;
  displayName: string;
  currency: string;
}

export interface LoginRequest {
  userNameOrEmail: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  displayName: string;
}

export interface LoginResponse {
  token: string;
  expiresAtUtc: string;
  user: User;
  roles: string[];
}

export interface ProblemDetails {
  title?: string;
  status?: number;
  errors?: Record<string, string[]>;
}
