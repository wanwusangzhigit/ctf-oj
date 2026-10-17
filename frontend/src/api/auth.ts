import { apiGet, apiPost } from './client';
import type { AuthResponse } from '@/types';

export function login(account: string, password: string) {
  return apiPost<AuthResponse>('/auth/login', { account, password });
}

export function register(username: string, email: string, password: string) {
  return apiPost<AuthResponse>('/auth/register', { username, email, password });
}

export function me() {
  return apiGet<{ id: number; username: string; email: string; role: string; score: number; bio: string }>(
    '/auth/me',
  );
}
