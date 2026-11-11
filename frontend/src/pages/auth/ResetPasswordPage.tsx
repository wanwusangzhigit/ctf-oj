import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Field, Input, useToast } from '@/components/ui';
import { resetPassword } from '@/api/email';
import { ApiClientError } from '@/api/client';

type FormValues = { password: string; confirm: string };

/**
 * ResetPasswordPage — Step 2: reached via the reset email link.
 * Token comes from the URL. On success, send the user to login.
 */
export function ResetPasswordPage() {
  const { t } = useTranslation();
  const schema = useMemo(
    () =>
      z
        .object({
          password: z
            .string()
            .min(8, t('auth.validation.passwordMin'))
            .max(64, t('auth.validation.passwordMax')),
          confirm: z.string(),
        })
        .refine((v) => v.password === v.confirm, {
          path: ['confirm'],
          message: t('auth.validation.passwordMismatch'),
        }),
    [t],
  );
  const { token: pathToken } = useParams<{ token: string }>();
  const [search] = useSearchParams();
  const token = pathToken ?? search.get('token') ?? '';
  const navigate = useNavigate();
  const toast = useToast();
  const [pending, setPending] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirm: '' },
  });

  const onSubmit = handleSubmit(async ({ confirm: _c, password }) => {
    void _c;
    if (!token) {
      toast.error(t('auth.reset.missingToken'));
      return;
    }
    setPending(true);
    try {
      await resetPassword(token, password);
      toast.success(t('auth.reset.success'));
      navigate('/auth/login', { replace: true });
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : t('auth.reset.failed');
      toast.error(msg);
    } finally {
      setPending(false);
    }
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper p-6">
      <div className="w-full max-w-sm">
        <Link
          to="/"
          className="inline-flex items-center gap-2 mb-8 hover:no-underline border-b-0"
        >
          <span
            aria-hidden
            className="inline-flex h-7 w-7 items-center justify-center bg-ink text-paper rounded-sm relative"
          >
            <span className="absolute inset-[3px] border border-paper/40 rounded-[1px]" />
            <span className="w-1.5 h-1.5 bg-amber relative" />
          </span>
          <span className="font-mono font-semibold tracking-tight">CTF-OJ</span>
        </Link>
        <h1 className="text-xl font-semibold tracking-tight text-ink">{t('auth.reset.title')}</h1>
        <p className="mt-1 text-sm text-ink-3">{t('auth.reset.subtitle')}</p>
        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <Field label={t('auth.reset.newPassword')} htmlFor="password" hint={t('auth.reset.passwordHint')} error={errors.password?.message}>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              invalid={!!errors.password}
              {...register('password')}
            />
          </Field>
          <Field label={t('auth.reset.confirm')} htmlFor="confirm" error={errors.confirm?.message}>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              invalid={!!errors.confirm}
              {...register('confirm')}
            />
          </Field>
          <Button type="submit" loading={pending} className="w-full" size="lg">
            {t('auth.reset.submit')}
          </Button>
        </form>
        <p className="mt-6 text-sm text-ink-3 text-center">
          <Link to="/auth/login" className="text-amber ml-1 font-medium">
            {t('auth.reset.backToLogin')}
          </Link>
        </p>
      </div>
    </div>
  );
}
