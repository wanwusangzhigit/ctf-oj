import i18n from '@/locales/i18n';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { Button, Field, Input, Textarea, useToast } from '@/components/ui';
import { MarkdownEditor } from '@/components/MarkdownEditor';
import { adminUpdateCommunityCopy } from '@/api/settings';
import { ApiClientError } from '@/api/client';
import {
  COPY_GROUP_LABEL,
  COMMUNITY_COPY,
  settingKey,
  type CopyGroup,
  type CommunityCopyEntry,
} from '@/lib/communityCopy';

const GROUP_ORDER: CopyGroup[] = ['board', 'composer', 'reply', 'access', 'history'];

/**
 * CommunityCopyEditor — registry-driven overrides for the board's copy.
 *
 * A field left empty stores nothing meaningful: the backend drops empty
 * values from the meta payload and the frontend falls back to the registry
 * default, so clearing a field is how "restore default" works.
 */
export function CommunityCopyEditor({ overrides }: { overrides?: Record<string, string> }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [draft, setDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    setDraft(overrides ? { ...overrides } : {});
  }, [overrides]);

  const grouped = useMemo(() => {
    const map = new Map<CopyGroup, CommunityCopyEntry[]>();
    for (const group of GROUP_ORDER) map.set(group, []);
    for (const entry of COMMUNITY_COPY) {
      map.get(entry.group)?.push(entry);
    }
    return [...map.entries()].filter(([, entries]) => entries.length > 0);
  }, []);

  const dirty = useMemo(
    () => COMMUNITY_COPY.filter((entry) => {
      const key = settingKey(entry.key);
      return (draft[key] ?? '') !== (overrides?.[key] ?? '');
    }),
    [draft, overrides],
  );

  const saveMut = useMutation({
    mutationFn: () => {
      const payload: Record<string, string> = {};
      for (const entry of dirty) {
        const key = settingKey(entry.key);
        payload[key] = (draft[key] ?? '').trim();
      }
      return adminUpdateCommunityCopy(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-settings'] });
      qc.invalidateQueries({ queryKey: ['community-meta'] });
      toast.success(i18n.t('文案已保存'));
    },
    onError: (err) =>
      toast.error(err instanceof ApiClientError ? err.message : i18n.t('保存失败')),
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button
          type="button"
          size="sm"
          variant={dirty.length > 0 ? 'primary' : 'secondary'}
          disabled={dirty.length === 0}
          loading={saveMut.isPending}
          onClick={() => saveMut.mutate()}
        >
          <Save className="h-3.5 w-3.5" />
          {i18n.t('保存文案')}
        </Button>
      </div>

      {grouped.map(([group, entries]) => (
        <div key={group} className="space-y-3">
          <h4 className="font-mono text-2xs text-ink-3 border-b border-rule pb-1">
            {COPY_GROUP_LABEL[group as CopyGroup]}
          </h4>
          {entries.map((entry) => {
            const key = settingKey(entry.key);
            const value = draft[key] ?? '';
            const setValue = (next: string) =>
              setDraft((prev) => ({ ...prev, [key]: next }));
            return (
              <Field key={key} label={entry.label} htmlFor={`copy-${entry.key}`}>
                {entry.kind === 'text' && (
                  <Input
                    id={`copy-${entry.key}`}
                    value={value}
                    placeholder={entry.def}
                    onChange={(e) => setValue(e.target.value)}
                  />
                )}
                {entry.kind === 'textarea' && (
                  <Textarea
                    id={`copy-${entry.key}`}
                    rows={2}
                    value={value}
                    placeholder={entry.def}
                    onChange={(e) => setValue(e.target.value)}
                  />
                )}
                {entry.kind === 'markdown' && (
                  <MarkdownEditor
                    id={`copy-${entry.key}`}
                    rows={3}
                    value={value}
                    placeholder={entry.def}
                    onChange={setValue}
                  />
                )}
              </Field>
            );
          })}
        </div>
      ))}
    </div>
  );
}
