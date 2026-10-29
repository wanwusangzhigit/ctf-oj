import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Button, Field, Input, useToast } from '@/components/ui';
import { register as apiRegister } from '@/api/auth';
import { useAuthStore } from '@/stores/auth';
import { useSiteStore } from '@/stores/site';
import { ApiClientError } from '@/api/client';
import { AuthShell } from './AuthShell';
import { safeRedirect } from '@/components/Guards';

const schema = z
  .object({
    username: z
      .string()
      .min(3, '用户名至少 3 个字符')
      .max(32, '用户名最多 32 个字符')
      .regex(/^[a-zA-Z0-9_]+$/, '只能包含字母、数字与下划线'),
    email: z.string().min(1, '请输入邮箱').email('邮箱格式不正确'),
    password: z.string().min(8, '密码至少 8 位').max(64, '密码最多 64 位'),
    confirm: z.string(),
    registrationCode: z.string().optional(),
  })
  .refine((v) => v.password === v.confirm, {
    path: ['confirm'],
    message: '两次输入的密码不一致',
  });

type FormValues = z.infer<typeof schema>;

export function RegisterPage() {
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
        toast.error('请输入注册邀请码');
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
        toast.success('注册成功，欢迎加入');
        const redirect = new URLSearchParams(location.search).get('redirect');
        navigate(safeRedirect(redirect), { replace: true });
      } catch (err) {
        const msg = err instanceof ApiClientError ? err.message : '注册失败';
        toast.error(msg);
      } finally {
        setPending(false);
      }
    },
  );

  return (
    <AuthShell title="创建账号" subtitle="注册后即可开始练习">
      {settings && !settings.registrationOpen ? (
        <div className="space-y-3">
          <p className="text-sm text-ink-2 leading-relaxed">
            当前站点已关闭注册。如需账号，请联系管理员。
          </p>
          <Link
            to={`/auth/login${location.search}`}
            className="inline-flex text-sm text-amber font-medium"
          >
            已有账号？前去登录
          </Link>
        </div>
      ) : (
      <>
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="用户名" htmlFor="username" error={errors.username?.message}>
          <Input
            id="username"
            placeholder="ctf_player"
            autoComplete="username"
            invalid={!!errors.username}
            {...register('username')}
          />
        </Field>
        <Field label="邮箱" htmlFor="email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            invalid={!!errors.email}
            {...register('email')}
          />
        </Field>
        <Field label="密码" htmlFor="password" hint="至少 8 位" error={errors.password?.message}>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            invalid={!!errors.password}
            {...register('password')}
          />
        </Field>
        <Field label="确认密码" htmlFor="confirm" error={errors.confirm?.message}>
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
            label="注册邀请码"
            htmlFor="registrationCode"
            hint="请联系管理员获取"
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
          创建账号
        </Button>
      </form>
      <p className="mt-6 text-sm text-muted text-center">
        已经有账号？
        <Link to={`/auth/login${location.search}`} className="text-accent ml-1 font-medium">
          前去登录
        </Link>
      </p>
      </>
      )}
    </AuthShell>
  );
}
