import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Badge, Spinner } from '@/components/ui';
import { mySolves } from '@/api/user';
import { formatNumber, formatTime } from '@/lib/utils';

/**
 * /me/solves — every practice challenge the signed-in user has solved.
 * Split out of the profile page so the public profile stays read-only.
 */
export function MeSolvesPage() {
  const q = useQuery({
    queryKey: ['my-solves'],
    queryFn: () => mySolves(),
    staleTime: 30_000,
  });

  const solves = q.data;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <header className="border-t-2 border-ink pt-6 mb-8">
        <p className="font-mono text-2xs text-ink-3 mb-3">$ history --solves</p>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tightest text-ink leading-[1.1]">
          我的解题
        </h1>
        <p className="mt-2 text-ink-2 max-w-prose">
          练习模式下解出的题目，按解题时间倒序排列；赛事解题记录见对应赛事榜单。
        </p>
      </header>

      {q.isLoading ? (
        <div className="py-10 flex items-center justify-center">
          <Spinner className="h-5 w-5 text-ink-3" />
        </div>
      ) : q.isError ? (
        <div className="border-t border-rule py-10 text-center text-sm text-ink-3">
          无法加载解题记录，请稍后重试。
        </div>
      ) : !solves || solves.length === 0 ? (
        <div className="border-t border-rule py-10 text-center text-sm text-ink-3">
          还没有解题记录 —— 去
          <Link to="/challenges" className="text-amber hover:underline">
            题目列表
          </Link>
          试试第一题。
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between font-mono text-2xs text-ink-3 mb-2">
            <span>{formatNumber(solves.length)} 题解出</span>
            <span className="tabular-nums">
              合计 +{formatNumber(solves.reduce((n, s) => n + s.score, 0))}
            </span>
          </div>
          <div className="border-t border-ink">
            <ul>
              {solves.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-3 py-3 border-b border-rule"
                >
                  <div className="min-w-0">
                    <Link
                      to={`/challenges/${s.challengeId}`}
                      className="block text-sm text-ink truncate hover:text-amber"
                    >
                      {s.challenge?.title ?? `题目 #${s.challengeId}`}
                    </Link>
                    <div className="font-mono text-2xs text-ink-3 tabular-nums">
                      {formatTime(s.solvedAt)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {s.isFirstBlood && <Badge tone="warning">首杀</Badge>}
                    <span className="font-mono text-sm tabular-nums text-ink">
                      +{s.score}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-6 font-mono text-2xs text-ink-3">
            <Link to="/me/submissions" className="text-amber hover:underline">
              $ history --submissions
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
