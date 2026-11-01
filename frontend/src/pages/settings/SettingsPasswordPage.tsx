import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Field,
  Input,
  useToast,
} from '@/components/ui';
import { changePassword } from '@/api/user';
import { ApiClientError } from '@/api/client';

const schema = z
  .object({
    currentPassword: z.string().min(1, '请输入当前密码'),
    newPassword: z.string().min(8, '新密码至少 8 位').max(64, '新密码最多 64 位'),
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, {
    path: ['confirm'],
    message: '两次输入的密码不一致',
  });

type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = { currentPassword: '', newPassword: '', confirm: '' };

/** /settings/password — self-service password change. */
export function SettingsPasswordPage() {
  const toast = useToast();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY });

  const mut = useMutation({
    mutationFn: (values: FormValues) =>
      changePassword(values.currentPassword, values.newPassword),
    onSuccess: () => {
      toast.success('密码已更新');
      reset(EMPTY);
    },
    onError: (err) =>
      toast.error(err instanceof ApiClientError ? err.message : '修改失败'),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>修改密码</CardTitle>
      </CardHeader>
      <CardBody>
        <form
          className="space-y-4"
          onSubmit={handleSubmit((values) => mut.mutate(values))}
          noValidate
        >
          <Field
            label="当前密码"
            htmlFor="settings-current-password"
            error={errors.currentPassword?.message}
          >
            <Input
              id="settings-current-password"
              type="password"
              autoComplete="current-password"
              invalid={!!errors.currentPassword}
              {...register('currentPassword')}
            />
          </Field>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field
              label="新密码"
              htmlFor="settings-new-password"
              hint="8–64 位"
              error={errors.newPassword?.message}
            >
              <Input
                id="settings-new-password"
                type="password"
                autoComplete="new-password"
                invalid={!!errors.newPassword}
                {...register('newPassword')}
              />
            </Field>
            <Field
              label="确认新密码"
              htmlFor="settings-confirm-password"
              error={errors.confirm?.message}
            >
              <Input
                id="settings-confirm-password"
                type="password"
                autoComplete="new-password"
                invalid={!!errors.confirm}
                {...register('confirm')}
              />
            </Field>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-rule pt-4">
            <span className="text-2xs text-ink-3">修改密码不会让其他设备退出登录</span>
            <Button type="submit" size="sm" loading={mut.isPending}>
              更新密码
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
