import { User } from './user.model';

export interface RegisterRequest {
  username: string;
  password: string;
  first_name?: string;
  last_name?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface TokenPair {
  access: string;
  refresh: string;
}

export interface RefreshTokenResponse {
  access: string;
}

export type RegisterResponse = Omit<User, 'date_joined'>;
