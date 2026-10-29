import { apiGet, apiPost, apiDelete, apiPatch } from './client';
import type { Discussion, DiscussionScope, Paginated } from '@/types';

export type DiscussionTarget = {
  scope: DiscussionScope;
  id?: number;
};

function targetPath(target: DiscussionTarget): string {
  switch (target.scope) {
    case 'challenge':
      return `/challenges/${target.id}/discussions`;
    case 'community':
      return '/community/discussions';
    case 'team':
      return `/teams/${target.id}/discussions`;
  }
}

export type DiscussionListQuery = {
  page?: number;
  pageSize?: number;
  sort?: 'last_reply' | 'newest' | 'oldest';
  tag?: string;
  q?: string;
};

export function listDiscussions(
  target: DiscussionTarget,
  query: DiscussionListQuery = {},
): Promise<Paginated<Discussion>> {
  return apiGet<Paginated<Discussion>>(targetPath(target), {
    page: query.page ?? 1,
    page_size: query.pageSize ?? 50,
    sort: query.sort,
    tag: query.tag,
    q: query.q,
  });
}

export function getCommunityDiscussion(id: number): Promise<Discussion> {
  return apiGet<Discussion>(`/community/discussions/${id}`);
}

export function createDiscussion(
  target: DiscussionTarget,
  contentMd: string,
  parentId?: number,
  title?: string,
): Promise<Discussion> {
  return apiPost<Discussion>(targetPath(target), {
    title,
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

export function moderateDiscussion(
  target: DiscussionTarget,
  id: number,
  input: { isPinned?: boolean; isLocked?: boolean; tags?: string },
): Promise<Discussion> {
  if (target.scope === 'challenge') {
    return apiPatch<Discussion>(`/admin/discussions/${id}`, input);
  }
  if (target.scope === 'community') {
    return apiPatch<Discussion>(`/community/discussions/${id}`, input);
  }
  return apiPatch<Discussion>(`/teams/${target.id}/discussions/${id}`, input);
}
