import { apiGet, apiPatch, apiPost } from './client';
import type { AppNotification, Paginated } from '@/types';

export function listNotifications(
  page = 1,
  pageSize = 20,
): Promise<Paginated<AppNotification>> {
  return apiGet<Paginated<AppNotification>>('/notifications/me', { page, page_size: pageSize });
}

export function unreadCount(): Promise<number> {
  return apiGet<{ unread: number }>('/notifications/me/unread_count').then((r) => r.unread);
}

export function markRead(id: number): Promise<void> {
  return apiPatch<void>(`/notifications/${id}/read`).then(() => undefined);
}

export function markAllRead(): Promise<void> {
  return apiPost<void>('/notifications/read_all').then(() => undefined);
}
