import type { LoginResponse, User } from '@/core/entities';
import type { IAuthRepository, LoginCredentials } from '@/core/interfaces';
import { apiClient } from '@/infrastructure/http/clients/apiClient';

export class AuthRepository implements IAuthRepository {
  login(credentials: LoginCredentials): Promise<LoginResponse> {
    return apiClient.post<LoginResponse>('/auth/login', credentials);
  }

  getProfile(): Promise<User> {
    return apiClient.get<User>('/auth/me');
  }

  logout(): Promise<void> {
    return apiClient.post<void>('/auth/logout');
  }
}

export const authRepository = new AuthRepository();
