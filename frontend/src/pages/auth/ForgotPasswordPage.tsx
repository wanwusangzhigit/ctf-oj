import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle2 } from 'lucide-react';
import { Button, Field, Input, useToast } from '@/components/ui';
import { forgotPassword } from '@/api/email';
import { useSiteStore } from '@/stores/site';
import { ApiClientError } from '@/api/client';

type FormValues = { account: string };

/**
 * ForgotPasswordPage — Step 1: collect account identifier.
 * Server always returns ok (don't leak whether account exists);
 * the actual reset link is sent to the user's email if it does.
 */
export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const schema = useMemo(
    () => z.object({ account: z.string().min(1, t('auth.validation.accountRequired')) }),
    [t],
  );
  const toast = useToast();
  const settings = useSiteStore((s) => s.settings);
  const enabled = settings?.passwordResetEnabled ?? false;
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { account: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setPending(true);
    try {
      await forgotPassword(values.account);
      setSent(true);
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : t('auth.forgot.failed');
      toast.error(msg);
    } finally {
      setPending(false);
    }
  });

  if (settings && !enabled) {
    return (
      <Frame title={t('auth.forgot.disabledTitle')} subtitle={t('auth.forgot.disabledSubtitle')}>
        <div className="space-y-4">
          <p className="text-sm text-ink-2 leading-relaxed">
            {t('auth.forgot.disabledBody')}
          </p>
          <Link
            to="/auth/login"
            className="block text-center text-amber font-medium text-sm hover:no-underline"
          >
            {t('auth.forgot.backToLogin')} →
          </Link>
        </div>
      </Frame>
    );
  }

  if (sent) {
    return (
      <Frame title={t('auth.forgot.sentTitle')} subtitle={t('auth.forgot.sentSubtitle')}>
        <div className="space-y-4">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-sm bg-amber-soft text-amber mx-auto">
            <CheckCircle2 className="h-5 w-5" />
          </span>
          <p className="text-sm text-ink-2 leading-relaxed">
            {t('auth.forgot.sentBody')}
          </p>
          <Link
            to="/auth/login"
            className="block text-center text-amber font-medium text-sm hover:no-underline"
          >
            {t('auth.forgot.backToLogin')} →
          </Link>
        </div>
      </Frame>
    );
  }

  return (
    <Frame title={t('auth.forgot.title')} subtitle={t('auth.forgot.subtitle')}>
      <form onSubmit={onSubmit} className="space-y-4">
        <Field
          label={t('auth.forgot.account')}
          htmlFor="account"
          error={errors.account?.message}
        >
          <Input
            id="account"
            autoComplete="username"
            placeholder="username or you@example.com"
            invalid={!!errors.account}
            {...register('account')}
          />
        </Field>
        <Button type="submit" loading={pending} className="w-full" size="lg">
          {t('auth.forgot.submit')}
        </Button>
      </form>
      <p className="mt-6 text-sm text-ink-3 text-center">
        {t('auth.forgot.remembered')}
        <Link to="/auth/login" className="text-amber ml-1 font-medium">
          {t('auth.forgot.backToLogin')}
        </Link>
      </p>
    </Frame>
  );
}

function Frame({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
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
        <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
        <p className="mt-1 text-sm text-ink-3">{subtitle}</p>
        <div className="mt-8">{children}</div>
      </div>
    </div>
  );
}
