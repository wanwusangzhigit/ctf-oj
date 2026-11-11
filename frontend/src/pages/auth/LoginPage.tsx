import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Field, Input, useToast } from '@/components/ui';
import { login as apiLogin } from '@/api/auth';
import { useAuthStore } from '@/stores/auth';
import { useSiteStore } from '@/stores/site';
import { ApiClientError } from '@/api/client';
import { AuthShell } from './AuthShell';
import { safeRedirect } from '@/components/Guards';

type FormValues = { account: string; password: string; totpCode?: string };

export function LoginPage() {
  const { t } = useTranslation();
  const schema = useMemo(
    () =>
      z.object({
        account: z.string().min(1, t('auth.validation.accountRequired')),
        password: z.string().min(1, t('auth.validation.passwordRequired')),
        totpCode: z.string().optional(),
      }),
    [t],
  );
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const setAuth = useAuthStore((s) => s.set);
  const settings = useSiteStore((s) => s.settings);
  const canResetPassword = settings?.passwordResetEnabled ?? false;
  const registrationOpen = settings?.registrationOpen ?? true;
  const [pending, setPending] = useState(false);
  const [needTOTP, setNeedTOTP] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { account: '', password: '', totpCode: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setPending(true);
    try {
      const res = await apiLogin(values.account, values.password, values.totpCode);
      setAuth(res.user);
      toast.success(t('auth.login.success'));
      const queryRedirect = new URLSearchParams(location.search).get('redirect');
      const stateRedirect = (location.state as { from?: string } | null)?.from;
      navigate(safeRedirect(queryRedirect ?? stateRedirect), { replace: true });
    } catch (err) {
      if (err instanceof ApiClientError && err.code === 40101) {
        setNeedTOTP(true);
        toast.error(t('auth.login.totpRequired'));
        return;
      }
      const msg = err instanceof ApiClientError ? err.message : t('auth.login.failed');
      toast.error(msg);
    } finally {
      setPending(false);
    }
  });

  return (
    <AuthShell title={t('auth.login.title')} subtitle={t('auth.login.subtitle')}>
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label={t('auth.login.account')} htmlFor="account" error={errors.account?.message}>
          <Input
            id="account"
            autoComplete="username"
            placeholder="username or you@example.com"
            invalid={!!errors.account}
            {...register('account')}
          />
        </Field>
        <Field label={t('auth.login.password')} htmlFor="password" error={errors.password?.message}>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            invalid={!!errors.password}
            {...register('password')}
          />
        </Field>
        {needTOTP && (
          <Field label={t('auth.login.totp')} htmlFor="totpCode" hint={t('auth.login.totpHint')}>
            <Input
              id="totpCode"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              {...register('totpCode')}
            />
          </Field>
        )}
        <div className="flex justify-end">
          {canResetPassword && (
            <Link
              to="/auth/forgot-password"
              className="text-2xs text-ink-3 hover:text-amber transition-colors hover:no-underline"
            >
              {t('auth.login.forgot')}
            </Link>
          )}
        </div>
        <Button type="submit" loading={pending} className="w-full" size="lg">
          {t('auth.login.submit')}
        </Button>
      </form>
      {registrationOpen && (
        <p className="mt-6 text-sm text-muted text-center">
          {t('auth.login.noAccount')}
          <Link
            to={`/auth/register${location.search}`}
            className="text-accent ml-1 font-medium"
          >
            {t('auth.login.registerNow')}
          </Link>
        </p>
      )}
    </AuthShell>
  );
}
