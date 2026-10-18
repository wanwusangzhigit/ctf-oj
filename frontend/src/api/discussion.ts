import { apiGet, apiPost, apiDelete } from './client';
import type { Discussion, Paginated } from '@/types';

export function listDiscussions(
  challengeId: number,
  page = 1,
  pageSize = 50,
): Promise<Paginated<Discussion>> {
  return apiGet<Paginated<Discussion>>(`/challenges/${challengeId}/discussions`, {
    page,
    page_size: pageSize,
  });
}

export function createDiscussion(
  challengeId: number,
  contentMd: string,
  parentId?: number,
): Promise<Discussion> {
  return apiPost<Discussion>(`/challenges/${challengeId}/discussions`, {
    contentMd,
    parentId,
  });
}

export function deleteDiscussion(id: number): Promise<void> {
  return apiDelete<void>(`/discussions/${id}`);
}

export function toggleDiscussionLike(id: number): Promise<{ liked: boolean }> {
  return apiPost<{ liked: boolean }>(`/discussions/${id}/like`);
}
