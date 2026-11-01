import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Flag, Trophy } from 'lucide-react';
import { Badge, Spinner } from '@/components/ui';
import { listChallenges } from '@/api/challenge';
import { useAuthStore } from '@/stores/auth';
import type { ChallengeView, Competition } from '@/types';
import { useCompetitionOutlet } from './CompetitionLayout';

export function CompetitionChallengesPage() {
  const { competition: c, phase } = useCompetitionOutlet();
  const user = useAuthStore((s) => s.user);
  const boundCount = c.boundChallengeCount ?? c.challenges?.length ?? 0;

  const allChallenges = useQuery({
    queryKey: ['challenges', 'competition-all', c.id],
    queryFn: () =>
      listChallenges({ competitionId: c.id, page: 1, pageSize: 100 }),
    staleTime: 30_000,
  });
  const statusById = new Map(
    (allChallenges.data?.items ?? []).map((ch) => [ch.id, ch]),
  );
  const contestChallenges =
    boundCount === 0 ? (allChallenges.data?.items ?? []) : (c.challenges ?? []);
  const solvedCount = contestChallenges.filter(
    (ch) => statusById.get(ch.id)?.competitionSolved,
  ).length;

  return (
    <section>
      <div className="border-b border-rule pb-2 mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold text-ink">赛题</h2>
        <div className="flex items-center gap-2">
          {solvedCount > 0 && (
            <Badge tone="success">
              <CheckCircle2 className="h-3 w-3" />
              比赛已解出 {solvedCount}
            </Badge>
          )}
          <span className="font-mono text-2xs text-ink-3 tabular-nums">
            {boundCount > 0 ? `${boundCount} 道` : '全部公开题目'}
          </span>
        </div>
      </div>
      <p className="mb-2 text-2xs text-ink-3 leading-relaxed">
        {phase === 'live'
          ? '比赛进行中：从下方进入题目即按比赛模式提交，成绩单独计入赛事，不影响练习进度。'
          : phase === 'upcoming'
            ? '赛事尚未开始：可查看赛题，比赛提交需等赛事开始。'
            : '赛事已结束：可继续练习，赛事成绩不再变化。'}
      </p>
      {c.registrationRequired && !c.registered && (
        <p className="mb-3 border-l-2 border-amber pl-3 text-2xs text-ink-2">
          {user ? (
            <>
              报名后才能提交赛事题目。
              <Link to={`/competitions/${c.id}`} className="ml-1 text-amber hover:no-underline">
                前往报名
              </Link>
            </>
          ) : (
            '登录并报名后才能提交赛事题目。'
          )}
        </p>
      )}
      {boundCount === 0 ? (
        allChallenges.isLoading ? (
          <Spinner className="h-4 w-4 text-ink-3" />
        ) : allChallenges.isError ? (
          <p className="text-sm text-ink-3">无法加载题目列表。</p>
        ) : (allChallenges.data?.items.length ?? 0) === 0 ? (
          <p className="text-sm text-ink-3">暂无公开题目。</p>
        ) : (
          <>
            <p className="mb-2 text-2xs text-ink-3">
              本赛事未单独绑定题目，下列全部公开题目均计入赛事。
            </p>
            <ChallengeList
              challenges={allChallenges.data!.items}
              competitionId={c.id}
              statusById={statusById}
            />
          </>
        )
      ) : (c.challenges?.length ?? 0) === 0 ? (
        <p className="text-sm text-ink-3">
          本赛事题目暂不可见，可能尚未发布或需要授权。
        </p>
      ) : (
        <ChallengeList
          challenges={c.challenges!}
          competitionId={c.id}
          statusById={statusById}
        />
      )}
    </section>
  );
}

function ChallengeList({
  challenges,
  competitionId,
  statusById,
}: {
  challenges: NonNullable<Competition['challenges']>;
  competitionId: number;
  statusById: Map<number, ChallengeView>;
}) {
  return (
    <ul className="border-t border-rule">
      {challenges.map((ch) => {
        const status = statusById.get(ch.id);
        return (
          <li key={ch.id} className="border-b border-rule">
            <Link
              to={`/challenges/${ch.id}?competition=${competitionId}`}
              className="group block py-2.5 text-sm hover:no-underline"
            >
              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                <span className="min-w-0 truncate font-medium group-hover:text-amber">
                  {ch.title}
                </span>
                <Badge tone="warning">
                  <Flag className="h-3 w-3" />
                  赛事题
                </Badge>
                {status?.solved && (
                  <Badge tone="success">
                    <CheckCircle2 className="h-3 w-3" />
                    练习已通过
                  </Badge>
                )}
                {status?.competitionSolved && (
                  <Badge tone="success">
                    <Trophy className="h-3 w-3" />
                    比赛已解出
                  </Badge>
                )}
              </div>
              <div className="mt-1 flex items-center gap-3 flex-wrap font-mono text-2xs text-ink-3 tabular-nums">
                <span>{ch.category?.name ?? '未分类'}</span>
                <span>{ch.baseScore} 分</span>
                <span>难度 {ch.difficulty}</span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
