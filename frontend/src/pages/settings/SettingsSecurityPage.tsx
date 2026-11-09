import i18n from '@/locales/i18n';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Mail } from 'lucide-react';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Field,
  Input,
  useToast,
} from '@/components/ui';
import { disable2FA, enable2FA, getUser, setup2FA } from '@/api/user';
import { resendVerification } from '@/api/email';
import { ApiClientError } from '@/api/client';
import { useAuthStore } from '@/stores/auth';

/** /settings/security — TOTP enrolment and the email verification nudge. */
export function SettingsSecurityPage() {
  const user = useAuthStore((s) => s.user);
  const profileQ = useQuery({
    queryKey: ['user', user?.id],
    queryFn: () => getUser(user!.id),
    enabled: !!user,
    staleTime: 30_000,
  });
  const profile = profileQ.data ?? user;

  return (
    <div className="space-y-6">
      <TwoFactorPanel enabled={!!profile?.twoFactorEnabled} />
      {profile && !profile.emailVerifiedAt && (
        <EmailVerificationPanel email={profile.email ?? ''} />
      )}
    </div>
  );
}

function EmailVerificationPanel({ email }: { email: string }) {
  const toast = useToast();
  const mut = useMutation({
    mutationFn: resendVerification,
    onSuccess: () => toast.success(i18n.t('验证邮件已发送至 {{v0}}', { v0: email })),
    onError: (err) =>
      toast.error(err instanceof ApiClientError ? err.message : i18n.t('发送失败')),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{i18n.t('邮箱验证')}</CardTitle>
      </CardHeader>
      <CardBody className="flex items-center gap-4">
        <Mail className="h-4 w-4 text-amber shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-ink">{i18n.t('邮箱尚未验证')}</p>
          <p className="mt-0.5 font-mono text-2xs text-ink-3 break-all">{email}</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          loading={mut.isPending}
          onClick={() => mut.mutate()}
        >
          {i18n.t('重发验证邮件')}
        </Button>
      </CardBody>
    </Card>
  );
}

function TwoFactorPanel({ enabled }: { enabled: boolean }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [secret, setSecret] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['user'] });
    void qc.invalidateQueries({ queryKey: ['auth-me'] });
  };
  const fail = (err: unknown) =>
    toast.error(err instanceof ApiClientError ? err.message : i18n.t('操作失败'));

  const setupMut = useMutation({
    mutationFn: setup2FA,
    onSuccess: (data) => setSecret(data),
    onError: fail,
  });
  const enableMut = useMutation({
    mutationFn: () => enable2FA(code.trim()),
    onSuccess: () => {
      toast.success(i18n.t('两步验证已启用'));
      setSecret(null);
      setCode('');
      refresh();
    },
    onError: fail,
  });
  const disableMut = useMutation({
    mutationFn: () => disable2FA(password),
    onSuccess: () => {
      toast.success(i18n.t('两步验证已关闭'));
      setPassword('');
      refresh();
    },
    onError: fail,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{i18n.t('两步验证')}</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        {enabled ? (
          <>
            <p className="text-sm text-ink">
              {i18n.t('已启用 TOTP。登录时需要输入验证器 App 中的 6 位验证码。')}
            </p>
            <Field label={i18n.t('当前密码')} htmlFor="settings-2fa-password" hint={i18n.t('关闭前需确认密码')}>
              <Input
                id="settings-2fa-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </Field>
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                loading={disableMut.isPending}
                disabled={!password}
                onClick={() => disableMut.mutate()}
              >
                {i18n.t('关闭两步验证')}
              </Button>
            </div>
          </>
        ) : secret ? (
          <>
            <p className="text-sm text-ink">
              {i18n.t('在验证器 App 中手动添加以下密钥，然后输入生成的 6 位验证码。')}
            </p>
            <div className="border border-rule bg-paper-2 rounded-sm p-3 space-y-2">
              <div className="font-mono text-sm break-all text-ink">{secret.secret}</div>
              <div className="font-mono text-2xs text-ink-3 break-all">
                {secret.otpauthUrl}
              </div>
            </div>
            <Field label={i18n.t('验证码')} htmlFor="settings-2fa-code">
              <Input
                id="settings-2fa-code"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="000000"
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setSecret(null)}>
                {i18n.t('取消')}
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={enableMut.isPending}
                disabled={code.trim().length !== 6}
                onClick={() => enableMut.mutate()}
              >
                {i18n.t('启用')}
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-ink-3">{i18n.t('启用后登录需要额外的 6 位动态验证码。')}</p>
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                loading={setupMut.isPending}
                onClick={() => setupMut.mutate()}
              >
                {i18n.t('启用两步验证')}
              </Button>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}
