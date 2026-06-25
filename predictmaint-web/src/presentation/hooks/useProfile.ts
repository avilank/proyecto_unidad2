'use client';

import useSWR from 'swr';
import { profileService } from '@/application/services/profile.service';

export function useProfile() {
  return useSWR('/users/me', () => profileService.getProfile());
}
