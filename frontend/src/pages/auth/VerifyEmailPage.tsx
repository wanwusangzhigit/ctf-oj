import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
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
  const { token: pathToken } = useParams<{ token: string }>();
  const [search] = useSearchParams();
  const token = pathToken ?? search.get('token') ?? '';
  const toast = useToast();
  const [done, setDone] = useState(false);

  const mut = useMutation({
    mutationFn: () => verifyEmail(token),
    onSuccess: () => {
      toast.success('邮箱已验证');
      setDone(true);
    },
    onError: (err) =>
      toast.error(err instanceof ApiClientError ? err.message : '验证失败'),
  });

  return (
    <AuthFrame title="邮箱验证" subtitle="确认邮箱所有权以激活账号">
      {mut.isPending ? (
        <div className="flex items-center justify-center py-10">
          <Spinner className="h-5 w-5 text-amber" />
        </div>
      ) : done ? (
        <Result
          tone="ok"
          title="验证成功"
          body="你现在可以登录并参与所有题目。"
          action={{ to: '/auth/login', label: '前去登录' }}
        />
      ) : mut.isError ? (
        <Result
          tone="err"
          title="验证失败"
          body={errMessage(mut.error)}
          action={{ to: '/', label: '返回首页' }}
        />
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-ink-2 leading-relaxed">
            点击下方按钮确认邮箱。验证后即可登录参与所有题目。
          </p>
          <Button
            variant="primary"
            className="w-full"
            onClick={() => mut.mutate()}
            disabled={!token}
          >
            确认验证
          </Button>
          {!token && (
            <p className="text-2xs text-oxblood text-center font-mono">
              缺少验证 token —— 请检查邮件中的链接是否完整。
            </p>
          )}
        </div>
      )}
    </AuthFrame>
  );
}

function errMessage(err: unknown): string {
  return err instanceof ApiClientError ? err.message : '验证 token 无效或已过期。';
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
