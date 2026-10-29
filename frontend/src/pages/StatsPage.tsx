import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { overview, byCategory, solveTrend, recentSolves, firstBloods } from '@/api/stats';
import { Spinner, Badge } from '@/components/ui';
import { formatNumber, relativeTime } from '@/lib/utils';

/**
 * Stats — no identical rounded stat-card trio. Instead:
 *   - one large numeric strip at the top (4 numbers, mono, ruled columns)
 *   - ruled lists for category breakdown and recent solves
 *   - trend rendered as ASCII-style vertical bars in mono amber
 */
export function StatsPage() {
  const ov = useQuery({
    queryKey: ['stats-overview'],
    queryFn: overview,
    staleTime: 60_000,
  });
  const cats = useQuery({
    queryKey: ['stats-category'],
    queryFn: byCategory,
    staleTime: 60_000,
  });
  const trend = useQuery({
    queryKey: ['stats-trend'],
    queryFn: () => solveTrend(14),
    staleTime: 60_000,
  });
  const recent = useQuery({
    queryKey: ['stats-recent'],
    queryFn: () => recentSolves(15),
    staleTime: 30_000,
  });
  const bloods = useQuery({
    queryKey: ['stats-first-bloods'],
    queryFn: () => firstBloods(10),
    staleTime: 60_000,
  });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <header className="border-t-2 border-ink pt-6 mb-8">
        <p className="font-mono text-2xs text-ink-3 mb-3">$ stats --range=all</p>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tightest text-ink leading-[1.1]">
          统计
        </h1>
        <p className="mt-2 text-ink-2 max-w-prose">
          站点活动概览 —— 解题趋势、分类分布与最近的提交。
        </p>
      </header>

      {/* Numeric strip — 4 ruled columns, no icon-in-circles */}
      <section
        className="grid grid-cols-2 md:grid-cols-4 border-t border-b border-rule-strong divide-x divide-rule"
        aria-label="概览"
      >
        <StatCell
          label="注册用户"
          value={ov.data?.totalUsers}
          hint={`活跃 ${ov.data?.activeUsers ?? 0}`}
          loading={ov.isLoading}
        />
        <StatCell
          label="题目总数"
          value={ov.data?.totalChallenges}
          hint={`已发布 ${ov.data?.publishedCount ?? 0}`}
          loading={ov.isLoading}
        />
        <StatCell
          label="解题总数"
          value={ov.data?.totalSolves}
          hint={`提交 ${ov.data?.totalSubmissions ?? 0}`}
          loading={ov.isLoading}
        />
        <StatCell
          label="运行实例"
          value={ov.data?.runningInstances}
          hint={`团队 ${ov.data?.totalTeams ?? 0}`}
          loading={ov.isLoading}
        />
      </section>

      <div className="grid gap-10 lg:grid-cols-2 mt-12">
        <section>
          <SectionLabel>分类分布</SectionLabel>
          {cats.isLoading ? (
            <Loading />
          ) : (cats.data?.length ?? 0) === 0 ? (
            <Empty label="暂无分类" />
          ) : (
            <div className="border-t border-rule">
              {cats.data!.map((c) => {
                const max = Math.max(1, ...cats.data!.map((x) => x.count));
                const ratio = (c.count / max) * 100;
                return (
                  <div
                    key={c.categoryId}
                    className="py-2.5 border-b border-rule"
                  >
                    <div className="flex items-baseline justify-between mb-1 gap-3">
                      <span className="text-sm font-medium truncate">
                        {c.categoryName}
                      </span>
                      <span className="font-mono text-2xs text-ink-3 tabular-nums shrink-0">
                        {c.count} 题 · {c.solves} 解
                      </span>
                    </div>
                    <div className="h-1.5 bg-paper-2 rounded-sm overflow-hidden">
                      <div
                        className="h-full bg-amber transition-all duration-300"
                        style={{ width: `${ratio}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <SectionLabel>解题趋势（14 天）</SectionLabel>
          {trend.isLoading ? (
            <Loading />
          ) : (trend.data?.length ?? 0) === 0 ? (
            <Empty label="最近没有解题记录" />
          ) : (
            <TrendBars points={trend.data!} />
          )}
        </section>
      </div>

      <section className="mt-12">
        <SectionLabel>最近的解题</SectionLabel>
        {recent.isLoading ? (
          <Loading />
        ) : (recent.data?.length ?? 0) === 0 ? (
          <Empty label="暂无解题" />
        ) : (
          <ul className="border-t border-rule">
            {recent.data!.map((r, idx) => (
              <li
                key={idx}
                className="grid grid-cols-[auto_1fr_auto] gap-x-3 items-center py-2.5 border-b border-rule"
              >
                <span className="font-mono text-2xs text-ink-3 tabular-nums w-12">
                  {relativeTime(r.solvedAt)}
                </span>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-medium truncate text-sm">
                    {r.username}
                  </span>
                  <span className="text-ink-3 text-2xs font-mono">解出</span>
                  <Link
                    to="/challenges"
                    className="text-amber text-sm truncate hover:no-underline"
                  >
                    {r.challengeName}
                  </Link>
                  {r.isFirstBlood && <Badge tone="accent">首杀</Badge>}
                </div>
                <span className="font-mono text-sm tabular-nums text-ink text-right">
                  +{formatNumber(r.score)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-12">
        <SectionLabel>首解记录</SectionLabel>
        {bloods.isLoading ? (
          <Loading />
        ) : (bloods.data?.length ?? 0) === 0 ? (
          <Empty label="暂无首解记录" />
        ) : (
          <ul className="border-t border-rule">
            {bloods.data!.map((r, idx) => (
              <li
                key={idx}
                className="grid grid-cols-[auto_1fr_auto] gap-x-3 items-center py-2.5 border-b border-rule"
              >
                <span className="font-mono text-2xs text-amber tabular-nums w-12">
                  1st
                </span>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-medium truncate text-sm">
                    {r.username}
                  </span>
                  <span className="text-ink-3 text-2xs font-mono">首解</span>
                  <span className="text-sm truncate">{r.challengeName}</span>
                </div>
                <span className="font-mono text-2xs text-ink-3 tabular-nums">
                  {relativeTime(r.solvedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/**
 * StatCell — large mono number with a small mono caption.
 * No icon-in-circle, no rounded card wrapper. The number IS the design.
 */
function StatCell({
  label,
  value,
  hint,
  loading,
}: {
  label: string;
  value?: number;
  hint?: string;
  loading?: boolean;
}) {
  return (
    <div className="px-5 py-5">
      <div className="font-mono text-2xs text-ink-3 mb-2">{label}</div>
      <div className="font-mono tabular-nums text-3xl text-ink tracking-tight">
        {loading ? '—' : formatNumber(value ?? 0)}
      </div>
      {hint && (
        <div className="font-mono text-2xs text-ink-3 mt-1">{hint}</div>
      )}
    </div>
  );
}

function TrendBars({ points }: { points: { date: string; solves: number }[] }) {
  const max = Math.max(1, ...points.map((p) => p.solves));
  return (
    <div>
      <div className="flex items-end gap-1 h-32">
        {points.map((p) => {
          const ratio = (p.solves / max) * 100;
          return (
            <div
              key={p.date}
              className="flex-1 group relative flex flex-col items-center justify-end"
              title={`${p.date}: ${p.solves} 次`}
            >
              <div
                className="w-full bg-amber/80 group-hover:bg-amber transition-colors"
                style={{ height: `${Math.max(2, ratio)}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-1 mt-1 font-mono text-2xs text-ink-3 tabular-nums">
        {points.map((p) => (
          <span key={p.date} className="flex-1 text-center hidden sm:inline">
            {p.date.slice(5)}
          </span>
        ))}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-b border-rule pb-2 mb-3">
      <h2 className="text-sm font-medium text-ink">{children}</h2>
    </div>
  );
}

function Loading() {
  return (
    <div className="border-t border-rule py-10 flex justify-center">
      <Spinner className="h-5 w-5 text-ink-3" />
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="border-t border-rule py-10 text-center text-sm text-ink-3">
      {label}
    </div>
  );
}
