import type { ISODate, UUID } from "./common";

export type UserRole = "ADMIN" | "OPERATOR" | "VIEWER";

export interface User {
  id: UUID;
  email: string;
  full_name: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: ISODate;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}
