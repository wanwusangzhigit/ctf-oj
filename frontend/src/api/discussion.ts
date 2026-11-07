import { apiGet, apiPost, apiDelete, apiPatch } from './client';
import type { Discussion, DiscussionRevision, DiscussionScope, Paginated } from '@/types';

export type DiscussionTarget = {
  scope: DiscussionScope;
  id?: number;
  competitionId?: number;
};

function targetPath(target: DiscussionTarget): string {
  switch (target.scope) {
    case 'challenge':
      return `/challenges/${target.id}/discussions`;
    case 'community':
      return '/community/discussions';
    case 'team':
      return `/teams/${target.id}/discussions`;
    case 'competition':
      return `/competitions/${target.id}/discussions`;
  }
}

export type TopicSort = 'last_reply' | 'newest' | 'oldest';

export type DiscussionListQuery = {
  page?: number;
  pageSize?: number;
  sort?: TopicSort;
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
    competition_id: target.competitionId,
    // For a community target the id is the board, and it narrows the list.
    section: target.scope === 'community' ? target.id : undefined,
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
  return apiPost<Discussion>(
    targetPath(target),
    {
      title,
      contentMd,
      parentId,
      // A community topic names its board; replies inherit it server-side.
      sectionId: target.scope === 'community' && !parentId ? target.id : undefined,
    },
    target.competitionId ? { competition_id: target.competitionId } : undefined,
  );
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
  if (target.scope === 'competition') {
    return apiPatch<Discussion>(
      `/admin/competitions/${target.id}/discussions/${id}`,
      input,
    );
  }
  return apiPatch<Discussion>(`/teams/${target.id}/discussions/${id}`, input);
}

export type DiscussionEditInput = {
  title?: string;
  contentMd?: string;
};

// Reads a topic without touching the view counter, so the edit form can
// pre-fill from it. Author-or-moderator only: a stranger gets 403.
export function getDiscussionContent(id: number): Promise<Discussion> {
  return apiGet<Discussion>(`/discussions/${id}/content`);
}

export function updateDiscussionContent(
  id: number,
  input: DiscussionEditInput,
): Promise<Discussion> {
  return apiPatch<Discussion>(`/discussions/${id}/content`, input);
}

export function listDiscussionRevisions(
  id: number,
  query: { page?: number; pageSize?: number } = {},
): Promise<Paginated<DiscussionRevision>> {
  return apiGet<Paginated<DiscussionRevision>>(`/discussions/${id}/revisions`, {
    page: query.page ?? 1,
    page_size: query.pageSize ?? 50,
  });
}
