import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { Button, Field, Input, useToast } from '@/components/ui';
import { forgotPassword } from '@/api/email';
import { useSiteStore } from '@/stores/site';
import { ApiClientError } from '@/api/client';

const schema = z.object({
  account: z.string().min(1, '请输入用户名或邮箱'),
});

type FormValues = z.infer<typeof schema>;

/**
 * ForgotPasswordPage — Step 1: collect account identifier.
 * Server always returns ok (don't leak whether account exists);
 * the actual reset link is sent to the user's email if it does.
 */
export function ForgotPasswordPage() {
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
      const msg = err instanceof ApiClientError ? err.message : '请求失败';
      toast.error(msg);
    } finally {
      setPending(false);
    }
  });

  if (settings && !enabled) {
    return (
      <Frame title="密码重置未开放" subtitle="该功能已被管理员关闭">
        <div className="space-y-4">
          <p className="text-sm text-ink-2 leading-relaxed">
            当前站点未开放自助密码重置。请联系管理员协助找回账号。
          </p>
          <Link
            to="/auth/login"
            className="block text-center text-amber font-medium text-sm hover:no-underline"
          >
            返回登录 →
          </Link>
        </div>
      </Frame>
    );
  }

  if (sent) {
    return (
      <Frame title="重置链接已发送" subtitle="检查你的邮箱完成重置">
        <div className="space-y-4">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-sm bg-amber-soft text-amber mx-auto">
            <CheckCircle2 className="h-5 w-5" />
          </span>
          <p className="text-sm text-ink-2 leading-relaxed">
            如果账号存在，重置链接已发送至账号绑定的邮箱。链接 1 小时内有效。
          </p>
          <Link
            to="/auth/login"
            className="block text-center text-amber font-medium text-sm hover:no-underline"
          >
            返回登录 →
          </Link>
        </div>
      </Frame>
    );
  }

  return (
    <Frame title="找回密码" subtitle="输入用户名或邮箱以接收重置链接">
      <form onSubmit={onSubmit} className="space-y-4">
        <Field
          label="用户名或邮箱"
          htmlFor="account"
          error={errors.account?.message}
        >
          <Input
            id="account"
            autoComplete="username"
            placeholder="username 或 you@example.com"
            invalid={!!errors.account}
            {...register('account')}
          />
        </Field>
        <Button type="submit" loading={pending} className="w-full" size="lg">
          发送重置链接
        </Button>
      </form>
      <p className="mt-6 text-sm text-ink-3 text-center">
        想起来了？
        <Link to="/auth/login" className="text-amber ml-1 font-medium">
          返回登录
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
