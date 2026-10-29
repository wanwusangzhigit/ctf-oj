import { apiPost } from './client';

export function verifyEmail(token: string): Promise<{ ok: true }> {
  return apiPost<{ ok: true }>('/auth/verify-email', { token });
}

export function resendVerification(): Promise<{ ok: true }> {
  return apiPost<{ ok: true }>('/auth/resend-verification');
}

export function forgotPassword(account: string): Promise<{ ok: true }> {
  return apiPost<{ ok: true }>('/auth/forgot-password', { account });
}

export function resetPassword(token: string, newPassword: string): Promise<{ ok: true }> {
  return apiPost<{ ok: true }>('/auth/reset-password', { token, newPassword });
}
