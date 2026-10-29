import { apiGet, apiPost, apiPatch, apiDelete } from './client';
import type { Writeup } from '@/types';

export function listWriteups(challengeId: number): Promise<Writeup[]> {
  return apiGet<Writeup[]>(`/challenges/${challengeId}/writeups`);
}

export function createWriteup(
  challengeId: number,
  input: { title: string; contentMd: string; isPublished?: boolean },
): Promise<Writeup> {
  return apiPost<Writeup>(`/challenges/${challengeId}/writeups`, input);
}

export function updateWriteup(
  id: number,
  input: { title?: string; contentMd?: string; isPublished?: boolean },
): Promise<Writeup> {
  return apiPatch<Writeup>(`/writeups/${id}`, input);
}

export function deleteWriteup(id: number): Promise<void> {
  return apiDelete<void>(`/writeups/${id}`);
}

export function listMyWriteups(): Promise<Writeup[]> {
  return apiGet<Writeup[]>('/users/me/writeups');
}
