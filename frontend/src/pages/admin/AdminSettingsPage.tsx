import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import {
  Button,
  Field,
  Input,
  Textarea,
  Spinner,
  useToast,
} from '@/components/ui';
import { adminListSettings, adminUpdateSettings } from '@/api/settings';
import { adminBroadcast } from '@/api/admin';
import { useSiteStore } from '@/stores/site';
import { ApiClientError } from '@/api/client';

/**
 * AdminSettingsPage — editable view of every site_setting row.
 * Keys with reserved prefixes (system.*) are filtered server-side.
 *
 * Two semi-structured groups at top (branding + registration),
 * then a raw key/value editor for everything else. community.copy.*
 * belongs to /admin/community, so it stays out of the raw list.
 */
export function AdminSettingsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const reloadSite = useSiteStore((s) => s.load);

  const listQ = useQuery({
    queryKey: ['admin-settings'],
    queryFn: adminListSettings,
    staleTime: 30_000,
  });

  const [branding, setBranding] = useState({ siteName: '', siteTagline: '' });
  const [rules, setRules] = useState('');
  const [registrationOpen, setRegistrationOpen] = useState(true);
  const [emailVerify, setEmailVerify] = useState(false);
  const [pwReset, setPwReset] = useState(true);
  const [registrationCode, setRegistrationCode] = useState('');
  const [extra, setExtra] = useState<Array<{ key: string; value: string }>>([]);
  const [mailSubject, setMailSubject] = useState('');
  const [mailBody, setMailBody] = useState('');
  const [baseline, setBaseline] = useState('');

  useEffect(() => {
    if (!listQ.data) return;
    const kv = new Map<string, string>();
    for (const row of listQ.data) kv.set(row.key, row.value);

    setBranding({
      siteName: kv.get('site.name') ?? '',
      siteTagline: kv.get('site.tagline') ?? '',
    });
    setRules(kv.get('site.rules_md') ?? '');
    setRegistrationOpen((kv.get('site.registration_open') ?? 'true') === 'true');
    setEmailVerify((kv.get('auth.email_verification_required') ?? 'false') === 'true');
    setPwReset((kv.get('auth.password_reset_enabled') ?? 'true') === 'true');
    setRegistrationCode(kv.get('site.registration_code') ?? '');

    const reserved = new Set([
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
    const etc = listQ.data
      .filter((r) => !reserved.has(r.key) && !r.key.startsWith('community.copy.'))
      .map((r) => ({ key: r.key, value: r.value }));
    setExtra(etc);
    const initial: Record<string, string> = {
      'site.name': kv.get('site.name') ?? '',
      'site.tagline': kv.get('site.tagline') ?? '',
      'site.rules_md': kv.get('site.rules_md') ?? '',
      'site.registration_open': kv.get('site.registration_open') ?? 'true',
      'site.registration_code': kv.get('site.registration_code') ?? '',
      'auth.email_verification_required':
        kv.get('auth.email_verification_required') ?? 'false',
      'auth.password_reset_enabled': kv.get('auth.password_reset_enabled') ?? 'true',
    };
    for (const r of etc) initial[r.key] = r.value;
    setBaseline(JSON.stringify(initial));
  }, [listQ.data]);

  const saveMut = useMutation({
    mutationFn: (values: Record<string, string>) => adminUpdateSettings(values),
    onSuccess: (_data, values) => {
      toast.success('已保存');
      setBaseline(JSON.stringify(values));
      qc.invalidateQueries({ queryKey: ['admin-settings'] });
      reloadSite();
    },
    onError: (err) =>
      toast.error(err instanceof ApiClientError ? err.message : '保存失败'),
  });

  const broadcastMut = useMutation({
    mutationFn: adminBroadcast,
  });

  const currentPayload: Record<string, string> = {
    'site.name': branding.siteName,
    'site.tagline': branding.siteTagline,
    'site.rules_md': rules,
    'site.registration_open': registrationOpen ? 'true' : 'false',
    'site.registration_code': registrationCode,
    'auth.email_verification_required': emailVerify ? 'true' : 'false',
    'auth.password_reset_enabled': pwReset ? 'true' : 'false',
  };
  for (const r of extra) currentPayload[r.key] = r.value;
  const dirty = baseline !== '' && baseline !== JSON.stringify(currentPayload);
  const onSave = () => saveMut.mutate(currentPayload);

  if (listQ.isLoading) {
    return (
      <div className="py-10 flex items-center justify-center">
        <Spinner className="h-5 w-5 text-ink-3" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="border-t-2 border-ink pt-6">
        <p className="font-mono text-2xs text-ink-3 mb-3">$ sudo admin --settings</p>
        <h2 className="text-2xl font-semibold tracking-tight text-ink">站点设置</h2>
        <p className="mt-1 text-sm text-ink-3 max-w-prose">
          所有运行时可配置项 —— 不需要重启服务即可生效。
        </p>
      </header>

      <Section title="品牌">
        <Field label="站点名称" htmlFor="siteName" hint="将出现在顶部导航与首页">
          <Input
            id="siteName"
            value={branding.siteName}
            onChange={(e) =>
              setBranding((b) => ({ ...b, siteName: e.target.value }))
            }
          />
        </Field>
        <Field label="标语" htmlFor="tagline" hint="首页副标题">
          <Input
            id="tagline"
            value={branding.siteTagline}
            onChange={(e) =>
              setBranding((b) => ({ ...b, siteTagline: e.target.value }))
            }
          />
        </Field>
        <Field
          label="站点规则（Markdown）"
          htmlFor="rules"
          hint="注册页 / 公告页可引用此片段"
        >
          <Textarea
            id="rules"
            rows={6}
            value={rules}
            onChange={(e) => setRules(e.target.value)}
          />
        </Field>
      </Section>

      <Section title="注册与认证">
        <Toggle
          label="开放注册"
          description="关闭后，新人无法通过 /auth/register 创建账号"
          checked={registrationOpen}
          onChange={setRegistrationOpen}
        />
        <Field
          label="注册邀请码"
          htmlFor="regCode"
          hint="设置后，注册时必须填写该值；留空则不强制"
        >
          <Input
            id="regCode"
            value={registrationCode}
            onChange={(e) => setRegistrationCode(e.target.value)}
            placeholder="（无）"
          />
        </Field>
        <Toggle
          label="注册后必须验证邮箱"
          description="未验证邮箱的用户将被禁止提交（仅当 mailer 已配置时启用）"
          checked={emailVerify}
          onChange={setEmailVerify}
        />
        <Toggle
          label="开放密码重置"
          description="关闭后，/auth/forgot-password 接口将拒绝请求"
          checked={pwReset}
          onChange={setPwReset}
        />
      </Section>

      {extra.length > 0 && (
        <Section title="其他设置">
          <div className="space-y-2">
            {extra.map((row, idx) => (
              <div
                key={row.key}
                className="grid grid-cols-[200px_1fr] gap-3 items-center"
              >
                <span className="font-mono text-2xs text-ink-3 truncate">
                  {row.key}
                </span>
                <Input
                  value={row.value}
                  onChange={(e) => {
                    const v = e.target.value;
                    setExtra((prev) =>
                      prev.map((r, i) => (i === idx ? { ...r, value: v } : r)),
                    );
                  }}
                />
              </div>
            ))}
          </div>
        </Section>
      )}

      <div className="flex items-center gap-3 border-t border-rule pt-4">
        <Button
          variant="primary"
          onClick={onSave}
          loading={saveMut.isPending}
          disabled={!dirty}
        >
          <Save className="h-3.5 w-3.5" />
          保存全部
        </Button>
        <span className="text-2xs text-ink-3">
          {dirty ? '有未保存的更改' : '所有更改已保存'}
        </span>
      </div>

      <Section title="邮件群发">
        <p className="text-2xs text-ink-3">
          向所有未封禁用户发送纯文本邮件。请谨慎使用。
        </p>
        <Field label="主题">
          <Input
            value={mailSubject}
            maxLength={200}
            onChange={(e) => setMailSubject(e.target.value)}
          />
        </Field>
        <Field label="正文">
          <Textarea
            rows={5}
            value={mailBody}
            maxLength={10000}
            onChange={(e) => setMailBody(e.target.value)}
          />
        </Field>
        <div className="flex justify-end">
          <Button
            variant="outline"
            disabled={!mailSubject.trim() || !mailBody.trim() || broadcastMut.isPending}
            loading={broadcastMut.isPending}
            onClick={() => {
              if (!confirm('确认向所有用户发送这封邮件？')) return;
              broadcastMut.mutate(
                { subject: mailSubject, body: mailBody },
                {
                  onSuccess: (res) => {
                    toast.success(`发送完成：成功 ${res.sent}，失败 ${res.failed}`);
                    setMailSubject('');
                    setMailBody('');
                  },
                  onError: (err) =>
                    toast.error(err instanceof ApiClientError ? err.message : '发送失败'),
                },
              );
            }}
          >
            发送
          </Button>
        </div>
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-rule pt-5">
      <h3 className="text-sm font-medium text-ink mb-3">{title}</h3>
      <div className="space-y-4 max-w-2xl">{children}</div>
    </section>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <span className="mt-0.5 inline-flex h-4 w-7 rounded-full border border-rule bg-paper-2 relative shrink-0 transition-colors group-hover:border-rule-strong">
        <span
          className={`absolute top-0.5 h-3 w-3 rounded-full transition-all ${
            checked ? 'left-3 bg-amber' : 'left-0.5 bg-ink-3'
          }`}
        />
      </span>
      <span className="flex-1">
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="block text-sm font-medium text-ink">{label}</span>
        <span className="block text-2xs text-ink-3 mt-0.5">{description}</span>
      </span>
    </label>
  );
}
