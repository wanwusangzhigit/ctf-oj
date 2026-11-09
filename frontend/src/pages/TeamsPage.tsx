import i18n from '@/locales/i18n';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, KeyRound, Plus } from 'lucide-react';
import { Button, Card, CardBody, Spinner } from '@/components/ui';
import { MyTeamCard } from '@/components/team/MyTeamCard';
import { TeamMemberTable } from '@/components/team/TeamMemberTable';
import { myTeam } from '@/api/team';
import { useAuthStore } from '@/stores/auth';

const ENTRIES = [
  {
    to: '/teams/new',
    icon: Plus,
    title: i18n.t('创建团队'),
    desc: i18n.t('自定义名称与 Slug，创建后你成为队长'),
  },
  {
    to: '/teams/join',
    icon: KeyRound,
    title: i18n.t('加入团队'),
    desc: i18n.t('使用队长提供的 12 位邀请码'),
  },
];

export function TeamsPage() {
  const user = useAuthStore((s) => s.user);
  const mine = useQuery({
    queryKey: ['my-team'],
    queryFn: myTeam,
    enabled: !!user,
    staleTime: 30_000,
  });

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <header className="border-t-2 border-ink pt-6 mb-8 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="font-mono text-2xs text-ink-3 mb-3">$ teams --index</p>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tightest text-ink leading-[1.1]">
            {i18n.t('团队')}
          </h1>
          <p className="mt-2 text-ink-2">{i18n.t('组建队伍，集体冲榜。')}</p>
        </div>
        <Link to="/teams/scoreboard" className="text-sm text-amber hover:underline">
          {i18n.t('团队榜 →')}
        </Link>
      </header>

      {mine.isLoading ? (
        <div className="py-10 flex items-center justify-center">
          <Spinner className="h-5 w-5 text-ink-3" />
        </div>
      ) : mine.isError ? (
        <Card>
          <CardBody className="flex items-center justify-between gap-4">
            <p className="text-sm text-ink-2">{i18n.t('无法读取团队信息，请稍后重试。')}</p>
            <Button variant="outline" size="sm" onClick={() => void mine.refetch()}>
              {i18n.t('重试')}
            </Button>
          </CardBody>
        </Card>
      ) : mine.data ? (
        <div className="space-y-6">
          <MyTeamCard team={mine.data} />
          <TeamMemberTable team={mine.data} />
        </div>
      ) : (
        <div className="border-t border-ink">
          <ul>
            {ENTRIES.map((entry) => (
              <li key={entry.to} className="border-b border-rule">
                <Link
                  to={entry.to}
                  className="flex items-center gap-3 py-4 text-ink hover:text-amber hover:no-underline"
                >
                  <entry.icon className="h-4 w-4 text-ink-3 shrink-0" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium">{entry.title}</span>
                    <span className="block text-2xs text-ink-3">{entry.desc}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-ink-3 shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
