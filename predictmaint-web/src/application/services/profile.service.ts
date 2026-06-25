import { apiClient } from '@/infrastructure/http/clients/apiClient';

export interface UserProfile {
  id: number;
  nombre: string;
  email: string;
  telefono: string;
  rol: string;
  estado: string;
  esTecnico: boolean;
  especialidad: string | null;
  turno: string | null;
}

export class ProfileService {
  getProfile(): Promise<UserProfile> {
    return apiClient.get<UserProfile>('/users/me');
  }

  updateProfile(payload: { nombre?: string; telefono?: string }): Promise<UserProfile> {
    return apiClient.patch<UserProfile>('/users/me', payload);
  }
}

export const profileService = new ProfileService();
