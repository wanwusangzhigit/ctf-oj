import { apiGet, apiPost, apiDelete } from './client';
import type { Team, TeamMember, Paginated } from '@/types';

export function listTeams(page = 1, pageSize = 50): Promise<Paginated<Team>> {
  return apiGet<Paginated<Team>>('/teams', { page, page_size: pageSize });
}

export function teamScoreboard(page = 1, pageSize = 50): Promise<Paginated<Team>> {
  return apiGet<Paginated<Team>>('/teams/scoreboard', { page, page_size: pageSize });
}

export function getTeam(id: number): Promise<Team> {
  return apiGet<Team>(`/teams/${id}`);
}

export function createTeam(input: {
  name: string;
  slug: string;
  description?: string;
}): Promise<Team> {
  return apiPost<Team>('/teams', input);
}

export function joinTeamByCode(code: string): Promise<Team> {
  return apiPost<Team>('/teams/join', { inviteCode: code });
}

export function leaveTeam(): Promise<void> {
  return apiPost<void>('/teams/leave').then(() => undefined);
}

export function myTeam(): Promise<Team | null> {
  return apiGet<Team | null>('/teams/me');
}

export function disbandTeam(id: number): Promise<void> {
  return apiDelete<void>(`/teams/${id}`);
}

export function removeTeamMember(teamId: number, userId: number): Promise<void> {
  return apiPost<void>(`/teams/${teamId}/members/remove`, { userId }).then(() => undefined);
}

/** Transfer ownership to another member. Caller must be the current owner. */
export function transferTeamOwner(teamId: number, newOwnerId: number): Promise<Team> {
  return apiPost<Team>(`/teams/${teamId}/transfer`, { newOwnerId });
}

/** Regenerate the invite code. Caller must be the current owner. */
export function rotateTeamInvite(teamId: number): Promise<{ inviteCode: string }> {
  return apiPost<{ inviteCode: string }>(`/teams/${teamId}/invite/rotate`, {});
}

export type { Team, TeamMember };
