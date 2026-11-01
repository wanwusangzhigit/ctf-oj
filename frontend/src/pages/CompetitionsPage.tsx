import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Flame, Clock } from 'lucide-react';
import { Badge, Spinner } from '@/components/ui';
import { listCompetitions } from '@/api/competition';
import { formatTime } from '@/lib/utils';
import {
  COMPETITION_PHASE_LABEL,
  COMPETITION_PHASE_TONE,
  competitionPhase,
} from '@/lib/competition';
import type { Competition } from '@/types';
import { cn } from '@/lib/utils';

/**
 * CompetitionsPage — public list of contest windows.
 * Status (upcoming / live / ended) is derived client-side from the timestamps;
 * the backend only stores the schedule. Frozen scoreboards are flagged too.
 */
export function CompetitionsPage() {
  const q = useQuery({
    queryKey: ['competitions'],
    queryFn: () => listCompetitions(1, 100),
    staleTime: 60_000,
  });

  const items = q.data?.items ?? [];
  const active = items.find((c) => c.isActive) ?? null;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <header className="border-t-2 border-ink pt-6 mb-8">
        <p className="font-mono text-2xs text-ink-3 mb-3">$ competitions --list</p>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tightest text-ink leading-[1.1]">
          赛事
        </h1>
        <p className="mt-2 text-ink-2 max-w-prose">
          比赛窗口与记分板冻结时间。进行中的赛事会在首页显示倒计时。
        </p>
      </header>

      {q.isLoading ? (
        <div className="py-10 flex items-center justify-center">
          <Spinner className="h-5 w-5 text-ink-3" />
        </div>
      ) : q.isError ? (
        <div className="border-t border-rule py-10 text-center text-sm text-ink-3">
          无法加载赛事列表，请稍后重试。
        </div>
      ) : items.length === 0 ? (
        <div className="border-t border-rule py-10 text-center text-sm text-ink-3">
          暂无赛事。
        </div>
      ) : (
        <>
          {active && <ActiveSummary competition={active} />}
          <ul className="border-t border-ink">
            {items.map((c) => (
              <CompetitionRow key={c.id} competition={c} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function ActiveSummary({ competition }: { competition: Competition }) {
  const phase = competitionPhase(competition);
  return (
    <div className="mb-8 border border-amber/30 bg-amber-soft rounded-sm px-4 py-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Flame className="h-3.5 w-3.5 text-amber" />
        <span className="font-mono text-2xs text-amber">当前赛事</span>
        <Link
          to={`/competitions/${competition.id}`}
          className="font-medium text-ink hover:text-amber hover:no-underline"
        >
          {competition.name}
        </Link>
        <Badge tone={COMPETITION_PHASE_TONE[phase]}>{COMPETITION_PHASE_LABEL[phase]}</Badge>
      </div>
      <div className="mt-1 font-mono text-2xs text-ink-3 tabular-nums">
        {competition.startAt ? formatTime(competition.startAt) : '—'} →{' '}
        {competition.endAt ? formatTime(competition.endAt) : '—'}
      </div>
    </div>
  );
}

function CompetitionRow({ competition: c }: { competition: Competition }) {
  const phase = competitionPhase(c);
  return (
    <li>
      <Link
        to={`/competitions/${c.id}`}
        className="group grid grid-cols-[1fr_auto] gap-x-4 items-baseline py-4 border-b border-rule hover:bg-paper-2 transition-colors hover:no-underline px-1"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={cn(
                'font-medium truncate',
                phase === 'ended' ? 'text-ink-3' : 'text-ink group-hover:text-amber',
              )}
            >
              {c.name}
            </span>
            {c.isActive && <Badge tone="accent">当前</Badge>}
            <Badge tone={COMPETITION_PHASE_TONE[phase]}>{COMPETITION_PHASE_LABEL[phase]}</Badge>
            {c.scoreboardFrozen && <Badge tone="accent">封榜中</Badge>}
          </div>
          {c.description && (
            <p className="text-sm text-ink-2 mt-1 line-clamp-2 max-w-prose">
              {c.description}
            </p>
          )}
          <div className="mt-1.5 flex items-center gap-4 flex-wrap font-mono text-2xs text-ink-3 tabular-nums">
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {c.startAt ? formatTime(c.startAt) : '—'} → {c.endAt ? formatTime(c.endAt) : '—'}
            </span>
            {c.freezeAt && (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                freeze {formatTime(c.freezeAt)}
              </span>
            )}
            {typeof c.registrationCount === 'number' && (
              <span className="inline-flex items-center gap-1">
                {c.registrationCount} 人报名
              </span>
            )}
          </div>
        </div>
        <span className="font-mono text-2xs text-ink-3 group-hover:text-amber transition-colors self-center">
          →
        </span>
      </Link>
    </li>
  );
}
