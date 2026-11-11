import i18n from '@/locales/i18n';
import { useEffect, useMemo, useState } from 'react';
import { Field, Input } from '@/components/ui';
import { SaveBar, Section, Toggle } from '@/components/admin/SettingsSection';
import {
  changedSettings,
  useAdminSettings,
  useAdminSettingsSave,
} from '@/hooks/useAdminSettings';

const DEFAULTS = {
  'site.registration_open': 'true',
  'site.registration_code': '',
  'auth.email_verification_required': 'false',
  'auth.password_reset_enabled': 'true',
};

export function AdminSettingsRegistrationPage() {
  const { query, kv } = useAdminSettings();
  const saveMut = useAdminSettingsSave();
  const [draft, setDraft] = useState(DEFAULTS);

  useEffect(() => {
    if (!query.data) return;
    setDraft({
      'site.registration_open': kv.get('site.registration_open') ?? DEFAULTS['site.registration_open'],
      'site.registration_code': kv.get('site.registration_code') ?? DEFAULTS['site.registration_code'],
      'auth.email_verification_required': kv.get('auth.email_verification_required') ?? DEFAULTS['auth.email_verification_required'],
      'auth.password_reset_enabled': kv.get('auth.password_reset_enabled') ?? DEFAULTS['auth.password_reset_enabled'],
    });
  }, [query.data, kv]);

  const baseline = useMemo(
    () => ({
      'site.registration_open': kv.get('site.registration_open') ?? DEFAULTS['site.registration_open'],
      'site.registration_code': kv.get('site.registration_code') ?? DEFAULTS['site.registration_code'],
      'auth.email_verification_required': kv.get('auth.email_verification_required') ?? DEFAULTS['auth.email_verification_required'],
      'auth.password_reset_enabled': kv.get('auth.password_reset_enabled') ?? DEFAULTS['auth.password_reset_enabled'],
    }),
    [kv],
  );

  const changed = changedSettings(baseline, draft);
  const on = (key: keyof typeof DEFAULTS) => draft[key] === 'true';
  const set = (key: keyof typeof DEFAULTS, value: string) =>
    setDraft((d) => ({ ...d, [key]: value }));

  return (
    <div className="space-y-8">
      <Section title={i18n.t('注册与认证')}>
        <Toggle
          label={i18n.t('开放注册')}
          description={i18n.t('关闭后，新人无法通过 /auth/register 创建账号')}
          checked={on('site.registration_open')}
          onChange={(v) => set('site.registration_open', v ? 'true' : 'false')}
        />
        <Field
          label={i18n.t('注册邀请码')}
          htmlFor="regCode"
          hint={i18n.t('设置后，注册时必须填写该值；留空则不强制')}
        >
          <Input
            id="regCode"
            value={draft['site.registration_code']}
            onChange={(e) => set('site.registration_code', e.target.value)}
            placeholder={i18n.t('（无）')}
          />
        </Field>
        <Toggle
          label={i18n.t('注册后必须验证邮箱')}
          description={i18n.t('未验证邮箱的用户将被禁止提交（仅当 mailer 已配置时启用）')}
          checked={on('auth.email_verification_required')}
          onChange={(v) => set('auth.email_verification_required', v ? 'true' : 'false')}
        />
        <Toggle
          label={i18n.t('开放密码重置')}
          description={i18n.t('关闭后，/auth/forgot-password 接口将拒绝请求')}
          checked={on('auth.password_reset_enabled')}
          onChange={(v) => set('auth.password_reset_enabled', v ? 'true' : 'false')}
        />
      </Section>

      <SaveBar
        dirty={Object.keys(changed).length > 0}
        pending={saveMut.isPending}
        onSave={() => saveMut.mutate(changed)}
      />
    </div>
  );
}
