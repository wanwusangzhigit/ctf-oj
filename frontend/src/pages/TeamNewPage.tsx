import i18n from '@/locales/i18n';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Field,
  Input,
  Spinner,
  Textarea,
  useToast,
} from '@/components/ui';
import { createTeam, myTeam } from '@/api/team';
import { ApiClientError } from '@/api/client';

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(1, i18n.t('请填写团队名称'))
    .max(64, i18n.t('团队名称最多 64 字符')),
  slug: z
    .string()
    .trim()
    .min(3, i18n.t('Slug 至少 3 个字符'))
    .max(64, i18n.t('Slug 最多 64 字符'))
    .regex(/^[a-z0-9][a-z0-9-]*$/, i18n.t('Slug 仅支持小写字母、数字与短横线')),
  description: z.string().trim().max(500, i18n.t('简介最多 500 字符')),
});

type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = { name: '', slug: '', description: '' };

function failureText(err: unknown): string {
  if (err instanceof ApiClientError) {
    if (err.code === 40900) return i18n.t('团队名称或 Slug 已被占用');
    if (err.code === 40000) return i18n.t('请完整填写团队名称与 Slug');
    return err.message;
  }
  return i18n.t('创建失败');
}

/** /teams/new — create a team and become its owner. */
export function TeamNewPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const mine = useQuery({ queryKey: ['my-team'], queryFn: myTeam, staleTime: 30_000 });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY });

  const createMut = useMutation({
    mutationFn: (values: FormValues) => createTeam(values),
    onSuccess: (t) => {
      toast.success(i18n.t('团队已创建'));
      qc.invalidateQueries({ queryKey: ['my-team'] });
      navigate(`/teams/${t.id}`);
    },
    onError: (err) => toast.error(failureText(err)),
  });

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <header className="border-t-2 border-ink pt-6 mb-8">
        <p className="font-mono text-2xs text-ink-3 mb-3">$ teams --create</p>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tightest text-ink leading-[1.1]">
          {i18n.t('创建团队')}
        </h1>
        <p className="mt-2 text-ink-2 max-w-prose">
          {i18n.t('名称与 Slug 全站唯一，创建后你将成为队长，可邀请他人加入。')}
        </p>
      </header>

      {mine.isLoading ? (
        <div className="py-10 flex items-center justify-center">
          <Spinner className="h-5 w-5 text-ink-3" />
        </div>
      ) : mine.data ? (
        <Card>
          <CardHeader>
            <CardTitle>{i18n.t('你已在一个团队中')}</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            <p className="text-sm text-ink-2">
              {i18n.t('退出当前团队后才能创建新团队。')}
            </p>
            <div className="flex items-center gap-4 text-sm">
              <Link to="/teams" className="text-amber hover:underline">
                {i18n.t('前往我的团队')}
              </Link>
              <Link to={`/teams/${mine.data.id}`} className="text-amber hover:underline">
                {i18n.t('团队主页')}
              </Link>
            </div>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardBody>
            <form
              className="space-y-4"
              onSubmit={handleSubmit((values) => createMut.mutate(values))}
              noValidate
            >
              <Field label={i18n.t('团队名称')} htmlFor="team-name" error={errors.name?.message}>
                <Input
                  id="team-name"
                  autoComplete="off"
                  placeholder={i18n.t('比如 Pwn Stars')}
                  invalid={!!errors.name}
                  {...register('name')}
                />
              </Field>
              <Field
                label="Slug"
                htmlFor="team-slug"
                hint={i18n.t('小写字母、数字与短横线，作为唯一标识')}
                error={errors.slug?.message}
              >
                <Input
                  id="team-slug"
                  autoComplete="off"
                  placeholder="pwn-stars"
                  invalid={!!errors.slug}
                  {...register('slug')}
                />
              </Field>
              <Field
                label={i18n.t('简介')}
                htmlFor="team-description"
                hint={i18n.t('可选，最多 500 字符')}
                error={errors.description?.message}
              >
                <Textarea
                  id="team-description"
                  rows={3}
                  maxLength={500}
                  invalid={!!errors.description}
                  {...register('description')}
                />
              </Field>
              <div className="flex items-center justify-between gap-3 border-t border-rule pt-4">
                <Link
                  to="/teams"
                  className="inline-flex items-center gap-1 text-sm text-ink-3 hover:text-ink hover:no-underline"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  {i18n.t('返回团队')}
                </Link>
                <Button type="submit" size="sm" loading={createMut.isPending}>
                  {i18n.t('创建')}
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
