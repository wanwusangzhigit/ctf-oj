import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button, Spinner, useToast } from '@/components/ui';
import { verifyEmail } from '@/api/email';
import { ApiClientError } from '@/api/client';

/**
 * VerifyEmailPage — reached via the link in the verification email.
 * The backend builds links as `.../auth/verify-email?token=XXX`, so we read
 * the token from the query string; a path-segment form is also supported.
 */
export function VerifyEmailPage() {
  const { t } = useTranslation();
  const { token: pathToken } = useParams<{ token: string }>();
  const [search] = useSearchParams();
  const token = pathToken ?? search.get('token') ?? '';
  const toast = useToast();
  const [done, setDone] = useState(false);

  const mut = useMutation({
    mutationFn: () => verifyEmail(token),
    onSuccess: () => {
      toast.success(t('auth.verify.success'));
      setDone(true);
    },
    onError: (err) =>
      toast.error(err instanceof ApiClientError ? err.message : t('auth.verify.failed')),
  });

  const errMessage = (err: unknown): string =>
    err instanceof ApiClientError ? err.message : t('auth.verify.invalidToken');

  return (
    <AuthFrame title={t('auth.verify.title')} subtitle={t('auth.verify.subtitle')}>
      {mut.isPending ? (
        <div className="flex items-center justify-center py-10">
          <Spinner className="h-5 w-5 text-amber" />
        </div>
      ) : done ? (
        <Result
          tone="ok"
          title={t('auth.verify.successTitle')}
          body={t('auth.verify.successBody')}
          action={{ to: '/auth/login', label: t('auth.verify.goLogin') }}
        />
      ) : mut.isError ? (
        <Result
          tone="err"
          title={t('auth.verify.failTitle')}
          body={errMessage(mut.error)}
          action={{ to: '/', label: t('auth.verify.backHome') }}
        />
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-ink-2 leading-relaxed">
            {t('auth.verify.prompt')}
          </p>
          <Button
            variant="primary"
            className="w-full"
            onClick={() => mut.mutate()}
            disabled={!token}
          >
            {t('auth.verify.submit')}
          </Button>
          {!token && (
            <p className="text-2xs text-oxblood text-center font-mono">
              {t('auth.verify.missingToken')}
            </p>
          )}
        </div>
      )}
    </AuthFrame>
  );
}

function Result({
  tone,
  title,
  body,
  action,
}: {
  tone: 'ok' | 'err';
  title: string;
  body: string;
  action: { to: string; label: string };
}) {
  return (
    <div className="text-center space-y-3 py-4">
      <span
        className={`inline-flex h-12 w-12 items-center justify-center rounded-sm mx-auto ${
          tone === 'ok' ? 'bg-amber-soft text-amber' : 'bg-oxblood-bg text-oxblood'
        }`}
      >
        {tone === 'ok' ? (
          <CheckCircle2 className="h-5 w-5" />
        ) : (
          <AlertTriangle className="h-5 w-5" />
        )}
      </span>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-sm text-ink-3 max-w-xs mx-auto">{body}</p>
      <Link
        to={action.to}
        className="inline-flex items-center gap-1 text-amber font-medium text-sm hover:no-underline"
      >
        {action.label} →
      </Link>
    </div>
  );
}

/**
 * Local auth frame — like AuthShell but without the aside column.
 * Used for one-off flows (verify, reset) where the marketing slab would be noise.
 */
function AuthFrame({
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
