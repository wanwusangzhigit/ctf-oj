import i18n from '@/locales/i18n';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CheckCheck, Trophy, MessageSquare, Megaphone, Settings, Check, Bell } from 'lucide-react';
import {
  listNotifications,
  markAllRead,
  markRead,
} from '@/api/notification';
import { Card, CardBody, CardHeader, CardTitle, Button, Spinner } from '@/components/ui';
import { cn, formatTime, relativeTime } from '@/lib/utils';
import { useToast } from '@/components/ui';
import { ApiClientError } from '@/api/client';
import type { NotificationKind } from '@/types';

const KIND_ICON: Record<NotificationKind, typeof Bell> = {
  solve: Trophy,
  reply: MessageSquare,
  announcement: Megaphone,
  system: Settings,
};
const KIND_LABEL: Record<NotificationKind, string> = {
  solve: i18n.t('解题'),
  reply: i18n.t('回复'),
  announcement: i18n.t('公告'),
  system: i18n.t('系统'),
};

export function NotificationsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [kind, setKind] = useState<NotificationKind | 'all'>('all');

  const list = useQuery({
    queryKey: ['notifications', kind],
    queryFn: () => listNotifications(1, 50),
    staleTime: 0,
  });

  const allReadMut = useMutation({
    mutationFn: markAllRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notifications-unread'] });
      toast.success(i18n.t('已标记全部为已读'));
    },
    onError: (e) => toast.error(e instanceof ApiClientError ? e.message : i18n.t('操作失败')),
  });
  const oneReadMut = useMutation({
    mutationFn: (id: number) => markRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notifications-unread'] });
    },
  });

  const filtered = (list.data?.items ?? []).filter((n) => kind === 'all' || n.kind === kind);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <header className="flex items-end justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{i18n.t('通知中心')}</h1>
          <p className="text-sm text-muted mt-1">{i18n.t('解题、回复、公告都在这里。')}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => allReadMut.mutate()}
          loading={allReadMut.isPending}
        >
          <CheckCheck className="h-3.5 w-3.5" />
          {i18n.t('全部已读')}
        </Button>
      </header>

      <div className="flex items-center gap-1 mb-4 overflow-x-auto">
        <FilterTab active={kind === 'all'} onClick={() => setKind('all')}>
          {i18n.t('全部')}
        </FilterTab>
        {(['solve', 'reply', 'announcement', 'system'] as const).map((k) => (
          <FilterTab key={k} active={kind === k} onClick={() => setKind(k)}>
            {KIND_LABEL[k]}
          </FilterTab>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{i18n.t('最近通知')}</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {list.isLoading ? (
            <div className="py-12 flex items-center justify-center">
              <Spinner className="h-5 w-5 text-muted" />
            </div>
          ) : filtered.length ? (
            <ul className="divide-y divide-border">
              {filtered.map((n) => {
                const Icon = KIND_ICON[n.kind] ?? Bell;
                return (
                  <li
                    key={n.id}
                    className={cn(
                      'px-5 py-3 flex items-start gap-3 hover:bg-surface-2/40 transition-colors',
                      !n.readAt && 'bg-accent/5',
                    )}
                  >
                    <Icon className="h-4 w-4 mt-0.5 shrink-0 text-muted" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{n.title}</span>
                        <span className="text-2xs text-muted">{KIND_LABEL[n.kind]}</span>
                      </div>
                      {n.body && <div className="text-xs text-muted mt-0.5">{n.body}</div>}
                      <div className="text-2xs text-muted mt-1" title={formatTime(n.createdAt)}>
                        {relativeTime(n.createdAt)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {n.link && (
                        <Link
                          to={n.link}
                          onClick={() => !n.readAt && oneReadMut.mutate(n.id)}
                          className="text-2xs text-accent hover:underline"
                        >
                          {i18n.t('打开')}
                        </Link>
                      )}
                      {!n.readAt && (
                        <button
                          type="button"
                          onClick={() => oneReadMut.mutate(n.id)}
                          className="inline-flex items-center justify-center h-7 w-7 rounded hover:bg-surface-2 text-muted hover:text-fg transition-colors"
                          aria-label={i18n.t('标记已读')}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="py-16 text-center text-sm text-muted">{i18n.t('还没有通知。')}</div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function FilterTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center h-8 px-3 rounded-full text-sm whitespace-nowrap border transition-colors',
        active
          ? 'bg-accent text-accent-fg border-transparent'
          : 'bg-surface text-muted border-border hover:bg-surface-2 hover:text-fg',
      )}
    >
      {children}
    </button>
  );
}
