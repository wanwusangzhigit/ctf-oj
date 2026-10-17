import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getUser, mySolves } from '@/api/user';
import { Card, CardBody, CardHeader, CardTitle, Spinner, Badge } from '@/components/ui';
import { Avatar } from '@/components/layout/Avatar';
import { useAuthStore } from '@/stores/auth';
import { formatNumber, formatTime } from '@/lib/utils';

export function UserProfilePage() {
  const { id } = useParams<{ id: string }>();
  const uid = Number(id);
  const me = useAuthStore((s) => s.user);
  const isMe = !!me && me.id === uid;

  const userQ = useQuery({
    queryKey: ['user', uid],
    queryFn: () => getUser(uid),
    enabled: !Number.isNaN(uid),
  });
  const solvesQ = useQuery({
    queryKey: ['user-solves', uid],
    queryFn: () => mySolves(),
    enabled: isMe,
  });

  if (userQ.isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 flex items-center justify-center">
        <Spinner className="h-5 w-5 text-muted" />
      </div>
    );
  }
  if (!userQ.data) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <Card>
          <CardBody className="py-10 text-center text-sm text-muted">用户不存在。</CardBody>
        </Card>
      </div>
    );
  }

  const u = userQ.data;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <Card>
        <CardBody className="flex items-start gap-4">
          <Avatar name={u.username} className="h-14 w-14 text-lg" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold">{u.username}</h1>
              {u.role === 'admin' && <Badge tone="accent">管理员</Badge>}
            </div>
            <p className="text-2xs text-muted mt-1">注册于 {formatTime(u.createdAt)}</p>
            {u.bio && <p className="mt-3 text-sm text-fg">{u.bio}</p>}
          </div>
          <div className="text-right">
            <div className="text-2xs text-muted">积分</div>
            <div className="text-2xl font-semibold tabular-nums">{formatNumber(u.score)}</div>
          </div>
        </CardBody>
      </Card>

      {isMe && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>我的解题</CardTitle>
          </CardHeader>
          <CardBody className="p-0">
            {solvesQ.isLoading ? (
              <div className="py-10 flex items-center justify-center">
                <Spinner className="h-5 w-5 text-muted" />
              </div>
            ) : solvesQ.data?.length ? (
              <ul className="divide-y divide-border">
                {solvesQ.data.map((s) => (
                  <li key={s.id} className="px-5 py-3 flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="font-medium truncate">
                        {s.challenge?.title ?? `题目 #${s.challengeId}`}
                      </div>
                      <div className="text-2xs text-muted">{formatTime(s.solvedAt)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {s.isFirstBlood && <Badge tone="warning">首杀</Badge>}
                      <span className="font-mono text-sm tabular-nums">+{s.score}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="py-10 text-center text-sm text-muted">还没有解题记录。</div>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
