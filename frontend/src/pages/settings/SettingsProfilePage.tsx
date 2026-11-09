import i18n from '@/locales/i18n';
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
  Textarea,
  useToast,
} from '@/components/ui';
import { AvatarBlock } from '@/components/layout/AvatarBlock';
import { updateProfile } from '@/api/user';
import { ApiClientError } from '@/api/client';
import { useAuthStore } from '@/stores/auth';

const schema = z.object({
  bio: z.string().max(500, i18n.t('个人简介最长 500 字符')),
  profileVisibility: z.enum(['public', 'private']),
});

type FormValues = z.infer<typeof schema>;

const SELECT_CLS =
  'h-9 px-2 w-full bg-paper border border-rule rounded-sm text-sm focus:outline-none focus:border-amber transition-colors';

/** /settings — avatar, bio and profile visibility. */
export function SettingsProfilePage() {
  const user = useAuthStore((s) => s.user);
  const toast = useToast();
  const qc = useQueryClient();
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      bio: user?.bio ?? '',
      profileVisibility: user?.profileVisibility ?? 'public',
    },
  });

  const mut = useMutation({
    mutationFn: (values: FormValues) => updateProfile(values),
    onSuccess: () => {
      toast.success(i18n.t('已保存'));
      qc.invalidateQueries({ queryKey: ['user'] });
      qc.invalidateQueries({ queryKey: ['auth-me'] });
    },
    onError: (err) =>
      toast.error(err instanceof ApiClientError ? err.message : i18n.t('保存失败')),
  });

  const visibility = watch('profileVisibility');

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{i18n.t('头像')}</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="flex items-center gap-4">
            {user && <AvatarBlock user={user} editable />}
            <p className="text-sm text-ink-3">{i18n.t('支持 PNG / JPEG / WebP / GIF，不超过 2MB。点击头像角标选择文件。')}</p>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{i18n.t('编辑资料')}</CardTitle>
        </CardHeader>
        <CardBody>
          <form
            className="space-y-4"
            onSubmit={handleSubmit((values) => mut.mutate(values))}
            noValidate
          >
            <Field
              label={i18n.t('个人简介')}
              htmlFor="settings-bio"
              hint={i18n.t('纯文本，不支持 Markdown')}
              error={errors.bio?.message}
            >
              <Textarea
                id="settings-bio"
                rows={3}
                maxLength={500}
                placeholder={i18n.t('一句话介绍自己')}
                invalid={!!errors.bio}
                {...register('bio')}
              />
            </Field>
            <Field
              label={i18n.t('资料可见性')}
              htmlFor="settings-visibility"
              hint={i18n.t('私有后仅自己与管理员可见，公开活动记录同时隐藏')}
              error={errors.profileVisibility?.message}
            >
              <select id="settings-visibility" className={SELECT_CLS} {...register('profileVisibility')}>
                <option value="public">{i18n.t('公开')}</option>
                <option value="private">{i18n.t('私有')}</option>
              </select>
            </Field>
            <div className="flex items-center justify-between gap-3 border-t border-rule pt-4">
              <span className="text-2xs text-ink-3">
                {visibility === 'private' ? i18n.t('当前对其他用户隐藏') : i18n.t('当前对所有人可见')}
              </span>
              <Button type="submit" size="sm" loading={mut.isPending} disabled={!isDirty}>
                {i18n.t('保存')}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
