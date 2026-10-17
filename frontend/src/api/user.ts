import { apiGet, apiPatch } from './client';
import type { Paginated, Solve, User } from '@/types';

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

export function updateProfile(bio: string): Promise<User> {
  return apiPatch<User>('/users/me', { bio });
}
