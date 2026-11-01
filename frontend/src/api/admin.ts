import { apiGet, apiPatch, apiPost, client } from './client';
import type { Announcement, Instance, Paginated, User } from '@/types';

export function adminListUsers(
  page = 1,
  pageSize = 50,
  filter?: { q?: string; role?: string; banned?: boolean },
): Promise<Paginated<User>> {
  const params: Record<string, unknown> = { page, page_size: pageSize };
  if (filter?.q) params.q = filter.q;
  if (filter?.role) params.role = filter.role;
  if (filter?.banned !== undefined) params.banned = filter.banned;
  return apiGet<Paginated<User>>('/admin/users', params);
}

export function adminGetUser(id: number): Promise<User> {
  return apiGet<User>(`/admin/users/${id}`);
}

export function adminListAnnouncements(
  page = 1,
  pageSize = 100,
): Promise<Paginated<Announcement>> {
  return apiGet<Paginated<Announcement>>('/admin/announcements', {
    page,
    page_size: pageSize,
  });
}

export function adminResetPassword(id: number, newPassword: string): Promise<void> {
  return apiPost<void>(`/admin/users/${id}/reset-password`, { newPassword }).then(
    () => undefined,
  );
}

export function adminUpdateUser(
  id: number,
  patch: {
    role?: 'user' | 'challenge_admin' | 'competition_admin' | 'moderator' | 'admin';
    isBanned?: boolean;
    bannedReason?: string;
    scoreExcluded?: boolean;
  },
): Promise<User> {
  return apiPatch<User>(`/admin/users/${id}`, patch);
}

export function adminListInstances(
  page = 1,
  pageSize = 50,
  filter?: { status?: string; userId?: number; challengeId?: number },
): Promise<Paginated<Instance>> {
  const params: Record<string, unknown> = { page, page_size: pageSize };
  if (filter?.status) params.status = filter.status;
  if (filter?.userId) params.user_id = filter.userId;
  if (filter?.challengeId) params.challenge_id = filter.challengeId;
  return apiGet<Paginated<Instance>>('/admin/instances', params);
}

export function adminStopInstance(id: number): Promise<void> {
  return apiPost<void>(`/admin/instances/${id}/stop`).then(() => undefined);
}

export function adminInstanceLogs(id: number): Promise<string> {
  return apiGet<{ logs: string }>(`/admin/instances/${id}/logs`).then((r) => r.logs);
}

/**
 * Export challenges as a JSON blob. Uses the authenticated axios client so
 * the session cookie is sent — a plain fetch() would arrive unauthenticated
 * and get a 401 from the admin-only endpoint.
 */
export async function exportChallenges(): Promise<Blob> {
  const resp = await client.get('/admin/export/challenges', { responseType: 'blob' });
  return resp.data as Blob;
}

export function adminBroadcast(input: {
  subject: string;
  body: string;
}): Promise<{ sent: number; failed: number }> {
  return apiPost('/admin/broadcast', input);
}

export type ServerDependency = {
  name: string;
  status: string;
  detail: string;
  latencyMs: number;
};

export type ServerContainer = {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  ports: string;
  createdAt: string;
};

export type ServerOverview = {
  host: {
    hostname: string;
    os: string;
    arch: string;
    kernel: string;
    uptimeSeconds: number;
    load1: number;
    load5: number;
    load15: number;
    cpus: number;
    memTotal: number;
    memAvailable: number;
    diskTotal: number;
    diskFree: number;
  };
  runtime: {
    goVersion: string;
    goroutines: number;
    heapAlloc: number;
    sys: number;
    numGC: number;
    uptimeSeconds: number;
  };
  dependencies: ServerDependency[];
  counts: {
    users: number;
    challenges: number;
    submissions: number;
    instances: number;
    teams: number;
  };
  docker: {
    available: boolean;
    version: string;
    error?: string;
    containersRunning: number;
    containersTotal: number;
  };
  containers: ServerContainer[];
  generatedAt: string;
};

export function getServerOverview(): Promise<ServerOverview> {
  return apiGet<ServerOverview>('/admin/server');
}

export function pruneServerContainers(): Promise<{ output: string }> {
  return apiPost<{ output: string }>('/admin/server/prune');
}
