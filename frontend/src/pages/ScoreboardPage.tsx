import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { scoreboard } from '@/api/user';
import { Card, CardBody, Spinner, Badge } from '@/components/ui';
import { Avatar } from '@/components/layout/Avatar';
import { formatNumber } from '@/lib/utils';
import { Trophy } from 'lucide-react';
import type { User } from '@/types';

export function ScoreboardPage() {
  const [page] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['scoreboard', page],
    queryFn: () => scoreboard(page, 50),
    staleTime: 30_000,
  });

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">榜单</h1>
        <p className="text-sm text-muted mt-1">按当前积分排序。</p>
      </header>

      <Card>
        <CardBody className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Spinner className="h-5 w-5 text-muted" />
            </div>
          ) : data?.items?.length ? (
            <Table users={data.items} />
          ) : (
            <div className="py-20 text-center text-sm text-muted">
              还没有选手参赛。
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function Table({ users }: { users: User[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-2xs uppercase text-muted bg-surface-2">
            <th className="text-left px-5 py-2 font-medium w-12">#</th>
            <th className="text-left px-5 py-2 font-medium">选手</th>
            <th className="text-left px-5 py-2 font-medium">角色</th>
            <th className="text-right px-5 py-2 font-medium">积分</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {users.map((u, idx) => (
            <tr key={u.id} className="hover:bg-surface-2/50">
              <td className="px-5 py-3 font-mono text-muted">{idx + 1}</td>
              <td className="px-5 py-3">
                <div className="flex items-center gap-2.5">
                  <Avatar name={u.username} />
                  <span className="font-medium">{u.username}</span>
                  {idx === 0 && (
                    <Trophy className="h-3.5 w-3.5 text-warning" />
                  )}
                </div>
              </td>
              <td className="px-5 py-3">
                {u.role === 'admin' ? <Badge tone="accent">管理员</Badge> : <Badge>用户</Badge>}
              </td>
              <td className="px-5 py-3 text-right font-mono tabular-nums">
                {formatNumber(u.score)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
