import { apiGet, apiPost, apiPatch, apiDelete } from './client';
import type { Writeup } from '@/types';

export function listWriteups(
  challengeId: number,
  competitionId?: number,
): Promise<Writeup[]> {
  return apiGet<Writeup[]>(`/challenges/${challengeId}/writeups`, {
    competition_id: competitionId,
  });
}

export function createWriteup(
  challengeId: number,
  input: { title: string; contentMd: string; isPublished?: boolean },
  competitionId?: number,
): Promise<Writeup> {
  return apiPost<Writeup>(
    `/challenges/${challengeId}/writeups`,
    input,
    competitionId ? { competition_id: competitionId } : undefined,
  );
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
