import { apiGet, apiPost, apiPut, apiDelete } from './client';
import type { Announcement, Paginated } from '@/types';

export function listAnnouncements(page = 1, pageSize = 20): Promise<Paginated<Announcement>> {
  return apiGet<Paginated<Announcement>>('/announcements', { page, page_size: pageSize });
}

export function getAnnouncement(id: number): Promise<Announcement> {
  return apiGet<Announcement>(`/announcements/${id}`);
}

export function createAnnouncement(input: {
  title: string;
  contentMd?: string;
  isPinned?: boolean;
  isPublished?: boolean;
}): Promise<Announcement> {
  return apiPost<Announcement>('/announcements', input);
}

export function updateAnnouncement(
  id: number,
  input: {
    title: string;
    contentMd?: string;
    isPinned?: boolean;
    isPublished?: boolean;
  },
): Promise<Announcement> {
  return apiPut<Announcement>(`/announcements/${id}`, input);
}

export function deleteAnnouncement(id: number): Promise<void> {
  return apiDelete<void>(`/announcements/${id}`);
}
