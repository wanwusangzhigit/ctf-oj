import { Link, NavLink, Outlet, useOutletContext, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Calendar, Snowflake } from 'lucide-react';
import { Badge, Spinner } from '@/components/ui';
import { getCompetition } from '@/api/competition';
import { formatTime, cn } from '@/lib/utils';
import {
  COMPETITION_PHASE_LABEL,
  COMPETITION_PHASE_TONE,
  competitionPhase,
  type CompetitionPhase,
} from '@/lib/competition';
import type { Competition } from '@/types';

export type CompetitionOutletContext = {
  competition: Competition;
  phase: CompetitionPhase;
};

export function useCompetitionOutlet() {
  return useOutletContext<CompetitionOutletContext>();
}

const TABS = [
  { to: '.', label: '概览', end: true },
  { to: 'challenges', label: '赛题' },
  { to: 'scoreboard', label: '赛事榜' },
  { to: 'announcements', label: '公告' },
  { to: 'discussions', label: '答疑' },
];

export function CompetitionLayout() {
  const { id } = useParams<{ id: string }>();
  const cid = Number(id);
  const q = useQuery({
    queryKey: ['competition', cid],
    queryFn: () => getCompetition(cid),
    enabled: Number.isFinite(cid) && cid > 0,
    staleTime: 60_000,
  });

  if (q.isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 flex items-center justify-center">
        <Spinner className="h-5 w-5 text-ink-3" />
      </div>
    );
  }

  if (q.isError || !q.data) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
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
  const phase = competitionPhase(c);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <Link
        to="/competitions"
        className="inline-flex items-center gap-1 text-sm text-ink-3 hover:text-ink transition-colors mb-6 hover:no-underline"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        返回赛事列表
      </Link>

      <header className="border-t-2 border-ink pt-6">
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
          <Badge tone={COMPETITION_PHASE_TONE[phase]}>
            {COMPETITION_PHASE_LABEL[phase]}
          </Badge>
          {c.scoreboardFrozen && <Badge tone="accent">封榜中</Badge>}
          {c.registered && <Badge tone="success">已报名</Badge>}
        </div>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tightest text-ink leading-[1.1]">
          {c.name}
        </h1>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 font-mono text-2xs text-ink-3 tabular-nums">
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {c.startAt ? formatTime(c.startAt) : '—'} → {c.endAt ? formatTime(c.endAt) : '—'}
          </span>
          {c.freezeAt && (
            <span className="inline-flex items-center gap-1">
              <Snowflake className="h-3 w-3" />
              封榜 {formatTime(c.freezeAt)}
            </span>
          )}
        </div>
      </header>

      <nav aria-label="赛事导航" className="mt-6 border-b border-rule overflow-x-auto">
        <div className="flex min-w-max gap-5">
          {TABS.map((tab) => (
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

      <div className="mt-8">
        <Outlet context={{ competition: c, phase }} />
      </div>
    </div>
  );
}
