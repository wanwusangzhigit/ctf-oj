import { useDeferredValue, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { SlidersHorizontal } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Input,
  Spinner,
} from '@/components/ui';
import { Avatar } from '@/components/layout/Avatar';
import { adminListUsers } from '@/api/admin';
import { formatTime } from '@/lib/utils';
import { ROLE_LABEL } from '@/lib/permissions';
import type { Role, User } from '@/types';

const PAGE_SIZE = 50;

const SELECT_CLS = 'h-9 px-2 bg-paper border border-rule rounded-sm text-sm';

const MANAGE_LINK_CLS =
  'inline-flex h-7 items-center gap-1 px-2 rounded-sm text-2xs text-ink transition-colors hover:bg-paper-2 hover:text-amber hover:no-underline whitespace-nowrap';

export function AdminUsersPage() {
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

  const users = list.data?.items ?? [];
  const total = list.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

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
            className={SELECT_CLS}
          >
            <option value="">全部角色</option>
            {(Object.keys(ROLE_LABEL) as Role[]).map((value) => (
              <option key={value} value={value}>
                {ROLE_LABEL[value]}
              </option>
            ))}
          </select>
          <select
            value={banned}
            onChange={(e) => setBanned(e.target.value)}
            className={SELECT_CLS}
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
                <UserCard key={u.id} user={u} />
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
                    <UserRow key={u.id} user={u} />
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

function UserRow({ user }: { user: User }) {
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
      <td className="px-5 py-3">{ROLE_LABEL[user.role]}</td>
      <td className="px-5 py-3 font-mono tabular-nums">{user.score}</td>
      <td className="hidden px-5 py-3 text-2xs text-muted lg:table-cell">
        {formatTime(user.createdAt)}
      </td>
      <td className="px-5 py-3">
        <div className="flex justify-end">
          <ManageLink user={user} />
        </div>
      </td>
    </tr>
  );
}

function UserCard({ user }: { user: User }) {
  return (
    <div className="flex items-center gap-2 px-4 py-4">
      <Avatar name={user.username} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-medium">{user.username}</span>
          {user.isBanned && <Badge tone="danger">已封禁</Badge>}
          {user.scoreExcluded && <Badge>榜单排除</Badge>}
        </div>
        <p className="truncate text-2xs text-muted">
          {ROLE_LABEL[user.role]} · {user.email}
        </p>
      </div>
      <span className="font-mono text-sm tabular-nums">{user.score}</span>
      <ManageLink user={user} />
    </div>
  );
}

function ManageLink({ user }: { user: User }) {
  const label = `管理「${user.username}」`;
  return (
    <Link
      to={`/admin/users/${user.id}`}
      className={MANAGE_LINK_CLS}
      aria-label={label}
      title={label}
    >
      <SlidersHorizontal className="h-3.5 w-3.5" />
      管理
    </Link>
  );
}
