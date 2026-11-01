import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Field,
  Input,
  Textarea,
  useToast,
} from '@/components/ui';
import { adminResetPassword, adminUpdateUser } from '@/api/admin';
import { ApiClientError } from '@/api/client';
import { ROLE_LABEL } from '@/lib/permissions';
import type { Role, User } from '@/types';

const SELECT_CLS =
  'h-9 px-2 w-full bg-paper border border-rule rounded-sm text-sm focus:outline-none focus:border-amber transition-colors';

const ROLES: Role[] = ['user', 'challenge_admin', 'competition_admin', 'moderator', 'admin'];

const manageSchema = z.object({
  role: z.enum(['user', 'challenge_admin', 'competition_admin', 'moderator', 'admin']),
  isBanned: z.boolean(),
  bannedReason: z.string().max(200, '封禁原因最长 200 字符'),
  scoreExcluded: z.boolean(),
});

type ManageValues = z.infer<typeof manageSchema>;

function manageValuesFrom(user: User): ManageValues {
  return {
    role: user.role,
    isBanned: user.isBanned ?? false,
    bannedReason: user.bannedReason ?? '',
    scoreExcluded: user.scoreExcluded ?? false,
  };
}

/**
 * Only fields that actually changed are sent: the backend writes
 * `banned_reason`/`banned_at` whenever `isBanned` is present, so a no-op save
 * would otherwise rewrite the ban timestamp.
 */
function buildPatch(
  user: User,
  values: ManageValues,
): Parameters<typeof adminUpdateUser>[1] {
  const patch: Parameters<typeof adminUpdateUser>[1] = {};
  const reason = values.bannedReason.trim();
  if (values.role !== user.role) patch.role = values.role;
  if (
    values.isBanned !== (user.isBanned ?? false) ||
    (values.isBanned && reason !== (user.bannedReason ?? ''))
  ) {
    patch.isBanned = values.isBanned;
    patch.bannedReason = values.isBanned ? reason : '';
  }
  if (values.scoreExcluded !== (user.scoreExcluded ?? false)) {
    patch.scoreExcluded = values.scoreExcluded;
  }
  return patch;
}

export function UserManageForm({ user }: { user: User }) {
  const qc = useQueryClient();
  const toast = useToast();
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty },
  } = useForm<ManageValues>({
    resolver: zodResolver(manageSchema),
    defaultValues: manageValuesFrom(user),
  });

  useEffect(() => {
    reset(manageValuesFrom(user));
  }, [user, reset]);

  const mut = useMutation({
    mutationFn: (patch: Parameters<typeof adminUpdateUser>[1]) =>
      adminUpdateUser(user.id, patch),
    onSuccess: () => {
      toast.success('已更新');
      qc.invalidateQueries({ queryKey: ['admin-user', user.id] });
      qc.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err) =>
      toast.error(err instanceof ApiClientError ? err.message : '操作失败'),
  });

  const isBanned = watch('isBanned');
  const scoreExcluded = watch('scoreExcluded');
  const onSubmit = handleSubmit((values) => {
    const patch = buildPatch(user, values);
    if (Object.keys(patch).length > 0) mut.mutate(patch);
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>权限与状态</CardTitle>
      </CardHeader>
      <CardBody>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field
            label="角色"
            htmlFor="user-role"
            hint="变更在该用户的下一次请求时生效"
            error={errors.role?.message}
          >
            <select
              id="user-role"
              className={SELECT_CLS}
              {...register('role')}
            >
              {ROLES.map((value) => (
                <option key={value} value={value}>
                  {ROLE_LABEL[value]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="封禁" htmlFor="user-banned" hint="封禁后该账号无法登录与调用接口">
            <label className="flex items-center gap-2 h-9 text-sm">
              <input
                id="user-banned"
                type="checkbox"
                checked={isBanned}
                {...register('isBanned')}
              />
              已封禁
            </label>
          </Field>

          {isBanned && (
            <Field
              label="封禁原因"
              htmlFor="user-banned-reason"
              hint="写入审计日志，不会展示给该用户"
              error={errors.bannedReason?.message}
            >
              <Textarea
                id="user-banned-reason"
                rows={3}
                maxLength={200}
                placeholder="例如：刷榜、提交无关答案"
                invalid={!!errors.bannedReason}
                {...register('bannedReason')}
              />
            </Field>
          )}

          <Field
            label="榜单"
            htmlFor="user-score-excluded"
            hint="排除后不再出现在练习榜与赛事榜，历史解题保留"
          >
            <label className="flex items-center gap-2 h-9 text-sm">
              <input
                id="user-score-excluded"
                type="checkbox"
                checked={scoreExcluded}
                {...register('scoreExcluded')}
              />
              排除出榜单
            </label>
          </Field>

          <div className="flex items-center justify-between gap-3 border-t border-rule pt-4">
            <span className="text-2xs text-ink-3">
              {isDirty ? '有未保存的更改' : '没有需要保存的更改'}
            </span>
            <Button type="submit" size="sm" loading={mut.isPending} disabled={!isDirty}>
              保存
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

const passwordSchema = z
  .object({
    newPassword: z.string().min(8, '密码至少 8 位').max(64, '密码最多 64 位'),
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, {
    path: ['confirm'],
    message: '两次输入的密码不一致',
  });

type PasswordValues = z.infer<typeof passwordSchema>;

const EMPTY_PASSWORD: PasswordValues = { newPassword: '', confirm: '' };

export function UserPasswordResetForm({ user }: { user: User }) {
  const toast = useToast();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: EMPTY_PASSWORD,
  });

  const mut = useMutation({
    mutationFn: (password: string) => adminResetPassword(user.id, password),
    onSuccess: () => {
      toast.success('密码已重置');
      reset(EMPTY_PASSWORD);
    },
    onError: (err) =>
      toast.error(err instanceof ApiClientError ? err.message : '重置失败'),
  });

  const onSubmit = handleSubmit((values) => mut.mutate(values.newPassword));

  return (
    <Card>
      <CardHeader>
        <CardTitle>重置密码</CardTitle>
      </CardHeader>
      <CardBody>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field label="新密码" htmlFor="user-new-password" error={errors.newPassword?.message}>
            <Input
              id="user-new-password"
              type="password"
              autoComplete="new-password"
              maxLength={64}
              invalid={!!errors.newPassword}
              {...register('newPassword')}
            />
          </Field>
          <Field label="确认新密码" htmlFor="user-confirm-password" error={errors.confirm?.message}>
            <Input
              id="user-confirm-password"
              type="password"
              autoComplete="new-password"
              maxLength={64}
              invalid={!!errors.confirm}
              {...register('confirm')}
            />
          </Field>
          <div className="flex items-center justify-between gap-3 border-t border-rule pt-4">
            <span className="text-2xs text-ink-3">
              重置后该用户的现有登录不会自动失效
            </span>
            <Button
              type="submit"
              size="sm"
              variant="danger"
              loading={mut.isPending}
            >
              重置密码
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
