import i18n from '@/locales/i18n';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge, Button, Spinner, useConfirm, useToast } from '@/components/ui';
import {
  listCompetitionRegistrations,
  setCompetitionScoreExcluded,
} from '@/api/competition';
import { ApiClientError } from '@/api/client';
import { formatTime } from '@/lib/utils';
import type { Competition } from '@/types';

/**
 * Registration roster with the score-exclusion switch. Excluding a score drops
 * the user from the competition leaderboard and blocks further submissions to
 * that competition's challenges, so the scoreboard caches are invalidated too.
 */
export function CompetitionRegistrationTable({
  competition,
}: {
  competition: Competition;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();

  const listQ = useQuery({
    queryKey: ['admin-competition-registrations', competition.id],
    queryFn: () => listCompetitionRegistrations(competition.id, 1, 100),
    staleTime: 0,
  });

  const excludeMut = useMutation({
    mutationFn: ({ userId, excluded }: { userId: number; excluded: boolean }) =>
      setCompetitionScoreExcluded(
        competition.id,
        userId,
        excluded,
        excluded ? i18n.t('管理员取消成绩') : undefined,
      ),
    onSuccess: (_data, variables) => {
      toast.success(variables.excluded ? i18n.t('成绩已取消') : i18n.t('成绩已恢复'));
      qc.invalidateQueries({
        queryKey: ['admin-competition-registrations', competition.id],
      });
      qc.invalidateQueries({ queryKey: ['competition-scoreboard', competition.id] });
      qc.invalidateQueries({
        queryKey: ['competition-team-scoreboard', competition.id],
      });
    },
    onError: (err) =>
      toast.error(err instanceof ApiClientError ? err.message : i18n.t('操作失败')),
  });

  const items = listQ.data?.items ?? [];

  return (
    <div className="max-w-3xl">
      {listQ.isLoading ? (
        <div className="py-8 flex items-center justify-center">
          <Spinner className="h-5 w-5 text-ink-3" />
        </div>
      ) : listQ.isError ? (
        <p className="text-sm text-ink-3">{i18n.t('无法加载报名名单。')}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-ink-3">{i18n.t('暂无报名用户。')}</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-2xs uppercase text-ink-3 border-b border-rule">
              <th className="text-left py-2 font-medium">{i18n.t('用户')}</th>
              <th className="text-left py-2 font-medium">{i18n.t('报名时间')}</th>
              <th className="text-left py-2 font-medium">{i18n.t('状态')}</th>
              <th className="text-right py-2 font-medium">{i18n.t('操作')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => {
              const name = r.user?.username ?? `#${r.userId}`;
              return (
                <tr key={r.userId} className="border-b border-rule">
                  <td className="py-2">
                    <Link to={`/users/${r.userId}`} className="hover:no-underline">
                      {name}
                    </Link>
                  </td>
                  <td className="py-2 font-mono text-2xs text-ink-3">
                    {formatTime(r.createdAt)}
                  </td>
                  <td className="py-2">
                    {r.scoreExcluded ? (
                      <Badge tone="danger">{i18n.t('成绩已取消')}</Badge>
                    ) : (
                      <Badge tone="success">{i18n.t('正常')}</Badge>
                    )}
                  </td>
                  <td className="py-2 text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      loading={
                        excludeMut.isPending &&
                        excludeMut.variables?.userId === r.userId
                      }
                      onClick={async () => {
                        const next = !r.scoreExcluded;
                        const ok = await confirm(
                          next
                            ? {
                                title: i18n.t('取消成绩'),
                                description: i18n.t('取消 {{v0}} 在本赛事的成绩，排行榜将不再显示该用户。', { v0: name }),
                                confirmText: i18n.t('取消成绩'),
                              }
                            : {
                                title: i18n.t('恢复成绩'),
                                description: i18n.t('恢复 {{v0}} 在本赛事的成绩。', { v0: name }),
                                confirmText: i18n.t('恢复成绩'),
                                danger: false,
                              },
                        );
                        if (ok) excludeMut.mutate({ userId: r.userId, excluded: next });
                      }}
                    >
                      {r.scoreExcluded ? i18n.t('恢复成绩') : i18n.t('取消成绩')}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
