import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Field, Input, useToast } from '@/components/ui';
import { register as apiRegister } from '@/api/auth';
import { useAuthStore } from '@/stores/auth';
import { useSiteStore } from '@/stores/site';
import { ApiClientError } from '@/api/client';
import { AuthShell } from './AuthShell';
import { safeRedirect } from '@/components/Guards';

type FormValues = {
  username: string;
  email: string;
  password: string;
  confirm: string;
  registrationCode?: string;
};

export function RegisterPage() {
  const { t } = useTranslation();
  const schema = useMemo(
    () =>
      z
        .object({
          username: z
            .string()
            .min(3, t('auth.validation.usernameMin'))
            .max(32, t('auth.validation.usernameMax'))
            .regex(/^[a-zA-Z0-9_]+$/, t('auth.validation.usernamePattern')),
          email: z
            .string()
            .min(1, t('auth.validation.emailRequired'))
            .email(t('auth.validation.emailInvalid')),
          password: z
            .string()
            .min(8, t('auth.validation.passwordMin'))
            .max(64, t('auth.validation.passwordMax')),
          confirm: z.string(),
          registrationCode: z.string().optional(),
        })
        .refine((v) => v.password === v.confirm, {
          path: ['confirm'],
          message: t('auth.validation.passwordMismatch'),
        }),
    [t],
  );
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const setAuth = useAuthStore((s) => s.set);
  const settings = useSiteStore((s) => s.settings);
  const needsCode = !!settings?.hasRegistrationCode;
  const [pending, setPending] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      username: '',
      email: '',
      password: '',
      confirm: '',
      registrationCode: '',
    },
  });

  const onSubmit = handleSubmit(
    async ({ confirm: _confirm, registrationCode, ...payload }) => {
      void _confirm;
      if (needsCode && !registrationCode) {
        toast.error(t('auth.register.codeRequired'));
        return;
      }
      setPending(true);
      try {
        const res = await apiRegister(
          payload.username,
          payload.email,
          payload.password,
          registrationCode || undefined,
        );
        setAuth(res.user);
        toast.success(t('auth.register.success'));
        const redirect = new URLSearchParams(location.search).get('redirect');
        navigate(safeRedirect(redirect), { replace: true });
      } catch (err) {
        const msg = err instanceof ApiClientError ? err.message : t('auth.register.failed');
        toast.error(msg);
      } finally {
        setPending(false);
      }
    },
  );

  return (
    <AuthShell title={t('auth.register.title')} subtitle={t('auth.register.subtitle')}>
      {settings && !settings.registrationOpen ? (
        <div className="space-y-3">
          <p className="text-sm text-ink-2 leading-relaxed">
            {t('auth.register.closed')}
          </p>
          <Link
            to={`/auth/login${location.search}`}
            className="inline-flex text-sm text-amber font-medium"
          >
            {t('auth.register.hasAccount')}
          </Link>
        </div>
      ) : (
      <>
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label={t('auth.register.username')} htmlFor="username" error={errors.username?.message}>
          <Input
            id="username"
            placeholder="ctf_player"
            autoComplete="username"
            invalid={!!errors.username}
            {...register('username')}
          />
        </Field>
        <Field label={t('auth.register.email')} htmlFor="email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            invalid={!!errors.email}
            {...register('email')}
          />
        </Field>
        <Field label={t('auth.register.password')} htmlFor="password" hint={t('auth.register.passwordHint')} error={errors.password?.message}>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            invalid={!!errors.password}
            {...register('password')}
          />
        </Field>
        <Field label={t('auth.register.confirm')} htmlFor="confirm" error={errors.confirm?.message}>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            invalid={!!errors.confirm}
            {...register('confirm')}
          />
        </Field>
        {needsCode && (
          <Field
            label={t('auth.register.inviteCode')}
            htmlFor="registrationCode"
            hint={t('auth.register.inviteHint')}
            error={errors.registrationCode?.message}
          >
            <Input
              id="registrationCode"
              placeholder="REG-CODE"
              autoComplete="off"
              invalid={!!errors.registrationCode}
              {...register('registrationCode')}
            />
          </Field>
        )}
        <Button type="submit" loading={pending} className="w-full" size="lg">
          {t('auth.register.submit')}
        </Button>
      </form>
      <p className="mt-6 text-sm text-muted text-center">
        {t('auth.register.already')}
        <Link to={`/auth/login${location.search}`} className="text-accent ml-1 font-medium">
          {t('auth.register.goLogin')}
        </Link>
      </p>
      </>
      )}
    </AuthShell>
  );
}
