import { useDeferredValue, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, KeyRound, ShieldOff, Unlock } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Input,
  Spinner,
  useToast,
} from '@/components/ui';
import { Avatar } from '@/components/layout/Avatar';
import { adminListUsers, adminResetPassword, adminUpdateUser } from '@/api/admin';
import { formatTime } from '@/lib/utils';
import { ApiClientError } from '@/api/client';
import type { User } from '@/types';

const PAGE_SIZE = 50;

const ROLE_LABEL: Record<User['role'], string> = {
  user: '普通用户',
  challenge_admin: '题目管理员',
  competition_admin: '比赛管理员',
  moderator: '内容版主',
  admin: '管理员',
};

export function AdminUsersPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('');
  const [banned, setBanned] = useState('');
  const [page, setPage] = useState(1);
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    setPage(1);
  }, [deferredQuery, role, banned]);

  const list = useQuery({
    queryKey: ['admin-users', deferredQuery, role, banned, page],
    queryFn: () =>
      adminListUsers(page, PAGE_SIZE, {
        q: deferredQuery.trim() || undefined,
        role: role || undefined,
        banned: banned === '' ? undefined : banned === 'true',
      }),
    staleTime: 10_000,
  });

  const resetMut = useMutation({
    mutationFn: (vars: { id: number; password: string }) =>
      adminResetPassword(vars.id, vars.password),
    onSuccess: () => toast.success('密码已重置'),
    onError: (err) => toast.error(err instanceof ApiClientError ? err.message : '重置失败'),
  });

  const updateMut = useMutation({
    mutationFn: (vars: { id: number; patch: Parameters<typeof adminUpdateUser>[1] }) =>
      adminUpdateUser(vars.id, vars.patch),
    onSuccess: () => {
      toast.success('已更新');
      qc.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err) => toast.error(err instanceof ApiClientError ? err.message : '操作失败'),
  });

  const users = list.data?.items ?? [];
  const total = list.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const updatingId = updateMut.isPending ? updateMut.variables?.id : undefined;

  const actionsFor = (u: User) => ({
    onToggleBan: () => {
      if (u.isBanned) {
        if (!confirm(`解封用户「${u.username}」？`)) return;
        updateMut.mutate({ id: u.id, patch: { isBanned: false } });
        return;
      }
      const reason = prompt(`封禁「${u.username}」的原因（可选）`);
      if (reason === null) return;
      if (!confirm(`确认封禁用户「${u.username}」？`)) return;
      updateMut.mutate({
        id: u.id,
        patch: { isBanned: true, bannedReason: reason.trim() },
      });
    },
    onRoleChange: (nextRole: User['role']) =>
      updateMut.mutate({
        id: u.id,
        patch: { role: nextRole },
      }),
    onResetPassword: () => {
      const pw = prompt(`为「${u.username}」设置新密码（至少 8 位）`);
      if (pw === null) return;
      if (pw.length < 8) return toast.error('新密码至少 8 位');
      if (!confirm(`确认重置「${u.username}」的密码？该用户现有登录不会自动失效。`))
        return;
      resetMut.mutate({ id: u.id, password: pw });
    },
    onToggleExcluded: () => {
      const next = !u.scoreExcluded;
      if (
        !confirm(
          next
            ? `将「${u.username}」排除出榜单？`
            : `恢复「${u.username}」的榜单排名？`,
        )
      ) {
        return;
      }
      updateMut.mutate({ id: u.id, patch: { scoreExcluded: next } });
    },
  });

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle className="whitespace-nowrap">用户管理（{list.data?.total ?? 0}）</CardTitle>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索用户名 / 邮箱"
            className="w-full sm:w-56"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="h-9 px-2 bg-paper border border-rule rounded-sm text-sm"
          >
            <option value="">全部角色</option>
            {Object.entries(ROLE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={banned}
            onChange={(e) => setBanned(e.target.value)}
            className="h-9 px-2 bg-paper border border-rule rounded-sm text-sm"
          >
            <option value="">全部状态</option>
            <option value="false">正常</option>
            <option value="true">已封禁</option>
          </select>
        </div>
      </CardHeader>
      <CardBody className="p-0">
        {list.isLoading ? (
          <div className="py-12 flex justify-center">
            <Spinner className="h-5 w-5 text-muted" />
          </div>
        ) : users.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted">
            没有匹配的用户。
          </div>
        ) : (
          <>
            <div className="divide-y divide-rule md:hidden">
              {users.map((u) => (
                <UserCard
                  key={u.id}
                  user={u}
                  updating={updatingId === u.id}
                  {...actionsFor(u)}
                />
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="text-2xs uppercase text-muted bg-surface-2">
                    <th className="text-left px-5 py-2 font-medium">用户</th>
                    <th className="hidden text-left px-5 py-2 font-medium lg:table-cell">邮箱</th>
                    <th className="text-left px-5 py-2 font-medium">角色</th>
                    <th className="text-left px-5 py-2 font-medium">积分</th>
                    <th className="hidden text-left px-5 py-2 font-medium lg:table-cell">注册</th>
                    <th className="text-right px-5 py-2 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {users.map((u) => (
                    <UserRow
                      key={u.id}
                      user={u}
                      updating={updatingId === u.id}
                      {...actionsFor(u)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t border-rule px-5 py-3 text-2xs text-muted">
            <span>
              第 {page} / {totalPages} 页 · 共 {total} 位用户
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || list.isFetching}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                上一页
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages || list.isFetching}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                下一页
              </Button>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function UserRow({
  user,
  updating,
  onToggleBan,
  onRoleChange,
  onResetPassword,
  onToggleExcluded,
}: {
  user: User;
  updating: boolean;
  onToggleBan: () => void;
  onRoleChange: (role: User['role']) => void;
  onResetPassword: () => void;
  onToggleExcluded: () => void;
}) {
  return (
    <tr className="hover:bg-surface-2/40">
      <td className="px-5 py-3">
        <div className="flex items-center gap-2">
          <Avatar name={user.username} />
          <span className="font-medium">{user.username}</span>
          {user.isBanned && <Badge tone="danger">已封禁</Badge>}
          {user.scoreExcluded && <Badge>榜单排除</Badge>}
        </div>
      </td>
      <td className="hidden px-5 py-3 text-muted lg:table-cell">{user.email}</td>
      <td className="px-5 py-3">
        <RoleSelect user={user} updating={updating} onRoleChange={onRoleChange} />
      </td>
      <td className="px-5 py-3 font-mono tabular-nums">{user.score}</td>
      <td className="hidden px-5 py-3 text-2xs text-muted lg:table-cell">
        {formatTime(user.createdAt)}
      </td>
      <td className="px-5 py-3">
        <UserActions
          user={user}
          updating={updating}
          onToggleBan={onToggleBan}
          onResetPassword={onResetPassword}
          onToggleExcluded={onToggleExcluded}
        />
      </td>
    </tr>
  );
}

function UserCard({
  user,
  updating,
  onToggleBan,
  onRoleChange,
  onResetPassword,
  onToggleExcluded,
}: {
  user: User;
  updating: boolean;
  onToggleBan: () => void;
  onRoleChange: (role: User['role']) => void;
  onResetPassword: () => void;
  onToggleExcluded: () => void;
}) {
  return (
    <div className="space-y-3 px-4 py-4">
      <div className="flex items-start gap-2">
        <Avatar name={user.username} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-medium">{user.username}</span>
            {user.isBanned && <Badge tone="danger">已封禁</Badge>}
            {user.scoreExcluded && <Badge>榜单排除</Badge>}
          </div>
          <p className="truncate text-2xs text-muted">{user.email}</p>
        </div>
        <span className="font-mono text-sm tabular-nums">{user.score}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <RoleSelect user={user} updating={updating} onRoleChange={onRoleChange} />
        </div>
        <UserActions
          compact
          user={user}
          updating={updating}
          onToggleBan={onToggleBan}
          onResetPassword={onResetPassword}
          onToggleExcluded={onToggleExcluded}
        />
      </div>
    </div>
  );
}

function RoleSelect({
  user,
  updating,
  onRoleChange,
}: {
  user: User;
  updating: boolean;
  onRoleChange: (role: User['role']) => void;
}) {
  return (
    <select
      value={user.role}
      disabled={updating}
      onChange={(e) => {
        const next = e.target.value as User['role'];
        if (next === user.role) return;
        if (
          !confirm(
            `将「${user.username}」的角色从「${ROLE_LABEL[user.role]}」改为「${ROLE_LABEL[next]}」？\n角色变更会在该用户下一次请求时生效。`,
          )
        ) {
          e.target.value = user.role;
          return;
        }
        onRoleChange(next);
      }}
      className="h-8 w-full bg-paper border border-rule rounded-sm px-2 text-sm"
    >
      {Object.entries(ROLE_LABEL).map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  );
}

function UserActions({
  user,
  updating,
  compact = false,
  onToggleBan,
  onResetPassword,
  onToggleExcluded,
}: {
  user: User;
  updating: boolean;
  compact?: boolean;
  onToggleBan: () => void;
  onResetPassword: () => void;
  onToggleExcluded: () => void;
}) {
  const excludedLabel = user.scoreExcluded ? '恢复榜单' : '排除榜单';
  const banLabel = user.isBanned ? '解封' : '封禁';
  return (
    <div className="flex shrink-0 justify-end gap-1 whitespace-nowrap">
      <Button
        variant="ghost"
        size="sm"
        className={compact ? 'px-1.5' : undefined}
        loading={updating}
        aria-label={excludedLabel}
        title={excludedLabel}
        onClick={onToggleExcluded}
      >
        <ShieldOff className="h-3.5 w-3.5" />
        {!compact && excludedLabel}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={compact ? 'px-1.5' : undefined}
        aria-label="重置密码"
        title="重置密码"
        onClick={onResetPassword}
      >
        <KeyRound className="h-3.5 w-3.5" />
        {!compact && '重置密码'}
      </Button>
      <Button
        variant={user.isBanned ? 'outline' : 'danger'}
        size="sm"
        className={compact ? 'px-1.5' : undefined}
        loading={updating}
        aria-label={banLabel}
        title={banLabel}
        onClick={onToggleBan}
      >
        {user.isBanned ? (
          <>
            <Unlock className="h-3.5 w-3.5" />
            {!compact && '解封'}
          </>
        ) : (
          <>
            <Ban className="h-3.5 w-3.5" />
            {!compact && '封禁'}
          </>
        )}
      </Button>
    </div>
  );
}
