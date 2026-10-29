import { apiGet, apiPatch, apiPost, client } from './client';
import type { FeedItem, Paginated, Solve, SubmissionWithChallenge, User } from '@/types';

export function getMe(): Promise<User> {
  return apiGet<User>('/users/me');
}

export function getUser(id: number): Promise<User> {
  return apiGet<User>(`/users/${id}`);
}

export function mySolves(): Promise<Solve[]> {
  return apiGet<Solve[]>('/users/me/solves');
}

export function scoreboard(page = 1, pageSize = 50): Promise<Paginated<User>> {
  return apiGet<Paginated<User>>('/users/scoreboard', { page, page_size: pageSize });
}

export function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  return apiPost<void>('/users/me/password', { currentPassword, newPassword });
}

export function updateProfile(input: {
  bio: string;
  profileVisibility?: 'public' | 'private';
}): Promise<User> {
  return apiPatch<User>('/users/me', input);
}

export function mySubmissions(page = 1, pageSize = 50): Promise<Paginated<SubmissionWithChallenge>> {
  return apiGet<Paginated<SubmissionWithChallenge>>('/users/me/submissions', {
    page,
    page_size: pageSize,
  });
}

/** Upload an avatar image. Server expects multipart/form-data with a "file" field. */
export function uploadAvatar(file: File): Promise<User> {
  const form = new FormData();
  form.append('file', file);
  return client
    .post('/users/me/avatar', form, { headers: { 'Content-Type': 'multipart/form-data' } })
    .then((r) => r.data.data as User);
}

/** Public avatar URL — no session cookie required. */
export function avatarURL(userId: number): string {
  return `/api/v1/users/${userId}/avatar`;
}

export function followUser(id: number): Promise<void> {
  return apiPost<void>(`/users/${id}/follow`);
}

export function unfollowUser(id: number): Promise<void> {
  return client.delete(`/users/${id}/follow`).then(() => undefined);
}

export function followers(
  id: number,
  page = 1,
  pageSize = 20,
): Promise<Paginated<User>> {
  return apiGet<Paginated<User>>(`/users/${id}/followers`, {
    page,
    page_size: pageSize,
  });
}

export function following(
  id: number,
  page = 1,
  pageSize = 20,
): Promise<Paginated<User>> {
  return apiGet<Paginated<User>>(`/users/${id}/following`, {
    page,
    page_size: pageSize,
  });
}

export function activityFeed(limit = 30): Promise<FeedItem[]> {
  return apiGet<FeedItem[]>('/users/me/feed', { limit });
}

export function setup2FA(): Promise<{ secret: string; otpauthUrl: string }> {
  return apiPost('/users/me/2fa/setup');
}

export function enable2FA(code: string): Promise<void> {
  return apiPost<void>('/users/me/2fa/enable', { code });
}

export function disable2FA(password: string): Promise<void> {
  return apiPost<void>('/users/me/2fa/disable', { password });
}
