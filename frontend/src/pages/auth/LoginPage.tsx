import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Button, Field, Input, useToast } from '@/components/ui';
import { login as apiLogin } from '@/api/auth';
import { useAuthStore } from '@/stores/auth';
import { ApiClientError } from '@/api/client';
import { AuthShell } from './AuthShell';

const schema = z.object({
  account: z.string().min(1, '请输入用户名或邮箱'),
  password: z.string().min(1, '请输入密码'),
});

type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const setAuth = useAuthStore((s) => s.set);
  const [pending, setPending] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { account: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setPending(true);
    try {
      const res = await apiLogin(values.account, values.password);
      setAuth(res.user, res.tokens);
      toast.success('登录成功');
      const redirectTo = (location.state as { from?: string } | null)?.from ?? '/';
      navigate(redirectTo, { replace: true });
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : '登录失败';
      toast.error(msg);
    } finally {
      setPending(false);
    }
  });

  return (
    <AuthShell title="登录账号" subtitle="使用账号继续练习">
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="用户名或邮箱" htmlFor="account" error={errors.account?.message}>
          <Input
            id="account"
            autoComplete="username"
            placeholder="username 或 you@example.com"
            invalid={!!errors.account}
            {...register('account')}
          />
        </Field>
        <Field label="密码" htmlFor="password" error={errors.password?.message}>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            invalid={!!errors.password}
            {...register('password')}
          />
        </Field>
        <Button type="submit" loading={pending} className="w-full" size="lg">
          登录
        </Button>
      </form>
      <p className="mt-6 text-sm text-muted text-center">
        还没有账号？
        <Link to="/auth/register" className="text-accent ml-1 font-medium">
          立即注册
        </Link>
      </p>
    </AuthShell>
  );
}
