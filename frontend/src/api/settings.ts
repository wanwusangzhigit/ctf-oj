import { apiGet, apiPut } from './client';
import type { SiteSettingsPublic, SiteSetting } from '@/types';

/** Public settings — read once on app bootstrap. */
export function getPublicSettings(): Promise<SiteSettingsPublic> {
  return apiGet<SiteSettingsPublic>('/settings');
}

/** Admin: list every key/value row. */
export function adminListSettings(): Promise<SiteSetting[]> {
  return apiGet<SiteSetting[]>('/admin/settings');
}

/** Admin: bulk update. Keys with reserved prefixes are filtered server-side. */
export function adminUpdateSettings(values: Record<string, string>): Promise<{ ok: true }> {
  return apiPut<{ ok: true }>('/admin/settings', values);
}

/** Admin: write community.copy.* overrides; keys outside the allowlist are dropped. */
export function adminUpdateCommunityCopy(values: Record<string, string>): Promise<{ ok: true }> {
  return apiPut<{ ok: true }>('/admin/settings/copy', values);
}
