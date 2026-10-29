import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Calendar, CheckCircle2, Clock, Flag, Snowflake, Trophy } from 'lucide-react';
import { Badge, Spinner } from '@/components/ui';
import { competitionScoreboard, competitionTeamScoreboard, getCompetition } from '@/api/competition';
import { listChallenges } from '@/api/challenge';
import { Markdown } from '@/components/Markdown';
import { formatTime } from '@/lib/utils';
import type { ChallengeView, Competition } from '@/types';

type Phase = 'upcoming' | 'live' | 'ended' | 'unscheduled';

function phaseOf(c: Competition, now = Date.now()): Phase {
  if (!c.startAt && !c.endAt) return 'unscheduled';
  const start = c.startAt ? Date.parse(c.startAt) : -Infinity;
  const end = c.endAt ? Date.parse(c.endAt) : Infinity;
  if (now < start) return 'upcoming';
  if (now > end) return 'ended';
  return 'live';
}

const PHASE_LABEL: Record<Phase, string> = {
  upcoming: '即将开始',
  live: '进行中',
  ended: '已结束',
  unscheduled: '未排期',
};

export function CompetitionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const cid = Number(id);

  const q = useQuery({
    queryKey: ['competition', cid],
    queryFn: () => getCompetition(cid),
    enabled: Number.isFinite(cid) && cid > 0,
    staleTime: 60_000,
  });

  const boundCount =
    q.data?.boundChallengeCount ?? q.data?.challenges?.length ?? 0;
  const allChallenges = useQuery({
    queryKey: ['challenges', 'competition-all', cid],
    queryFn: () =>
      listChallenges({ competitionId: cid, page: 1, pageSize: 100 }),
    enabled: !!q.data,
    staleTime: 30_000,
  });
  const statusById = new Map(
    (allChallenges.data?.items ?? []).map((ch) => [ch.id, ch]),
  );

  const [group, setGroup] = useState<'user' | 'team'>('user');
  const board = useQuery({
    queryKey: ['competition-scoreboard', cid],
    queryFn: () => competitionScoreboard(cid, 1, 100),
    enabled: Number.isFinite(cid) && cid > 0,
    staleTime: 30_000,
  });
  const teamBoard = useQuery({
    queryKey: ['competition-team-scoreboard', cid],
    queryFn: () => competitionTeamScoreboard(cid, 1, 100),
    enabled: Number.isFinite(cid) && cid > 0 && group === 'team',
    staleTime: 30_000,
  });

  if (q.isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 flex items-center justify-center">
        <Spinner className="h-5 w-5 text-ink-3" />
      </div>
    );
  }

  if (q.isError || !q.data) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        <div className="border-t-2 border-ink pt-6">
          <h1 className="text-2xl font-semibold tracking-tight">赛事不存在</h1>
          <p className="mt-2 text-ink-3">它可能已被删除。</p>
          <Link
            to="/competitions"
            className="mt-4 inline-flex items-center gap-1 text-amber font-medium"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            返回赛事列表
          </Link>
        </div>
      </div>
    );
  }

  const c = q.data;
  const phase = phaseOf(c);
  const contestChallenges =
    boundCount === 0 ? (allChallenges.data?.items ?? []) : (c.challenges ?? []);
  const contestSolvedCount = contestChallenges.filter(
    (ch) => statusById.get(ch.id)?.competitionSolved,
  ).length;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <Link
        to="/competitions"
        className="inline-flex items-center gap-1 text-sm text-ink-3 hover:text-ink transition-colors mb-6 hover:no-underline"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        返回赛事列表
      </Link>

      <header className="border-t-2 border-ink pt-6 mb-8">
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span className="font-mono text-2xs text-ink-3">@{c.slug}</span>
          {c.isActive && <Badge tone="accent">当前赛事</Badge>}
          {c.visibility === 'private' && <Badge>私有</Badge>}
          {c.archivedAt && <Badge>已归档</Badge>}
          <Badge>
            {c.scoringMode === 'fixed'
              ? '固定分值'
              : c.scoringMode === 'three_blood'
                ? '三血加成'
                : '动态分值'}
          </Badge>
          <Badge tone={phase === 'live' ? 'success' : 'neutral'}>
            {PHASE_LABEL[phase]}
          </Badge>
        </div>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tightest text-ink leading-[1.1]">
          {c.name}
        </h1>
        <dl className="mt-5 grid gap-2 text-sm font-mono tabular-nums">
          <Row icon={<Calendar className="h-3.5 w-3.5" />} label="开始">
            {c.startAt ? formatTime(c.startAt) : '—'}
          </Row>
          <Row icon={<Calendar className="h-3.5 w-3.5" />} label="结束">
            {c.endAt ? formatTime(c.endAt) : '—'}
          </Row>
          {c.freezeAt && (
            <Row icon={<Snowflake className="h-3.5 w-3.5" />} label="记分板冻结">
              {formatTime(c.freezeAt)}
            </Row>
          )}
        </dl>
      </header>

      {c.description ? (
        <section>
          <div className="border-b border-rule pb-2 mb-4">
            <h2 className="text-sm font-medium text-ink">赛事说明</h2>
          </div>
          <div className="max-w-prose">
            <Markdown>{c.description}</Markdown>
          </div>
        </section>
      ) : (
        <p className="text-sm text-ink-3">这场赛事没有附加说明。</p>
      )}

      <section className="mt-10">
        <div className="border-b border-rule pb-2 mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-medium text-ink">赛题</h2>
          <div className="flex items-center gap-2">
            {contestSolvedCount > 0 && (
              <Badge tone="success">
                <CheckCircle2 className="h-3 w-3" />
                比赛已解出 {contestSolvedCount}
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
              ? '赛事尚未开始：题目可按练习模式提交，赛事开始后从本页进入将自动切换为比赛模式。'
              : '赛事已结束：题目按练习模式提交，不计入赛事成绩。'}
        </p>
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

      <section className="mt-10">
        <div className="border-b border-rule pb-2 mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-ink">赛事榜</h2>
          <div className="flex items-center gap-1">
            {(['user', 'team'] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGroup(g)}
                className={
                  group === g
                    ? 'px-2 py-1 text-2xs font-mono text-ink border-b-2 border-amber'
                    : 'px-2 py-1 text-2xs font-mono text-ink-3 border-b-2 border-transparent hover:text-ink'
                }
              >
                {g === 'user' ? '个人' : '团队'}
              </button>
            ))}
          </div>
        </div>
        {group === 'user' ? (
          board.isLoading ? (
            <Spinner className="h-4 w-4 text-ink-3" />
          ) : (board.data?.items.length ?? 0) === 0 ? (
            <p className="text-sm text-ink-3">暂无成绩。</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-2xs uppercase text-ink-3 border-b border-rule">
                  <th className="text-left py-2 font-medium w-12">#</th>
                  <th className="text-left py-2 font-medium">用户</th>
                  <th className="text-right py-2 font-medium">得分</th>
                </tr>
              </thead>
              <tbody>
                {board.data!.items.map((u, i) => (
                  <tr key={u.id} className="border-b border-rule">
                    <td className="py-2 font-mono text-2xs text-ink-3 tabular-nums">
                      {i + 1}
                    </td>
                    <td className="py-2">
                      <Link to={`/users/${u.id}`} className="hover:no-underline">
                        {u.username}
                      </Link>
                    </td>
                    <td className="py-2 text-right font-mono tabular-nums">
                      {u.score}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : teamBoard.isLoading ? (
          <Spinner className="h-4 w-4 text-ink-3" />
        ) : (teamBoard.data?.items.length ?? 0) === 0 ? (
          <p className="text-sm text-ink-3">暂无团队成绩。</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-2xs uppercase text-ink-3 border-b border-rule">
                <th className="text-left py-2 font-medium w-12">#</th>
                <th className="text-left py-2 font-medium">团队</th>
                <th className="text-right py-2 font-medium">得分</th>
              </tr>
            </thead>
            <tbody>
              {teamBoard.data!.items.map((t, i) => (
                <tr key={t.id} className="border-b border-rule">
                  <td className="py-2 font-mono text-2xs text-ink-3 tabular-nums">
                    {i + 1}
                  </td>
                  <td className="py-2">
                    <Link to={`/teams/${t.id}`} className="hover:no-underline">
                      {t.name}
                    </Link>
                  </td>
                  <td className="py-2 text-right font-mono tabular-nums">
                    {t.score}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <p className="mt-10 font-mono text-2xs text-ink-3 inline-flex items-center gap-1">
        <Clock className="h-3 w-3" />
        记分板冻结后仍可继续解题，但冻结后的成绩不计入最终排名。
      </p>
    </div>
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

function Row({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="inline-flex items-center gap-1 text-2xs text-ink-3 w-28">
        {icon}
        {label}
      </dt>
      <dd className="text-ink">{children}</dd>
    </div>
  );
}
