import { apiGet, apiPost } from './client';
import type { AuthResponse } from '@/types';

export function login(account: string, password: string, totpCode?: string) {
  return apiPost<AuthResponse>('/auth/login', { account, password, totpCode });
}

export function register(
  username: string,
  email: string,
  password: string,
  registrationCode?: string,
) {
  return apiPost<AuthResponse>('/auth/register', {
    username,
    email,
    password,
    registrationCode,
  });
}

export function logout() {
  return apiPost<void>('/auth/logout');
}

export function me() {
  return apiGet<{ id: number; username: string; email: string; role: string; score: number; bio: string }>(
    '/auth/me',
  );
}
