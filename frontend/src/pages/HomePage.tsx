import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Trophy, Flag, Users } from 'lucide-react';
import { listChallenges } from '@/api/challenge';
import { scoreboard } from '@/api/user';
import { Card, CardBody, CardHeader, CardTitle, Badge, Spinner } from '@/components/ui';
import { Avatar } from '@/components/layout/Avatar';
import { formatNumber } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth';

export function HomePage() {
  const user = useAuthStore((s) => s.user);

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

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <section className="space-y-3 mb-10">
        <Badge tone="accent">v0.1</Badge>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-fg">
          一个面向 CTF 练习的在线评测系统
        </h1>
        <p className="text-muted max-w-2xl">
          覆盖 Web、Pwn、Crypto、Reverse、Misc、Forensics 等方向；动态打分、附件下载、解题记录一应俱全。
          {user ? ` 欢迎，${user.username}。` : ' 注册账号后即刻开始练习。'}
        </p>
        <div className="flex gap-2 pt-2">
          <Link
            to="/challenges"
            className="inline-flex items-center gap-1 h-9 px-4 rounded-md bg-accent text-accent-fg text-sm font-medium hover:bg-accent-hover transition-colors"
          >
            浏览题目
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <Link
            to="/scoreboard"
            className="inline-flex items-center gap-1 h-9 px-4 rounded-md border border-border-strong text-sm font-medium hover:bg-surface-2 transition-colors"
          >
            查看榜单
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3 mb-10">
        <StatCard label="题目总数" value={challenges.data?.total ?? '—'} icon={Flag} />
        <StatCard label="参赛选手" value={board.data?.total ?? '—'} icon={Users} />
        <StatCard
          label="最高分"
          value={board.data?.items?.[0]?.score ?? '—'}
          icon={Trophy}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle>最新题目</CardTitle>
              <Link to="/challenges" className="text-sm text-accent">
                查看全部
              </Link>
            </CardHeader>
            <CardBody className="p-0">
              {challenges.isLoading ? (
                <Loading />
              ) : challenges.data?.items?.length ? (
                <ul className="divide-y divide-border">
                  {challenges.data.items.map((c) => (
                    <li key={c.id}>
                      <Link
                        to={`/challenges/${c.id}`}
                        className="flex items-center justify-between px-5 py-3 hover:bg-surface-2 transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="font-medium truncate">{c.title}</div>
                          <div className="text-2xs text-muted mt-0.5">
                            {c.category?.name ?? '未分类'} · {c.solveCount} 人已解
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {c.solved && <Badge tone="success">已解</Badge>}
                          <span className="text-sm font-mono text-fg">{c.baseScore}</span>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty label="暂无题目" />
              )}
            </CardBody>
          </Card>
        </section>

        <section>
          <Card>
            <CardHeader>
              <CardTitle>榜单 Top 5</CardTitle>
            </CardHeader>
            <CardBody className="p-0">
              {board.isLoading ? (
                <Loading />
              ) : board.data?.items?.length ? (
                <ul className="divide-y divide-border">
                  {board.data.items.map((u, idx) => (
                    <li key={u.id} className="flex items-center gap-3 px-5 py-3">
                      <span className="font-mono text-xs text-muted w-4">{idx + 1}</span>
                      <Avatar name={u.username} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{u.username}</div>
                      </div>
                      <div className="font-mono text-sm">{formatNumber(u.score)}</div>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty label="榜单为空" />
              )}
            </CardBody>
          </Card>
        </section>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  icon: typeof Flag;
}) {
  return (
    <Card>
      <CardBody className="flex items-center gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded bg-surface-2 text-muted">
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <div className="text-2xs text-muted">{label}</div>
          <div className="text-xl font-semibold tabular-nums">{value}</div>
        </div>
      </CardBody>
    </Card>
  );
}

function Loading() {
  return (
    <div className="flex items-center justify-center py-10">
      <Spinner className="h-5 w-5 text-muted" />
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <div className="text-center py-10 text-sm text-muted">{label}</div>;
}
