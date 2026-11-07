import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from './client';
import type {
  AccessSubject,
  CommunityAdmin,
  CommunityMeta,
  CommunitySectionAdmin,
  CommunitySectionInput,
} from '@/types';

export function getCommunityMeta(): Promise<CommunityMeta> {
  return apiGet<CommunityMeta>('/community');
}

export function getCommunityAdmin(): Promise<CommunityAdmin> {
  return apiGet<CommunityAdmin>('/admin/community');
}

export function updateCommunityPolicy(input: {
  visibility: CommunityAdmin['visibility'];
  posting: CommunityAdmin['posting'];
}): Promise<CommunityAdmin> {
  return apiPut<CommunityAdmin>('/admin/community', input);
}

export function listCommunityGrants(): Promise<AccessSubject[]> {
  return apiGet<AccessSubject[]>('/admin/community/access');
}

export function setCommunityGrants(grants: AccessSubject[]): Promise<AccessSubject[]> {
  return apiPut<AccessSubject[]>('/admin/community/access', { grants });
}

// Writing a board returns the row itself; topicCount only comes with the list.
export type CommunitySectionRow = Omit<CommunitySectionAdmin, 'topicCount'>;

export function adminListSections(): Promise<CommunitySectionAdmin[]> {
  return apiGet<CommunitySectionAdmin[]>('/admin/community/sections');
}

export function createSection(input: CommunitySectionInput): Promise<CommunitySectionRow> {
  return apiPost<CommunitySectionRow>('/admin/community/sections', input);
}

export function updateSection(
  id: number,
  input: CommunitySectionInput,
): Promise<CommunitySectionRow> {
  return apiPut<CommunitySectionRow>(`/admin/community/sections/${id}`, input);
}

export function deleteSection(id: number): Promise<void> {
  return apiDelete<void>(`/admin/community/sections/${id}`);
}

// The board manager's own route: same row, but it cannot reach policy or order.
export function updateSectionCopy(
  id: number,
  input: Pick<CommunitySectionInput, 'name' | 'blurb' | 'guidelinesMd'>,
): Promise<CommunitySectionRow> {
  return apiPatch<CommunitySectionRow>(`/community/sections/${id}`, input);
}

export function listSectionGrants(id: number): Promise<AccessSubject[]> {
  return apiGet<AccessSubject[]>(`/admin/community/sections/${id}/access`);
}

export function setSectionGrants(
  id: number,
  grants: AccessSubject[],
): Promise<AccessSubject[]> {
  return apiPut<AccessSubject[]>(`/admin/community/sections/${id}/access`, { grants });
}
