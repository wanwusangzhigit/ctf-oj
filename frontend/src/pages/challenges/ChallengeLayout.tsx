import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useOutletContext,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Badge, Spinner } from '@/components/ui';
import { getChallenge } from '@/api/challenge';
import { getCompetition } from '@/api/competition';
import { competitionCoversChallenge, competitionPhase } from '@/lib/competition';
import { cn } from '@/lib/utils';
import type { ChallengeView, Competition } from '@/types';

export type ChallengeOutletContext = {
  challengeId: number;
  competitionId?: number;
  challenge: ChallengeView;
  contest: Competition | null;
  solvedInMode: boolean;
};

export function useChallengeOutlet() {
  return useOutletContext<ChallengeOutletContext>();
}

export function ChallengeLayout() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const challengeId = Number(id);
  const requestedCompetition = Number(searchParams.get('competition'));
  const hasRequestedCompetition =
    Number.isFinite(requestedCompetition) && requestedCompetition > 0;

  const requestedQ = useQuery({
    queryKey: ['competition', requestedCompetition],
    queryFn: () => getCompetition(requestedCompetition),
    enabled: hasRequestedCompetition,
    staleTime: 30_000,
  });
  const competition = hasRequestedCompetition ? requestedQ.data : undefined;
  const contextLoading = hasRequestedCompetition && requestedQ.isLoading;
  const contest =
    competition &&
    competitionPhase(competition) === 'live' &&
    competitionCoversChallenge(competition, challengeId)
      ? competition
      : null;
  const competitionId = contest?.id;

  const { data, isLoading, error } = useQuery({
    queryKey: ['challenge', challengeId, competitionId ?? 0],
    queryFn: () => getChallenge(challengeId, competitionId),
    enabled: !Number.isNaN(challengeId) && !contextLoading,
    staleTime: 15_000,
  });

  if (contextLoading || isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16 flex items-center justify-center">
        <Spinner className="h-5 w-5 text-ink-3" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
        <div className="border-t-2 border-ink pt-6">
          <h1 className="text-2xl font-semibold tracking-tight">
            题目不存在或已下线
          </h1>
          <p className="mt-2 text-ink-3">
            它可能被发布者删除，或被管理员下架。
          </p>
          <div className="mt-4">
            <Link
              to="/challenges"
              className="inline-flex items-center gap-1 text-amber font-medium"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              返回题目列表
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const solvedInMode = contest ? data.competitionSolved : data.solved;
  const search = location.search;
  const base = `/challenges/${challengeId}`;
  const blockedPath =
    contest !== null &&
    (location.pathname === `${base}/writeups` ||
      location.pathname === `${base}/discussions`);
  const tabs = contest
    ? []
    : [
        { to: `${base}${search}`, label: '题目', end: true },
        { to: `${base}/writeups${search}`, label: 'Writeup' },
        { to: `${base}/discussions${search}`, label: '讨论' },
      ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <Link
        to={contest ? `/competitions/${contest.id}` : '/challenges'}
        className="inline-flex items-center gap-1 text-sm text-ink-3 hover:text-ink transition-colors mb-6 hover:no-underline"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {contest ? '返回赛事' : '返回题目列表'}
      </Link>

      {contest && (
        <div className="mb-6 border border-amber/30 bg-amber-soft rounded-sm px-4 py-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge tone="accent">比赛模式</Badge>
            <Link
              to={`/competitions/${contest.id}`}
              className="text-sm font-medium text-ink hover:text-amber hover:no-underline"
            >
              {contest.name}
            </Link>
          </div>
          <p className="mt-1 text-2xs text-ink-3 leading-relaxed">
            本题提交计入赛事。已解出后可重复提交，但不会再次加分。比赛进行中，Writeup 与题目讨论已关闭。
          </p>
        </div>
      )}

      {!contest && hasRequestedCompetition && competition && (
        <p className="mb-6 text-2xs text-ink-3">
          该赛事当前不在进行中，本题按练习模式提交。
        </p>
      )}

      <header className="border-t-2 border-ink pt-6">
        <div className="font-mono text-2xs text-ink-3 mb-3 tabular-nums">
          #{String(data.id).padStart(3, '0')} · {data.category?.name ?? 'uncategorized'}
          {data.solved && ' · 练习已通过'}
          {contest && data.competitionSolved && ' · 比赛已解出'}
        </div>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tightest text-ink leading-[1.1]">
          {data.title}
        </h1>
        <div className="mt-4 flex items-center gap-6 flex-wrap text-sm">
          <Meta label="基础分" value={data.baseScore.toString()} />
          <Meta label="最低分" value={data.minScore.toString()} />
          <Meta label="难度" value={`${data.difficulty}/5`} />
          <Meta label="解题" value={`${data.solveCount} 人`} />
          {data.solved && (
            <Badge tone="accent">
              <CheckCircle2 className="h-3 w-3" />
              练习已通过
            </Badge>
          )}
          {contest && data.competitionSolved && (
            <Badge tone="success">
              <CheckCircle2 className="h-3 w-3" />
              比赛已解出
            </Badge>
          )}
        </div>
      </header>

      {tabs.length > 0 && (
        <nav aria-label="题目导航" className="mt-6 border-b border-rule overflow-x-auto">
          <div className="flex min-w-max gap-5">
            {tabs.map((tab) => (
              <NavLink
                key={tab.label}
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  cn(
                    'inline-flex h-9 items-center border-b-2 px-0.5 text-sm transition-colors hover:no-underline',
                    isActive
                      ? 'border-amber font-medium text-ink'
                      : 'border-transparent text-ink-3 hover:text-ink',
                  )
                }
              >
                {tab.label}
              </NavLink>
            ))}
          </div>
        </nav>
      )}

      <div className="mt-8">
        {blockedPath ? (
          <div className="border-t-2 border-ink pt-6">
            <h2 className="text-xl font-semibold tracking-tight">
              比赛期间不可用
            </h2>
            <p className="mt-2 max-w-xl text-sm text-ink-3 leading-relaxed">
              为避免影响比赛公平性，Writeup 与题目讨论在赛事进行中关闭。
            </p>
            <Link
              to={`${base}${search}`}
              className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-amber"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              返回题目
            </Link>
          </div>
        ) : (
          <Outlet
            context={{
              challengeId,
              competitionId,
              challenge: data,
              contest,
              solvedInMode,
            }}
          />
        )}
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-2xs text-ink-3 font-mono">{label}</span>
      <span className="font-mono tabular-nums text-ink">{value}</span>
    </div>
  );
}
