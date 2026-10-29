import { apiGet, apiPost, apiPut, apiDelete, client } from './client';
import type { Competition, CompetitionInput, Paginated, PublicUser, TeamScore } from '@/types';

export function getActiveCompetition(): Promise<Competition | null> {
  return apiGet<Competition | null>('/competition');
}

export function listCompetitions(
  page = 1,
  pageSize = 50,
  scope?: 'admin',
): Promise<Paginated<Competition>> {
  return apiGet<Paginated<Competition>>('/competitions', {
    page,
    page_size: pageSize,
    scope,
  });
}

export function getCompetition(id: number, scope?: 'admin'): Promise<Competition> {
  return apiGet<Competition>(`/competitions/${id}`, { scope });
}

export function competitionScoreboard(
  id: number,
  page = 1,
  pageSize = 50,
): Promise<Paginated<PublicUser>> {
  return apiGet<Paginated<PublicUser>>(`/competitions/${id}/scoreboard`, {
    page,
    page_size: pageSize,
  });
}

export function createCompetition(input: CompetitionInput): Promise<Competition> {
  return apiPost<Competition>('/admin/competitions', input);
}

export function updateCompetition(id: number, input: CompetitionInput): Promise<Competition> {
  return apiPut<Competition>(`/admin/competitions/${id}`, input);
}

export function deleteCompetition(id: number): Promise<{ ok: true }> {
  return apiDelete<{ ok: true }>(`/admin/competitions/${id}`);
}

export function competitionTeamScoreboard(
  id: number,
  page = 1,
  pageSize = 100,
): Promise<Paginated<TeamScore>> {
  return apiGet<Paginated<TeamScore>>(`/competitions/${id}/scoreboard`, {
    page,
    page_size: pageSize,
    group: 'team',
  });
}

export async function exportCompetitionScores(
  id: number,
  group: 'user' | 'team',
  slug: string,
): Promise<void> {
  const resp = await client.get(`/admin/competitions/${id}/export`, {
    params: { group },
    responseType: 'blob',
  });
  const url = URL.createObjectURL(resp.data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slug}-${group}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
