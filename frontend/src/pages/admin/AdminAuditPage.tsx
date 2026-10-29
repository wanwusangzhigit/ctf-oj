import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Filter } from 'lucide-react';
import { Spinner } from '@/components/ui';
import { listAudit } from '@/api/audit';
import { formatTime, relativeTime } from '@/lib/utils';
import type { AuditLogEntry } from '@/types';

/**
 * AdminAuditPage — chronological log of every privileged action:
 * login/promote/ban, settings edit, challenge create/update/delete,
 * competition create/activate, etc.
 *
 * Filters narrow by action verb or target type. Pagination at bottom.
 */
export function AdminAuditPage() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [targetType, setTargetType] = useState('');
  const pageSize = 50;

  const q = useQuery({
    queryKey: ['admin-audit', page, action, targetType],
    queryFn: () =>
      listAudit({
        page,
        pageSize,
        action: action || undefined,
        targetType: targetType || undefined,
      }),
    staleTime: 15_000,
  });

  const data = q.data;
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <header className="border-t-2 border-ink pt-6">
        <p className="font-mono text-2xs text-ink-3 mb-3">
          $ tail -f /var/log/admin.audit
        </p>
        <h2 className="text-2xl font-semibold tracking-tight text-ink">
          审计日志
        </h2>
        <p className="mt-1 text-sm text-ink-3 max-w-prose">
          管理员关键操作记录 —— 按时间倒序排列。
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3 border-b border-rule pb-3">
        <span className="inline-flex items-center gap-1 text-2xs font-mono text-ink-3">
          <Filter className="h-3 w-3" /> filter:
        </span>
        <select
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setPage(1);
          }}
          className="h-7 px-2 bg-paper border border-rule rounded-sm text-2xs font-mono"
        >
          <option value="">all actions</option>
          <ActionOptions />
        </select>
        <select
          value={targetType}
          onChange={(e) => {
            setTargetType(e.target.value);
            setPage(1);
          }}
          className="h-7 px-2 bg-paper border border-rule rounded-sm text-2xs font-mono"
        >
          <option value="">all targets</option>
          <option value="user">user</option>
          <option value="challenge">challenge</option>
          <option value="attachment">attachment</option>
          <option value="hint">hint</option>
          <option value="category">category</option>
          <option value="announcement">announcement</option>
          <option value="competition">competition</option>
          <option value="setting">setting</option>
          <option value="settings">settings (legacy)</option>
          <option value="instance">instance</option>
          <option value="access_group">access_group</option>
          <option value="community">community</option>
          <option value="broadcast">broadcast</option>
          <option value="server">server</option>
        </select>
        <span className="ml-auto text-2xs font-mono text-ink-3 tabular-nums">
          {total} entries
        </span>
      </div>

      {q.isLoading ? (
        <div className="py-10 flex items-center justify-center">
          <Spinner className="h-5 w-5 text-ink-3" />
        </div>
      ) : q.isError ? (
        <div className="py-10 text-center text-sm text-ink-3">
          无法加载审计日志。
        </div>
      ) : (data?.items?.length ?? 0) === 0 ? (
        <div className="py-10 text-center text-sm text-ink-3">
          无匹配记录。
        </div>
      ) : (
        <div className="border-t border-ink">
          <ul>
            {data!.items.map((e) => (
              <AuditRow key={e.id} entry={e} />
            ))}
          </ul>
          <div className="flex items-center justify-between py-4 text-2xs font-mono text-ink-3">
            <span>
              page {page} / {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="px-2 py-1 border border-rule rounded-sm hover:border-rule-strong disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ← prev
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="px-2 py-1 border border-rule rounded-sm hover:border-rule-strong disabled:opacity-40 disabled:cursor-not-allowed"
              >
                next →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AuditRow({ entry }: { entry: AuditLogEntry }) {
  const delegated = delegationOf(entry.payload);
  return (
    <li className="grid grid-cols-[auto_1fr_auto] gap-x-3 items-baseline py-2.5 border-b border-rule">
      <span className="font-mono text-2xs text-ink-3 tabular-nums self-start mt-0.5">
        {relativeTime(entry.createdAt)}
      </span>
      <div className="min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-mono text-2xs text-amber font-medium">
            {entry.action}
          </span>
          <span className="font-mono text-2xs text-ink-3">
            {entry.targetType}
            {entry.targetId ? `#${entry.targetId}` : ''}
          </span>
          {delegated && (
            <span className="border border-rule bg-paper-2 px-1.5 py-0.5 font-mono text-2xs text-oxblood">
              授权操作
            </span>
          )}
        </div>
        <div className="text-sm text-ink-2 mt-0.5">
          by <span className="font-medium">{entry.actorName}</span>
          {entry.ip && (
            <span className="ml-2 font-mono text-2xs text-ink-3">{entry.ip}</span>
          )}
        </div>
        {entry.payload && (
          <pre className="mt-1 font-mono text-2xs text-ink-3 bg-paper-2 border border-rule rounded-sm p-2 whitespace-pre-wrap break-all max-w-prose">
            {entry.payload}
          </pre>
        )}
      </div>
      <span className="font-mono text-2xs text-ink-3 tabular-nums self-start mt-0.5">
        {formatTime(entry.createdAt)}
      </span>
    </li>
  );
}

function delegationOf(payload?: string): boolean {
  if (!payload) return false;
  try {
    const parsed = JSON.parse(payload) as { delegated?: unknown };
    return parsed.delegated === true;
  } catch {
    return false;
  }
}

function ActionOptions() {
  const actions = [
    'login',
    'logout',
    'register',
    'user.promote',
    'user.demote',
    'user.ban',
    'user.unban',
    'user.role',
    'user.score_excluded',
    'user.reset_password',
    'challenge.create',
    'challenge.update',
    'challenge.delete',
    'challenge.access',
    'challenge.source_upload',
    'challenge.source_delete',
    'attachment.upload',
    'attachment.delete',
    'hint.create',
    'hint.update',
    'hint.delete',
    'category.create',
    'category.update',
    'category.delete',
    'announcement.create',
    'announcement.update',
    'announcement.delete',
    'settings.update',
    'competition.create',
    'competition.update',
    'competition.activate',
    'competition.delete',
    'competition.access',
    'access_group.create',
    'access_group.update',
    'access_group.delete',
    'community.policy',
    'community.access',
    'instance.stop',
    'broadcast.send',
    'server.prune',
  ];
  return (
    <>
      {actions.map((a) => (
        <option key={a} value={a}>
          {a}
        </option>
      ))}
    </>
  );
}
