import { apiDelete, apiGet, apiPost, apiPut } from './client';
import type { AccessGroup, AccessSubject, AccessSubjectType } from '@/types';

export function listAccessGroups(): Promise<AccessGroup[]> {
  return apiGet<AccessGroup[]>('/admin/access/groups');
}

export function createAccessGroup(input: {
  name: string;
  description: string;
  members: AccessSubject[];
}): Promise<AccessGroup> {
  return apiPost<AccessGroup>('/admin/access/groups', input);
}

export function updateAccessGroup(
  id: number,
  input: { name: string; description: string; members: AccessSubject[] },
): Promise<AccessGroup> {
  return apiPut<AccessGroup>(`/admin/access/groups/${id}`, input);
}

export function deleteAccessGroup(id: number): Promise<void> {
  return apiDelete<void>(`/admin/access/groups/${id}`);
}

export function searchAccessSubjects(
  type: Exclude<AccessSubjectType, 'group'>,
  query: string,
): Promise<AccessSubject[]> {
  return apiGet<AccessSubject[]>('/admin/access/subjects', { type, q: query });
}

export function listChallengeAccess(id: number): Promise<AccessSubject[]> {
  return apiGet<AccessSubject[]>(`/challenges/${id}/access`);
}

export function setChallengeAccess(
  id: number,
  grants: AccessSubject[],
): Promise<AccessSubject[]> {
  return apiPut<AccessSubject[]>(`/challenges/${id}/access`, { grants });
}
