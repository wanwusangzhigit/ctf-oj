import { apiGet, apiPost, apiDelete, apiPut, client } from './client';
import type {
  Attachment,
  Challenge,
  ChallengeProtocol,
  ChallengeSourceType,
  ChallengeStatus,
  ChallengeView,
  AccessSubject,
  Paginated,
  SourceEntry,
  SubmissionResult,
} from '@/types';

export interface ChallengeListFilter {
  categoryId?: number;
  page?: number;
  pageSize?: number;
  scope?: 'user' | 'admin';
  q?: string;
  status?: ChallengeStatus;
  difficulty?: number;
  type?: 'static' | 'container';
  solved?: boolean;
  competitionId?: number;
}

export function listChallenges(filter: ChallengeListFilter = {}): Promise<Paginated<ChallengeView>> {
  const params: Record<string, unknown> = {
    page: filter.page ?? 1,
    page_size: filter.pageSize ?? 50,
  };
  if (filter.categoryId) params.category_id = filter.categoryId;
  if (filter.scope) params.scope = filter.scope;
  if (filter.q) params.q = filter.q;
  if (filter.status) params.status = filter.status;
  if (filter.difficulty) params.difficulty = filter.difficulty;
  if (filter.type) params.type = filter.type;
  if (filter.solved !== undefined) params.solved = filter.solved;
  if (filter.competitionId) params.competition_id = filter.competitionId;
  return apiGet<Paginated<ChallengeView>>('/challenges', params);
}

export function getChallenge(id: number, competitionId?: number): Promise<ChallengeView> {
  return apiGet<ChallengeView>(`/challenges/${id}`, {
    competition_id: competitionId,
  });
}

export function getChallengeAdmin(id: number): Promise<ChallengeView> {
  return apiGet<ChallengeView>(`/challenges/${id}`, { scope: 'admin' });
}

export function submitFlag(
  id: number,
  flag: string,
  competitionId?: number,
): Promise<SubmissionResult> {
  return apiPost<SubmissionResult>(`/challenges/${id}/submit`, {
    flag,
    competitionId,
  });
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
  status: ChallengeStatus;
  isPublished: boolean;
  connectionInfo?: string;
  tags?: string;
  isDynamic: boolean;
  image?: string;
  internalPort: number;
  protocol: ChallengeProtocol;
  sourceType: ChallengeSourceType;
  buildContext: string;
  defaultTtl: number;
  memoryLimitMb: number;
  cpuLimit: number;
  pidsLimit: number;
  editorial?: string;
  flags: FlagInput[];
  accessGrants?: AccessSubject[];
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
export function attachmentDownloadURL(
  challengeId: number,
  attachmentId: number,
  competitionId?: number,
): string {
  const base = `/api/v1/challenges/${challengeId}/attachments/${attachmentId}/download`;
  return competitionId ? `${base}?competition_id=${competitionId}` : base;
}

export function deleteAttachment(challengeId: number, attachmentId: number): Promise<void> {
  return apiDelete<void>(`/challenges/${challengeId}/attachments/${attachmentId}`);
}

// ----- Source files (dockerfile / compose) -----

export function listSources(challengeId: number): Promise<SourceEntry[]> {
  return apiGet<SourceEntry[]>(`/challenges/${challengeId}/sources`);
}

export function uploadSource(
  challengeId: number,
  path: string,
  file: File,
): Promise<SourceEntry[]> {
  const form = new FormData();
  form.append('path', path);
  form.append('file', file);
  return client
    .post(`/challenges/${challengeId}/sources`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then((r) => r.data.data as SourceEntry[]);
}

export function uploadSourceText(
  challengeId: number,
  path: string,
  content: string,
): Promise<SourceEntry[]> {
  const blob = new Blob([content], { type: 'text/plain' });
  const file = new File([blob], path.split('/').pop() ?? path, { type: 'text/plain' });
  return uploadSource(challengeId, path, file);
}

export function downloadSourceURL(challengeId: number, path: string): string {
  return `/api/v1/challenges/${challengeId}/sources/${path
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`;
}

/**
 * Fetch the raw bytes of a source file via the authenticated axios client.
 * The sources endpoints are admin-only, so a plain `<a href>` or `fetch()`
 * would arrive without the session cookie and get a 401.
 */
export async function getSourceText(challengeId: number, path: string): Promise<string> {
  const url = `/challenges/${challengeId}/sources/${path
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`;
  const resp = await client.get(url, { responseType: 'text', transformResponse: [(v) => v] });
  return typeof resp.data === 'string' ? resp.data : String(resp.data ?? '');
}

/**
 * Fetch a source file as a Blob and trigger a browser download.
 * Used instead of `<a href={downloadSourceURL(...)}>` because the sources
 * endpoints require the session cookie.
 */
export async function downloadSourceBlob(challengeId: number, path: string): Promise<Blob> {
  const url = `/challenges/${challengeId}/sources/${path
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`;
  const resp = await client.get(url, { responseType: 'blob' });
  return resp.data;
}

export function deleteSource(challengeId: number, path: string): Promise<SourceEntry[]> {
  return apiDelete<SourceEntry[]>(`/challenges/${challengeId}/sources/${path}`);
}
