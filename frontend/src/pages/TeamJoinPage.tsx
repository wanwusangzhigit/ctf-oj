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
  useToast,
} from '@/components/ui';
import { joinTeamByCode, myTeam } from '@/api/team';
import { ApiClientError } from '@/api/client';

const schema = z.object({
  inviteCode: z.string().trim().min(1, i18n.t('请输入邀请码')),
});

type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = { inviteCode: '' };

function failureText(err: unknown): string {
  if (err instanceof ApiClientError) {
    if (err.code === 40400) return i18n.t('邀请码无效');
    if (err.code === 40900) return i18n.t('该团队人数已满，或你已加入其他团队');
    if (err.code === 40000) return i18n.t('请输入邀请码');
    return err.message;
  }
  return i18n.t('加入失败');
}

/** /teams/join — enter a team with the 12 character invite code from its owner. */
export function TeamJoinPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const mine = useQuery({ queryKey: ['my-team'], queryFn: myTeam, staleTime: 30_000 });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY });

  const joinMut = useMutation({
    mutationFn: (values: FormValues) => joinTeamByCode(values.inviteCode),
    onSuccess: (t) => {
      toast.success(i18n.t('加入成功'));
      qc.invalidateQueries({ queryKey: ['my-team'] });
      navigate(`/teams/${t.id}`);
    },
    onError: (err) => toast.error(failureText(err)),
  });

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <header className="border-t-2 border-ink pt-6 mb-8">
        <p className="font-mono text-2xs text-ink-3 mb-3">$ teams --join</p>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tightest text-ink leading-[1.1]">
          {i18n.t('加入团队')}
        </h1>
        <p className="mt-2 text-ink-2 max-w-prose">
          {i18n.t('邀请码形如 T-xxxxxxxxxxxx，由队长在团队页生成并提供给你。')}
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
            <p className="text-sm text-ink-2">{i18n.t('退出当前团队后才能加入其他团队。')}</p>
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
              onSubmit={handleSubmit((values) => joinMut.mutate(values))}
              noValidate
            >
              <Field
                label={i18n.t('邀请码')}
                htmlFor="team-invite-code"
                hint={i18n.t('向队长索取')}
                error={errors.inviteCode?.message}
              >
                <Input
                  id="team-invite-code"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="T-xxxxxxxxxxxx"
                  className="font-mono"
                  invalid={!!errors.inviteCode}
                  {...register('inviteCode')}
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
                <Button type="submit" size="sm" loading={joinMut.isPending}>
                  {i18n.t('加入')}
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
