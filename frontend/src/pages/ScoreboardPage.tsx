import i18n from '@/locales/i18n';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { scoreboard } from '@/api/user';
import { Spinner, Badge } from '@/components/ui';
import { Avatar } from '@/components/layout/Avatar';
import { formatNumber } from '@/lib/utils';
import type { User } from '@/types';

/**
 * Scoreboard — rendered like a competition printout:
 *
 *   RANK   PLAYER                          ROLE          SCORE
 *   01     alice                           admin         12,480
 *   02     bob                             user           9,210
 *
 * Header row is lowercase mono (not ALL-CAPS-tracked), body uses tabular figures.
 */
export function ScoreboardPage() {
  const [page] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['scoreboard', page],
    queryFn: () => scoreboard(page, 50),
    staleTime: 30_000,
  });

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <header className="border-t-2 border-ink pt-6 mb-8">
        <p className="font-mono text-2xs text-ink-3 mb-3">$ cat /var/scoreboard</p>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tightest text-ink leading-[1.1]">
          {i18n.t('榜单')}
        </h1>
        <p className="mt-2 text-ink-2 max-w-prose">{i18n.t('按当前积分排序。每周一凌晨 4:00 重置数据缓存。')}</p>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner className="h-5 w-5 text-ink-3" />
        </div>
      ) : data?.items?.length ? (
        <Table users={data.items} />
      ) : (
        <div className="border-t border-rule py-16 text-center text-sm text-ink-3">{i18n.t('还没有选手参赛 ——{{v0}}', { v0: ' ' })}<Link to="/challenges" className="text-amber">
            {i18n.t('看看题目')}
          </Link>
        </div>
      )}
    </div>
  );
}

function Table({ users }: { users: User[] }) {
  return (
    <div className="border-t border-rule">
      <div className="hidden md:grid grid-cols-[4rem_1fr_8rem_6rem] gap-x-4 py-2 border-b border-rule-strong font-mono text-2xs text-ink-3">
        <span>rank</span>
        <span>player</span>
        <span>role</span>
        <span className="text-right">score</span>
      </div>
      <ul>
        {users.map((u, idx) => (
          <li
            key={u.id}
            className="grid grid-cols-[3rem_1fr_auto] md:grid-cols-[4rem_1fr_8rem_6rem] gap-x-4 items-center py-3 border-b border-rule hover:bg-paper-2 transition-colors"
          >
            <span className="font-mono text-sm text-ink-3 tabular-nums">
              {String(idx + 1).padStart(2, '0')}
            </span>
            <Link
              to={`/users/${u.id}`}
              className="flex items-center gap-2.5 min-w-0 hover:no-underline group"
            >
              <Avatar name={u.username} />
              <span className="font-medium truncate group-hover:text-amber transition-colors">
                {u.username}
              </span>
              {idx === 0 && <FirstPlaceMark />}
            </Link>
            <div className="hidden md:block">
              {u.role === 'admin' ? (
                <Badge tone="accent">admin</Badge>
              ) : (
                <span className="font-mono text-2xs text-ink-3">user</span>
              )}
            </div>
            <span className="font-mono text-sm tabular-nums text-ink text-right">
              {formatNumber(u.score)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A small amber dot — quieter than a trophy emoji, still draws the eye to #1. */
function FirstPlaceMark() {
  return (
    <span
      aria-label="first place"
      title="first place"
      className="inline-block h-1.5 w-1.5 rounded-full bg-amber shrink-0"
    />
  );
}
