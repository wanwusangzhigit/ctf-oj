import { apiGet, apiPost, apiPut, apiDelete, client } from './client';
import type {
  Challenge,
  ChallengeView,
  Paginated,
  SubmissionResult,
  Attachment,
} from '@/types';

export interface ChallengeListFilter {
  categoryId?: number;
  page?: number;
  pageSize?: number;
  scope?: 'user' | 'admin';
}

export function listChallenges(filter: ChallengeListFilter = {}): Promise<Paginated<ChallengeView>> {
  const params: Record<string, unknown> = {
    page: filter.page ?? 1,
    page_size: filter.pageSize ?? 50,
  };
  if (filter.categoryId) params.category_id = filter.categoryId;
  if (filter.scope) params.scope = filter.scope;
  return apiGet<Paginated<ChallengeView>>('/challenges', params);
}

export function getChallenge(id: number): Promise<ChallengeView> {
  return apiGet<ChallengeView>(`/challenges/${id}`);
}

export function submitFlag(id: number, flag: string): Promise<SubmissionResult> {
  return apiPost<SubmissionResult>(`/challenges/${id}/submit`, { flag });
}

export interface FlagInput {
  type: 'static' | 'regex';
  content: string;
  caseSensitive: boolean;
}

export interface ChallengeInput {
  categoryId: number;
  title: string;
  description?: string;
  baseScore: number;
  minScore: number;
  decay: number;
  difficulty: number;
  isPublished: boolean;
  connectionInfo?: string;
  tags?: string;
  isDynamic: boolean;
  image?: string;
  internalPort: number;
  defaultTtl: number;
  memoryLimitMb: number;
  cpuLimit: number;
  flags: FlagInput[];
}

export function createChallenge(input: ChallengeInput): Promise<Challenge> {
  return apiPost<Challenge>('/challenges', input);
}

export function updateChallenge(id: number, input: ChallengeInput): Promise<Challenge> {
  return apiPut<Challenge>(`/challenges/${id}`, input);
}

export function deleteChallenge(id: number): Promise<void> {
  return apiDelete<void>(`/challenges/${id}`);
}

export function uploadAttachment(challengeId: number, file: File): Promise<Attachment> {
  const form = new FormData();
  form.append('file', file);
  return client
    .post(`/challenges/${challengeId}/attachments`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then((r) => r.data.data as Attachment);
}
export function attachmentDownloadURL(challengeId: number, attachmentId: number): string {
  return `/api/v1/challenges/${challengeId}/attachments/${attachmentId}/download`;
}

export function deleteAttachment(challengeId: number, attachmentId: number): Promise<void> {
  return apiDelete<void>(`/challenges/${challengeId}/attachments/${attachmentId}`);
}
