import { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui';
import { SaveBar, Section } from '@/components/admin/SettingsSection';
import {
  changedSettings,
  useAdminSettings,
  useAdminSettingsSave,
} from '@/hooks/useAdminSettings';

export function AdminSettingsMiscPage() {
  const { query, miscRows } = useAdminSettings();
  const saveMut = useAdminSettingsSave();
  const [draft, setDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!query.data) return;
    const next: Record<string, string> = {};
    for (const row of miscRows) next[row.key] = row.value;
    setDraft(next);
  }, [query.data, miscRows]);

  const baseline = useMemo(() => {
    const next: Record<string, string> = {};
    for (const row of miscRows) next[row.key] = row.value;
    return next;
  }, [miscRows]);

  const changed = changedSettings(baseline, draft);

  return (
    <div className="space-y-8">
      {miscRows.length === 0 ? (
        <p className="text-sm text-ink-3">
          没有其它自定义键。品牌、注册与认证、社区文案、社区策略各有专属分页。
        </p>
      ) : (
        <>
          <Section title="其他设置">
            <p className="text-2xs text-ink-3">
              直接编辑 site_settings 中未被专属分页接管的键。
            </p>
            <div className="space-y-2">
              {miscRows.map((row) => (
                <div key={row.key} className="grid grid-cols-[200px_1fr] gap-3 items-center">
                  <span className="font-mono text-2xs text-ink-3 truncate">{row.key}</span>
                  <Input
                    value={draft[row.key] ?? row.value}
                    onChange={(e) => {
                      const value = e.target.value;
                      setDraft((prev) => ({ ...prev, [row.key]: value }));
                    }}
                  />
                </div>
              ))}
            </div>
          </Section>

          <SaveBar
            dirty={Object.keys(changed).length > 0}
            pending={saveMut.isPending}
            onSave={() => saveMut.mutate(changed)}
          />
        </>
      )}
    </div>
  );
}
