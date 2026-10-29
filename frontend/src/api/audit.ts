import { apiGet } from './client';
import type { AuditLogEntry, Paginated } from '@/types';

export function listAudit(params?: {
  page?: number;
  pageSize?: number;
  action?: string;
  targetType?: string;
  actorId?: number;
}): Promise<Paginated<AuditLogEntry>> {
  return apiGet<Paginated<AuditLogEntry>>('/admin/audit', params);
}
