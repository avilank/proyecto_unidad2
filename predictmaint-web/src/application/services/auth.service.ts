import type { LoginResponse, User } from '@/core/entities';
import type { LoginCredentials } from '@/core/interfaces';
import { authRepository } from '@/infrastructure/repositories/auth.repository';

export class AuthService {
  login(credentials: LoginCredentials): Promise<LoginResponse> {
    return authRepository.login(credentials);
  }

  getProfile(): Promise<User> {
    return authRepository.getProfile();
  }

  logout(): Promise<void> {
    return authRepository.logout();
  }
}

export const authService = new AuthService();
