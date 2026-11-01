import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { Badge, Spinner } from '@/components/ui';
import {
  UserManageForm,
  UserPasswordResetForm,
} from '@/components/admin/UserManageForm';
import { adminGetUser } from '@/api/admin';
import { ApiClientError } from '@/api/client';
import { useAuthStore } from '@/stores/auth';
import { ROLE_LABEL } from '@/lib/permissions';
import { formatTime } from '@/lib/utils';

/**
 * /admin/users/:id — the single place where roles, ban state, leaderboard
 * exclusion and password reset are edited. `PATCH /admin/users/:id` refuses
 * self-edits, so the form is replaced by an explanation for your own account.
 */
export function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const userId = Number(id);
  const me = useAuthStore((s) => s.user);

  const valid = Number.isInteger(userId) && userId > 0;
  const query = useQuery({
    queryKey: ['admin-user', userId],
    queryFn: () => adminGetUser(userId),
    enabled: valid,
    staleTime: 30_000,
  });

  const back = (
    <Link
      to="/admin/users"
      className="inline-flex items-center gap-1 text-sm text-ink-3 hover:text-ink transition-colors hover:no-underline"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      返回用户列表
    </Link>
  );

  if (!valid) {
    return (
      <div className="space-y-4">
        {back}
        <div className="border-t border-rule pt-6">
          <h2 className="text-lg font-semibold tracking-tight text-ink">用户 ID 无效</h2>
          <p className="text-sm text-ink-3 mt-2">URL 中的 id 参数不是合法的数字。</p>
        </div>
      </div>
    );
  }

  if (query.isLoading) {
    return (
      <div className="py-16 flex items-center justify-center">
        <Spinner className="h-5 w-5 text-ink-3" />
      </div>
    );
  }

  const user = query.data;
  if (query.isError || !user) {
    const notFound =
      query.error instanceof ApiClientError && query.error.code === 40400;
    return (
      <div className="space-y-4">
        {back}
        <div className="border-t border-rule pt-6">
          <h2 className="text-lg font-semibold tracking-tight text-ink">无法打开该用户</h2>
          <p className="text-sm text-ink-3 mt-2">
            {notFound ? '用户不存在，或账号已被删除。' : '用户信息加载失败，请稍后重试。'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {back}
      <header className="border-b border-rule pb-3">
        <p className="font-mono text-2xs text-ink-3 mb-1 tabular-nums">
          $ sudo admin --users {user.id}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-2xl font-semibold tracking-tight text-ink">{user.username}</h2>
          <Badge tone={user.role === 'admin' ? 'accent' : undefined}>{ROLE_LABEL[user.role]}</Badge>
          {user.isBanned && <Badge tone="danger">已封禁</Badge>}
          {user.scoreExcluded && <Badge>榜单排除</Badge>}
        </div>
        <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-2xs text-ink-3">
          <div className="flex gap-1">
            <dt>邮箱</dt>
            <dd className="font-mono text-ink">{user.email ?? '—'}</dd>
          </div>
          <div className="flex gap-1">
            <dt>积分</dt>
            <dd className="font-mono text-ink tabular-nums">{user.score}</dd>
          </div>
          <div className="flex gap-1">
            <dt>注册于</dt>
            <dd className="text-ink">{formatTime(user.createdAt)}</dd>
          </div>
          {user.bannedAt && (
            <div className="flex gap-1">
              <dt>封禁于</dt>
              <dd className="text-ink">{formatTime(user.bannedAt)}</dd>
            </div>
          )}
        </dl>
        <p className="mt-2">
          <Link
            to={`/users/${user.id}`}
            className="text-sm text-ink-3 hover:text-amber transition-colors"
          >
            查看公开主页
          </Link>
        </p>
      </header>

      {user.id === me?.id ? (
        <div className="border border-rule bg-paper-2/40 p-6">
          <h3 className="text-sm font-medium text-ink">不能修改自己的权限与状态</h3>
          <p className="mt-2 text-sm text-ink-3">
            后端拒绝管理员对自己的账号变更角色、封禁或榜单排除，避免唯一的管理员把自己锁在门外。
            需要调整时请使用另一个管理员账号。
          </p>
        </div>
      ) : (
        <UserManageForm user={user} />
      )}
      <UserPasswordResetForm user={user} />
    </div>
  );
}
