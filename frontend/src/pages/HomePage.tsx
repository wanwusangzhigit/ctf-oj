import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock } from 'lucide-react';
import { listChallenges } from '@/api/challenge';
import { activityFeed, scoreboard } from '@/api/user';
import { listAnnouncements } from '@/api/announcement';
import { getActiveCompetition } from '@/api/competition';
import { Badge, Spinner } from '@/components/ui';
import { Avatar } from '@/components/layout/Avatar';
import { Markdown } from '@/components/Markdown';
import { formatNumber, relativeTime, formatTime } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth';
import { useSiteStore } from '@/stores/site';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { ChallengeView, Competition } from '@/types';

export function HomePage() {
  const user = useAuthStore((s) => s.user);
  const rulesMd = useSiteStore((s) => s.settings?.siteRulesMd ?? '');

  const challenges = useQuery({
    queryKey: ['home-challenges'],
    queryFn: () => listChallenges({ pageSize: 6 }),
    staleTime: 60_000,
  });
  const board = useQuery({
    queryKey: ['home-board'],
    queryFn: () => scoreboard(1, 5),
    staleTime: 30_000,
  });
  const announcements = useQuery({
    queryKey: ['home-announcements'],
    queryFn: () => listAnnouncements(1, 4),
    staleTime: 60_000,
  });
  const competition = useQuery({
    queryKey: ['home-competition'],
    queryFn: getActiveCompetition,
    staleTime: 60_000,
  });
  const feed = useQuery({
    queryKey: ['home-feed'],
    queryFn: () => activityFeed(8),
    enabled: !!user,
    staleTime: 30_000,
  });

  const pinned = announcements.data?.items?.find((a) => a.isPinned);
  const others =
    announcements.data?.items?.filter((a) => !a.isPinned).slice(0, 3) ?? [];

  const topScore = board.data?.items?.[0]?.score ?? 0;
  const totalChallenges = challenges.data?.total ?? 0;
  const totalPlayers = board.data?.total ?? 0;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <Hero
        topScore={topScore}
        topUser={board.data?.items?.[0]?.username}
        totalChallenges={totalChallenges}
        totalPlayers={totalPlayers}
        ready={!board.isLoading && !challenges.isLoading}
      />

      {competition.data && <CompetitionBanner competition={competition.data} />}

      <div className="mt-14 grid gap-10 lg:grid-cols-[1.6fr_1fr]">
        <section>
          <SectionTitle
            left="最新题目"
            right={<Link to="/challenges" className="text-sm text-amber">查看全部</Link>}
          />
          <ChallengeLog challenges={challenges.data?.items ?? []} loading={challenges.isLoading} />
        </section>

        <aside className="space-y-10">
          {user && (
            <section>
              <SectionTitle left="关注动态" />
              <FeedLog
                items={feed.data ?? []}
                loading={feed.isLoading}
              />
            </section>
          )}

          <section>
            <SectionTitle
              left="榜单前 5"
              right={<Link to="/scoreboard" className="text-sm text-amber">完整榜单</Link>}
            />
            <LeaderboardPreview
              users={board.data?.items ?? []}
              loading={board.isLoading}
            />
          </section>

          {(pinned || others.length > 0) && (
            <section>
              <SectionTitle
                left="公告"
                right={<Link to="/announcements" className="text-sm text-amber">全部</Link>}
              />
              <AnnouncementLog
                pinned={pinned}
                others={others}
                loading={announcements.isLoading}
              />
            </section>
          )}
        </aside>
      </div>

      {user ? null : (
        <p className="mt-14 text-sm text-ink-3 max-w-prose">
          注册账号后即可开始练习 —— 提交 flag、启动容器实例、登上榜单。
        </p>
      )}

      {rulesMd.trim() && (
        <section className="mt-14">
          <SectionTitle left="站点规则" />
          <div className="max-w-prose">
            <Markdown>{rulesMd}</Markdown>
          </div>
        </section>
      )}
    </div>
  );
}

/**
 * CompetitionBanner — a thin strip under the hero when an active contest is
 * configured. Shows the window and links to the full description.
 */
function CompetitionBanner({ competition }: { competition: Competition }) {
  const now = Date.now();
  const start = competition.startAt ? Date.parse(competition.startAt) : -Infinity;
  const end = competition.endAt ? Date.parse(competition.endAt) : Infinity;
  const live = now >= start && now <= end;
  const upcoming = now < start;

  return (
    <Link
      to={`/competitions/${competition.id}`}
      className="mt-8 flex items-center gap-3 border border-rule bg-paper-2 rounded-sm px-4 py-3 hover:border-rule-strong transition-colors hover:no-underline"
    >
      <CalendarClock className="h-4 w-4 text-amber shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-ink truncate">
            {competition.name}
          </span>
          <Badge tone={live ? 'accent' : 'neutral'}>
            {live ? '进行中' : upcoming ? '即将开始' : '已结束'}
          </Badge>
        </div>
        <div className="font-mono text-2xs text-ink-3 tabular-nums mt-0.5">
          {competition.startAt ? formatTime(competition.startAt) : '—'} →{' '}
          {competition.endAt ? formatTime(competition.endAt) : '—'}
        </div>
      </div>
      <span className="font-mono text-2xs text-ink-3">查看 →</span>
    </Link>
  );
}

/**
 * Hero — the single memorable moment.
 * One large mono number that counts up on first paint, with a thin caption.
 * Nothing else animates on the page; this is the only orchestrated reveal.
 */
function Hero({
  topScore,
  topUser,
  totalChallenges,
  totalPlayers,
  ready,
}: {
  topScore: number;
  topUser?: string;
  totalChallenges: number;
  totalPlayers: number;
  ready: boolean;
}) {
  const prefersReduced = useReducedMotion();
  const [display, setDisplay] = useState(prefersReduced ? topScore : 0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (prefersReduced) {
      setDisplay(topScore);
      return;
    }
    const start = performance.now();
    const from = 0;
    const to = topScore;
    const dur = Math.min(1400, 600 + Math.log10(Math.max(10, to)) * 280);
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [ready, topScore, prefersReduced]);

  return (
    <section className="border-t-2 border-ink pt-6">
      <p className="font-mono text-2xs text-ink-3 mb-3">
        $ status --since=boot
      </p>
      <h1 className="text-3xl sm:text-4xl font-semibold tracking-tightest text-ink leading-[1.05] max-w-3xl">
        面向 CTF 练习的
        <br />
        在线评测系统
      </h1>
      <p className="mt-4 text-ink-2 max-w-prose">
        覆盖 Web、Pwn、Crypto、Reverse、Misc、Forensics 等方向；
        动态打分、附件下载、容器化实例、解题记录一应俱全。
      </p>
      <div className="mt-8 flex items-end gap-6 sm:gap-10 flex-wrap">
        <BigStat
          label="榜首分数"
          value={display}
          suffix={topUser ? `  ·  ${topUser}` : ''}
          ready={ready}
        />
        <ThinStat label="题目" value={totalChallenges} ready={ready} />
        <ThinStat label="选手" value={totalPlayers} ready={ready} />
      </div>
    </section>
  );
}

function BigStat({
  label,
  value,
  suffix,
  ready,
}: {
  label: string;
  value: number;
  suffix?: string;
  ready: boolean;
}) {
  return (
    <div>
      <div className="font-mono text-2xs text-ink-3 mb-1">{label}</div>
      <div className="font-mono tabular-nums text-ink leading-none flex items-baseline gap-3 flex-wrap">
        <span className="text-5xl sm:text-6xl font-semibold tracking-tightest">
          {ready ? formatNumber(value) : '—'}
        </span>
        {suffix && (
          <span className="text-base text-ink-2 font-normal">{suffix}</span>
        )}
      </div>
    </div>
  );
}

function ThinStat({
  label,
  value,
  ready,
}: {
  label: string;
  value: number;
  ready: boolean;
}) {
  return (
    <div className="border-l border-rule pl-6">
      <div className="font-mono text-2xs text-ink-3 mb-1">{label}</div>
      <div className="font-mono tabular-nums text-2xl text-ink">
        {ready ? formatNumber(value) : '—'}
      </div>
    </div>
  );
}

function SectionTitle({
  left,
  right,
}: {
  left: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between border-b border-rule pb-2 mb-3">
      <h2 className="text-sm text-ink tracking-tight font-medium">{left}</h2>
      {right}
    </div>
  );
}

/**
 * ChallengeLog — a dense, ruled list (NOT a card grid).
 * Reads like a directory listing in a terminal:
 *   id    title                    category     solves    score
 */
function ChallengeLog({
  challenges,
  loading,
}: {
  challenges: ChallengeView[];
  loading: boolean;
}) {
  if (loading) return <Loading />;
  if (challenges.length === 0) return <Empty label="还没有题目" />;

  return (
    <ul className="border-t border-rule">
      {challenges.map((c) => (
        <li key={c.id}>
          <Link
            to={`/challenges/${c.id}`}
            className="group grid grid-cols-[auto_1fr_auto] sm:grid-cols-[3.5rem_1fr_8rem_5rem] gap-x-4 items-center py-3 border-b border-rule hover:bg-paper-2 transition-colors hover:no-underline"
          >
            <span className="font-mono text-2xs text-ink-3 tabular-nums">
              #{String(c.id).padStart(3, '0')}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <SolvedDot solved={!!c.solved} />
                <span className="font-medium text-ink truncate group-hover:text-amber transition-colors">
                  {c.title}
                </span>
              </div>
              <div className="text-2xs text-ink-3 mt-0.5 font-mono">
                {c.category?.name ?? 'uncategorized'}
              </div>
            </div>
            <div className="hidden sm:block text-2xs text-ink-3 font-mono tabular-nums text-right">
              {c.solveCount} solves
            </div>
            <div className="font-mono text-sm tabular-nums text-right text-ink">
              {c.baseScore}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function SolvedDot({ solved }: { solved: boolean }) {
  return (
    <span
      aria-hidden
      className={
        solved
          ? 'inline-block h-1.5 w-1.5 rounded-full bg-amber'
          : 'inline-block h-1.5 w-1.5 rounded-full bg-paper-3 border border-rule'
      }
    />
  );
}

function LeaderboardPreview({
  users,
  loading,
}: {
  users: { id: number; username: string; score: number }[];
  loading: boolean;
}) {
  if (loading) return <Loading />;
  if (users.length === 0) return <Empty label="榜单为空" />;
  return (
    <ol className="border-t border-rule">
      {users.map((u, idx) => (
        <li
          key={u.id}
          className="grid grid-cols-[2rem_1fr_auto] gap-x-3 items-center py-2.5 border-b border-rule"
        >
          <span className="font-mono text-2xs text-ink-3 tabular-nums">
            {String(idx + 1).padStart(2, '0')}
          </span>
          <div className="flex items-center gap-2 min-w-0">
            <Avatar name={u.username} />
            <span className="font-medium text-sm truncate">{u.username}</span>
          </div>
          <span className="font-mono text-sm tabular-nums text-ink">
            {formatNumber(u.score)}
          </span>
        </li>
      ))}
    </ol>
  );
}

function AnnouncementLog({
  pinned,
  others,
  loading,
}: {
  pinned?: { id: number; title: string; publishedAt?: string; createdAt: string };
  others: { id: number; title: string; publishedAt?: string; createdAt: string }[];
  loading: boolean;
}) {
  if (loading) return <Loading />;
  if (!pinned && others.length === 0) return <Empty label="暂无公告" />;

  return (
    <ul className="border-t border-rule">
      {pinned && (
        <li>
          <Link
            to={`/announcements/${pinned.id}`}
            className="block py-2.5 border-b border-rule hover:bg-paper-2 transition-colors hover:no-underline"
          >
            <div className="flex items-center gap-2 mb-0.5">
              <Badge tone="accent">置顶</Badge>
              <span className="font-medium truncate flex-1 min-w-0 text-sm">
                {pinned.title}
              </span>
            </div>
            <div className="font-mono text-2xs text-ink-3">
              {relativeTime(pinned.publishedAt ?? pinned.createdAt)}
            </div>
          </Link>
        </li>
      )}
      {others.map((a) => (
        <li key={a.id}>
          <Link
            to={`/announcements/${a.id}`}
            className="block py-2.5 border-b border-rule hover:bg-paper-2 transition-colors hover:no-underline"
          >
            <div className="text-sm truncate">{a.title}</div>
            <div className="font-mono text-2xs text-ink-3 mt-0.5">
              {relativeTime(a.publishedAt ?? a.createdAt)}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Loading() {
  return (
    <div className="flex items-center justify-center py-10">
      <Spinner className="h-5 w-5 text-ink-3" />
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="border-t border-rule py-8 text-center text-sm text-ink-3">
      {label}
    </div>
  );
}

function FeedLog({
  items,
  loading,
}: {
  items: import('@/types').FeedItem[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Spinner className="h-4 w-4 text-muted" />
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted py-2">
        关注其他选手后，这里会出现他们的解题与题解动态。
      </p>
    );
  }
  return (
    <ul className="divide-y divide-rule border-y border-rule">
      {items.map((it) => (
        <li key={`${it.kind}-${it.userId}-${it.challengeId}-${it.createdAt}`} className="py-3 flex gap-3">
          <Avatar name={it.username} className="h-6 w-6 text-2xs shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-sm text-ink">
              <Link
                to={`/users/${it.userId}`}
                className="font-medium hover:text-amber"
              >
                {it.username}
              </Link>
              <span className="text-muted">
                {it.kind === 'solve' ? ' 解出了 ' : ' 发布了题解 '}
              </span>
              <Link
                to={`/challenges/${it.challengeId}`}
                className="hover:text-amber"
              >
                {it.challengeTitle}
              </Link>
            </div>
            <div className="font-mono text-2xs text-muted mt-0.5">
              {it.title ? `${it.title} · ` : ''}
              {relativeTime(it.createdAt)}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
