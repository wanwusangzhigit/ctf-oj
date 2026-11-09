import i18n from '@/locales/i18n';
import { useEffect, useMemo, useState } from 'react';
import { Field, Input, Textarea } from '@/components/ui';
import { Section, SaveBar } from '@/components/admin/SettingsSection';
import {
  changedSettings,
  useAdminSettings,
  useAdminSettingsSave,
} from '@/hooks/useAdminSettings';

export function AdminSettingsBrandPage() {
  const { query, kv } = useAdminSettings();
  const saveMut = useAdminSettingsSave();
  const [draft, setDraft] = useState({ name: '', tagline: '', rules: '' });

  useEffect(() => {
    if (!query.data) return;
    setDraft({
      name: kv.get('site.name') ?? '',
      tagline: kv.get('site.tagline') ?? '',
      rules: kv.get('site.rules_md') ?? '',
    });
  }, [query.data, kv]);

  const baseline = useMemo(
    () => ({
      'site.name': kv.get('site.name') ?? '',
      'site.tagline': kv.get('site.tagline') ?? '',
      'site.rules_md': kv.get('site.rules_md') ?? '',
    }),
    [kv],
  );

  const changed = changedSettings(baseline, {
    'site.name': draft.name,
    'site.tagline': draft.tagline,
    'site.rules_md': draft.rules,
  });

  return (
    <div className="space-y-8">
      <Section title={i18n.t('品牌')}>
        <Field label={i18n.t('站点名称')} htmlFor="siteName" hint={i18n.t('将出现在顶部导航与首页')}>
          <Input
            id="siteName"
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          />
        </Field>
        <Field label={i18n.t('标语')} htmlFor="tagline" hint={i18n.t('首页副标题')}>
          <Input
            id="tagline"
            value={draft.tagline}
            onChange={(e) => setDraft((d) => ({ ...d, tagline: e.target.value }))}
          />
        </Field>
        <Field
          label={i18n.t('站点规则（Markdown）')}
          htmlFor="rules"
          hint={i18n.t('注册页 / 公告页可引用此片段')}
        >
          <Textarea
            id="rules"
            rows={6}
            value={draft.rules}
            onChange={(e) => setDraft((d) => ({ ...d, rules: e.target.value }))}
          />
        </Field>
      </Section>

      <SaveBar
        dirty={Object.keys(changed).length > 0}
        pending={saveMut.isPending}
        onSave={() => saveMut.mutate(changed)}
      />
    </div>
  );
}
