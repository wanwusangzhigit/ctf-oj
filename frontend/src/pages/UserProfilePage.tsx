import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Spinner,
  useToast,
} from '@/components/ui';
import { followUser, getUser, unfollowUser } from '@/api/user';
import { useAuthStore } from '@/stores/auth';
import { AvatarBlock } from '@/components/layout/AvatarBlock';
import { ApiClientError } from '@/api/client';
import { cn, formatNumber, formatTime } from '@/lib/utils';
import { userActivity, userAchievements } from '@/api/stats';
import type { Achievement } from '@/types';

const ACCOUNT_LINKS = [
  { to: '/settings', label: '资料', desc: '头像、简介与资料可见性' },
  { to: '/settings/password', label: '密码', desc: '修改登录密码' },
  { to: '/settings/security', label: '安全', desc: '两步验证与邮箱验证' },
  { to: '/me/solves', label: '我的解题', desc: '练习模式下解出的题目' },
  { to: '/me/submissions', label: '我的提交', desc: '全部 flag 尝试记录' },
];

export function UserProfilePage() {
  const { id } = useParams<{ id: string }>();
  const uid = Number(id);
  const me = useAuthStore((s) => s.user);
  const isMe = !!me && me.id === uid;
  const qc = useQueryClient();
  const toast = useToast();

  const valid = Number.isInteger(uid) && uid > 0;

  const userQ = useQuery({
    queryKey: ['user', uid],
    queryFn: () => getUser(uid),
    enabled: valid,
  });
  const activityQ = useQuery({
    queryKey: ['user-activity', uid],
    queryFn: () => userActivity(uid, 365),
    enabled: valid && !userQ.data?.privateProfile,
    staleTime: 60_000,
  });
  const achievementsQ = useQuery({
    queryKey: ['user-achievements', uid],
    queryFn: () => userAchievements(uid),
    enabled: valid && !userQ.data?.privateProfile,
    staleTime: 60_000,
  });

  const followMut = useMutation({
    mutationFn: (next: boolean) => (next ? followUser(uid) : unfollowUser(uid)),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['user', uid] }),
    onError: (err) =>
      toast.error(err instanceof ApiClientError ? err.message : '操作失败'),
  });

  if (!valid) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <p className="text-sm text-muted">用户 ID 无效。</p>
      </div>
    );
  }

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
          <CardBody className="py-10 text-center text-sm text-muted">
            {userQ.isError ? '无法打开该用户，请稍后重试。' : '用户不存在。'}
          </CardBody>
        </Card>
      </div>
    );
  }

  const u = userQ.data;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <Card>
        <CardBody>
          <div className="flex items-start gap-5">
            <AvatarBlock user={u} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold">{u.username}</h1>
                {u.role === 'admin' && <Badge tone="accent">管理员</Badge>}
              </div>
              <p className="text-2xs text-muted mt-1">
                注册于 {formatTime(u.createdAt)}
              </p>
              {u.bio && <p className="mt-3 text-sm text-fg">{u.bio}</p>}
              <div className="mt-3 flex items-center gap-4 font-mono text-2xs text-muted tabular-nums">
                <span>{formatNumber(u.followerCount ?? 0)} 关注者</span>
                <span>{formatNumber(u.followingCount ?? 0)} 关注中</span>
              </div>
            </div>
            <div className="text-right space-y-2">
              <div>
                <div className="text-2xs text-muted">积分</div>
                <div className="text-2xl font-semibold tabular-nums">
                  {formatNumber(u.score)}
                </div>
              </div>
              {me && !isMe && (
                <Button
                  size="sm"
                  variant={u.isFollowing ? 'outline' : 'primary'}
                  loading={followMut.isPending}
                  onClick={() => followMut.mutate(!u.isFollowing)}
                >
                  {u.isFollowing ? '取消关注' : '关注'}
                </Button>
              )}
            </div>
          </div>
        </CardBody>
      </Card>

      {u.privateProfile ? (
        <Card>
          <CardBody className="text-sm text-muted">
            该用户未公开个人资料与活动记录。
          </CardBody>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>解题活动</CardTitle>
            </CardHeader>
            <CardBody>
              <ActivityHeatmap days={activityQ.data ?? []} />
            </CardBody>
          </Card>
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>成就</CardTitle>
            </CardHeader>
            <CardBody>
              <AchievementList items={achievementsQ.data ?? []} />
            </CardBody>
          </Card>
        </div>
      )}

      {isMe && (
        <Card>
          <CardHeader>
            <CardTitle>账号</CardTitle>
          </CardHeader>
          <CardBody className="p-0">
            <ul className="divide-y divide-border">
              {ACCOUNT_LINKS.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-paper-2 transition-colors hover:no-underline"
                  >
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm text-ink">{link.label}</span>
                      <span className="block text-2xs text-muted">{link.desc}</span>
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function ActivityHeatmap({ days }: { days: { date: string; count: number }[] }) {
  const cells = useMemo(() => {
    const map = new Map(days.map((d) => [d.date, d.count]));
    const out: { date: string; count: number }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 364; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      out.push({ date: key, count: map.get(key) ?? 0 });
    }
    return out;
  }, [days]);

  return (
    <div className="space-y-2">
      <div className="grid grid-rows-7 grid-flow-col gap-1 overflow-x-auto">
        {cells.map((c) => (
          <div
            key={c.date}
            title={`${c.date}: ${c.count}`}
            className={cn(
              'h-2.5 w-2.5 rounded-[1px]',
              c.count === 0 ? 'bg-rule' : 'bg-amber',
            )}
            style={c.count > 0 ? { opacity: Math.min(0.35 + c.count * 0.2, 1) } : undefined}
          />
        ))}
      </div>
      <div className="flex items-center justify-between font-mono text-2xs text-muted">
        <span>过去 365 天</span>
        <span>{cells.reduce((n, c) => n + c.count, 0)} 次解题</span>
      </div>
    </div>
  );
}

function AchievementList({ items }: { items: Achievement[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted">暂无成就数据。</p>;
  }
  return (
    <ul className="space-y-3">
      {items.map((a) => (
        <li key={a.key} className="flex items-start gap-2">
          <span
            className={cn(
              'mt-1.5 h-2 w-2 rounded-full shrink-0',
              a.earned ? 'bg-amber' : 'bg-rule',
            )}
          />
          <div className="min-w-0">
            <div className={cn('text-sm', a.earned ? 'text-ink' : 'text-muted')}>
              {a.label}
            </div>
            <div className="text-2xs text-muted">
              {a.description} · {Math.min(a.progress, a.target)}/{a.target}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
