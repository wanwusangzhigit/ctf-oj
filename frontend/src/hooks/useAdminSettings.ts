import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminListSettings, adminUpdateSettings } from '@/api/settings';
import { ApiClientError } from '@/api/client';
import { COPY_PREFIX } from '@/lib/communityCopy';
import { useSiteStore } from '@/stores/site';
import { useToast } from '@/components/ui';
import type { SiteSetting } from '@/types';

/**
 * Keys the tab screens render as dedicated controls. Everything else falls into
 * the raw key/value screen; community.copy.* belongs to the copy screen and
 * competition.active_id / community.visibility / community.posting are written by
 * their own endpoints, so exposing them raw would invite double-editing.
 */
const OWNED_KEYS = new Set([
  'site.name',
  'site.tagline',
  'site.rules_md',
  'site.registration_open',
  'site.registration_code',
  'auth.email_verification_required',
  'auth.password_reset_enabled',
  'competition.active_id',
  'community.visibility',
  'community.posting',
]);

const NO_ROWS: SiteSetting[] = [];

export function useAdminSettings() {
  const query = useQuery({
    queryKey: ['admin-settings'],
    queryFn: adminListSettings,
    staleTime: 30_000,
  });

  const rows = query.data ?? NO_ROWS;

  const kv = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of rows) map.set(row.key, row.value);
    return map;
  }, [rows]);

  const miscRows = useMemo(
    () => rows.filter((r) => !OWNED_KEYS.has(r.key) && !r.key.startsWith(COPY_PREFIX)),
    [rows],
  );

  const copyOverrides = useMemo(() => {
    const out: Record<string, string> = {};
    for (const row of rows) {
      if (row.key.startsWith(COPY_PREFIX)) out[row.key] = row.value;
    }
    return out;
  }, [rows]);

  return { query, kv, miscRows, copyOverrides };
}

/**
 * Only the keys that actually changed are sent: SettingService upserts the
 * supplied map and never deletes, so a partial payload is safe and a full one
 * could clobber an edit made from another tab.
 */
export function changedSettings(
  baseline: Record<string, string>,
  current: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(current)) {
    if ((baseline[key] ?? '') !== value) out[key] = value;
  }
  return out;
}

export function useAdminSettingsSave() {
  const qc = useQueryClient();
  const toast = useToast();
  const reloadSite = useSiteStore((s) => s.load);

  return useMutation({
    mutationFn: (values: Record<string, string>) => adminUpdateSettings(values),
    onSuccess: () => {
      toast.success('已保存');
      void qc.invalidateQueries({ queryKey: ['admin-settings'] });
      reloadSite();
    },
    onError: (err) =>
      toast.error(err instanceof ApiClientError ? err.message : '保存失败'),
  });
}
