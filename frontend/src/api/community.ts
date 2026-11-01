import { apiGet, apiPut } from './client';
import type { AccessSubject, CommunityAdmin, CommunityMeta } from '@/types';

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

export function updateCommunityCopy(copy: Record<string, string>): Promise<CommunityAdmin> {
  return apiPut<CommunityAdmin>('/admin/community/copy', { copy });
}
