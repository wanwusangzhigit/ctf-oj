import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Clock } from 'lucide-react';
import { Spinner } from '@/components/ui';
import {
  competitionScoreboard,
  competitionTeamScoreboard,
} from '@/api/competition';
import { formatTime } from '@/lib/utils';
import { useCompetitionOutlet } from './CompetitionLayout';

export function CompetitionScoreboardPage() {
  const { competition: c, phase } = useCompetitionOutlet();
  const [group, setGroup] = useState<'user' | 'team'>('user');
  const [boardPage, setBoardPage] = useState(1);
  const [teamPage, setTeamPage] = useState(1);

  const board = useQuery({
    queryKey: ['competition-scoreboard', c.id, boardPage],
    queryFn: () => competitionScoreboard(c.id, boardPage, 20),
    enabled: group === 'user',
    staleTime: 30_000,
  });
  const teamBoard = useQuery({
    queryKey: ['competition-team-scoreboard', c.id, teamPage],
    queryFn: () => competitionTeamScoreboard(c.id, teamPage, 20),
    enabled: group === 'team',
    staleTime: 30_000,
  });

  return (
    <section>
      <div className="border-b border-rule pb-2 mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-ink">赛事榜</h2>
        <div className="flex items-center gap-1" role="group" aria-label="榜单类型">
          {(['user', 'team'] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGroup(g)}
              aria-pressed={group === g}
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

      {c.scoreboardFrozen && c.freezeAt && (
        <p className="mb-3 border-l-2 border-amber pl-3 text-2xs text-ink-2">
          封榜中：公开榜单停留在 {formatTime(c.freezeAt)}，封榜后的提交仍计入最终成绩，赛事结束后恢复完整排名。
        </p>
      )}
      {!c.scoreboardFrozen && phase === 'ended' && c.freezeAt && (
        <p className="mb-3 text-2xs text-ink-3">赛事已结束，榜单已恢复完整排名。</p>
      )}

      {group === 'user' ? (
        board.isLoading ? (
          <Spinner className="h-4 w-4 text-ink-3" />
        ) : board.isError ? (
          <p className="text-sm text-ink-3">无法加载赛事榜。</p>
        ) : (board.data?.items.length ?? 0) === 0 ? (
          <p className="text-sm text-ink-3">暂无成绩。</p>
        ) : (
          <>
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
                      {(boardPage - 1) * 20 + i + 1}
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
            <Pager
              page={boardPage}
              total={board.data!.total}
              pageSize={20}
              onChange={setBoardPage}
            />
          </>
        )
      ) : teamBoard.isLoading ? (
        <Spinner className="h-4 w-4 text-ink-3" />
      ) : teamBoard.isError ? (
        <p className="text-sm text-ink-3">无法加载团队榜。</p>
      ) : (teamBoard.data?.items.length ?? 0) === 0 ? (
        <p className="text-sm text-ink-3">暂无团队成绩。</p>
      ) : (
        <>
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
                    {(teamPage - 1) * 20 + i + 1}
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
          <Pager
            page={teamPage}
            total={teamBoard.data!.total}
            pageSize={20}
            onChange={setTeamPage}
          />
        </>
      )}

      <p className="mt-8 font-mono text-2xs text-ink-3 inline-flex items-center gap-1">
        <Clock className="h-3 w-3" />
        {c.freezeAt
          ? '封榜期间榜单停留在封榜时刻；封榜后的提交仍计入最终成绩，赛事结束后恢复完整排名。'
          : '赛事榜按赛事内解题得分汇总，不影响练习进度与全局分。'}
      </p>
    </section>
  );
}

function Pager({
  page,
  total,
  pageSize,
  onChange,
}: {
  page: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="mt-3 flex items-center justify-end gap-2 font-mono text-2xs text-ink-3">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className="h-7 px-2 border border-rule rounded-sm disabled:opacity-40 hover:text-ink"
      >
        上一页
      </button>
      <span className="tabular-nums">
        {page} / {pages}
      </span>
      <button
        type="button"
        disabled={page >= pages}
        onClick={() => onChange(page + 1)}
        className="h-7 px-2 border border-rule rounded-sm disabled:opacity-40 hover:text-ink"
      >
        下一页
      </button>
    </div>
  );
}
