import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button, Field, Input, useToast } from '@/components/ui';
import { resetPassword } from '@/api/email';
import { ApiClientError } from '@/api/client';

const schema = z
  .object({
    password: z.string().min(8, '密码至少 8 位').max(64, '密码最多 64 位'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    path: ['confirm'],
    message: '两次输入的密码不一致',
  });

type FormValues = z.infer<typeof schema>;

/**
 * ResetPasswordPage — Step 2: reached via the reset email link.
 * Token comes from the URL. On success, send the user to login.
 */
export function ResetPasswordPage() {
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
      toast.error('缺少重置 token');
      return;
    }
    setPending(true);
    try {
      await resetPassword(token, password);
      toast.success('密码已重置，请重新登录');
      navigate('/auth/login', { replace: true });
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : '重置失败';
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
        <h1 className="text-xl font-semibold tracking-tight text-ink">设置新密码</h1>
        <p className="mt-1 text-sm text-ink-3">为账号设置一个新的登录密码</p>
        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <Field label="新密码" htmlFor="password" hint="至少 8 位" error={errors.password?.message}>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              invalid={!!errors.password}
              {...register('password')}
            />
          </Field>
          <Field label="确认新密码" htmlFor="confirm" error={errors.confirm?.message}>
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
            重置密码
          </Button>
        </form>
        <p className="mt-6 text-sm text-ink-3 text-center">
          <Link to="/auth/login" className="text-amber ml-1 font-medium">
            返回登录
          </Link>
        </p>
      </div>
    </div>
  );
}
