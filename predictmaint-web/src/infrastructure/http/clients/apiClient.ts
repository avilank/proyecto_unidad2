import { HttpClient } from '@/infrastructure/http/base/HttpClient';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

let tokenGetter: (() => string | null) | undefined;

export function setApiTokenGetter(getter: () => string | null): void {
  tokenGetter = getter;
}

export const apiClient = new HttpClient(API_URL, () => tokenGetter?.() ?? null);
